export function parseYouTubeId(url) {
  if (typeof url !== 'string' || !url) return null;
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

export const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.leptons.xyz',
];

export async function fetchYouTubeAudio(videoId, onStatus = () => {}) {
  const errors = [];
  for (const instance of PIPED_INSTANCES) {
    const host = new URL(instance).host;
    try {
      onStatus(`Fetching stream info from ${host}…`);
      const res = await fetch(`${instance}/streams/${videoId}`);
      if (!res.ok) throw new Error(`streams API ${res.status}`);
      const data = await res.json();
      const streams = (data.audioStreams || []).filter(s => (s.mimeType || '').startsWith('audio'));
      if (!streams.length) throw new Error('no audio streams');
      streams.sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
      const stream = streams[0];

      onStatus(`Downloading audio…`);
      const audioRes = await fetch(stream.url);
      if (!audioRes.ok) throw new Error(`audio fetch ${audioRes.status}`);
      const bytes = await audioRes.arrayBuffer();

      onStatus('Decoding audio…');
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const audioBuffer = await ctx.decodeAudioData(bytes.slice(0));
      ctx.close();

      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: stream.mimeType }));
      return { audioBuffer, blobUrl, instance: host };
    } catch (e) {
      errors.push(`${host}: ${e.message}`);
      console.warn(`Piped instance ${host} failed:`, e);
    }
  }
  throw new Error(`All Piped instances failed:\n${errors.join('\n')}`);
}
