import { parseYouTubeId, fetchYouTubeAudio } from './audio.js';
import { detectOnsets } from './beats.js';
import { assignLanes, GameLoop } from './game.js';

const screens = {
  idle: document.getElementById('screen-idle'),
  loading: document.getElementById('screen-loading'),
  ready: document.getElementById('screen-ready'),
  playing: document.getElementById('screen-playing'),
  ended: document.getElementById('screen-ended'),
  error: document.getElementById('screen-error'),
};

const el = {
  urlInput: document.getElementById('url-input'),
  startBtn: document.getElementById('start-btn'),
  urlError: document.getElementById('url-error'),
  loadingStatus: document.getElementById('loading-status'),
  readyText: document.getElementById('ready-text'),
  playBtn: document.getElementById('play-btn'),
  canvas: document.getElementById('game-canvas'),
  score: document.getElementById('score'),
  combo: document.getElementById('combo'),
  lives: document.getElementById('lives'),
  finalScore: document.getElementById('final-score'),
  replayBtn: document.getElementById('replay-btn'),
  newSongBtn: document.getElementById('new-song-btn'),
  errorText: document.getElementById('error-text'),
  retryBtn: document.getElementById('retry-btn'),
  newSongErrorBtn: document.getElementById('new-song-error-btn'),
};

let audioEl = null;
let schedule = null;
let game = null;
let lastVideoId = null;

function show(name) {
  for (const k of Object.keys(screens)) screens[k].hidden = (k !== name);
}

function setLives(n) {
  el.lives.textContent = '♥'.repeat(Math.max(0, n)) + '♡'.repeat(Math.max(0, 3 - n));
}

function setScore(score, combo) {
  el.score.textContent = String(score);
  el.combo.textContent = '×' + combo;
}

async function loadVideo(videoId) {
  lastVideoId = videoId;
  show('loading');
  el.loadingStatus.textContent = 'Starting…';
  try {
    const { audioBuffer, blobUrl, instance } = await fetchYouTubeAudio(videoId, msg => {
      el.loadingStatus.textContent = msg;
    });
    el.loadingStatus.textContent = 'Analyzing beats…';
    // yield to paint
    await new Promise(r => setTimeout(r, 16));
    const onsets = detectOnsets(audioBuffer);
    const lanes = assignLanes(onsets);
    schedule = onsets.map((time, i) => ({ time, lane: lanes[i] }));

    audioEl = new Audio(blobUrl);
    audioEl.preload = 'auto';

    if (schedule.length < 20) {
      el.readyText.textContent = `Only ${schedule.length} beats detected — the song may be too quiet or sparse. Tap to play anyway.`;
    } else {
      el.readyText.textContent = `Found ${schedule.length} beats from ${instance}. Tap to play.`;
    }
    show('ready');
  } catch (e) {
    el.errorText.textContent = e.message;
    show('error');
  }
}

el.startBtn.addEventListener('click', () => {
  const url = el.urlInput.value.trim();
  const id = parseYouTubeId(url);
  if (!id) {
    el.urlError.textContent = 'Please paste a valid YouTube URL.';
    el.urlError.hidden = false;
    return;
  }
  el.urlError.hidden = true;
  loadVideo(id);
});

el.playBtn.addEventListener('click', async () => {
  show('playing');
  setScore(0, 0);
  setLives(3);
  await audioEl.play();
  game = new GameLoop(el.canvas, schedule, audioEl, {
    onScore: setScore,
    onLifeLost: setLives,
    onEnd: ({ score, total }) => {
      audioEl.pause();
      el.finalScore.textContent = `${score} / ${total} (${total ? Math.round(score / total * 100) : 0}%)`;
      show('ended');
    },
  });
  game.start();
});

el.replayBtn.addEventListener('click', async () => {
  if (game) game.stop();
  audioEl.currentTime = 0;
  show('ready');
});

el.newSongBtn.addEventListener('click', () => {
  if (game) game.stop();
  if (audioEl) audioEl.pause();
  el.urlInput.value = '';
  show('idle');
});

el.retryBtn.addEventListener('click', () => {
  if (lastVideoId) loadVideo(lastVideoId);
});

el.newSongErrorBtn.addEventListener('click', () => {
  el.urlInput.value = '';
  show('idle');
});

show('idle');
