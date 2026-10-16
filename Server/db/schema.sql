-- Users (Section 1: Auth & Signup)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  user_id VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Password reset tokens (Section 1)
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subjects are the sellable unit: a student buys a subject once and unlocks
-- every paper filed under it, including ones added later.
CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Folders organize papers within a subject, to any nesting depth. Purely an
-- organizational/browsing aid — purchase access is still governed at the
-- subject level regardless of which folder a paper sits in.
CREATE TABLE IF NOT EXISTS folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  parent_folder_id INT NULL,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- Question papers (Sections 2 & 3). A paper has no price of its own — it
-- belongs to a subject, and the subject's price/purchase governs access.
-- folder_id is NULL for a paper sitting directly under the subject (no folder).
CREATE TABLE IF NOT EXISTS papers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subject_id INT NOT NULL,
  folder_id INT NULL,
  class VARCHAR(50),
  year INT,
  pdf_path VARCHAR(500),
  status ENUM('draft', 'published') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  INDEX idx_class (class),
  INDEX idx_subject_id (subject_id),
  INDEX idx_folder_id (folder_id),
  INDEX idx_year (year)
);

-- Rendered page images for the view-only viewer (Section 6)
CREATE TABLE IF NOT EXISTS paper_pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paper_id INT NOT NULL,
  page_number INT NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_paper_page (paper_id, page_number)
);

-- Payments (Section 5), against a subject rather than a single paper.
-- payment_method distinguishes an online Cashfree payment from one an admin
-- marked complete manually (e.g. an offline transfer) or a price-0 subject.
-- subject_id is nullable and set to NULL (not cascaded) if the subject is later
-- deleted, so the financial record survives — subject_name_snapshot keeps the
-- name readable even after that.
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subject_id INT NULL,
  subject_name_snapshot VARCHAR(100),
  payment_method ENUM('online', 'manual', 'free', 'upi') NOT NULL DEFAULT 'online',
  gateway_order_id VARCHAR(100),
  gateway_payment_id VARCHAR(100),
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('created', 'success', 'failed', 'cancelled') NOT NULL DEFAULT 'created',
  reminder_sent_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Unlocked access after successful payment (Sections 4, 5, 7). One row grants
-- access to every paper under that subject, present and future.
CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subject_id INT NOT NULL,
  payment_id INT NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_subject (user_id, subject_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

-- Live classes, streamed and recorded entirely on YouTube. The admin goes live
-- (unlisted) on YouTube and pastes the link here; buyers of the subject watch it
-- embedded on the subject page. Once ended, YouTube keeps the recording under the
-- same video id, so the row simply becomes a "recorded class".
CREATE TABLE IF NOT EXISTS live_classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  youtube_video_id VARCHAR(20) NOT NULL,
  youtube_managed TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('live', 'completed') NOT NULL DEFAULT 'live',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  INDEX idx_subject_status (subject_id, status)
);
