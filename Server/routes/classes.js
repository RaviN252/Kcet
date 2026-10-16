const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Same rule as the paper viewer: owning a subject (or it being free) unlocks its
// live and recorded classes.
async function userHasSubjectAccess(userId, role, subject) {
  if (role === 'admin') return true;
  if (Number(subject.price) === 0) return true;
  const [rows] = await pool.query('SELECT id FROM purchases WHERE user_id = ? AND subject_id = ?', [
    userId,
    subject.id,
  ]);
  return Boolean(rows[0]);
}

// The YouTube video ids are unlisted links — only ever send them to users with access.
router.get('/:subjectId', async (req, res) => {
  try {
    const [[subject]] = await pool.query('SELECT id, price FROM subjects WHERE id = ?', [req.params.subjectId]);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const hasAccess = await userHasSubjectAccess(req.user.id, req.user.role, subject);
    if (!hasAccess) return res.status(403).json({ message: 'Purchase required to watch classes' });

    const [rows] = await pool.query(
      `SELECT id, title, youtube_video_id AS youtubeVideoId, status,
              started_at AS startedAt, ended_at AS endedAt
       FROM live_classes WHERE subject_id = ?
       ORDER BY started_at DESC`,
      [subject.id]
    );
    const [[viewer]] = await pool.query('SELECT name, phone FROM users WHERE id = ?', [req.user.id]);

    res.json({
      live: rows.find((r) => r.status === 'live') || null,
      recordings: rows.filter((r) => r.status === 'completed'),
      // Shown as a moving overlay on the player so a screen-recorded copy can be traced.
      watermark: `${viewer.name} · ${viewer.phone}`,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load classes', error: err.message });
  }
});

module.exports = router;
