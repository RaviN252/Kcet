const express = require('express');
const pool = require('../../config/db');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const youtube = require('../../services/youtube');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Accepts whatever the admin copies out of YouTube / YouTube Studio:
// youtube.com/live/ID, youtube.com/watch?v=ID, youtu.be/ID,
// studio.youtube.com/video/ID/livestreaming, or the bare 11-char id.
function parseYoutubeVideoId(input) {
  const value = String(input || '').trim();
  if (VIDEO_ID.test(value)) return value;

  let url;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  let id = null;
  if (host === 'youtu.be') id = parts[0];
  else if (host === 'youtube.com' && url.searchParams.get('v')) id = url.searchParams.get('v');
  else if (host === 'youtube.com' && ['live', 'embed', 'shorts'].includes(parts[0])) id = parts[1];
  else if (host === 'studio.youtube.com' && parts[0] === 'video') id = parts[1];

  return id && VIDEO_ID.test(id) ? id : null;
}

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT lc.id, lc.subject_id AS subjectId, s.name AS subjectName, lc.title,
            lc.youtube_video_id AS youtubeVideoId, lc.youtube_managed AS youtubeManaged, lc.status,
            lc.started_at AS startedAt, lc.ended_at AS endedAt
     FROM live_classes lc JOIN subjects s ON s.id = lc.subject_id
     ORDER BY lc.status = 'live' DESC, lc.started_at DESC`
  );
  res.json({ classes: rows });
});

// OBS settings (server URL + fixed stream key) for automatic mode. The key lets
// anyone stream to the channel, so it's admin-only and never cached by the browser.
router.get('/youtube', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!youtube.isConfigured()) return res.json({ configured: false });
  try {
    res.json({ configured: true, ...(await youtube.getStreamSetup()) });
  } catch (err) {
    res.json({ configured: true, error: err.message });
  }
});

// "Start class". Automatic mode (no link given, YouTube API set up): creates an
// unlisted broadcast on the channel that goes live as soon as OBS streams.
// Manual mode: the admin already went live on YouTube and pastes the link.
router.post('/', async (req, res) => {
  try {
    const { subjectId, youtubeUrl, title } = req.body;
    const [[subject]] = await pool.query('SELECT id, name FROM subjects WHERE id = ?', [subjectId]);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const manual = Boolean(youtubeUrl && String(youtubeUrl).trim());
    const manualVideoId = manual ? parseYoutubeVideoId(youtubeUrl) : null;
    if (manual && !manualVideoId) {
      return res.status(400).json({ message: 'That does not look like a YouTube video or live link' });
    }
    if (!manual && !youtube.isConfigured()) {
      return res.status(400).json({ message: 'Paste the YouTube live link — automatic YouTube mode is not set up' });
    }

    const [[alreadyLive]] = await pool.query(
      "SELECT id FROM live_classes WHERE subject_id = ? AND status = 'live'",
      [subject.id]
    );
    if (alreadyLive) {
      return res.status(409).json({ message: `${subject.name} already has a live class — end it first` });
    }

    const classTitle =
      title && title.trim()
        ? title.trim().slice(0, 255)
        : `${subject.name} – Class on ${new Date().toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
          })}`;

    let videoId = manualVideoId;
    let warning = null;
    if (!manual) {
      const broadcast = await youtube.createBroadcast(classTitle);
      videoId = broadcast.videoId;
      if (broadcast.privacyStatus !== 'unlisted') {
        // YouTube forces API-created videos to private for unaudited Cloud projects.
        warning = `YouTube set this stream to "${broadcast.privacyStatus}", so students can't play it. Change it to Unlisted in YouTube Studio.`;
      }
    }

    const [result] = await pool.query(
      'INSERT INTO live_classes (subject_id, title, youtube_video_id, youtube_managed) VALUES (?, ?, ?, ?)',
      [subject.id, classTitle, videoId, manual ? 0 : 1]
    );
    res.status(201).json({ class: { id: result.insertId, title: classTitle, youtubeVideoId: videoId }, warning });
  } catch (err) {
    res.status(500).json({ message: 'Could not start class', error: err.message });
  }
});

// "End class": YouTube keeps the stream as a video under the same id, so the
// class moves straight into the subject's recorded classes. In automatic mode the
// broadcast is ended on YouTube too.
router.post('/:id/end', async (req, res) => {
  try {
    const [[liveClass]] = await pool.query(
      "SELECT id, youtube_video_id, youtube_managed FROM live_classes WHERE id = ? AND status = 'live'",
      [req.params.id]
    );
    if (!liveClass) return res.status(404).json({ message: 'No live class with that id' });

    if (liveClass.youtube_managed) {
      const recorded = await youtube.endBroadcast(liveClass.youtube_video_id);
      if (!recorded) {
        await pool.query('DELETE FROM live_classes WHERE id = ?', [liveClass.id]);
        return res.json({ message: 'The stream never went live, so there is no recording — class removed' });
      }
    }

    const [result] = await pool.query(
      "UPDATE live_classes SET status = 'completed', ended_at = NOW() WHERE id = ? AND status = 'live'",
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'No live class with that id' });
    res.json({ message: 'Class ended — it is now listed under recorded classes' });
  } catch (err) {
    res.status(500).json({ message: 'Could not end class', error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'Title is required' });
    const [result] = await pool.query('UPDATE live_classes SET title = ? WHERE id = ?', [
      title.trim().slice(0, 255),
      req.params.id,
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Class not found' });
    res.json({ message: 'Class updated' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update class', error: err.message });
  }
});

// Removes the class from the site only — the video stays on YouTube.
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM live_classes WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Class not found' });
    res.json({ message: 'Class removed from the site' });
  } catch (err) {
    res.status(500).json({ message: 'Could not remove class', error: err.message });
  }
});

module.exports = router;
