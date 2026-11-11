// Generates the Motion Panel icons (original, minimalist "dot in motion" mark) without any image library:
// a tiny anti-aliased rasterizer (4×4 supersampling) + a PNG encoder (zlib from Node).
// Output: icons/panel_*.png (23 px, monochrome, the four states CEP uses), icons/icon_*.png (colour app
// icon in several sizes) and icons/icon.svg (vector source).
//   node tools/make-icons.js
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const OUT = path.join(__dirname, "..", "icons");
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- geometry (unit square 0..1)
// The mark: three rounded bars in a cascade (a layer sequence).
const BALL = { cx: 0.665, cy: 0.5, r: 0.175 };
const TRAILS = [ // [x0, x1, y, half-thickness]
  [0.20, 0.44, 0.345, 0.042],
  [0.12, 0.47, 0.500, 0.042],
  [0.26, 0.44, 0.655, 0.042]
];
const inCapsule = (x, y, [x0, x1, cy, h]) => {
  const px = Math.max(x0, Math.min(x1, x));
  return (x - px) * (x - px) + (y - cy) * (y - cy) <= h * h;
};
const BARS = [[0.10, 0.52, 0.22, 0.075], [0.29, 0.71, 0.50, 0.075], [0.48, 0.90, 0.78, 0.075]];
const inMark = (x, y) => BARS.some((t) => inCapsule(x, y, [t[0] + t[3], t[1] - t[3], t[2], t[3]]));
// Rounded "squircle-like" square (superellipse, n = 5) for the colour app icon.
const inSquircle = (x, y, inset) => {
  const u = Math.abs((x - 0.5) / (0.5 - inset)), v = Math.abs((y - 0.5) / (0.5 - inset));
  return Math.pow(u, 5) + Math.pow(v, 5) <= 1;
};

// ---------------------------------------------------------------- raster
function render(size, paint) {
  const px = Buffer.alloc(size * size * 4), SS = 4;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sj = 0; sj < SS; sj++) for (let si = 0; si < SS; si++) {
      const x = (i + (si + 0.5) / SS) / size, y = (j + (sj + 0.5) / SS) / size;
      const c = paint(x, y);
      if (c) { const al = c[3] / 255; r += c[0] * al; g += c[1] * al; b += c[2] * al; a += al; }
    }
    const n = SS * SS, o = (j * size + i) * 4;
    if (a > 0) { px[o] = Math.round(r / a); px[o + 1] = Math.round(g / a); px[o + 2] = Math.round(b / a); }
    px[o + 3] = Math.round((a / n) * 255);
  }
  return px;
}
// ---------------------------------------------------------------- PNG encoder
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const write = (name, size, paint) => { fs.writeFileSync(path.join(OUT, name), png(size, render(size, paint))); console.log("icons/" + name, size + "px"); };

// ---------------------------------------------------------------- panel icons (CEP: 23×23, four states)
// Normal / RollOver are shown on light UI, DarkNormal / DarkRollOver on dark UI.
const mono = (col) => (x, y) => (inMark(0.08 + x * 0.84, 0.08 + y * 0.84) ? [...hex(col), 255] : null);
write("panel_light.png", 23, mono("#5c5c60"));
write("panel_light_hover.png", 23, mono("#1d1d1f"));
write("panel_dark.png", 23, mono("#b9b9be"));
write("panel_dark_hover.png", 23, mono("#ffffff"));

// ---------------------------------------------------------------- colour app icon
// Superellipse tile with a blue → indigo diagonal gradient, a soft top highlight and the white mark.
const A = hex("#55555b"), B = hex("#161618");
const appPaint = (x, y) => {
  if (!inSquircle(x, y, 0.035)) return null;
  const t = Math.min(1, Math.max(0, (x + y) / 2));
  let c = A.map((v, k) => v + (B[k] - v) * t);
  const hi = Math.max(0, 0.18 - y) * 0.9;                         // gentle light from the top
  c = c.map((v) => Math.min(255, v + 255 * hi));
  const mx = 0.5 + (x - 0.5) / 0.62, my = 0.5 + (y - 0.5) / 0.62;   // mark at 62 % of the tile
  if (inMark(mx, my)) return [255, 255, 255, 255];
  return [...c.map(Math.round), 255];
};
[16, 32, 64, 128, 256, 512].forEach((s) => write("icon_" + s + ".png", s, appPaint));

// ---------------------------------------------------------------- SVG source
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#55555b"/><stop offset="1" stop-color="#161618"/></linearGradient></defs>
  <path fill="url(#g)" d="${(() => { // superellipse outline, n = 5
    const pts = [], n = 5, R = 256 - 18;
    for (let k = 0; k <= 360; k += 2) { const a = k * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      pts.push([256 + R * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), 256 + R * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)].map((v) => v.toFixed(1)).join(",")); }
    return "M" + pts.join("L") + "Z"; })()}"/>
  <g fill="#fff" transform="translate(256 256) scale(${(512 * 0.62).toFixed(1)}) translate(-0.5 -0.5)">
    <circle cx="${BALL.cx}" cy="${BALL.cy}" r="${BALL.r}"/>
    ${TRAILS.map(([x0, x1, y, h]) => `<rect x="${x0 - h}" y="${y - h}" width="${(x1 - x0 + 2 * h).toFixed(3)}" height="${2 * h}" rx="${h}"/>`).join("\n    ")}
  </g>
</svg>
`;
fs.writeFileSync(path.join(OUT, "icon.svg"), svg);
console.log("icons/icon.svg");
