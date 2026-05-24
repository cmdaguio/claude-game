// InnerTube client contexts, tried in order. YouTube's PoToken rollout (2024–2025)
// has broken IOS/ANDROID for direct extraction; the clients below still work
// because they target devices YouTube hasn't tightened verification on.
// Reference: yt-dlp's "tv_embedded" and "android_vr" clients.
const CLIENTS = [
  {
    label: 'ANDROID_VR',
    apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    userAgent:
      'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    context: {
      client: {
        clientName: 'ANDROID_VR',
        clientVersion: '1.60.19',
        deviceMake: 'Oculus',
        deviceModel: 'Quest 3',
        osName: 'Android',
        osVersion: '12L',
        androidSdkVersion: 32,
        hl: 'en',
        gl: 'US',
        utcOffsetMinutes: 0,
      },
    },
  },
  {
    label: 'TV_EMBEDDED',
    apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    userAgent:
      'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15',
    context: {
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        clientScreen: 'EMBED',
        hl: 'en',
        gl: 'US',
      },
      thirdParty: {
        embedUrl: 'https://www.youtube.com/',
      },
    },
  },
  {
    label: 'ANDROID_TESTSUITE',
    apiKey: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    userAgent: 'com.google.android.youtube/1.9 (Linux; U; Android 14) gzip',
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
    throw new Error(`${client.label} HTTP ${res.status}: ${text.slice(0, 300)}`);
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
