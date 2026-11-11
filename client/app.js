// Motion Studio Toolkit — panel UI. Tabs: Básico, Texto, Legendas. Cards in one column (design-system/README.md).
(function () {
  "use strict";
  const cep = window.__adobe_cep__;
  const IC = window.STIcons;
  const T = (x) => (window.MPI18N ? window.MPI18N.tr(x) : x);
  const LIB = window.MP_LIB || { text: [] };
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ host bridge
  let HOST = "";
  if (cep) {
    let ext = decodeURI(cep.getSystemPath("extension")).replace(/^file:\/{2,3}/, "");
    if (!/^[A-Za-z]:/.test(ext) && ext[0] !== "/") ext = "/" + ext;
    HOST = ext + "/host";
  }
  function evalHost(script, cb) {
    if (!cep) { cb && cb("error:Fora do After Effects (pré-visualização)."); return; }
    const dir = JSON.stringify(HOST);
    cep.evalScript("(function(){try{if(typeof MST==='undefined'||!MST.load){$.evalFile(new File(" + dir + "+'/studio.jsx'));}MST.load();return " + script +
      ";}catch(e){return 'error:'+e.toString()+(e.line?' (linha '+e.line+')':'');}})()", cb || (() => {}));
  }
  const q = (o) => JSON.stringify(JSON.stringify(o));
  function run(args, cb) {
    evalHost("MPT.run(" + q(args) + ")", (r) => {
      if (r && r.indexOf("json:") === 0) { try { cb && cb(JSON.parse(r.slice(5)), r); } catch (e) { flash("Resposta inválida do AE.", "err"); } return; }
      result(r); cb && cb(null, r);
    });
  }
  function applyPreset(args, cb) { evalHost("MP.apply(" + q(args) + ")", (r) => { result(r); cb && cb(null, r); }); }

  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem("mst." + k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { localStorage.setItem("mst." + k, JSON.stringify(v)); }
  };

  // appearance follows After Effects' brightness
  (function appearance() {
    let light = false;
    try { const c = JSON.parse(cep.getHostEnvironment()).appSkinInfo.panelBackgroundColor.color; light = 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue > 140; }
    catch (e) { light = !cep && window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches; }
    document.documentElement.dataset.appearance = light ? "light" : "dark";
    try { cep && cep.addEventListener("com.adobe.csxs.events.ThemeColorChanged", appearance); } catch (e) {}
  })();

  // ------------------------------------------------------------ DOM helper
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (k === "on") for (const ev in v) el.addEventListener(ev, v[ev]);
      else if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k === "html") el.innerHTML = v;
      else if (k in el && typeof v !== "string") el[k] = v;
      else el.setAttribute(k, v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  // icon that animates on hover of `host` and when the host is clicked
  const ico = (name, hostEl) => { const s = IC.svg(name); if (hostEl) { hostEl.addEventListener("mouseenter", () => IC.play(s)); hostEl.addEventListener("click", () => IC.play(s)); } return s; };
  const iconBtn = (cls, name, title, onclick, label) => { const b = h("button", { class: cls, title, "aria-label": title, on: { click: onclick } }); b.appendChild(ico(name, b)); if (label) b.appendChild(h("span", {}, label)); return b; };
  const toggle = (on, onchange) => { const i = h("input", { type: "checkbox" }); i.checked = !!on; i.addEventListener("change", () => onchange(i.checked)); return h("span", { class: "st-toggle" }, i, h("i")); };
  const seg = (cls, opts, val, onchange) => {
    const box = h("div", { class: cls });
    opts.forEach(([v, l]) => box.appendChild(h("button", { class: v === val ? "on" : "", on: { click: (e) => { box.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); onchange(v); } } }, l)));
    return box;
  };
  const num = (v, min, max, step, onchange) => { const i = h("input", { class: "st-num", type: "number", value: String(v), min: String(min), max: String(max), step: String(step || 1) }); i.addEventListener("change", () => onchange(+i.value)); return i; };
  const field = (label, ...ctl) => h("div", { class: "st-field" }, h("label", {}, label), h("div", { class: "ctl" }, ...ctl));
  const swatch = (color, onchange) => { const i = h("input", { type: "color", value: color }); const s = h("span", { class: "ms-swatch", style: "background:" + color }, i); i.addEventListener("input", () => { s.style.background = i.value; onchange(i.value); }); return s; };
  // Draggable value field (drag left/right, click to type), like a scrubbable slider.
  function dragField(label, val, min, max, unit, onchange) {
    const b = h("b", {}, String(val), h("small", {}, unit));
    const el = h("div", { class: "ms-drag", title: "Arraste para ajustar · clique duplo para digitar" }, h("span", {}, label), b);
    const paint = () => { el.style.setProperty("--p", ((val - min) / (max - min) * 100) + "%"); b.firstChild.nodeValue = String(val); };
    let x0 = 0, v0 = 0, drag = false;
    el.addEventListener("pointerdown", (e) => { drag = true; x0 = e.clientX; v0 = val; try { el.setPointerCapture(e.pointerId); } catch (er) {} });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      val = Math.max(min, Math.min(max, Math.round(v0 + (e.clientX - x0) / el.clientWidth * (max - min))));
      paint(); onchange(val);
    });
    el.addEventListener("pointerup", () => { drag = false; });
    el.addEventListener("dblclick", () => { const v = prompt(label, String(val)); if (v != null && !isNaN(+v)) { val = Math.max(min, Math.min(max, Math.round(+v))); paint(); onchange(val); } });
    paint();
    return el;
  }

  // ------------------------------------------------------------ hero (comp card) + feedback
  let info = { name: "Sem composição", w: 0, h: 0, fps: 0, dur: 0, sel: 0, text: 0 };
  const heroName = h("div", { class: "nm" }, "—"), heroSub = h("div", { class: "sub" }, ""), heroPill = h("span", { class: "ms-pill" }, "0 layers");
  const hero = h("div", { class: "ms-card ms-hero" }, h("div", { class: "txt" }, heroName, heroSub), heroPill);
  let flashTimer = 0;
  function paintHero() {
    heroName.textContent = info.name;
    if (!flashTimer) { heroSub.className = "sub"; heroSub.textContent = info.w ? `${info.w}×${info.h} · ${info.fps} fps · ${info.dur} s` : "Abra uma composição"; }
    heroPill.textContent = info.sel + (info.sel === 1 ? " layer" : " layers");
    document.dispatchEvent(new Event("mst:info"));
  }
  function flash(msg, kind) {
    clearTimeout(flashTimer);
    heroSub.className = "sub " + (kind || "");
    heroSub.textContent = msg;
    heroSub.title = msg;
    flashTimer = setTimeout(() => { flashTimer = 0; paintHero(); }, 3500);
  }
  function result(r) {
    if (!r || r === "EvalScript error.") return flash("Erro no AE sem detalhes.", "err");
    if (r.indexOf("error:") === 0) return flash(r.slice(6), "err");
    if (r.indexOf("ok:") === 0) { flash(r.slice(3), "ok"); refresh(); }
  }
  function refresh() { run({ id: "stInfo" }, (o) => { if (o) { info = o; paintHero(); } }); }
  if (cep) setInterval(() => { if (!document.hidden) refresh(); }, 1200);

  // ============================================================ BÁSICO
  function basics() {
    const page = h("div", { class: "ms-page" });
    // create
    const nullCount = h("sup", {}, "");
    const tile = (name, label, args, extra) => { const b = iconBtn("ms-btile", name, label, () => run(typeof args === "function" ? args() : args), label); if (extra) b.appendChild(extra); return b; };
    page.appendChild(h("div", { class: "ms-create" },
      tile("solid", "Sólido", { id: "create", kind: "solid", color: store.get("solidColor", "#1c1c1e") }),
      tile("text", "Texto", { id: "create", kind: "text" }),
      tile("adjust", "Ajuste", { id: "create", kind: "adj" }),
      tile("nullL", "Null", () => (info.sel ? { id: "nullParent" } : { id: "create", kind: "null" }), nullCount)));
    document.addEventListener("mst:info", () => { nullCount.textContent = info.sel ? "↳" + info.sel : ""; });
    nullCount.title = "Com layers selecionadas, o null vira pai delas";

    // pre-compose row with options
    const pcMenu = h("div", { class: "ms-menu hidden" },
      h("button", { on: { click: () => run({ id: "precomp", mode: "together" }) } }, "Juntas"),
      h("button", { on: { click: () => run({ id: "precomp", mode: "separate" }) } }, "Separadas"),
      h("button", { on: { click: () => run({ id: "unprecomp" }) } }, "Desfazer"));
    const pcCount = h("span", { class: "ms-meta" }, "0 layers");
    const chev = IC.svg("chevron"); chev.classList.add("chev");
    const pc = h("button", { class: "ms-row", title: "Clique: pre-compor juntas · seta: mais opções", on: { click: (e) => {
      if (e.target.closest(".chev")) { pc.classList.toggle("open"); pcMenu.classList.toggle("hidden"); return; }
      run({ id: "precomp", mode: "together" });
    } } });
    pc.append(ico("precompose", pc), h("span", { class: "grow" }, "Pre-compor"), pcCount, chev);
    document.addEventListener("mst:info", () => { pcCount.textContent = info.sel + " layers"; });
    page.append(pc, pcMenu);

    // anchor + align
    const grid = h("div", { class: "ms-anchor" });
    [[0, 0], [.5, 0], [1, 0], [0, .5], [.5, .5], [1, .5], [0, 1], [.5, 1], [1, 1]].forEach(([x, y]) => {
      const b = h("button", { title: "Âncora " + Math.round(x * 100) + "% / " + Math.round(y * 100) + "%", on: { click: () => {
        grid.querySelectorAll(".hit").forEach((o) => o.classList.remove("hit")); b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 700);
        run({ id: "anchor", x, y });
      } } }, h("i"));
      grid.appendChild(b);
    });
    let alignTo = store.get("alignTo", "comp");
    const A = (name, dir, t) => iconBtn("ms-ib", name, t, () => run({ id: "align", dir, to: alignTo }));
    const D = (name, axis, t) => iconBtn("ms-ib", name, t, () => run({ id: "distribute", axis, edge: axis === "h" ? "cx" : "cy" }));
    const S = (name, axis, t) => iconBtn("ms-ib", name, t, () => run({ id: "distribute", axis, mode: "space" }));
    // Left: anchor (stretches to the full height). Right: align on top, sequence below.
    const seq = sequenceCard();
    page.appendChild(h("div", { class: "ms-two" },
      h("div", { class: "ms-card ms-anchorcard" }, h("div", { class: "ms-ch" }, h("b", {}, "Âncora")), grid, h("div", { class: "ms-cap" }, "Escolha um ponto")),
      h("div", { class: "ms-col" }, h("div", { class: "ms-card" }, h("div", { class: "ms-ch" }, h("b", {}, "Alinhar")),
        seg("ms-seg2", [["comp", "Comp"], ["sel", "Seleção"]], alignTo, (v) => { alignTo = v; store.set("alignTo", v); }),
        h("div", { class: "ms-icons" }, A("aLeft", "left", "Esquerda"), A("aHCenter", "hcenter", "Centro horizontal"), A("aRight", "right", "Direita"),
          A("aTop", "top", "Topo"), A("aVCenter", "vcenter", "Centro vertical"), A("aBottom", "bottom", "Base")),
        h("div", { class: "ms-div" }), h("div", { class: "ms-lbl" }, "Distribuir"),
        h("div", { class: "ms-icons" }, D("dH", "h", "Distribuir na horizontal"), D("dV", "v", "Distribuir na vertical"), S("seqRandom", "h", "Espaçamento horizontal igual"))),
        seq.card)));
    page.appendChild(seq.more);
    return page;
  }

  // ------------------------------------------------------------ Sequence
  function sequenceCard() {
    const o = Object.assign({ frames: 4, order: "top", mode: "offset", curve: "linear", step: 1, from: "first", reverse: false }, store.get("seq", {}));
    const save = () => { store.set("seq", o); paint(); };
    const ORDER = { top: "de cima", bottom: "de baixo", sel: "na seleção", random: "aleatória" };
    const orderBtn = h("button", { title: "Ordem: clique para trocar" });
    const meta = h("span", { class: "ms-meta" }, h("span", {}, "0 layers"), orderBtn);
    const lines = h("div", { class: "ms-lines" });
    const runBtn = h("button", { class: "ms-run", title: "Sequenciar as layers selecionadas", on: { click: () => {
      lines.classList.remove("run"); void lines.offsetWidth; lines.classList.add("run");
      run({ id: "sequencePro", frames: o.frames, order: o.order, mode: o.mode, curve: o.curve, step: o.step, from: o.from, reverse: o.reverse });
    } } });
    runBtn.appendChild(ico("play", runBtn));
    function paint() {
      meta.firstChild.textContent = info.sel + " layers";
      orderBtn.innerHTML = ""; orderBtn.append(IC.svg(o.order === "bottom" ? "exportF" : "order"), ORDER[o.order]);
      // preview: one line per layer (max 6), offset by the settings
      lines.innerHTML = "";
      const n = Math.max(3, Math.min(6, info.sel || 3)), len = 34;
      for (let i = 0; i < n; i++) {
        const g = Math.floor(i / o.step), G = Math.ceil(n / o.step), t = G > 1 ? g / (G - 1) : 0;
        const c = o.curve === "in" ? t * t : o.curve === "out" ? 1 - (1 - t) * (1 - t) : o.curve === "inout" ? (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) : t;
        const off = o.mode === "chain" ? g * (len + o.frames * 1.2) : c * (G - 1) * o.frames * 2.2;
        const el = h("i", { style: `--i:${i};margin-left:${Math.min(90, off / 1.6)}%;width:${o.mode === "trim" ? 100 - Math.min(90, off / 1.6) : len}%` });
        lines.appendChild(el);
      }
    }
    orderBtn.addEventListener("click", () => { const k = Object.keys(ORDER); o.order = k[(k.indexOf(o.order) + 1) % k.length]; save(); });
    const gap = dragField("Intervalo", o.frames, -30, 60, "fr", (v) => { o.frames = v; save(); });
    // advanced options (progressive disclosure)
    const more = h("div", { class: "ms-more hidden" },
      field("Modo", seg("st-seg", [["offset", "Início"], ["chain", "Encadear"], ["trim", "Cortar"]], o.mode, (v) => { o.mode = v; save(); })),
      field("Curva", seg("st-seg", [["linear", "Linear"], ["in", "Acelera"], ["out", "Desacelera"], ["inout", "S"]], o.curve, (v) => { o.curve = v; save(); })),
      field("Grupos de", num(o.step, 1, 50, 1, (v) => { o.step = Math.max(1, v); save(); }), h("em", {}, "layer(s) por passo")),
      field("Começar em", seg("st-seg", [["first", "1ª layer"], ["playhead", "Playhead"]], o.from, (v) => { o.from = v; save(); })),
      field("Inverter", toggle(o.reverse, (v) => { o.reverse = v; save(); })));
    const link = h("button", { class: "ms-link" }, "Mais opções", IC.svg("chevronDown"));
    document.addEventListener("mst:info", () => { meta.firstChild.textContent = info.sel + " layers"; if (info.sel) paint(); });
    paint();
    // Options open as a full-width card under the two columns (the right column is narrow).
    const moreCard = h("div", { class: "ms-card hidden" }, h("div", { class: "ms-ch" }, h("b", {}, "Opções da sequência")), more);
    more.classList.remove("hidden");
    link.onclick = null;
    link.addEventListener("click", () => { moreCard.classList.toggle("hidden"); link.classList.toggle("open"); });
    const card = h("div", { class: "ms-card ms-seqcard" }, h("div", { class: "ms-ch" }, h("b", {}, "Sequência")), h("div", { class: "ms-seqmeta" }, meta), lines,
      h("div", { class: "ms-go" }, gap, runBtn), link);
    return { card, more: moreCard };
  }

  // ------------------------------------------------------------ Quick Apply (effects, presets and toolkit actions in a search box)
  let qaItems = null;
  function quickApplyCard() {
    const KEYS = { "ctrl+space": "Ctrl Espaço", "alt+space": isMac() ? "⌥ Espaço" : "Alt Espaço", "shift+space": "⇧ Espaço", "mod+k": isMac() ? "⌘ K" : "Ctrl K" };
    let raw = "ctrl+space"; try { raw = JSON.parse(localStorage.getItem("mp.searchKey")) || raw; } catch (e) {}
    const key = KEYS[raw] || "Ctrl Espaço";
    return h("div", { class: "ms-card" },
      h("div", { class: "ms-ch" }, h("b", {}, "Aplicar rápido"), h("span", { class: "ms-key" }, key)),
      h("div", { style: "display:flex;gap:8px;align-items:flex-end" },
        h("span", { class: "ms-note" }, `${key} abre a busca: efeitos, presets, animações e ferramentas. O atalho muda dentro da própria busca.`),
        h("button", { class: "ms-small", on: { click: openQA } }, "Testar")));
  }
  function isMac() { return /mac/i.test(navigator.platform); }
  // The embedded Motion Panel quick search is the richer one; the local sheet is only a fallback.
  function openQA() { if (window.MPUI && window.MPUI.openSearch) return window.MPUI.openSearch(); openLocalQA(); }
  function openLocalQA() {
    if (document.querySelector(".ms-qa")) return;
    const input = h("input", { placeholder: "Buscar efeito ou preset…" }), list = h("div", { class: "list" });
    const box = h("div", { class: "ms-qa", on: { click: (e) => { if (e.target === box) close(); } } }, h("div", { class: "box" }, input, list, h("div", { class: "foot" }, "↑↓ navegar · Enter aplica · Esc fecha")));
    const close = () => box.remove();
    let rows = [], idx = 0;
    const paint = () => {
      const t = input.value.trim().toLowerCase();
      rows = (qaItems || []).filter((x) => !t || x.n.toLowerCase().indexOf(t) >= 0).slice(0, 60);
      idx = Math.min(idx, Math.max(0, rows.length - 1));
      list.innerHTML = "";
      if (!qaItems) list.appendChild(h("div", { class: "it" }, cep ? "Carregando…" : "Fora do After Effects não há efeitos para listar."));
      rows.forEach((x, i) => list.appendChild(h("div", { class: "it" + (i === idx ? " on" : ""), on: { click: () => { idx = i; go(); } } }, x.n, h("small", {}, x.c))));
      const on = list.querySelector(".on"); if (on) on.scrollIntoView({ block: "nearest" });
    };
    const go = () => {
      const x = rows[idx]; if (!x) return;
      close();
      if (x.p) run({ id: "applyPresetFile", path: x.p, name: x.n }); else run({ id: "addEffect", match: x.m, name: x.n });
    };
    input.addEventListener("input", () => { idx = 0; paint(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowDown") { idx = Math.min(rows.length - 1, idx + 1); paint(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(0, idx - 1); paint(); e.preventDefault(); }
      else if (e.key === "Enter") go();
    });
    document.body.appendChild(box); input.focus(); paint();
    if (!qaItems && cep) run({ id: "listEffects" }, (fx) => {
      run({ id: "listPresets" }, (pr) => { qaItems = (fx || []).concat((pr || []).map((p) => ({ n: p.n, p: p.p, c: "Preset · " + p.c }))); paint(); });
    });
  }

  // ============================================================ TEXTO
  const STYLES = [["fade", "Fade"], ["up", "Subir"], ["slide", "Deslizar"], ["blur", "Blur"], ["zoom", "Zoom"], ["escala", "Elástico"]];
  const UNITS = [["c", "Letras"], ["w", "Palavras"], ["l", "Linhas"]];
  function textPage() {
    const page = h("div", { class: "ms-page" });
    const tiCount = h("span", { class: "ms-meta" }, "0 text layers");
    // ---- slicer
    const sl = Object.assign({ hide: true, label: false }, store.get("slicer", {}));
    const demo = (rows, n0) => h("div", { class: "demo" }, ...rows.map((r) => h("div", {}, ...r.map((t, i) => h("kbd", { style: `--i:${n0 + i}` }, t)))));
    const slice = (unit, title, d) => h("button", { class: "ms-slice", title: "Dividir em " + title.toLowerCase(), on: { click: () => run({ id: "textSlice", unit, hide: sl.hide, label: sl.label }) } }, d, title);
    page.appendChild(h("div", { class: "ms-card" }, h("div", { class: "ms-ch" }, h("b", {}, "Fatiar texto"), tiCount.cloneNode(true)),
      h("div", { class: "ms-slices" }, slice("c", "Letras", demo([["M", "S", "T"]], 0)), slice("w", "Palavras", demo([["Make", "it"]], 0)), slice("l", "Linhas", demo([["Linha um"], ["Linha dois"]], 0))),
      h("div", { style: "margin-top:8px" },
        h("div", { class: "ms-toggle-row" }, h("span", {}, "Ocultar layer original"), toggle(sl.hide, (v) => { sl.hide = v; store.set("slicer", sl); })),
        h("div", { class: "ms-toggle-row" }, h("span", {}, "Colorir novas layers"), toggle(sl.label, (v) => { sl.label = v; store.set("slicer", sl); })))));
    document.addEventListener("mst:info", () => { page.querySelectorAll(".ms-meta").forEach((m) => { m.textContent = info.text + (info.text === 1 ? " text layer" : " text layers"); }); });
    return page;
  }

  // ============================================================ LEGENDAS
  // .srt / .vtt / word-timed .json -> [{ s, e, t, w }]
  function parseCaptions(name, text) {
    const tc = (x) => { const m = x.trim().replace(",", ".").split(":"); return m.length === 3 ? +m[0] * 3600 + +m[1] * 60 + +m[2] : +m[0] * 60 + +m[1]; };
    if (/\.json$/i.test(name)) {
      const j = JSON.parse(text), arr = Array.isArray(j) ? j : j.segments || j.captions || [];
      return arr.map((c) => {
        const words = c.words || [];
        const s = +(c.start ?? c.s ?? (words[0] && words[0].start) ?? 0), e = +(c.end ?? c.e ?? (words.length && words[words.length - 1].end) ?? s + 2);
        return { s, e, t: (c.text ?? words.map((w) => w.word ?? w.text).join(" ")).trim(), w: words.map((w) => Math.max(0, +(w.start ?? w.s) - s)) };
      }).filter((c) => c.t);
    }
    const out = [];
    text.replace(/\r/g, "").split(/\n{2,}/).forEach((block) => {
      const lines = block.split("\n").filter((l) => l.trim() && !/^WEBVTT/.test(l) && !/^NOTE/.test(l));
      const i = lines.findIndex((l) => l.indexOf("-->") >= 0);
      if (i < 0) return;
      const [a, b] = lines[i].split("-->");
      const t = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
      if (t) out.push({ s: tc(a), e: tc(b.trim().split(/\s+/)[0]), t, w: [] });
    });
    return out;
  }
  const LOOK0 = { size: 64, color: "#ffffff", font: "", y: 85, hi: true, hiColor: "#ffd60a", plate: false, plateColor: "#000000", plateOpacity: 75, shadow: true, motion: "fade", per: "caption", mDur: 6 };
  function captionsPage() {
    const page = h("div", { class: "ms-page" });
    const look = Object.assign({}, LOOK0, store.get("look", {}));
    let tab = "look", timer = 0, count = 0;
    const sum = h("div", { class: "ms-sum" }, h("i"), h("span", {}, "Nenhuma legenda"),
      iconBtn("ms-mini", "select", "Selecionar todas as legendas", () => run({ id: "ccSelect" })),
      iconBtn("ms-mini", "refresh", "Reaplicar o estilo", () => run({ id: "ccStyle", style: look })),
      iconBtn("ms-mini", "exportF", "Exportar .srt", () => run({ id: "ccExport" })));
    const recount = () => cep && run({ id: "ccCount" }, (o) => { if (!o) return; count = o.n; sum.classList.toggle("has", count > 0); sum.children[1].textContent = count ? count + " " + T("legendas") : T("Nenhuma legenda"); });
    document.addEventListener("mst:info", () => { if (!document.hidden && page.offsetParent) recount(); });
    const importBtn = h("button", { class: "ms-run light", on: { click: () => run({ id: "ccOpen" }, (f) => {
      if (!f) return;
      let caps = [];
      try { caps = parseCaptions(f.name, f.text); } catch (e) { return flash("Arquivo de legenda inválido: " + e.message, "err"); }
      run({ id: "ccImport", captions: caps, style: look, replace: true }, () => recount());
    }) } }, IC.svg("importF"), "Importar legendas");
    page.appendChild(h("div", { class: "ms-card" }, h("div", { class: "ms-ch" }, h("b", {}, "Legendas"), h("span", { class: "ms-meta" }, ".srt · .vtt · .json")),
      h("div", { class: "ms-ccbar" }, importBtn, h("button", { class: "ms-small", style: "height:34px", on: { click: () => run({ id: "ccSelect" }) } }, "Selecionar")), sum));

    // look / motion / layout, applied live (debounced)
    const push = () => { store.set("look", look); clearTimeout(timer); timer = setTimeout(() => { if (count) run({ id: "ccStyle", style: look }); }, 450); };
    const set = (k) => (v) => { look[k] = v; push(); };
    const row = (title, sub, ...ctl) => h("div", { class: "ms-toggle-row" }, h("span", {}, title, h("small", {}, sub)), ...ctl);
    const body = h("div");
    const savedLooks = store.get("looks", []);
    const savedBox = h("div", { class: "ms-saved" });
    const paintLooks = () => {
      savedBox.innerHTML = "";
      savedLooks.forEach((l, i) => savedBox.appendChild(h("button", { title: "Clique: aplicar · Alt+clique: excluir", on: { click: (e) => {
        if (e.altKey) { savedLooks.splice(i, 1); store.set("looks", savedLooks); paintLooks(); return; }
        Object.assign(look, l.look); push(); paintBody();
      } } }, l.name)));
    };
    const saveLook = h("button", { class: "ms-small", on: { click: () => {
      if (savedLooks.length >= 6) return flash("Limite de 6 looks salvos.", "err");
      savedLooks.push({ name: "Look " + (savedLooks.length + 1), look: Object.assign({}, look) }); store.set("looks", savedLooks); paintLooks(); flash("Look salvo.", "ok");
    } } }, "+ Salvar look");
    function paintBody() {
      body.innerHTML = "";
      if (tab === "look") body.append(
        row("Destaque", "cor da palavra falada", swatch(look.hiColor, set("hiColor")), toggle(look.hi, set("hi"))),
        row("Fundo", "placa atrás da legenda", h("span", { class: "ms-pct" }, look.plateOpacity + "%"), swatch(look.plateColor, set("plateColor")), toggle(look.plate, set("plate"))),
        row("Sombra", "sombra suave no texto", toggle(look.shadow, set("shadow"))),
        row("Cor do texto", "", swatch(look.color, set("color"))));
      if (tab === "motion") body.append(
        field("Entrada", seg("st-seg", [["none", "Nenhuma"], ["fade", "Fade"], ["scale", "Escala"], ["slide", "Slide"]], look.motion, set("motion"))),
        field("Por", seg("st-seg", [["caption", "Legenda"], ["word", "Palavra"]], look.per, set("per"))),
        field("Duração", num(look.mDur, 1, 60, 1, set("mDur")), h("em", {}, "fr")));
      if (tab === "layout") body.append(
        field("Tamanho", num(look.size, 8, 400, 1, set("size")), h("em", {}, "px")),
        field("Altura", h("input", { class: "st-range", type: "range", min: "5", max: "95", value: String(look.y), style: `--p:${(look.y - 5) / 90 * 100}%`,
          on: { input: (e) => { e.target.style.setProperty("--p", (e.target.value - 5) / 90 * 100 + "%"); set("y")(+e.target.value); } } }), h("em", {}, "% da tela")),
        field("Fonte", h("input", { class: "st-num", style: "width:100%;text-align:left;padding:0 8px", placeholder: "Nome PostScript (ex.: Inter-Bold)", value: look.font, on: { change: (e) => set("font")(e.target.value.trim()) } })));
    }
    page.appendChild(h("div", { class: "ms-card" }, h("div", { class: "ms-lookhead" }, saveLook, savedBox),
      seg("ms-seg2", [["look", "Visual"], ["motion", "Movimento"], ["layout", "Layout"]], tab, (v) => { tab = v; paintBody(); }), body));
    paintBody(); paintLooks(); recount();
    return page;
  }

  // ============================================================ shell
  // Six tabs: the Motion Studio pages (Básico, Texto, Legendas) and the embedded Motion Panel screens
  // (Animar = animation library, Ferramentas = all tools, Editar = effects on the selected layer).
  const MARK = '<svg class="ms-mark" viewBox="0 0 24 24"><rect x="2" y="4" width="10" height="4" rx="2" fill="currentColor"/><rect x="7" y="10" width="10" height="4" rx="2" fill="currentColor" opacity=".75"/><rect x="12" y="16" width="10" height="4" rx="2" fill="currentColor" opacity=".5"/></svg>';
  const wrap = (id) => { const sec = $(id); const w = h("div", { class: "ms-page fill" }); if (sec) { sec.classList.remove("hidden"); w.appendChild(sec); } return w; };
  const pages = { basics: basics(), anim: wrap("browse"), tools: wrap("tools"), edit: wrap("edit") };
  const MPV = { anim: "browse", tools: "tools", edit: "edit" };
  const TABS = [["basics", "catAll", "Básico"], ["anim", "catAnim", "Animar"], ["tools", "catUtil", "Ferramentas"], ["edit", "editFx", "Editar"]];
  let cur = store.get("tab", "basics");
  if (!pages[cur]) cur = "basics";
  const tabs = h("nav", { class: "ms-tabbar" });
  TABS.forEach(([id, icon, label]) => {
    const b = h("button", { title: label, on: { click: () => show(id) } });
    b.dataset.id = id;
    b.append(ico(icon, b), h("span", {}, label));
    tabs.appendChild(b);
  });
  function show(v) {
    cur = v; store.set("tab", v);
    tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === v));
    for (const k in pages) pages[k].classList.toggle("hidden", k !== v);
    pages[v].style.animation = "none"; void pages[v].offsetWidth; pages[v].style.animation = "";
    const mp = MPV[v];
    $("app").classList.toggle("fill", !!mp);
    hero.classList.toggle("hidden", !!mp);
    // Drive the Motion Panel view switch (it starts/stops the Edit polling and lays out its boxes).
    const vb = mp && document.querySelector('#views [data-v="' + mp + '"]');
    if (vb) vb.click(); else document.dispatchEvent(new CustomEvent("mp:view", { detail: "studio" }));
  }
  const head = h("div", { class: "ms-head", html: MARK }, h("span", { class: "ms-brand", "data-noi18n": "" }, "Motion Studio"));
  const os = $("openSearch"), lw = document.querySelector(".langwrap");
  if (os) { os.className = "st-icon"; head.appendChild(os); } else head.appendChild(iconBtn("st-icon", "search", "Busca rápida", openQA));
  if (lw) { lw.querySelector("button").className = "st-icon"; head.appendChild(lw); }
  $("app").append(head, tabs, hero, pages.basics, pages.anim, pages.tools, pages.edit);
  // Texto and Legendas live inside Ferramentas as two more categories.
  if (window.MPTools) {
    const tp = textPage(), cp = captionsPage();
    tp.dataset.boxKey = "mst-text"; cp.dataset.boxKey = "mst-cc";
    tp.classList.add("mst-cat"); cp.classList.add("mst-cat");
    window.MPTools.addTab({ id: "mstText", icon: IC.svg("text"), label: "Texto", desc: "Fatiar texto em letras, palavras ou linhas.", build: () => [tp] });
    // Every Workflow option goes to the Básico tab (and leaves Ferramentas).
    const wf = window.MPTools.takeTab("workflow");
    if (wf.length) pages.basics.appendChild(h("div", { class: "ms-wf" }, ...wf));
    window.MPTools.addTab({ id: "mstCaptions", icon: IC.svg("captions"), label: "Legendas", desc: "Importar .srt, .vtt ou .json, estilo, movimento e exportação.", build: () => [cp] });
  }

  const hold = $("mpHold"); if (hold) hold.style.display = "none";
  show(cur);
  paintHero();
  if (cep) refresh(); else { info = { name: "Main Comp", w: 1920, h: 1080, fps: 25, dur: 12, sel: 3, text: 1 }; paintHero(); }
})();
