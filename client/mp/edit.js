// "Editar": live editor for the Motion Panel effects on the selected layer.
// Polls MP.inspect() while the tab is visible and re-renders only when something changed
// (and never while a field is being edited), so edits made in After Effects show up here too.
(function () {
  "use strict";
  const { evalHost, setStatus, icon } = window.MPUI;
  const $ = (id) => document.getElementById(id);
  const body = $("editBody"), statusEl = $("editStatus");
  let last = "", data = null, timer = null, visible = false;

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "class") e.className = attrs[k];
      else if (k === "on") for (const ev in attrs.on) e.addEventListener(ev, attrs.on[ev]);
      else if (k in e && typeof attrs[k] !== "string") e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    kids.flat().forEach((c) => c != null && e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return e;
  }
  const sw = (on, onchange) => {
    const i = el("input", { type: "checkbox" });
    i.checked = !!on;
    i.addEventListener("change", () => onchange(i.checked));
    return el("span", { class: "switch" }, i, el("i"));
  };
  const toHex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
  const fromHex = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).concat([1]);

  // ------------------------------------------------------------ host calls
  function edit(op, extra, okMsg) {
    if (!data) return;
    const args = Object.assign({ op, layerIndex: data.layerIndex }, extra);
    evalHost("MP.edit(" + JSON.stringify(JSON.stringify(args)) + ")", (r) => {
      if (!r || r.indexOf("error:") === 0 || r === "EvalScript error.") return setStatus(statusEl, r ? r.replace(/^error:/, "") : "Erro no AE.", "err");
      if (okMsg) setStatus(statusEl, okMsg, "ok");
      refresh(true);
    });
  }
  function refresh(force) {
    evalHost("MP.inspect()", (r) => {
      if (!r || r.indexOf("json:") !== 0) {
        if (!window.MPUI.cep) renderEmpty("A aba Editar mostra os efeitos da layer selecionada quando o painel está aberto no After Effects.", "Fora do After Effects");
        return;
      }
      const json = r.slice(5);
      if (!force && json === last) return;
      if (!force && body.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      last = json;
      try { data = JSON.parse(json); } catch (e) { return; }
      render();
    });
  }
  function start() { if (!timer) { refresh(true); timer = setInterval(refresh, 1200); } }
  function stop() { clearInterval(timer); timer = null; }
  document.addEventListener("mp:view", (e) => { visible = e.detail === "edit"; visible ? start() : stop(); });

  // ------------------------------------------------------------ rendering
  // Empty state: symbol + headline + one line of guidance (the header keeps a short generic subtitle).
  function renderEmpty(msg, head) {
    $("editTitle").textContent = "Editar";
    $("editSub").textContent = "Ajuste as animações e efeitos do Motion Panel na layer selecionada.";
    body.innerHTML = "";
    const ico = el("span", { class: "es-ico" });
    if (window.MPUI.icon) ico.appendChild(window.MPUI.icon("fx", 22));
    body.appendChild(el("div", { class: "emptystate" }, ico, el("b", {}, head || "Nada para editar"), el("span", {}, msg)));
  }
  const sec = (title, ...kids) => { const s = el("div", { class: "tsec" }, el("h4", {}, title), el("div", { class: "body" }, ...kids)); s.dataset.boxKey = title; return s; };
  // Trash button: removes the whole effect (effects, sliders, expressions and keyframes it created).
  const TRASH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function trashBtn(label, names, prefix) {
    const b = el("button", { class: "delbtn", title: "Apagar " + label + " (efeito, sliders, expressões e keyframes)", on: { click: (e) => {
      e.stopPropagation();
      if (b.classList.contains("confirm-del")) { edit("removeGroup", { names, prefix }, label + " apagado da layer."); return; }
      b.classList.add("confirm-del"); b.title = "Clique de novo para confirmar";
      setTimeout(() => { b.classList.remove("confirm-del"); }, 2500);
    } } });
    b.innerHTML = TRASH;
    return b;
  }
  const secDel = (title, names, prefix, ...kids) => { const s = sec(title, ...kids); s.querySelector("h4").appendChild(trashBtn(title, names, prefix)); return s; };

  // "MP Glow - Raio" -> ["Glow", "Raio"]; "MP Wiggle Freq" -> ["Wiggle", "Freq"]
  function splitName(n) {
    const s = n.replace(/^MP /, "");
    if (s.indexOf(" - ") > 0) return [s.slice(0, s.indexOf(" - ")), s.slice(s.indexOf(" - ") + 3)];
    const i = s.indexOf(" ");
    return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, s];
  }

  function windowCard(w) {
    const fps = data.fps, isOut = w.mode === "out";
    const startF = el("input", { class: "num", type: "number", value: Math.round(w.start * fps), style: "width:56px" });
    const durF = el("input", { class: "num", type: "number", min: "1", value: Math.max(1, Math.round(w.dur * fps)), style: "width:50px" });
    const commit = () => edit("window", { id: w.id, mode: w.mode, start: (+startF.value || 0) / fps, dur: Math.max(1, +durF.value || 1) / fps }, "Marcador ajustado.");
    startF.addEventListener("change", commit);
    durF.addEventListener("change", commit);
    const kids = [
      el("div", { class: "line" }, el("span", { class: "badge " + (isOut ? "out" : "in") }, isOut ? "Saída" : "Entrada"),
        el("b", { class: "wname" }, (w.name || "").replace(/^MP · /, "").replace(/ \((entrada|saída)\)$/, "")),
        el("span", { class: "sp" }),
        w.fx ? sw(w.on, (on) => edit("enable", { fx: w.fx, on }, on ? "Animação ligada." : "Animação desligada.")) : null)
    ];
    if (w.fx && w.intensity != null) {
      const rng = el("input", { type: "range", min: "0", max: "200", value: w.intensity, style: "flex:1" });
      const n = el("input", { class: "num", type: "number", value: Math.round(w.intensity), style: "width:50px" });
      rng.addEventListener("input", () => { n.value = rng.value; });
      rng.addEventListener("change", () => edit("param", { fx: w.fx, value: +rng.value }));
      n.addEventListener("change", () => { rng.value = n.value; edit("param", { fx: w.fx, value: +n.value }); });
      kids.push(el("div", { class: "line" }, "Intensidade", rng, n, el("em", { class: "hint" }, "%")));
    }
    kids.push(el("div", { class: "line" }, "Início", startF, el("em", { class: "hint" }, "fr"), "Duração", durF, el("em", { class: "hint" }, "fr"),
      el("span", { class: "sp" }), el("button", { class: "pill danger", on: { click: () => edit("remove", { id: w.id, mode: w.mode }, "Animação removida.") } }, "Remover")));
    return el("div", { class: "wcard" + (w.on ? "" : " off") }, ...kids);
  }

  function controlRow(c, label) {
    let input;
    if (c.type === "color") {
      input = el("input", { type: "color", value: toHex(c.value) });
      input.addEventListener("change", () => edit("param", { fx: c.name, value: fromHex(input.value) }));
    } else if (c.type === "check") {
      input = sw(c.value ? 1 : 0, (on) => edit("param", { fx: c.name, value: on ? 1 : 0 }));
    } else {
      const v = Math.round(c.value * 1000) / 1000;
      input = el("input", { class: "num", type: "number", step: Math.abs(v) < 5 ? "0.05" : "1", value: v, style: "width:64px" });
      input.addEventListener("change", () => edit("param", { fx: c.name, value: +input.value }));
      // Mouse wheel scrubs the value like a slider.
      input.addEventListener("wheel", (e) => { e.preventDefault(); input.value = +(+input.value - Math.sign(e.deltaY) * +input.step).toFixed(3); input.dispatchEvent(new Event("change")); }, { passive: false });
    }
    return el("div", { class: "line ctl" + (c.on ? "" : " off") }, el("span", { class: "cname" }, label),
      c.keyed ? el("em", { class: "hint", title: "Tem keyframes: o valor é gravado no tempo atual" }, "◆") : null,
      c.expr ? el("em", { class: "hint", title: "Controlado por expressão (loop, marcador ou ferramenta do Motion Panel)" }, "ƒ") : null, el("span", { class: "sp" }), input);
  }

  function render() {
    if (!data || !data.layer) return renderEmpty(data && data.reason ? data.reason : "Selecione uma layer na comp para ver os efeitos dela aqui.", "Nenhuma layer selecionada");
    $("editTitle").textContent = data.layer;
    $("editSub").textContent = data.comp + " · layer " + data.layerIndex;
    body.innerHTML = "";
    const secs = [];
    if (data.windows.length) {
      data.windows.sort((a, b) => a.start - b.start);
      secs.push(sec("Animações", ...data.windows.map(windowCard),
        el("span", { class: "hint" }, "Início e duração movem e esticam o marcador; a animação acompanha.")));
    }
    // Expression controls grouped by name prefix (Glow, Wiggle, Contador…).
    const groups = {}, others = [];
    data.effects.forEach((c) => {
      if (c.type === "fx") return others.push(c);
      const [g, p] = splitName(c.name);
      (groups[g] = groups[g] || []).push([c, p]);
    });
    Object.keys(groups).forEach((g) => secs.push(secDel(g, groups[g].map(([c]) => c.name), "MP " + g, ...groups[g].map(([c, p]) => controlRow(c, p)))));
    if (others.length) secs.push(sec("Outros efeitos MP", ...others.map((c) =>
      el("div", { class: "line ctl" + (c.on ? "" : " off") }, el("span", { class: "cname" }, c.name.replace(/^MP /, "")), el("span", { class: "sp" }),
        sw(c.on, (on) => edit("enable", { fx: c.name, on })), trashBtn(c.name.replace(/^MP /, ""), [c.name], "")))));
    if (!secs.length) {
      const ico = el("span", { class: "es-ico" });
      if (window.MPUI.icon) ico.appendChild(window.MPUI.icon("fx", 22));
      body.appendChild(el("div", { class: "emptystate" }, ico, el("b", {}, "Sem efeitos do Motion Panel"), el("span", {}, "Aplique uma animação, loop ou ferramenta e ela aparece aqui.")));
      return;
    }
    // Same rearrangeable boxes as the tools view (order / width / height saved for this view).
    const top = body.scrollTop;
    window.MPBoxes.arrange(body, secs, "edit", render);
    body.scrollTop = top;
  }

  window.MPUI.renderEditPreview = (d) => { data = d; last = JSON.stringify(d); render(); };
  renderEmpty("Selecione uma layer na comp para ver os efeitos dela aqui.", "Nenhuma layer selecionada");
})();
