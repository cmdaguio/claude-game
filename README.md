# Piano Tiles × YouTube

Paste a YouTube URL, get a Piano Tiles chart synced to the song's beats. Mobile-first, GitHub Pages frontend + Cloudflare Worker audio proxy.

## How it works

1. Paste a YouTube URL
2. A small Cloudflare Worker you deploy fetches the audio from YouTube and pipes it back with CORS
3. The browser decodes the audio, runs an energy-based onset detector to find beats
4. Each beat becomes a tile in one of 4 lanes
5. Tap (or press **D / F / J / K**) when a tile crosses the blue hit line. 3 misses = game over.

## First-time setup

The frontend can't talk to YouTube directly (CORS), so you need to deploy a tiny Cloudflare Worker once. Full instructions in [`worker/README.md`](worker/README.md). Quick version:

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

Wrangler prints a URL like `https://claude-game-yt.<your-subdomain>.workers.dev`. Open `src/audio.js` and replace the `WORKER_URL` placeholder with your URL. Commit.

## Run the frontend locally

Open `index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Tests

```bash
npm install
npm test
```

## Known caveats

- **Beat detection is heuristic.** Acoustic tracks with soft onsets produce sparse tiles; dense electronic tracks may produce too many. The detector is tuned for typical pop/rock.
- **Mobile audio requires a tap.** Browsers block audio without a user gesture — the "Tap to play" button doubles as the audio unlock.
- **YouTube can change its internal API.** When this happens, the Worker starts returning 502s and you bump `clientVersion` in `worker/src/index.js`. Historically once a year.

## Deploy the frontend to GitHub Pages

1. Push to `main`
2. Repo Settings → Pages → Source: `main` / root
3. Visit `https://<username>.github.io/<repo>/`
