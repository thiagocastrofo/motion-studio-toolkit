// Static preview of client/ outside After Effects. presets.js comes from ../ae-motion-panel (copied at install).
// /__frame?w=360&h=720 shows the panel side by side in dark and light.
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "client");
const mp = fs.existsSync(path.join(root, "mp", "panel.html")) ? path.join(root, "mp") : path.join(__dirname, "..", "..", "ae-motion-panel", "client");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
http.createServer((req, res) => {
  if (req.url.startsWith("/__frame")) {
    const q = new URLSearchParams(req.url.split("?")[1] || ""), w = +q.get("w") || 360, h = +q.get("h") || 720;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(`<!DOCTYPE html><body style="margin:0;padding:12px;background:#555;display:flex;gap:12px;align-items:flex-start">` +
      ["dark", "light"].map((a) => `<iframe id="${a}" src="/index.html" style="width:${w}px;height:${h}px;border:0" onload="this.contentDocument.documentElement.dataset.appearance='${a}'"></iframe>`).join("") + `</body>`);
  }
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  if (rel === "index.html") {
    try { delete require.cache[require.resolve("./compose.js")]; const html = require("./compose.js")(); res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end(html); }
    catch (e) { res.writeHead(500); return res.end(String(e)); }
  }
  // Motion Panel files are served from ../ae-motion-panel/client (install.ps1 copies them into client/mp).
  const file = rel.indexOf("mp/") === 0 ? path.join(mp, rel.slice(3)) : path.join(root, rel);
  if (!file.startsWith(root) && !file.startsWith(mp)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": (types[path.extname(file)] || "application/octet-stream") + "; charset=utf-8" });
    res.end(data);
  });
}).listen(5179, "127.0.0.1", () => console.log("Motion Studio preview on http://127.0.0.1:5179"));
