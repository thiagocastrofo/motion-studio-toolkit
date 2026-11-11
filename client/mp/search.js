// Quick search (command palette): installed AE effects, animation presets (.ffx), Motion Panel
// animations and one-click tools. Used as an overlay in the main panel and inside the floating
// "Motion Panel Busca" window. Keyboard: ↑↓ move, Enter apply, Shift+Enter exit animation,
// Alt+Enter entrance+exit, Ctrl/Cmd+D favourite, Tab next filter, Esc close.
(function () {
  "use strict";
  const { call, setStatus, store, isMac } = window.MPUI;
  const LIB = window.MP_LIB || { transitions: [], text: [], loops: [] };

  // One-click Motion Panel tools available from the search (default options).
  const TOOL_ITEMS = [
    ["Glow físico (Cinemático)", "Glow", { id: "physGlow", radius: 14, exposure: 0, threshold: 70, smooth: 20, spread: 0.65, steps: 6, aspect: 1, angle: 0, ca: 0, mode: "add", tint: true, color: "#ffb36b", dither: true }],
    ["Light Sweep", "Efeitos", { id: "lightSweep", frames: 24 }],
    ["Glitch contínuo", "Efeitos", { id: "glitchFx", chance: 18, fps: 12 }],
    ["Turbulência", "Efeitos", { id: "turbulence", amount: 30, speed: 120 }],
    ["Chroma key", "Efeitos", { id: "chromaKey", color: "#00b140" }],
    ["Inverter keys", "Keyframes", { id: "reverseKeys" }],
    ["Easy Ease", "Keyframes", { id: "easyEase", mode: "both" }],
    ["Ativar / desativar 3D", "Layers", { id: "toggle3D" }],
    ["Motion blur", "Layers", { id: "motionBlur" }],
    ["Null controlador", "Layers", { id: "nullParent" }],
    ["Centralizar âncora", "Layers", { id: "anchor", x: 0.5, y: 0.5 }],
    ["Encaixar na comp", "Layers", { id: "fit", mode: "fit" }],
    ["Esteira infinita", "Loops de mídia", { id: "infiniteScroll", vx: 120, vy: 0 }],
    ["Vídeo infinito", "Loops de mídia", { id: "infiniteVideo" }],
    ["Marcar batidas", "Áudio", { id: "markBeats", sensitivity: 40, gap: 8 }],
    ["Reagir à batida", "Áudio", { id: "reactBeat", amount: 15 }],
    ["Fade de áudio", "Áudio", { id: "fadeAudio", fadeIn: 15, fadeOut: 30 }],
    ["Fade final", "Composição", { id: "fadeFinal", frames: 20, color: "#000000" }],
    ["Organizar camadas", "Composição", { id: "organizeLayers" }],
    ["Vinheta", "Overlays", { id: "overlay", kind: "vignette", amount: 65 }],
    ["Grão", "Overlays", { id: "overlay", kind: "grain", amount: 8 }],
    ["Letterbox 2.39", "Overlays", { id: "overlay", kind: "letterbox", ratio: 2.39 }],
    ["Limpar cache", "Limpeza", { id: "purgeCache" }]
  ];
  const KIND = {
    fx: { label: "Efeito", color: "#0a84ff" }, ffx: { label: "Preset", color: "#ff9f0a" },
    anim: { label: "Animação", color: "#bf5af2" }, tool: { label: "Ferramenta", color: "#30d158" }
  };
  const FILTERS = [["all", "Tudo"], ["fx", "Efeitos"], ["ffx", "Presets"], ["mp", "Motion Panel"], ["fav", "Favoritos"]];

  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Score: exact > prefix > word prefix > substring > in-order letters (fuzzy). 0 = no match.
  function score(q, text) {
    const t = norm(text);
    if (!q) return 1;
    if (t === q) return 1000;
    if (t.startsWith(q)) return 800 - t.length;
    const wi = (" " + t).indexOf(" " + q);
    if (wi >= 0) return 600 - wi;
    const si = t.indexOf(q);
    if (si >= 0) return 400 - si;
    let i = 0, gaps = 0;
    for (const ch of t) { if (ch === q[i]) i++; else if (i > 0) gaps++; if (i === q.length) break; }
    return i === q.length ? Math.max(1, 200 - gaps * 4) : 0;
  }

  function mount(root, opts) {
    const o = Object.assign({ mode: "overlay", onApplied: null, onClose: null }, opts);
    const statusEl = document.createElement("span");
    let items = [], shown = [], sel = 0, filter = store.get("searchFilter", "all");
    const favs = new Set(store.get("searchFavs", [])), recent = store.get("searchRecent", []);
    if (filter === "fav" && !favs.size) filter = "all";

    root.innerHTML = `
      <div class="sp">
        <div class="sp-head">
          <svg viewBox="0 0 16 16" class="sp-mag"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <input class="sp-input" type="text" placeholder="Buscar efeitos, presets e animações…" spellcheck="false" autocomplete="off">
          <button class="sp-refresh" title="Recarregar a lista de efeitos e presets do After Effects">↻</button>
        </div>
        <div class="sp-filters"></div>
        <div class="sp-list" tabindex="-1" data-noi18n></div>
        <div class="sp-foot"><span class="sp-keys"></span></div>
      </div>`;
    const input = root.querySelector(".sp-input"), list = root.querySelector(".sp-list"), filtersEl = root.querySelector(".sp-filters");
    root.querySelector(".sp-foot").appendChild(statusEl);
    statusEl.className = "status";
    const mod = isMac ? "⌘" : "Ctrl";
    root.querySelector(".sp-keys").textContent = `↑↓ navegar · Enter aplicar · ⇧Enter saída · ⌥Enter entrada+saída · ${mod}+D favoritar · Esc fechar`;

    FILTERS.forEach(([id, label]) => {
      const b = document.createElement("button");
      b.textContent = label; b.dataset.id = id;
      b.addEventListener("click", () => { setFilter(id); input.focus(); });
      filtersEl.appendChild(b);
    });
    function setFilter(id) {
      filter = id; store.set("searchFilter", id);
      filtersEl.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
      render();
    }

    // ---------------------------------------------------------- data
    // Names follow the language mode; "alt" holds both languages so either one matches the query.
    const T = (s) => (window.MPI18N ? window.MPI18N.tr(s) : s);
    const ALT = (s) => (window.MPI18N ? window.MPI18N.alt(s) : s);
    let lastFx = null, lastFfx = null;
    function build(fx, ffx) {
      lastFx = fx; lastFfx = ffx;
      items = [];
      (fx || []).forEach((e) => items.push({ kind: "fx", key: "fx:" + e.m, name: e.n, alt: e.n + " " + e.m, sub: e.c, data: e }));
      (ffx || []).forEach((p) => items.push({ kind: "ffx", key: "ffx:" + p.p, name: p.n, alt: p.n, sub: p.c, data: p }));
      [["transitions", "Transições"], ["text", "Texto"], ["loops", "Loops"]].forEach(([k, label]) =>
        (LIB[k] || []).forEach((p) => items.push({ kind: "anim", key: "anim:" + p.id, name: T(p.name), alt: ALT(p.name), sub: T(label) + " › " + T(p.cat), data: p })));
      TOOL_ITEMS.forEach(([name, cat, args]) => items.push({ kind: "tool", key: "tool:" + name, name: T(name), alt: ALT(name), sub: T(cat), data: args }));
      render();
    }
    document.addEventListener("mp:lang", () => { if (lastFx !== null || lastFfx !== null || items.length) build(lastFx, lastFfx); });
    function load(force) {
      const cached = store.get("searchCache", null);
      if (cached && !force) build(cached.fx, cached.ffx);
      else build([], []);
      if (cached && !force) return;
      setStatus(statusEl, "Lendo efeitos e presets do After Effects…");
      call("MPT.run", { id: "listEffects" }, null, statusEl, (fx) => {
        call("MPT.run", { id: "listPresets" }, null, statusEl, (ffx) => {
          store.set("searchCache", { fx, ffx });
          build(fx, ffx);
          setStatus(statusEl, `${fx.length} efeitos e ${ffx.length} presets carregados.`, "ok");
        });
      });
    }
    root.querySelector(".sp-refresh").addEventListener("click", () => load(true));

    // ---------------------------------------------------------- render
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    function highlight(name, q) {
      if (!q) return esc(name);
      const n = norm(name), i = n.indexOf(q);
      if (i < 0) return esc(name);
      return esc(name.slice(0, i)) + "<mark>" + esc(name.slice(i, i + q.length)) + "</mark>" + esc(name.slice(i + q.length));
    }
    function render() {
      const q = norm(input.value.trim());
      const pool = items.filter((it) =>
        filter === "all" ? true : filter === "fav" ? favs.has(it.key) : filter === "mp" ? (it.kind === "anim" || it.kind === "tool") : it.kind === filter);
      const scored = [];
      pool.forEach((it) => {
        let s = Math.max(score(q, it.name), score(q, it.alt || "") * 0.9, score(q, it.sub) * 0.4);
        if (!s) return;
        if (favs.has(it.key)) s += 120;
        const r = recent.indexOf(it.key);
        if (r >= 0) s += 90 - r * 3;
        scored.push([s, it]);
      });
      scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name));
      shown = scored.slice(0, 80).map((x) => x[1]);
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.innerHTML = "";
      if (!shown.length) {
        list.innerHTML = `<p class="empty">${items.length ? "Nada encontrado." : "Carregando…"}</p>`;
        return;
      }
      shown.forEach((it, i) => {
        const row = document.createElement("div");
        row.className = "sp-row" + (i === sel ? " on" : "");
        row.innerHTML = `<span class="sp-kind" style="background:${KIND[it.kind].color}">${KIND[it.kind].label}</span>` +
          `<span class="sp-name">${highlight(it.name, q)}</span><span class="sp-sub">${esc(it.sub || "")}</span>` +
          `<button class="sp-star${favs.has(it.key) ? " on" : ""}" title="Favoritar">★</button>`;
        row.addEventListener("mousemove", () => { if (sel !== i) { sel = i; mark(); } });
        row.addEventListener("click", (e) => {
          if (e.target.classList.contains("sp-star")) { toggleFav(it); return; }
          apply(it, e.shiftKey ? "out" : e.altKey ? "both" : "in");
        });
        list.appendChild(row);
      });
    }
    function mark() {
      list.querySelectorAll(".sp-row").forEach((r, i) => r.classList.toggle("on", i === sel));
      const on = list.querySelector(".sp-row.on");
      if (on) on.scrollIntoView({ block: "nearest" });
    }
    function toggleFav(it) {
      if (favs.has(it.key)) favs.delete(it.key); else favs.add(it.key);
      store.set("searchFavs", Array.from(favs));
      render();
    }

    // ---------------------------------------------------------- apply
    function remember(it) {
      const i = recent.indexOf(it.key);
      if (i >= 0) recent.splice(i, 1);
      recent.unshift(it.key);
      recent.length = Math.min(recent.length, 30);
      store.set("searchRecent", recent);
    }
    function apply(it, mode) {
      if (!it) return;
      remember(it);
      const done = (r) => { if (r && r.indexOf("ok:") === 0 && o.onApplied) o.onApplied(it); };
      if (it.kind === "fx") call("MPT.run", { id: "addEffect", match: it.data.m, name: it.name }, null, statusEl, null, done);
      else if (it.kind === "ffx") call("MPT.run", { id: "applyPresetFile", path: it.data.p, name: it.name }, null, statusEl, null, done);
      else if (it.kind === "tool") call("MPT.run", it.data, null, statusEl, null, done);
      else {
        const p = it.data, frames = Math.max(1, parseInt(store.get("lastFrames", 15), 10) || 15);
        const m = p.type === "loop" ? "in" : mode;
        const label = { in: "entrada", out: "saída", both: "entrada e saída" }[m];
        call("MP.apply", { preset: Object.assign({}, p, { name: it.name }), mode: m, frames, stagger: 0, anchor: "layer", markers: store.get("markers", true) },
          `${it.name} (${label}) aplicado em {n} layer(s).`, statusEl, null, done);
      }
    }

    // ---------------------------------------------------------- keyboard
    input.addEventListener("input", () => { sel = 0; render(); });
    root.addEventListener("keydown", (e) => {
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === "PageDown") { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 8); mark(); }
      else if (e.key === "PageUp") { e.preventDefault(); sel = Math.max(0, sel - 8); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); apply(shown[sel], e.shiftKey ? "out" : e.altKey ? "both" : "in"); }
      else if (e.key === "Escape") { e.preventDefault(); if (input.value) { input.value = ""; render(); } else if (o.onClose) o.onClose(); }
      else if (e.key === "Tab") {
        e.preventDefault();
        const ids = FILTERS.map((f) => f[0]), i = ids.indexOf(filter);
        setFilter(ids[(i + (e.shiftKey ? ids.length - 1 : 1)) % ids.length]);
      }
      else if (modKey && (e.key === "d" || e.key === "D")) { e.preventDefault(); if (shown[sel]) toggleFav(shown[sel]); }
    });

    setFilter(filter);
    load(false);
    return {
      focus() { input.focus(); input.select(); },
      reset() { input.value = ""; sel = 0; render(); },
      reload() { load(true); }
    };
  }

  window.MPSearch = { mount };
})();
