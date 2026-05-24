# Piano Tiles × YouTube

Paste a YouTube URL, get a Piano Tiles chart synced to the song's beats. Mobile-first, no backend, GitHub-Pages ready.

## How it works

1. Paste a YouTube URL
2. The app fetches the audio through a public Piped instance, decodes it, and runs an energy-based onset detector to find beats
3. Each beat becomes a tile in one of 4 lanes
4. Tap (or press **D / F / J / K**) when a tile crosses the blue hit line. 3 misses = game over.

## Run locally

Open `index.html` directly, or serve the directory:

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

- **Audio source is flaky.** Public Piped instances occasionally die or get blocked by YouTube. If loading fails, hit "Retry" or edit `PIPED_INSTANCES` in `src/audio.js` to point at a working instance ([list](https://github.com/TeamPiped/Piped/wiki/Instances)).
- **Beat detection is heuristic.** Acoustic tracks with soft onsets produce sparse tiles; dense electronic tracks may produce too many. The detector is tuned for typical pop/rock.
- **Mobile audio requires a tap.** Browsers block audio without a user gesture — the "Tap to play" button doubles as the audio unlock.

## Deploy to GitHub Pages

1. Push to `main`
2. Repo Settings → Pages → Source: `main` / root
3. Visit `https://<username>.github.io/<repo>/`
