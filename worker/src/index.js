// InnerTube client contexts. YouTube rotates which clients work; we try in
// priority order. IOS has been most reliable for audio extraction in 2025;
// ANDROID_TESTSUITE is a useful fallback; plain ANDROID often fails now.
const CLIENTS = [
  {
    label: 'IOS',
    apiKey: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
    userAgent:
      'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '19.45.4',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '17.5.1.21F90',
        hl: 'en',
        gl: 'US',
        utcOffsetMinutes: 0,
      },
    },
  },
  {
    label: 'ANDROID_TESTSUITE',
    apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    userAgent:
      'com.google.android.youtube/1.9 (Linux; U; Android 14) gzip',
    context: {
      client: {
        clientName: 'ANDROID_TESTSUITE',
        clientVersion: '1.9',
        androidSdkVersion: 34,
        hl: 'en',
        gl: 'US',
      },
    },
  },
  {
    label: 'ANDROID',
    apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    userAgent:
      'com.google.android.youtube/19.50.42 (Linux; U; Android 14) gzip',
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '19.50.42',
        androidSdkVersion: 34,
        hl: 'en',
        gl: 'US',
      },
    },
  },
];

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

async function fetchPlayer(videoId, client) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${client.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': client.userAgent,
        'X-YouTube-Client-Name': client.context.client.clientName,
        'X-YouTube-Client-Version': client.context.client.clientVersion,
        Origin: 'https://www.youtube.com',
      },
      body: JSON.stringify({
        context: client.context,
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    }
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `${client.label} HTTP ${res.status}: ${text.slice(0, 300)}`
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${client.label} non-JSON response: ${text.slice(0, 200)}`);
  }
  const status = data.playabilityStatus?.status;
  if (status && status !== 'OK') {
    throw new Error(
      `${client.label} not playable: ${data.playabilityStatus.reason || status}`
    );
  }
  const formats = data.streamingData?.adaptiveFormats || [];
  const audio = formats
    .filter(
      f => typeof f.url === 'string' && (f.mimeType || '').startsWith('audio/')
    )
    .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
  if (!audio.length) {
    throw new Error(`${client.label} no direct-URL audio formats`);
  }
  return audio[0];
}

async function getAudioFormat(videoId) {
  const errors = [];
  for (const client of CLIENTS) {
    try {
      const fmt = await fetchPlayer(videoId, client);
      return { fmt, clientUsed: client.label };
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(`All clients failed:\n${errors.join('\n')}`);
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return cors(null, { status: 204 });

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return cors(
        JSON.stringify({ ok: true, clients: CLIENTS.map(c => c.label) }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname !== '/audio') return cors('Not found', { status: 404 });

    const videoId = url.searchParams.get('id');
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return cors('Invalid id', { status: 400 });
    }

    try {
      const { fmt, clientUsed } = await getAudioFormat(videoId);
      const range = request.headers.get('Range');
      const upstream = await fetch(fmt.url, {
        headers: range ? { Range: range } : {},
      });
      if (!upstream.ok && upstream.status !== 206) {
        return cors(`Upstream ${upstream.status}`, { status: 502 });
      }
      const headers = { ...CORS_HEADERS, 'X-Client-Used': clientUsed };
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
