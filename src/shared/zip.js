// Minimal ZIP support for .zzpack files.
// Writing stores files uncompressed; reading also handles deflate (via the
// browser's DecompressionStream), so packs zipped by other tools open too.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// files: [{ name, data: Uint8Array | string }] → Uint8Array
export function createZip(files) {
  const entries = files.map(({ name, data }) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    return { name: encoder.encode(name), bytes, crc: crc32(bytes) };
  });
  const localSize = entries.reduce((n, e) => n + 30 + e.name.length + e.bytes.length, 0);
  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let offset = 0;
  const offsets = [];

  for (const e of entries) {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);       // version needed
    view.setUint16(offset + 6, 0x0800, true);   // UTF-8 names
    view.setUint16(offset + 8, 0, true);        // stored
    view.setUint32(offset + 14, e.crc, true);
    view.setUint32(offset + 18, e.bytes.length, true);
    view.setUint32(offset + 22, e.bytes.length, true);
    view.setUint16(offset + 26, e.name.length, true);
    out.set(e.name, offset + 30);
    out.set(e.bytes, offset + 30 + e.name.length);
    offset += 30 + e.name.length + e.bytes.length;
  }

  const centralStart = offset;
  entries.forEach((e, i) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint32(offset + 16, e.crc, true);
    view.setUint32(offset + 20, e.bytes.length, true);
    view.setUint32(offset + 24, e.bytes.length, true);
    view.setUint16(offset + 28, e.name.length, true);
    view.setUint32(offset + 42, offsets[i], true);
    out.set(e.name, offset + 46);
    offset += 46 + e.name.length;
  });

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  return out;
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Uint8Array → Map(name → Uint8Array)
export async function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('Not a zip file');

  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Corrupt zip directory');
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(start, start + compressedSize);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, await inflateRaw(data));
    else throw new Error(`Unsupported zip compression in ${name}`);

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

export const textOf = (bytes) => decoder.decode(bytes);
