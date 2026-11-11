// Workflow tools UI: tab strip + stacked sections with compact buttons.
(function () {
  "use strict";
  const { call, setStatus, store } = window.MPUI;
  const $ = (id) => document.getElementById(id);
  const statusEl = $("toolStatus");
  const run = (args, okMsg, onJson) => call("MPT.run", args, okMsg, statusEl, onJson);

  // ------------------------------------------------------------ tiny DOM helpers
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "on") for (const ev in attrs.on) el.addEventListener(ev, attrs.on[ev]);
      else if (k === "class") el.className = attrs[k];
      else if (k === "style") el.style.cssText = attrs[k];
      else if (k in el && k !== "list") el[k] = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    kids.flat().forEach((c) => { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  // data-box-key keeps the original title so the saved arrangement survives a language change.
  const sec = (title, ...kids) => { const s = h("div", { class: "tsec" }, h("h4", {}, title), h("div", { class: "body" }, ...kids)); s.dataset.boxKey = title; return s; };
  // Primary (confirm) buttons are icon-only: ✓ to apply, + to create; the label lives in the tooltip / aria-label.
  const CONFIRM_SVG = { ok: "M5 12.5l4.5 4.5L19 7.5", add: "M12 5v14M5 12h14" };
  const pill = (label, onclick, cls, title) => {
    if ((" " + (cls || "") + " ").indexOf(" primary ") >= 0 && /^(Aplicar|Criar|Montar|Trocar)/.test(label)) {
      const kind = /^(Criar|Create|Montar|Build)/i.test(label) ? "add" : "ok";
      const b = h("button", { class: "confirm", title: title || label, "aria-label": title || label, on: { click: onclick } });
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${CONFIRM_SVG[kind]}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      return b;
    }
    const ic = PILL_ICON[label] || (/^Criar/.test(label) ? "plus" : /^Aplicar/.test(label) ? "check" : /^Salvar/.test(label) ? "save" : /^Carregar/.test(label) ? "download" : /^Escanear/.test(label) ? "search" : null);
    if (!ic || typeof icon !== "function") return h("button", { class: "pill " + (cls || ""), title: title || label, on: { click: onclick } }, label);
    return h("button", { class: "pill withicon " + (cls || ""), title: title || label, on: { click: onclick } }, icon(ic, 15), h("span", {}, label));
  };
  // Icon for each button label (illustrates what the button does).
  const PILL_ICON = {
    "+ Cor": "plus", "Ajuste": "fx", "Ativar marcados": "eye", "Ativar todas": "eye", "Desativar marcados": "eyeOff", "Desativar todas": "eyeOff",
    "Blur": "blurI", "Colar": "paste", "Copiar": "copy", "Contagem": "countdown", "Contorno": "stroke", "Cortar antes": "trimIn", "Cortar depois": "trimOut",
    "Curvas": "graph", "Câmera": "camera", "Desfazer": "undo", "Dividir máscaras": "split", "Duplicar real": "dup", "Ease In": "graph", "Ease Out": "graph",
    "Easy Ease": "graph", "Linear": "graph", "Encaixar": "fit", "Espelho": "mirror", "Esticar": "stretch", "Executar": "play", "Flash": "workflow",
    "Glow": "glow", "Gradiente": "grad", "Grão": "grain", "Inverter": "reverse", "Juntas": "together", "Separadas": "separate", "Ler do keyframe": "key",
    "Letterbox": "letterbox", "Light leak": "sweep", "Limpar paradas": "purge", "Limpar": "purge", "Lower third": "lowerthird", "Lumetri": "lumetri",
    "Luz": "lightI", "MAIÚSCULAS": "caseI", "minúsculas": "caseI", "Título": "caseI", "Motion blur": "motionblur", "Nitidez": "sharpen", "Null pai": "nullI",
    "Null": "nullI", "Organizar": "folder", "Preencher": "fill", "Remover FX": "purge", "Ruído": "noise", "Sequenciar": "seq", "Shape": "shape",
    "Sombra": "shadow", "Sólido": "solidI", "Texto": "textI", "Tint": "tint", "Trocar fonte": "fonts", "Título central": "title", "Usar": "check",
    "Vinheta": "vignette", "Ciclo": "loopvid", "Ping-pong": "reverse", "Offset": "offset", "Continuar": "play", "★ Favoritar": "star",
    "Organizar layers": "labels", "Limpar cache": "purge", "Soft": "glow", "Cinematic": "glow", "Neon": "glow", "Sun": "glow", "Fire": "glow", "Anamorphic": "glow"
  };
  const pills = (items, wide) => h("div", { class: "pills" + (wide ? " wide" : "") + ([].concat(items).some((b) => b && b.classList && b.classList.contains("withicon")) ? " iconpills" : "") }, items);
  const num = (v, w, min) => h("input", { class: "num", type: "number", value: v, style: w ? `width:${w}px` : "", min: min ?? "" });
  const txt = (ph, w) => h("input", { class: "txtin", type: "text", placeholder: ph, style: `width:${w || 80}px` });
  const color = (v) => h("input", { type: "color", value: v });
  const sw = (on) => { const i = h("input", { type: "checkbox", checked: !!on }); return { el: h("span", { class: "switch" }, i, h("i")), input: i }; };
  const line = (...kids) => h("div", { class: "line" }, ...kids);
  const seg = (opts, val) => {
    const box = h("div", { class: "segmented small" });
    box.value = val;
    opts.forEach(([v, l]) => box.appendChild(h("button", { class: v === val ? "on" : "", on: { click: (e) => {
      box.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); box.value = v;
    } } }, l)));
    return box;
  };
  const clean = (s) => String(s || "").replace(/["\\\n\r]/g, "");

  // ------------------------------------------------------------ line icons (24×24, 1.7 stroke, round caps)
  const ICONS = {
    workflow: "M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z",
    shortcuts: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 17h6M17 14v6",
    camera: "M3 7.5h12v9H3zM15 10.5l6-3v9l-6-3",
    templates: "M3.5 4.5h17v15h-17zM3.5 9h17M9 9v10.5",
    graph: "M4 4v16h16M5 19C12 19 10 6 20 6",
    fonts: "M5 19 11 5h2l6 14M7.5 14h9",
    shape: "M12 3.5 20.5 12 12 20.5 3.5 12Z",
    fx: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
    grad: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM12 3v18",
    expr: "M9 4H8a2 2 0 0 0-2 2v3.5L4 12l2 2.5V18a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v3.5l2 2.5-2 2.5V18a2 2 0 0 1-2 2h-1",
    carousel: "M2 9h6v6H2zM8 6.5h8v11H8zM16 9h6v6h-6z",
    sweep: "M4 20 20 4M9 20 20 9M4 15 15 4",
    glitch: "M4 7h10M8 12h12M4 17h8M17 17h3",
    turbulence: "M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0",
    key: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM8 12h8M12 8v8",
    reverse: "M7 7h11l-3-3M17 17H6l3 3",
    cube: "M12 3 20 7.5v9L12 21l-8-4.5v-9ZM12 12l8-4.5M12 12v9M12 12 4 7.5",
    scroll: "M3 8h18M3 16h18M7 4 3 8l4 4M17 12l4 4-4 4",
    loopvid: "M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4",
    beat: "M3 12h3l2-6 4 12 3-9 2 3h4",
    react: "M12 4v3M12 17v3M4 12h3M17 12h3M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
    audio: "M4 10v4h3l5 4V6L7 10ZM16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10",
    fadeEnd: "M4 4h16v16H4zM4 20 20 4",
    format: "M8 3h8v18H8zM3 8h18v8H3z",
    organize: "M4 6h16M4 12h10M4 18h6",
    purge: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
    dolly: "M3 12h8M8 8l4 4-4 4M14 6l7 6-7 6Z",
    hand: "M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.5-3L4 12.5a1.5 1.5 0 0 1 2.5-1.5L8 13",
    impact: "M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3",
    focus: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    rack: "M3 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M15 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9 12h6M13 10l2 2-2 2",
    entrance: "M12 20V8M7 13l5-5 5 5M5 4h14",
    escape: "M12 4v12M7 11l5 5 5-5M5 20h14",
    reveal: "M3 12h14M13 8l4 4-4 4M21 5v14",
    zoomBeat: "M11 11m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M20 20l-4.5-4.5M11 8v6M8 11h6",
    build: "M4 14h7v6H4zM13 14h7v6h-7zM8 4h8v6H8z",
    volume: "M4 10v4h3l5 4V6L7 10ZM16 9.5a3.5 3.5 0 0 1 0 5",
    mute: "M4 10v4h3l5 4V6L7 10ZM16 9.5l5 5M21 9.5l-5 5",
    duck: "M3 8h5l3 8h3l3-8h4M3 18h18",
    crossfade: "M3 6c6 0 12 12 18 12M3 18c6 0 12-12 18-12",
    match: "M5 20V9M10 20V5M15 20V9M20 20V5M3 12h18",
    eq: "M6 4v16M12 4v16M18 4v16M4 14h4M10 8h4M16 16h4",
    wave: "M3 12h2l1.5-5 2 10 2-14 2 18 2-12 2 6 1.5-3H21",
    spectrum: "M4 20v-4M8 20V8M12 20v-9M16 20V5M20 20v-7",
    plus: "M12 5v14M5 12h14",
    check: "M5 12.5l4.5 4.5L19 7.5",
    search: "M5 11a6 6 0 1 0 12 0a6 6 0 1 0-12 0M20 20l-4.5-4.5",
    eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    eyeOff: "M3 3l18 18M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.2 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1",
    blurI: "M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10ZM9 14h6M10 17h4",
    download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14",
    copy: "M8 8h12v12H8zM16 8V4H4v12h4",
    paste: "M8 5H6v15h12V5h-2M9 3h6v4H9z",
    stroke: "M4 4h16v16H4zM8 8h8v8H8z",
    trimIn: "M9 4v16M11 8h9v8h-9M3 12h3",
    trimOut: "M15 4v16M4 8h9v8H4M18 12h3",
    undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
    split: "M12 3v18M3 8h6v8H3zM15 8h6v8h-6z",
    dup: "M3 8h12v12H3zM9 3h12v12",
    fit: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M8 8h8v8H8z",
    mirror: "M12 3v18M9 7 4 12l5 5M15 7l5 5-5 5",
    stretch: "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4",
    play: "M8 5.5v13l10.5-6.5Z",
    grain: "M6 6h.01M12 7h.01M18 6h.01M8 12h.01M15 11h.01M5 17h.01M11 17h.01M18 17h.01",
    letterbox: "M3 5h18v14H3zM3 8.5h18M3 15.5h18",
    lowerthird: "M3 4h18v16H3zM5 14h11M5 17h7",
    lumetri: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM12 3v18M12 12 19.5 7",
    lightI: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
    motionblur: "M14 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0M3 9h7M2 12h8M3 15h7",
    sharpen: "M12 3 4 20h16Z",
    nullI: "M5 5h14v14H5z",
    fill: "M5 5h14v14H5zM5 12h14v7H5z",
    noise: "M3 12h2l1.5-5 2 10 2-14 2 18 2-12 2 6 1.5-3H21",
    save: "M5 4h11l3 3v13H5ZM8 4v5h7V4M8 20v-6h8v6",
    seq: "M3 5h8M7 11h8M11 17h10",
    shadow: "M4 4h12v12H4zM8 20h12V8",
    solidI: "M6 6h12v12H6z",
    textI: "M6 6h12M12 6v13M9.5 19h5",
    tint: "M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10Z",
    title: "M4 5h16v14H4zM8 11h8M10 14h4",
    vignette: "M3 4h18v16H3zM12 7a6 5 0 1 0 0 10a6 5 0 1 0 0-10",
    together: "M3 9h10v10H3zM11 5h10v10H11z",
    separate: "M3 3h8v8H3zM13 13h8v8h-8z",
    countdown: "M12 13V9M10 3h4M12 21a8 8 0 1 0 0-16a8 8 0 1 0 0 16",
    offset: "M3 17h6v-5h6V7h6",
    star: "M12 4l2.4 5 5.4.8-3.9 3.8.9 5.4-4.8-2.5L7.2 19l.9-5.4-3.9-3.8 5.4-.8Z",
    caseI: "M3 17l3.5-10L10 17M4.2 13.5h4.6M14 17V11M14 13.5a2.5 2.5 0 1 1 5 0V17",
    folder: "M3 7h6l2 2h10v10H3z",
    labels: "M4 7h16M4 12h16M4 17h16M7 7h.01M7 12h.01M7 17h.01",
    tpSize: "M4 18 9 6l5 12M5.6 14h6.8M16 18l2.5-6 2.5 6M16.8 16.2h3.4",
    tpLead: "M7 4v16M4 7l3-3 3 3M4 17l3 3 3-3M13 7h7M13 12h7M13 17h7",
    tpTrack: "M3 15l3-8 3 8M4 12.5h4M13 15V7h3a2 2 0 0 1 0 4h-3M3 19h18M18 17l3 2-3 2M6 17l-3 2 3 2",
    tpStrokeW: "M4 6h16M4 11h16M4 17h16",
    tpVScale: "M7 20V4M4 7l3-3 3 3M4 17l3 3 3-3M13 18l3-12 3 12M14 14h4",
    tpHScale: "M4 7h16M7 4 4 7l3 3M17 4l3 3-3 3M8 20l4-10 4 10M9.4 17h5.2",
    tpBase: "M4 20h16M6 16l3-10 3 10M7 13h4M16 8v8M14 10l2-2 2 2",
    tpTsume: "M5 8v8M19 8v8M9 12h6M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2",
    jLeft: "M4 6h16M4 10h10M4 14h16M4 18h10", jCenter: "M4 6h16M7 10h10M4 14h16M7 18h10", jRight: "M4 6h16M10 10h10M4 14h16M10 18h10",
    jFullL: "M4 6h16M4 10h16M4 14h16M4 18h9", jFullC: "M4 6h16M4 10h16M4 14h16M7.5 18h9", jFullR: "M4 6h16M4 10h16M4 14h16M11 18h9", jFull: "M4 6h16M4 10h16M4 14h16M4 18h16",
    pInL: "M4 4v16M8 6h12M12 10h8M12 14h8M8 18h12", pInR: "M20 4v16M4 6h12M4 10h8M4 14h8M4 18h12", pInF: "M10 6h10M4 10h16M4 14h16M4 18h16M4 4v4",
    pSpB: "M4 9h16M4 13h16M4 17h16M12 3v3M10 5l2-2 2 2", pSpA: "M4 4h16M4 8h16M4 12h16M12 21v-3M10 19l2 2 2-2",
    glow: "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0"
  };
  function icon(name, size) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("class", "ico");
    if (size) { s.setAttribute("width", size); s.setAttribute("height", size); }
    s.innerHTML = `<path d="${ICONS[name] || ICONS.shortcuts}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
    return s;
  }
  window.MPUI.icon = icon;

  // ------------------------------------------------------------ align / distribute glyphs (bars + guide line)
  const R = (x, y, w, hh) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="1" fill="currentColor"/>`;
  const Lh = (x) => `<path d="M${x} 3v18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
  const ALIGN_G = {
    left: Lh(4) + R(6, 6, 13, 4) + R(6, 14, 8, 4), hcenter: Lh(12) + R(5, 6, 14, 4) + R(8, 14, 8, 4), right: Lh(20) + R(5, 6, 13, 4) + R(10, 14, 8, 4),
    dl: R(5, 5, 3, 14) + R(11, 8, 3, 8) + R(17, 6, 3, 12) + `<path d="M5 3v2M11 3v5M17 3v3" stroke="currentColor" stroke-width="1.3"/>`,
    dc: R(4, 5, 3, 14) + R(10.5, 8, 3, 8) + R(17, 6, 3, 12) + `<path d="M5.5 3v18M12 3v18M18.5 3v18" stroke="currentColor" stroke-width="1" opacity=".55"/>`,
    dr: R(4, 5, 3, 14) + R(10, 8, 3, 8) + R(16, 6, 3, 12) + `<path d="M7 3v2M13 3v5M19 3v3" stroke="currentColor" stroke-width="1.3"/>`,
    space: R(3, 6, 5, 12) + R(16, 6, 5, 12) + `<path d="M9.5 12h5M11 10.5 9.5 12l1.5 1.5M13 10.5l1.5 1.5-1.5 1.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`
  };
  // Vertical variants are the horizontal drawings rotated 90° (top = left rotated, etc.).
  function alignGlyph(name) {
    const rot = { top: "left", vcenter: "hcenter", bottom: "right", dt: "dl", dcv: "dc", db: "dr", vspace: "space" };
    const base = rot[name] || name, s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.innerHTML = rot[name] ? `<g transform="rotate(90 12 12)">${ALIGN_G[base]}</g>` : ALIGN_G[base];
    return s;
  }
  const iconBtn = (name, title, onclick) => h("button", { class: "ibtn", title, "aria-label": title, on: { click: onclick } }, alignGlyph(name));

  // ------------------------------------------------------------ catalog list: click opens options, right-click applies with the last options
  function catalogSec(title, items, hint) {
    const list = h("div", { class: "catalog" });
    items.forEach((it) => {
      const key = "sc." + it.id + "." + JSON.stringify(it.args || {});
      const saved = store.get(key, {});
      const inputs = {};
      const detail = h("div", { class: "cat-detail hidden" });
      (it.params || []).forEach((p) => {
        let el;
        const v = saved[p.k] !== undefined ? saved[p.k] : p.v;
        if (p.type === "select") {
          el = h("select", {}, ...p.opts.map(([val, lab]) => h("option", { value: val }, lab)));
          el.value = v;
        } else if (p.type === "color") el = color(v);
        else { el = num(v, p.w || 52); if (p.step) el.step = p.step; }
        inputs[p.k] = { el, p };
        detail.appendChild(h("label", { class: "line" }, h("span", { style: "min-width:70px" }, p.label), el, p.suffix ? h("em", { class: "hint" }, p.suffix) : null));
      });
      const values = () => {
        const out = {};
        for (const k in inputs) {
          const { el, p } = inputs[k];
          out[k] = p.type === "select" ? (p.numeric ? +el.value : el.value) : p.type === "color" ? el.value : +el.value;
        }
        return out;
      };
      const exec = () => {
        const vals = values();
        store.set(key, vals);
        run(Object.assign({ id: it.id }, it.args || {}, it.map ? it.map(vals) : vals));
      };
      detail.appendChild(h("div", { class: "line" }, h("span", { class: "sp" }), pill("Aplicar", exec, "primary")));
      const row = h("div", { class: "cat-row", title: it.desc, on: {
        click: () => {
          const open = detail.classList.contains("hidden");
          list.querySelectorAll(".cat-detail").forEach((d) => d.classList.add("hidden"));
          list.querySelectorAll(".cat-row").forEach((r) => r.classList.remove("on"));
          if (open) { detail.classList.remove("hidden"); row.classList.add("on"); }
        },
        contextmenu: (e) => { e.preventDefault(); exec(); }
      } }, h("span", { class: "cat-ico" }, icon(it.icon)), h("span", { class: "cat-txt" }, h("b", {}, it.name), h("small", {}, it.desc)), h("span", { class: "cat-chev" }, "›"));
      list.appendChild(row);
      list.appendChild(detail);
    });
    const out = sec(title, list, hint ? h("span", { class: "hint" }, hint) : null);
    out.classList.add("catalogsec");
    return out;
  }

  // ============================================================ GLOW (own implementation with native effects)
  const GLOW_PRESETS = [
    ["Suave", { radius: 10, exposure: -0.5, threshold: 60, smooth: 25, spread: 0.55, steps: 5, tint: false, aspect: 1, angle: 0, ca: 0 }],
    ["Cinemático", { radius: 14, exposure: 0, threshold: 70, smooth: 20, spread: 0.65, steps: 6, tint: true, color: "#ffb36b", aspect: 1, angle: 0, ca: 0 }],
    ["Neon", { radius: 6, exposure: 1, threshold: 30, smooth: 30, spread: 0.7, steps: 7, tint: true, color: "#2fd5ff", aspect: 1, angle: 0, ca: 2 }],
    ["Sol", { radius: 18, exposure: 0.8, threshold: 75, smooth: 15, spread: 0.72, steps: 7, tint: true, color: "#ffcf5a", aspect: 1, angle: 0, ca: 0 }],
    ["Fogo", { radius: 12, exposure: 1.2, threshold: 45, smooth: 25, spread: 0.68, steps: 6, tint: true, color: "#ff5a1f", aspect: 1, angle: 0, ca: 1, unmult: true }],
    ["Anamórfico", { radius: 16, exposure: 0.5, threshold: 65, smooth: 15, spread: 0.7, steps: 7, tint: true, color: "#6aa8ff", aspect: 4, angle: 0, ca: 3 }]
  ];
  function glow() {
    const saved = Object.assign({}, GLOW_PRESETS[1][1], store.get("glow2", {}));
    const N = (v, w, min, step) => { const i = num(v, w || 46, min); if (step) i.step = step; return i; };
    const f = {
      radius: N(saved.radius, 46, 1), exposure: N(saved.exposure, 46, undefined, "0.1"), threshold: N(saved.threshold, 46, 0), smooth: N(saved.smooth, 46, 0),
      spread: N(saved.spread, 46, 0.05, "0.01"), steps: N(saved.steps, 40, 2), aspect: N(saved.aspect, 46, 0.1, "0.1"), angle: N(saved.angle, 46), ca: N(saved.ca, 46, 0, "0.5")
    };
    const mode = seg([["add", "Adicionar"], ["screen", "Tela"]], saved.mode || "add");
    const tint = sw(!!saved.tint), col = color(saved.color || "#ffb36b"), dither = sw(saved.dither !== false), linear = sw(!!saved.linear), unmult = sw(!!saved.unmult);
    const set = (p) => {
      for (const k in f) if (p[k] !== undefined) f[k].value = p[k];
      tint.input.checked = !!p.tint; if (p.color) col.value = p.color; unmult.input.checked = !!p.unmult;
    };
    const values = () => {
      const v = {};
      for (const k in f) v[k] = +f[k].value;
      return Object.assign(v, { mode: mode.value, tint: tint.input.checked, color: col.value, dither: dither.input.checked, linear: linear.input.checked, unmult: unmult.input.checked });
    };
    // Live sketch of the result: bloom rings (radius ×2, intensity × spread), aspect/angle and colour fringes.
    const viz = h("canvas", { width: 360, height: 130, style: "width:100%;max-width:360px;height:130px;border-radius:10px;background:#0b0b0d" });
    const draw = () => {
      const v = values(), c = viz.getContext("2d"), cx = 180, cy = 65;
      c.clearRect(0, 0, 360, 130);
      const layer = (rgb, dx) => {
        c.globalCompositeOperation = "lighter";
        for (let k = v.steps - 1; k >= 0; k--) {
          const r = Math.min(170, v.radius * Math.pow(2, k) * 0.3 + 6);
          const thr = Math.max(0, v.threshold - v.smooth * (v.steps > 1 ? k / (v.steps - 1) : 0));
          const a = Math.min(1, Math.pow(2, v.exposure) * Math.pow(v.spread, k) * (1.15 - thr / 100) * 0.6);
          const g = c.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, r);
          g.addColorStop(0, rgb); g.addColorStop(1, "rgba(0,0,0,0)");
          c.globalAlpha = a;
          c.save(); c.translate(cx, cy); c.rotate((v.angle * Math.PI) / 180); c.scale(Math.min(3, Math.sqrt(v.aspect)), 1 / Math.max(0.33, Math.sqrt(v.aspect))); c.translate(-cx, -cy);
          c.fillStyle = g; c.beginPath(); c.arc(cx + dx, cy, r, 0, Math.PI * 2); c.fill(); c.restore();
        }
      };
      if (v.ca > 0) { layer("#ff2a2a", -v.ca * 1.5); layer("#2a5bff", v.ca * 1.5); }
      layer(v.tint ? v.color : "#ffffff", 0);
      c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
      c.fillStyle = "#fff"; c.font = "600 22px -apple-system, Segoe UI, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("GLOW", cx, cy);
    };
    Object.values(f).concat([col, tint.input]).forEach((x) => x.addEventListener("input", draw));
    tint.input.addEventListener("change", draw);
    setTimeout(draw, 0);
    const apply = () => { const v = values(); store.set("glow2", v); run(Object.assign({ id: "physGlow" }, v)); };
    return [
      sec("Glow", viz, pills(GLOW_PRESETS.map(([n, p]) => pill(n, () => { set(p); draw(); }))),
        line(h("span", { class: "sp" }), pill("Aplicar glow", apply, "primary")),
        h("span", { class: "hint" }, "Reaplicar substitui o glow anterior. Depois de aplicar, tudo continua ajustável nos sliders “MP Glow -” da layer.")),
      sec("Brilho", line("Raio", f.radius, "Exposição", f.exposure, h("em", { class: "hint" }, "stops")),
        line("Espalhamento", f.spread, "Camadas", f.steps), line("Modo", mode)),
      sec("Limiar", line("Limiar", f.threshold, h("em", { class: "hint", style: "margin-right:8px" }, "%"), "Suavizar", f.smooth, h("em", { class: "hint" }, "%")),
        h("span", { class: "hint" }, "Suavizar abaixa o limiar das camadas mais largas, dando uma transição macia.")),
      sec("Forma e cor", line("Proporção", f.aspect, "Ângulo", f.angle, h("em", { class: "hint" }, "°")),
        line("Tingir", tint.el, col), line("Aberração cromática", f.ca, h("em", { class: "hint" }, "px"))),
      sec("Acabamento", line("Dither (anti-banding)", dither.el), line("Blending linear do projeto", linear.el),
        line("Fundo preto vira transparente", unmult.el), h("span", { class: "hint" }, "Fundo preto aplica o modo Tela na layer (bom para fogo, partículas e light leaks)."))
    ];
  }

  // ============================================================ SHORTCUTS (Atalhos)
  const FORMATS = [["stories", "Stories 9:16 (1080×1920)"], ["feed", "Feed 4:5 (1080×1350)"], ["square", "Quadrado 1:1 (1080×1080)"], ["landscape", "Paisagem 16:9 (1920×1080)"]];
  const FORMAT_SIZE = { stories: [1080, 1920, "9x16"], feed: [1080, 1350, "4x5"], square: [1080, 1080, "1x1"], landscape: [1920, 1080, "16x9"] };
  function shortcuts() {
    return [
      catalogSec("Efeitos", [
        { id: "lightSweep", name: "Light Sweep", icon: "sweep", desc: "Faixa de brilho atravessa a layer a partir do playhead.", params: [{ k: "frames", label: "Duração", v: 24, suffix: "fr" }] },
        { id: "glitchFx", name: "Glitch contínuo", icon: "glitch", desc: "Distorções e saltos aleatórios, ajustáveis por sliders.", params: [{ k: "chance", label: "Frequência", v: 18, suffix: "%" }, { k: "fps", label: "Ritmo", v: 12, suffix: "fps" }] },
        { id: "turbulence", name: "Turbulência", icon: "turbulence", desc: "Ondulação orgânica animada (bandeira, água, calor).", params: [{ k: "amount", label: "Intensidade", v: 30 }, { k: "speed", label: "Velocidade", v: 120, suffix: "°/s" }] },
        { id: "chromaKey", name: "Chroma key", icon: "key", desc: "Remove o fundo verde ou azul com o Keylight.", params: [{ k: "color", label: "Cor do fundo", type: "color", v: "#00b140" }] }
      ], "Clique para ver as opções. Clique direito aplica direto com as últimas opções."),
      catalogSec("Keyframes e 3D", [
        { id: "reverseKeys", name: "Inverter keys", icon: "reverse", desc: "Espelha no tempo os keyframes selecionados (ou todos da propriedade)." },
        { id: "toggle3D", name: "Ativar 3D", icon: "cube", desc: "Liga ou desliga o 3D das layers selecionadas." }
      ]),
      catalogSec("Loops de mídia", [
        { id: "infiniteScroll", name: "Esteira infinita", icon: "scroll", desc: "Repete a layer em mosaico e faz ela rolar sem fim.", params: [{ k: "vx", label: "Vel. X", v: 120, suffix: "px/s" }, { k: "vy", label: "Vel. Y", v: 0, suffix: "px/s" }] },
        { id: "infiniteVideo", name: "Vídeo infinito", icon: "loopvid", desc: "Vídeo ou precomp em loop até o fim da composição." }
      ]),
      catalogSec("Áudio e final", [
        { id: "markBeats", name: "Marcar batidas", icon: "beat", desc: "Analisa a música selecionada e cria marcadores nas batidas.", params: [{ k: "sensitivity", label: "Sensibilidade", v: 40, suffix: "%" }, { k: "gap", label: "Intervalo mín.", v: 8, suffix: "fr" }] },
        { id: "reactBeat", name: "Reagir à batida", icon: "react", desc: "Selecione a música e as layers: a escala pulsa com o som.", params: [{ k: "amount", label: "Intensidade", v: 15, suffix: "%" }] },
        { id: "fadeAudio", name: "Fade de áudio", icon: "audio", desc: "Entrada e saída suaves no volume das layers selecionadas.", params: [{ k: "fadeIn", label: "Entrada", v: 15, suffix: "fr" }, { k: "fadeOut", label: "Saída", v: 30, suffix: "fr" }] },
        { id: "fadeFinal", name: "Fade final", icon: "fadeEnd", desc: "Escurece tudo no fim da área de trabalho.", params: [{ k: "frames", label: "Duração", v: 20, suffix: "fr" }, { k: "color", label: "Cor", type: "color", v: "#000000" }] }
      ]),
      catalogSec("Composição", [
        { id: "convertFormat", name: "Stories ↔ Feed", icon: "format", desc: "Cria uma cópia da comp em outro formato, já reenquadrada.",
          params: [{ k: "format", label: "Formato", type: "select", opts: FORMATS, v: "stories" }, { k: "mode", label: "Encaixe", type: "select", opts: [["fit", "Caber inteiro"], ["fill", "Preencher"]], v: "fill" }],
          map: (v) => ({ w: FORMAT_SIZE[v.format][0], h: FORMAT_SIZE[v.format][1], label: FORMAT_SIZE[v.format][2], mode: v.mode }) },
        { id: "organizeLayers", name: "Organizar camadas", icon: "organize", desc: "Cores de label por tipo: texto, shape, precomp, vídeo, áudio, null…" }
      ]),
      catalogSec("Limpeza", [
        { id: "purgeCache", name: "Limpar cache", icon: "purge", desc: "Libera a memória e o cache de disco do After Effects." }
      ])
    ];
  }

  // ============================================================ WORKFLOW
  function workflow() {
    const alignTo = h("select", {}, h("option", { value: "comp" }, "Composição"), h("option", { value: "sel" }, "Seleção"));
    alignTo.value = store.get("alignTo", "comp");
    alignTo.addEventListener("change", () => store.set("alignTo", alignTo.value));
    const A = (dir, t) => iconBtn(dir, t, () => run({ id: "align", dir, to: alignTo.value }));
    const D = (g, axis, edge, t) => iconBtn(g, t, () => run({ id: "distribute", axis, edge }));
    const S = (g, axis, t) => iconBtn(g, t, () => run({ id: "distribute", axis, mode: "space" }));
    const sep = () => h("span", { class: "vsep" });
    const cap = (t) => h("div", { class: "cap" }, t);
    const anchor = h("div", { class: "grid3" });
    [["↖", 0, 0], ["↑", .5, 0], ["↗", 1, 0], ["←", 0, .5], ["•", .5, .5], ["→", 1, .5], ["↙", 0, 1], ["↓", .5, 1], ["↘", 1, 1]]
      .forEach(([g, x, y]) => anchor.appendChild(pill(g, () => run({ id: "anchor", x, y }), "", "Âncora " + g)));

    const solidColor = color("#1c1c1e");
    const C = (kind, l) => pill(l, () => run({ id: "create", kind, color: solidColor.value }));
    const F = (fx, l) => pill(l, () => run({ id: "fx", fx }));
    const SKIP = window.MST_EMBED ? { "Alinhar e distribuir": 1, "Âncora": 1 } : {};

    return [
      // Layout after the classic align panel: Align / Distribute / Distribute Spacing + Align To.
      sec("Alinhar e distribuir", h("div", { class: "alignpanel" },
        h("div", {}, cap("Alinhar"), h("div", { class: "iconrow" },
          A("left", "Alinhar à esquerda"), A("hcenter", "Centralizar na horizontal"), A("right", "Alinhar à direita"), sep(),
          A("top", "Alinhar ao topo"), A("vcenter", "Centralizar na vertical"), A("bottom", "Alinhar à base"))),
        h("div", {}, cap("Distribuir"), h("div", { class: "iconrow" },
          D("dl", "h", "l", "Distribuir pelas bordas esquerdas"), D("dc", "h", "cx", "Distribuir pelos centros horizontais"), D("dr", "h", "r", "Distribuir pelas bordas direitas"), sep(),
          D("dt", "v", "t", "Distribuir pelos topos"), D("dcv", "v", "cy", "Distribuir pelos centros verticais"), D("db", "v", "b", "Distribuir pelas bases"))),
        h("div", { class: "alignrow2" },
          h("div", {}, cap("Distribuir espaçamento"), h("div", { class: "iconrow" }, S("space", "h", "Espaçamento horizontal igual"), S("vspace", "v", "Espaçamento vertical igual"))),
          h("div", {}, cap("Alinhar a"), alignTo)))),
      sec("Âncora", line(anchor, h("span", { class: "hint" }, "Move o anchor point sem deslocar a layer."))),
      // Two columns of the same height: Precomp | Projeto.
      sec("Precomp e projeto", h("div", { class: "twocol" },
        h("div", { class: "colbox" }, h("div", { class: "colcap" }, icon("together", 14), "Precomp"), h("div", { class: "pills colpills" },
          pill("Juntas", () => run({ id: "precomp", mode: "together" }), "", "Precompor as selecionadas juntas"),
          pill("Separadas", () => run({ id: "precomp", mode: "separate" }), "", "Uma precomp por layer"),
          pill("Desfazer", () => run({ id: "unprecomp" }), "", "Trazer as layers da precomp de volta"),
          pill("Duplicar real", () => run({ id: "trueDup" }), "", "Duplica a precomp com uma comp independente"))),
        h("div", { class: "colbox" }, h("div", { class: "colcap" }, icon("folder", 14), "Projeto"), h("div", { class: "pills colpills" },
          pill("Organizar", () => run({ id: "organize" }), "", "Organiza o painel Projeto em pastas"),
          pill("Organizar layers", () => run({ id: "organizeLayers" }), "", "Pinta as layers da comp por tipo (texto, shape, vídeo…)"))))),
      sec("Criar layer", line("Cor do sólido", solidColor),
        pills([C("solid", "Sólido"), C("null", "Null"), C("camera", "Câmera"), C("light", "Luz"), C("text", "Texto"), C("shape", "Shape"), C("adj", "Ajuste")])),
      sec("Efeitos rápidos", pills([F("glow", "Glow"), F("fill", "Preencher"), F("tint", "Tint"), F("blur", "Blur"), F("ramp", "Gradiente"), F("mirror", "Espelho"),
        F("shadow", "Sombra"), F("curves", "Curvas"), F("lumetri", "Lumetri"), F("stroke", "Contorno"), F("noise", "Ruído"), F("sharpen", "Nitidez")]),
        pill("Remover FX", () => run({ id: "removeFx" }), "danger wide-btn", "Remove todos os efeitos das layers selecionadas")),
      ...textParagraph(),
      sec("Repetir keyframes (loopOut)", pills([["cycle", "Ciclo"], ["pingpong", "Ping-pong"], ["offset", "Offset"], ["continue", "Continuar"]]
        .map(([k, l]) => pill(l, () => run({ id: "loopOut", kind: k }))))),
    ].filter((x) => !SKIP[x.dataset.boxKey]);
  }

  // ============================================================ TEXT & PARAGRAPH
  function textParagraph() {
    const set = (props) => run({ id: "textStyle", set: props });
    const fontIn = h("input", { class: "txtin", style: "flex:1;min-width:0", placeholder: "Fonte (PostScript)", list: "mpFontsTP" });
    fontIn.setAttribute("list", "mpFontsTP");
    const dl = h("datalist", { id: "mpFontsTP" });
    fontIn.addEventListener("change", () => fontIn.value.trim() && set({ font: fontIn.value.trim() }));
    const field = (ic, title, key, unit, w, step) => {
      const i = num("", w || 46); i.step = step || 1; i.placeholder = "—";
      i.addEventListener("change", () => i.value !== "" && set({ [key]: +i.value }));
      return [h("label", { class: "tp-f", title }, icon(ic, 15), i, unit ? h("em", { class: "hint" }, unit) : null), i];
    };
    const [fSize, iSize] = field("tpSize", "Tamanho da fonte", "fontSize", "px", 50);
    const [fLead, iLead] = field("tpLead", "Entrelinha (vazio = automática)", "leading", "px", 50);
    const [fTrack, iTrack] = field("tpTrack", "Espaçamento entre letras (tracking)", "tracking", "", 50);
    const [fStrokeW, iStrokeW] = field("tpStrokeW", "Espessura do contorno", "strokeWidth", "px", 44, 0.5);
    const [fVs, iVs] = field("tpVScale", "Escala vertical", "verticalScale", "%", 46);
    const [fHs, iHs] = field("tpHScale", "Escala horizontal", "horizontalScale", "%", 46);
    const [fBase, iBase] = field("tpBase", "Deslocamento da linha de base", "baselineShift", "px", 46);
    const [fTsume, iTsume] = field("tpTsume", "Tsume (aperta o espaço ao redor dos caracteres)", "tsume", "%", 46);
    const fillOn = h("input", { type: "checkbox", checked: true }), strokeOn = h("input", { type: "checkbox" });
    const fillC = color("#ffffff"), strokeC = color("#000000");
    fillOn.addEventListener("change", () => set({ applyFill: fillOn.checked }));
    strokeOn.addEventListener("change", () => set({ applyStroke: strokeOn.checked }));
    fillC.addEventListener("change", () => { fillOn.checked = true; set({ fillColor: fillC.value, applyFill: true }); });
    strokeC.addEventListener("change", () => { strokeOn.checked = true; set({ strokeColor: strokeC.value, applyStroke: true }); });
    const tog = (label, title, key) => {
      const b = h("button", { class: "tp-tog", title, on: { click: () => { b.classList.toggle("on"); set({ [key]: b.classList.contains("on") }); } } });
      b.innerHTML = label; return b;
    };
    const tAll = tog("TT", "Tudo em maiúsculas", "allCaps"), tSmall = tog("T<small>T</small>", "Versalete", "smallCaps"),
      tSup = tog("T<sup>1</sup>", "Sobrescrito", "superscript"), tSub = tog("T<sub>1</sub>", "Subscrito", "subscript"),
      tBold = tog("<b>T</b>", "Negrito falso", "fauxBold"), tItal = tog("<i>T</i>", "Itálico falso", "fauxItalic");
    const just = h("div", { class: "tp-just" });
    [["left", "jLeft", "Alinhar à esquerda"], ["center", "jCenter", "Centralizar"], ["right", "jRight", "Alinhar à direita"],
     ["fullLeft", "jFullL", "Justificar, última linha à esquerda"], ["fullCenter", "jFullC", "Justificar, última linha centralizada"],
     ["fullRight", "jFullR", "Justificar, última linha à direita"], ["full", "jFull", "Justificar tudo"]].forEach(([v, ic, t]) => {
      const b = h("button", { class: "tp-tog", title: t, on: { click: () => { just.querySelectorAll(".on").forEach((x) => x.classList.remove("on")); b.classList.add("on"); set({ justification: v }); } } }, icon(ic, 16));
      b.dataset.v = v; just.appendChild(b);
    });
    const [fInL, iInL] = field("pInL", "Recuo à esquerda", "startIndent", "px", 44);
    const [fInR, iInR] = field("pInR", "Recuo à direita", "endIndent", "px", 44);
    const [fInF, iInF] = field("pInF", "Recuo da primeira linha", "firstLineIndent", "px", 44);
    const [fSpB, iSpB] = field("pSpB", "Espaço antes do parágrafo", "spaceBefore", "px", 44);
    const [fSpA, iSpA] = field("pSpA", "Espaço depois do parágrafo", "spaceAfter", "px", 44);
    // Reads the first selected text layer and fills every control.
    const read = () => run({ id: "textRead" }, null, (t) => {
      fontIn.value = t.font || ""; iSize.value = t.fontSize ?? ""; iLead.value = t.autoLeading ? "" : (t.leading ?? ""); iTrack.value = t.tracking ?? "";
      iStrokeW.value = t.strokeWidth ?? ""; iVs.value = t.verticalScale ?? ""; iHs.value = t.horizontalScale ?? ""; iBase.value = t.baselineShift ?? ""; iTsume.value = t.tsume ?? "";
      fillOn.checked = !!t.applyFill; strokeOn.checked = !!t.applyStroke;
      if (t.fillColor) fillC.value = t.fillColor; if (t.strokeColor) strokeC.value = t.strokeColor;
      [[tAll, "allCaps"], [tSmall, "smallCaps"], [tSup, "superscript"], [tSub, "subscript"], [tBold, "fauxBold"], [tItal, "fauxItalic"]].forEach(([b, k]) => b.classList.toggle("on", !!t[k]));
      just.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === t.justification));
      iInL.value = t.startIndent ?? ""; iInR.value = t.endIndent ?? ""; iInF.value = t.firstLineIndent ?? ""; iSpB.value = t.spaceBefore ?? ""; iSpA.value = t.spaceAfter ?? "";
      setStatus(statusEl, "Valores lidos de “" + t.layer + "”.", "ok");
    });
    const loadFonts = () => run({ id: "fontsAll" }, null, (names) => { dl.innerHTML = ""; names.forEach((n) => dl.appendChild(h("option", { value: n }))); });
    const readBtn = h("button", { class: "sq", title: "Ler da layer: preenche os campos com o texto selecionado", on: { click: read } }, icon("eye", 15));
    return [
      sec("Texto", line(fontIn, dl, h("button", { class: "sq", title: "Carregar fontes do sistema para autocompletar", on: { click: loadFonts } }, icon("download", 15)), readBtn),
        h("div", { class: "tp-grid" }, fSize, fLead, fTrack, fStrokeW, fVs, fHs, fBase, fTsume),
        h("div", { class: "tp-colors" }, h("label", { class: "tp-c" }, fillOn, fillC, "Preenchimento"), h("label", { class: "tp-c" }, strokeOn, strokeC, "Contorno")),
        h("div", { class: "tp-row" }, tAll, tSmall, tSup, tSub, tBold, tItal)),
      sec("Parágrafo", just, h("div", { class: "tp-grid" }, fInL, fInR, fInF, fSpB, fSpA))
    ];
  }

  // ============================================================ GRAPH (bezier editor)
  const EASES = [
    ["Linear", [0, 0, 1, 1]], ["Ease", [.25, .1, .25, 1]], ["Ease In", [.42, 0, 1, 1]], ["Ease Out", [0, 0, .58, 1]], ["In-Out", [.42, 0, .58, 1]],
    ["Sine In", [.12, 0, .39, 0]], ["Sine Out", [.61, 1, .88, 1]], ["Sine I/O", [.37, 0, .63, 1]],
    ["Quad In", [.11, 0, .5, 0]], ["Quad Out", [.5, 1, .89, 1]], ["Quad I/O", [.45, 0, .55, 1]],
    ["Cubic In", [.32, 0, .67, 0]], ["Cubic Out", [.33, 1, .68, 1]], ["Cubic I/O", [.65, 0, .35, 1]],
    ["Quart In", [.5, 0, .75, 0]], ["Quart Out", [.25, 1, .5, 1]], ["Quart I/O", [.76, 0, .24, 1]],
    ["Expo In", [.7, 0, .84, 0]], ["Expo Out", [.16, 1, .3, 1]], ["Expo I/O", [.87, 0, .13, 1]],
    ["Circ In", [.55, 0, 1, .45]], ["Circ Out", [0, .55, .45, 1]], ["Circ I/O", [.85, 0, .15, 1]],
    ["Back In", [.36, 0, .66, -.56]], ["Back Out", [.34, 1.56, .64, 1]], ["Back I/O", [.68, -.6, .32, 1.6]]
  ];
  function miniCurve(b) {
    const P = (x, y) => `${2 + x * 30},${20 - y * 16}`;
    return `<svg viewBox="0 0 34 24"><path d="M${P(0, 0)} C${P(b[0], b[1])} ${P(b[2], b[3])} ${P(1, 1)}" fill="none" stroke="#0a84ff" stroke-width="1.6"/></svg>`;
  }
  function graph() {
    let b = store.get("bezier", [.42, 0, .58, 1]);
    const S = 220, PAD = 30, cv = h("canvas", { class: "graph", width: S * 2, height: S * 2, style: `width:${S}px;height:${S}px` });
    const field = h("input", { class: "txtin", style: "width:150px", value: b.join(", ") });
    const ctx = cv.getContext("2d");
    const X = (x) => (PAD + x * (S - PAD * 2)) * 2, Y = (y) => (S - PAD - y * (S - PAD * 2)) * 2;
    function draw() {
      ctx.clearRect(0, 0, S * 2, S * 2);
      ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(X(i / 4), Y(0)); ctx.lineTo(X(i / 4), Y(1)); ctx.moveTo(X(0), Y(i / 4)); ctx.lineTo(X(1), Y(i / 4)); ctx.stroke(); }
      ctx.strokeStyle = "rgba(235,235,245,.35)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(b[0]), Y(b[1])); ctx.moveTo(X(1), Y(1)); ctx.lineTo(X(b[2]), Y(b[3])); ctx.stroke();
      ctx.strokeStyle = "#0a84ff"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.bezierCurveTo(X(b[0]), Y(b[1]), X(b[2]), Y(b[3]), X(1), Y(1)); ctx.stroke();
      [[b[0], b[1]], [b[2], b[3]]].forEach(([x, y]) => { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(X(x), Y(y), 10, 0, Math.PI * 2); ctx.fill(); });
      field.value = b.map((v) => +v.toFixed(3)).join(", ");
      store.set("bezier", b);
      infl.textContent = `Influência: saída ${Math.round(b[0] * 100)}% · entrada ${Math.round((1 - b[2]) * 100)}%`;
    }
    let drag = -1;
    const toVal = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - PAD) / (S - PAD * 2), (S - PAD - (e.clientY - r.top)) / (S - PAD * 2)]; };
    cv.addEventListener("pointerdown", (e) => {
      const [x, y] = toVal(e);
      const d1 = Math.hypot(x - b[0], y - b[1]), d2 = Math.hypot(x - b[2], y - b[3]);
      drag = d1 < d2 ? 0 : 2; cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", (e) => {
      if (drag < 0) return;
      const [x, y] = toVal(e);
      b[drag] = Math.max(0, Math.min(1, x)); b[drag + 1] = Math.max(-1, Math.min(2, y)); draw();
    });
    cv.addEventListener("pointerup", () => { drag = -1; });
    field.addEventListener("change", () => {
      const v = field.value.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      if (v.length === 4) { b = [Math.max(0, Math.min(1, v[0])), v[1], Math.max(0, Math.min(1, v[2])), v[3]]; draw(); }
    });
    const infl = h("span", { class: "hint" });
    const presets = h("div", { class: "ease-presets" });
    const renderPresets = () => {
      presets.innerHTML = "";
      EASES.concat(store.get("customEases", []).map((c) => [c.name, c.b, true])).forEach(([n, v, custom]) => {
        const btn = h("button", { title: n + (custom ? " (clique direito remove)" : ""), on: {
          click: () => { b = v.slice(); draw(); },
          contextmenu: (e) => { if (!custom) return; e.preventDefault(); store.set("customEases", store.get("customEases", []).filter((c) => c.name !== n)); renderPresets(); }
        } });
        btn.innerHTML = miniCurve(v) + `<span></span>`; btn.lastChild.textContent = n;
        presets.appendChild(btn);
      });
    };
    renderPresets();
    const nameIn = txt("Nome", 90);
    draw();
    const tip = (s, t) => { s.title = t; const hh = s.querySelector("h4"); if (hh) hh.appendChild(h("span", { class: "tipdot", title: t }, "i")); return s; };
    return [
      tip(sec("Easy Ease", pills([
        pill("Easy Ease", () => run({ id: "easyEase", mode: "both" }), "", "Suaviza entrada e saída dos keyframes (F9)"),
        pill("Ease In", () => run({ id: "easyEase", mode: "in" }), "", "Suaviza só a chegada no keyframe"),
        pill("Ease Out", () => run({ id: "easyEase", mode: "out" }), "", "Suaviza só a saída do keyframe"),
        pill("Linear", () => run({ id: "easyEase", mode: "linear" }), "", "Velocidade constante")
      ])), "Vale para os keyframes selecionados na timeline."),
      tip(sec("Editor de curva", h("div", { class: "graphwrap" }, cv, presets),
        line("cubic-bezier", field, h("span", { class: "sp" }), pill("Aplicar nos keyframes", () => run({ id: "bezier", b }), "primary")), infl,
        line(pill("Ler do keyframe", () => run({ id: "bezierRead" }, null, (v) => {
          b = [Math.max(0, Math.min(1, v[0])), Math.max(-1, Math.min(2, v[1])), Math.max(0, Math.min(1, v[2])), Math.max(-1, Math.min(2, v[3]))];
          draw(); setStatus(statusEl, "Curva lida do keyframe selecionado.", "ok");
        }), "", "Lê a curva do intervalo entre 2 keyframes selecionados"),
        pill("Inverter", () => { b = [1 - b[2], 1 - b[3], 1 - b[0], 1 - b[1]]; draw(); }, "", "Espelha a curva (ease in ↔ ease out)"))),
        "Selecione 2 ou mais keyframes vizinhos na timeline. A curva vale para cada intervalo entre eles."),
      sec("Minhas curvas", line(nameIn, pill("Salvar curva atual", () => {
        const n = nameIn.value.trim(); if (!n) return setStatus(statusEl, "Dê um nome para a curva.", "err");
        store.set("customEases", store.get("customEases", []).filter((c) => c.name !== n).concat([{ name: n, b: b.slice() }]));
        nameIn.value = ""; renderPresets(); setStatus(statusEl, `Curva “${n}” salva.`, "ok");
      })))
    ];
  }

  // ============================================================ FONTS
  function fonts() {
    const list = h("div", { class: "list" }, h("div", { class: "li" }, h("span", { class: "n hint" }, "Clique em Escanear para listar as fontes da comp.")));
    let from = null;
    const to = h("input", { class: "txtin", style: "flex:1;min-width:120px", placeholder: "PostScript da nova fonte", list: "mpFonts" });
    to.setAttribute("list", "mpFonts");
    const dl = h("datalist", { id: "mpFonts" });
    const onlySel = sw(false);
    const favBox = h("div", { class: "pills wide" });
    const renderFavs = () => {
      favBox.innerHTML = "";
      const favs = store.get("fontFavs", []);
      if (!favs.length) favBox.appendChild(h("span", { class: "hint" }, "Nenhuma fonte favorita."));
      favs.forEach((f) => favBox.appendChild(pill(f, () => { to.value = f; }, "", f)));
    };
    renderFavs();
    const scan = () => run({ id: "fontsScan" }, null, (rows) => {
      list.innerHTML = "";
      if (!rows.length) list.appendChild(h("div", { class: "li" }, h("span", { class: "n hint" }, "Nenhuma layer de texto encontrada.")));
      rows.forEach((r) => {
        const li = h("div", { class: "li", on: { click: () => { from = r.font; list.querySelectorAll(".li").forEach((x) => x.classList.toggle("on", x === li)); } } },
          h("span", { class: "n" }, r.font), h("small", {}, r.count + " layer(s)"));
        list.appendChild(li);
      });
      setStatus(statusEl, `${rows.length} fonte(s) na comp (incluindo precomps).`, "ok");
    });
    return [
      sec("Fontes usadas", line(pill("Escanear comp", scan, "primary"), h("span", { class: "hint" }, "Inclui precomps aninhadas.")), list),
      sec("Trocar por", line(to, dl), line(pill("Carregar fontes do sistema", () => run({ id: "fontsAll" }, null, (names) => {
        dl.innerHTML = ""; names.forEach((n) => dl.appendChild(h("option", { value: n })));
        setStatus(statusEl, `${names.length} fontes disponíveis para autocompletar.`, "ok");
      })), pill("★ Favoritar", () => {
        const v = to.value.trim(); if (!v) return;
        store.set("fontFavs", Array.from(new Set(store.get("fontFavs", []).concat([v])))); renderFavs();
      })), favBox,
        line("Só layers selecionadas", onlySel.el, h("span", { class: "sp" }), pill("Trocar fonte", () => {
          if (!from) return setStatus(statusEl, "Escolha na lista a fonte que vai ser trocada.", "err");
          if (!to.value.trim()) return setStatus(statusEl, "Digite o nome PostScript da nova fonte.", "err");
          run({ id: "fontsReplace", from, to: to.value.trim(), selectedOnly: onlySel.input.checked }, null);
        }, "primary")))
    ];
  }

  // ============================================================ SHAPE
  // ------------------------------------------------------------ solid layer + multi-stop gradient layer
  const hexRgba = (hex, o) => {
    const v = parseInt(String(hex).replace("#", ""), 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${Math.max(0, Math.min(100, o)) / 100})`;
  };
  // Paints the gradient on a canvas context of size w×h. Positions are percentages of the frame.
  function paintGradient(ctx, w, h, g) {
    const sx = g.start[0] / 100 * w, sy = g.start[1] / 100 * h, ex = g.end[0] / 100 * w, ey = g.end[1] / 100 * h;
    const grad = g.type === "radial"
      ? ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(1, Math.hypot(ex - sx, ey - sy)))
      : ctx.createLinearGradient(sx, sy, ex, ey);
    g.stops.slice().sort((a, b) => a.p - b.p).forEach((s) => grad.addColorStop(Math.max(0, Math.min(1, s.p / 100)), hexRgba(s.c, s.o)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  function solidAndGradient() {
    // ---- solid
    const sCol = color(store.get("solidColor", "#1c1c1e")), sOp = num(store.get("solidOpacity", 100), 46, 0), sName = txt("Nome", 110);
    const solidSec = sec("Camada sólida",
      line("Cor", sCol, "Opacidade", sOp, h("em", { class: "hint" }, "%"), sName),
      line(h("span", { class: "sp" }), pill("Criar camada sólida", () => {
        store.set("solidColor", sCol.value); store.set("solidOpacity", +sOp.value);
        run({ id: "solidLayer", color: sCol.value, opacity: +sOp.value, name: clean(sName.value) || "Sólido" });
      }, "primary")),
      h("span", { class: "hint" }, "Cria uma shape do tamanho da comp. A cor e a opacidade continuam editáveis no After Effects (Conteúdo › Preenchimento)."));

    // ---- gradient
    const g = store.get("gradTpl", { type: "linear", start: [0, 50], end: [100, 50], stops: [{ c: "#0a84ff", o: 100, p: 0 }, { c: "#bf5af2", o: 100, p: 100 }] });
    const save = () => store.set("gradTpl", g);
    const cv = h("canvas", { width: 640, height: 360, style: "width:100%;max-width:340px;aspect-ratio:16/9;border-radius:10px;cursor:crosshair;touch-action:none" });
    const draw = () => {
      const c = cv.getContext("2d"), W = cv.width, H = cv.height;
      // checkerboard so transparency is visible
      for (let y = 0; y < H; y += 20) for (let x = 0; x < W; x += 20) { c.fillStyle = ((x + y) / 20) % 2 ? "#3a3a3c" : "#2a2a2c"; c.fillRect(x, y, 20, 20); }
      paintGradient(c, W, H, g);
      [["start", g.start], ["end", g.end]].forEach(([k, pt]) => {
        const x = pt[0] / 100 * W, y = pt[1] / 100 * H;
        c.lineWidth = 3; c.strokeStyle = "#000"; c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.stroke();
        c.lineWidth = 2; c.strokeStyle = "#fff"; c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.stroke();
        c.fillStyle = k === "start" ? "#fff" : "#0a84ff"; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
      });
      c.strokeStyle = "rgba(255,255,255,.6)"; c.setLineDash([6, 6]); c.beginPath();
      c.moveTo(g.start[0] / 100 * W, g.start[1] / 100 * H); c.lineTo(g.end[0] / 100 * W, g.end[1] / 100 * H); c.stroke(); c.setLineDash([]);
      // With more than two colours, every colour gets its own circle, drawn on a rail parallel to the
      // gradient line; dragging it slides that colour's position along the gradient.
      if (g.stops.length > 2) {
        const rail = stopRail(W, H);
        c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 2; c.beginPath();
        c.moveTo(rail.sx, rail.sy); c.lineTo(rail.sx + rail.dx, rail.sy + rail.dy); c.stroke();
        g.stops.forEach((s, i) => {
          const pt = stopPoint(rail, s.p);
          c.lineWidth = 3; c.strokeStyle = "#000"; c.beginPath(); c.arc(pt[0], pt[1], 10, 0, Math.PI * 2); c.stroke();
          c.fillStyle = s.c; c.beginPath(); c.arc(pt[0], pt[1], 9, 0, Math.PI * 2); c.fill();
          c.lineWidth = 2; c.strokeStyle = dragStop === i ? "#0a84ff" : "#fff"; c.beginPath(); c.arc(pt[0], pt[1], 10, 0, Math.PI * 2); c.stroke();
        });
      }
      posFields.forEach(([el, arr, i]) => { if (document.activeElement !== el) el.value = Math.round(arr()[i]); });
    };
    // Rail for the colour circles: the gradient line shifted sideways by a fixed distance.
    const stopRail = (W, H) => {
      const sx0 = g.start[0] / 100 * W, sy0 = g.start[1] / 100 * H;
      const dx = g.end[0] / 100 * W - sx0, dy = g.end[1] / 100 * H - sy0, len = Math.max(1, Math.hypot(dx, dy));
      let nx = -dy / len, ny = dx / len;
      const off = 26;
      // keep the rail inside the frame: flip it to the other side when it would leave the canvas
      const midX = sx0 + dx / 2 + nx * off, midY = sy0 + dy / 2 + ny * off;
      if (midX < 0 || midX > W || midY < 0 || midY > H) { nx = -nx; ny = -ny; }
      return { sx: sx0 + nx * off, sy: sy0 + ny * off, dx, dy, len };
    };
    const stopPoint = (rail, p) => [rail.sx + rail.dx * p / 100, rail.sy + rail.dy * p / 100];
    // Drag: a colour circle (when shown), otherwise the start (white) or end (blue) handle.
    let dragK = null, dragStop = -1;
    const toPct = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)), Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100))]; };
    const toPx = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * cv.width, (e.clientY - r.top) / r.height * cv.height]; };
    cv.addEventListener("pointerdown", (e) => {
      try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      if (g.stops.length > 2) {
        const P = toPx(e), rail = stopRail(cv.width, cv.height);
        let best = -1, bestD = 22;
        g.stops.forEach((s, i) => { const q = stopPoint(rail, s.p), d = Math.hypot(P[0] - q[0], P[1] - q[1]); if (d < bestD) { bestD = d; best = i; } });
        if (best >= 0) { dragStop = best; draw(); return; }
      }
      const p = toPct(e);
      dragK = Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) <= Math.hypot(p[0] - g.end[0], p[1] - g.end[1]) ? "start" : "end";
      g[dragK] = p; draw();
    });
    cv.addEventListener("pointermove", (e) => {
      if (dragStop >= 0) {
        const P = toPx(e), rail = stopRail(cv.width, cv.height);
        const t = ((P[0] - rail.sx) * rail.dx + (P[1] - rail.sy) * rail.dy) / (rail.len * rail.len);
        g.stops[dragStop].p = Math.round(Math.max(0, Math.min(1, t)) * 100);
        if (stopPosInputs[dragStop]) stopPosInputs[dragStop].value = g.stops[dragStop].p;
        draw();
      } else if (dragK) { g[dragK] = toPct(e); draw(); }
    });
    cv.addEventListener("pointerup", () => { dragK = null; dragStop = -1; save(); draw(); });

    const type = seg([["linear", "Linear"], ["radial", "Radial"]], g.type);
    type.addEventListener("click", () => { g.type = type.value; save(); draw(); });
    const pos = (arr, i) => {
      const el = num(Math.round(arr()[i]), 40, 0);
      el.addEventListener("input", () => { arr()[i] = Math.max(0, Math.min(100, +el.value || 0)); save(); draw(); });
      return el;
    };
    const posFields = [];
    const mk = (arr, i) => { const el = pos(arr, i); posFields.push([el, arr, i]); return el; };
    const sxF = mk(() => g.start, 0), syF = mk(() => g.start, 1), exF = mk(() => g.end, 0), eyF = mk(() => g.end, 1);

    const stopsBox = h("div", { class: "gstops" });
    const stopPosInputs = [];   // position fields, updated live while a colour circle is dragged
    const renderStops = () => {
      stopsBox.innerHTML = "";
      stopPosInputs.length = 0;
      g.stops.forEach((s, i) => {
        const c = color(s.c), o = num(s.o, 44, 0), p = num(s.p, 44, 0);
        stopPosInputs[i] = p;
        c.addEventListener("input", () => { s.c = c.value; save(); draw(); });
        o.addEventListener("input", () => { s.o = Math.max(0, Math.min(100, +o.value || 0)); save(); draw(); });
        p.addEventListener("input", () => { s.p = Math.max(0, Math.min(100, +p.value || 0)); save(); draw(); });
        const del = h("button", { class: "sq danger", title: "Remover esta cor", on: { click: () => { if (g.stops.length > 2) { g.stops.splice(i, 1); save(); renderStops(); draw(); } } } }, icon("purge", 14));
        stopsBox.appendChild(line(h("span", { class: "hint", style: "width:16px" }, String(i + 1)), c, "Opacidade", o, h("em", { class: "hint" }, "%"), "Posição", p, h("em", { class: "hint" }, "%"), h("span", { class: "sp" }), del));
      });
    };
    const addStop = () => {
      // New stop in the middle of the widest gap, with the colour of its left neighbour.
      const st = g.stops.slice().sort((a, b) => a.p - b.p);
      let best = 0, at = 50, col = st[0].c;
      for (let i = 0; i < st.length - 1; i++) { const gap = st[i + 1].p - st[i].p; if (gap > best) { best = gap; at = st[i].p + gap / 2; col = st[i].c; } }
      g.stops.push({ c: col, o: 100, p: Math.round(at) }); save(); renderStops(); draw();
    };
    renderStops();
    setTimeout(draw, 0);

    // Export: render at the comp size, save as PNG in Documents/Motion Panel/Gradientes and import.
    const createGradient = () => {
      const cep = window.__adobe_cep__, fsApi = window.cep && window.cep.fs;
      if (!cep || !fsApi) return setStatus(statusEl, "Fora do After Effects (só pré-visualização).", "err");
      run({ id: "compInfo" }, null, (info) => {
        const W = Math.max(2, Math.min(8192, info.w)), H = Math.max(2, Math.min(8192, info.h));
        const out = document.createElement("canvas"); out.width = W; out.height = H;
        paintGradient(out.getContext("2d"), W, H, g);
        let docs = decodeURI(cep.getSystemPath("myDocuments")).replace(/^file:\/{2,3}/, "");
        if (!/^[A-Za-z]:/.test(docs) && docs[0] !== "/") docs = "/" + docs;
        const dir = docs + "/Motion Panel", dir2 = dir + "/Gradientes";
        try { fsApi.makedir(dir); fsApi.makedir(dir2); } catch (e) {}
        const d = new Date(), pad = (n) => String(n).padStart(2, "0");
        const fname = `gradiente_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
        const path = dir2 + "/" + fname;
        const res = fsApi.writeFile(path, out.toDataURL("image/png").split(",")[1], window.cep.encoding.Base64);
        if (res && res.err) return setStatus(statusEl, "Não consegui salvar o PNG do gradiente (erro " + res.err + ").", "err");
        run({ id: "importGradient", path, name: fname.replace(/\.png$/, "") });
      });
    };
    const gradSec = sec("Camada com gradiente", cv, line(type, h("span", { class: "sp" }), h("span", { class: "hint" }, "Arraste os pontos na prévia")),
      line("Início X", sxF, "Y", syF, h("em", { class: "hint" }, "%"), "Fim X", exF, "Y", eyF, h("em", { class: "hint" }, "%")),
      stopsBox,
      line(pill("+ Cor", addStop, "", "Acrescenta outra cor ao gradiente"), h("span", { class: "sp" }), pill("Criar gradiente", createGradient, "primary")),
      h("span", { class: "hint" }, "O gradiente é desenhado no tamanho da comp e entra como uma layer PNG (salva em Documentos › Motion Panel › Gradientes). Para mudar, ajuste aqui e crie de novo."));
    return [solidSec, gradSec];
  }

  function shape() {
    const fill = color("#0a84ff"), stroke = color("#ffffff"), width = num(4, 40, 0), op = num(100, 44, 0), useFill = sw(true), useStroke = sw(true), round = sw(true);
    const tS = num(0, 40), tE = num(100, 40), tO = num(0, 40), tAnim = sw(true), tFr = num(30, 40, 1);
    const dD = num(20, 40, 0), dG = num(12, 40, 0), dO = num(0, 40), dAnim = sw(false), dSpd = num(60, 40);
    const pSL = num(30, 40, 0), pEL = num(30, 40, 0), pSW = num(0, 40, 0), pEW = num(0, 40, 0);
    return [
      ...solidAndGradient(),
      sec("Aparência", line("Preenchimento", useFill.el, fill, h("span", { class: "sp" }), "Borda", useStroke.el, stroke),
        line("Espessura", width, "Opacidade", op, h("em", { class: "hint", style: "margin-right:8px" }, "%"), "Pontas redondas", round.el),
        line(h("span", { class: "sp" }), pill("Aplicar estilo", () => run({ id: "shapeStyle", fill: useFill.input.checked ? fill.value : null, stroke: useStroke.input.checked ? stroke.value : null, width: +width.value, opacity: +op.value, round: round.input.checked }), "primary"))),
      sec("Trim Paths", line("Início", tS, "Fim", tE, "Offset", tO),
        line("Animar desenho", tAnim.el, tFr, "fr", h("span", { class: "sp" }), pill("Aplicar", () => run({ id: "trimPaths", start: +tS.value, end: +tE.value, offset: +tO.value, animate: tAnim.input.checked, frames: +tFr.value || 1 }), "primary"))),
      sec("Tracejado", line("Traço", dD, "Espaço", dG, "Offset", dO),
        line("Animar", dAnim.el, "vel.", dSpd, h("span", { class: "sp" }), pill("Aplicar", () => run({ id: "dashes", dash: +dD.value, gap: +dG.value, offset: +dO.value, animate: dAnim.input.checked, speed: +dSpd.value }), "primary"))),
      sec("Afunilar contorno", line("Início compr.", pSL, "%", "Fim compr.", pEL, "%"), line("Largura início", pSW, "%", "fim", pEW, "%"),
        line(h("span", { class: "sp" }), pill("Aplicar", () => run({ id: "taper", startLen: +pSL.value, endLen: +pEL.value, startW: +pSW.value, endW: +pEW.value }), "primary")))
    ];
  }

  // ============================================================ EFFECTS MANAGER
  function effects() {
    const scope = seg([["selected", "Selecionadas"], ["comp", "Comp"], ["project", "Projeto"]], "comp");
    const filter = h("input", { class: "txtin", style: "flex:1", placeholder: "Filtrar efeitos" });
    const list = h("div", { class: "list", style: "max-height:300px" }, h("div", { class: "li" }, h("span", { class: "n hint" }, "Clique em Escanear.")));
    let rows = [], picked = new Set();
    const render = () => {
      list.innerHTML = "";
      const q = filter.value.toLowerCase();
      rows.filter((r) => !q || (r.name + r.match).toLowerCase().indexOf(q) >= 0).forEach((r) => {
        const cb = h("input", { type: "checkbox", checked: picked.has(r.match), on: { change: (e) => { e.target.checked ? picked.add(r.match) : picked.delete(r.match); } } });
        list.appendChild(h("label", { class: "li" }, cb, h("span", { class: "n" }, r.name), h("small", {}, `${r.on}/${r.count} ativos`)));
      });
      if (!list.children.length) list.appendChild(h("div", { class: "li" }, h("span", { class: "n hint" }, "Nenhum efeito.")));
    };
    filter.addEventListener("input", render);
    const scan = () => run({ id: "fxScan", scope: scope.value }, null, (r) => { rows = r; picked = new Set(); render(); setStatus(statusEl, `${r.length} tipo(s) de efeito encontrados.`, "ok"); });
    const toggle = (on) => {
      if (!picked.size) return setStatus(statusEl, "Marque os efeitos na lista.", "err");
      run({ id: "fxToggle", scope: scope.value, matches: Array.from(picked), on }, null);
      setTimeout(scan, 300);
    };
    return [
      sec("Ligar e desligar efeitos", line("Onde", scope, h("span", { class: "sp" }), h("button", { class: "sq", title: "Escanear", "aria-label": "Escanear", on: { click: scan } }, icon("search", 15))), filter, list,
        h("div", { class: "btnrow" }, pill("Desativar marcados", () => toggle(false), "danger"), pill("Ativar marcados", () => toggle(true))),
        h("span", { class: "hint" }, "Desativar efeitos pesados acelera a prévia sem apagar nada."))
    ];
  }

  // ============================================================ GRADIENT
  const GRADS = [
    ["Aurora", "#00c6ff", "#7b2ff7"], ["Pôr do sol", "#ff7e5f", "#feb47b"], ["Menta", "#2af598", "#009efd"], ["Lava", "#f83600", "#f9d423"],
    ["Uva", "#8e2de2", "#ff6a88"], ["Oceano", "#1d2b64", "#0a84ff"], ["Pêssego", "#ffd3a5", "#fd6585"], ["Floresta", "#134e5e", "#71b280"],
    ["Neon", "#f0f", "#0ff"], ["Carvão", "#232526", "#636366"], ["Ouro", "#b8860b", "#ffe680"], ["Gelo", "#e0f7ff", "#8ec5fc"]
  ];
  function gradient() {
    const c1 = color("#00c6ff"), c2 = color("#7b2ff7"), shapeSeg = seg([["linear", "Linear"], ["radial", "Radial"]], "linear"), anim = sw(false), spd = num(45, 40);
    const box = h("div", { class: "swatches onerow" });
    const render = () => {
      box.innerHTML = "";
      GRADS.concat(store.get("grads", []).map((g) => [g.name, g.c1, g.c2, true])).forEach(([n, a, b, custom]) => box.appendChild(h("button", {
        class: "swatch", title: n + (custom ? " (clique direito remove)" : ""), style: `background:linear-gradient(135deg,${a},${b})`,
        on: { click: () => { c1.value = toHex(a); c2.value = toHex(b); }, contextmenu: (e) => { if (!custom) return; e.preventDefault(); store.set("grads", store.get("grads", []).filter((g) => g.name !== n)); render(); } }
      })));
      // last tile: save the current two colors as a new preset
      box.appendChild(h("button", { class: "swatch addswatch", title: "Salvar as cores atuais como preset", on: { click: () => {
        const list = store.get("grads", []);
        list.push({ name: "Meu gradiente " + (list.length + 1), c1: c1.value, c2: c2.value }); store.set("grads", list); render();
        box.scrollLeft = box.scrollWidth;
      } } }, icon("plus", 16)));
    };
    const toHex = (c) => c.length === 4 ? "#" + c.slice(1).split("").map((x) => x + x).join("") : c;
    render();
    return [
      sec("Gradiente", box, line("Cores", c1, c2, h("span", { class: "sp" }), shapeSeg),
        line("Animar fluxo", anim.el, "vel.", spd, "°/s", h("span", { class: "sp" }), pill("Aplicar", () => run({ id: "gradient", c1: c1.value, c2: c2.value, shape: shapeSeg.value, animate: anim.input.checked, speed: +spd.value }), "primary")),
        h("span", { class: "hint" }, "Sem layer selecionada, cria um sólido com o gradiente."),
      )
    ];
  }

  // ============================================================ EXPRESSIONS
  const EXPR = [
    ["Wiggle", "Qualquer propriedade", "wiggle(2, 30)"],
    ["Loop ciclo", "Repete os keyframes", 'loopOut("cycle")'],
    ["Loop ping-pong", "Vai e volta", 'loopOut("pingpong")'],
    ["Girar contínuo", "Rotação", "value + time * 90"],
    ["Inércia", "Balanço depois do último keyframe", "var amp = 0.06, freq = 3, decay = 6, n = 0;\nif (numKeys > 0) { n = nearestKey(time).index; if (key(n).time > time) n--; }\nif (n > 0 && time > key(n).time) {\n  var t = time - key(n).time;\n  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);\n  add(value, mul(v, amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t)));\n} else value;"],
    ["Squash & stretch", "Escala", "var s = Math.sin(time * 6) * 0.05;\n[value[0] * (1 + s), value[1] * (1 - s)]"],
    ["Seguir com atraso", "Posição: segue a layer de cima", "var L = thisComp.layer(index - 1);\nL.transform.position.valueAtTime(time - 0.1)"],
    ["Olhar para", "Rotação: aponta para a layer de cima", "var d = sub(thisComp.layer(index - 1).transform.position, transform.position);\nradiansToDegrees(Math.atan2(d[1], d[0]))"],
    ["Relógio mm:ss", "Texto de origem", "var s = Math.floor(time);\n(\"0\" + Math.floor(s / 60)).slice(-2) + \":\" + (\"0\" + s % 60).slice(-2)"],
    ["Contagem regressiva", "Texto de origem (10 s)", "var s = Math.max(0, Math.ceil(10 - (time - inPoint)));\n(\"0\" + Math.floor(s / 60)).slice(-2) + \":\" + (\"0\" + s % 60).slice(-2)"],
    ["Fade automático", "Opacidade: entra e sai", "var f = 0.5;\nMath.min(linear(time, inPoint, inPoint + f, 0, value), linear(time, outPoint - f, outPoint, value, 0))"],
    ["Piscar aleatório", "Opacidade", "posterizeTime(8);\nrandom() > 0.3 ? value : 0"],
    ["Compensar escala do pai", "Escala", "var p = hasParent ? parent.transform.scale.value : [100, 100];\n[value[0] * 100 / p[0], value[1] * 100 / p[1]]"],
    ["Tempo por marcador", "Reinicia a cada marcador da layer", "var m = marker.numKeys ? marker.nearestKey(time) : null;\nif (m && m.time > time && m.index > 1) m = marker.key(m.index - 1);\nm && m.time <= time ? time - m.time : time"]
  ];
  // Short explanations shown on hover instead of the expression code. Motion Panel expressions are
  // recognized by their "// MP ..." header.
  const EXPR_EXPLAIN = [
    ["// MP marcador", "Segue o marcador da animação: mover ou esticar o marcador ajusta a animação."],
    ["// MP loop", "Loop do Motion Panel, ajustado pelos sliders MP em Efeitos."],
    ["// MP glow", "Parte do Glow do Motion Panel (sliders MP Glow)."],
    ["// MP contador", "Contador numérico: o slider MP Contador % é o progresso (0–100%); os valores inicial e final ficam na expressão."],
    ["// MP contagem", "Contagem regressiva do modelo."],
    ["// MP carrossel", "Movimento do carrossel ou da órbita (slider MP Velocidade)."],
    ["// MP gradiente", "Gradiente animado (slider MP Gradiente Velocidade)."],
    ["// MP leak", "Movimento do light leak."],
    ["// MP glitch", "Glitch contínuo (sliders MP Glitch)."],
    ["// MP turbulencia", "Turbulência animada."],
    ["// MP esteira", "Rolagem da esteira infinita (sliders MP Esteira)."],
    ["// MP batida", "Escala reagindo à música (slider MP Batida Intensidade)."],
    ["// MP camera na mao", "Câmera na mão (sliders MP Mão)."],
    ["// MP impacto", "Tremida de impacto nos marcadores do null-alvo."],
    ["// MP zoom na batida", "Zoom da câmera nas batidas marcadas."],
    ["// MP foco", "Foco da câmera preso a uma layer."],
    ["// MP rack focus", "Troca de foco da câmera entre duas layers."],
    ["// MP dash", "Tracejado andando."],
    ["// MP video infinito", "Vídeo em loop até o fim da comp."],
    ["loopOut", "Repete os keyframes (loopOut)."],
    ["wiggle", "Movimento aleatório (wiggle)."]
  ];
  function explainExpr(code) {
    const c = String(code || "");
    const ia = c.match(/^\/\/ MP ia: (.*)/);
    if (ia) return "Gerada pelo assistente: " + ia[1] + ".";
    for (const [k, v] of EXPR_EXPLAIN) if (c.indexOf(k) >= 0) return v;
    return "Expressão personalizada. Abra a propriedade no After Effects para ver ou editar o código.";
  }
  // ------------------------------------------------------------ local expression assistant
  // Turns a Portuguese description into an After Effects expression with rules (runs offline).
  const PROP_LABEL = { position: "Posição", scale: "Escala", rotation: "Rotação", opacity: "Opacidade", sourceText: "Texto de origem" };
  const TAU_S = "2 * Math.PI";
  function genExpression(text) {
    const t = String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!t.trim()) return null;
    const numAt = (re) => { const m = t.match(re); return m ? parseFloat(String(m[1]).replace(",", ".")) : null; };
    const strong = /(muito|bastante|forte|intens|exagerad)/.test(t), weak = /(pouco|leve|levemente|sutil|suave)/.test(t);
    const fast = /(rapid|veloz|depressa|frenetic|nervos)/.test(t), slow = /(lent|devagar|calm)/.test(t);
    const k = strong ? 2 : weak ? 0.5 : 1;
    const perSec = numAt(/(\d+(?:[.,]\d+)?)\s*(?:x|vezes)?\s*por\s*segundo/) || numAt(/(\d+(?:[.,]\d+)?)\s*hz/);
    const px = numAt(/(-?\d+(?:[.,]\d+)?)\s*(?:px|pixels?)/), deg = numAt(/(-?\d+(?:[.,]\d+)?)\s*(?:graus|°)/), pct = numAt(/(-?\d+(?:[.,]\d+)?)\s*%/);
    const secs = numAt(/(\d+(?:[.,]\d+)?)\s*(?:s\b|seg|segundos?)/);
    const quoted = (String(text).match(/["“”']([^"“”']+)["“”']/) || [])[1];
    const layerRef = quoted ? `thisComp.layer("${quoted.replace(/"/g, '\\"')}")` : "thisComp.layer(index - 1)";
    const layerDesc = quoted ? `a layer “${quoted}”` : "a layer de cima";
    const horiz = /(horizont|eixo x|\bx\b|esquerda|direita|lado)/.test(t), vert = /(vertical|eixo y|\by\b|cima|baixo)/.test(t);

    // Which property is being described.
    let prop = null;
    if (/(texto|numero|contador|contar|relogio|cronometro|timer|regressiva)/.test(t)) prop = "sourceText";
    else if (/(opacidade|transparen|sumir|aparecer|piscar|fade|desaparec|visib|cintil)/.test(t)) prop = "opacity";
    else if (/(rotacao|rotacionar|girar|gira\b|rodar|roda\b|angulo|apontar|olhar para|pendulo)/.test(t)) prop = "rotation";
    else if (/(escala|tamanho|crescer|aumentar|diminuir|encolher|pulsar|pulso|respirar|zoom|batimento|coracao)/.test(t)) prop = "scale";
    else if (/(posicao|mover|move|deslocar|andar|flutuar|boiar|quicar|pular|trem|chacoalh|seguir|segue|orbit|circulo|em volta|esquerda|direita|cima|baixo|lado)/.test(t)) prop = "position";
    const P = (p) => prop || p;
    const out = (p, desc, code) => ({ prop: p, desc, code: `// MP ia: ${desc}\n${code}` });

    // ---- text: counter, clock, countdown
    if (/regressiva/.test(t)) {
      const n = secs || numAt(/(\d+)/) || 10;
      return out("sourceText", `contagem regressiva de ${n} s`,
        `var s = Math.max(0, Math.ceil(${n} - (time - inPoint)));\n("0" + Math.floor(s / 60)).slice(-2) + ":" + ("0" + s % 60).slice(-2)`);
    }
    if (/(relogio|cronometro|timer)/.test(t)) {
      return out("sourceText", "relógio mm:ss desde o início da layer",
        `var s = Math.max(0, Math.floor(time - inPoint));\n("0" + Math.floor(s / 60)).slice(-2) + ":" + ("0" + s % 60).slice(-2)`);
    }
    if (/(contador|contar|numero)/.test(t)) {
      const m = t.match(/de\s*(-?\d+(?:[.,]\d+)*)\s*(?:ate|a|para)\s*(-?\d+(?:[.,]\d+)*)/);
      const toNum = (s) => parseFloat(String(s).replace(/\./g, "").replace(",", "."));
      const A = m ? toNum(m[1]) : 0, B = m ? toNum(m[2]) : 100, D = secs || 2, dec = numAt(/(\d)\s*casas?/) || 0;
      const pre = /(reais|r\$)/.test(t) ? "R$ " : /(dolar|us\$|\$)/.test(t) ? "$ " : "";
      const suf = /(%|porcento|por cento)/.test(t) ? "%" : "";
      return out("sourceText", `contador de ${A} até ${B} em ${D} s`,
        `var u = clamp((time - inPoint) / ${D}, 0, 1);\nu = 1 - Math.pow(1 - u, 3);\nvar v = ${A} + (${B - A}) * u;\n` +
        `var s = Math.abs(v).toFixed(${dec}).split(".");\ns[0] = s[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");\n(v < 0 ? "-" : "") + "${pre}" + s.join(",") + "${suf}"`);
    }
    // ---- keyframe based
    if (/(loop|repetir|repete|ciclo)/.test(t)) {
      const kind = /(vai e volta|ping)/.test(t) ? "pingpong" : /(continu)/.test(t) ? "continue" : /(offset|acumul)/.test(t) ? "offset" : "cycle";
      return out(P("position"), `repete os keyframes (${kind})`, `loopOut("${kind}")`);
    }
    if (/(inercia|overshoot|balanco depois|depois do ultimo|elastic)/.test(t)) {
      const amp = (0.06 * k).toFixed(3), f = fast ? 4 : slow ? 2 : 3;
      return out(P("position"), "balanço elástico depois do último keyframe",
        `var amp = ${amp}, freq = ${f}, decay = 6, n = 0;\nif (numKeys > 0) { n = nearestKey(time).index; if (key(n).time > time) n--; }\n` +
        `if (n > 0 && time > key(n).time) {\n  var t = time - key(n).time;\n  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);\n  add(value, mul(v, amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t)));\n} else value;`);
    }
    // ---- follow / look at / orbit
    if (/(seguir|segue|acompanh|follow)/.test(t)) {
      const p = P("position"), d = secs !== null ? secs : 0.2;
      const field = { position: "position", scale: "scale", rotation: "rotation", opacity: "opacity" }[p] || "position";
      return out(p, `segue ${layerDesc} com ${d} s de atraso`, `${layerRef}.transform.${field}.valueAtTime(time - ${d})`);
    }
    if (/(olhar para|olha para|apontar|aponta)/.test(t)) {
      return out("rotation", `aponta para ${layerDesc}`,
        `var d = sub(${layerRef}.toComp(${layerRef}.anchorPoint), toComp(anchorPoint));\nradiansToDegrees(Math.atan2(d[1], d[0]))`);
    }
    if (/(orbit|em volta|circulo|circular)/.test(t)) {
      const r = px || 100 * k, sp = numAt(/(\d+(?:[.,]\d+)?)\s*voltas?/) || (fast ? 1 : slow ? 0.1 : 0.25);
      return out("position", `órbita com raio ${r} px, ${sp} volta(s)/s`,
        `var a = time * ${sp} * ${TAU_S};\nadd(value, [Math.cos(a) * ${r}, Math.sin(a) * ${r}])`);
    }
    // ---- random / shake
    if (/(trem|wiggle|aleatori|chacoalh|nervos|instavel|vibr|cintil)/.test(t)) {
      const p = P("position"), f = perSec || (fast ? 8 : slow ? 1 : 3);
      if (p === "scale") {
        const a = pct || 8 * k;
        return out(p, `escala tremendo ${f}x/s, ${a}%`, `var w = wiggle(${f}, ${a});\nvar d = w[0] - value[0];\nvalue.length > 2 ? add(value, [d, d, 0]) : add(value, [d, d])`);
      }
      if (p === "rotation") { const a = deg || 8 * k; return out(p, `rotação tremendo ${f}x/s, ${a}°`, `wiggle(${f}, ${a})`); }
      if (p === "opacity") { const a = pct || 40 * k; return out(p, `opacidade cintilando ${f}x/s`, `clamp(wiggle(${f}, ${a}), 0, 100)`); }
      const a = px || 25 * k;
      if (horiz && !vert) return out(p, `tremor horizontal ${f}x/s, ${a} px`, `var w = wiggle(${f}, ${a});\n[w[0], value[1]]`);
      if (vert && !horiz) return out(p, `tremor vertical ${f}x/s, ${a} px`, `var w = wiggle(${f}, ${a});\n[value[0], w[1]]`);
      return out(p, `tremor ${f}x/s, ${a} px`, `wiggle(${f}, ${a})`);
    }
    // ---- pulse / heartbeat
    if (/(pulsar|pulso|pulsa|respirar|respira|batimento|coracao|batida)/.test(t)) {
      const p = P("scale"), f = perSec || (fast ? 2 : slow ? 0.5 : 1), a = pct || (p === "opacity" ? 50 : 10) * k;
      if (/(coracao|batimento|batida)/.test(t) && p === "scale") {
        const bpm = numAt(/(\d+)\s*bpm/) || 70;
        return out(p, `batimento de coração a ${bpm} bpm, ${a}%`,
          `var u = (time * ${bpm} / 60) % 1;\nvar b = Math.exp(-u * 8) * Math.abs(Math.sin(u * Math.PI * 4));\nmul(value, 1 + b * ${a} / 100)`);
      }
      if (p === "opacity") return out(p, `opacidade respirando ${f}x/s`, `value * (1 - ${a} / 100 * (0.5 + 0.5 * Math.sin(time * ${f} * ${TAU_S})))`);
      return out("scale", `escala pulsando ${f}x/s, ${a}%`, `mul(value, 1 + Math.sin(time * ${f} * ${TAU_S}) * ${a} / 100)`);
    }
    // ---- swing / pendulum / oscillate
    if (/(balanc|oscil|pendulo|vai e volta|ondular|onda)/.test(t)) {
      const p = P("rotation"), f = perSec || (fast ? 2 : slow ? 0.5 : 1);
      const decay = /(amortec|diminuindo|parando|aos poucos|perdendo)/.test(t) ? ` * Math.exp(-(time - inPoint) * ${fast ? 1.5 : 0.8})` : "";
      if (p === "position") {
        const a = px || 40 * k, axisY = vert && !horiz;
        return out(p, `balanço ${axisY ? "vertical" : "horizontal"} ${f}x/s, ${a} px${decay ? " (amortecendo)" : ""}`,
          `var o = Math.sin(time * ${f} * ${TAU_S}) * ${a}${decay};\nadd(value, ${axisY ? "[0, o]" : "[o, 0]"})`);
      }
      if (p === "scale") { const a = pct || 10 * k; return out(p, `escala oscilando ${f}x/s, ${a}%`, `mul(value, 1 + Math.sin(time * ${f} * ${TAU_S}) * ${a} / 100${decay})`); }
      if (p === "opacity") { const a = pct || 50 * k; return out(p, `opacidade oscilando ${f}x/s`, `clamp(value - (0.5 + 0.5 * Math.sin(time * ${f} * ${TAU_S})) * ${a}${decay}, 0, 100)`); }
      const a = deg || 15 * k;
      return out("rotation", `${/pendulo/.test(t) ? "pêndulo" : "balanço"} de ${a}° ${f}x/s${decay ? " (amortecendo)" : ""}`,
        `value + Math.sin(time * ${f} * ${TAU_S}) * ${a}${decay}`);
    }
    // ---- continuous spin
    if (/(girar|gira\b|rodar|roda\b|rotacionar|spin)/.test(t)) {
      const turns = numAt(/(\d+(?:[.,]\d+)?)\s*voltas?/);
      let sp = numAt(/(-?\d+(?:[.,]\d+)?)\s*(?:graus|°)\s*por\s*segundo/) || (turns ? turns * 360 : (fast ? 360 : slow ? 45 : 120) * k);
      if (/(anti.?horario|contra)/.test(t)) sp = -Math.abs(sp);
      return out("rotation", `gira ${sp}°/s sem parar`, `value + (time - inPoint) * ${sp}`);
    }
    // ---- float / bounce / blink / fade
    if (/(flutu|boiar|boia|levitar)/.test(t)) {
      const a = px || 15 * k, f = perSec || (fast ? 1 : slow ? 0.25 : 0.5);
      return out("position", `flutuando ${a} px, ${f}x/s`, `add(value, [0, Math.sin(time * ${f} * ${TAU_S}) * ${a}])`);
    }
    if (/(quic|pular|pula|bounce|saltar)/.test(t)) {
      const hgt = px || 60 * k, f = perSec || (fast ? 2 : slow ? 0.6 : 1.2);
      return out("position", `quicando ${hgt} px, ${f}x/s`, `add(value, [0, -Math.abs(Math.sin(time * ${f} * Math.PI)) * ${hgt}])`);
    }
    if (/(piscar|pisca|blink)/.test(t)) {
      const f = perSec || (fast ? 4 : slow ? 1 : 2), min = pct !== null ? pct : 0;
      return out("opacity", `piscando ${f}x/s`, `Math.sin(time * ${f} * ${TAU_S}) >= 0 ? value : ${min}`);
    }
    if (/(aparecer|aparece|sumir|some|fade|desaparec|entrar|sair)/.test(t)) {
      const d = secs || 0.5, fin = /(aparec|entrar|fade in|surgir)/.test(t), fout = /(sumir|some|desaparec|sair|fade out)/.test(t);
      if (fin && !fout) return out("opacity", `aparece em ${d} s`, `linear(time, inPoint, inPoint + ${d}, 0, value)`);
      if (fout && !fin) return out("opacity", `some nos últimos ${d} s`, `linear(time, outPoint - ${d}, outPoint, value, 0)`);
      return out("opacity", `aparece e some em ${d} s`, `Math.min(linear(time, inPoint, inPoint + ${d}, 0, value), linear(time, outPoint - ${d}, outPoint, value, 0))`);
    }
    // ---- constant motion / growth
    if (/(crescer|cresce|aumentar|zoom|encolher|diminuir)/.test(t) && P("scale") === "scale") {
      let r = pct || 10 * k;
      if (/(encolher|diminuir)/.test(t)) r = -Math.abs(r);
      return out("scale", `escala mudando ${r}% por segundo`, `mul(value, Math.max(0, 1 + (time - inPoint) * ${r} / 100))`);
    }
    if (/(mover|move|andar|deslocar|deslizar|ir para)/.test(t)) {
      const v = px || 100 * k;
      const dir = /esquerda/.test(t) ? [-v, 0] : /cima/.test(t) ? [0, -v] : /baixo/.test(t) ? [0, v] : [v, 0];
      return out("position", `movimento constante de ${v} px/s`, `add(value, mul([${dir[0]}, ${dir[1]}], time - inPoint))`);
    }
    return null;
  }
  const EXPR_EXAMPLES = [
    "Tremer a posição 2 vezes por segundo com 30 px",
    "Pulsar a escala devagar",
    "Girar sem parar 90 graus por segundo",
    "Pêndulo de 20 graus diminuindo aos poucos",
    "Contador de 0 até 1500 em 3 segundos",
    "Piscar rápido",
    "Flutuar suavemente",
    "Seguir a layer de cima com 0.3 s de atraso",
    "Aparecer e sumir em 1 segundo",
    "Quicar 80 px",
    "Batimento de coração na escala"
  ];

  function expressions() {
    const lib = h("div", { class: "pills wide", style: "grid-template-columns:repeat(auto-fill,minmax(150px,1fr))" });
    EXPR.forEach(([n, d, code]) => lib.appendChild(h("button", { class: "expr-card", title: d, on: { click: () => { area.value = code; run({ id: "exprApply", code }); } } }, h("b", {}, n), h("small", {}, d))));
    const area = h("textarea", { class: "code", placeholder: "Escreva ou cole uma expressão…", spellcheck: false });
    const nm = txt("Nome", 100);
    const saved = h("div", { class: "list" });
    const renderSaved = () => {
      saved.innerHTML = "";
      const list = store.get("exprs", []);
      if (!list.length) saved.appendChild(h("div", { class: "li" }, h("span", { class: "n hint" }, "Nenhuma expressão salva.")));
      list.forEach((x) => saved.appendChild(h("div", { class: "li" }, h("span", { class: "n", title: "Expressão personalizada salva. Clique em Usar para ver o código." }, x.name),
        pill("Usar", () => { area.value = x.code; }), pill("Aplicar", () => run({ id: "exprApply", code: x.code })),
        pill("×", () => { store.set("exprs", store.get("exprs", []).filter((y) => y.name !== x.name)); renderSaved(); }, "danger"))));
    };
    renderSaved();
    const scanList = h("div", { class: "list" }, h("div", { class: "li" }, h("span", { class: "n hint" }, "Lista as expressões das layers selecionadas (ou da comp).")));
    const scan = () => run({ id: "exprScan" }, null, (rows) => {
      scanList.innerHTML = "";
      if (!rows.length) scanList.appendChild(h("div", { class: "li" }, h("span", { class: "n hint" }, "Nenhuma expressão.")));
      rows.forEach((r) => scanList.appendChild(h("div", { class: "li", title: explainExpr(r.code) },h("span", { class: "n" }, `${r.layer} › ${r.prop}`), h("code", {}, r.on ? "" : "off"))));
      setStatus(statusEl, `${rows.length} expressão(ões) encontradas.`, "ok");
    });
    // ---- assistant: description -> expression (local rules, like the camera assistant)
    const ask = h("textarea", { class: "code", style: "min-height:56px;font-family:inherit;font-size:12.5px", placeholder: "Ex.: Tremer a posição 2 vezes por segundo com 30 px" });
    const badge = h("span", { class: "badge in" }, "—");
    const desc = h("span", { class: "hint", style: "flex:1" }, "Descreva o efeito: o resultado aparece aqui enquanto você digita.");
    const outCode = h("textarea", { class: "code", spellcheck: false, placeholder: "A expressão gerada aparece aqui (pode editar antes de aplicar)." });
    const target = h("select", {},
      h("option", { value: "auto" }, "Automático"), h("option", { value: "selected" }, "Propriedade selecionada"),
      h("option", { value: "position" }, "Posição"), h("option", { value: "scale" }, "Escala"), h("option", { value: "rotation" }, "Rotação"),
      h("option", { value: "opacity" }, "Opacidade"), h("option", { value: "sourceText" }, "Texto de origem"));
    let gen = null;
    const update = () => {
      gen = genExpression(ask.value);
      if (!gen) {
        badge.textContent = "—";
        desc.textContent = ask.value.trim() ? "Não entendi. Tente palavras como tremer, pulsar, girar, balançar, flutuar, quicar, piscar, seguir, contador, relógio." : "Descreva o efeito: o resultado aparece aqui enquanto você digita.";
        outCode.value = "";
        return;
      }
      badge.textContent = PROP_LABEL[gen.prop] || gen.prop;
      desc.textContent = gen.desc.charAt(0).toUpperCase() + gen.desc.slice(1) + ".";
      outCode.value = gen.code;
    };
    ask.addEventListener("input", update);
    const examples = h("div", { class: "pills wide", style: "grid-template-columns:repeat(auto-fill,minmax(180px,1fr))" },
      ...EXPR_EXAMPLES.map((ex) => h("button", { class: "expr-card", title: "Usar este exemplo", on: { click: () => { ask.value = ex; update(); } } }, h("small", {}, ex))));
    const applyGen = () => {
      if (!outCode.value.trim()) return setStatus(statusEl, "Descreva um efeito primeiro.", "err");
      const tgt = target.value === "auto" ? (gen ? gen.prop : "selected") : target.value;
      run({ id: "exprApplyTo", target: tgt, code: outCode.value });
    };
    const assistant = sec("Assistente de expressões (IA local)", ask, line(badge, desc), outCode,
      line("Aplicar em", target, h("span", { class: "sp" }),
        pill("Salvar", () => { if (!outCode.value.trim()) return; const n = (gen ? gen.desc : "Expressão") .slice(0, 40); store.set("exprs", store.get("exprs", []).filter((x) => x.name !== n).concat([{ name: n, code: outCode.value }])); renderSaved(); setStatus(statusEl, `Salva como “${n}”.`, "ok"); }),
        pill("Aplicar", applyGen, "primary")),
      h("span", { class: "hint" }, "Roda no seu computador, sem internet. “Automático” aplica na propriedade certa das layers selecionadas (ex.: Escala); “Propriedade selecionada” usa a que estiver marcada na timeline."),
      h("details", {}, h("summary", { class: "hint", style: "cursor:pointer" }, "Exemplos"), examples));
    return [
      assistant,
      sec("Biblioteca", h("span", { class: "hint" }, "Selecione a propriedade na timeline e clique para aplicar."), lib),
      sec("Expressão personalizada", area, line(nm, pill("Salvar", () => {
        const n = nm.value.trim(); if (!n || !area.value.trim()) return setStatus(statusEl, "Dê um nome e escreva a expressão.", "err");
        store.set("exprs", store.get("exprs", []).filter((x) => x.name !== n).concat([{ name: n, code: area.value }])); nm.value = ""; renderSaved();
      }), h("span", { class: "sp" }), pill("Aplicar", () => run({ id: "exprApply", code: area.value }), "primary")), saved),
      sec("Expressões nas layers", line(pill("Escanear", scan, "primary"), h("span", { class: "sp" }),
        pill("Desativar todas", () => { run({ id: "exprToggle", on: false }); setTimeout(scan, 300); }, "danger"), pill("Ativar todas", () => { run({ id: "exprToggle", on: true }); setTimeout(scan, 300); })), scanList)
    ];
  }

  // ============================================================ CAROUSEL / ORBIT
  function carousel() {
    const mode = seg([["carousel", "Carrossel 3D"], ["orbit", "Órbita 2D"]], "carousel");
    const copies = num(6, 40, 2), radius = num(0, 52, 0), speed = num(30, 44);
    const face = sw(false), fade = sw(true), flt = sw(false);
    return [
      sec("Carrossel e órbita", line(mode),
        line("Cópias", copies, "Raio", radius, "px", h("span", { class: "hint" }, "(0 = automático)")),
        line("Velocidade", speed, "°/s"),
        line("Encarar câmera", face.el, "Fade de profundidade", fade.el, "Flutuar", flt.el),
        line(h("span", { class: "sp" }), pill("Criar", () => run({ id: "carousel", mode: mode.value, copies: +copies.value, radius: +radius.value, speed: +speed.value, faceCam: face.input.checked, depthFade: fade.input.checked, bob: flt.input.checked }), "primary")),
        h("span", { class: "hint" }, "Selecione 1 layer. Ela é duplicada em volta de um null que gira; ajuste a velocidade no slider do null."))
    ];
  }

  // ============================================================ CAMERA (3D camera, parallax, command assistant)
  const MOVE_LABEL = {
    push: "Aproximar", pull: "Afastar", truckL: "Lateral ←", truckR: "Lateral →", up: "Subir", down: "Descer",
    orbitL: "Órbita ←", orbitR: "Órbita →", tiltUp: "Inclinar ↑", tiltDown: "Inclinar ↓", rollL: "Girar ↺", rollR: "Girar ↻",
    zoomIn: "Zoom +", zoomOut: "Zoom −", hold: "Pausa"
  };
  const MOVE_AMOUNT = { push: 600, pull: 600, truckL: 400, truckR: 400, up: 250, down: 250, orbitL: 30, orbitR: 30, tiltUp: 10, tiltDown: 10, rollL: 8, rollR: 8, zoomIn: 1.4, zoomOut: 1.4, hold: 0 };
  const MOVE_UNIT = { orbitL: "°", orbitR: "°", tiltUp: "°", tiltDown: "°", rollL: "°", rollR: "°", zoomIn: "×", zoomOut: "×", hold: "" };

  // Local Portuguese command parser: turns a sentence into a sequence of camera moves.
  function parseCameraCommand(text) {
    const norm = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const clauses = norm.split(/\s*(?:,|;|\.|\be depois\b|\bdepois\b|\bem seguida\b|\bentao\b|\be por fim\b|\bpor fim\b|\bapos isso\b)\s*/).filter((c) => c.trim());
    const moves = [];
    clauses.forEach((c) => {
      let type = null;
      const left = /esquerda/.test(c), right = /direita/.test(c);
      if (/\bzoom\b/.test(c)) type = /(out|afast|para tras|reduz|abr)/.test(c) ? "zoomOut" : "zoomIn";
      else if (/(orbit|ao redor|em volta|circul|contorn)/.test(c)) type = left ? "orbitL" : "orbitR";
      else if (/(aproxim|chegue|chega|avanc|push|entre na|para perto|mais perto|dolly in)/.test(c)) type = "push";
      else if (/(afast|recu|pull|para longe|mais longe|dolly out|revel)/.test(c)) type = "pull";
      else if (/(inclin|tilt|olhe para (cima|baixo))/.test(c)) type = /(baixo|desc)/.test(c) ? "tiltDown" : "tiltUp";
      else if (/(roll|rode|gire a camera|girar a camera|rotacion)/.test(c)) type = left ? "rollL" : "rollR";
      else if (/(suba|subir|sobe|eleve|para cima|pedestal up)/.test(c)) type = "up";
      else if (/(desca|descer|desce|abaixe|para baixo)/.test(c)) type = "down";
      else if (/(lateral|lado|deslize|desliz|trav|mova|move|truck|pan)/.test(c) || left || right) type = left ? "truckL" : "truckR";
      else if (/(pare|pausa|segure|espere|aguarde|fique parad)/.test(c)) type = "hold";
      if (!type) return;
      let dur = 1.5;
      if (/(lentamente|devagar|suave|calma|lento)/.test(c)) dur = 3;
      if (/(rapid|brusc|veloz|depressa|rapido)/.test(c)) dur = 0.8;
      const sec = c.match(/(\d+(?:[.,]\d+)?)\s*(s\b|seg)/);
      if (sec) dur = parseFloat(sec[1].replace(",", "."));
      let amount = MOVE_AMOUNT[type];
      if (/(muito|bastante|forte|bem )/.test(c)) amount *= type.indexOf("zoom") === 0 ? 1.3 : 2;
      if (/(pouco|leve|levemente|sutil|um pouco)/.test(c)) amount = type.indexOf("zoom") === 0 ? 1.15 : amount * 0.5;
      const deg = c.match(/(\d+)\s*(graus|°)/);
      if (deg && MOVE_UNIT[type] === "°") amount = +deg[1];
      moves.push({ type, amount: Math.round(amount * 100) / 100, dur });
    });
    return moves;
  }

  function camera() {
    const ease = seg([["suave", "Suave"], ["forte", "Forte"], ["linear", "Linear"]], "suave");
    const from = seg([["playhead", "Playhead"], ["start", "Início"]], "playhead");
    const durIn = num(1.5, 44, 0.1); durIn.step = "0.1";
    const settings = () => ({ ease: ease.value, from: from.value });

    // Command assistant
    const cmd = h("textarea", { class: "code", style: "min-height:56px;font-family:inherit;font-size:12.5px", placeholder: "Ex.: Aproxime a câmera lentamente e depois faça um movimento lateral suave para a direita." });
    const plan = h("div", { class: "pills wide" });
    let parsed = [];
    const renderPlan = () => {
      plan.innerHTML = "";
      if (!parsed.length) { plan.appendChild(h("span", { class: "hint" }, cmd.value.trim() ? "Não reconheci nenhum movimento. Use palavras como aproxime, afaste, lateral, suba, órbita, zoom, pausa." : "O plano aparece aqui enquanto você digita.")); return; }
      parsed.forEach((m, i) => plan.appendChild(h("button", { class: "pill", title: "Clique para remover" , on: { click: () => { parsed.splice(i, 1); renderPlan(); } } },
        `${i + 1}. ${MOVE_LABEL[m.type]} ${m.type === "hold" ? "" : m.amount + (MOVE_UNIT[m.type] ?? "px")} · ${m.dur}s`)));
    };
    cmd.addEventListener("input", () => { parsed = parseCameraCommand(cmd.value); renderPlan(); });
    renderPlan();

    // Quick moves and multi-stop builder
    const stops = [];
    const stopsBox = h("div", { class: "pills wide" });
    const renderStops = () => {
      stopsBox.innerHTML = "";
      if (!stops.length) stopsBox.appendChild(h("span", { class: "hint" }, "Clique nos movimentos com o modo Paradas ligado para montar uma sequência."));
      stops.forEach((m, i) => stopsBox.appendChild(h("button", { class: "pill", title: "Clique para remover", on: { click: () => { stops.splice(i, 1); renderStops(); } } }, `${i + 1}. ${MOVE_LABEL[m.type]} · ${m.dur}s`)));
    };
    renderStops();
    const multi = sw(false);
    const quick = pills(Object.keys(MOVE_LABEL).map((k) => pill(MOVE_LABEL[k], () => {
      const mv = { type: k, amount: MOVE_AMOUNT[k], dur: +durIn.value || 1.5 };
      if (multi.input.checked) { stops.push(mv); renderStops(); }
      else run(Object.assign({ id: "camera", moves: [mv] }, settings()));
    }, k === "hold" ? "" : "")));

    // Parallax
    const spacing = num(300, 52, 0), comp = sw(true), withCam = sw(true);
    const pMove = h("select", {}, ...[["none", "Sem movimento"], ["push", "Aproximar"], ["pull", "Afastar"], ["truckR", "Lateral →"], ["truckL", "Lateral ←"], ["orbitR", "Órbita →"]].map(([v, l]) => h("option", { value: v }, l)));
    const pDur = num(4, 40, 0.5);

    const FXCAM = [
      { id: "camFx", args: { kind: "dolly" }, name: "Dolly zoom", icon: "dolly", desc: "Câmera avança enquanto a lente abre: o fundo “estica”.", params: [{ k: "dur", label: "Duração", v: 2, suffix: "s", step: 0.1 }, { k: "amount", label: "Avanço", v: 600, suffix: "px" }] },
      { id: "camFx", args: { kind: "handheld" }, name: "Câmera na mão", icon: "hand", desc: "Leve tremor orgânico contínuo, como câmera no ombro.", params: [{ k: "freq", label: "Freq.", v: 1.2, step: 0.1 }, { k: "amount", label: "Intensidade", v: 0.8, suffix: "°", step: 0.1 }] },
      { id: "camFx", args: { kind: "impact" }, name: "Tremida de impacto", icon: "impact", desc: "Chacoalhão que some rápido, no playhead. Repita para mais impactos.", params: [{ k: "amount", label: "Força", v: 40, suffix: "px" }] },
      { id: "camFx", args: { kind: "entrance" }, name: "Entrada pelo fundo", icon: "entrance", desc: "Câmera vem de longe e para no enquadramento atual.", params: [{ k: "dur", label: "Duração", v: 2.5, suffix: "s", step: 0.1 }, { k: "amount", label: "Distância", v: 2500, suffix: "px" }] },
      { id: "camFx", args: { kind: "escape" }, name: "Final de fuga", icon: "escape", desc: "Recuo acelerado para fechar a cena.", params: [{ k: "dur", label: "Duração", v: 1.5, suffix: "s", step: 0.1 }, { k: "amount", label: "Distância", v: 3000, suffix: "px" }] },
      { id: "camFx", args: { kind: "reveal" }, name: "Revelação lateral", icon: "reveal", desc: "Desliza de lado girando levemente até a posição atual.", params: [{ k: "dur", label: "Duração", v: 2.5, suffix: "s", step: 0.1 }, { k: "amount", label: "Deslocamento", v: 700, suffix: "px" }] },
      { id: "camFx", args: { kind: "zoomBeat" }, name: "Zoom na batida", icon: "zoomBeat", desc: "Pulso de zoom em cada batida marcada na música selecionada.", params: [{ k: "amount", label: "Pulso", v: 12, suffix: "%" }] }
    ];
    const FOCUS = [
      { id: "camFx", args: { kind: "focusOn" }, name: "Foco na layer", icon: "focus", desc: "Liga a profundidade de campo e mantém a layer selecionada em foco.", params: [{ k: "aperture", label: "Abertura", v: 120 }] },
      { id: "camFx", args: { kind: "rackFocus" }, name: "Rack focus", icon: "rack", desc: "Troca o foco da 1ª layer selecionada para a 2ª, a partir do playhead.", params: [{ k: "dur", label: "Duração", v: 1.5, suffix: "s", step: 0.1 }, { k: "aperture", label: "Abertura", v: 120 }] }
    ];
    return { subs: [
      ["mov", "Movimentos", () => [sec("Comando de câmera (assistente)", cmd, plan,
        line(h("span", { class: "hint" }, "Roda localmente; entende frases em português com velocidade, intensidade, graus e segundos."), h("span", { class: "sp" }),
          pill("Executar", () => {
            if (!parsed.length) return setStatus(statusEl, "Descreva pelo menos um movimento.", "err");
            run(Object.assign({ id: "camera", moves: parsed }, settings()));
          }, "primary"))),
      sec("Movimentos", line("Duração", durIn, "s", "Suavização", ease), line("Começar em", from, h("span", { class: "sp" }), "Paradas", multi.el), quick,
        stopsBox, line(h("span", { class: "sp" }), pill("Limpar paradas", () => { stops.length = 0; renderStops(); }, "danger"),
          pill("Criar sequência", () => { if (!stops.length) return setStatus(statusEl, "Adicione paradas primeiro.", "err"); run(Object.assign({ id: "camera", moves: stops.slice() }, settings())); }, "primary")),
        h("span", { class: "hint" }, "Cria (ou reutiliza) “MP Câmera” presa a um null-alvo 3D no centro da comp."))]],
      ["parallax", "Parallax", () => [sec("Parallax e profundidade", line("Distância entre camadas", spacing, "px"), line("Manter tamanho aparente", comp.el, "Criar câmera", withCam.el),
        line("Movimento", pMove, pDur, "s", h("span", { class: "sp" }),
          pill("Aplicar parallax", () => run({ id: "parallax", spacing: +spacing.value, compensate: comp.input.checked, withCamera: withCam.input.checked || pMove.value !== "none", move: pMove.value, amount: pMove.value.indexOf("orbit") === 0 ? 25 : 400, dur: +pDur.value || 4 }), "primary")),
        h("span", { class: "hint" }, "A layer do topo fica mais perto da câmera; as de baixo, mais longe."))]],
      ["focus", "Foco", () => [catalogSec("Pontos de foco", FOCUS)]],
      ["fxcam", "FX Câmera", () => [catalogSec("Efeitos de câmera 3D", FXCAM)]]
    ] };
  }
  // ============================================================ TEMPLATES and OVERLAYS
  function templates() {
    const title = txt("Título", 130), sub = txt("Subtítulo", 130), col = color("#0a84ff"), cnt = num(3, 40, 1);
    const leakCol = color("#ff8a3d"), vig = num(65, 40, 0), grain = num(8, 40, 0);
    const ratio = h("select", {}, ...[["2.39", "2.39:1 (cinema)"], ["1.85", "1.85:1"], ["2", "2:1"]].map(([v, l]) => h("option", { value: v }, l)));
    const T = (kind, extra) => run(Object.assign({ id: "template", kind, title: clean(title.value), subtitle: clean(sub.value), color: col.value }, extra || {}));
    // Progressive counter on a new text layer (remembers the last settings).
    const cs = store.get("counterTpl", { from: 0, to: 1000, decimals: 0, frames: 60, prefix: "", suffix: "", sep: ".", font: "", size: 140, color: "#ffffff" });
    const cFrom = num(cs.from, 64), cTo = num(cs.to, 76), cDec = num(cs.decimals, 34, 0), cFr = num(cs.frames, 44, 1);
    const cPre = txt("Prefixo", 64), cSuf = txt("Sufixo", 64), cSep = seg([[".", "1.000,5"], [",", "1,000.5"]], cs.sep);
    cPre.value = cs.prefix; cSuf.value = cs.suffix;
    const cFont = h("input", { class: "txtin", style: "flex:1;min-width:120px", placeholder: "Fonte (nome PostScript, ex.: Arial-BoldMT)" });
    cFont.setAttribute("list", "mpFontsCounter");
    cFont.value = cs.font;
    const cFontList = h("datalist", { id: "mpFontsCounter" });
    const cSize = num(cs.size, 52, 1), cCol = color(cs.color);
    const createCounter = () => {
      const v = { from: +cFrom.value || 0, to: +cTo.value, decimals: Math.max(0, +cDec.value || 0), frames: Math.max(1, +cFr.value || 1),
        prefix: clean(cPre.value), suffix: clean(cSuf.value), sep: cSep.value, font: clean(cFont.value.trim()), size: Math.max(1, +cSize.value || 140), color: cCol.value };
      store.set("counterTpl", v);
      run(Object.assign({ id: "counterLayer" }, v));
    };
    return [
      sec("Contador progressivo",
        line("De", cFrom, "até", cTo, "casas", cDec),
        line("Duração", cFr, "fr", cPre, cSuf),
        line("Formato", cSep),
        line(cFont, cFontList, pill("Carregar fontes", () => run({ id: "fontsAll" }, null, (names) => {
          cFontList.innerHTML = ""; names.forEach((n) => cFontList.appendChild(h("option", { value: n })));
          setStatus(statusEl, `${names.length} fontes disponíveis para autocompletar.`, "ok");
        }), "", "Lista as fontes instaladas para sugerir enquanto você digita")),
        line("Tamanho", cSize, "px", "Cor", cCol, h("span", { class: "sp" }), pill("Criar contador", createCounter, "primary")),
        h("span", { class: "hint" }, "Cria uma layer de texto nova no centro da comp, a partir do playhead, já animada de “De” até “Até”. O ritmo fica no slider “MP Contador %” (progresso 0–100%), sem limite de tamanho do número.")),
      sec("Modelos prontos", line(title, sub), line("Cor de destaque", col),
        pills([pill("Lower third", () => T("lowerThird"), "", "Nome e cargo com barra animada"), pill("Título central", () => T("title"), "", "Título com letras subindo e linha"),
          pill("Contagem", () => T("countdown", { from: +cnt.value || 3 }), "", "Contagem regressiva com anel")], true),
        line("Contagem a partir de", cnt, h("span", { class: "hint" }, "Cada modelo vira uma precomp no playhead."))),
      sec("Overlays", pills([
        pill("Vinheta", () => run({ id: "overlay", kind: "vignette", amount: +vig.value })),
        pill("Grão", () => run({ id: "overlay", kind: "grain", amount: +grain.value })),
        pill("Letterbox", () => run({ id: "overlay", kind: "letterbox", ratio: +ratio.value })),
        pill("Light leak", () => run({ id: "overlay", kind: "leak", color: leakCol.value })),
        pill("Flash", () => run({ id: "overlay", kind: "flash" }), "", "Flash branco no playhead")
      ]), line("Vinheta", vig, "%", "Grão", grain, "Cor do leak", leakCol), line("Proporção", ratio))
    ];
  }

  // ============================================================ tabs
  // [id, icon, label, description, builder]. A builder returns sections, or { subs: [[id, label, () => sections]] }.
  // ============================================================ ÁUDIO
  function audioTools() {
    const FX = (match, alt, name, desc, icon) => ({ id: "addEffect", args: { match, alt, name }, name, icon: icon || "eq", desc, params: [] });
    return [
      catalogSec("Volume", [
        { id: "audioLevel", name: "Definir volume", icon: "volume", desc: "Ajusta o nível das layers selecionadas (dB). Com keyframes, desloca todos juntos.", params: [{ k: "db", label: "Nível", v: 0, suffix: "dB", step: 0.5 }] },
        { id: "fadeAudio", name: "Fade de áudio", icon: "audio", desc: "Entrada e saída suaves no volume das layers selecionadas.", params: [{ k: "fadeIn", label: "Entrada", v: 15, suffix: "fr" }, { k: "fadeOut", label: "Saída", v: 30, suffix: "fr" }] },
        { id: "audioMute", name: "Mudo", icon: "mute", desc: "Liga, desliga ou alterna o áudio das layers selecionadas.", params: [{ k: "mode", label: "Ação", type: "select", v: "toggle", opts: [["toggle", "Alternar"], ["off", "Mudo"], ["on", "Ligar"]] }] }
      ], "Clique para ver as opções. Clique direito aplica direto com as últimas opções."),
      catalogSec("Mixagem", [
        { id: "duck", name: "Ducking", icon: "duck", desc: "Selecione a voz primeiro e depois a música: a música abaixa enquanto a voz fala.", params: [{ k: "depth", label: "Redução", v: 12, suffix: "dB" }, { k: "threshold", label: "Limiar", v: 15, suffix: "%" }, { k: "smooth", label: "Suavizar", v: 6, suffix: "fr" }] },
        { id: "crossfade", name: "Crossfade", icon: "crossfade", desc: "Transição cruzada entre layers de áudio em sequência; sobrepõe se precisar.", params: [{ k: "frames", label: "Duração", v: 24, suffix: "fr" }] },
        { id: "matchLevels", name: "Igualar volumes", icon: "match", desc: "Analisa as layers e iguala o pico de todas ao da mais alta.", params: [{ k: "boost", label: "Ganho extra", v: 0, suffix: "dB", step: 0.5 }] }
      ]),
      catalogSec("Ritmo", [
        { id: "markBeats", name: "Marcar batidas", icon: "beat", desc: "Analisa a música selecionada e cria marcadores nas batidas.", params: [{ k: "sensitivity", label: "Sensibilidade", v: 40, suffix: "%" }, { k: "gap", label: "Intervalo mín.", v: 8, suffix: "fr" }] },
        { id: "reactBeat", name: "Reagir à batida", icon: "react", desc: "Selecione a música e as layers: a escala pulsa com o som.", params: [{ k: "amount", label: "Intensidade", v: 15, suffix: "%" }] },
        { id: "zoomBeat", name: "Zoom na batida", icon: "zoomBeat", desc: "Selecione a música (e as layers): pulso de zoom em cada batida. Marca as batidas sozinho se faltar.", params: [{ k: "amount", label: "Pulso", v: 12, suffix: "%" }] }
      ]),
      catalogSec("Efeitos de áudio", [
        FX("ADBE Aud BT", "Bass & Treble", "Bass & Treble", "Reforça ou corta graves e agudos."),
        FX("ADBE Aud HiLo", "High-Low Pass", "High-Low Pass", "Filtro passa-alta ou passa-baixa (voz de telefone, abafado)."),
        FX("ADBE Aud Reverb", "Reverb", "Reverb", "Ambiência de sala."),
        FX("ADBE Aud Delay", "Delay", "Delay", "Eco com repetições."),
        FX("ADBE Aud Stereo Mixer", "Stereo Mixer", "Stereo Mixer", "Volume e pan de cada canal."),
        FX("ADBE Aud Reverse", "Backwards", "Backwards", "Toca o áudio de trás para frente.")
      ]),
      catalogSec("Visualizar", [
        { id: "audioViz", name: "Visualizador de áudio", icon: "spectrum", desc: "Cria uma layer com espectro ou forma de onda lendo a música selecionada.", params: [{ k: "kind", label: "Tipo", type: "select", v: "spectrum", opts: [["spectrum", "Espectro"], ["waveform", "Forma de onda"]] }, { k: "color", label: "Cor", type: "color", v: "#0a84ff" }] }
      ])
    ];
  }

  const TABS = [
    ["shortcuts", "shortcuts", "Atalhos", "Efeitos de um clique: light sweep, glitch, batidas, formatos e limpeza.", shortcuts],
    ["glow", "glow", "Glow", "Glow com aparência física: bloom em camadas, limiar suave, proporção, aberração cromática e dither.", glow],
    ["workflow", "workflow", "Workflow", "Alinhar, âncora, precomp, criar layers, efeitos rápidos e utilidades.", workflow],
    ["camera", "camera", "Câmera", "Câmera 3D, parallax, pontos de foco e efeitos de câmera.", camera],
    ["templates", "templates", "Modelos", "Modelos prontos e overlays em um clique.", templates],
    ["graph", "graph", "Curvas", "Easy Ease e editor de curvas de velocidade.", graph],
    ["fonts", "fonts", "Fontes", "Encontre e troque fontes da comp e das precomps.", fonts],
    ["shape", "shape", "Shape", "Aparência, Trim Paths, tracejado e afunilamento.", shape],
    ["fx", "fx", "Efeitos", "Ligue e desligue efeitos em lote para acelerar a prévia.", effects],
    ["grad", "grad", "Gradiente", "Gradientes lineares e radiais, com fluxo animado.", gradient],
    ["expr", "expr", "Expressões", "Biblioteca, expressões salvas e varredura das layers.", expressions],
    ["carousel", "carousel", "Carrossel", "Carrossel 3D e órbita 2D em volta de um null.", carousel],
    ["audio", "audio", "Áudio", "Volume, fades, mixagem, ritmo e efeitos de áudio.", audioTools]
  ];
  // One colour family: tones derived from the accent blue (#0A84FF, hue ≈ 211°), from sky blue to navy, in menu order.
  const HUE = {};
  TABS.forEach((t, i) => {
    const k = i / Math.max(1, TABS.length - 1);
    HUE[t[0]] = "hsl(" + Math.round(200 + k * 20) + ", " + Math.round(100 - k * 30) + "%, " + Math.round(58 - k * 24) + "%)";
  });
  const built = {}, subNow = store.get("toolSubs", {});
  let current = store.get("toolTab", "shortcuts");
  function show(id) {
    current = id; store.set("toolTab", id);
    const t = TABS.find((x) => x[0] === id);
    $("toolTabs").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
    $("tools").style.setProperty("--hue", HUE[id] || "#0a84ff");
    $("toolIco").innerHTML = ""; $("toolIco").appendChild(typeof t[1] === "string" ? icon(t[1], 20) : t[1].cloneNode(true));
    $("toolTitle").textContent = tabLabel(t);
    $("toolTitle").setAttribute("data-noi18n", "");
    $("toolDesc").textContent = t[3];
    if (!built[id]) built[id] = t[4]();
    renderSubs();
    layout(true);
    $("toolBody").scrollTop = 0;
  }
  // Sentences shown as hints become a hover tooltip on the section title (keeps the boxes compact).
  function hoverHints(secs) {
    (secs || []).forEach((sx) => {
      if (!sx || sx._tips) return; sx._tips = true;
      const body = sx.querySelector(":scope > .body"), h4 = sx.querySelector(":scope > h4");
      if (!body || !h4) return;
      const hints = Array.from(body.querySelectorAll(":scope > .hint"));
      if (!hints.length) return;
      const text = hints.map((x) => x.textContent.trim()).join(" ");
      hints.forEach((x) => x.remove());
      sx.title = ""; h4.title = text;
      h4.appendChild(h("span", { class: "tipdot", title: text }, "i"));
    });
    return secs;
  }
  function currentSecs() {
    const b = built[current];
    if (!b || !b.subs) return hoverHints(b || []);
    const sid = subNow[current] && b.subs.some((s) => s[0] === subNow[current]) ? subNow[current] : b.subs[0][0];
    const s = b.subs.find((x) => x[0] === sid);
    if (!s._secs) s._secs = s[2]();
    return hoverHints(s._secs);
  }
  function renderSubs() {
    const bar = $("toolSubs"), b = built[current];
    bar.innerHTML = "";
    bar.classList.toggle("hidden", !(b && b.subs));
    if (!b || !b.subs) return;
    const sid = subNow[current] || b.subs[0][0];
    b.subs.forEach(([id, label]) => {
      const btn = h("button", { class: id === sid ? "on" : "", on: { click: () => {
        subNow[current] = id; store.set("toolSubs", subNow); renderSubs(); layout(true); $("toolBody").scrollTop = 0;
      } } }, label);
      btn.dataset.id = id;
      bar.appendChild(btn);
    });
    subsSort.applySaved();
  }
  // Sub-tabs can be reordered by press-and-hold + drag (order saved per tab).
  const subsSort = window.MPBoxes.sortable($("toolSubs"), "button", () => "subs:" + current, (b) => b.dataset.id);
  // Two columns when there is room: each section goes to the currently shorter column (simple masonry).
  let lastCols = 0;
  function layout(force) {
    const body = $("toolBody"), secs = currentSecs();
    const n = body.clientWidth >= 600 && secs.length > 1 ? 2 : 1;
    if (!force && n === lastCols) return;
    lastCols = n;
    // Saved per tab (and per sub-tab): order, full-width boxes and custom heights.
    const b = built[current], scope = "tools:" + current + (b && b.subs ? ":" + (subNow[current] || b.subs[0][0]) : "");
    const top = body.scrollTop;
    window.MPBoxes.arrange(body, secs, scope, () => layout(true));
    body.scrollTop = top;
  }
  // Deferred to the next frame to avoid "ResizeObserver loop" warnings.
  new ResizeObserver(() => requestAnimationFrame(() => layout())).observe($("toolBody"));

  // Tab labels are translated here with an explicit kind ("Glow" is a name, the others are UI),
  // because some words are both an effect name and a tab name (e.g. "Curvas").
  const tabLabel = (t) => (window.MPI18N ? window.MPI18N.trK(t[2], window.MPI18N.NAME) : t[2]);   // tool names follow the Titles language
  function renderTabLabels() {
    $("toolTabs").querySelectorAll("button").forEach((b) => {
      const t = TABS.find((x) => x[0] === b.dataset.id);
      b.querySelector("span:not(.tile)").textContent = tabLabel(t);
      b.title = tabLabel(t);
    });
    const cur = TABS.find((x) => x[0] === current);
    if (cur) $("toolTitle").textContent = tabLabel(cur);
  }
  // Narrow panel: a grid of coloured tiles (home); choosing one opens the tool with a Back button.
  // Wide panel: the same buttons form a sidebar (see hierarchy.css). No overflowing tab strip.
  const goHome = (on) => { $("tools").classList.toggle("home", on); store.set("toolHome", on); };
  function addTile(id, ic, label) {
    const tile = h("span", { class: "tile" }, typeof ic === "string" ? icon(ic, 22) : ic.cloneNode(true));
    tile.style.setProperty("--hue", HUE[id] || "#0a84ff");
    const b = h("button", { "data-noi18n": "", on: { click: () => { show(id); goHome(false); } } }, tile, h("span", {}, label));
    b.dataset.id = id;
    $("toolTabs").appendChild(b);
  }
  TABS.forEach(([id, ic, label]) => addTile(id, ic, label));
  // Other panels embedding these tools (Motion Studio) can add categories:
  // { id, label, desc, icon: icon name or SVG element, build: () => [section elements] }
  window.MPTools = {
    addTab(def) {
      if (TABS.some((t) => t[0] === def.id)) return;
      TABS.push([def.id, def.icon, def.label, def.desc || "", def.build]);
      HUE[def.id] = "#0a84ff";
      addTile(def.id, def.icon, def.label);
      renderTabLabels();
      if (wantedTab === def.id) show(def.id);
    },
    // Moves a whole category out of Ferramentas (Motion Studio shows Workflow on its Básico tab):
    // returns its sections and removes its tile.
    takeTab(id) {
      const i = TABS.findIndex((t) => t[0] === id);
      if (i < 0) return [];
      const secs = hoverHints(built[id] || (built[id] = TABS[i][4]()));
      TABS.splice(i, 1);
      const tileBtn = $("toolTabs").querySelector('[data-id="' + id + '"]');
      if (tileBtn) tileBtn.remove();
      if (current === id) { show("shortcuts"); }
      return Array.isArray(secs) ? secs : [];
    }
  };
  $("toolBack").addEventListener("click", () => goHome(true));
  renderTabLabels();
  document.addEventListener("mp:lang", renderTabLabels);
  // Tool tabs can be reordered by press-and-hold + drag (order saved).
  window.MPBoxes.sortable($("toolTabs"), "button", "toolTabs", (b) => b.dataset.id);
  const wantedTab = current;   // may be a category added later by MPTools.addTab
  if (!TABS.some((t) => t[0] === current)) current = "shortcuts";
  show(current);
  goHome(store.get("toolHome", true));
  setStatus(statusEl, "Selecione layers na comp e escolha uma ferramenta.");
})();
