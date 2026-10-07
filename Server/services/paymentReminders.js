const pool = require('../config/db');
const { sendPaymentReminderEmail } = require('./email');

const REMINDER_DELAY_MINUTES = 30;

// Finds UPI payment intents (opened the payment screen but never submitted a UTR)
// that are old enough to nudge, and emails the student once each.
async function checkPendingUpiReminders() {
  const [rows] = await pool.query(
    `SELECT p.id, u.name, u.email, s.id AS subjectId, s.name AS subjectName, s.price
     FROM payments p
     JOIN users u ON u.id = p.user_id
     JOIN subjects s ON s.id = p.subject_id
     WHERE p.payment_method = 'upi' AND p.status = 'created'
       AND p.gateway_payment_id IS NULL AND p.reminder_sent_at IS NULL
       AND p.created_at <= NOW() - INTERVAL ? MINUTE`,
    [REMINDER_DELAY_MINUTES]
  );

  for (const row of rows) {
    try {
      await sendPaymentReminderEmail(
        { name: row.name, email: row.email },
        { id: row.subjectId, name: row.subjectName, price: row.price }
      );
      await pool.query('UPDATE payments SET reminder_sent_at = NOW() WHERE id = ?', [row.id]);
    } catch (e) {
      console.error(`Failed to send payment reminder for payment ${row.id}:`, e.message);
    }
  }
}

module.exports = { checkPendingUpiReminders, REMINDER_DELAY_MINUTES };
