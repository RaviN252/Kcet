# Database schema

Database: **MySQL** (`mysql2/promise` driver, see `Server/config/db.js`).
Source of truth for creating tables: `Server/db/schema.sql`. This document describes what's
currently live in the `kcet_app` database.

## Entity relationship overview

```
users ──< password_resets
subjects ──< folders ──< folders (self, nested)
subjects ──< papers ──< paper_pages
folders ──< papers (optional — NULL folder_id = directly under subject)
users ──< payments >── subjects
users ──< purchases >── subjects
payments ──< purchases
subjects ──< live_classes
```

- **Subjects are the sellable unit.** A student buys a subject once and unlocks every paper
  filed under it — present and future. Papers have no price of their own.
- A **user** can have many password reset tokens, payments, and purchases.
- A **subject** can have many papers, payments, and purchases.
- A **purchase** links one user, one subject, and the payment that unlocked it.

---

## users

Registered accounts (students and admins).

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | INT AUTO_INCREMENT | NO | PK | — | |
| name | VARCHAR(150) | NO | | — | |
| phone | VARCHAR(20) | NO | UNIQUE | — | |
| email | VARCHAR(150) | NO | UNIQUE | — | login identifier |
| user_id | VARCHAR(50) | NO | UNIQUE | — | internal-only id, auto-generated at signup (random hex); not user-facing |
| password_hash | VARCHAR(255) | NO | | — | bcrypt hash |
| role | ENUM('user','admin') | NO | | 'user' | |
| created_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | auto-updates on row change |

Used by: `routes/auth.js` (signup/login/me/forgot-password/reset-password), `routes/admin/users.js`.

---

## password_resets

One-time tokens issued for the forgot-password flow.

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | INT AUTO_INCREMENT | NO | PK | — | |
| user_id | INT | NO | FK → users.id (CASCADE) | — | |
| token | VARCHAR(255) | NO | | — | random hex, emailed as a link |
| expires_at | TIMESTAMP | NO | | — | 5 minutes after creation |
| used | TINYINT(1) | NO | | 0 | set to 1 once consumed |
| created_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | |

Used by: `routes/auth.js` (`/forgot-password`, `/reset-password`), `services/email.js`
(`sendPasswordResetEmail`).

---

## subjects

The sellable unit. A student buys a subject, not an individual paper.

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | INT AUTO_INCREMENT | NO | PK | — | |
| name | VARCHAR(100) | NO | UNIQUE | — | e.g. "Maths" |
| price | DECIMAL(10,2) | NO | | 0.00 | 0 = free for every logged-in user |
| created_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | auto-updates on row change |

Used by: `routes/subjects.js` (public), `routes/admin/subjects.js`, `routes/viewer.js` (access
check), `routes/payments.js`, `routes/admin/payments.js`.

A subject cannot be deleted while it still has papers, or while it has any unresolved
(`status = 'created'`) payment — e.g. a pending UPI claim awaiting approval. Once deleted, its
past successful/failed payments survive (see `payments.subject_id`/`subject_name_snapshot`
below); `purchases` rows do cascade-delete, since access to an already-deleted subject's
(necessarily already-empty) content is moot.

---

## folders

Organizes papers within a subject, to any nesting depth (a folder can contain other folders).
Purely for browsing/organization — purchase access is still governed at the subject level
regardless of which folder a paper sits in.

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | INT AUTO_INCREMENT | NO | PK | — | |
| subject_id | INT | NO | FK → subjects.id (CASCADE) | — | every folder belongs to one subject, even when nested |
| parent_folder_id | INT | YES | FK → folders.id (CASCADE), self-referential | NULL | NULL = top-level folder directly under the subject |
| name | VARCHAR(150) | NO | | — | |
| created_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | auto-updates on row change |

Used by: `routes/subjects.js` (public tree), `routes/admin/folders.js`.

A folder cannot be deleted while it has direct papers or child folders — must be emptied first,
one level at a time.

---

## papers

Question papers (PDFs). A paper has no price of its own — it belongs to a subject, and the
subject's price/purchase governs access. `folder_id` places it in the tree; NULL means it sits
directly under the subject with no folder.

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | INT AUTO_INCREMENT | NO | PK | — | |
| title | VARCHAR(255) | NO | | — | |
| subject_id | INT | NO | FK → subjects.id, INDEX | — | source of truth for purchase/access, independent of folder nesting |
| folder_id | INT | YES | FK → folders.id (CASCADE), INDEX | NULL | NULL = directly under the subject, no folder |
| class | VARCHAR(50) | YES | INDEX (idx_class) | NULL | e.g. grade/standard |
| year | INT | YES | INDEX (idx_year) | NULL | exam year |
| pdf_path | VARCHAR(500) | YES | | NULL | source PDF on disk |
| status | ENUM('draft','published') | NO | | 'published' | |
| created_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | auto-updates on row change |

Used by: `routes/subjects.js`, `routes/admin/papers.js`, `routes/viewer.js`.

---

## paper_pages

Rendered page images for the watermarked, view-only PDF viewer.

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | INT AUTO_INCREMENT | NO | PK | — | |
| paper_id | INT | NO | FK → papers.id (CASCADE) | — | |
| page_number | INT | NO | | — | |
| image_path | VARCHAR(500) | NO | | — | rendered page image on disk |

Unique constraint: `(paper_id, page_number)`.

Used by: `routes/viewer.js`, `services/pdfConvert.js`, `services/watermark.js`.

---

## payments

Payment attempts against a subject — online (Cashfree, currently dormant pending whitelisting),
UPI (student-submitted claim awaiting admin approval), manual (admin-recorded offline payment),
or free (price-0 subject, auto-granted with no money involved).

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | INT AUTO_INCREMENT | NO | PK | — | |
| user_id | INT | NO | FK → users.id (CASCADE) | — | |
| subject_id | INT | YES | FK → subjects.id (SET NULL) | NULL | NULL means the subject was later deleted — the payment record itself survives |
| subject_name_snapshot | VARCHAR(100) | YES | | NULL | subject's name captured at payment time, so the record stays readable after the subject is gone |
| payment_method | ENUM('online','manual','free','upi') | NO | | 'online' | see above |
| gateway_order_id | VARCHAR(100) | YES | | NULL | Cashfree order id |
| gateway_payment_id | VARCHAR(100) | YES | | NULL | Cashfree payment id; for 'upi' rows, NULL means "opened the payment screen, no UTR yet" (an intent), set means a submitted claim awaiting admin |
| amount | DECIMAL(10,2) | NO | | — | actual amount (admin can record a discount) |
| status | ENUM('created','success','failed','cancelled') | NO | | 'created' | a 'upi' row stays 'created' until admin approves (→'success') or rejects (→'failed') |
| reminder_sent_at | TIMESTAMP | YES | | NULL | set once a "did you forget to pay?" email has been sent for a stale UPI intent (30+ min, no UTR) |
| created_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | auto-updates on row change |

Used by: `routes/payments.js`, `routes/admin/payments.js`, `services/cashfree.js`,
`services/paymentReminders.js` (10-minute interval job, see `index.js`),
`services/email.js` (`sendPaymentSuccessEmail`, `sendPaymentFailureEmail`,
`sendAdminPaymentClaimEmail`, `sendPaymentReminderEmail`).

---

## purchases

Records of unlocked access to a subject (and therefore every paper under it), created after a
successful payment.

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | INT AUTO_INCREMENT | NO | PK | — | |
| user_id | INT | NO | FK → users.id (CASCADE) | — | |
| subject_id | INT | NO | FK → subjects.id (CASCADE) | — | |
| payment_id | INT | NO | FK → payments.id (CASCADE) | — | |
| purchased_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | |

Unique constraint: `(user_id, subject_id)` — a user can only unlock a given subject once.

Used by: `routes/purchases.js`, `routes/viewer.js` (access check), `routes/admin/payments.js`,
`routes/admin/subjects.js` (deletion guard).

---

## live_classes

Live classes, streamed and recorded entirely on YouTube — no video is stored on this server. The
admin goes live on the channel as **Unlisted**, pastes the link into the admin panel and starts the
class; students who own the subject (or any logged-in user, for a free subject) watch it embedded
on the subject page. "End class" flips the row to `completed`: YouTube keeps the stream's recording
under the same video id, so it shows up under "Recorded classes" with no extra step.

| Column | Type | Null | Key | Default | Notes |
|---|---|---|---|---|---|
| id | INT AUTO_INCREMENT | NO | PK | — | |
| subject_id | INT | NO | FK → subjects.id (CASCADE), INDEX | — | the YouTube video itself is untouched if the subject is deleted |
| title | VARCHAR(255) | NO | | — | e.g. "Maths – Integration, part 2" |
| youtube_video_id | VARCHAR(20) | NO | | — | 11-char id parsed from whatever link was pasted; only ever sent to users with access |
| youtube_managed | TINYINT(1) | NO | | 0 | 1 = broadcast was created by the server through the YouTube API (automatic mode), so "End class" also ends it on YouTube; 0 = link pasted by the admin |
| status | ENUM('live','completed') | NO | INDEX | 'live' | at most one 'live' row per subject |
| started_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | |
| ended_at | TIMESTAMP | YES | | NULL | set by "End class" |
| created_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | |
| updated_at | TIMESTAMP | YES | | CURRENT_TIMESTAMP | auto-updates on row change |

Automatic mode (optional, `services/youtube.js`): when `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` /
`YOUTUBE_REFRESH_TOKEN` are set, "Start class" without a link creates the unlisted broadcast itself,
bound to one reusable stream whose fixed key goes into OBS once.

Used by: `routes/classes.js` (student view, access-checked), `routes/admin/classes.js`,
`routes/purchases.js` (live/recording counts on My Purchases).
