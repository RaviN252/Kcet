const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, userId: user.user_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/signup', async (req, res) => {
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

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR phone = ?',
      [email, phone]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email or phone already in use' });
    }

    const userId = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, phone, email, user_id, password_hash) VALUES (?, ?, ?, ?, ?)',
      [name, phone, email, userId, passwordHash]
    );

    const user = { id: result.insertId, user_id: userId, role: 'user' };
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, name, phone, email, userId, role: 'user' },
    });
  } catch (err) {
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        userId: user.user_id,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, phone, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dateOfBirth,
            email, user_id AS userId, role
     FROM users WHERE id = ?`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'User not found' });
  res.json({ user: rows[0] });
});

// Self-service profile edit — a student can update their own name/phone/date of birth.
// Email is left out on purpose: it's the login identifier, so changing it
// here would be too easy to do by accident and lock yourself out.
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, phone, dateOfBirth } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    let dobValue = null;
    if (dateOfBirth) {
      const parsed = new Date(dateOfBirth);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: 'Enter a valid date of birth' });
      }
      if (parsed > new Date()) {
        return res.status(400).json({ message: 'Date of birth cannot be in the future' });
      }
      dobValue = dateOfBirth;
    }

    const [dupes] = await pool.query('SELECT id FROM users WHERE phone = ? AND id != ?', [
      phone,
      req.user.id,
    ]);
    if (dupes.length > 0) {
      return res.status(409).json({ message: 'Phone number already in use by another account' });
    }

    await pool.query('UPDATE users SET name = ?, phone = ?, date_of_birth = ? WHERE id = ?', [
      name.trim(),
      phone,
      dobValue,
      req.user.id,
    ]);

    const [rows] = await pool.query(
      `SELECT id, name, phone, DATE_FORMAT(date_of_birth, '%Y-%m-%d') AS dateOfBirth,
              email, user_id AS userId, role
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Could not update profile', error: err.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const [rows] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
    // Always respond the same way whether or not the email exists, to avoid leaking which emails are registered.
    if (rows[0]) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await pool.query(
        'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
        [rows[0].id, token, expiresAt]
      );
      await sendPasswordResetEmail(rows[0], token);
    }

    res.json({ message: 'If that email is registered, a reset link has been sent' });
  } catch (err) {
    res.status(500).json({ message: 'Request failed', error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW()',
      [token]
    );
    const reset = rows[0];
    if (!reset) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      reset.user_id,
    ]);
    await pool.query('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Reset failed', error: err.message });
  }
});

module.exports = router;
