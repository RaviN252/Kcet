const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Public listing of subjects — the sellable unit. Never expose pdf_path here
// (Section 6: view-only access only).
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.id, s.name, s.price,
        (SELECT COUNT(*) FROM papers pa WHERE pa.subject_id = s.id AND pa.status = 'published') AS paperCount
      FROM subjects s
      HAVING paperCount > 0
      ORDER BY s.name ASC
    `);
    res.json({ subjects: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch subjects', error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[subject]] = await pool.query('SELECT id, name, price FROM subjects WHERE id = ?', [id]);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const [folders] = await pool.query(
      'SELECT id, parent_folder_id AS parentFolderId, name FROM folders WHERE subject_id = ? ORDER BY name ASC',
      [id]
    );
    const [papers] = await pool.query(
      "SELECT id, title, folder_id AS folderId FROM papers WHERE subject_id = ? AND status = 'published' ORDER BY title ASC",
      [id]
    );

    res.json({ subject, folders, papers });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch subject', error: err.message });
  }
});

module.exports = router;
