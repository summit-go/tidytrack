export function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let { width, height } = img;
        if (width > height && width > maxDim) { height = (height * maxDim) / width; width = maxDim; }
        else if (height > maxDim) { width = (width * maxDim) / height; height = maxDim; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.75);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Build a friendly, tagged filename for a single photo.
// Combines property/unit, party (bedroom), task name, and kind into
// a clean filename. e.g. "B1-204_Bedroom-4_tub_before.jpg".
// Sanitizes whitespace and unsafe characters.
export function photoFilename(photo, context = {}) {
  const sanitize = (s) => String(s || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')   // strip accents
    .replace(/[^a-zA-Z0-9\-_]+/g, '-')                    // non-safe → hyphen
    .replace(/-+/g, '-')                                   // collapse hyphens
    .replace(/^-|-$/g, '');                                // trim hyphens
  const parts = [];
  if (context.unitLabel) parts.push(sanitize(context.unitLabel));
  else if (context.propertyName) parts.push(sanitize(context.propertyName));
  if (photo.partyLabel || context.partyLabel) parts.push(sanitize(photo.partyLabel || context.partyLabel));
  if (photo.taskName || context.taskName) parts.push(sanitize(photo.taskName || context.taskName));
  if (photo.kind) parts.push(photo.kind);
  // Date fallback if we have no other context
  if (parts.length === 0 && context.date) parts.push(context.date);
  if (parts.length === 0) parts.push('photo');
  // Best-effort extension from URL or default to jpg
  let ext = 'jpg';
  const m = (photo.public_url || '').match(/\.([a-zA-Z0-9]{3,4})(?:\?|$)/);
  if (m) ext = m[1].toLowerCase();
  return `${parts.join('_')}.${ext}`;
}

const _CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
export function _crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = _CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
export function _strBytes(s) {
  // filenames: encode as UTF-8
  return new TextEncoder().encode(s);
}
// Build a ZIP Blob from [{name, data:Uint8Array}]. Store method (0).
export function buildZipBlob(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (n) => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
  const u32 = (n) => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);
  const push = (arr) => { chunks.push(arr); offset += arr.length; };

  files.forEach(f => {
    const nameBytes = _strBytes(f.name);
    const crc = _crc32(f.data);
    const size = f.data.length;
    const localHeaderOffset = offset;
    // Local file header
    const lh = [];
    lh.push(u32(0x04034b50));      // sig
    lh.push(u16(20));              // version needed
    lh.push(u16(0x0800));          // flags: UTF-8 filename
    lh.push(u16(0));               // method: store
    lh.push(u16(0), u16(0));       // mod time/date (0)
    lh.push(u32(crc));
    lh.push(u32(size));            // compressed size
    lh.push(u32(size));            // uncompressed size
    lh.push(u16(nameBytes.length));
    lh.push(u16(0));               // extra len
    lh.forEach(push);
    push(nameBytes);
    push(f.data);
    // Central directory record (kept for the end)
    const cd = [];
    cd.push(u32(0x02014b50));
    cd.push(u16(20), u16(20));
    cd.push(u16(0x0800), u16(0));
    cd.push(u16(0), u16(0));
    cd.push(u32(crc), u32(size), u32(size));
    cd.push(u16(nameBytes.length), u16(0), u16(0));
    cd.push(u16(0), u16(0), u32(0));
    cd.push(u32(localHeaderOffset));
    central.push({ parts: cd, nameBytes });
  });

  const centralStart = offset;
  central.forEach(c => {
    c.parts.forEach(push);
    push(c.nameBytes);
  });
  const centralSize = offset - centralStart;
  // End of central directory
  [
    u32(0x06054b50), u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(centralSize), u32(centralStart), u16(0),
  ].forEach(push);

  return new Blob(chunks, { type: 'application/zip' });
}

// Check whether the Web Share API supports sharing files
export function canShareFiles() {
  return typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function';
}

export async function readPhotoTakenAt(file) {
  try {
    if (!file || !file.arrayBuffer) return null;
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not JPEG
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      if (marker === 0xffe1) {
        // APP1 (EXIF)
        const exifStart = offset + 4;
        if (view.getUint32(exifStart) !== 0x45786966) return null; // "Exif"
        const tiff = exifStart + 6;
        const little = view.getUint16(tiff) === 0x4949;
        const u16 = (o) => view.getUint16(o, little);
        const u32 = (o) => view.getUint32(o, little);
        const ifd0 = tiff + u32(tiff + 4);
        const readDate = (ifd) => {
          const n = u16(ifd);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            const tag = u16(e);
            if (tag === 0x9003 || tag === 0x0132) {
              // DateTimeOriginal / DateTime
              const valOff = tiff + u32(e + 8);
              let s = "";
              for (let j = 0; j < 19 && valOff + j < view.byteLength; j++)
                s += String.fromCharCode(view.getUint8(valOff + j));
              const m = s.match(
                /^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})/,
              );
              if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
            }
          }
          return null;
        };
        // Prefer the EXIF sub-IFD's DateTimeOriginal; fall back to IFD0 DateTime.
        const n0 = u16(ifd0);
        let exifPtr = null;
        for (let i = 0; i < n0; i++) {
          const e = ifd0 + 2 + i * 12;
          if (u16(e) === 0x8769) {
            exifPtr = tiff + u32(e + 8);
            break;
          }
        }
        return (exifPtr && readDate(exifPtr)) || readDate(ifd0);
      }
      if ((marker & 0xff00) !== 0xff00) break;
      offset += 2 + view.getUint16(offset + 2);
    }
    return null;
  } catch {
    return null;
  }
}

export async function sharePhotos(photos, contextFn) {
  if (!canShareFiles()) return false;
  try {
    const files = [];
    for (const p of photos) {
      const ctx = typeof contextFn === "function" ? contextFn(p) : contextFn;
      const filename = photoFilename(p, ctx);
      const resp = await fetch(p.public_url);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      files.push(
        new File([blob], filename, { type: blob.type || "image/jpeg" }),
      );
    }
    if (files.length === 0) return false;
    if (!navigator.canShare({ files })) return false;
    await navigator.share({ files, title: "Cleaning photos" });
    return true;
  } catch (e) {
    if (e.name === "AbortError") return true; // User cancelled — not an error
    console.error("[sharePhotos] failed", e);
    return false;
  }
}
