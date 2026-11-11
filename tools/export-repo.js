// Copies everything the GitHub repository needs into a git working copy (kept outside Google Drive):
// Motion Studio sources + the Motion Panel files it embeds (host.jsx, tools.jsx, client .js/.css, index.html as
// client/mp/panel.html) + the release files (README, .gitignore, CI workflow, installers, scripts).
//   node tools/export-repo.js "C:\Users\thiag\Projects\motion-studio-toolkit"
// Only managed paths are replaced; .git and anything else in the repo stay untouched.
const fs = require("fs"), path = require("path");
const STUDIO = path.join(__dirname, ".."), MP = path.join(STUDIO, "..", "ae-motion-panel");
const repo = path.resolve(process.argv[2] || "");
if (!process.argv[2]) { console.error("usage: node tools/export-repo.js <repo dir>"); process.exit(1); }

const rm = (p) => fs.rmSync(path.join(repo, p), { recursive: true, force: true });
function copy(src, dst, skip) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const n of fs.readdirSync(src)) if (!skip || !skip(n)) copy(path.join(src, n), path.join(dst, n), skip);
  } else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
}
const R = (p) => path.join(repo, p);
fs.mkdirSync(repo, { recursive: true });
["CSXS", "client", "host", "icons", "design-system", "tools", "scripts", "installer", ".github"].forEach(rm);

copy(path.join(STUDIO, "CSXS"), R("CSXS"));
copy(path.join(STUDIO, "client"), R("client"));
copy(path.join(STUDIO, "host"), R("host"));
copy(path.join(STUDIO, "icons"), R("icons"), (n) => n === "app.ico");
copy(path.join(STUDIO, "design-system"), R("design-system"));
["compose.js", "dev-server.js", "diagnostico.jsx", "make-icons.js", "export-repo.js"].forEach((f) => copy(path.join(STUDIO, "tools", f), R("tools/" + f)));
// embedded Motion Panel engine
copy(path.join(MP, "host", "host.jsx"), R("host/host.jsx"));
copy(path.join(MP, "host", "tools.jsx"), R("host/tools.jsx"));
for (const n of fs.readdirSync(path.join(MP, "client"))) if (/\.(js|css)$/.test(n)) copy(path.join(MP, "client", n), R("client/mp/" + n));
copy(path.join(MP, "client", "index.html"), R("client/mp/panel.html"));
// release files
const REL = path.join(STUDIO, "release");
copy(path.join(REL, "README.md"), R("README.md"));
copy(path.join(REL, "gitignore"), R(".gitignore"));
copy(path.join(REL, "workflows", "release.yml"), R(".github/workflows/release.yml"));
copy(path.join(REL, "installer"), R("installer"));
copy(path.join(REL, "scripts"), R("scripts"));
// shell scripts need LF line endings and the executable bit on macOS
for (const f of ["installer/mac/build-pkg.sh", "installer/mac/scripts/preinstall", "installer/mac/scripts/postinstall"]) {
  fs.writeFileSync(R(f), fs.readFileSync(R(f), "utf8").replace(/\r\n/g, "\n"));
}
fs.writeFileSync(R(".gitattributes"), "*.sh text eol=lf\ninstaller/mac/scripts/* text eol=lf\n*.png binary\n*.exe binary\n");
console.log("exported to " + repo);
