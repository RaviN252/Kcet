const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const cashfree = require('../services/cashfree');
const {
  sendPaymentSuccessEmail,
  sendPaymentFailureEmail,
  sendAdminPaymentClaimEmail,
} = require('../services/email');

const router = express.Router();
router.use(requireAuth);

// Public (to any logged-in user) info needed to build the UPI payment QR/link.
// Cashfree isn't whitelisted yet, so this is the payment path in active use.
router.get('/upi-info', (req, res) => {
  res.json({
    upiId: process.env.UPI_ID || '',
    payeeName: process.env.UPI_PAYEE_NAME || 'Challenging Study Centre',
    adminContactPhone: process.env.ADMIN_CONTACT_PHONE || '',
  });
});

// The student's own payment claims, so the frontend can show "pending verification"
// state for a subject instead of the buy button.
router.get('/mine', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.subject_id AS subjectId, COALESCE(s.name, p.subject_name_snapshot) AS subjectName,
            p.amount, p.status, p.payment_method AS paymentMethod,
            p.gateway_payment_id AS utr, p.created_at AS createdAt
     FROM payments p
     LEFT JOIN subjects s ON s.id = p.subject_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json({ payments: rows });
});

// Records that the student opened the UPI payment screen, *before* they've paid or
// entered a UTR. This is what lets us remind them later ("you started paying but
// never confirmed it") — reuses an existing unfinished intent instead of piling up
// duplicates if they reopen the screen more than once.
router.post('/upi-intent', async (req, res) => {
  try {
    const { subjectId } = req.body;
    const [[subject]] = await pool.query('SELECT * FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const [ownedRows] = await pool.query(
      'SELECT id FROM purchases WHERE user_id = ? AND subject_id = ?',
      [req.user.id, subjectId]
    );
    if (ownedRows[0]) return res.status(409).json({ message: 'Already purchased' });

    const [[existing]] = await pool.query(
      `SELECT id FROM payments
       WHERE user_id = ? AND subject_id = ? AND payment_method = 'upi'
         AND status = 'created' AND gateway_payment_id IS NULL`,
      [req.user.id, subjectId]
    );
    if (existing) return res.json({ id: existing.id });

    const [result] = await pool.query(
      `INSERT INTO payments (user_id, subject_id, subject_name_snapshot, payment_method, amount, status)
       VALUES (?, ?, ?, 'upi', ?, 'created')`,
      [req.user.id, subjectId, subject.name, subject.price]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Could not record payment intent', error: err.message });
  }
});

// Student submits proof of a UPI payment they made outside the app. This does NOT
// grant access — it completes their earlier intent into a pending claim that an
// admin must verify and approve from the Manual Payment page.
router.post('/upi-claim', async (req, res) => {
  try {
    const { subjectId, utr } = req.body;
    if (!subjectId || !utr || !utr.trim()) {
      return res.status(400).json({ message: 'subjectId and a UPI transaction reference are required' });
    }

    const [[subject]] = await pool.query('SELECT * FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const [ownedRows] = await pool.query(
      'SELECT id FROM purchases WHERE user_id = ? AND subject_id = ?',
      [req.user.id, subjectId]
    );
    if (ownedRows[0]) return res.status(409).json({ message: 'Already purchased' });

    const [submittedRows] = await pool.query(
      `SELECT id FROM payments
       WHERE user_id = ? AND subject_id = ? AND payment_method = 'upi'
         AND status = 'created' AND gateway_payment_id IS NOT NULL`,
      [req.user.id, subjectId]
    );
    if (submittedRows[0]) {
      return res.status(409).json({ message: 'You already have a pending claim for this subject — please wait for admin to verify it' });
    }

    const [[intent]] = await pool.query(
      `SELECT id FROM payments
       WHERE user_id = ? AND subject_id = ? AND payment_method = 'upi'
         AND status = 'created' AND gateway_payment_id IS NULL`,
      [req.user.id, subjectId]
    );

    let paymentId;
    if (intent) {
      await pool.query('UPDATE payments SET gateway_payment_id = ? WHERE id = ?', [utr.trim(), intent.id]);
      paymentId = intent.id;
    } else {
      const [result] = await pool.query(
        `INSERT INTO payments (user_id, subject_id, subject_name_snapshot, payment_method, gateway_payment_id, amount, status)
         VALUES (?, ?, ?, 'upi', ?, ?, 'created')`,
        [req.user.id, subjectId, subject.name, utr.trim(), subject.price]
      );
      paymentId = result.insertId;
    }

    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const [admins] = await pool.query("SELECT email FROM users WHERE role = 'admin'");
    const payment = { amount: subject.price, gateway_payment_id: utr.trim() };
    admins.forEach((admin) => {
      sendAdminPaymentClaimEmail(admin.email, user, subject, payment).catch((e) =>
        console.error('Failed to send admin claim email:', e.message)
      );
    });

    res.status(201).json({ id: paymentId, message: 'Payment claim submitted — waiting for admin to verify' });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit payment claim', error: err.message });
  }
});

router.post('/create-order', async (req, res) => {
  try {
    const { subjectId } = req.body;
    const [[subject]] = await pool.query('SELECT * FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const [ownedRows] = await pool.query(
      'SELECT id FROM purchases WHERE user_id = ? AND subject_id = ?',
      [req.user.id, subjectId]
    );
    if (ownedRows[0]) return res.status(409).json({ message: 'Already purchased' });

    if (Number(subject.price) === 0) {
      const [result] = await pool.query(
        `INSERT INTO payments (user_id, subject_id, subject_name_snapshot, payment_method, amount, status)
         VALUES (?, ?, ?, 'free', 0, 'success')`,
        [req.user.id, subjectId, subject.name]
      );
      await pool.query('INSERT INTO purchases (user_id, subject_id, payment_id) VALUES (?, ?, ?)', [
        req.user.id,
        subjectId,
        result.insertId,
      ]);
      return res.json({ free: true });
    }

    if (!cashfree.isConfigured()) {
      return res.status(503).json({
        message: 'Payments are not configured yet — add CASHFREE_APP_ID / CASHFREE_SECRET_KEY to .env',
      });
    }

    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const orderId = `order_${subjectId}_${req.user.id}_${Date.now()}`;

    const order = await cashfree.createOrder({
      orderId,
      amount: Number(subject.price),
      customer: user,
      returnUrl: `${process.env.CLIENT_URL}/papers/${subjectId}`,
    });

    await pool.query(
      `INSERT INTO payments (user_id, subject_id, subject_name_snapshot, payment_method, gateway_order_id, amount, status)
       VALUES (?, ?, ?, 'online', ?, ?, 'created')`,
      [req.user.id, subjectId, subject.name, orderId, subject.price]
    );

    res.json({
      orderId,
      paymentSessionId: order.payment_session_id,
      amount: subject.price,
      subject: { id: subject.id, name: subject.name, price: subject.price },
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not create order', error: err.message });
  }
});

// Called after the Cashfree checkout closes (success, failure, or dismissal). Truth
// comes from Cashfree's own order-status API, never from client-supplied state.
router.post('/verify', async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    if (!orderId) return res.status(400).json({ message: 'orderId is required' });

    const [paymentRows] = await pool.query(
      'SELECT * FROM payments WHERE gateway_order_id = ? AND user_id = ?',
      [orderId, req.user.id]
    );
    const payment = paymentRows[0];
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    if (payment.status === 'success') {
      return res.json({ status: 'success', message: 'Payment already verified' });
    }

    const order = await cashfree.getOrder(orderId);
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const [[subjectRow]] = await pool.query('SELECT * FROM subjects WHERE id = ?', [payment.subject_id]);
    const subject = subjectRow || { name: payment.subject_name_snapshot };

    if (order.order_status === 'PAID') {
      const gatewayPaymentId = order.cf_order_id ? String(order.cf_order_id) : null;
      await pool.query(
        "UPDATE payments SET status = 'success', gateway_payment_id = ? WHERE id = ?",
        [gatewayPaymentId, payment.id]
      );
      await pool.query(
        `INSERT INTO purchases (user_id, subject_id, payment_id) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE payment_id = VALUES(payment_id)`,
        [req.user.id, payment.subject_id, payment.id]
      );
      sendPaymentSuccessEmail(user, subject, { ...payment, gateway_payment_id: gatewayPaymentId }).catch((e) =>
        console.error('Failed to send success email:', e.message)
      );
      return res.json({ status: 'success', message: 'Payment verified, access unlocked' });
    }

    const finalStatus = reason === 'dismissed' ? 'cancelled' : 'failed';
    await pool.query('UPDATE payments SET status = ? WHERE id = ?', [finalStatus, payment.id]);
    sendPaymentFailureEmail(user, subject, { ...payment, status: finalStatus }).catch((e) =>
      console.error('Failed to send failure email:', e.message)
    );
    res.json({ status: finalStatus, message: `Payment ${finalStatus}` });
  } catch (err) {
    res.status(500).json({ message: 'Verification failed', error: err.message });
  }
});

module.exports = router;
