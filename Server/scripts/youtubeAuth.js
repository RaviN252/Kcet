// Usage: node scripts/youtubeAuth.js
// One-time setup for automatic YouTube Live mode: opens Google sign-in for the
// account that owns the YouTube channel and prints the YOUTUBE_REFRESH_TOKEN to
// put in .env. No password is ever stored — only this revocable token.
// Needs YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET from a "Desktop app" OAuth client.
require('dotenv').config();
const http = require('http');
const { SCOPES } = require('../services/youtube');

const PORT = 5555;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

async function main() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env first.');
    process.exit(1);
  }

  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent', // always return a refresh token, even on re-runs
    });

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== '/oauth2callback') return res.end();
      const error = url.searchParams.get('error');
      res.end(error ? `Sign-in failed: ${error}` : 'Done — you can close this tab and go back to the terminal.');
      server.close();
      if (error) reject(new Error(error));
      else resolve(url.searchParams.get('code'));
    });
    server.listen(PORT, () => {
      console.log('Open this URL and sign in with the account that owns the YouTube channel:\n');
      console.log(authUrl, '\n');
    });
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await res.json();
  if (!res.ok) throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
  if (!tokens.refresh_token) {
    console.error(
      'Google did not return a refresh token. Remove the app at https://myaccount.google.com/permissions and run this again.'
    );
    process.exit(1);
  }

  console.log('Add this to Server/.env, then restart the server:\n');
  console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
