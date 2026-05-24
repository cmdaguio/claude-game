const INNERTUBE_API_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const ANDROID_CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '19.09.37',
  androidSdkVersion: 30,
  hl: 'en',
  gl: 'US',
  userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

function cors(body, init = {}) {
  return new Response(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers || {}) },
  });
}

async function getAudioFormat(videoId) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_CLIENT.userAgent,
      },
      body: JSON.stringify({
        context: { client: ANDROID_CLIENT },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    }
  );
  if (!res.ok) throw new Error(`InnerTube HTTP ${res.status}`);
  const data = await res.json();
  const status = data.playabilityStatus?.status;
  if (status && status !== 'OK') {
    throw new Error(`Not playable: ${data.playabilityStatus.reason || status}`);
  }
  const formats = data.streamingData?.adaptiveFormats || [];
  const audio = formats
    .filter(f => typeof f.url === 'string' && (f.mimeType || '').startsWith('audio/'))
    .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
  if (!audio.length) throw new Error('No audio-only formats with direct URL');
  return audio[0];
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return cors(null, { status: 204 });

    const url = new URL(request.url);
    if (url.pathname !== '/audio') return cors('Not found', { status: 404 });

    const videoId = url.searchParams.get('id');
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return cors('Invalid id', { status: 400 });
    }

    try {
      const fmt = await getAudioFormat(videoId);
      const range = request.headers.get('Range');
      const upstream = await fetch(fmt.url, {
        headers: range ? { Range: range } : {},
      });
      if (!upstream.ok && upstream.status !== 206) {
        return cors(`Upstream ${upstream.status}`, { status: 502 });
      }
      const headers = { ...CORS_HEADERS };
      for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const v = upstream.headers.get(h);
        if (v) headers[h] = v;
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (e) {
      return cors(`Error: ${e.message}`, { status: 500 });
    }
  },
};
