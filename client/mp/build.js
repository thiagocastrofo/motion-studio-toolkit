// "Montar": entrance + optional loop + exit applied to the selected layers in one click.
(function () {
  "use strict";
  const { evalHost, setStatus, store, icon } = window.MPUI;
  const LIB = window.MP_LIB;
  const $ = (id) => document.getElementById(id);
  const statusEl = $("buildStatus");
  const anims = LIB.transitions.concat(LIB.text);
  const byId = {};
  anims.concat(LIB.loops).forEach((p) => { byId[p.id] = p; });

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "class") e.className = attrs[k];
      else if (k === "on") for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]);
      else e.setAttribute(k, attrs[k]);
    }
    kids.flat().forEach((c) => c != null && e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return e;
  }
  // <select> grouped like the browse tree: section › category.
  function picker(list, noneLabel, extra) {
    const s = el("select", { class: "bigselect" });
    s.appendChild(el("option", { value: "" }, noneLabel));
    (extra || []).forEach(([v, l]) => s.appendChild(el("option", { value: v }, l)));
    const groups = {};
    list.forEach((p) => {
      const g = (p.type === "text" ? "Texto" : p.type === "loop" ? "Loops" : "Transições") + " › " + p.cat;
      (groups[g] = groups[g] || []).push(p);
    });
    Object.keys(groups).forEach((g) => {
      const og = el("optgroup", { label: g });
      groups[g].forEach((p) => og.appendChild(el("option", { value: p.id }, p.name)));
      s.appendChild(og);
    });
    return s;
  }
  const num = (v) => { const i = el("input", { class: "num", type: "number", min: "1", value: v }); return i; };
  const saved = store.get("build", { inId: "fade-up", inFr: 15, loopId: "", outId: "same", outFr: 12, stagger: 0 });

  const inSel = picker(anims, "Sem entrada"), loopSel = picker(LIB.loops, "Sem loop"), outSel = picker(anims, "Sem saída", [["same", "Igual à entrada (espelhada)"]]);
  const inFr = num(saved.inFr), outFr = num(saved.outFr), stag = num(saved.stagger);
  stag.min = "0";
  inSel.value = saved.inId; loopSel.value = saved.loopId; outSel.value = saved.outId;

  const step = (cls, ic, title, ...kids) => {
    const s = el("div", { class: "tsec buildstep " + cls }, el("h4", {}, el("span", { class: "stepico" }, icon(ic, 16)), title), el("div", { class: "body" }, ...kids));
    s.dataset.boxKey = title;
    return s;
  };
  const line = (...kids) => el("div", { class: "line" }, ...kids);

  function save() {
    store.set("build", { inId: inSel.value, inFr: +inFr.value, loopId: loopSel.value, outId: outSel.value, outFr: +outFr.value, stagger: +stag.value });
  }
  [inSel, loopSel, outSel, inFr, outFr, stag].forEach((x) => x.addEventListener("change", save));

  // Timeline summary: entrance | hold (or loop) | exit, widths proportional to the frames.
  const T = (x) => (window.MPI18N ? window.MPI18N.tr(x) : x);
  const tl = el("div", { class: "buildtl" });
  function renderTimeline() {
    tl.innerHTML = "";
    const name = (id) => (byId[id] ? T(byId[id].name) : "");
    const outId = outSel.value === "same" ? inSel.value : outSel.value;
    const a = inSel.value ? Math.max(1, +inFr.value || 15) : 0, c = outId ? Math.max(1, +outFr.value || 12) : 0;
    const seg = (cls, label, sub, grow) => {
      const d = el("div", { class: cls }, el("b", {}, label), el("small", {}, sub));
      d.style.flexGrow = String(grow); d.title = label + " — " + sub;
      tl.appendChild(d);
    };
    if (a) seg("tl-in", T("Entrada"), name(inSel.value) + " · " + a + " fr", a);
    if (loopSel.value) seg("tl-loop", "Loop", name(loopSel.value), Math.max(30, a + c));
    else seg("tl-hold", T("Parado"), T("sem loop"), Math.max(30, a + c));
    if (c) seg("tl-out", T("Saída"), name(outId) + " · " + c + " fr", c);
  }
  [inSel, loopSel, outSel, inFr, outFr].forEach((x) => { x.addEventListener("change", renderTimeline); x.addEventListener("input", renderTimeline); });
  document.addEventListener("mp:lang", renderTimeline);
  renderTimeline();

  // Apply the three steps in sequence (each waits for the previous host call).
  function applyAll() {
    save();
    const steps = [];
    const mk = document.getElementById("markers");
    const common = { stagger: Math.max(0, +stag.value || 0), anchor: "layer", markers: mk ? mk.checked : true };
    if (inSel.value) steps.push({ preset: byId[inSel.value], mode: "in", frames: Math.max(1, +inFr.value || 15) });
    if (loopSel.value) steps.push({ preset: byId[loopSel.value], mode: "in", frames: 1 });
    const outId = outSel.value === "same" ? inSel.value : outSel.value;
    if (outId) steps.push({ preset: byId[outId], mode: "out", frames: Math.max(1, +outFr.value || 12) });
    if (!steps.length) return setStatus(statusEl, "Escolha pelo menos uma etapa.", "err");
    const done = [];
    const next = (i) => {
      if (i >= steps.length) return setStatus(statusEl, "Pronto: " + done.join(" + ") + ".", "ok");
      const s = Object.assign({}, common, steps[i]);
      // Localized name (marker / Effect Controls follow the language mode).
      s.preset = Object.assign({}, s.preset, { name: window.MPI18N ? window.MPI18N.tr(s.preset.name) : s.preset.name });
      evalHost("MP.apply(" + JSON.stringify(JSON.stringify(s)) + ")", (r) => {
        if (!r || r.indexOf("error:") === 0 || r === "EvalScript error.") {
          return setStatus(statusEl, `Etapa “${s.preset.name}”: ${r ? r.replace(/^error:/, "") : "erro no AE"}`, "err");
        }
        done.push(s.preset.name + (s.mode === "out" ? " (saída)" : ""));
        next(i + 1);
      });
    };
    next(0);
  }

  const body = $("buildBody");
  const steps = [
    step("step-sum", "build", "Resumo", tl),
    step("step-in", "entrance", "1 · Entrada", inSel, line("Duração", inFr, el("em", { class: "hint" }, "fr"))),
    step("step-loop", "loopvid", "2 · Loop (opcional)", loopSel, el("span", { class: "hint" }, "Fica ativo entre a entrada e a saída; ajuste nos sliders MP em Efeitos.")),
    step("step-out", "escape", "3 · Saída", outSel, line("Duração", outFr, el("em", { class: "hint" }, "fr"))),
    step("step-go", "build", "Aplicar", line("Escalonar entre layers", stag, el("em", { class: "hint" }, "fr")),
      el("button", { class: "pill primary bigbtn", on: { click: applyAll } }, "Montar nas layers selecionadas"))
  ];
  // Rearrangeable boxes; re-laid out when the panel width changes the number of columns.
  let lastCols = 0;
  const layout = (force) => {
    const n = body.clientWidth >= 600 ? 2 : 1;
    if (!force && n === lastCols) return;
    lastCols = n;
    window.MPBoxes.arrange(body, steps, "build", () => layout(true));
  };
  new ResizeObserver(() => requestAnimationFrame(() => layout())).observe(body);
  layout(true);
  setStatus(statusEl, "Selecione layers na comp e monte entrada, loop e saída.");
})();
