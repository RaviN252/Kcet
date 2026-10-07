// Bulk-imports existing students from a CSV export, without ever sending an
// email (it writes directly via SQL and never calls services/email.js), so
// it's safe to run without affecting the real-time email flow for new users.
//
// Expected CSV columns: Name,Email,Phone,Password,Amount_Paid,Subject,
// Maths_Amount,Physics_Amount,Notes (Notes is ignored).
//
// A row's Subject can be "MATHS", "PHYSICS", or "MATHS + PHYSICS". For a
// combined row, this script grants one subject per non-empty amount column —
// if only one of Maths_Amount/Physics_Amount is filled despite Subject saying
// "MATHS + PHYSICS", only that one subject is granted, and the row is flagged
// under `partial` in the report so you can decide whether to grant the other
// subject manually via the Manual Payment page.
//
// Usage:
//   node scripts/importStudents.js <path-to-csv> --dry-run   (no DB writes, just a report)
//   node scripts/importStudents.js <path-to-csv>             (actually imports)

const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/db');

const DRY_RUN = process.argv.includes('--dry-run');
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: node scripts/importStudents.js <path-to-csv> [--dry-run]');
  process.exit(1);
}

// Minimal RFC4180 CSV parser — handles quoted fields containing commas,
// escaped quotes (""), and embedded newlines (as seen in the Notes column).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizePhone(raw) {
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function isValidPhone(digits) {
  return /^[6-9]\d{9}$/.test(digits);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function main() {
  const text = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(text);
  const header = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);

  const idx = (name) => header.indexOf(name);
  const col = {
    name: idx('Name'),
    email: idx('Email'),
    phone: idx('Phone'),
    password: idx('Password'),
    subject: idx('Subject'),
    maths: idx('Maths_Amount'),
    physics: idx('Physics_Amount'),
  };
  for (const [key, i] of Object.entries(col)) {
    if (i === -1) throw new Error(`CSV is missing expected column for "${key}"`);
  }

  const [subjectRows] = await pool.query('SELECT id, name FROM subjects');
  const subjectByName = new Map(subjectRows.map((s) => [s.name.trim().toUpperCase(), s]));

  const report = {
    totalRows: dataRows.length,
    usersCreated: 0,
    usersSkippedExisting: 0,
    purchasesCreated: 0,
    purchasesSkippedExisting: 0,
    partial: [], // rows that said "MATHS + PHYSICS" but only one amount was usable
    errors: [], // rows that couldn't be processed at all
  };

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const lineNo = i + 2; // +1 for header, +1 for 1-indexing
    const name = (r[col.name] || '').trim();
    const email = (r[col.email] || '').trim().toLowerCase();
    const phoneRaw = (r[col.phone] || '').trim();
    const password = (r[col.password] || '').trim();
    const subjectField = (r[col.subject] || '').trim().toUpperCase();
    const mathsAmountRaw = (r[col.maths] || '').trim();
    const physicsAmountRaw = (r[col.physics] || '').trim();

    if (!name || !email || !phoneRaw || !password) {
      report.errors.push({ line: lineNo, name, email, reason: 'Missing a required field' });
      continue;
    }
    if (!isValidEmail(email)) {
      report.errors.push({ line: lineNo, name, email, reason: 'Invalid email format' });
      continue;
    }
    const phone = normalizePhone(phoneRaw);
    if (!isValidPhone(phone)) {
      report.errors.push({
        line: lineNo,
        name,
        email,
        reason: `Invalid phone number: "${phoneRaw}" normalized to "${phone}"`,
      });
      continue;
    }

    const wantsMaths = subjectField.includes('MATHS') && mathsAmountRaw !== '';
    const wantsPhysics = subjectField.includes('PHYSICS') && physicsAmountRaw !== '';
    const wants = [];
    if (wantsMaths) wants.push({ name: 'MATHS', amount: Number(mathsAmountRaw) });
    if (wantsPhysics) wants.push({ name: 'PHYSICS', amount: Number(physicsAmountRaw) });

    if (wants.length === 0) {
      report.errors.push({
        line: lineNo,
        name,
        email,
        reason: `No usable amount for Subject="${subjectField}" (Maths_Amount="${mathsAmountRaw}", Physics_Amount="${physicsAmountRaw}")`,
      });
      continue;
    }

    const subjectsIntended = subjectField.split('+').map((s) => s.trim()).filter(Boolean);
    if (subjectsIntended.length > wants.length) {
      report.partial.push({
        line: lineNo,
        name,
        email,
        subjectField,
        granted: wants.map((w) => w.name),
      });
    }

    let missingSubject = false;
    for (const w of wants) {
      if (!subjectByName.has(w.name)) {
        report.errors.push({
          line: lineNo,
          name,
          email,
          reason: `Subject "${w.name}" does not exist in the database`,
        });
        missingSubject = true;
      }
    }
    if (missingSubject) continue;

    // Read-only in both modes, so --dry-run can accurately show whether this
    // row matches an existing user/purchase (important once a later batch
    // overlaps with people already imported) without writing anything.
    const [existingRows] = await pool.query('SELECT id, name FROM users WHERE email = ? OR phone = ?', [
      email,
      phone,
    ]);
    const existing = existingRows[0];

    if (DRY_RUN) {
      const userNote = existing
        ? `existing user #${existing.id} (${existing.name})`
        : 'NEW user';
      const subjectNotes = [];
      for (const w of wants) {
        if (existing) {
          const subject = subjectByName.get(w.name);
          const [ownedRows] = await pool.query(
            'SELECT id FROM purchases WHERE user_id = ? AND subject_id = ?',
            [existing.id, subject.id]
          );
          subjectNotes.push(
            ownedRows[0] ? `${w.name}:₹${w.amount} (ALREADY OWNED, will skip)` : `${w.name}:₹${w.amount} (new)`
          );
        } else {
          subjectNotes.push(`${w.name}:₹${w.amount} (new)`);
        }
      }
      console.log(`[dry-run] line ${lineNo}: ${name} <${email}> — ${userNote} -> ${subjectNotes.join(', ')}`);
      continue;
    }

    // --- Actual DB writes (only reached when not --dry-run) ---
    let userId;
    if (existing) {
      userId = existing.id;
      report.usersSkippedExisting++;
    } else {
      const internalUserId = crypto.randomBytes(8).toString('hex');
      const passwordHash = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        'INSERT INTO users (name, phone, email, user_id, password_hash) VALUES (?, ?, ?, ?, ?)',
        [name, phone, email, internalUserId, passwordHash]
      );
      userId = result.insertId;
      report.usersCreated++;
    }

    for (const w of wants) {
      const subject = subjectByName.get(w.name);
      const [ownedRows] = await pool.query(
        'SELECT id FROM purchases WHERE user_id = ? AND subject_id = ?',
        [userId, subject.id]
      );
      if (ownedRows[0]) {
        report.purchasesSkippedExisting++;
        report.skippedPurchaseDetails = report.skippedPurchaseDetails || [];
        report.skippedPurchaseDetails.push({ line: lineNo, name, email, subject: w.name, amount: w.amount });
        continue;
      }
      const [paymentResult] = await pool.query(
        `INSERT INTO payments (user_id, subject_id, subject_name_snapshot, payment_method, amount, status)
         VALUES (?, ?, ?, 'manual', ?, 'success')`,
        [userId, subject.id, subject.name, w.amount]
      );
      await pool.query('INSERT INTO purchases (user_id, subject_id, payment_id) VALUES (?, ?, ?)', [
        userId,
        subject.id,
        paymentResult.insertId,
      ]);
      report.purchasesCreated++;
    }
  }

  console.log('\n=== Import report ===');
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
