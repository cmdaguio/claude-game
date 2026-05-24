# Piano Tiles × YouTube

Paste a YouTube URL, get a Piano Tiles chart synced to its beats.

## Run locally
Open `index.html` in a browser. Or use any static server:
```
python3 -m http.server 8000
```

## Tests
```
npm install
npm test
```

## Known caveats
Audio is fetched from a public Piped instance. These instances occasionally die or get blocked. The error screen lets you retry; you can also edit the `PIPED_INSTANCES` array in `src/audio.js`.
