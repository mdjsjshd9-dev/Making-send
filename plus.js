'use strict';
// =====================================================================
//  PLUS MODULE  –  index.js ke saath chalta hai (voice, call approval, tools)
//  Koi nayi npm package nahi chahiye. Sirf Dockerfile me ffmpeg (already add hai).
// =====================================================================
const path = require('path');
const { spawn } = require('child_process');

module.exports = function createPlus(ctx) {
  const { env, log, sleep, readJson, writeJson, DATA_DIR, settings, saveSettings, history, jidNum, toJid, numList, esc, noteSent, alertOwner, callGemini, askGemini, pushHistory, withTimeout, fetchT, histAt } = ctx;
  const CSRF = ctx.csrfInput || '';

  // ---------------------------------------------------------------- CONFIG
  const KEY = env.GEMINI_API_KEY || '';
  // model list (comma se alag): pehla fail / retire ho to agla chalta hai
  const csv = (v, d) => String(v || d).split(',').map((x) => x.trim()).filter(Boolean);
  const TTS_MODELS = csv(env.GEMINI_TTS_MODEL, 'gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts');
  const IMG_MODELS = csv(env.GEMINI_IMAGE_MODEL, 'gemini-3.1-flash-image-preview,gemini-2.5-flash-image');
  const APPROVAL_SEC = Math.max(5, parseInt(env.CALL_APPROVAL_SEC, 10) || 45);
  const APPROVAL_DEFAULT = (env.CALL_APPROVAL_DEFAULT || 'ignore').toLowerCase(); // ignore = call kato + maafi msg | auto = khud voice me baat
  const REPEAT_MIN = Math.max(1, parseInt(env.REPEAT_CALL_MIN, 10) || 10);
  const SESSION_MIN = Math.max(1, parseInt(env.VOICE_SESSION_MIN, 10) || 10);
  const REJECT_ON_APPROVE = env.CALL_REJECT_ON_APPROVE !== 'false';
  const REJECT_ON_TIMEOUT = env.CALL_REJECT_ON_TIMEOUT !== 'false'; // jawab na mile to call kat do
  const CANCEL_REJECT = env.CALL_CANCEL_REJECT === 'true'; // Cancel (2) par call bhi kat do
  const CALL_AI_MSG = env.CALL_AI_MSG !== 'false'; // call ke baad ka message AI se bane
  const CALL_COOLDOWN_MS = Math.max(0, parseInt(env.CALL_COOLDOWN_SEC, 10) || 120) * 1000;
  const FALLBACK_ANSWERED = env.CALL_ANSWERED_MSG || 'Call par baat karne ke liye shukriya 🙏 Koi aur baat ho to yahan message kar dijiye.';
  const FALLBACK_MISSED = env.CALL_MISSED_MSG || 'Maaf kijiye, aapki call abhi receive nahi ho payi 🙏 Aap yahan apni baat ya samasya likh dijiye, main note kar leta hoon aur jaldi jawab diya jayega.';
  const VOICE_INBOX = env.VOICE_INBOX === 'true'; // panel me voice sunna (privacy ke liye default band)
  const MAX_VOICE_PARTS = Math.max(1, Math.min(5, parseInt(env.MAX_VOICE_PARTS, 10) || 3));
  const PUBLIC_CMDS = env.PUBLIC_CMDS !== 'false';
  const FLOOD_LIMIT = Math.max(5, parseInt(env.FLOOD_LIMIT, 10) || 25);
  const BC_MAX = Math.max(1, parseInt(env.BROADCAST_MAX, 10) || 30);
  const MAX_MEDIA = 10 * 1024 * 1024;
  const MAX_TTS_CHARS = 800; // ek voice note me itne akshar; lamba jawab kai voice note me jata hai

  const VOICES = ['Kore', 'Puck', 'Charon', 'Zephyr', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];
  const PERSONAS = {
    friendly: 'Tum ek dost jaise warm aur helpful ho.',
    teacher: 'Tum ek dhairya wale teacher ho: simple example ke saath samjhao.',
    funny: 'Tum thode mazakiya ho: halka-phulka humor use karo par madad poori karo.',
    formal: 'Tum bahut professional aur formal ho: polite, seedhi bhasha.',
    shayar: 'Tum jawab me kabhi kabhi ek chhota shayari-style touch dete ho.',
    support: 'Tum ek customer support agent ho: samasya samjho, steps batao, polite raho.',
    coach: 'Tum ek motivating life/fitness coach ho: chhote actionable steps do.',
  };
  const LANGS = { hindi: 'Hindi (Devanagari script)', english: 'English', hinglish: 'Hinglish (Hindi in Roman letters)' };
  const PUBLIC = new Set(['tts', 'speak', 'tr', 'weather', 'calc', 'joke', 'sticker', 'ocr']);

  settings.kb ||= [];
  settings.notes ||= [];
  settings.reminders ||= [];
  settings.callVip ||= [];
  settings.modes ||= {};

  // ---------------------------------------------------------------- FILES / STATE
  const HIST_FILE = path.join(DATA_DIR, 'history.json');
  const STATS_FILE = path.join(DATA_DIR, 'stats.json');
  const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
  const CALLLOG_FILE = path.join(DATA_DIR, 'calllog.json');

  const loaded = readJson(HIST_FILE, {});
  for (const [k, v] of Object.entries(loaded)) {
    if (Array.isArray(v)) {
      history.set(k, v);
      histAt.set(k, Date.now());
    }
  }
  let stats = readJson(STATS_FILE, {});
  const contacts = readJson(CONTACTS_FILE, {});
  const callLog = readJson(CALLLOG_FILE, []);
  let dirty = { stats: false, contacts: false, calls: false };
  let lastHist = '';

  const pending = new Map(); // approval id -> { id, entry, timer }
  const sessions = new Map(); // number/id -> session (same object under many ids)
  const recentCalls = new Map(); // num -> { at, accepted }
  const lastFollow = new Map(); // num -> last call-message time
  const callMsgHist = []; // pichle AI call-messages (repeat na ho)
  let lastHistWrite = 0;
  const vflag = new Set(); // is waqt voice me jawab banana hai
  const tempBlocked = new Map(); // num -> until
  const floodMap = new Map();
  const voiceInbox = [];
  let inboxBytes = 0;
  let seq = 0;
  let vseq = 0;

  const S = () => ctx.getSock();
  const connected = () => !!S() && ctx.getStatus() === 'connected';
  const today = () => ctx.nowParts().date;
  const idsOf = (jid, alt) => [...new Set([jidNum(jid), alt ? jidNum(alt) : ''].filter(Boolean))];
  const sessionOf = (ids) => {
    for (const i of ids) if (sessions.get(i)) return sessions.get(i);
    return null;
  };
  const content = (m) => {
    const b = ctx.getBaileys();
    return (b?.normalizeMessageContent ? b.normalizeMessageContent(m.message) : m.message) || {};
  };
  const parseCmd = (t) => {
    t = String(t || '').trim();
    if (!/^[!/]/.test(t)) return null;
    const mm = t.slice(1).match(/^(\S+)\s*([\s\S]*)$/);
    return mm ? { cmd: mm[1].toLowerCase(), arg: mm[2].trim() } : null;
  };
  const permitted = (num, jid) => {
    const B = ctx.getBlocked();
    const A = ctx.getAllowed();
    if (B.includes(num) || B.includes(jid)) return false;
    if (A.length && !A.includes(num) && !A.includes(jid)) return false;
    return true;
  };
  const clip = (s, n) => {
    s = String(s);
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    const i = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('।'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    return i > n * 0.5 ? cut.slice(0, i + 1) : cut;
  };
  const hhmm = (ms) => new Date(ms).toLocaleTimeString('en-IN', { timeZone: ctx.getTZ(), hour: '2-digit', minute: '2-digit' });
  const ownerJid = () => (S()?.user?.id ? `${jidNum(S().user.id)}@s.whatsapp.net` : null);

  function bump(k, n = 1) {
    const d = today();
    if (stats.date !== d) stats = { date: d, reportedDate: stats.reportedDate };
    stats[k] = (stats[k] || 0) + n;
    dirty.stats = true;
  }

  function contact(num, jid, name, isPn) {
    let c = contacts[num];
    if (!c) {
      c = contacts[num] = { first: Date.now(), count: 0, isNew: true };
      const keys = Object.keys(contacts);
      if (keys.length > 2500) {
        // sabse purane contacts hata do (RAM / file badhne se roko)
        keys.sort((a, b) => (contacts[a].last || 0) - (contacts[b].last || 0)).slice(0, 300).forEach((k) => delete contacts[k]);
      }
    }
    if (isPn !== undefined) c.pn = !!isPn; // pn = asli phone number pata hai (broadcast sirf inhe)
    if (name) c.name = name;
    c.last = Date.now();
    c.count += 1;
    const j = jidNum(jid);
    if (j && j !== num) contacts[j] = c;
    dirty.contacts = true;
    return c;
  }

  function stash(dir, jid, buf, text) {
    if (!VOICE_INBOX) return; // default: voice RAM me bhi nahi rakhte
    voiceInbox.push({ id: ++vseq, dir, num: jidNum(jid), at: Date.now(), buf, text: text || '' });
    inboxBytes += buf?.length || 0;
    while (voiceInbox.length > 8 || inboxBytes > 20 * 1024 * 1024) inboxBytes -= voiceInbox.shift()?.buf?.length || 0;
  }

  // ---------------------------------------------------------------- GEMINI TTS + FFMPEG
  async function gfetch(models, body) {
    if (!KEY) throw new Error('GEMINI_API_KEY set nahi hai');
    let last;
    for (const model of [].concat(models)) {
      for (let i = 1; i <= 2; i++) {
        try {
          const res = await fetchT(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body) },
            60000
          );
          const data = await res.json().catch(() => ({}));
          if (res.ok) return data;
          last = new Error(`${model} ${res.status} ${(data?.error?.message || '').slice(0, 120)}`);
          log('gemini media error:', last.message);
          if ((res.status >= 500 || res.status === 429) && i === 1) {
            await sleep(2000);
            continue;
          }
          break; // 400/404 etc -> agla model
        } catch (e) {
          last = e;
          if (i === 1) {
            await sleep(1500);
            continue;
          }
          break;
        }
      }
    }
    throw last || new Error('Gemini fail');
  }

  async function ttsPcm(text, voice, tone) {
    const prompt = tone ? `Say ${tone}: ${text}` : text;
    const data = await gfetch(TTS_MODELS, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    });
    const part = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
    if (!part) throw new Error('TTS se audio nahi aaya');
    return Buffer.from(part.inlineData.data, 'base64'); // PCM 16-bit 24kHz mono
  }

  function ff(args, input) {
    return new Promise((resolve, reject) => {
      const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args]);
      const killer = setTimeout(() => p.kill('SIGKILL'), 30000); // ffmpeg atke to band
      const out = [];
      const err = [];
      p.stdout.on('data', (d) => out.push(d));
      p.stderr.on('data', (d) => err.push(d));
      p.on('error', (e) => {
        clearTimeout(killer);
        reject(new Error('ffmpeg nahi mila: ' + e.message));
      });
      p.on('close', (code) => {
        clearTimeout(killer);
        code === 0 && out.length ? resolve(Buffer.concat(out)) : reject(new Error('ffmpeg fail: ' + Buffer.concat(err).toString().slice(0, 200)));
      });
      p.stdin.on('error', () => {});
      p.stdin.end(input);
    });
  }
  const pcmToOgg = (pcm) => ff(['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip', '-f', 'ogg', 'pipe:1'], pcm);

  function wav(pcm) {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0);
    h.writeUInt32LE(36 + pcm.length, 4);
    h.write('WAVEfmt ', 8);
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20);
    h.writeUInt16LE(1, 22);
    h.writeUInt32LE(24000, 24);
    h.writeUInt32LE(48000, 28);
    h.writeUInt16LE(2, 32);
    h.writeUInt16LE(16, 34);
    h.write('data', 36);
    h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
  }

  const speakable = (t) =>
    String(t)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/https?:\/\/\S+/g, ' link ')
      .replace(/[*_~`#>|]/g, '')
      .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  const voiceName = () => settings.voice || env.TTS_VOICE || 'Kore';

  async function makeVoice(text, o = {}) {
    const clean = clip(String(text).trim(), MAX_TTS_CHARS + 100);
    if (!clean) throw new Error('bolne layak text nahi');
    const pcm = await ttsPcm(clean, o.voice || voiceName(), o.tone ?? settings.tone);
    const ogg = await pcmToOgg(pcm);
    return { pcm, ogg, secs: Math.max(1, Math.round(pcm.length / 48000)) };
  }

  // lamba text vakya ki sima par tukdon me baanta jata hai (har tukda ek voice note). Bacha hua rest text me jata hai.
  function splitForVoice(text) {
    let rest = speakable(text);
    const parts = [];
    while (rest && parts.length < MAX_VOICE_PARTS) {
      if (rest.length <= MAX_TTS_CHARS) {
        parts.push(rest);
        rest = '';
        break;
      }
      const cut = rest.slice(0, MAX_TTS_CHARS);
      const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('। '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
      const sp = cut.lastIndexOf(' ');
      const at = i > MAX_TTS_CHARS * 0.4 ? i + 1 : sp > 0 ? sp : MAX_TTS_CHARS;
      parts.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    return { parts, rest };
  }

  // returns { rest }: voice me na ja paya hissa (text me bhejna ho to)
  async function sendVoice(jid, text, quoted) {
    const s = S();
    const { parts, rest } = splitForVoice(text);
    if (!parts.length) throw new Error('bolne layak text nahi');
    await s.sendPresenceUpdate('recording', jid).catch(() => {});
    for (let i = 0; i < parts.length; i++) {
      const v = await makeVoice(parts[i]);
      const r = await s.sendMessage(jid, { audio: v.ogg, mimetype: 'audio/ogg; codecs=opus', ptt: true, seconds: v.secs }, quoted && i === 0 ? { quoted } : undefined);
      noteSent(r);
      stash('out', jid, v.ogg, parts[i]);
      bump('voiceOut');
      if (i < parts.length - 1) await sleep(1200);
    }
    s.sendPresenceUpdate('paused', jid).catch(() => {});
    return { rest };
  }

  // ---------------------------------------------------------------- REPLY MODE / SEND
  function modeFor(ids) {
    if (ids.some((i) => vflag.has(i)) || sessionOf(ids)) return 'voice';
    for (const i of ids) if (settings.modes[i]) return settings.modes[i];
    return settings.mode || env.REPLY_MODE || 'text';
  }

  function extraSystem(jid) {
    const ids = idsOf(jid);
    const c = contacts[ids[0]];
    const p = [];
    if (PERSONAS[settings.persona]) p.push('Persona: ' + PERSONAS[settings.persona]);
    if (settings.lang && settings.lang !== 'auto') p.push(`Hamesha ${LANGS[settings.lang] || settings.lang} me jawab do.`);
    if (settings.kb.length) p.push('Ye zaroori jaankari / FAQ jahan kaam aaye wahan use karo:\n' + settings.kb.map((x, i) => `${i + 1}. ${x}`).join('\n'));
    if (settings.busy) p.push(`Owner abhi busy hai (${settings.busy}). Agar koi owner se milna ya baat karna chahe to politely batao ki owner busy hain aur message note ho gaya hai.`);
    if (c?.name) p.push(`User ka WhatsApp naam: ${c.name}.`);
    if (modeFor(ids) !== 'text')
      p.push('Ye jawab bolkar sunaya jayega: 2-4 chhote bolchal wale vakya, koi markdown/list/emoji/link nahi. Hindi ya Hinglish me bolna ho to Devanagari me likho taaki uchcharan sahi aaye.');
    return p.length ? '\n\n' + p.join('\n') : '';
  }

  async function sendReply(s, jid, reply, m, opts = {}) {
    const ids = idsOf(jid, m?.key?.remoteJidAlt);
    const c = contacts[ids[0]] || (ids[1] && contacts[ids[1]]);
    if (m && settings.readReceipts !== false) s.readMessages([m.key]).catch(() => {});
    if (settings.welcome && c?.isNew && !c.welcomed && !String(jid).endsWith('@g.us')) {
      c.welcomed = true;
      dirty.contacts = true;
      noteSent(await s.sendMessage(jid, { text: settings.welcome }));
      await sleep(1200);
    }
    if (opts.voice) ids.forEach((i) => vflag.add(i));
    const mode = modeFor(ids);
    ids.forEach((i) => vflag.delete(i));
    const se = sessionOf(ids);
    if (se) {
      se.turns += 1;
      se.until = Date.now() + SESSION_MIN * 60000;
    }
    if (mode !== 'voice' && settings.humanDelay !== false) {
      await s.sendPresenceUpdate('composing', jid).catch(() => {});
      await sleep(Math.min(3500, 500 + String(reply).length * 12));
    }
    if (mode !== 'text') {
      try {
        const vr = await sendVoice(jid, reply, m);
        if (mode === 'voice') {
          if (vr.rest) noteSent(await s.sendMessage(jid, { text: vr.rest })); // jo voice me nahi aaya wo text me
          return;
        }
      } catch (e) {
        log('voice fail, text bhej raha hoon:', e.message);
      }
    }
    noteSent(await s.sendMessage(jid, { text: reply }, m ? { quoted: m } : undefined));
  }

  async function deliver(jid, text, voice) {
    if (voice) {
      try {
        const vr = await sendVoice(jid, text);
        if (vr.rest) noteSent(await S().sendMessage(jid, { text: vr.rest }));
        return;
      } catch (e) {
        log('scheduled voice fail -> text:', e.message);
      }
    }
    noteSent(await S().sendMessage(jid, { text }));
  }

  // ---------------------------------------------------------------- MEDIA
  async function download(msg, s) {
    const b = ctx.getBaileys();
    const buf = await b.downloadMediaMessage(msg, 'buffer', {}, { logger: ctx.logger, reuploadRequest: s.updateMediaMessage });
    if (!buf || !buf.length || buf.length > MAX_MEDIA) return null;
    return Buffer.from(buf);
  }
  const b64 = (buf, mimeType, label) => ({ mimeType: String(mimeType).split(';')[0].trim(), data: buf.toString('base64'), label });

  function pickImageMsg(m, jid) {
    const c = content(m);
    if (c.imageMessage) return m;
    const q = c.extendedTextMessage?.contextInfo;
    if (q?.quotedMessage?.imageMessage) return { key: { remoteJid: jid, id: q.stanzaId, participant: q.participant }, message: q.quotedMessage };
    return null;
  }

  async function transcribe(media) {
    const r = await callGemini(
      [{ role: 'user', parts: [{ inlineData: { mimeType: media.mimeType, data: media.data } }, { text: 'Is audio me jo bola gaya hai use bilkul waisa hi likho (wahi bhasha; Hindi ho to Roman Hinglish me). Sirf transcript do, aur kuch nahi. Agar kuch sunai na de to sirf: EMPTY' }] }],
      'You are a precise speech transcriber.'
    );
    const t = (r.ok ? r.text : '').trim();
    return !t || /^EMPTY$/i.test(t) ? '' : t;
  }

  async function onAudio(m, s, jid, a) {
    bump('voiceIn');
    s.sendMessage(jid, { react: { text: '🎧', key: m.key } }).catch(() => {});
    const buf = await download(m, s);
    if (!buf) return noteSent(await s.sendMessage(jid, { text: 'Voice note khul nahi paya ya bahut bada hai, dobara bhejiye 🙏' }, { quoted: m }));
    stash('in', jid, buf, '');
    const media = b64(buf, a.mimetype || 'audio/ogg', 'Voice');
    await s.sendPresenceUpdate('recording', jid).catch(() => {});
    const said = await transcribe(media);
    if (!said) return sendReply(s, jid, 'Aapki awaaz saaf sunai nahi di, kripya dobara bolkar bhejiye 🙏', m, { voice: true });
    const ids = idsOf(jid, m.key.remoteJidAlt);
    if (settings.mirror !== false) ids.forEach((i) => vflag.add(i));
    let reply;
    try {
      reply = await askGemini(jid, `[Voice note] ${said}`);
    } finally {
      ids.forEach((i) => vflag.delete(i));
    }
    return sendReply(s, jid, reply, m, { voice: settings.mirror !== false });
  }

  async function onDoc(m, s, jid, text, d, label, isVideo) {
    const buf = await download(m, s);
    if (!buf) return noteSent(await s.sendMessage(jid, { text: `${label} bahut bada ya khul nahi paya (limit 10MB) 🙏` }, { quoted: m }));
    const media = b64(buf, d.mimetype || (isVideo ? 'video/mp4' : 'application/pdf'), label);
    const q = text || (isVideo ? 'Is video me kya ho raha hai? Short me batao.' : 'Is document ko padho aur short summary + zaroori points batao.');
    const reply = await askGemini(jid, q, media);
    return sendReply(s, jid, reply, m);
  }

  // ---------------------------------------------------------------- SMALL TOOLS
  const wmo = (c) =>
    c === 0 ? 'Saaf aasmaan ☀️' : c <= 3 ? 'Halke baadal ⛅' : c <= 48 ? 'Kohra 🌫' : c <= 57 ? 'Boondabandi 🌦' : c <= 67 ? 'Baarish 🌧' : c <= 77 ? 'Barfbaari ❄️' : c <= 82 ? 'Zordar baarish 🌧' : 'Toofan ⛈';

  async function weatherAt(lat, lon, label) {
    const r = await fetchT(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`, {}, 15000);
    const d = await r.json();
    const c = d.current;
    const dl = d.daily;
    if (!c) return 'Mausam ka data nahi mila.';
    return `🌤 ${label}\n${wmo(c.weather_code)} ${c.temperature_2m}°C (mehsoos: ${c.apparent_temperature}°C)\nNami: ${c.relative_humidity_2m}% | Hawa: ${c.wind_speed_10m} km/h\nAaj: ${dl.temperature_2m_min[0]}° se ${dl.temperature_2m_max[0]}°C, baarish ki sambhavna ${dl.precipitation_probability_max[0]}%`;
  }
  async function weatherCity(name) {
    const r = await fetchT(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en`, {}, 15000);
    const g = (await r.json())?.results?.[0];
    if (!g) return `"${name}" shehar nahi mila.`;
    return weatherAt(g.latitude, g.longitude, `${g.name}${g.country ? ', ' + g.country : ''}`);
  }

  // Function()/eval ke bina chhota safe parser: + - * / % ^ ( ) aur decimal
  function calc(expr) {
    const s = String(expr).replace(/,/g, '').replace(/\s+/g, '').replace(/\*\*/g, '^');
    if (!s || s.length > 80 || !/^[\d+\-*/().%^]+$/.test(s)) return null;
    let i = 0;
    const fail = () => {
      throw new Error('bad');
    };
    function atom() {
      if (s[i] === '(') {
        i++;
        const v = add();
        if (s[i] !== ')') fail();
        i++;
        return v;
      }
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)/);
      if (!m) fail();
      i += m[0].length;
      return parseFloat(m[0]);
    }
    function unary() {
      if (s[i] === '-') {
        i++;
        return -unary();
      }
      if (s[i] === '+') {
        i++;
        return unary();
      }
      return power();
    }
    function power() {
      const b = atom();
      if (s[i] === '^') {
        i++;
        return Math.pow(b, unary());
      }
      return b;
    }
    function mul() {
      let v = unary();
      while (s[i] === '*' || s[i] === '/' || s[i] === '%') {
        const op = s[i++];
        const r = unary();
        v = op === '*' ? v * r : op === '/' ? v / r : v % r;
      }
      return v;
    }
    function add() {
      let v = mul();
      while (s[i] === '+' || s[i] === '-') {
        const op = s[i++];
        const r = mul();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    try {
      const v = add();
      if (i !== s.length) return null;
      return Number.isFinite(v) ? v : null;
    } catch (_) {
      return null;
    }
  }

  const makeSticker = (buf) =>
    ff(['-i', 'pipe:0', '-frames:v', '1', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000', '-c:v', 'libwebp', '-lossless', '0', '-quality', '70', '-f', 'webp', 'pipe:1'], buf);

  async function imagine(prompt) {
    const data = await gfetch(IMG_MODELS, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } });
    const part = (data?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
    if (!part) throw new Error('Image nahi bani (model ya quota check karo)');
    return { mime: part.inlineData.mimeType || 'image/png', buf: Buffer.from(part.inlineData.data, 'base64') };
  }

  // AI fail ho to null (error text kabhi asli jawab ban kar na jaye)
  const ask1 = async (prompt, system) => {
    const r = await callGemini([{ role: 'user', parts: [{ text: prompt }] }], system || 'Reply in the same language as the user. Be brief.');
    return r.ok && r.text ? r.text : null;
  };

  function parseWhen(s) {
    s = String(s).trim().toLowerCase();
    let m = s.match(/^(\d+)\s*(s|sec|m|min|h|hr|hour|d|day)s?$/);
    if (m) {
      const n = parseInt(m[1], 10);
      const u = m[2][0];
      return n * (u === 's' ? 1000 : u === 'm' ? 60000 : u === 'h' ? 3600000 : 86400000);
    }
    m = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (m) {
      const n = ctx.nowParts();
      let diff = (parseInt(m[1], 10) * 60 + parseInt(m[2], 10) - (n.hh * 60 + n.mm) + 1440) % 1440;
      if (diff === 0) diff = 1440;
      return diff * 60000 - new Date().getSeconds() * 1000;
    }
    return null;
  }

  function listMgr(arr, label, arg, save, loose) {
    const mm = arg.match(/^(\S+)\s*([\s\S]*)$/);
    let sub = (mm ? mm[1] : 'list').toLowerCase();
    let val = (mm ? mm[2] : '').trim();
    if (loose && !['list', 'add', 'del', 'clear'].includes(sub)) {
      val = arg;
      sub = 'add';
    }
    if (sub === 'add' && val) arr.push(val);
    else if ((sub === 'del' || sub === 'remove') && parseInt(val, 10) > 0) arr.splice(parseInt(val, 10) - 1, 1);
    else if (sub === 'clear') arr.length = 0;
    else if (sub !== 'list') return `Use: add <text> | del N | list | clear`;
    save();
    return arr.length ? `${label}:\n` + arr.map((x, i) => `${i + 1}) ${x}`).join('\n') : `${label}: khali`;
  }

  const inDnd = () => {
    const d = settings.dnd;
    if (!d?.from || !d?.to) return false;
    const n = ctx.nowParts();
    const now = n.hh * 60 + n.mm;
    const f = d.from.split(':').reduce((a, b) => a * 60 + +b);
    const t = d.to.split(':').reduce((a, b) => a * 60 + +b);
    return f <= t ? now >= f && now < t : now >= f || now < t;
  };

  // ---------------------------------------------------------------- CALLS
  // Ek call = ek state machine = caller ko max EK message:
  //   ringing -> approve   : call kat + voice note + voice chat          (state 'bot')
  //           -> cancel(2) : bot hat gaya, call ringing chhodi            (state 'cancelled')
  //           -> timeout   : call kat + AI maafi message                  (state 'missed')
  //           -> aapne uthayi (accept event) : bot hat gaya, call ke baad AI shukriya (state 'answered')
  //   callmode off : kuch nahi poochta; call khatam hone par AI shukriya / maafi (state 'plain')
  const GREET = () => settings.callGreet || env.CALL_GREETING || 'Namaste! Main abhi call par baat nahi kar sakta, lekin aap yahan voice note bhejiye ya likhiye. Main sunkar turant voice me jawab dunga.';
  const GREET_DND = 'Namaste! Abhi aaram ka samay hai, isliye call nahi uth sakti. Aap voice note ya message chhod dijiye, main sunkar jawab dunga aur unhe bata dunga.';
  const callById = (id) => callLog.find((x) => x.id === id);
  const dayPart = () => {
    const h = ctx.nowParts().hh;
    return h < 5 ? 'raat' : h < 12 ? 'subah' : h < 17 ? 'dopahar' : h < 21 ? 'shaam' : 'raat';
  };

  function startSession(jid, num, why) {
    const se = { jid, num, ids: idsOf(jid).concat(num), started: Date.now(), until: Date.now() + SESSION_MIN * 60000, turns: 0, why };
    for (const i of se.ids) sessions.set(i, se);
    bump('sessions');
    return se;
  }

  async function endSession(se, quiet) {
    for (const i of se.ids) if (sessions.get(i) === se) sessions.delete(i);
    try {
      if (!quiet && connected()) await sendVoice(se.jid, 'Baat karke achha laga. Aur kuch chahiye to kabhi bhi message ya voice note bhej dijiye. Dhanyavaad!').catch(() => {});
      if (se.turns > 0) {
        const h = (history.get(se.jid) || []).slice(-10).map((x) => `${x.role === 'user' ? 'User' : 'Bot'}: ${x.text}`).join('\n');
        const sum = h ? await ask1('Is baatcheet ka 2-3 line Hinglish summary do (kya poocha, kya zaroori):\n' + h) : null;
        await alertOwner(`🎙 Voice chat khatam: ${se.num} (${se.turns} jawab)${sum ? '\n' + sum : ''}`); // summary fail ho to error text nahi jata
      }
    } catch (e) {
      log('endSession:', e.message);
    }
  }

  // Call reject: alag-alag ID (from / chatId / phone) se try karta hai (Baileys 7 me LID aur phone alag ho sakte hain)
  async function tryReject(entry) {
    const s = S();
    if (!s) return false;
    const pn = entry.pn ? (String(entry.pn).includes('@') ? entry.pn : `${entry.pn}@s.whatsapp.net`) : null;
    const cands = [...new Set([entry.from, entry.jid, pn].filter(Boolean))];
    let anyOk = false;
    let lastErr = '';
    for (const who of cands) {
      try {
        await withTimeout(s.rejectCall(entry.id, who), 15000, 'rejectCall');
        anyOk = true;
        log(`rejectCall bheja (call ${entry.id}, ${who})`);
        for (let i = 0; i < 6 && !entry.ended; i++) await sleep(500); // asar dikha? (terminate/reject event aana chahiye)
        if (entry.ended) {
          entry.rejected = true;
          return true;
        }
        log(`rejectCall: ${who} se call band hone ka event nahi aaya, agli ID try`);
      } catch (e) {
        lastErr = e.message;
        log('rejectCall fail:', who, e.message);
      }
    }
    if (anyOk) {
      entry.rejected = true; // bheja gaya, par confirm nahi hua
      return true;
    }
    bump('rejectFail');
    entry.rejectErr = lastErr;
    return false;
  }

  // Call ke baad ka message (AI se). Fail ho to env / default text.
  async function callMessage(entry, kind) {
    if (!CALL_AI_MSG) return null;
    const name = contacts[entry.num]?.name;
    const earlier = callLog.filter((x) => x.num === entry.num && x.id !== entry.id && Date.now() - x.at < 3600000).length;
    const lines = [
      `Ek WhatsApp ${entry.video ? 'video ' : ''}call abhi ${kind === 'answered' ? 'uthayi gayi aur baat hui' : 'miss ho gayi (owner nahi utha paye)'}.`,
      name ? `Caller ka naam: ${name}.` : '',
      `Samay: ${dayPart()} (${hhmm(Date.now())}).`,
      earlier ? `Is number se pichle 1 ghante me ${earlier} aur call aayi thi.` : '',
      kind === 'answered'
        ? 'Likho: baat karne ke liye chhota sa shukriya, aur kaho ki koi aur baat ho to yahan message kar sakte hain.'
        : 'Likho: call na uth paane ki maafi, poochho ki kya baat ya samasya hai (text ya photo me bhej sakte hain), batao ki message note ho jayega aur jaldi jawab milega. Agar baat bahut urgent ho to dobara call kar sakte hain.',
      'Sirf final WhatsApp message likho: 1-3 chhote vakya, natural bolchal ki Hinglish (caller jis bhasha me comfortable ho), zyada se zyada 1 emoji, har baar naye shabd. Koi label, quote ya explanation nahi.',
      callMsgHist.length ? 'Pichle messages jaisa mat likho:\n' + callMsgHist.map((x) => '- ' + x).join('\n') : '',
    ].filter(Boolean);
    const r = await callGemini([{ role: 'user', parts: [{ text: lines.join('\n') }] }], ctx.getPrompt() + extraSystem(entry.jid));
    if (!r.ok || !r.text) return null;
    const t = r.text.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
    if (!t || t.length > 600) return null;
    callMsgHist.push(t.replace(/\s+/g, ' ').slice(0, 100));
    while (callMsgHist.length > 6) callMsgHist.shift();
    return t;
  }

  async function followUp(entry, kind) {
    if (entry.followed) return; // ek call par ek hi message
    entry.followed = true;
    try {
      if (!settings.callReply || !connected()) return;
      if (!permitted(entry.num, entry.jid)) return;
      if (Date.now() - (lastFollow.get(entry.num) || 0) < CALL_COOLDOWN_MS) {
        log(`call msg skip (cooldown): ${entry.num}`);
        return;
      }
      lastFollow.set(entry.num, Date.now());
      let text = await callMessage(entry, kind).catch((e) => {
        log('call msg AI error:', e.message);
        return null;
      });
      const ai = !!text;
      if (!text) text = kind === 'answered' ? FALLBACK_ANSWERED : FALLBACK_MISSED;
      await sleep(1500 + Math.random() * 2500);
      noteSent(await withTimeout(S().sendMessage(entry.jid, { text }), 30000, 'call msg'));
      pushHistory(
        entry.jid,
        kind === 'answered'
          ? '[System: is vyakti ne abhi call ki thi aur baat hui. Maine shukriya bola.]'
          : '[System: is vyakti ne abhi call ki thi par call uthayi nahi gayi. Maine maafi mangi aur unki baat / samasya puchi. Ab unki baat dhyan se suno, madad karo, aur kaho ki unka message note kar liya gaya hai.]',
        text
      );
      entry.result += kind === 'answered' ? ' + shukriya msg' : ' + maafi msg';
      dirty.calls = true;
      log(`call msg (${kind}, ${ai ? 'AI' : 'fixed'}) -> ${entry.num}`);
      if (kind === 'missed') await alertOwner(`📞 Missed ${entry.video ? 'video ' : ''}call: ${entry.num}. Maine unhe message bhej diya (unki baat puchi).`);
    } catch (e) {
      log('followUp error:', e.message);
    }
  }

  async function autoAnswer(entry, why) {
    const s = S();
    entry.state = 'bot';
    if (REJECT_ON_APPROVE && !entry.ended) {
      const ok = await tryReject(entry);
      if (!ok) await alertOwner(`Call (${entry.num}) kat nahi paayi, ringing chalti reh sakti hai. Voice note phir bhi bhej raha hoon. Logs me "rejectCall" dekho.`);
    }
    entry.result = `bot ne baat ki (${why})${entry.rejected ? '' : ' - call kat nahi'}`;
    dirty.calls = true;
    startSession(entry.jid, entry.num, why);
    const g = why === 'DND time' ? GREET_DND : GREET();
    try {
      await sleep(800);
      await sendVoice(entry.jid, g);
    } catch (e) {
      log('greeting voice fail:', e.message);
      noteSent(await s.sendMessage(entry.jid, { text: g }));
    }
    if (why !== 'approve') await alertOwner(`📞 ${entry.video ? 'Video ' : ''}call ${entry.num} se aayi — ${why}. Maine khud sambhal li, voice chat chalu hai.`);
  }

  async function onCallOffer(c) {
    const mode = settings.callMode || 'ask';
    bump('calls');
    const entry = { id: c.id, num: c.num, jid: c.jid, from: c.from, pn: c.pn, video: c.video, at: Date.now(), result: 'ringing', state: 'ringing' };
    callLog.push(entry);
    while (callLog.length > 50) callLog.shift();
    dirty.calls = true;
    const prev = recentCalls.get(c.num);
    recentCalls.set(c.num, { at: Date.now(), accepted: false });
    if (mode === 'off' || !connected()) {
      entry.state = 'plain';
      return (entry.result = mode === 'off' ? 'callmode off' : 'bot connected nahi tha');
    }
    if (!permitted(c.num, c.jid)) {
      entry.state = 'blocked';
      return (entry.result = 'blocked / allowed list me nahi');
    }
    const repeat = prev && !prev.accepted && Date.now() - prev.at < REPEAT_MIN * 60000;
    const why = mode === 'auto' ? 'auto mode' : settings.callVip.includes(c.num) ? 'VIP' : repeat ? 'dobara call (repeat)' : inDnd() ? 'DND time' : null;
    if (why) {
      bump('auto');
      return autoAnswer(entry, why);
    }
    const id = 'C' + ++seq;
    const autoOnTimeout = APPROVAL_DEFAULT === 'auto';
    const p = { id, entry, at: Date.now(), timer: setTimeout(() => resolveCall(id, autoOnTimeout ? 'approve' : 'timeout').catch((e) => log('resolveCall:', e.message)), APPROVAL_SEC * 1000) };
    pending.set(id, p);
    const who = contacts[c.num]?.name ? `${c.num} (${contacts[c.num].name})` : c.num;
    const reached = await alertOwner(
      `📞 ${entry.video ? 'Video call' : 'Call'} aa rahi hai: ${who}\n\n*1* = ✅ Approve (call kat kar voice note se baat karunga)\n*2* = ❌ Cancel (main kuch nahi karunga, call ringing chhod dunga)\n\n${APPROVAL_SEC}s me kuch na bola to ${autoOnTimeout ? 'main khud voice me baat kar lunga' : 'call kat dunga aur maafi ka message bhej dunga'}. Aap khud utha lo to main hat jaunga. (ID ${id})`
    );
    if (!reached) {
      log(`call ${id}: owner tak prompt nahi pahuncha, default action turant`);
      await resolveCall(id, autoOnTimeout ? 'approve' : 'timeout');
    }
  }

  async function resolveCall(id, action) {
    const p = pending.get(id);
    if (!p) return false;
    clearTimeout(p.timer);
    pending.delete(id);
    const e = p.entry;
    if (action === 'approve') {
      bump('approved');
      await autoAnswer(e, 'approve');
    } else if (action === 'cancel') {
      bump('cancelled');
      e.state = 'cancelled';
      e.result = 'cancel (owner ne mana kiya)';
      if (CANCEL_REJECT && !e.ended) {
        const ok = await tryReject(e);
        e.result += ok ? ' + call kati' : ' + call kaatna fail';
      }
    } else {
      // jawab nahi aaya: call kato + maafi
      bump('missed');
      e.state = 'missed';
      e.result = 'approval timeout';
      if (REJECT_ON_TIMEOUT && !e.ended) {
        const ok = await tryReject(e);
        e.result += ok ? ' -> call kati' : ' -> call kaatna fail';
        if (!ok) await alertOwner(`Call (${e.num}) kat nahi paayi (rejectCall fail). Logs me "rejectCall" line dekho.`);
      }
      await followUp(e, 'missed');
    }
    dirty.calls = true;
    return true;
  }

  // aapne (ya kisi device ne) call utha li
  function onCallAccepted(id) {
    const e = callById(id);
    if (!e) return;
    recentCalls.set(e.num, { at: Date.now(), accepted: true });
    e.accepted = true;
    if (e.state === 'ringing' || e.state === 'plain') {
      for (const [pid, p] of pending) {
        if (p.entry === e) {
          clearTimeout(p.timer);
          pending.delete(pid);
        }
      }
      e.state = 'answered';
      e.result = 'aapne uthayi';
      dirty.calls = true;
    }
  }

  async function onCallEnd(id, status) {
    const e = callById(id);
    if (!e) return;
    e.ended = true;
    dirty.calls = true;
    if (e.state === 'answered') {
      e.result = 'baat hui';
      return followUp(e, 'answered');
    }
    if (e.state === 'plain') {
      e.result = status === 'reject' ? 'cut / reject ki gayi' : 'miss ho gayi';
      return followUp(e, 'missed');
    }
    if (e.state === 'ringing') e.result = 'caller ne kaat di (approval ka intezaar)'; // timer / owner ka jawab baaki hai
  }

  // ---------------------------------------------------------------- PRE-HOOK (har message par)
  async function pre({ m, s, jid, num, isPn, text, selfChat, fromOwner }) {
    const isOwnerMsg = selfChat || fromOwner;
    // Approval jawab: sirf poora "1" / "2" (ya ✅ / ❌) aur sirf jab call pending ho. Normal baat se galti se trigger nahi hota.
    if (isOwnerMsg && pending.size) {
      const t = String(text || '').trim();
      const yes = /^(1|✅|1️⃣)$/.test(t);
      const no = /^(2|❌|2️⃣)$/.test(t);
      if (yes || no) {
        if (pending.size > 1) {
          const ids = [...pending.values()].map((p) => `${p.id} (${p.entry.num})`).join(', ');
          noteSent(await s.sendMessage(jid, { text: `🤖 Ek se zyada calls pending hain: ${ids}\nKaunsi? Likho: !approve <ID> ya !cancel <ID>` }));
          return true;
        }
        const p = [...pending.values()][0];
        const late = p.entry.ended;
        await resolveCall(p.id, yes ? 'approve' : 'cancel');
        noteSent(
          await s.sendMessage(jid, {
            text: yes ? `🤖 ✅ Approve ho gaya${late ? ' (call khatam ho chuki thi, par voice chat shuru kar di)' : ''}.` : `🤖 ❌ Cancel. Main kuch nahi karunga${CANCEL_REJECT ? ' (call kat di)' : ' (call ringing chhodi hai, aap utha sakte ho)'}.`,
          })
        );
        return true;
      }
    }
    if (m.key.fromMe || isOwnerMsg || String(jid).endsWith('@g.us')) return false;
    const until = tempBlocked.get(num);
    if (until && until > Date.now()) return true;
    contact(num, jid, m.pushName, isPn);
    bump('msgs');
    const now = Date.now();
    const arr = (floodMap.get(num) || []).filter((t) => now - t < 60000);
    arr.push(now);
    floodMap.set(num, arr);
    if (arr.length > FLOOD_LIMIT) {
      tempBlocked.set(num, now + 3600000);
      alertOwner(`🚫 ${num} ne 1 min me ${arr.length} message bheje (flood). 1 ghante ke liye ignore kar raha hoon.`);
      return true;
    }
    return false;
  }

  function wants(m, text) {
    const c = content(m);
    if (c.audioMessage || c.locationMessage || c.liveLocationMessage || c.videoMessage) return true;
    if (c.documentMessage && /pdf/i.test(c.documentMessage.mimetype || '')) return true;
    if (PUBLIC_CMDS && text) {
      const k = parseCmd(text);
      if (k && PUBLIC.has(k.cmd)) return true;
    }
    return false;
  }

  async function handle({ m, s, jid, num, text }) {
    const c = content(m);
    try {
      const k = parseCmd(text);
      if (k && PUBLIC_CMDS && PUBLIC.has(k.cmd)) {
        const r = await pub(k.cmd, k.arg, { m, s, jid, num });
        if (r) await sendReply(s, jid, r, m);
        return;
      }
      if (c.audioMessage) return await onAudio(m, s, jid, c.audioMessage);
      if (c.videoMessage) return await onDoc(m, s, jid, text, c.videoMessage, 'Video', true);
      if (c.documentMessage) return await onDoc(m, s, jid, text, c.documentMessage, 'PDF', false);
      const loc = c.locationMessage || c.liveLocationMessage;
      if (loc) return await sendReply(s, jid, await weatherAt(loc.degreesLatitude, loc.degreesLongitude, loc.name || 'Aapki location'), m);
    } catch (e) {
      log('plus handle error:', e.message);
      noteSent(await s.sendMessage(jid, { text: 'Maaf kijiye, ye abhi process nahi ho paya 🙏 Thodi der baad try kijiye.' }, { quoted: m }).catch(() => ({})));
    }
  }

  // ---------------------------------------------------------------- COMMANDS
  // public commands (sab use kar sakte hain). null = khud bhej diya, string = reply text
  async function pub(cmd, arg, meta) {
    const { s, jid, m } = meta;
    switch (cmd) {
      case 'tts':
      case 'speak':
        if (!arg) return 'Use: !tts aapka text';
        await sendVoice(jid, arg, m);
        return null;
      case 'tr': {
        const mm = arg.match(/^([^|]+)\|([\s\S]+)$/) || arg.match(/^(\S+)\s+([\s\S]+)$/);
        if (!mm) return 'Use: !tr hindi | Hello how are you';
        return (await ask1(`Translate to ${mm[1].trim()}. Output only the translation:\n${mm[2].trim()}`, 'You are a precise translator.')) || 'Translate nahi ho paya, thodi der baad try karo.';
      }
      case 'weather':
        return arg ? weatherCity(arg) : 'Use: !weather Delhi (ya apni location bhejo)';
      case 'calc': {
        const v = calc(arg);
        return v === null ? 'Use: !calc 25*4+10 (sirf + - * / % ( ) )' : `${arg} = ${v}`;
      }
      case 'joke':
        return (await ask1('Ek chhota, saaf-suthra mazedaar joke Hinglish me sunao.')) || 'Abhi joke nahi mil raha 😅 (thodi der baad try karo)';
      case 'sticker': {
        const im = pickImageMsg(m, jid);
        if (!im) return 'Photo bhejo caption "!sticker" ke saath (ya kisi photo ko reply karke !sticker likho).';
        const buf = await download(im, s);
        if (!buf) return 'Photo khul nahi payi.';
        noteSent(await s.sendMessage(jid, { sticker: await makeSticker(buf) }, { quoted: m }));
        return null;
      }
      case 'ocr': {
        const im = pickImageMsg(m, jid);
        if (!im) return 'Photo bhejo caption "!ocr" ke saath (ya photo ko reply karke !ocr).';
        const buf = await download(im, s);
        if (!buf) return 'Photo khul nahi payi.';
        const mime = content(im).imageMessage?.mimetype || 'image/jpeg';
        const r = await callGemini([{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: buf.toString('base64') } }, { text: 'Is photo me jo bhi text hai use as-it-is nikaal kar likho. Text na ho to batao.' }] }], 'You are an OCR tool.');
        return r.ok && r.text ? r.text : 'OCR nahi ho paya, thodi der baad try karo.';
      }
    }
    return undefined;
  }

  const PLUS_HELP = `*🎙 Plus Menu*

*Voice*
!say <text> – apne chat me voice
!sayto <number> <text>
!voice [naam] – awaaz (Kore, Puck, Charon...)
!tone <style> | reset – bolne ka andaaz
!mode text|voice|both [number]
!mirror on/off – voice aaye to voice me jawab
!tts <text> – sabke liye

*Calls*
!callmode ask|auto|off
Call aane par: 1 = approve, 2 = cancel
!approve [id] | !cancel [id]
!callvip add/del/list <number>
!callgreet <text> | reset
!calllog | !sessions | !endvoice [num|all]
!dnd 23:00-07:00 | off

*AI*
!persona [naam] | !lang hindi/english/auto
!kb add/del/list | !busy <wajah>|off
!welcome <text>|off | !summary [num]
!imagine <prompt> | !ocr | !tr | !joke

*Tools*
!weather <shehar> | !calc 2+2
!remind 30m | text | !remind list
!note <text> | !poll Q | a | b
!sticker (photo ke saath)

*Admin*
!stats | !report 22:00 | !bc num1,num2 | text
!read on/off | !typing on/off`;

  async function command(cmd, arg, meta) {
    const r = await pub(cmd, arg, meta);
    if (r !== undefined) return r;
    const { s, jid } = meta;
    const flag = (name, label) => {
      const v = /^(on|1|yes|true|chalu|haan|ha)$/i.test(arg) ? true : /^(off|0|no|false|band|nahi)$/i.test(arg) ? false : null;
      if (v === null) return `Use: !${cmd} on ya off`;
      settings[name] = v;
      saveSettings();
      return `${label} ${v ? 'ON ✅' : 'OFF ⛔'}`;
    };

    switch (cmd) {
      case 'plus':
      case 'help2':
        return PLUS_HELP;

      // ---- voice
      case 'say':
        if (!arg) return 'Use: !say text';
        await sendVoice(jid, arg);
        return null;
      case 'sayto': {
        const mm = arg.match(/^(\S+)\s+([\s\S]+)$/);
        if (!mm) return 'Use: !sayto 919876543210 text';
        await sendVoice(toJid(mm[1].replace(/\D/g, '')), mm[2]);
        return `Voice bhej di → ${mm[1]}`;
      }
      case 'voice': {
        if (!arg) return `Awaaz: ${voiceName()}\nOptions: ${VOICES.join(', ')}`;
        const v = VOICES.find((x) => x.toLowerCase() === arg.toLowerCase());
        if (!v) return 'Ye naam nahi mila. !voice likh kar list dekho.';
        settings.voice = v;
        saveSettings();
        await sendVoice(jid, 'Namaste! Ab main is awaaz me bolunga.').catch(() => {});
        return `Awaaz: ${v} ✅`;
      }
      case 'tone':
        if (!arg) return `Tone: ${settings.tone || 'normal'}`;
        if (arg.toLowerCase() === 'reset') delete settings.tone;
        else settings.tone = arg;
        saveSettings();
        return `Tone: ${settings.tone || 'normal'}`;
      case 'mode': {
        const mm = arg.match(/^(text|voice|both)\s*(\S*)$/i);
        if (!mm) return `Use: !mode text|voice|both [number]\nAbhi: ${settings.mode || env.REPLY_MODE || 'text'}`;
        if (mm[2]) settings.modes[mm[2].replace(/\D/g, '') || mm[2]] = mm[1].toLowerCase();
        else settings.mode = mm[1].toLowerCase();
        saveSettings();
        return `Reply mode ${mm[2] ? `(${mm[2]}) ` : ''}→ ${mm[1].toLowerCase()} ✅`;
      }
      case 'mirror':
        return flag('mirror', 'Voice ka jawab voice me');
      case 'read':
        return flag('readReceipts', 'Blue tick');
      case 'typing':
        return flag('humanDelay', 'Human typing delay');

      // ---- calls
      case 'callmode':
        if (!/^(ask|auto|off)$/i.test(arg)) return `Use: !callmode ask|auto|off\nAbhi: ${settings.callMode || 'ask'}\nask = approve poochega, auto = khud voice me baat, off = kuch nahi poochega (sirf call ke baad AI message)`;
        settings.callMode = arg.toLowerCase();
        saveSettings();
        return `Call mode: ${settings.callMode} ✅`;
      case 'approve':
      case 'cancel': {
        if (!arg && pending.size > 1) return `Ek se zyada calls pending: ${[...pending.keys()].join(', ')}\nLikho: !${cmd} <ID>`;
        const id = (arg || [...pending.keys()][0] || '').toUpperCase();
        if (!id || !(await resolveCall(id, cmd))) return 'Koi pending call nahi (ya ID galat / time khatam).';
        return cmd === 'approve' ? '✅ Approve ho gaya.' : '❌ Cancel ho gaya.';
      }
      case 'callvip': {
        const mm = arg.match(/^(add|del|list)\s*(\S*)$/i);
        if (!mm) return 'Use: !callvip add/del/list <number>';
        const n = mm[2].replace(/\D/g, '');
        if (/add/i.test(mm[1]) && n) settings.callVip = [...new Set([...settings.callVip, n])];
        if (/del/i.test(mm[1]) && n) settings.callVip = settings.callVip.filter((x) => x !== n);
        saveSettings();
        return `VIP (call auto-answer): ${settings.callVip.join(', ') || 'khali'}`;
      }
      case 'callgreet':
        if (!arg) return `Greeting: ${GREET()}`;
        if (arg.toLowerCase() === 'reset') delete settings.callGreet;
        else settings.callGreet = arg;
        saveSettings();
        return `Greeting: ${GREET()}`;
      case 'calllog':
        return callLog.length ? callLog.slice(-15).reverse().map((e) => `${hhmm(e.at)} ${e.video ? '📹' : '📞'} ${e.num} – ${e.result}`).join('\n') : 'Call log khali.';
      case 'sessions': {
        const u = [...new Set(sessions.values())];
        return u.length ? u.map((x) => `${x.num} – ${x.turns} jawab, ${Math.max(0, Math.round((x.until - Date.now()) / 60000))} min bache (${x.why})`).join('\n') : 'Koi voice chat nahi chal rahi.';
      }
      case 'endvoice': {
        const u = [...new Set(sessions.values())].filter((x) => !arg || arg === 'all' || x.ids.includes(arg.replace(/\D/g, '')));
        for (const x of u) await endSession(x);
        return u.length ? `${u.length} voice chat band ✅` : 'Koi voice chat nahi mili.';
      }
      case 'dnd': {
        const mm = arg.match(/^([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)$/);
        if (/^off$/i.test(arg)) delete settings.dnd;
        else if (mm) settings.dnd = { from: `${mm[1]}:${mm[2]}`, to: `${mm[3]}:${mm[4]}` };
        else return `Use: !dnd 23:00-07:00 ya !dnd off\nAbhi: ${settings.dnd ? settings.dnd.from + '-' + settings.dnd.to : 'off'}\n(Is time me approval nahi poochta, bot khud call sambhalta hai)`;
        saveSettings();
        return `DND: ${settings.dnd ? settings.dnd.from + '-' + settings.dnd.to : 'off'} ✅`;
      }

      // ---- AI
      case 'persona':
        if (!arg) return `Persona: ${settings.persona || 'default'}\nOptions: ${Object.keys(PERSONAS).join(', ')}, reset`;
        if (arg.toLowerCase() === 'reset') delete settings.persona;
        else if (PERSONAS[arg.toLowerCase()]) settings.persona = arg.toLowerCase();
        else return 'Ye persona nahi hai. !persona likh kar list dekho.';
        saveSettings();
        history.clear();
        return `Persona: ${settings.persona || 'default'} ✅`;
      case 'lang':
        if (!arg) return `Language: ${settings.lang || 'auto'} (hindi/english/hinglish/auto)`;
        settings.lang = arg.toLowerCase();
        saveSettings();
        return `Language: ${settings.lang} ✅`;
      case 'kb':
        return listMgr(settings.kb, 'Knowledge', arg, saveSettings);
      case 'busy':
        if (!arg) return `Busy: ${settings.busy || 'off'}`;
        if (/^off$/i.test(arg)) delete settings.busy;
        else settings.busy = arg;
        saveSettings();
        return `Busy: ${settings.busy || 'off'} ✅`;
      case 'welcome':
        if (!arg) return `Welcome: ${settings.welcome || 'off'}`;
        if (/^off$/i.test(arg)) delete settings.welcome;
        else settings.welcome = arg;
        saveSettings();
        return `Welcome: ${settings.welcome || 'off'} ✅ (sirf naye logon ko, ek baar)`;
      case 'summary': {
        const n = arg.replace(/\D/g, '');
        const key = n ? [...history.keys()].find((k) => k.includes(n)) : jid;
        const h = (history.get(key) || []).map((x) => `${x.role === 'user' ? 'User' : 'Bot'}: ${x.text}`).join('\n');
        return h ? (await ask1('Is chat ka Hinglish me short summary do:\n' + h)) || 'Summary nahi ban paya, thodi der baad try karo.' : 'Is chat ki history nahi mili.';
      }
      case 'imagine': {
        if (!arg) return 'Use: !imagine ek ladka cricket khelta hua, cartoon style';
        const im = await imagine(arg);
        // Baileys ko thumbnail ke liye sharp/jimp chahiye hota hai; hum ffmpeg se khud bana kar dete hain
        let thumb;
        try {
          thumb = await ff(['-i', 'pipe:0', '-frames:v', '1', '-vf', 'scale=100:-2', '-q:v', '8', '-f', 'mjpeg', 'pipe:1'], im.buf);
        } catch (e) {
          log('thumb fail:', e.message);
        }
        noteSent(await s.sendMessage(jid, { image: im.buf, caption: '🎨 ' + arg.slice(0, 100), ...(thumb ? { jpegThumbnail: thumb } : {}) }));
        return null;
      }

      // ---- tools
      case 'remind': {
        if (!arg || /^list$/i.test(arg)) return settings.reminders.length ? settings.reminders.map((r, i) => `${i + 1}) ${hhmm(r.at)} – ${r.text}`).join('\n') : 'Koi reminder nahi. Use: !remind 30m | chai peeni hai';
        const d = arg.match(/^del\s+(\d+)$/i);
        if (d) {
          settings.reminders.splice(parseInt(d[1], 10) - 1, 1);
          saveSettings();
          return 'Reminder hata diya ✅';
        }
        const mm = arg.match(/^([^|]+)\|([\s\S]+)$/);
        const ms = mm && parseWhen(mm[1]);
        if (!ms) return 'Use: !remind 30m | text   ya   !remind 18:30 | text   (s/m/h/d)';
        settings.reminders.push({ at: Date.now() + ms, text: mm[2].trim(), jid });
        saveSettings();
        return `⏰ Theek hai, ${hhmm(Date.now() + ms)} par yaad dilaunga.`;
      }
      case 'note':
      case 'notes':
        return listMgr(settings.notes, 'Notes', arg, saveSettings, true);
      case 'poll': {
        const parts = arg.split('|').map((x) => x.trim()).filter(Boolean);
        if (parts.length < 3) return 'Use: !poll Sawal | option1 | option2 | option3';
        noteSent(await s.sendMessage(jid, { poll: { name: parts[0], values: parts.slice(1, 13), selectableCount: 1 } }));
        return null;
      }

      // ---- admin
      case 'stats':
        return statsText();
      case 'report':
        if (/^off$/i.test(arg)) delete settings.report;
        else if (/^([01]?\d|2[0-3]):([0-5]\d)$/.test(arg)) settings.report = arg;
        else return `Use: !report 22:00 ya !report off\nAbhi: ${settings.report || 'off'}`;
        saveSettings();
        return `Daily report: ${settings.report || 'off'} ✅`;
      case 'bc': {
        const mm = arg.match(/^([^|]+)\|([\s\S]+)$/);
        if (!mm) return 'Use: !bc 9198..,9199.. | message   ya   !bc all | message';
        let list = /^all$/i.test(mm[1].trim()) ? Object.keys(contacts).filter((k) => /^\d{8,15}$/.test(k) && contacts[k].pn === true) : numList(mm[1]); // LID wale (phone number pata nahi) skip
        list = [...new Set(list)].filter((n) => !ctx.getBlocked().includes(n)).slice(0, BC_MAX);
        if (!list.length) return 'Koi number nahi mila.';
        (async () => {
          for (const n of list) {
            try {
              noteSent(await s.sendMessage(toJid(n), { text: mm[2].trim() }));
            } catch (e) {
              log('bc fail', n, e.message);
            }
            await sleep(4000 + Math.random() * 3000);
          }
          alertOwner(`📢 Broadcast poora hua (${list.length} logon ko).`);
        })();
        return `📢 ${list.length} logon ko bhej raha hoon (har ek ke beech gap). Zyada logon ko bhejna ban-risk badhata hai.`;
      }
    }
    return undefined;
  }

  function statsText() {
    const d = today();
    const x = stats.date === d ? stats : {};
    return `📊 Aaj (${d})\nMessages: ${x.msgs || 0}\nVoice aaye: ${x.voiceIn || 0} | Voice bheje: ${x.voiceOut || 0}\nCalls: ${x.calls || 0} | Approve: ${x.approved || 0} | Cancel: ${x.cancelled || 0} | Auto: ${x.auto || 0} | Timeout/miss: ${x.missed || 0} | Reject fail: ${x.rejectFail || 0}\nVoice chats: ${x.sessions || 0}`;
  }

  // ---------------------------------------------------------------- BACKGROUND TICK
  async function tickPlus() {
    try {
      const now = Date.now();
      for (const x of new Set(sessions.values())) if (now > x.until) await endSession(x);
      if (connected()) {
        const due = settings.reminders.filter((r) => r.at <= now);
        if (due.length) {
          settings.reminders = settings.reminders.filter((r) => r.at > now);
          saveSettings();
          for (const r of due) {
            const late = now - r.at > 120000 ? ' (der se, bot band tha)' : '';
            try {
              noteSent(await withTimeout(S().sendMessage(r.jid || ownerJid(), { text: `⏰ Reminder${late}: ${r.text}` }), 30000, 'reminder'));
            } catch (e) {
              log('reminder fail:', e.message);
              settings.reminders.push({ ...r, at: now + 60000 }); // 1 min baad dobara
              saveSettings();
            }
          }
        }
        if (settings.report) {
          const n = ctx.nowParts();
          const [h, mi] = settings.report.split(':').map(Number);
          if (stats.reportedDate !== n.date && n.hh * 60 + n.mm >= h * 60 + mi) {
            bump('reports');
            stats.reportedDate = n.date;
            await alertOwner('Daily report\n' + statsText());
          }
        }
      }
      // memory safai
      for (const [k, v] of tempBlocked) if (v < now) tempBlocked.delete(k);
      for (const [k, v] of floodMap) if (!v.some((t) => now - t < 60000)) floodMap.delete(k);
      for (const [k, v] of recentCalls) if (now - v.at > 3600000) recentCalls.delete(k);
      for (const [k, v] of lastFollow) if (now - v > 3600000) lastFollow.delete(k);
      flush();
    } catch (e) {
      log('plus tick:', e.message);
    }
  }
  // force=true: band hote waqt turant sab likho
  function flush(force) {
    if (dirty.stats) writeJson(STATS_FILE, stats);
    if (dirty.contacts) writeJson(CONTACTS_FILE, contacts);
    if (dirty.calls) writeJson(CALLLOG_FILE, callLog);
    dirty = { stats: false, contacts: false, calls: false };
    // history: har 60 sec me (ya band hote waqt) sirf badli ho to; purani chats chhodi jati hain
    if (!ctx.HISTORY_SAVE) return;
    if (!force && Date.now() - lastHistWrite < 60000) return;
    lastHistWrite = Date.now();
    const keep = Date.now() - ctx.HISTORY_KEEP_HOURS * 3600000;
    const out = {};
    for (const [k, v] of history) if ((histAt.get(k) || Date.now()) >= keep) out[k] = v;
    const h = JSON.stringify(out);
    if (h !== lastHist) {
      lastHist = h;
      writeJson(HIST_FILE, out);
    }
  }
  setInterval(tickPlus, 15000);

  // ---------------------------------------------------------------- WEB PANEL  (/plus)
  function routes(app, auth, page) {
    app.get('/plus', auth, (req, res) => {
      const say = String(req.query.say || '').slice(0, 400);
      const voice = VOICES.includes(req.query.voice) ? req.query.voice : voiceName();
      const pend = [...pending.values()].map((p) => `<div class="sch"><b>${p.entry.video ? '📹' : '📞'} ${esc(p.entry.num)}</b>
        <div class="row" style="margin-top:8px"><form method="POST" action="/plus/approve/${p.id}">${CSRF}<button class="sm">✅ Approve</button></form>
        <form method="POST" action="/plus/cancel/${p.id}">${CSRF}<button class="sm red">❌ Cancel</button></form></div></div>`).join('') || '<p class="muted">Koi call approval pending nahi.</p>';
      const sess = [...new Set(sessions.values())].map((x) => `<div class="row sch"><span>🎙 ${esc(x.num)} · ${x.turns} jawab</span><form method="POST" action="/plus/end/${esc(x.num)}">${CSRF}<button class="sm gray">Band</button></form></div>`).join('') || '<p class="muted">Koi voice chat nahi.</p>';
      const calls = callLog.slice(-8).reverse().map((e) => `<div class="sch"><small>${hhmm(e.at)}</small> ${e.video ? '📹' : '📞'} ${esc(e.num)}<br><small>${esc(e.result)}</small></div>`).join('') || '<p class="muted">Khali.</p>';
      const inbox = !VOICE_INBOX ? '<p class="muted">Voice inbox band hai (privacy). Chalu karne ke liye <b>VOICE_INBOX=true</b> variable daalo.</p>' : voiceInbox.slice(-8).reverse().map((v) => `<div class="sch"><small>${v.dir === 'in' ? '⬇️ aaya' : '⬆️ gaya'} · ${esc(v.num)} · ${hhmm(v.at)}</small>${v.text ? `<br><small>${esc(v.text.slice(0, 80))}</small>` : ''}<br><audio controls preload="none" style="width:100%" src="/plus/audio/${v.id}"></audio></div>`).join('') || '<p class="muted">Abhi koi voice nahi.</p>';
      const opts = VOICES.map((v) => `<option${v === voice ? ' selected' : ''}>${v}</option>`).join('');
      const body = `<div class="card"><h2>🎙 Voice & Calls</h2><p class="muted">Call mode: <b>${esc(settings.callMode || 'ask')}</b> · Reply mode: <b>${esc(settings.mode || env.REPLY_MODE || 'text')}</b> · Awaaz: <b>${esc(voiceName())}</b></p><a href="/"><button class="gray">⬅️ Home</button></a></div>
      <div class="card"><h3>📞 Call approval</h3>${pend}</div>
      <div class="card"><h3>Chalti voice chats</h3>${sess}</div>
      <div class="card"><h3>🔊 Awaaz suno (test)</h3><form method="GET" action="/plus"><textarea name="say" rows="3" style="width:100%;font-size:16px;padding:8px" placeholder="Kuch likho, main bolunga...">${esc(say)}</textarea><select name="voice" style="width:100%;font-size:16px;padding:8px;margin-top:6px">${opts}</select><button>Bolo ▶️</button></form>
      ${say ? `<audio controls autoplay style="width:100%;margin-top:10px" src="/plus/tts.wav?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(say)}"></audio>` : ''}</div>
      <div class="card"><h3>🎧 Voice inbox</h3>${inbox}</div>
      <div class="card"><h3>Call log</h3>${calls}</div>
      <div class="card"><h3>Aaj ke stats</h3><pre style="white-space:pre-wrap;margin:0;font:inherit">${esc(statsText())}</pre></div>`;
      res.send(page(body, pending.size > 0 && !say));
    });
    app.post('/plus/approve/:id', auth, async (req, res) => {
      await resolveCall(req.params.id, 'approve').catch((e) => log('approve:', e.message));
      res.redirect('/plus');
    });
    app.post('/plus/cancel/:id', auth, async (req, res) => {
      await resolveCall(req.params.id, 'cancel').catch(() => {});
      res.redirect('/plus');
    });
    app.post('/plus/end/:num', auth, async (req, res) => {
      for (const x of new Set(sessions.values())) if (x.ids.includes(req.params.num)) await endSession(x);
      res.redirect('/plus');
    });
    app.get('/plus/tts.wav', auth, async (req, res) => {
      try {
        const voice = VOICES.includes(req.query.voice) ? req.query.voice : voiceName();
        const text = clip(speakable(String(req.query.text || '')), 500);
        if (!text) return res.status(400).send('text khali');
        res.type('audio/wav').send(wav(await ttsPcm(text, voice, settings.tone)));
      } catch (e) {
        res.status(500).send('TTS error: ' + e.message);
      }
    });
    app.get('/plus/audio/:id', auth, (req, res) => {
      if (!VOICE_INBOX) return res.status(404).send('voice inbox band hai');
      const v = voiceInbox.find((x) => x.id === parseInt(req.params.id, 10));
      if (!v) return res.status(404).send('nahi mila');
      res.type('audio/ogg').send(v.buf);
    });
  }

  return { pre, wants, handle, sendReply, extraSystem, deliver, command, onCallOffer, onCallAccepted, onCallEnd, flush, routes, _t: { wav, calc, parseWhen, speakable, inDnd, splitForVoice, _calls: { pending, callLog, recentCalls } } };
};
