const express = require('express');
const pool = require('../../config/db');
const { requireAuth, requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// Everything in one subject's tree: all folders (flat, with parent_folder_id)
// plus all papers (flat, with folder_id) — the frontend assembles the tree.
router.get('/subject/:subjectId', async (req, res) => {
  const { subjectId } = req.params;
  const [folders] = await pool.query(
    'SELECT id, parent_folder_id AS parentFolderId, name FROM folders WHERE subject_id = ? ORDER BY name ASC',
    [subjectId]
  );
  const [papers] = await pool.query(
    'SELECT id, title, folder_id AS folderId, status FROM papers WHERE subject_id = ? ORDER BY title ASC',
    [subjectId]
  );
  res.json({ folders, papers });
});

router.post('/', async (req, res) => {
  try {
    const { subjectId, parentFolderId, name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    let resolvedSubjectId = subjectId;
    if (parentFolderId) {
      const [[parent]] = await pool.query('SELECT subject_id FROM folders WHERE id = ?', [
        parentFolderId,
      ]);
      if (!parent) return res.status(404).json({ message: 'Parent folder not found' });
      resolvedSubjectId = parent.subject_id;
    } else {
      const [[subject]] = await pool.query('SELECT id FROM subjects WHERE id = ?', [subjectId]);
      if (!subject) return res.status(404).json({ message: 'Subject not found' });
    }

    const [result] = await pool.query(
      'INSERT INTO folders (subject_id, parent_folder_id, name) VALUES (?, ?, ?)',
      [resolvedSubjectId, parentFolderId || null, name.trim()]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Could not create folder', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Folder name is required' });
    }
    const [[folder]] = await pool.query('SELECT id FROM folders WHERE id = ?', [id]);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    await pool.query('UPDATE folders SET name = ? WHERE id = ?', [name.trim(), id]);
    res.json({ message: 'Folder renamed' });
  } catch (err) {
    res.status(500).json({ message: 'Could not rename folder', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[folder]] = await pool.query('SELECT id FROM folders WHERE id = ?', [id]);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const [[{ paperCount }]] = await pool.query(
      'SELECT COUNT(*) AS paperCount FROM papers WHERE folder_id = ?',
      [id]
    );
    if (paperCount > 0) {
      return res.status(409).json({ message: `Cannot delete — ${paperCount} paper(s) are directly in this folder. Move or delete them first.` });
    }

    const [[{ childCount }]] = await pool.query(
      'SELECT COUNT(*) AS childCount FROM folders WHERE parent_folder_id = ?',
      [id]
    );
    if (childCount > 0) {
      return res.status(409).json({ message: `Cannot delete — ${childCount} subfolder(s) are inside this folder. Delete them first.` });
    }

    await pool.query('DELETE FROM folders WHERE id = ?', [id]);
    res.json({ message: 'Folder deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete folder', error: err.message });
  }
});

module.exports = router;
