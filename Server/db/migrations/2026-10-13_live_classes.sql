-- Run once against an existing database: mysql -u <user> -p kcet_app < db/migrations/2026-10-13_live_classes.sql

-- Live classes, streamed and recorded entirely on YouTube. The admin goes live
-- (unlisted) on YouTube and pastes the link here; buyers of the subject watch it
-- embedded on the subject page. Once ended, YouTube keeps the recording under the
-- same video id, so the row simply becomes a "recorded class".
CREATE TABLE IF NOT EXISTS live_classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  youtube_video_id VARCHAR(20) NOT NULL,
  status ENUM('live', 'completed') NOT NULL DEFAULT 'live',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  INDEX idx_subject_status (subject_id, status)
);
