-- Run once against an existing database (after 2026-10-13_live_classes.sql):
-- mysql -u <user> -p kcet_app < db/migrations/2026-10-16_live_classes_youtube_managed.sql

-- 1 = broadcast created by the server through the YouTube API (automatic mode).
ALTER TABLE live_classes
  ADD COLUMN youtube_managed TINYINT(1) NOT NULL DEFAULT 0 AFTER youtube_video_id;
