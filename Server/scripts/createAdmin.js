// Usage: node scripts/createAdmin.js <name> <phone> <email> <userId> <password>
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function main() {
  const [name, phone, email, userId, password] = process.argv.slice(2);
  if (!name || !phone || !email || !userId || !password) {
    console.error('Usage: node scripts/createAdmin.js <name> <phone> <email> <userId> <password>');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (name, phone, email, user_id, password_hash, role)
     VALUES (?, ?, ?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin'`,
    [name, phone, email, userId, passwordHash]
  );

  console.log(`Admin user "${userId}" ready.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
