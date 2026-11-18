# Live Classes via YouTube Live

Live classes are streamed and recorded **entirely on YouTube**. This server never stores or relays
video. It only keeps a row per class (`live_classes` table) holding the YouTube video id, and it
gives that id only to users who are allowed to watch.

```
 Admin (OBS / YouTube Studio) ──RTMP──▶ YouTube  ◀──embed iframe── Student browser
            │                              ▲                            │
            │ "Start class" / "End class"  │ (automatic mode only)      │ GET /api/classes/:subjectId
            ▼                              │                            ▼
   /api/admin/classes ──────────▶ services/youtube.js          routes/classes.js (access check)
            │                                                           │
            └───────────────────▶  MySQL: live_classes  ◀───────────────┘
```

---

## 1. Two modes

| | **Manual mode** (default) | **Automatic mode** |
|---|---|---|
| Enabled when | `YOUTUBE_*` env vars are **not** set | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` are all set |
| Who creates the YouTube stream | Admin, by hand in YouTube Studio | The server, via the YouTube Data API |
| What the admin pastes | The live link | Nothing (link field is optional) |
| "End class" on the site | Only marks it completed here. Admin must also stop it in YouTube Studio / OBS | Also ends the broadcast on YouTube. Admin then stops OBS |
| `youtube_managed` column | `0` | `1` |

Currently `Server/.env` has no `YOUTUBE_*` entries, so the site runs in **manual mode**.

---

## 2. Admin flow

Admin page: **`/admin/live-classes`** (linked from the Admin Dashboard as "Live Classes").
Source: `Clinet/src/pages/admin/AdminLiveClassesPage.jsx`.

### Manual mode
1. In YouTube Studio, go live with visibility set to **Unlisted**.
2. Copy the stream link. Any of these forms work (parsed by `parseYoutubeVideoId` in
   `Server/routes/admin/classes.js`):
   - `https://youtube.com/live/VIDEO_ID`
   - `https://www.youtube.com/watch?v=VIDEO_ID`
   - `https://youtu.be/VIDEO_ID`
   - `https://studio.youtube.com/video/VIDEO_ID/livestreaming`
   - `/embed/VIDEO_ID`, `/shorts/VIDEO_ID`, or the bare 11-character id
3. On `/admin/live-classes`, choose the subject, paste the link, optionally add a title, then click **Start class**.
4. When finished, click **End class** on the site **and** end the stream in YouTube Studio / OBS.

### Automatic mode
1. One-time setup: put the **Server** and **Stream key** shown in the "OBS setup" card into
   OBS → Settings → Stream (Service: *Custom*). Every class uses the same key.
2. Choose the subject and click **Start class**, leaving the link empty. The server creates an unlisted broadcast.
3. Start streaming in OBS. The broadcast goes live on its own (`enableAutoStart`).
   The **Check OBS** button shows whether OBS is currently sending video.
4. Click **End class**. The server ends the broadcast on YouTube. Then stop streaming in OBS.

### Other admin actions (recorded classes)
- **Rename**: changes the title on the site only.
- **Remove**: deletes the row from the site. **The video stays on YouTube.**

### Rules
- A subject can have **at most one live class at a time**. Starting a second one returns `409`.
- If no title is given, the default is `"<Subject> – Class on <date>"` (Asia/Kolkata date).

---

## 3. Student flow

Source: `Clinet/src/components/SubjectClasses.jsx`. It renders on the subject page
(`PaperDetailPage.jsx`, top level of the subject, not inside folders) when the user can view the subject.

- Calls `GET /api/classes/:subjectId` once on load and then **every 30 seconds**, so a class
  started or ended by the admin shows up without a page refresh.
- **Live now**: shows a `● LIVE` badge and the embedded player.
- **Recorded classes**: a list of past classes. Click one to play it.
- The player is a `youtube-nocookie.com` embed with a **moving watermark** of the viewer's
  name and phone number on top. If someone screen-records the class, the watermark shows who it was.
- **My Purchases** (`routes/purchases.js`) also shows `liveNow` and `recordingCount` per subject.

### Who can watch
`userHasSubjectAccess` in `Server/routes/classes.js` uses the same rule as the paper viewer:
- admins: always
- free subjects (`price = 0`): any logged-in user
- otherwise: only users with a row in `purchases` for that subject

Without access the API returns `403`, and the video id is never sent to the browser.

---

## 4. Why recordings need no extra step

YouTube saves a finished live stream as a normal video **under the same video id**.
So "End class" only flips the row from `status = 'live'` to `'completed'` and sets `ended_at`.
The same embed URL then plays the recording.

Automatic-mode edge case: if **End class** is clicked before OBS ever went live, nothing was
recorded. The server deletes the empty broadcast from YouTube and deletes the row from the site.

---

## 5. Automatic mode internals (`Server/services/youtube.js`)

| Function | What it does |
|---|---|
| `isConfigured()` | Returns true only if all three `YOUTUBE_*` env vars are set |
| `accessToken()` | Exchanges the refresh token for an access token at `oauth2.googleapis.com/token`. Cached until 1 minute before expiry |
| `ensureStream()` | Finds the channel's reusable RTMP stream named **"KCET classes (OBS)"**, or creates it if missing. Cached in memory. This stream's key is what goes into OBS |
| `getStreamSetup()` | Returns `{ serverUrl, streamKey, streamStatus }` for the admin page (`streamStatus === 'active'` means OBS is sending) |
| `createBroadcast(title)` | `POST /liveBroadcasts` (unlisted, embeddable, DVR on, record from start, auto-start **on**, auto-stop **off**), then `POST /liveBroadcasts/bind` to the reusable stream. Returns the video id |
| `endBroadcast(videoId)` | Reads `lifeCycleStatus`. `live`/`liveStarting` → transition to `complete`. `complete`/`revoked`/missing → nothing to do. `created`/`ready`/`testing` → never went live, so delete it and return `false` |

Auto-stop is off on purpose: if OBS drops its connection for a moment, the class does not end.
It ends only when the admin clicks **End class**.

### Setting up automatic mode
1. In Google Cloud Console, enable **YouTube Data API v3** and create an OAuth client of type **Desktop app**.
2. Add the credentials to `Server/.env`:
   ```
   YOUTUBE_CLIENT_ID=...
   YOUTUBE_CLIENT_SECRET=...
   ```
3. Run `node scripts/youtubeAuth.js` from `Server/`. Open the printed URL and sign in with the
   **account that owns the YouTube channel**. The script listens on `http://localhost:5555/oauth2callback`
   and prints `YOUTUBE_REFRESH_TOKEN=...`.
4. Add that line to `Server/.env` and restart the server.
5. Open `/admin/live-classes`. The "OBS setup" card should now show the server URL and stream key.

No password is stored, only the revocable refresh token (scope: `https://www.googleapis.com/auth/youtube`).

---

## 6. API reference

### Admin (`requireAuth` + `requireAdmin`), mounted at `/api/admin/classes`

| Method & path | Body | Result |
|---|---|---|
| `GET /` | | `{ classes: [...] }`: all classes, live ones first |
| `GET /youtube` | | `{ configured: false }`, or `{ configured: true, serverUrl, streamKey, streamStatus }`, or `{ configured: true, error }`. Sent with `Cache-Control: no-store` |
| `POST /` | `{ subjectId, youtubeUrl?, title? }` | `201 { class, warning }`. `400` bad link / automatic mode not set up, `404` no subject, `409` already live |
| `POST /:id/end` | | `{ message }`. Ends the class (and the YouTube broadcast if managed) |
| `PUT /:id` | `{ title }` | Renames the class |
| `DELETE /:id` | | Removes the class from the site only |

### Student (`requireAuth`), mounted at `/api/classes`

| Method & path | Result |
|---|---|
| `GET /:subjectId` | `{ live, recordings, watermark }`, or `403` if the user hasn't bought the subject |

---

## 7. Database

Table `live_classes`. Full column list in [`../db/SCHEMA.md`](../db/SCHEMA.md#live_classes).
Run the migrations in order:
1. `Server/db/migrations/2026-10-13_live_classes.sql`
2. `Server/db/migrations/2026-10-16_live_classes_youtube_managed.sql`

Deleting a subject cascades to its `live_classes` rows. The YouTube videos are not touched.

---

## 8. Troubleshooting & known limits

| Symptom | Cause / fix |
|---|---|
| Warning: *"YouTube set this stream to 'private'"* | YouTube forces API-created videos to **private** for unverified (unaudited) Google Cloud projects. Change the video to Unlisted in YouTube Studio, or get the project audited |
| *"YouTube sign-in failed (invalid_grant)"* | The refresh token was revoked or expired. Re-run `scripts/youtubeAuth.js`. If the OAuth consent screen is still in **Testing**, Google expires refresh tokens after 7 days. Publish the app to stop this |
| *"Google did not return a refresh token"* | Remove the app at https://myaccount.google.com/permissions and run the script again |
| Student sees nothing on the subject page | The section is hidden when there are no live or recorded classes. Also check that the user has bought the subject |
| Class doesn't appear right away for students | The student page checks every 30 s |
| Player says "Video unavailable" | The video isn't Unlisted/Public, or embedding is disabled on it |

**Security note:** unlisted means "not searchable", not "private". Anyone who has the video id can
watch it on youtube.com, and a logged-in buyer can read the id from the iframe `src`. The access
check stops casual sharing, and the watermark makes leaked screen recordings traceable, but neither
stops a buyer from sharing the link. Keep the OBS **stream key** secret: anyone who has it can
stream to the channel.
