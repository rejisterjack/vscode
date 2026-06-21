/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Packs PNGs into a multi-resolution Windows .ico (PNG-encoded entries, Vista+).
// Usage: node pack-ico.js out.ico 16.png 24.png 32.png 48.png 64.png 128.png 256.png
// Filenames must end in "<size>.png"; 256 is encoded as width/height byte 0.

import fs from 'fs';

const out = process.argv[2];
const pngPaths = process.argv.slice(3);

if (!out || pngPaths.length === 0) {
	throw new Error('Usage: node pack-ico.js <out.ico> <size.png> [...]');
}

const entries = pngPaths.map(p => {
	const match = p.match(/(\d+)\.png$/i);
	if (!match) {
		throw new Error(`Filename must end in <size>.png: ${p}`);
	}
	return { dim: Number(match[1]), buf: fs.readFileSync(p) };
});

// ICONDIR (6 bytes): reserved=0, type=1 (icon), count
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);

// ICONDIRENTRY (16 bytes each)
const dir = Buffer.alloc(16 * entries.length);
const dataOffset = 6 + dir.length;
let cursor = dataOffset;
entries.forEach((e, i) => {
	const base = i * 16;
	const dimByte = e.dim >= 256 ? 0 : e.dim; // 0 means 256
	dir.writeUInt8(dimByte, base);            // width
	dir.writeUInt8(dimByte, base + 1);        // height
	dir.writeUInt8(0, base + 2);              // color count (0 = >=256 colours)
	dir.writeUInt8(0, base + 3);              // reserved
	dir.writeUInt16LE(1, base + 4);           // colour planes
	dir.writeUInt16LE(32, base + 6);          // bits per pixel
	dir.writeUInt32LE(e.buf.length, base + 8); // image byte size
	dir.writeUInt32LE(cursor, base + 12);      // image offset
	cursor += e.buf.length;
});

const result = Buffer.concat([header, dir, ...entries.map(e => e.buf)]);
fs.writeFileSync(out, result);
console.log(`Wrote ${out} (${entries.length} images, ${result.length} bytes)`);
