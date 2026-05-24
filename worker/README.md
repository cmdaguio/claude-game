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

## Maintenance

When YouTube updates the Android client and our `clientVersion` falls out of compatibility, the Worker starts returning 502s. Fix: open [Android YouTube on apkmirror.com](https://www.apkmirror.com/apk/google-inc/youtube/) to find the current version string, update the constant at the top of `src/index.js`, redeploy. Has happened ~once a year historically.

## Local dev

```bash
npx wrangler dev
# Worker available at http://localhost:8787
```

Point `WORKER_URL` in `src/audio.js` at `http://localhost:8787` while developing.
