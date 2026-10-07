const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../../config/db');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { uploadPdf } = require('../../middleware/upload');
const { convertPdfToImages, PAGES_DIR } = require('../../services/pdfConvert');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT pa.id, pa.title, pa.subject_id AS subjectId, pa.folder_id AS folderId,
           s.name AS subjectName, s.price, pa.status, pa.created_at,
           (SELECT COUNT(*) FROM purchases pu WHERE pu.subject_id = pa.subject_id) AS userCount
    FROM papers pa
    JOIN subjects s ON s.id = pa.subject_id
    ORDER BY pa.created_at DESC
  `);
  res.json({ papers: rows });
});

router.post('/', uploadPdf.single('pdf'), async (req, res) => {
  try {
    const { title, subjectId, folderId, status } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'A PDF file is required' });
    }
    if (!title || !subjectId) {
      return res.status(400).json({ message: 'title and subjectId are required' });
    }

    const [[subject]] = await pool.query('SELECT id FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) return res.status(400).json({ message: 'Subject not found' });

    let resolvedFolderId = null;
    if (folderId) {
      const [[folder]] = await pool.query(
        'SELECT id FROM folders WHERE id = ? AND subject_id = ?',
        [folderId, subjectId]
      );
      if (!folder) return res.status(400).json({ message: 'Folder not found in this subject' });
      resolvedFolderId = folderId;
    }

    const [result] = await pool.query(
      `INSERT INTO papers (title, subject_id, folder_id, pdf_path, status)
       VALUES (?, ?, ?, ?, ?)`,
      [title, subjectId, resolvedFolderId, req.file.filename, status === 'draft' ? 'draft' : 'published']
    );
    const paperId = result.insertId;

    const pages = await convertPdfToImages(
      path.join(__dirname, '..', '..', 'uploads', 'pdfs', req.file.filename),
      paperId
    );
    for (const p of pages) {
      await pool.query(
        'INSERT INTO paper_pages (paper_id, page_number, image_path) VALUES (?, ?, ?)',
        [paperId, p.pageNumber, p.imagePath]
      );
    }

    res.status(201).json({ id: paperId, pageCount: pages.length });
  } catch (err) {
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

router.put('/:id', uploadPdf.single('pdf'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subjectId, folderId, status } = req.body;

    const [existingRows] = await pool.query('SELECT * FROM papers WHERE id = ?', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ message: 'Paper not found' });

    const effectiveSubjectId = subjectId || existing.subject_id;
    if (subjectId) {
      const [[subject]] = await pool.query('SELECT id FROM subjects WHERE id = ?', [subjectId]);
      if (!subject) return res.status(400).json({ message: 'Subject not found' });
    }

    // folderId absent from the request = leave unchanged; '' or 'none' = clear it
    // (move to directly under the subject); otherwise validate and set it.
    let folderIdValue = existing.folder_id;
    if (folderId === undefined && subjectId && Number(subjectId) !== existing.subject_id) {
      // Subject changed with no explicit folder — the old folder almost certainly
      // doesn't belong to the new subject, so drop it rather than leave it dangling.
      folderIdValue = null;
    }
    if (folderId !== undefined) {
      if (folderId === '' || folderId === 'none') {
        folderIdValue = null;
      } else {
        const [[folder]] = await pool.query(
          'SELECT id FROM folders WHERE id = ? AND subject_id = ?',
          [folderId, effectiveSubjectId]
        );
        if (!folder) return res.status(400).json({ message: 'Folder not found in this subject' });
        folderIdValue = folderId;
      }
    }

    await pool.query(
      `UPDATE papers SET
        title = COALESCE(?, title),
        subject_id = COALESCE(?, subject_id),
        folder_id = ?,
        status = COALESCE(?, status),
        pdf_path = COALESCE(?, pdf_path)
       WHERE id = ?`,
      [title, subjectId || null, folderIdValue, status, req.file?.filename, id]
    );

    // A replacement PDF means the old rendered pages are stale — regenerate them.
    if (req.file) {
      await pool.query('DELETE FROM paper_pages WHERE paper_id = ?', [id]);
      await fs
        .rm(path.join(PAGES_DIR, String(id)), { recursive: true, force: true })
        .catch(() => {});
      const pages = await convertPdfToImages(
        path.join(__dirname, '..', '..', 'uploads', 'pdfs', req.file.filename),
        id
      );
      for (const p of pages) {
        await pool.query(
          'INSERT INTO paper_pages (paper_id, page_number, image_path) VALUES (?, ?, ?)',
          [id, p.pageNumber, p.imagePath]
        );
      }
      await fs
        .unlink(path.join(__dirname, '..', '..', 'uploads', 'pdfs', existing.pdf_path))
        .catch(() => {});
    }

    res.json({ message: 'Paper updated' });
  } catch (err) {
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM papers WHERE id = ?', [id]);
    const paper = rows[0];
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    await pool.query('DELETE FROM papers WHERE id = ?', [id]);

    if (paper.pdf_path) {
      await fs
        .unlink(path.join(__dirname, '..', '..', 'uploads', 'pdfs', paper.pdf_path))
        .catch(() => {});
    }
    await fs.rm(path.join(PAGES_DIR, String(id)), { recursive: true, force: true }).catch(() => {});

    res.json({ message: 'Paper deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

module.exports = router;
