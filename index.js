'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const baileys = require('@whiskeysockets/baileys');

const makeWASocket = baileys.default || baileys.makeWASocket;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = baileys;

// =====================================================================
//  CONFIG  (sab kuch Railway > Variables se control hota hai)
// =====================================================================
const env = process.env;
const PORT = env.PORT || 3000;
const GEMINI_API_KEY = env.GEMINI_API_KEY || '';
const ENV_MODEL = env.GEMINI_MODEL || 'gemini-2.5-flash';
let GEMINI_MODEL = ENV_MODEL;
const PHONE = (env.PHONE_NUMBER || '').replace(/\D/g, '');
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || '';
const ENV_GROUPS = env.REPLY_IN_GROUPS === 'true';
let REPLY_IN_GROUPS = ENV_GROUPS;
const ENV_PROMPT =
  env.SYSTEM_PROMPT ||
  'You are a friendly, helpful WhatsApp assistant. Reply in the same language the user writes in (Hindi, English or Hinglish). Keep replies short and clear.';
let SYSTEM_PROMPT = ENV_PROMPT;
const CMD_PREFIXES = ['!', '/'];

const DATA_DIR = env.DATA_DIR || (fs.existsSync('/data') ? '/data' : '.');
const AUTH_DIR = env.AUTH_DIR || path.join(DATA_DIR, 'auth');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const SENT_FILE = path.join(DATA_DIR, 'sent.json');

// Advance variables
const validTz = (z) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: z });
    return true;
  } catch (e) {
    return false;
  }
};
const ENV_TZ = validTz(env.TIMEZONE || 'Asia/Kolkata') ? env.TIMEZONE || 'Asia/Kolkata' : 'Asia/Kolkata';
let TZ = ENV_TZ;
const HISTORY_LIMIT = Math.max(2, parseInt(env.HISTORY_LIMIT, 10) || 12);
const CATCHUP_MIN = Math.max(0, parseInt(env.SCHEDULE_CATCHUP_MIN, 10) || 10);
const SEND_DELAY_MS = Math.max(1000, parseInt(env.SEND_DELAY_MS, 10) || 3000);
const MAX_MSG_AGE_SEC = 120; // purane (offline) messages ko reply nahi dena

const numList = (v) =>
  (v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.includes('@') ? s : s.replace(/\D/g, '')))
    .filter(Boolean);
const ENV_ALLOWED = numList(env.ALLOWED_NUMBERS); // khali = sabko reply
const ENV_BLOCKED = numList(env.BLOCKED_NUMBERS);
const ENV_TARGETS = numList(env.SCHEDULE_TARGETS);
let ALLOWED = ENV_ALLOWED;
let BLOCKED = ENV_BLOCKED;
let DEFAULT_TARGETS = ENV_TARGETS;
// Jin numbers se WhatsApp par bot ko control kiya ja sakta hai (apna "Message yourself" chat hamesha chalta hai)
const OWNERS = numList(env.OWNER_NUMBERS || env.OWNER_NUMBER);

const logger = pino({ level: 'silent' });
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// =====================================================================
//  PERSISTENT SETTINGS (panel se on/off kiye gaye toggles)
// =====================================================================
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}
function writeJson(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
  } catch (e) {
    log('write error', file, e.message);
  }
}

const settings = Object.assign(
  { autoReply: env.AUTO_REPLY !== 'false', schedulerOn: env.SCHEDULER !== 'off', dyn: [], disabled: [] },
  readJson(SETTINGS_FILE, {})
);
const sent = readJson(SENT_FILE, {}); // "YYYY-MM-DD|id|HH:MM" -> true
const saveSettings = () => writeJson(SETTINGS_FILE, settings);
const saveSent = () => writeJson(SENT_FILE, sent);

// =====================================================================
//  STATE
// =====================================================================
let sock = null;
let status = 'starting'; // starting | waiting | pairing | connected
let pairingCode = null;
const history = new Map(); // jid -> [{role, text}]
const queues = new Map(); // jid -> Promise (ek chat ke messages ek-ek karke)

// =====================================================================
//  GEMINI
// =====================================================================
async function callGemini(contents, system) {
  if (!GEMINI_API_KEY) return { ok: false, text: 'GEMINI_API_KEY set nahi hai.' };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const body = { contents };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      log('Gemini error:', JSON.stringify(data).slice(0, 300));
      return { ok: false, text: 'Abhi jawab nahi de pa raha, thodi der baad try karo.' };
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('').trim();
    return { ok: true, text };
  } catch (e) {
    log('Gemini exception:', e.message);
    return { ok: false, text: 'Network problem hai, thodi der baad try karo.' };
  }
}

async function askGemini(jid, userText) {
  const h = history.get(jid) || [];
  h.push({ role: 'user', text: userText });
  // history hamesha 'user' se shuru honi chahiye (warna Gemini error de sakta hai)
  while (h.length > HISTORY_LIMIT || (h.length && h[0].role !== 'user')) h.shift();

  const r = await callGemini(
    h.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    SYSTEM_PROMPT
  );
  if (!r.ok) {
    h.pop();
    history.set(jid, h);
    return r.text;
  }
  const reply = r.text || 'Mujhe samajh nahi aaya, dobara likho.';
  h.push({ role: 'model', text: reply });
  history.set(jid, h);
  return reply;
}

// =====================================================================
//  SCHEDULER  (SCHEDULE_1, SCHEDULE_2 ... variables)
//  Format:  HH:MM | message | numbers(optional) | days(optional)
// =====================================================================
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function parseDays(s) {
  s = (s || '').toLowerCase().trim();
  if (!s || s === 'all' || s === 'daily') return DAY_KEYS.slice();
  if (s === 'weekdays') return DAY_KEYS.slice(0, 5);
  if (s === 'weekend' || s === 'weekends') return ['sat', 'sun'];
  return s
    .split(/[\s,]+/)
    .map((d) => d.slice(0, 3))
    .filter((d) => DAY_KEYS.includes(d));
}

function parseTimes(s) {
  const out = [];
  for (const part of (s || '').split(',')) {
    const m = part.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    const hh = String(m[1]).padStart(2, '0');
    out.push({ label: `${hh}:${m[2]}`, min: parseInt(m[1], 10) * 60 + parseInt(m[2], 10) });
  }
  return out.length ? out : null;
}

function parseSchedule(id, rawLine, quiet) {
  const parts = String(rawLine).split('|').map((x) => x.trim());
  const times = parseTimes(parts[0]);
  const message = parts[1] || '';
  const days = parseDays(parts[3]);
  if (!times || !message || !days.length) {
    if (!quiet) log(`${id} galat format, skip kiya. Sahi format: 06:00 | Good morning | 919876543210 | all`);
    return null;
  }
  let targets = numList(parts[2]);
  if (parts[2] && parts[2].toLowerCase() === 'self') targets = [];
  if (!targets.length) targets = DEFAULT_TARGETS.length ? DEFAULT_TARGETS : PHONE ? [PHONE] : [];
  return { id, times, message, days, targets, source: id.startsWith('W') ? 'chat' : 'env' };
}

let SCHEDULES = [];
function rebuildSchedules() {
  const keys = Object.keys(env)
    .filter((k) => /^SCHEDULE_\d+$/.test(k))
    .sort((a, b) => parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10));
  const list = [];
  for (const k of keys) {
    const sch = parseSchedule(k, env[k]);
    if (sch) list.push(sch);
  }
  for (const d of settings.dyn || []) {
    const sch = parseSchedule(d.id, d.raw, true);
    if (sch) list.push(sch);
  }
  SCHEDULES = list;
}

function applySettings() {
  SYSTEM_PROMPT = settings.prompt || ENV_PROMPT;
  GEMINI_MODEL = settings.model || ENV_MODEL;
  REPLY_IN_GROUPS = settings.groups ?? ENV_GROUPS;
  ALLOWED = settings.allowed ?? ENV_ALLOWED;
  BLOCKED = settings.blocked ?? ENV_BLOCKED;
  DEFAULT_TARGETS = settings.targets ?? ENV_TARGETS;
  TZ = settings.tz && validTz(settings.tz) ? settings.tz : ENV_TZ;
  rebuildSchedules();
}

function nowParts() {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const p = {};
  for (const x of f.formatToParts(new Date())) p[x.type] = x.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hh: parseInt(p.hour, 10),
    mm: parseInt(p.minute, 10),
    day: p.weekday.toLowerCase().slice(0, 3),
  };
}

function toJid(t) {
  return t.includes('@') ? t : `${t}@s.whatsapp.net`;
}

async function buildMessage(sch) {
  const d = new Date();
  const fill = (s) =>
    s
      .replace(/\{date\}/gi, d.toLocaleDateString('en-IN', { timeZone: TZ, dateStyle: 'full' }))
      .replace(/\{day\}/gi, d.toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'long' }))
      .replace(/\{time\}/gi, d.toLocaleTimeString('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }));
  const msg = fill(sch.message);
  // "ai:" se shuru ho to Gemini har baar naya message likhega
  if (/^ai:/i.test(msg)) {
    const r = await callGemini(
      [{ role: 'user', parts: [{ text: msg.replace(/^ai:/i, '').trim() }] }],
      SYSTEM_PROMPT + ' Write only the final WhatsApp message text, nothing else.'
    );
    if (r.ok && r.text) return r.text;
    log(`${sch.id}: AI message fail hua, skip`);
    return null;
  }
  return msg;
}

async function runSchedule(sch) {
  if (!sock || status !== 'connected') return false;
  const text = await buildMessage(sch);
  if (!text) return false;
  if (!sch.targets.length) {
    log(`${sch.id}: koi target nahi (PHONE_NUMBER ya SCHEDULE_TARGETS set karo)`);
    return false;
  }
  for (const t of sch.targets) {
    try {
      noteSent(await sock.sendMessage(toJid(t), { text }));
      log(`${sch.id}: sent to ${t}`);
    } catch (e) {
      log(`${sch.id}: send fail ${t}:`, e.message);
    }
    await sleep(SEND_DELAY_MS + Math.random() * 2000); // ban risk kam karne ke liye gap
  }
  return true;
}

let ticking = false;
async function tick() {
  if (ticking || status !== 'connected' || !settings.schedulerOn || !SCHEDULES.length) return;
  ticking = true;
  try {
    const n = nowParts();
    const nowMin = n.hh * 60 + n.mm;
    for (const k of Object.keys(sent)) if (!k.startsWith(n.date)) delete sent[k];
    for (const sch of SCHEDULES) {
      if (!sch.days.includes(n.day) || settings.disabled.includes(sch.id)) continue;
      for (const t of sch.times) {
        const key = `${n.date}|${sch.id}|${t.label}`;
        if (sent[key]) continue;
        const diff = nowMin - t.min;
        if (diff < 0 || diff > CATCHUP_MIN) continue; // time nahi hua ya bahut late ho gaya
        sent[key] = true;
        saveSent();
        await runSchedule(sch);
      }
    }
  } catch (e) {
    log('scheduler error:', e.message);
  } finally {
    ticking = false;
  }
}
setInterval(tick, 15000);

// =====================================================================
//  WHATSAPP
// =====================================================================
function wipeAuth() {
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch (e) {
    log('wipeAuth error:', e.message);
  }
}

const jidNum = (jid) => String(jid || '').split('@')[0].split(':')[0];
const msgAge = (ts) => {
  const t = ts && typeof ts === 'object' && ts.toNumber ? ts.toNumber() : Number(ts);
  return t ? Date.now() / 1000 - t : 0;
};

function enqueue(jid, fn) {
  const prev = queues.get(jid) || Promise.resolve();
  const next = prev.then(fn).catch((e) => log('queue error:', e.message));
  queues.set(jid, next);
  next.finally(() => {
    if (queues.get(jid) === next) queues.delete(jid);
  });
}

async function startSock() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch (e) {
    log('version fetch failed, default use hoga');
  }

  const s = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  sock = s;
  let codeRequested = false;

  s.ev.on('creds.update', saveCreds);

  s.ev.on('connection.update', async (u) => {
    if (s !== sock) return; // purana socket, ignore
    const { connection, lastDisconnect, qr } = u;

    if (qr && !s.authState.creds.registered) {
      if (!PHONE) {
        status = 'waiting';
        pairingCode = null;
      } else if (!codeRequested) {
        codeRequested = true;
        try {
          pairingCode = await s.requestPairingCode(PHONE);
          status = 'pairing';
          log('Pairing code ready');
        } catch (e) {
          codeRequested = false;
          log('Pairing code error:', e.message);
        }
      }
    }

    if (connection === 'open') {
      status = 'connected';
      pairingCode = null;
      log('WhatsApp connected');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      log('Connection closed, code:', code);
      pairingCode = null;
      status = 'starting';
      if (code === DisconnectReason.loggedOut) wipeAuth();
      // connectionReplaced: kisi aur jagah same session chal raha hai -> thoda ruko
      const wait = code === DisconnectReason.connectionReplaced ? 15000 : 3000;
      sock = null;
      setTimeout(() => startSock().catch((e) => log('restart error:', e.message)), wait);
    }
  });

  s.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const m of messages) {
      try {
        if (!m.message) continue;
        const jid = m.key.remoteJid;
        if (!jid || jid === 'status@broadcast') continue;
        if (msgAge(m.messageTimestamp) > MAX_MSG_AGE_SEC) continue;
        if (m.key.id && botSent.has(m.key.id)) continue; // bot ka apna bheja hua

        const num = jidNum(m.key.remoteJidAlt || jid);
        const text = getText(m).trim();
        const selfChat = m.key.fromMe && isSelfChat(s, jid);
        if (type === 'append' && !selfChat) continue;

        // ---- WhatsApp se control (commands) ----
        const isCmd = CMD_PREFIXES.some((p) => text.startsWith(p));
        const fromOwner = !m.key.fromMe && !jid.endsWith('@g.us') && OWNERS.includes(num);
        if (isCmd && (selfChat || fromOwner)) {
          enqueue(jid, async () => {
            let out;
            try {
              out = await handleCommand(text.slice(1).trim());
            } catch (e) {
              out = 'Error: ' + e.message;
            }
            noteSent(await s.sendMessage(jid, { text: '🤖 ' + out }));
          });
          continue;
        }

        // ---- normal AI reply ----
        if (!settings.autoReply) continue;
        if (m.key.fromMe) continue;
        if (jid.endsWith('@g.us') && !REPLY_IN_GROUPS) continue;
        if (BLOCKED.includes(num) || BLOCKED.includes(jid)) continue;
        if (ALLOWED.length && !ALLOWED.includes(num) && !ALLOWED.includes(jid)) continue;
        if (!text) continue;

        enqueue(jid, async () => {
          await s.sendPresenceUpdate('composing', jid).catch(() => {});
          const reply = await askGemini(jid, text);
          noteSent(await s.sendMessage(jid, { text: reply }, { quoted: m }));
        });
      } catch (e) {
        log('message error:', e.message);
      }
    }
  });
}

// =====================================================================
//  WHATSAPP CONTROL COMMANDS  (!help likh kar dekho)
// =====================================================================
const botSent = new Set();
function noteSent(r) {
  const id = r?.key?.id;
  if (!id) return;
  botSent.add(id);
  if (botSent.size > 500) botSent.delete(botSent.values().next().value);
}

function getText(m) {
  const c = baileys.normalizeMessageContent ? baileys.normalizeMessageContent(m.message) : m.message;
  return c?.conversation || c?.extendedTextMessage?.text || c?.imageMessage?.caption || c?.videoMessage?.caption || '';
}

function isSelfChat(s, jid) {
  const mine = [jidNum(s.user?.id), jidNum(s.user?.lid), PHONE].filter(Boolean);
  return mine.includes(jidNum(jid));
}

const normNum = (x) => (String(x).includes('@') ? String(x).trim() : String(x).replace(/\D/g, ''));
const onoff = (v) =>
  /^(on|1|yes|true|chalu|haan|ha)$/i.test(v) ? true : /^(off|0|no|false|band|nahi)$/i.test(v) ? false : null;
const short = (t, n = 60) => (t.length > n ? t.slice(0, n) + '…' : t);

const HELP = `*Bot Control Menu*
Commands ! ya / se shuru karo.

*Status*
!status – bot ka haal
!help – ye menu

*Reply*
!reply on/off – AI auto reply
!groups on/off – groups me reply
!prompt – dekho | !prompt <text> – naya | !prompt reset
!model <naam> | !model reset
!clear – chat history saaf

*Numbers*
!allow add/del/list/clear/reset <number>
!block add/del/list/clear/reset <number>

*Schedule*
!schedules – list
!add 06:00 | Good morning | numbers | days
!del N – chat wala schedule hatao
!off N / !on N – pause / chalu
!test N – abhi bhejo
!scheduler on/off – sab schedule
!targets <n1,n2> | !targets reset
!tz Asia/Kolkata

*Baaki*
!send <number> <message>
!restart – bot restart`;

function fmtSchedules() {
  if (!SCHEDULES.length) return 'Koi schedule nahi. Naya: !add 06:00 | Good morning';
  return SCHEDULES.map((x, i) => {
    const off = settings.disabled.includes(x.id) ? '⏸' : '✅';
    const days = x.days.length === 7 ? 'roz' : x.days.join(',');
    return `${i + 1}) ${off} ${x.times.map((t) => t.label).join(',')} (${days}) [${x.source}]\n   ${short(x.message)}\n   To: ${x.targets.join(', ') || '-'}`;
  }).join('\n');
}

function listCmd(key, label, arg) {
  const envList = key === 'allowed' ? ENV_ALLOWED : ENV_BLOCKED;
  const cur = (settings[key] ?? envList).slice();
  const m = arg.match(/^(\S+)\s*([\s\S]*)$/);
  const sub = (m ? m[1] : 'list').toLowerCase();
  const val = normNum(m ? m[2] : '');
  if (sub === 'list') return `${label}: ${cur.length ? cur.join(', ') : 'khali'}`;
  if (sub === 'clear') settings[key] = [];
  else if (sub === 'reset') delete settings[key];
  else if (sub === 'add' && val) settings[key] = [...new Set([...cur, val])];
  else if ((sub === 'del' || sub === 'remove') && val) settings[key] = cur.filter((x) => x !== val);
  else return `Use: !${key === 'allowed' ? 'allow' : 'block'} add/del/list/clear/reset <number>`;
  saveSettings();
  applySettings();
  return `${label}: ${(settings[key] ?? envList).join(', ') || 'khali'}`;
}

async function handleCommand(body) {
  const m = body.match(/^(\S+)\s*([\s\S]*)$/);
  if (!m) return HELP;
  const cmd = m[1].toLowerCase();
  const arg = (m[2] || '').trim();

  switch (cmd) {
    case 'help':
    case 'menu':
    case 'h':
      return HELP;

    case 'status': {
      const n = nowParts();
      return `Status: ${status}
Time: ${n.date} ${String(n.hh).padStart(2, '0')}:${String(n.mm).padStart(2, '0')} (${TZ})
Auto reply: ${settings.autoReply ? 'ON' : 'OFF'} | Groups: ${REPLY_IN_GROUPS ? 'ON' : 'OFF'}
Scheduler: ${settings.schedulerOn ? 'ON' : 'OFF'} | Schedules: ${SCHEDULES.length}
Model: ${GEMINI_MODEL}
Allowed: ${ALLOWED.length || 'sab'} | Blocked: ${BLOCKED.length}`;
    }

    case 'reply': {
      const v = onoff(arg);
      if (v === null) return 'Use: !reply on ya !reply off';
      settings.autoReply = v;
      saveSettings();
      return `Auto reply ${v ? 'ON ✅' : 'OFF ⛔'}`;
    }

    case 'scheduler': {
      const v = onoff(arg);
      if (v === null) return 'Use: !scheduler on ya !scheduler off';
      settings.schedulerOn = v;
      saveSettings();
      return `Scheduler ${v ? 'ON ✅' : 'OFF ⛔'}`;
    }

    case 'groups': {
      const v = onoff(arg);
      if (v === null) return 'Use: !groups on ya !groups off';
      settings.groups = v;
      saveSettings();
      applySettings();
      return `Group reply ${v ? 'ON ✅' : 'OFF ⛔'}`;
    }

    case 'prompt':
      if (!arg) return `Prompt:\n${SYSTEM_PROMPT}`;
      if (arg.toLowerCase() === 'reset') delete settings.prompt;
      else settings.prompt = arg;
      saveSettings();
      applySettings();
      history.clear();
      return `Prompt update ho gaya:\n${SYSTEM_PROMPT}`;

    case 'model':
      if (!arg) return `Model: ${GEMINI_MODEL}`;
      if (arg.toLowerCase() === 'reset') delete settings.model;
      else settings.model = arg;
      saveSettings();
      applySettings();
      return `Model: ${GEMINI_MODEL}`;

    case 'clear':
      history.clear();
      return 'Chat history saaf ✅';

    case 'allow':
      return listCmd('allowed', 'Allowed', arg);
    case 'block':
      return listCmd('blocked', 'Blocked', arg);

    case 'targets':
      if (!arg) return `Targets: ${DEFAULT_TARGETS.join(', ') || 'bot ka apna number'}`;
      if (arg.toLowerCase() === 'reset') delete settings.targets;
      else settings.targets = numList(arg);
      saveSettings();
      applySettings();
      return `Targets: ${DEFAULT_TARGETS.join(', ') || 'bot ka apna number'}`;

    case 'tz':
    case 'timezone':
      if (!arg) return `Timezone: ${TZ}`;
      if (arg.toLowerCase() === 'reset') delete settings.tz;
      else if (validTz(arg)) settings.tz = arg;
      else return 'Timezone galat hai. Example: Asia/Kolkata';
      saveSettings();
      applySettings();
      return `Timezone: ${TZ}`;

    case 'schedules':
    case 'list':
      return fmtSchedules();

    case 'add': {
      if (!arg) return 'Use: !add 06:00 | Good morning | numbers(optional) | days(optional)';
      settings.seq = (settings.seq || 0) + 1;
      const id = 'W' + settings.seq;
      if (!parseSchedule(id, arg, true)) return 'Format galat. Example: !add 06:00 | Good morning ☀️ | all | mon,tue';
      settings.dyn.push({ id, raw: arg });
      saveSettings();
      applySettings();
      return `Schedule add ho gaya ✅\n\n${fmtSchedules()}`;
    }

    case 'del':
    case 'delete': {
      const sch = SCHEDULES[parseInt(arg, 10) - 1];
      if (!sch) return 'Number galat. !schedules se dekho.';
      if (sch.source !== 'chat') return 'Ye Railway variable wala hai, delete nahi hoga. Band karne ke liye: !off ' + arg;
      settings.dyn = settings.dyn.filter((d) => d.id !== sch.id);
      settings.disabled = settings.disabled.filter((d) => d !== sch.id);
      saveSettings();
      applySettings();
      return `Delete ho gaya ✅\n\n${fmtSchedules()}`;
    }

    case 'on':
    case 'off': {
      const sch = SCHEDULES[parseInt(arg, 10) - 1];
      if (!sch) return `Use: !${cmd} N (N = schedule number, !schedules se dekho)`;
      settings.disabled = settings.disabled.filter((d) => d !== sch.id);
      if (cmd === 'off') settings.disabled.push(sch.id);
      saveSettings();
      return fmtSchedules();
    }

    case 'test': {
      const sch = SCHEDULES[parseInt(arg, 10) - 1];
      if (!sch) return 'Use: !test N';
      runSchedule(sch).catch((e) => log('test error:', e.message));
      return 'Bhej raha hoon...';
    }

    case 'send': {
      const mm = arg.match(/^(\S+)\s+([\s\S]+)$/);
      if (!mm) return 'Use: !send 919876543210 Hello';
      const t = normNum(mm[1]);
      if (!t) return 'Number galat hai.';
      if (!sock || status !== 'connected') return 'WhatsApp connected nahi hai.';
      noteSent(await sock.sendMessage(toJid(t), { text: mm[2] }));
      return `Bhej diya → ${t}`;
    }

    case 'restart':
      setTimeout(() => process.exit(1), 1500); // Railway apne aap dobara chalu kar deta hai
      return 'Restart ho raha hai, 20-30 sec me wapas aata hoon...';

    default:
      return `"${cmd}" command nahi mila. !help likho.`;
  }
}

// =====================================================================
//  WEB PANEL (mobile friendly)
// =====================================================================
const app = express();
app.use(express.urlencoded({ extended: false }));

app.get('/health', (req, res) => res.status(200).send('ok'));

function auth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).send('ADMIN_PASSWORD variable set karo (Railway > Variables).');
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString();
    const pass = decoded.slice(decoded.indexOf(':') + 1);
    if (pass === ADMIN_PASSWORD) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).send('Password chahiye');
}

function page(body, refresh) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${refresh ? '<meta http-equiv="refresh" content="5">' : ''}
<title>WhatsApp Bot</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f3f4f6;color:#111}
.wrap{max-width:520px;margin:0 auto}
.card{background:#fff;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h2{margin:0 0 8px;font-size:20px}h3{margin:0 0 10px;font-size:16px}
p{margin:6px 0;line-height:1.45}small,.muted{color:#6b7280}
.code{font-size:38px;letter-spacing:4px;font-weight:700;background:#eef2ff;padding:16px;border-radius:12px;text-align:center;word-break:break-all}
button{padding:12px 16px;font-size:16px;border:0;border-radius:10px;background:#2563eb;color:#fff;width:100%;margin-top:8px}
button.red{background:#dc2626}button.gray{background:#4b5563}button.sm{width:auto;padding:8px 12px;font-size:14px;margin:0}
.row{display:flex;justify-content:space-between;align-items:center;gap:10px}
.sch{border-top:1px solid #e5e7eb;padding:10px 0}.sch:first-of-type{border-top:0}
.tag{display:inline-block;background:#e5e7eb;border-radius:6px;padding:2px 8px;font-size:12px;margin:2px 4px 2px 0}
.on{color:#059669;font-weight:600}.off{color:#dc2626;font-weight:600}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

app.get('/', auth, (req, res) => {
  let body;
  if (status === 'connected') {
    const sched = SCHEDULES.length
      ? SCHEDULES.map(
          (s, i) => `<div class="sch"><div class="row"><div><b>${settings.disabled.includes(s.id) ? '⏸ ' : ''}${esc(s.times.map((t) => t.label).join(', '))}</b>
          <span class="muted"> · ${esc(s.days.length === 7 ? 'roz' : s.days.join(', '))}</span></div>
          <form method="POST" action="/test/${i}"><button class="sm gray">Abhi bhejo</button></form></div>
          <p>${esc(s.message.slice(0, 120))}</p>
          <small>To: ${esc(s.targets.join(', ') || 'koi nahi')}</small></div>`
        ).join('')
      : `<p class="muted">Koi schedule nahi. Railway Variables me <b>SCHEDULE_1</b> add karo.<br>Example: <code>06:00 | Good morning ☀️</code></p>`;
    body = `<div class="card"><h2>✅ WhatsApp connected</h2><p>Bot chal raha hai. Timezone: ${esc(TZ)}</p></div>
    <div class="card"><h3>Controls</h3>
      <div class="row"><span>Auto reply: <span class="${settings.autoReply ? 'on' : 'off'}">${settings.autoReply ? 'ON' : 'OFF'}</span></span>
      <form method="POST" action="/toggle/reply"><button class="sm">${settings.autoReply ? 'Band karo' : 'Chalu karo'}</button></form></div><br>
      <div class="row"><span>Scheduler: <span class="${settings.schedulerOn ? 'on' : 'off'}">${settings.schedulerOn ? 'ON' : 'OFF'}</span></span>
      <form method="POST" action="/toggle/scheduler"><button class="sm">${settings.schedulerOn ? 'Band karo' : 'Chalu karo'}</button></form></div>
    </div>
    <div class="card"><h3>⏰ Scheduled messages</h3>${sched}</div>
    <div class="card"><form method="POST" action="/reset" onsubmit="return confirm('Session delete karein?')">
      <button class="red">Logout / naya link karo</button></form></div>`;
  } else if (status === 'pairing' && pairingCode) {
    const code = String(pairingCode).replace(/(.{4})(?=.)/, '$1-');
    body = `<div class="card"><h2>Pairing code</h2><div class="code">${esc(code)}</div>
      <p>WhatsApp → Linked Devices → <b>Link with phone number instead</b> → ye code daalo.</p>
      <small>Code kuch der me expire hota hai, page khud naya le lega.</small></div>`;
  } else if (!PHONE) {
    body = `<div class="card"><h2>⚠️ PHONE_NUMBER variable set nahi hai</h2>
      <p>Railway Variables me <b>PHONE_NUMBER</b> daalo (country code ke saath, jaise 919876543210).</p></div>`;
  } else {
    body = `<div class="card"><h2>⏳ Ho raha hai...</h2><p>Pairing code ban raha hai, page khud refresh hoga.</p></div>`;
  }
  res.send(page(body, status !== 'connected'));
});

app.post('/toggle/reply', auth, (req, res) => {
  settings.autoReply = !settings.autoReply;
  saveSettings();
  res.redirect('/');
});

app.post('/toggle/scheduler', auth, (req, res) => {
  settings.schedulerOn = !settings.schedulerOn;
  saveSettings();
  res.redirect('/');
});

app.post('/test/:i', auth, async (req, res) => {
  const sch = SCHEDULES[parseInt(req.params.i, 10)];
  if (sch) runSchedule(sch).catch((e) => log('test error:', e.message));
  res.redirect('/');
});

app.post('/reset', auth, async (req, res) => {
  try {
    if (sock) await sock.logout().catch(() => {});
  } catch (e) {}
  wipeAuth();
  status = 'starting';
  pairingCode = null;
  res.redirect('/');
});

app.listen(PORT, '0.0.0.0', () => log('Server listening on', PORT));

process.on('unhandledRejection', (e) => log('unhandledRejection:', e?.message || e));
process.on('uncaughtException', (e) => log('uncaughtException:', e?.message || e));

applySettings();
log(`Timezone: ${TZ} | Schedules loaded: ${SCHEDULES.length} | Auto reply: ${settings.autoReply}`);
startSock().catch((e) => log('start error:', e.message));
