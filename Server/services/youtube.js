// YouTube Live, driven from the admin panel. Runs as the channel's Google account
// via a refresh token minted once with scripts/youtubeAuth.js. The channel has one
// reusable stream (fixed OBS stream key); each class is a new unlisted broadcast
// bound to it, and YouTube keeps the recording under the broadcast's video id.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const SCOPES = ['https://www.googleapis.com/auth/youtube'];
// The reusable stream OBS sends to — found by this title, created if missing.
const STREAM_TITLE = 'KCET classes (OBS)';

function isConfigured() {
  return Boolean(
    process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN
  );
}

let cachedToken = null; // { accessToken, expiresAt }

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60 * 1000) return cachedToken.accessToken;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    // invalid_grant = token revoked/expired: re-run scripts/youtubeAuth.js.
    throw new Error(`YouTube sign-in failed (${data.error || res.status}) — re-run scripts/youtubeAuth.js`);
  }
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

async function request(method, path, params, body) {
  const url = `${API_BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    const reason = data.error?.errors?.[0]?.reason;
    const err = new Error(data.error?.message || `YouTube API error ${res.status}`);
    err.status = res.status;
    err.reason = reason;
    throw err;
  }
  return data;
}

let cachedStream = null;

// The channel's reusable stream — what OBS's stream key points at.
async function ensureStream() {
  if (cachedStream) return cachedStream;

  const { items = [] } = await request('GET', '/liveStreams', {
    part: 'id,snippet,cdn,status',
    mine: 'true',
    maxResults: '50',
  });
  let stream = items.find((s) => s.snippet?.title === STREAM_TITLE);
  if (!stream) {
    stream = await request(
      'POST',
      '/liveStreams',
      { part: 'id,snippet,cdn,contentDetails,status' },
      {
        snippet: { title: STREAM_TITLE },
        cdn: { ingestionType: 'rtmp', resolution: 'variable', frameRate: 'variable' },
        contentDetails: { isReusable: true },
      }
    );
  }
  cachedStream = stream;
  return stream;
}

// OBS settings for the admin page, plus whether OBS is currently sending video.
async function getStreamSetup() {
  const stream = await ensureStream();
  const { items = [] } = await request('GET', '/liveStreams', { part: 'status', id: stream.id });
  return {
    serverUrl: stream.cdn.ingestionInfo.ingestionAddress,
    streamKey: stream.cdn.ingestionInfo.streamName,
    streamStatus: items[0]?.status?.streamStatus || 'unknown', // 'active' = OBS is sending
  };
}

// Creates an unlisted, embeddable, recorded broadcast and binds it to the
// channel's stream. With auto-start it goes live as soon as OBS is streaming.
async function createBroadcast(title) {
  const stream = await ensureStream();
  const broadcast = await request(
    'POST',
    '/liveBroadcasts',
    { part: 'id,snippet,status,contentDetails' },
    {
      snippet: { title: title.replace(/[<>]/g, '').slice(0, 100), scheduledStartTime: new Date().toISOString() },
      status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
      contentDetails: {
        enableAutoStart: true,
        enableAutoStop: false, // ended from the admin panel, so a dropped OBS connection doesn't end the class
        enableDvr: true,
        enableEmbed: true,
        recordFromStart: true,
        latencyPreference: 'normal',
      },
    }
  );
  await request('POST', '/liveBroadcasts/bind', {
    id: broadcast.id,
    part: 'id,contentDetails',
    streamId: stream.id,
  });
  return { videoId: broadcast.id, privacyStatus: broadcast.status?.privacyStatus };
}

// Ends a broadcast. Returns false if it never actually went live (nothing was
// recorded) — in that case the empty broadcast is deleted from the channel.
async function endBroadcast(videoId) {
  const { items = [] } = await request('GET', '/liveBroadcasts', { part: 'status', id: videoId });
  const lifeCycle = items[0]?.status?.lifeCycleStatus;
  if (!lifeCycle || lifeCycle === 'complete' || lifeCycle === 'revoked') return true;

  if (lifeCycle === 'live' || lifeCycle === 'liveStarting') {
    await request('POST', '/liveBroadcasts/transition', {
      broadcastStatus: 'complete',
      id: videoId,
      part: 'status',
    });
    return true;
  }

  // created / ready / testing: OBS never went live on this broadcast.
  await request('DELETE', '/liveBroadcasts', { id: videoId });
  return false;
}

module.exports = { SCOPES, isConfigured, getStreamSetup, createBroadcast, endBroadcast };
