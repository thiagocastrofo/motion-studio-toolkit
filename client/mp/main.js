(function () {
  "use strict";
  const cep = window.__adobe_cep__;
  const LIB = window.MP_LIB;
  const $ = (id) => document.getElementById(id);

  // ============================================================ host bridge (client/bridge.js)
  const { evalHost, call, handle, setStatus } = window.MPUI;
  const T = (s) => (window.MPI18N ? window.MPI18N.tr(s) : s);

  // Warm-up: loads the host scripts once; a failure is shown in the status bar right away.
  if (cep) evalHost("'ok:'+(typeof MPT)", (r) => { if (r && r.indexOf("error:") === 0) setStatus($("status"), r.slice(6), "err"); });

  // ============================================================ state
  const SECTIONS = [
    { id: "transitions", title: "Transições", color: "#0a84ff", lib: LIB.transitions },
    { id: "text", title: "Texto", color: "#bf5af2", lib: LIB.text },
    { id: "loops", title: "Loops", color: "#30d158", lib: LIB.loops }
  ];
  const ALL = [];
  SECTIONS.forEach((s) => s.lib.forEach((p) => { p.section = s.id; ALL.push(p); }));
  const BY_ID = {};
  ALL.forEach((p) => { BY_ID[p.id] = p; });

  // Each category gets one hue, used everywhere that category appears (sidebar dot, chip, card glyph,
  // selection thumbnail), so colour always means the same thing (HIG Color: consistent meaning).
  // One colour family per section (Transitions blue, Text violet, Loops green); each category is a
  // variation inside its family (hue shift + light → deep), so the colour says both section and category.
  const FAMILY = { transitions: [212, 92], text: [272, 78], loops: [148, 62] };
  const hsl2hex = (h, s, l) => {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))).toString(16).padStart(2, "0");
    return "#" + f(0) + f(8) + f(4);
  };
  const CAT_HUE = {};
  SECTIONS.forEach((s) => {
    const cats = [];
    s.lib.forEach((p) => { if (cats.indexOf(p.cat) < 0) cats.push(p.cat); });
    s.cats = cats;
    const [hue, sat] = FAMILY[s.id], n = Math.max(1, cats.length - 1);
    cats.forEach((c, i) => {
      const t = i / n;
      CAT_HUE[s.id + ":" + c] = hsl2hex(hue - 14 + t * 28, sat, 64 - t * 22);
    });
  });
  const lighten = (hex, k) => "#" + [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * k).toString(16).padStart(2, "0");
  }).join("");
  const hueOf = (p) => CAT_HUE[p.section + ":" + p.cat] || "#0a84ff";
  const paintHue = (el, hex) => { el.style.setProperty("--hue", hex); el.style.setProperty("--hue2", lighten(hex, 0.45)); };

  const store = window.MPUI.store;
  const state = {
    folder: store.get("folder", "sec:transitions"),
    closed: store.get("closed", {}),
    favs: new Set(store.get("favs", [])),
    selected: null,
    q: ""
  };

  // ============================================================ previews
  const EASE_CSS = { smooth: "cubic-bezier(.45,0,.55,1)", snappy: "cubic-bezier(.15,.85,.25,1)", soft: "cubic-bezier(.35,0,.25,1)", strong: "cubic-bezier(.8,0,.2,1)", linear: "linear" };
  const ORDER = ["position", "rotation", "rotX", "rotY", "scale", "fx", "opacity"];
  const orderOf = (t) => ORDER.indexOf(t.prop.indexOf("fx:") === 0 ? "fx" : t.prop);

  function cssFrame(track, spec) {
    const base = spec === "base", p = track.prop;
    if (p === "position") {
      const d = base ? [0, 0] : [(spec.dw || 0) * 300, (spec.dh || 0) * 200];
      const z = base ? 1 : 1500 / (1500 + (spec.dz || 0));
      return { transform: `translate(${d[0]}px,${d[1]}px) scale(${z})` };
    }
    if (p.indexOf("mask:") === 0) {
      const o = base ? 1 : Math.max(0, 1 + spec), kind = p.slice(5), c = (1 - o) * 50;
      if (kind === "ellipse") return { clipPath: `circle(${o * 75}% at 50% 50%)` };
      const e = o * 100;
      if (kind === "diamond") return { clipPath: `polygon(50% ${50 - e}%, ${50 + e}% 50%, 50% ${50 + e}%, ${50 - e}% 50%)` };
      if (kind === "curtainH") return { clipPath: `inset(0 ${c}%)` };
      if (kind === "curtainV") return { clipPath: `inset(${c}% 0)` };
      return { clipPath: `inset(${c}%)` };
    }
    if (p === "rotation") return { transform: `rotate(${base ? 0 : spec.add}deg)` };
    if (p === "rotX") return { transform: `rotateX(${base ? 0 : spec.add}deg)` };
    if (p === "rotY") return { transform: `rotateY(${base ? 0 : spec.add}deg)` };
    if (p === "scale") {
      if (base) return { transform: "scale(1,1)" };
      if (spec.mulv) return { transform: `scale(${spec.mulv[0]},${spec.mulv[1]})` };
      return { transform: `scale(${spec.mul},${spec.mul})` };
    }
    if (p === "opacity") return { opacity: base ? 1 : spec / 100 };
    const n = base ? 0 : spec;
    if (/Brightness/.test(p)) return { filter: `brightness(${1 + n / 60})` };
    if (/Turbulent/.test(p)) return { filter: `blur(${n / 50}px) hue-rotate(${n}deg)` };
    if (/Blur/.test(p)) return { filter: `blur(${n / 6}px)` };
    if (/Linear Wipe/.test(p)) {
      const a = (track.fxSet || {})[2], c = n + "%";
      const inset = a === 270 ? `0 ${c} 0 0` : a === 90 ? `0 0 0 ${c}` : a === 180 ? `0 0 ${c} 0` : a === 0 ? `${c} 0 0 0` : `0 ${c} ${c} 0`;
      return { clipPath: `inset(${inset})` };
    }
    return { opacity: 1 - n / 100 };
  }
  function withEdges(fr) {
    if (fr[0].offset > 0) fr.unshift(Object.assign({}, fr[0], { offset: 0 }));
    if (fr[fr.length - 1].offset < 1) fr.push(Object.assign({}, fr[fr.length - 1], { offset: 1 }));
    return fr;
  }
  // Previews loop forever: each cycle plays the animation, then holds the end state before restarting.
  const CYCLE = 2000, LEAD = 0.08;
  // With "reduce motion" on, previews play once and rest instead of looping.
  const loopOpts = { duration: CYCLE, iterations: window.MPUI.reduceMotion ? 1 : Infinity };
  // Squeeze keyframe offsets (0..1) into the [s, e] part of the cycle.
  const squeeze = (fr, s, e) => fr.map((f) => Object.assign({}, f, { offset: s + f.offset * (e - s) }));

  function transformPreview(p, stage) {
    let parent = stage;
    const layers = p.tracks.slice().sort((a, b) => orderOf(a) - orderOf(b)).map((t) => {
      const el = document.createElement("div");
      parent.appendChild(el); parent = el;
      return { el, t };
    });
    const g = document.createElement("div"); g.className = "glyph"; parent.appendChild(g);
    let anims = [];
    return (mode) => {
      anims.forEach((a) => a.cancel());
      anims = [];
      if (mode === "stop") return;
      const out = mode === "out";
      anims = layers.map(({ el, t }) => {
        let fr = t.keys.map((k) => Object.assign(cssFrame(t, k[1]), { offset: out ? 1 - k[0] : k[0], easing: EASE_CSS[p.ease] || "ease" }));
        if (out) fr.reverse();
        fr = squeeze(fr, LEAD, LEAD + 750 / CYCLE);
        return el.animate(withEdges(fr), loopOpts);
      });
    };
  }
  const TEXT_SAMPLE = { 1: ["M", "o", "t", "i", "o", "n"], 3: ["Olá ", "mundo ", "novo"], 4: ["Linha um", "Linha dois"] };
  function textCss(props) {
    const tf = [], f = {};
    for (const k in props) {
      const v = props[k];
      if (k === "ADBE Text Opacity") f.opacity = v / 100;
      if (k === "ADBE Text Position 3D") tf.push(`translate(${v[0] / 3}px,${v[1] / 3}px)`);
      if (k === "ADBE Text Scale 3D") tf.push(`scale(${v[0] / 100},${v[1] / 100})`);
      if (k === "ADBE Text Rotation") tf.push(`rotate(${v}deg)`);
      if (k === "ADBE Text Skew") tf.push(`skewX(${-v}deg)`);
      if (k === "ADBE Text Blur") f.filter = `blur(${v[0] / 5}px)`;
    }
    f.transform = tf.join(" ") || "none";
    return f;
  }
  function textPreview(p, stage) {
    const t = p.text, box = document.createElement("div");
    box.className = "ttext";
    const spans = (TEXT_SAMPLE[t.unit] || TEXT_SAMPLE[1]).map((s) => {
      const el = document.createElement("span"); el.textContent = s;
      if (t.unit === 4) el.style.display = "block";
      box.appendChild(el); return el;
    });
    stage.appendChild(box);
    const from = textCss(t.props), to = { opacity: 1, transform: "none" };
    if (from.filter) to.filter = "blur(0px)";
    // Elastic wave: overshoot frame between "from" and "to".
    let mid = null;
    if (t.wave) {
      const wv = textCss(t.wave);
      mid = Object.assign({}, to, { transform: wv.transform, offset: 0.6 });
      if (from.filter) mid.filter = "blur(0px)";
    }
    const track = t.props["ADBE Text Tracking Amount"];
    let order = spans.map((_, i) => i);
    if (t.random) order = order.sort(() => Math.random() - 0.5);
    let anims = [];
    return (mode) => {
      anims.forEach((a) => a.cancel());
      anims = [];
      if (mode === "stop") return;
      const n = spans.length, total = 900, out = mode === "out";
      const easing = t.drive === "start" ? "linear" : (EASE_CSS[p.ease] || "ease");
      anims = spans.map((el, i) => {
        const rank = order.indexOf(i);
        let delay = 0, dur = total;
        if (t.drive === "offset") { dur = total * 0.45; delay = (rank / Math.max(1, n - 1)) * (total - dur); }
        if (t.drive === "start") { dur = 30; delay = (rank / n) * total; }
        if (t.wave && t.drive === "offset") dur = Math.min(total - delay, dur * 1.3);
        if (out) delay = total - delay - dur;
        let fr = (mid ? [from, mid, to] : [from, to]).map((f, j, arr) => Object.assign({}, f, { offset: f.offset ?? j / (arr.length - 1), easing }));
        if (out) fr = fr.map((f) => Object.assign({}, f, { offset: 1 - f.offset })).reverse();
        const s = LEAD + delay / CYCLE, e = s + dur / CYCLE;
        return el.animate(withEdges(squeeze(fr, s, e)), loopOpts);
      });
      if (track !== undefined) {
        let ls = [{ letterSpacing: track / 20 + "px", offset: 0, easing: EASE_CSS[p.ease] }, { letterSpacing: "0px", offset: 1 }];
        if (out) ls = [{ letterSpacing: "0px", offset: 0, easing: EASE_CSS[p.ease] }, { letterSpacing: track / 20 + "px", offset: 1 }];
        anims.push(box.animate(withEdges(squeeze(ls, LEAD, LEAD + total / CYCLE)), loopOpts));
      }
    };
  }
  function loopPreview(p, stage) {
    const w = document.createElement("div"), g = document.createElement("div");
    g.className = "glyph"; w.appendChild(g); stage.appendChild(w);
    let a = null;
    return (mode) => {
      if (a) a.cancel();
      if (mode === "stop") return;
      a = w.animate(p.pv.k, { duration: p.pv.d, iterations: Infinity, direction: p.pv.alt ? "alternate" : "normal", easing: p.pv.steps ? "steps(3, end)" : p.pv.lin ? "linear" : "ease-in-out" });
    };
  }

  // ============================================================ tree (sidebar)
  function itemsFor(folder) {
    if (folder === "fav") return ALL.filter((p) => state.favs.has(p.id));
    if (folder === "all") return ALL;
    const [kind, sec, cat] = folder.split(":");
    const s = SECTIONS.find((x) => x.id === sec);
    if (!s) return [];
    return kind === "sec" ? s.lib : s.lib.filter((p) => p.cat === cat);
  }
  function folderTitle(folder) {
    if (folder === "fav") return "Favoritos";
    if (folder === "all") return "Todas as animações";
    const [kind, sec, cat] = folder.split(":");
    const s = SECTIONS.find((x) => x.id === sec);
    return kind === "sec" ? s.title : cat;
  }
  function goFolder(folder) {
    state.folder = folder; store.set("folder", folder); if (folder !== "fav") store.set("lastScope", folder); state.q = ""; $("search").value = "";
    renderTree(); renderScope(); renderGrid(); $("grid").scrollTop = 0;
  }
  const STAR = '<svg viewBox="0 0 16 16"><path d="M8 1.9l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.3l-3.6 1.9.7-4.1-3-2.9 4.1-.6Z" fill="currentColor"/></svg>';
  const GRID = '<svg viewBox="0 0 16 16"><path d="M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  function treeItem(parent, folder, ico, name, count, hue, indent) {
    const el = document.createElement("div");
    el.className = "item" + (state.folder === folder ? " on" : "") + (indent ? " sub" : "");
    el.innerHTML = `<span class="ico">${ico}</span><span class="name"></span><span class="count">${count}</span>`;
    if (hue) paintHue(el, hue);
    el.querySelector(".name").textContent = name;
    el.addEventListener("click", () => goFolder(folder));
    parent.appendChild(el);
  }
  // Sidebar: two levels at most (section -> category), each section collapsible (HIG Sidebars).
  function renderTree() {
    const tree = $("tree");
    tree.innerHTML = "";
    treeItem(tree, "fav", STAR, "Favoritos", state.favs.size, "#ffb340");
    treeItem(tree, "all", GRID, "Todas", ALL.length);
    SECTIONS.forEach((s) => {
      const sec = document.createElement("div");
      sec.className = "sec" + (state.closed[s.id] ? " closed" : "");
      sec.innerHTML = `<span>${s.title}</span><span class="chev"><svg viewBox="0 0 16 16"><path d="M4.5 6l3.5 3.5L11.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
      sec.addEventListener("click", () => { state.closed[s.id] = !state.closed[s.id]; store.set("closed", state.closed); renderTree(); });
      tree.appendChild(sec);
      if (state.closed[s.id]) return;
      treeItem(tree, "sec:" + s.id, GRID, "Todas", s.lib.length, null, true);
      s.cats.forEach((c) => treeItem(tree, "cat:" + s.id + ":" + c, '<i class="dot"></i>', c, s.lib.filter((p) => p.cat === c).length, CAT_HUE[s.id + ":" + c], true));
    });
  }
  // Narrow panels: segmented control for the section + one row of category chips (replaces the sidebar).
  function currentSection() {
    const parts = state.folder.split(":");
    return parts[0] === "sec" || parts[0] === "cat" ? parts[1] : null;
  }
  function renderScope() {
    const seg = $("secSeg"), chips = $("chips"), cur = currentSection();
    seg.innerHTML = "";
    SECTIONS.forEach((s) => {
      const b = document.createElement("button");
      b.textContent = s.title; b.className = s.id === cur ? "on" : "";
      b.addEventListener("click", () => goFolder("sec:" + s.id));
      seg.appendChild(b);
    });
    chips.innerHTML = "";
    chips.classList.toggle("hidden", !cur);
    if (!cur) return;
    const s = SECTIONS.find((x) => x.id === cur);
    const chip = (folder, name, count, hue) => {
      const b = document.createElement("button");
      b.className = "chip" + (state.folder === folder ? " on" : "");
      b.innerHTML = (hue ? '<i class="dot"></i>' : "") + '<span class="name"></span><small>' + count + "</small>";
      b.querySelector(".name").textContent = name;
      if (hue) paintHue(b, hue);
      b.addEventListener("click", () => goFolder(folder));
      chips.appendChild(b);
    };
    chip("sec:" + s.id, "Todas", s.lib.length);
    s.cats.forEach((c) => chip("cat:" + s.id + ":" + c, c, s.lib.filter((p) => p.cat === c).length, CAT_HUE[s.id + ":" + c]));
    const on = chips.querySelector(".chip.on");
    if (on) requestAnimationFrame(() => { on.scrollIntoView({ block: "nearest", inline: "nearest" }); chipArrows(); });
    else requestAnimationFrame(chipArrows);
  }
  // Arrows appear at the ends of the category row when it does not fit (narrow panels).
  const chipWrap = document.createElement("div");
  chipWrap.className = "chipwrap";
  $("chips").parentNode.insertBefore(chipWrap, $("chips"));
  const arrow = (dir) => {
    const b = document.createElement("button");
    b.className = "chiparrow " + dir; b.type = "button"; b.title = dir === "left" ? "Categorias anteriores" : "Mais categorias";
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + (dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7") + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener("click", () => $("chips").scrollBy({ left: (dir === "left" ? -1 : 1) * Math.max(120, $("chips").clientWidth * 0.7), behavior: "smooth" }));
    return b;
  };
  const chipL = arrow("left"), chipR = arrow("right");
  chipWrap.append(chipL, $("chips"), chipR);
  function chipArrows() {
    const c = $("chips");
    chipL.classList.toggle("hidden", c.scrollLeft <= 2 || c.classList.contains("hidden"));
    chipR.classList.toggle("hidden", c.scrollLeft + c.clientWidth >= c.scrollWidth - 2 || c.classList.contains("hidden"));
  }
  $("chips").addEventListener("scroll", chipArrows);
  new ResizeObserver(() => requestAnimationFrame(chipArrows)).observe($("chips"));

  // ============================================================ grid
  // Only cards on screen run their looping preview; off-screen ones are stopped to save CPU.
  const visibility = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.target._play) en.target._play(en.isIntersecting ? en.target._mode : "stop"); });
  }, { root: $("grid"), rootMargin: "80px" });
  function card(p) {
    const el = document.createElement("div");
    el.className = "card" + (state.selected === p ? " sel" : "");
    el.title = T(p.name) + " — " + T(p.cat);
    el.tabIndex = 0;
    paintHue(el, hueOf(p));
    const stage = document.createElement("div"); stage.className = "stage";
    const foot = document.createElement("div"); foot.className = "cardfoot";
    foot.innerHTML = `<span class="label"></span>`;
    foot.querySelector(".label").textContent = p.name;
    const star = document.createElement("button");
    star.className = "star" + (state.favs.has(p.id) ? " on" : "");
    star.innerHTML = STAR; star.title = "Favoritar";
    star.addEventListener("click", (e) => { e.stopPropagation(); toggleFav(p, star); });
    foot.appendChild(star);
    el.appendChild(stage); el.appendChild(foot);
    const play = p.type === "text" ? textPreview(p, stage) : p.type === "loop" ? loopPreview(p, stage) : transformPreview(p, stage);
    el._play = play;
    el._mode = "in";
    visibility.observe(el);
    el.addEventListener("click", () => select(p, el));
    el.addEventListener("dblclick", () => apply(p.type === "loop" ? "loop" : "in"));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(p, el); } });
    return el;
  }
  function renderGrid() {
    const grid = $("grid"), q = state.q.toLowerCase();
    visibility.disconnect();
    grid.innerHTML = "";
    // Matches the name in either language (the search box accepts Portuguese or English).
    const both = (s) => (window.MPI18N ? window.MPI18N.alt(s) : s);
    let list = q ? ALL.filter((p) => (both(p.name) + " " + both(p.cat) + " " + p.section).toLowerCase().indexOf(q) >= 0) : itemsFor(state.folder);
    const title = q ? `Busca: “${state.q}”` : folderTitle(state.folder);
    const h = document.createElement("div"); h.className = "crumb";
    h.innerHTML = `<span></span><small>${list.length}</small>`;
    h.firstChild.textContent = title;
    grid.appendChild(h);
    $("favFilter").classList.toggle("on", state.folder === "fav");
    if (!list.length) {
      const fav = state.folder === "fav" && !q;
      const e = document.createElement("div"); e.className = "emptystate";
      e.innerHTML = `<span class="es-ico">${fav ? STAR : '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'}</span><b></b><span></span>`;
      e.querySelector("b").textContent = fav ? "Nenhum favorito ainda" : "Nada encontrado";
      e.querySelector("span:last-child").textContent = fav ? "Passe o mouse numa animação e clique na estrela para guardá-la aqui." : "Tente outro nome, em português ou inglês.";
      grid.appendChild(e); return;
    }
    const wrap = document.createElement("div"); wrap.className = "cards";
    list.forEach((p) => wrap.appendChild(card(p)));
    grid.appendChild(wrap);
  }
  // Updates the star in place (keeps the scroll position); the grid is rebuilt only inside Favoritos.
  function toggleFav(p, starEl) {
    if (state.favs.has(p.id)) state.favs.delete(p.id); else state.favs.add(p.id);
    store.set("favs", Array.from(state.favs));
    renderTree();
    if (state.folder === "fav" || !starEl) renderGrid(); else starEl.classList.toggle("on", state.favs.has(p.id));
  }

  // ============================================================ selection and actions
  function select(p, el) {
    state.selected = p;
    document.querySelectorAll(".card.sel").forEach((c) => c.classList.remove("sel"));
    if (el) el.classList.add("sel");
    const isLoop = p.type === "loop";
    showSelection();
    $("animBtns").classList.toggle("hidden", isLoop);
    $("loopBtns").classList.toggle("hidden", !isLoop);
    document.querySelectorAll(ACTION_BTNS).forEach((b) => { b.disabled = isLoop && b.dataset.mode === "scenes"; });
    $("actionbar").classList.add("has-sel");
    setStatus($("status"), isLoop ? "Selecione layers e clique em Aplicar loop." : "Selecione layers e escolha Entrada, Saída ou Entrada e Saída.");
  }
  // Selection summary: name (headline) + section · category (secondary) + a thumbnail in the category hue.
  function showSelection() {
    const p = state.selected;
    if (!p) return;
    const s = SECTIONS.find((x) => x.id === p.section);
    $("selName").textContent = T(p.name);
    $("selCat").textContent = T(s.title) + " · " + T(p.cat);
    paintHue($("selThumb"), hueOf(p));
  }
  const ACTION_BTNS = "#animBtns button, #loopBtns button, #moreMenu [data-mode]";
  function frames() { return Math.max(1, parseInt($("frames").value, 10) || 15); }
  function apply(mode) {
    const p = state.selected;
    if (!p) return;
    const label = T({ in: "Entrada", out: "Saída", both: "Entrada e Saída", loop: "Loop", scenes: "Entre cenas" }[mode]);
    const name = T(p.name);
    call("MP.apply", {
      // The displayed (language-dependent) name is what appears on the marker and in Effect Controls.
      preset: Object.assign({}, p, { name }), mode: mode === "loop" ? "in" : mode, frames: frames(),
      stagger: Math.max(0, parseInt($("stagger").value, 10) || 0),
      anchor: $("playhead").checked ? "playhead" : "layer",
      markers: true
    }, `${name} (${label}) aplicado em {n} layer(s).`);
  }
  document.querySelectorAll(ACTION_BTNS).forEach((b) => {
    b.addEventListener("click", () => { toggleMore(false); apply(b.dataset.mode); });
    // Hovering "Saída" previews the selected card's exit in loop; leaving restores the entrance loop.
    const setMode = (m) => {
      const el = document.querySelector(".card.sel");
      if (!el || b.dataset.mode === "loop" || el._mode === m) return;
      el._mode = m; el._play(m);
    };
    b.addEventListener("mouseenter", () => setMode(b.dataset.mode === "out" ? "out" : "in"));
    b.addEventListener("mouseleave", () => setMode("in"));
  });

  // ============================================================ wiring
  $("views").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    $("views").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    ["browse", "build", "edit", "tools"].forEach((v) => $(v).classList.toggle("hidden", b.dataset.v !== v));
    document.dispatchEvent(new CustomEvent("mp:view", { detail: b.dataset.v }));
  }));
  // Adaptive layout: wide panels show the sidebar; narrow ones show the segmented control + chips instead
  // (HIG Layout: same functionality, more or less of it visible depending on space).
  const WIDE = 560;
  let treeHidden = store.get("treeHidden", false);
  function applyWidth() {
    const wide = document.body.clientWidth >= WIDE;
    document.body.classList.toggle("wide", wide);
    $("browse").classList.toggle("use-tree", wide && !treeHidden);
    document.dispatchEvent(new CustomEvent("mp:width", { detail: wide }));
  }
  new ResizeObserver(() => requestAnimationFrame(applyWidth)).observe(document.body);
  $("sideToggle").addEventListener("click", () => { treeHidden = !treeHidden; store.set("treeHidden", treeHidden); applyWidth(); });
  $("favFilter").addEventListener("click", () => goFolder(state.folder === "fav" ? store.get("lastScope", "sec:transitions") : "fav"));
  $("search").addEventListener("input", (e) => { state.q = e.target.value.trim(); renderGrid(); });
  // Duration: stepper in the bar (always visible) mirrors the slider in the ⋯ menu.
  const setFrames = (v) => {
    v = Math.max(1, Math.min(600, parseInt(v, 10) || 15));
    $("frames").value = v; $("framesRange").value = v; store.set("lastFrames", v);
  };
  $("framesRange").addEventListener("input", (e) => setFrames(e.target.value));
  $("frames").addEventListener("change", (e) => setFrames(e.target.value));
  document.querySelectorAll(".dur .stepper button").forEach((b) => b.addEventListener("click", () => setFrames(frames() + +b.dataset.f)));
  setFrames(store.get("lastFrames", 15));
  document.querySelectorAll("#moreMenu .stepper button").forEach((b) => b.addEventListener("click", () => {
    const s = $("stagger"); s.value = Math.max(0, (parseInt(s.value, 10) || 0) + +b.dataset.d);
  }));
  // ⋯ menu: secondary options and less frequent actions (progressive disclosure).
  const moreMenu = $("moreMenu"), moreBtn = $("moreBtn");
  function toggleMore(open) {
    const show = open !== undefined ? open : moreMenu.classList.contains("hidden");
    moreMenu.classList.toggle("hidden", !show);
    moreBtn.setAttribute("aria-expanded", String(show));
    moreBtn.classList.toggle("on", show);
  }
  moreBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleMore(); });
  document.addEventListener("click", (e) => { if (!moreMenu.contains(e.target) && e.target !== moreBtn) toggleMore(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleMore(false); });
  $("clear").addEventListener("click", () => { toggleMore(false); evalHost("MP.clear()", (r) => handle($("status"), r, "Animações e marcadores removidos de {n} layer(s).")); });
  // Language: names in English + explanations in Portuguese (default), all Portuguese, or all English.
  // Top menu (Navegar / Montar / Editar / Ferramentas) can be reordered by press-and-hold + drag.
  window.MPBoxes.sortable($("views"), "button", "views", (b) => b.dataset.v);
  // Globe button: opens a small menu; the current language is marked with a check.
  const langMenu = $("langMenu"), langBtn = $("langBtn");
  const markLang = () => {
    const L = window.MPI18N ? window.MPI18N.lang : { names: "en", ui: "pt" }, en = L.ui === "en";
    langMenu.querySelectorAll("button").forEach((b) => b.classList.toggle("on", L[b.dataset.part] === b.dataset.lang));
    // Group titles follow the explanations language; language names stay in their own language.
    langMenu.querySelector('[data-lm="names"]').textContent = en ? "Titles" : "Títulos";
    langMenu.querySelector('[data-lm="ui"]').textContent = en ? "Explanations" : "Explicações";
    langBtn.title = en ? "Language" : "Idioma";
  };
  markLang();
  const toggleLang = (open) => {
    const show = open !== undefined ? open : langMenu.classList.contains("hidden");
    langMenu.classList.toggle("hidden", !show);
    langBtn.setAttribute("aria-expanded", String(show));
    if (show) markLang();
  };
  langBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleLang(); });
  langMenu.querySelectorAll("button").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation(); window.MPI18N.setLang(b.dataset.part, b.dataset.lang); markLang();
  }));
  document.addEventListener("click", (e) => { if (!langMenu.contains(e.target)) toggleLang(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleLang(false); });
  document.addEventListener("mp:lang", () => {
    renderTree(); renderScope(); renderGrid();
    showSelection();
    if (!state.selected) setStatus($("status"), ALL.length + " " + T("animações") + ".");
  });

  if (!itemsFor(state.folder).length && state.folder !== "fav") state.folder = "sec:transitions";
  renderTree();
  renderScope();
  renderGrid();
  applyWidth();
  setStatus($("status"), ALL.length + " " + T("animações") + ".");
})();
