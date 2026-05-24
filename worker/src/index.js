// InnerTube client contexts. When YT_COOKIE secret is set, we prefer the WEB
// client with SAPISIDHASH auth (most reliable for popular/restricted videos).
// Without a cookie we fall back to clients that still skip PoToken checks.
const WEB_CLIENT = {
  label: 'WEB',
  apiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  context: {
    client: {
      clientName: 'WEB',
      clientVersion: '2.20241202.01.00',
      hl: 'en',
      gl: 'US',
    },
  },
};

const ANON_CLIENTS = [
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
      thirdParty: { embedUrl: 'https://www.youtube.com/' },
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

function parseCookie(cookieStr) {
  const out = {};
  for (const part of cookieStr.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

// YouTube's WEB endpoint requires Authorization: SAPISIDHASH <ts>_<sha1hex>
// where hash is SHA1(timestamp + " " + sapisid + " " + origin).
async function sapisidHash(sapisid, origin = 'https://www.youtube.com') {
  const ts = Math.floor(Date.now() / 1000);
  const data = `${ts} ${sapisid} ${origin}`;
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(data));
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${ts}_${hex}`;
}

async function authHeaders(cookieStr) {
  if (!cookieStr) return {};
  const cookies = parseCookie(cookieStr);
  const sapisid =
    cookies.SAPISID ||
    cookies['__Secure-3PAPISID'] ||
    cookies['__Secure-1PAPISID'];
  const headers = { Cookie: cookieStr };
  if (sapisid) {
    const hash = await sapisidHash(sapisid);
    headers.Authorization = `SAPISIDHASH ${hash}`;
    headers['X-Origin'] = 'https://www.youtube.com';
    headers['X-Goog-AuthUser'] = '0';
  }
  return headers;
}

async function fetchPlayer(videoId, client, extraHeaders = {}) {
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
        Referer: 'https://www.youtube.com/',
        ...extraHeaders,
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
    throw new Error(`${client.label} non-JSON: ${text.slice(0, 200)}`);
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

async function getAudioFormat(videoId, cookieStr) {
  const errors = [];
  const clients = [];
  if (cookieStr) clients.push(WEB_CLIENT);
  clients.push(...ANON_CLIENTS);

  const auth = await authHeaders(cookieStr);

  for (const client of clients) {
    try {
      const extras = client.label === 'WEB' ? auth : {};
      const fmt = await fetchPlayer(videoId, client, extras);
      return { fmt, clientUsed: client.label };
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(`All clients failed:\n${errors.join('\n')}`);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors(null, { status: 204 });

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const hasCookie = !!env?.YT_COOKIE;
      return cors(
        JSON.stringify({
          ok: true,
          cookieConfigured: hasCookie,
          clients: [
            ...(hasCookie ? ['WEB'] : []),
            ...ANON_CLIENTS.map(c => c.label),
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.pathname !== '/audio') return cors('Not found', { status: 404 });

    const videoId = url.searchParams.get('id');
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return cors('Invalid id', { status: 400 });
    }

    try {
      const { fmt, clientUsed } = await getAudioFormat(videoId, env?.YT_COOKIE);

      // Use the same User-Agent for the audio fetch as we used to extract.
      const allClients = [WEB_CLIENT, ...ANON_CLIENTS];
      const matchUA =
        allClients.find(c => c.label === clientUsed)?.userAgent ||
        'Mozilla/5.0';

      // Always send a Range header upstream — without it, googlevideo throttles
      // to playback rate (~2 KB/s). With Range: bytes=0- it serves full speed.
      const clientRange = request.headers.get('Range');
      const upstreamRange = clientRange || 'bytes=0-';
      const upstream = await fetch(fmt.url, {
        headers: { Range: upstreamRange, 'User-Agent': matchUA },
      });
      if (!upstream.ok && upstream.status !== 206) {
        return cors(`Upstream ${upstream.status}`, { status: 502 });
      }

      const headers = { ...CORS_HEADERS, 'X-Client-Used': clientUsed };
      if (clientRange) {
        // Client asked for a range — pass everything through.
        for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
          const v = upstream.headers.get(h);
          if (v) headers[h] = v;
        }
        return new Response(upstream.body, { status: upstream.status, headers });
      } else {
        // We sent Range: bytes=0- for throttle bypass but the client didn't
        // ask for a range. Return 200 with the full Content-Length so audio
        // decoders don't get confused by an unexpected 206.
        for (const h of ['content-type', 'content-length']) {
          const v = upstream.headers.get(h);
          if (v) headers[h] = v;
        }
        return new Response(upstream.body, { status: 200, headers });
      }
    } catch (e) {
      return cors(`Error: ${e.message}`, { status: 500 });
    }
  },
};
