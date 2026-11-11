// Assembles the extension exactly as it ships: CSXS, client (with the composed index.html), host and icons.
//   node scripts/stage.js <outDir> [version]
// The version (e.g. 1.2.0) is written into the manifest. Also writes icons/app.ico for the Windows installer.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const out = path.resolve(process.argv[2] || path.join(ROOT, "dist", "stage"));
const version = (process.argv[3] || process.env.APP_VERSION || "0.0.0").replace(/^v/, "").replace(/[^0-9.].*$/, "") || "0.0.0";

function copyDir(src, dst, skip) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip && skip(e.name)) continue;
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(a, b, skip); else fs.copyFileSync(a, b);
  }
}
fs.rmSync(out, { recursive: true, force: true });
copyDir(path.join(ROOT, "CSXS"), path.join(out, "CSXS"));
copyDir(path.join(ROOT, "host"), path.join(out, "host"));
copyDir(path.join(ROOT, "icons"), path.join(out, "icons"), (n) => /^icon_(512|256|128|64)\.png$|\.svg$|\.ico$/.test(n));
copyDir(path.join(ROOT, "client"), path.join(out, "client"), (n) => n === "panel.html");
// final page = template + Motion Panel screens
fs.writeFileSync(path.join(out, "client", "index.html"), require(path.join(ROOT, "tools", "compose.js"))());
// version in the manifest
const mf = path.join(out, "CSXS", "manifest.xml");
fs.writeFileSync(mf, fs.readFileSync(mf, "utf8")
  .replace(/ExtensionBundleVersion="[^"]*"/, `ExtensionBundleVersion="${version}"`)
  .replace(/(<Extension Id="[^"]+" Version=)"[^"]*"/g, `$1"${version}"`));

// Windows icon: an .ico that embeds the 256 px PNG
const png = fs.readFileSync(path.join(ROOT, "icons", "icon_256.png"));
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 0; ico[7] = 0; ico[8] = 0; ico[9] = 0; ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(ROOT, "icons", "app.ico"), Buffer.concat([ico, png]));
console.log("staged " + out + " (v" + version + ")");
