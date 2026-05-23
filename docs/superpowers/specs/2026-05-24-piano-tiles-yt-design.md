# Piano Tiles × YouTube — Design

## Goal

A mobile-first, browser-based Piano Tiles clone where the user pastes a YouTube URL and tiles fall synced to the actual beats of that song. Hosted on GitHub Pages. No backend.

## Scope (MVP)

In:
- Single-page web app, mobile-first portrait layout
- 4 lanes, tap (or D/F/J/K) when a tile crosses the hit line
- Real beat-sync via pre-processed onset detection on the audio buffer
- YouTube audio fetched through a public Piped instance (with fallbacks)
- 3 lives lose condition, score and combo counters, end-of-song score screen

Out:
- Charts/leaderboards
- Account system
- Custom tile patterns or per-song hand-tuned charts
- Frequency-band-based lane assignment (random is fine for MVP)
- Adaptive difficulty / tempo control
- Long-press / hold tiles
- Native app

## Constraints

- **Static hosting only** (GitHub Pages). No server-side code.
- **YouTube ToS reality.** We do not download or persist the audio. We stream it through a public Piped instance, which is a moving target — instances die or get blocked. The UI must surface "audio source unavailable" gracefully and let the user swap to a fallback instance.
- **Mobile audio gesture.** Browsers will not start audio without a user gesture. The "Start" button doubles as the audio-context unlock.
- **No external bundler required.** Plain HTML + ES modules. `index.html` loads modules directly. This keeps GitHub Pages deployment trivial — push to `main`, done.

## Architecture

Single-page app. Four ES modules + one HTML + one CSS.

```
index.html        — markup, screens, canvas
src/main.js       — entry point, state machine, UI wiring
src/audio.js      — Piped fetch, audio decode, audio playback control
src/beats.js      — onset detection over an AudioBuffer
src/game.js       — game loop, tile state, canvas rendering, input
src/style.css     — styling
```

### State machine

```
idle ── paste URL ──> loading ── decode + analyze ──> ready ── tap start ──> playing ── lives=0 or song ends ──> ended ── replay ──> ready
                            └── error ──> error (with retry/instance-swap)
```

States are owned by `main.js`. Each state corresponds to a visible screen (hidden via CSS `[hidden]` attribute).

### Data flow

1. User pastes URL → `main.js` parses video ID
2. `main.js` → `audio.fetchYouTubeAudio(videoId)` → tries Piped instances in order, returns `AudioBuffer`
3. `main.js` → `beats.detectOnsets(audioBuffer)` → returns `number[]` of beat timestamps in seconds
4. `main.js` builds tile schedule: `{ time, lane }[]` with random lane assignment (no two consecutive same)
5. User taps Start → `audio.play()` starts an `<audio>` element OR `AudioBufferSourceNode`; `game.start(schedule)` kicks off the rAF loop
6. Game loop reads `audio.currentTime` each frame, computes each upcoming tile's Y position, draws to canvas, processes input

### Module responsibilities

**`audio.js`**
- `fetchYouTubeAudio(videoId)` — try each configured Piped instance; for each, GET `/streams/{videoId}`. From the `audioStreams` array, pick the lowest-bitrate audio-only stream (smaller = faster decode, MVP doesn't need quality). `fetch()` the audio URL (Piped exposes a CORS-enabled URL — typically the `url` field on proxy-enabled instances; if `audioStreams[i].url` fails CORS, retry with the instance's `/videoplayback?host=...` proxy pattern). Read response as ArrayBuffer **once**. Then:
  - `decodeAudioData(arrayBuffer.slice(0))` → `AudioBuffer` for beat detection
  - `URL.createObjectURL(new Blob([arrayBuffer], {type: 'audio/mp4'}))` → blob URL set as `<audio>` element's `src` for playback
- One network request, two consumers. No double download.
- `play()` / `pause()` / `currentTime` — thin wrapper over the `<audio>` element. Mobile-reliable, gives us frame-accurate-enough `currentTime`.
- Why both AudioBuffer + audio element? Decoded samples for offline beat detection; audio element for reliable mobile playback. Cheaper than tracking elapsed time manually off an `AudioBufferSourceNode` (which also has its own gotchas around `start(when, offset)` and pause/resume).

**`beats.js`**
- `detectOnsets(audioBuffer): number[]` — energy-based onset detection. Algorithm:
  1. Downmix to mono
  2. Frame the signal: 1024 samples per frame, 512 hop. At 44.1kHz this gives ~86 frames/sec.
  3. Per frame, compute short-time energy = sum of squared samples
  4. Compute spectral flux = max(0, energy[i] - energy[i-1])
  5. Smooth with a small moving average
  6. Adaptive threshold = local median over a 1-second window × 1.5
  7. Pick peaks above threshold
  8. Enforce a 180ms minimum gap between picked beats
- Returns timestamps in seconds. Targeting 1.5–3 beats/sec on typical pop songs.

**`game.js`**
- `start(schedule, audio, onGameOver)` — sets up canvas, listens for input, starts the rAF loop
- Frame:
  - `t = audio.currentTime`
  - Compute lead time: `tilesTravelSeconds = canvasHeight / fallSpeed` (px/sec). Tile spawned at `tile.time - tilesTravelSeconds`, reaches hit line at `tile.time`.
  - For each tile within `[t - 0.5, t + tilesTravelSeconds]` window, compute Y and draw
  - Tiles past the hit line by >150ms without a hit → counted as miss, life decremented
- Input: pointerdown / keydown maps to a lane. Check the nearest tile in that lane whose `time` is within ±150ms of `t`. Hit → mark consumed, +1 score, combo++. No tile in range → miss penalty: combo reset, optionally life decremented (decision: misses on empty input cost combo only, not lives — lives are for missed tiles, not bad taps; otherwise the game feels too cruel on mobile).
- Renders score, combo, lives overlay on canvas

**`main.js`**
- Reads URL input, validates YouTube URL, extracts video ID
- Orchestrates the state machine, shows/hides screens
- On error, shows the failed instance + "Try another instance" button
- Renders the lives/score/combo overlays via DOM (not canvas) to keep canvas simple

### File layout

```
index.html
src/
  main.js
  audio.js
  beats.js
  game.js
style.css
.gitignore
README.md
```

### UI screens (mobile portrait)

- **Idle:** App title, paste-URL input, Start button. Below: small "Source" dropdown for Piped instance (defaults to first).
- **Loading:** Spinner, status text: "Fetching audio…" → "Analyzing beats…"
- **Ready:** "Found N beats. Tap to start."
- **Playing:** Game canvas filling the viewport. Top bar: score (left), combo (center), lives (right, as 3 heart icons).
- **Ended:** "Score: X / Y (Z%)". "Play again" / "New song" buttons.
- **Error:** "Could not fetch audio from <instance>. Try another?" Dropdown + retry button.

### Game tuning defaults

- Fall speed: 600 px/sec (tunable constant)
- Hit tolerance: ±150 ms around the beat
- Tile height: 80 px
- Min beat gap: 180 ms
- Lives: 3
- Lane assignment: random with constraint `lane[i] !== lane[i-1]`

### Beat detection tuning

The onset detector has three knobs:
- `THRESHOLD_MULT` (default 1.5) — higher = fewer beats, lower = more
- `MIN_GAP_MS` (180) — minimum interval between picked beats
- `SMOOTHING_FRAMES` (3) — moving average size for the energy curve

We do not expose these in the UI for the MVP. Defaults chosen for typical 80–140 BPM pop/rock. If tuning becomes a real issue we'll add a "Density: low / med / high" toggle later.

### Error handling

- Invalid YouTube URL → inline message under input, do not advance state
- All Piped instances fail → error screen with instance dropdown and retry
- Decode fails → "This audio could not be decoded. Try a different song."
- Onset detector returns < 20 beats → warn "Audio is too quiet/sparse for good gameplay" but allow play

### Testing strategy

This is an MVP frontend game with no server. Tests focus on the deterministic, pure parts.

- **Unit (Vitest):**
  - `parseYouTubeId(url)` — handles youtu.be, youtube.com/watch?v=, youtube.com/shorts/, with junk query strings
  - `detectOnsets(buffer)` — feed a synthetic AudioBuffer with known click positions, assert returned timestamps within ±20ms
  - `assignLanes(beats)` — assert no two consecutive same lane, length matches input
  - `scoreTap(tiles, t, lane)` — given a fixture tile list and a tap event, returns the correct result (`{hit: true, tile}` or `{hit: false}`)
- **No end-to-end tests** — the game loop and Piped fetch are exercised by manually playing the deployed page. Mobile QA = open it on a phone, play a song.

### Deployment

- GitHub Pages from `main` branch, `/` as root
- `README.md` documents: how to play, known caveat about flaky audio source, how to swap instances
- No build step. Push and it deploys.

## Open questions

None remaining at MVP scope. Beat-detection tuning, frequency-band lane assignment, and adaptive difficulty are deferred.

## Risks

1. **Public Piped instances die or get blocked.** Mitigation: ship with 3 fallback instances in a config file; user can paste their own.
2. **Beat detection quality varies wildly by genre.** Acoustic tracks with soft onsets will spawn too few tiles. Mitigation: warn when <20 beats detected.
3. **Mobile audio latency.** `audio.currentTime` granularity on mobile is around 16–40ms, which is within our ±150ms hit window — should be fine.
4. **CORS surprises.** Piped instances claim to set CORS but specific googlevideo backends sometimes don't. Mitigation: only use the `proxyUrl` field from Piped's response, not raw `url`.
