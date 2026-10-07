const express = require('express');
const path = require('path');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { applyWatermark } = require('../services/watermark');
const { PAGES_DIR } = require('../services/pdfConvert');

const router = express.Router();
router.use(requireAuth);

// Access is granted per subject: owning a subject unlocks every paper filed
// under it, including ones added after the purchase.
async function userHasAccess(userId, role, paperId) {
  if (role === 'admin') return true;

  const [[paper]] = await pool.query(
    `SELECT s.id AS subjectId, s.price
     FROM papers pa JOIN subjects s ON s.id = pa.subject_id
     WHERE pa.id = ?`,
    [paperId]
  );
  if (!paper) return false;
  if (Number(paper.price) === 0) return true;

  const [rows] = await pool.query(
    'SELECT id FROM purchases WHERE user_id = ? AND subject_id = ?',
    [userId, paper.subjectId]
  );
  return Boolean(rows[0]);
}

router.get('/:paperId', async (req, res) => {
  try {
    const { paperId } = req.params;
    const hasAccess = await userHasAccess(req.user.id, req.user.role, paperId);
    if (!hasAccess) return res.status(403).json({ message: 'Purchase required to view this paper' });

    const [paperRows] = await pool.query(
      `SELECT pa.id, pa.title, s.name AS subject
       FROM papers pa JOIN subjects s ON s.id = pa.subject_id
       WHERE pa.id = ?`,
      [paperId]
    );
    if (!paperRows[0]) return res.status(404).json({ message: 'Paper not found' });

    const [pages] = await pool.query(
      'SELECT page_number FROM paper_pages WHERE paper_id = ? ORDER BY page_number',
      [paperId]
    );

    res.json({ paper: paperRows[0], pageCount: pages.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load viewer', error: err.message });
  }
});

router.get('/:paperId/pages/:pageNumber', async (req, res) => {
  try {
    const { paperId, pageNumber } = req.params;
    const hasAccess = await userHasAccess(req.user.id, req.user.role, paperId);
    if (!hasAccess) return res.status(403).json({ message: 'Purchase required to view this paper' });

    const [rows] = await pool.query(
      'SELECT image_path FROM paper_pages WHERE paper_id = ? AND page_number = ?',
      [paperId, pageNumber]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Page not found' });

    const [[viewer]] = await pool.query('SELECT name, phone, email FROM users WHERE id = ?', [req.user.id]);
    const watermarkText = `${viewer.name} · ${viewer.phone} · ${viewer.email}`;
    const imageBuffer = await applyWatermark(
      path.join(PAGES_DIR, rows[0].image_path),
      watermarkText
    );

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Content-Disposition': 'inline',
    });
    res.send(imageBuffer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load page', error: err.message });
  }
});

module.exports = router;
