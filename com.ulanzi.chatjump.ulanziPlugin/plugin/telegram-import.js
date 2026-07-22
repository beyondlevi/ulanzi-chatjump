/**
 * ChatJump - Telegram import client (main service side), backed by teleproto
 * (the maintained GramJS fork). MTProto over TCP; everything async and
 * time-bounded — no blocking calls.
 *
 * Interactive login is driven from the Property Inspector: startLogin() kicks
 * off client.start() whose phoneCode/password callbacks park a Promise and ask
 * the PI for input; submitCode()/submitPassword() resolve them. On success the
 * StringSession is returned so the PI can persist it (global settings).
 */

import { writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TelegramClient, Api, sessions } from 'teleproto';

const { StringSession } = sessions;
const CACHE_DIR = path.join(os.homedir(), '.chatjump-cache');
const OP_TIMEOUT = 30000;

let client = null;
let clientKey = '';
let dialogsCache = new Map();
let pending = {};
let loginInFlight = false;

function digits(s) {
  return (s || '').toString().replace(/\D/g, '');
}

function withTimeout(promise, ms, label) {
  let id;
  const t = new Promise((_, rej) => { id = setTimeout(() => rej(new Error(`${label || 'operation'} timed out`)), ms); });
  return Promise.race([promise, t]).finally(() => clearTimeout(id));
}

function displayName(u) {
  if (!u) return '';
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return n || u.title || (u.username ? '@' + u.username : '') || String(u.id ?? '');
}

function entKind(ent) {
  const cn = ent?.className;
  if (cn === 'User') return 'user';
  if (cn === 'Chat') return 'group';
  if (cn === 'Channel') return ent.megagroup ? 'group' : 'channel';
  return 'user';
}

async function ensureClient({ apiId, apiHash, session }) {
  const key = `${apiId}:${apiHash}`;
  if (client && clientKey === key) {
    if (!client.connected) await withTimeout(client.connect(), OP_TIMEOUT, 'connect');
    return client;
  }
  if (client) { try { await client.disconnect(); } catch (e) { /* ignore */ } client = null; }
  const str = new StringSession(session || '');
  client = new TelegramClient(str, Number(apiId), String(apiHash), { connectionRetries: 3 });
  clientKey = key;
  await withTimeout(client.connect(), OP_TIMEOUT, 'connect');
  return client;
}

// Connect and report whether we're already authorized (session still valid).
export async function getStatus(cfg) {
  const c = await ensureClient(cfg);
  if (!(await c.checkAuthorization())) return { connected: false };
  const me = await withTimeout(c.getMe(), OP_TIMEOUT, 'getMe');
  return { connected: true, name: displayName(me), session: c.session.save() };
}

// Begin (or resume) the interactive login. `notify` pushes progress to the PI:
//   { need: 'code' | 'password' } | { connected, name, session } | { ok:false, error }
export async function startLogin(cfg, notify) {
  const c = await ensureClient(cfg);
  if (await c.checkAuthorization()) {
    const me = await withTimeout(c.getMe(), OP_TIMEOUT, 'getMe');
    return { connected: true, name: displayName(me), session: c.session.save() };
  }
  if (loginInFlight) {
    notify({ need: pending.password ? 'password' : 'code' });
    return { pending: true };
  }
  loginInFlight = true;
  pending = {};
  c.start({
    phoneNumber: async () => digits(cfg.phone),
    phoneCode: async () => {
      notify({ need: 'code' });
      return new Promise((res) => { pending.code = res; });
    },
    password: async () => {
      notify({ need: 'password' });
      return new Promise((res) => { pending.password = res; });
    },
    onError: (err) => { notify({ ok: false, error: err && err.message ? err.message : String(err) }); return true; },
  })
    .then(async () => {
      loginInFlight = false;
      pending = {};
      const me = await c.getMe();
      notify({ connected: true, name: displayName(me), session: c.session.save() });
    })
    .catch(() => { loginInFlight = false; pending = {}; });
  return { pending: true };
}

export function submitCode(code) {
  if (pending.code) { const r = pending.code; pending.code = null; r(String(code || '')); }
}

export function submitPassword(pw) {
  if (pending.password) { const r = pending.password; pending.password = null; r(String(pw || '')); }
}

// List recent dialogs (users + groups + channels) as { id, name, type, username }.
export async function listDialogs(cfg) {
  const c = await ensureClient(cfg);
  if (!(await c.checkAuthorization())) throw new Error('Not connected');
  const dialogs = await withTimeout(c.getDialogs({ limit: 500 }), OP_TIMEOUT, 'getDialogs');
  dialogsCache = new Map();
  const out = [];
  for (const d of dialogs) {
    const ent = d.entity;
    if (!ent || ent.className === 'ChatForbidden' || ent.className === 'ChannelForbidden') continue;
    const idStr = String(ent.id ?? '');
    if (!idStr) continue;
    const type = d.isChannel && !d.isGroup ? 'channel' : (d.isGroup ? 'group' : 'user');
    dialogsCache.set(idStr, ent);
    out.push({
      id: idStr,
      name: (d.title || displayName(ent) || idStr).toString(),
      type,
      username: ent.username ? '@' + ent.username : '',
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// Resolve a picked dialog into settings for a Telegram key + download its photo.
export async function pickEntity(cfg, idStr) {
  const c = await ensureClient(cfg);
  const ent = dialogsCache.get(idStr);
  if (!ent) throw new Error('Contact not in the current list; import again');
  const kind = entKind(ent);
  const result = { kind, name: (ent.title || displayName(ent) || idStr).toString() };

  if (ent.username) {
    result.target = 'username';
    result.username = '@' + ent.username;
  } else if (kind === 'user' && ent.phone) {
    result.target = 'phone';
    result.phone = digits(ent.phone);
  } else if (kind !== 'user') {
    // Private group/channel without a public @username: invite link needs admin.
    try {
      const res = await withTimeout(c.invoke(new Api.messages.ExportChatInvite({ peer: ent })), OP_TIMEOUT, 'exportInvite');
      if (res && res.link) { result.target = 'invite'; result.groupLink = res.link; }
    } catch (e) {
      result.inviteError = e && e.message ? e.message : String(e);
    }
  }

  try {
    const buf = await withTimeout(c.downloadProfilePhoto(ent, { isBig: false }), OP_TIMEOUT, 'photo');
    if (buf && buf.length) {
      await mkdir(CACHE_DIR, { recursive: true });
      const dest = path.join(CACHE_DIR, `tg-${idStr.replace(/[^\w-]/g, '')}.jpg`);
      await writeFile(dest, Buffer.from(buf));
      result.iconPath = dest;
    }
  } catch (e) { /* no photo */ }

  if (!result.target) {
    result.error = kind === 'user'
      ? 'This contact has no @username or phone available'
      : 'Private group without @username; an invite link needs admin rights';
  }
  return result;
}
