/**
 * ChatJump - icon compositor
 *
 * Overlays a small app badge (WhatsApp / Telegram) on the top-right corner of
 * the user's contact photo, so a key that shows a face still tells you which
 * messenger it opens. Pure-JS (pngjs + jpeg-js), no native deps, so it runs
 * unchanged inside the Ulanzi Studio Node runtime on any platform.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { GifReader } from 'omggif';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAX_DIM = 256; // deck keys are small; bound work and output size
const BADGE_SCALE = 0.36; // badge size relative to the photo's shorter side
const BADGE_MARGIN = 0.05;

const BADGE_CACHE = {};

function decodeImage(file) {
  const ext = path.extname(file).toLowerCase();
  const buf = readFileSync(file);
  if (ext === '.png') {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: png.data };
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 });
    return { width: img.width, height: img.height, data: Buffer.from(img.data) };
  }
  if (ext === '.gif') {
    const reader = new GifReader(buf);
    const w = reader.width;
    const h = reader.height;
    const out = Buffer.alloc(w * h * 4);
    reader.decodeAndBlitFrameRGBA(0, out); // first frame is enough for a static key
    return { width: w, height: h, data: out };
  }
  return null; // e.g. .webp -> caller falls back to the raw photo
}

// Bilinear resize of an RGBA image to (dw, dh).
function resizeRGBA(src, dw, dh) {
  const { width: sw, height: sh, data: sd } = src;
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const fy = ((y + 0.5) * sh) / dh - 0.5;
    let y0 = Math.floor(fy);
    const wy = fy - y0;
    if (y0 < 0) y0 = 0;
    const y1 = Math.min(y0 + 1, sh - 1);
    for (let x = 0; x < dw; x++) {
      const fx = ((x + 0.5) * sw) / dw - 0.5;
      let x0 = Math.floor(fx);
      const wx = fx - x0;
      if (x0 < 0) x0 = 0;
      const x1 = Math.min(x0 + 1, sw - 1);
      const i00 = (y0 * sw + x0) * 4;
      const i01 = (y0 * sw + x1) * 4;
      const i10 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * dw + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = sd[i00 + c] * (1 - wx) + sd[i01 + c] * wx;
        const bot = sd[i10 + c] * (1 - wx) + sd[i11 + c] * wx;
        out[o + c] = Math.round(top * (1 - wy) + bot * wy);
      }
    }
  }
  return { width: dw, height: dh, data: out };
}

// Alpha-composite `top` over `base` in place at (ox, oy).
function compositeOver(base, top, ox, oy) {
  const { width: bw, height: bh, data: bd } = base;
  const { width: tw, height: th, data: td } = top;
  for (let y = 0; y < th; y++) {
    const by = oy + y;
    if (by < 0 || by >= bh) continue;
    for (let x = 0; x < tw; x++) {
      const bx = ox + x;
      if (bx < 0 || bx >= bw) continue;
      const ti = (y * tw + x) * 4;
      const a = td[ti + 3] / 255;
      if (a === 0) continue;
      const bi = (by * bw + bx) * 4;
      for (let c = 0; c < 3; c++) {
        bd[bi + c] = Math.round(td[ti + c] * a + bd[bi + c] * (1 - a));
      }
      bd[bi + 3] = Math.max(bd[bi + 3], td[ti + 3]);
    }
  }
}

function loadBadge(app) {
  if (BADGE_CACHE[app]) return BADGE_CACHE[app];
  const file = path.join(HERE, '..', 'assets', 'icons', `badge-${app}.png`);
  const png = PNG.sync.read(readFileSync(file));
  BADGE_CACHE[app] = { width: png.width, height: png.height, data: png.data };
  return BADGE_CACHE[app];
}

/**
 * Compose contact photo + app badge. Returns a PNG data URI, or null when the
 * photo can't be decoded (caller then shows the raw photo without a badge).
 */
export function composeIconDataUri(photoPath, app) {
  let photo;
  try {
    photo = decodeImage(photoPath);
  } catch (e) {
    return null;
  }
  if (!photo || app !== 'whatsapp' && app !== 'telegram') return null;

  // Scale the photo down to a key-sized canvas first.
  let base = photo;
  const longest = Math.max(photo.width, photo.height);
  if (longest > MAX_DIM) {
    const s = MAX_DIM / longest;
    base = resizeRGBA(photo, Math.max(1, Math.round(photo.width * s)), Math.max(1, Math.round(photo.height * s)));
  }

  const short = Math.min(base.width, base.height);
  const size = Math.max(16, Math.round(short * BADGE_SCALE));
  const margin = Math.round(short * BADGE_MARGIN);
  const badge = resizeRGBA(loadBadge(app), size, size);
  // bottom-right corner
  compositeOver(base, badge, base.width - size - margin, base.height - size - margin);

  const png = new PNG({ width: base.width, height: base.height });
  png.data = Buffer.from(base.data);
  return 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
}
