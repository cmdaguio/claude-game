export function parseYouTubeId(url) {
  if (typeof url !== "string" || !url) return null;
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export const WORKER_URL = "https://claude-game-yt.smithcabase9.workers.dev";

export async function fetchYouTubeAudio(videoId, onStatus = () => {}) {
  if (WORKER_URL.includes("YOUR-SUBDOMAIN")) {
    throw new Error(
      "WORKER_URL is not configured. Deploy the audio Worker (see worker/README.md), then set WORKER_URL in src/audio.js.",
    );
  }

  const host = new URL(WORKER_URL).host;
  onStatus(`Fetching audio from ${host}…`);
  const res = await fetch(
    `${WORKER_URL}/audio?id=${encodeURIComponent(videoId)}`,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Worker returned ${res.status}: ${detail.slice(0, 200) || res.statusText}`,
    );
  }

  onStatus("Downloading audio…");
  const bytes = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "audio/mp4";

  onStatus("Decoding audio…");
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const audioBuffer = await ctx.decodeAudioData(bytes.slice(0));
  ctx.close();

  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  return { audioBuffer, blobUrl, instance: host };
}
