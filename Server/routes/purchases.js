const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [subjects] = await pool.query(
    `SELECT s.id, s.name, pu.purchased_at AS purchasedAt,
       EXISTS(SELECT 1 FROM live_classes lc WHERE lc.subject_id = s.id AND lc.status = 'live') AS liveNow,
       (SELECT COUNT(*) FROM live_classes lc WHERE lc.subject_id = s.id AND lc.status = 'completed') AS recordingCount
     FROM purchases pu
     JOIN subjects s ON s.id = pu.subject_id
     WHERE pu.user_id = ?
     ORDER BY pu.purchased_at DESC`,
    [req.user.id]
  );

  for (const subject of subjects) {
    const [papers] = await pool.query(
      "SELECT id, title FROM papers WHERE subject_id = ? AND status = 'published' ORDER BY title ASC",
      [subject.id]
    );
    subject.papers = papers;
  }

  res.json({ purchases: subjects });
});

module.exports = router;
