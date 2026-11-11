// Builds the final Motion Studio index.html: takes client/index.html (template) and injects the Motion Panel
// screens (animation library, tools, edit, quick search) from ../ae-motion-panel/client/index.html.
// Used by install.ps1 (node tools/compose.js <outFile>) and by the dev server (require).
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
// Repository layout: the Motion Panel files are bundled in client/mp (panel.html = its index.html).
// Development layout: they are read from the sibling ../ae-motion-panel folder.
const BUNDLED = path.join(ROOT, "client", "mp", "panel.html");
const MP = fs.existsSync(BUNDLED) ? BUNDLED : path.join(ROOT, "..", "ae-motion-panel", "client", "index.html");

// Outer HTML of the element that starts at `startToken` (balanced on its own tag name).
function grab(html, startToken) {
  const a = html.indexOf(startToken);
  if (a < 0) throw new Error("Motion Panel markup not found: " + startToken);
  const tag = /^<(\w+)/.exec(startToken)[1], re = new RegExp("<" + tag + "\\b|</" + tag + ">", "g");
  re.lastIndex = a;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(a, m.index + m[0].length);
  }
  throw new Error("Unbalanced markup: " + startToken);
}

function compose() {
  const tpl = fs.readFileSync(path.join(ROOT, "client", "index.html"), "utf8");
  const mp = fs.readFileSync(MP, "utf8");
  const views = grab(mp, '<nav class="tabbar" id="views">');
  const search = grab(mp, '<button class="iconbtn plain" id="openSearch"');
  const lang = grab(mp, '<div class="langwrap"');
  const sections = ["browse", "build", "edit", "tools"].map((id) => grab(mp, '<section id="' + id + '"')).join("\n");
  const overlay = grab(mp, '<div id="searchOverlay"');
  return tpl
    .replace("<!--MP:HOLD-->", '<div id="mpHold">\n' + views + "\n" + search + "\n" + lang + "\n" + sections + "\n</div>")
    .replace("<!--MP:OVERLAY-->", overlay);
}
module.exports = compose;

if (require.main === module) {
  const out = process.argv[2];
  if (!out) { process.stdout.write(compose()); } else { fs.writeFileSync(out, compose()); console.log("index.html composto em " + out); }
}
