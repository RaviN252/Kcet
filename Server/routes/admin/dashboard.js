const express = require('express');
const pool = require('../../config/db');
const { requireAuth, requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/', async (req, res) => {
  const [[revenueRow]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS totalRevenue FROM payments WHERE status = 'success'"
  );
  const [[paidUsersRow]] = await pool.query(
    "SELECT COUNT(DISTINCT user_id) AS paidUsers FROM payments WHERE status = 'success'"
  );
  // LEFT JOIN so a deleted subject's past sales still show up (grouped by the
  // saved name snapshot) instead of silently dropping out of the revenue history.
  const [topSubjects] = await pool.query(`
    SELECT s.id, COALESCE(s.name, p.subject_name_snapshot) AS subject,
           COUNT(*) AS salesCount, SUM(p.amount) AS revenue
    FROM payments p
    LEFT JOIN subjects s ON s.id = p.subject_id
    WHERE p.status = 'success'
    GROUP BY p.subject_id, p.subject_name_snapshot
    ORDER BY salesCount DESC
    LIMIT 10
  `);

  res.json({
    totalRevenue: revenueRow.totalRevenue,
    paidUsers: paidUsersRow.paidUsers,
    topSubjects,
  });
});

module.exports = router;
