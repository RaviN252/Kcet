const express = require('express');
const pool = require('../../config/db');
const { requireAuth, requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT s.id, s.name, s.price, s.created_at,
      (SELECT COUNT(*) FROM papers pa WHERE pa.subject_id = s.id) AS paperCount,
      (SELECT COUNT(*) FROM purchases pu WHERE pu.subject_id = s.id) AS purchaseCount
    FROM subjects s
    ORDER BY s.name ASC
  `);
  res.json({ subjects: rows });
});

router.post('/', async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Subject name is required' });
    }
    const priceNum = price === undefined || price === '' ? 0 : Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: 'Price must be a non-negative number' });
    }

    const [existing] = await pool.query('SELECT id FROM subjects WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'A subject with this name already exists' });
    }

    const [result] = await pool.query('INSERT INTO subjects (name, price) VALUES (?, ?)', [
      name.trim(),
      priceNum,
    ]);
    res.status(201).json({ subject: { id: result.insertId, name: name.trim(), price: priceNum } });
  } catch (err) {
    res.status(500).json({ message: 'Could not create subject', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price } = req.body;

    const [[existing]] = await pool.query('SELECT * FROM subjects WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ message: 'Subject not found' });

    if (name && name.trim()) {
      const [dupe] = await pool.query('SELECT id FROM subjects WHERE name = ? AND id != ?', [
        name.trim(),
        id,
      ]);
      if (dupe.length > 0) {
        return res.status(409).json({ message: 'A subject with this name already exists' });
      }
    }

    let priceNum = existing.price;
    if (price !== undefined && price !== '') {
      priceNum = Number(price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ message: 'Price must be a non-negative number' });
      }
    }

    await pool.query('UPDATE subjects SET name = ?, price = ? WHERE id = ?', [
      name && name.trim() ? name.trim() : existing.name,
      priceNum,
      id,
    ]);
    res.json({ message: 'Subject updated' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update subject', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[subject]] = await pool.query('SELECT id FROM subjects WHERE id = ?', [id]);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const [[{ paperCount }]] = await pool.query(
      'SELECT COUNT(*) AS paperCount FROM papers WHERE subject_id = ?',
      [id]
    );
    if (paperCount > 0) {
      return res.status(409).json({
        message: `Cannot delete — ${paperCount} paper(s) still belong to this subject. Delete or reassign them first.`,
      });
    }

    // Unresolved payments (a pending UPI claim, an in-flight Cashfree order) need
    // resolving first. Completed history (success/failed/cancelled) does not block
    // deletion — those payment rows survive with subject_id set to NULL.
    const [[{ pendingCount }]] = await pool.query(
      "SELECT COUNT(*) AS pendingCount FROM payments WHERE subject_id = ? AND status = 'created'",
      [id]
    );
    if (pendingCount > 0) {
      return res.status(409).json({
        message: `Cannot delete — ${pendingCount} unresolved payment(s) for this subject. Approve or reject them first.`,
      });
    }

    await pool.query('DELETE FROM subjects WHERE id = ?', [id]);
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete subject', error: err.message });
  }
});

module.exports = router;
