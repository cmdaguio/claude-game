# Audio Worker

Cloudflare Worker that fetches a YouTube video's audio stream and exposes it with CORS so the static frontend on GitHub Pages can decode and play it.

## One-time deploy

```bash
cd worker
npm install
npx wrangler login    # opens browser, sign in to Cloudflare
npx wrangler deploy
```

Output ends with a URL like `https://claude-game-yt.<your-subdomain>.workers.dev`.

Then in `../src/audio.js`, replace the placeholder:

```js
export const WORKER_URL = 'https://claude-game-yt.YOUR-SUBDOMAIN.workers.dev';
```

with your actual URL, commit, and push. GitHub Pages picks it up on deploy.

## Endpoint

`GET /audio?id=<11-char YouTube video id>`

- **200** — audio bytes, with `Content-Type` from upstream and `Access-Control-Allow-Origin: *`
- **400** — id missing or malformed
- **404** — wrong path
- **500** — extraction error (Worker-side)
- **502** — YouTube returned non-OK upstream

`Range` headers are forwarded — the browser can request byte ranges and the upstream supports it.

## How it works

YouTube's InnerTube API has multiple client contexts. The **ANDROID** client receives audio URLs that are already signed and playable without the JS-based signature deciphering that the web client requires. Cloudflare Workers don't allow `eval` / `new Function()`, so any library that decodes signatures (like `youtubei.js`) won't run here. Calling `youtubei/v1/player` directly with the ANDROID context sidesteps the whole problem.

We pick the **lowest-bitrate audio-only** format (typically Opus or AAC, ~50–60 kbps). Lower bitrate means faster decode in the browser and smaller transfer — beat detection doesn't need quality.

## Capacity

Cloudflare Workers Free: **100,000 requests/day**. One song = 2 requests (InnerTube call + audio fetch). ≈ 50,000 songs/day. Personal use is nowhere near this.

## YouTube cookie (recommended)

Anonymous extraction works for some videos but YouTube's PoToken rollout blocks many popular/restricted ones. Pasting your own YouTube session cookie into the Worker as a secret lets the WEB client extract anything you can normally play in a browser.

### Get your cookie

1. Open https://www.youtube.com in a browser **where you are logged in**
2. Open DevTools → **Network** tab
3. Click any video, then in the Network panel click any request to `www.youtube.com`
4. In the right pane scroll to **Request Headers** → find `Cookie:` → **copy the entire value** (one long string with many `name=value;` pairs)

### Store it as a Worker secret

```bash
cd worker
npx wrangler secret put YT_COOKIE
# wrangler prompts: paste the cookie string, press enter
```

Redeploy: `npx wrangler deploy`. Verify with:

```bash
curl https://<your-worker-url>/health
# {"ok":true,"cookieConfigured":true,"clients":["WEB","ANDROID_VR","TV_EMBEDDED","ANDROID_TESTSUITE"]}
```

### Caveats

- Every video the Worker fetches is **logged to your YouTube watch history / "recently watched"** because requests are authenticated as you. Use a throwaway Google account if that bothers you.
- Cookies last roughly 1–2 years but session tokens rotate sooner. When you start seeing 401s from the WEB client, re-run `wrangler secret put YT_COOKIE` with a fresh cookie.
- Never paste the cookie into the frontend code or anywhere it ends up in git. Worker secrets are encrypted at rest by Cloudflare.

## Maintenance

When YouTube updates client requirements and our `clientVersion` falls out of compatibility, the Worker starts returning 502s. Open [apkmirror.com YouTube](https://www.apkmirror.com/apk/google-inc/youtube/) for the latest Android version string, or check yt-dlp's `youtube.py` source for the currently-working client configs, update the constants at the top of `src/index.js`, redeploy. Happens roughly once a year.

## Local dev

```bash
npx wrangler dev
# Worker available at http://localhost:8787
```

Point `WORKER_URL` in `src/audio.js` at `http://localhost:8787` while developing.
