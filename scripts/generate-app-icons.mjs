import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

// The app SVG is the source of truth; rerun after changing its artwork.
const svg = await readFile(new URL("../src/app/icon.svg", import.meta.url), "utf8");
const square = Buffer.from(svg.replace('rx="60"', 'rx="0"'));
const root = new URL("../", import.meta.url);
await mkdir(new URL("public/icons/", root), { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(`public/icons/icon-${size}.png`, root).pathname);
}
await sharp(square).resize(512, 512).png().toFile(new URL("public/icons/icon-maskable-512.png", root).pathname);
await sharp(square).resize(180, 180).png().toFile(new URL("src/app/apple-icon.png", root).pathname);

// ICO supports PNG frames: keep all three sizes for legacy browser and OS use.
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(size => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
for (let i = 0; i < frames.length; i++) {
  const entry = 6 + i * 16;
  header[entry] = sizes[i];
  header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frames[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frames[i].length;
}
await writeFile(new URL("src/app/favicon.ico", root), Buffer.concat([header, ...frames]));
