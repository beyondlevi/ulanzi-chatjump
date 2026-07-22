/**
 * ChatJump - Evolution API client (main service side).
 *
 * All calls are async and time-bounded (AbortController). Nothing here blocks
 * the event loop — that is a hard rule for this plugin.
 *
 * Endpoints (Evolution API v1/v2, auth via `apikey` header, instance in path):
 *   POST {server}/chat/findContacts/{instance}          -> contacts
 *   POST {server}/chat/fetchProfilePictureUrl/{instance} -> { profilePictureUrl }
 *   GET  {server}/instance/connectionState/{instance}    -> connection state
 */

import { writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const TIMEOUT_MS = 15000;
const CACHE_DIR = path.join(os.homedir(), '.chatjump-cache');

function normServer(url) {
  return (url || '').toString().trim().replace(/\/+$/, '');
}

function timeout() {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}

function errText(json, status) {
  const m = json && (json.message || json.error || json.response);
  if (Array.isArray(m)) return m.join(', ');
  return m ? String(m) : `HTTP ${status}`;
}

async function postJson(url, apikey, body, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apikey || '' },
    body: JSON.stringify(body || {}),
    signal,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { /* non-JSON */ }
  if (!res.ok) throw new Error(errText(json, res.status));
  return json;
}

// Turn raw Evolution contacts into { name, number, jid }, skipping groups and
// broadcasts, de-duped and sorted by name.
export function normalizeContacts(arr) {
  const out = [];
  for (const c of arr || []) {
    const jid = (c.remoteJid || c.id || '').toString();
    if (!jid) continue;
    if (jid.includes('@g.us') || jid.includes('broadcast') || jid.startsWith('status@')) continue;
    const number = jid.split('@')[0].replace(/\D/g, '');
    if (!number) continue;
    const name = (c.pushName || c.name || c.notify || '').toString().trim() || number;
    out.push({ name, number, jid });
  }
  const seen = new Set();
  const uniq = [];
  for (const c of out) {
    if (seen.has(c.number)) continue;
    seen.add(c.number);
    uniq.push(c);
  }
  uniq.sort((a, b) => a.name.localeCompare(b.name));
  return uniq;
}

export async function testConnection({ server, apikey, instance }) {
  const base = normServer(server);
  if (!base || !instance) throw new Error('Fill server, API key and instance');
  const t = timeout();
  try {
    const res = await fetch(`${base}/instance/connectionState/${encodeURIComponent(instance)}`, {
      headers: { apikey: apikey || '' },
      signal: t.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(errText(json, res.status));
    const state = (json && (json.instance?.state || json.state)) || 'unknown';
    return { state };
  } finally {
    t.clear();
  }
}

export async function listContacts({ server, apikey, instance }) {
  const base = normServer(server);
  if (!base || !instance) throw new Error('Fill server, API key and instance');
  const t = timeout();
  try {
    const json = await postJson(`${base}/chat/findContacts/${encodeURIComponent(instance)}`, apikey, { where: {} }, t.signal);
    const arr = Array.isArray(json) ? json : (json?.contacts || json?.data || []);
    return normalizeContacts(arr);
  } finally {
    t.clear();
  }
}

export async function fetchProfilePictureUrl({ server, apikey, instance, number }) {
  const base = normServer(server);
  const t = timeout();
  try {
    const json = await postJson(`${base}/chat/fetchProfilePictureUrl/${encodeURIComponent(instance)}`, apikey, { number }, t.signal);
    return (json && (json.profilePictureUrl || json.profilePicUrl)) || null;
  } finally {
    t.clear();
  }
}

// Download the (short-lived) profile picture into a stable cache file and return
// its path, or null if there is no picture / the download fails.
export async function downloadPhoto(url, number) {
  if (!url) return null;
  const t = timeout();
  try {
    const res = await fetch(url, { signal: t.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(CACHE_DIR, { recursive: true });
    const dest = path.join(CACHE_DIR, `wa-${(number || 'contact').replace(/\D/g, '')}.jpg`);
    await writeFile(dest, buf);
    return dest;
  } catch (e) {
    return null;
  } finally {
    t.clear();
  }
}
