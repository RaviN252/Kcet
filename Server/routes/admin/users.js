const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../../config/db');
const { requireAuth, requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ?', [
      email,
      phone,
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email or phone already in use' });
    }

    const userId = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, phone, email, user_id, password_hash) VALUES (?, ?, ?, ?, ?)',
      [name, phone, email, userId, passwordHash]
    );

    res.status(201).json({
      user: { id: result.insertId, name, phone, email, userId, role: 'user' },
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not create user', error: err.message });
  }
});

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;
  const q = (req.query.q || '').trim();

  let whereClause = '';
  const whereParams = [];
  if (q) {
    whereClause = 'WHERE u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?';
    const likeQ = `%${q}%`;
    whereParams.push(likeQ, likeQ, likeQ);
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
    whereParams
  );

  const [rows] = await pool.query(
    `SELECT
      u.id, u.name, u.phone, u.email, u.user_id AS userId, u.role, u.created_at,
      (SELECT COUNT(*) FROM purchases pu WHERE pu.user_id = u.id) AS subjectsPurchased,
      (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ')
        FROM purchases pu JOIN subjects s ON s.id = pu.subject_id
        WHERE pu.user_id = u.id) AS subjectNames,
      (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
        WHERE p.user_id = u.id AND p.status = 'success') AS totalPaid
    FROM users u
    ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT ${limit} OFFSET ${offset}`,
    whereParams
  );

  res.json({ users: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, password } = req.body;

    const [[existing]] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ message: 'User not found' });

    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' });
    }
    if (password && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (email || phone) {
      const [dupes] = await pool.query(
        'SELECT id FROM users WHERE (email = ? OR phone = ?) AND id != ?',
        [email || existing.email, phone || existing.phone, id]
      );
      if (dupes.length > 0) {
        return res.status(409).json({ message: 'Email or phone already in use by another user' });
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : existing.password_hash;

    await pool.query('UPDATE users SET name = ?, phone = ?, email = ?, password_hash = ? WHERE id = ?', [
      name || existing.name,
      phone || existing.phone,
      email || existing.email,
      passwordHash,
      id,
    ]);

    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update user', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete user', error: err.message });
  }
});

router.get('/:id/payments', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.subject_id AS subjectId, COALESCE(s.name, p.subject_name_snapshot) AS subjectName,
            p.amount, p.status, p.payment_method AS paymentMethod,
            p.gateway_order_id AS gatewayOrderId, p.gateway_payment_id AS gatewayPaymentId,
            p.created_at AS createdAt
     FROM payments p
     LEFT JOIN subjects s ON s.id = p.subject_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [req.params.id]
  );
  res.json({ payments: rows });
});

module.exports = router;
