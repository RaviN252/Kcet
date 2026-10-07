const express = require('express');
const pool = require('../../config/db');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { sendPaymentSuccessEmail, sendPaymentFailureEmail } = require('../../services/email');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Student-submitted UPI claims awaiting verification.
router.get('/pending', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.id, u.name AS studentName, u.email AS studentEmail, u.phone AS studentPhone,
           s.name AS subjectName, p.amount, p.gateway_payment_id AS utr, p.created_at AS createdAt
    FROM payments p
    JOIN users u ON u.id = p.user_id
    JOIN subjects s ON s.id = p.subject_id
    WHERE p.payment_method = 'upi' AND p.status = 'created' AND p.gateway_payment_id IS NOT NULL
    ORDER BY p.created_at ASC
  `);
  res.json({ pending: rows });
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const [[payment]] = await pool.query(
      "SELECT * FROM payments WHERE id = ? AND status = 'created' AND payment_method = 'upi' AND gateway_payment_id IS NOT NULL",
      [id]
    );
    if (!payment) return res.status(404).json({ message: 'Pending payment not found' });

    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [payment.user_id]);
    const [[subject]] = await pool.query('SELECT * FROM subjects WHERE id = ?', [payment.subject_id]);

    await pool.query("UPDATE payments SET status = 'success' WHERE id = ?", [id]);
    await pool.query(
      `INSERT INTO purchases (user_id, subject_id, payment_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE payment_id = VALUES(payment_id)`,
      [payment.user_id, payment.subject_id, payment.id]
    );

    sendPaymentSuccessEmail(user, subject, payment).catch((e) =>
      console.error('Failed to send success email:', e.message)
    );

    res.json({ message: `Approved — ${user.name} now has access to ${subject.name}` });
  } catch (err) {
    res.status(500).json({ message: 'Could not approve payment', error: err.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const [[payment]] = await pool.query(
      "SELECT * FROM payments WHERE id = ? AND status = 'created'",
      [id]
    );
    if (!payment) return res.status(404).json({ message: 'Pending payment not found' });

    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [payment.user_id]);
    const [[subject]] = await pool.query('SELECT * FROM subjects WHERE id = ?', [payment.subject_id]);

    await pool.query("UPDATE payments SET status = 'failed' WHERE id = ?", [id]);

    sendPaymentFailureEmail(user, subject, { ...payment, status: 'failed' }).catch((e) =>
      console.error('Failed to send failure email:', e.message)
    );

    res.json({ message: `Rejected claim from ${user.name}` });
  } catch (err) {
    res.status(500).json({ message: 'Could not reject payment', error: err.message });
  }
});

// Manually mark a payment complete for offline payments (cash, direct bank
// transfer, UPI outside the app, etc.) and immediately unlock the subject
// (and every paper under it) for that student.
router.post('/manual', async (req, res) => {
  try {
    const { userId, subjectId, amount } = req.body;
    if (!userId || !subjectId) {
      return res.status(400).json({ message: 'userId and subjectId are required' });
    }

    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const [[subject]] = await pool.query('SELECT * FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const [ownedRows] = await pool.query(
      'SELECT id FROM purchases WHERE user_id = ? AND subject_id = ?',
      [userId, subjectId]
    );
    if (ownedRows[0]) {
      return res.status(409).json({ message: 'This user already has access to this subject' });
    }

    // Admin can record a discounted/partial amount actually collected (e.g. a ₹300
    // subject sold for ₹200 in person) — defaults to the full price if not given.
    const amountCollected = amount === undefined || amount === '' ? subject.price : Number(amount);
    if (Number.isNaN(amountCollected) || amountCollected < 0) {
      return res.status(400).json({ message: 'Amount must be a non-negative number' });
    }

    const [result] = await pool.query(
      `INSERT INTO payments (user_id, subject_id, subject_name_snapshot, payment_method, amount, status)
       VALUES (?, ?, ?, 'manual', ?, 'success')`,
      [userId, subjectId, subject.name, amountCollected]
    );
    await pool.query('INSERT INTO purchases (user_id, subject_id, payment_id) VALUES (?, ?, ?)', [
      userId,
      subjectId,
      result.insertId,
    ]);

    sendPaymentSuccessEmail(user, subject, { amount: amountCollected, gateway_payment_id: 'manual' }).catch(
      (e) => console.error('Failed to send success email:', e.message)
    );

    res.status(201).json({ message: `Marked ${subject.name} as paid for ${user.name}` });
  } catch (err) {
    res.status(500).json({ message: 'Could not record manual payment', error: err.message });
  }
});

module.exports = router;
