// Rearrangeable boxes (the ".tsec" sections in Ferramentas, Montar and Editar).
//  - Press and hold a box title (~0.2 s) and drag it to a new place; a blue line shows where it lands.
//  - The small "⋯" button in the title: full / half width, adjust height (drag the bottom edge),
//    automatic height, move up / down, and reset the layout of that tab.
// The arrangement is saved per tab ("scope") in localStorage.
(function () {
  "use strict";
  const store = window.MPUI.store;
  const T = (s) => (window.MPI18N ? window.MPI18N.tr(s) : s);
  const cfgOf = (scope) => Object.assign({ order: [], wide: {}, h: {} }, store.get("boxes:" + scope, {}));
  const saveCfg = (scope, c) => store.set("boxes:" + scope, c);

  function div(cls) { const d = document.createElement("div"); d.className = cls; return d; }
  const keyOf = (s) => s.dataset.boxKey || (s.dataset.boxKey = (s.querySelector("h4") || {}).textContent || "box");

  // ------------------------------------------------------------ box menu (one shared popover)
  let menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  document.addEventListener("pointerdown", (e) => { if (menu && !menu.contains(e.target) && !e.target.closest(".boxbtn")) closeMenu(); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  function openMenu(btn, ctx) {
    closeMenu();
    const { scope, key, cfg, rerender, twoCols, order } = ctx;
    menu = div("boxmenu");
    const item = (label, fn, disabled) => {
      const b = document.createElement("button");
      b.textContent = T(label);
      if (disabled) b.disabled = true;
      b.addEventListener("click", () => { closeMenu(); fn(); });
      menu.appendChild(b);
    };
    const idx = order.indexOf(key);
    item(cfg.wide[key] ? "Meia largura" : "Largura inteira", () => { cfg.wide[key] = !cfg.wide[key]; saveCfg(scope, cfg); rerender(); }, !twoCols);
    item("Ajustar altura (arraste a borda de baixo)", () => {
      const s = ctx.sec;
      cfg.h[key] = Math.round(s.getBoundingClientRect().height);
      saveCfg(scope, cfg); rerender();
    });
    item("Altura automática", () => { delete cfg.h[key]; saveCfg(scope, cfg); rerender(); }, !cfg.h[key]);
    item("Mover para cima", () => { move(ctx, idx - 1); }, idx <= 0);
    item("Mover para baixo", () => { move(ctx, idx + 1); }, idx >= order.length - 1);
    item("Restaurar organização desta aba", () => { saveCfg(scope, { order: [], wide: {}, h: {} }); rerender(); });
    document.body.appendChild(menu);
    const r = btn.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(6, Math.min(innerWidth - mw - 6, r.right - mw)) + "px";
    menu.style.top = (r.bottom + mh + 6 > innerHeight ? Math.max(6, r.top - mh - 4) : r.bottom + 4) + "px";
  }
  function move(ctx, to) {
    const { scope, key, cfg, rerender, order } = ctx;
    const list = order.filter((k) => k !== key);
    list.splice(Math.max(0, Math.min(list.length, to)), 0, key);
    cfg.order = list; saveCfg(scope, cfg); rerender();
  }

  // ------------------------------------------------------------ drag (press and hold the title)
  function enableDrag(sec, ctxFn) {
    const h4 = sec.querySelector("h4");
    if (!h4 || h4.__mpDrag) return;
    h4.__mpDrag = true;
    h4.title = T("Segure e arraste para mudar a posição");
    h4.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".boxbtn")) return;
      const sx = e.clientX, sy = e.clientY;
      let dragging = false, target = null, before = true;
      const timer = setTimeout(() => {
        dragging = true;
        sec.classList.add("dragging");
        document.body.classList.add("box-dragging");
      }, 220);
      const clearMarks = () => document.querySelectorAll(".tsec.drop-before,.tsec.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
      const onMove = (ev) => {
        if (!dragging) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { clearTimeout(timer); finish(); } return; }
        ev.preventDefault();
        const host = sec.closest(".toolbody");
        if (host) {
          const hr = host.getBoundingClientRect();
          if (ev.clientY < hr.top + 36) host.scrollTop -= 14;
          else if (ev.clientY > hr.bottom - 36) host.scrollTop += 14;
        }
        clearMarks();
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const over = el && el.closest(".tsec[data-box-key]");
        target = over && over !== sec && over.closest(".toolbody") === host ? over : null;
        if (target) {
          const r = target.getBoundingClientRect();
          before = ev.clientY < r.top + r.height / 2;
          target.classList.add(before ? "drop-before" : "drop-after");
        }
      };
      const finish = () => {
        clearTimeout(timer);
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onUp, true);
        sec.classList.remove("dragging");
        document.body.classList.remove("box-dragging");
        clearMarks();
      };
      const onUp = () => {
        const wasDragging = dragging, tgt = target, bef = before;
        finish();
        if (!wasDragging || !tgt) return;
        const ctx = ctxFn(), tKey = keyOf(tgt);
        const list = ctx.order.filter((k) => k !== ctx.key);
        let i = list.indexOf(tKey);
        if (!bef) i += 1;
        list.splice(i, 0, ctx.key);
        ctx.cfg.order = list; saveCfg(ctx.scope, ctx.cfg); ctx.rerender();
      };
      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
    });
  }

  // ------------------------------------------------------------ layout
  // Lays out "secs" inside "body": saved order, full-width boxes on their own row, two-column masonry
  // for the rest when there is room. "rerender" is called after any change made through the UI.
  function arrange(body, secs, scope, rerender) {
    const cfg = cfgOf(scope);
    const keys = secs.map(keyOf);
    // Saved order first; boxes added in a later version go right after their natural predecessor.
    const order = cfg.order.filter((k) => keys.indexOf(k) >= 0);
    keys.forEach((k, i) => { if (order.indexOf(k) < 0) order.splice(i ? order.indexOf(keys[i - 1]) + 1 : 0, 0, k); });
    const byKey = {};
    secs.forEach((s) => { byKey[keyOf(s)] = s; });
    const twoCols = body.clientWidth >= 600 && secs.length > 1;
    body.innerHTML = "";
    let cols = null;
    order.forEach((k) => {
      const s = byKey[k];
      if (!s) return;
      // title controls
      const h4 = s.querySelector("h4");
      if (h4 && !h4.querySelector(".boxbtn")) {
        const b = document.createElement("button");
        b.className = "boxbtn"; b.type = "button"; b.textContent = "⋯"; b.title = T("Tamanho e posição da caixa");
        b.addEventListener("click", (e) => { e.stopPropagation(); openMenu(b, s.__mpCtx()); });
        h4.appendChild(b);
      }
      s.__mpCtx = () => ({ scope, key: k, cfg: cfgOf(scope), rerender, twoCols, order, sec: s });
      enableDrag(s, s.__mpCtx);
      // size
      s.classList.toggle("sized", !!cfg.h[k]);
      s.style.height = cfg.h[k] ? cfg.h[k] + "px" : "";
      if (cfg.h[k] && !s.__mpRO) {
        let t = null;
        s.__mpRO = new ResizeObserver(() => {
          clearTimeout(t);
          t = setTimeout(() => {
            if (!s.classList.contains("sized") || !s.isConnected) return;
            const c2 = cfgOf(scope), hNow = Math.round(s.getBoundingClientRect().height);
            if (hNow > 40 && c2.h[k] !== hNow) { c2.h[k] = hNow; saveCfg(scope, c2); }
          }, 300);
        });
        s.__mpRO.observe(s);
      }
      // placement
      if (twoCols && cfg.wide[k]) {
        const row = div("boxrow");
        row.appendChild(s);
        body.appendChild(row);
        cols = null;
        return;
      }
      if (!cols) {
        const group = div("toolcols");
        cols = Array.from({ length: twoCols ? 2 : 1 }, () => group.appendChild(div("toolcol")));
        body.appendChild(group);
      }
      cols.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a)).appendChild(s);
    });
    return twoCols ? 2 : 1;
  }

  // ------------------------------------------------------------ sortable menus (tabs in a row)
  // Press and hold an item (~0.25 s) and drag it sideways to reorder; the order is saved in "scope".
  // A normal click still works as usual. keyFn(item) gives a stable key for each item.
  function sortable(container, itemSel, scope, keyFn, onChange) {
    const items = () => Array.from(container.querySelectorAll(":scope > " + itemSel));
    const sc = () => (typeof scope === "function" ? scope() : scope);
    const applySaved = () => {
      const saved = store.get("menu:" + sc(), []);
      if (!saved.length) return;
      const all = items(), byKey = {};
      all.forEach((el) => { byKey[keyFn(el)] = el; });
      saved.forEach((k) => { if (byKey[k]) container.appendChild(byKey[k]); });
      all.forEach((el) => { if (saved.indexOf(keyFn(el)) < 0) container.appendChild(el); });
    };
    applySaved();
    let suppressClick = false;
    container.addEventListener("click", (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } }, true);
    container.addEventListener("pointerdown", (e) => {
      const item = e.target.closest(itemSel);
      if (!item || e.button !== 0 || item.parentElement !== container) return;
      const sx = e.clientX, sy = e.clientY;
      let dragging = false, target = null, before = true;
      const timer = setTimeout(() => { dragging = true; item.classList.add("menu-dragging"); document.body.classList.add("box-dragging"); }, 250);
      const clear = () => items().forEach((x) => x.classList.remove("menu-drop-before", "menu-drop-after"));
      const onMove = (ev) => {
        if (!dragging) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { clearTimeout(timer); done(); } return; }
        ev.preventDefault();
        const cr = container.getBoundingClientRect();
        if (container.scrollWidth > container.clientWidth) {
          if (ev.clientX < cr.left + 30) container.scrollLeft -= 12;
          else if (ev.clientX > cr.right - 30) container.scrollLeft += 12;
        }
        clear();
        target = null;
        items().forEach((x) => {
          if (x === item) return;
          const r = x.getBoundingClientRect();
          if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top - 20 && ev.clientY <= r.bottom + 20) {
            target = x; before = ev.clientX < r.left + r.width / 2;
            x.classList.add(before ? "menu-drop-before" : "menu-drop-after");
          }
        });
      };
      const done = () => {
        clearTimeout(timer);
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onUp, true);
        item.classList.remove("menu-dragging");
        document.body.classList.remove("box-dragging");
        clear();
      };
      const onUp = () => {
        const was = dragging, t = target, b = before;
        done();
        if (!was) return;
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
        if (!t) return;
        container.insertBefore(item, b ? t : t.nextSibling);
        store.set("menu:" + sc(), items().map(keyFn));
        if (onChange) onChange();
      };
      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
    });
    return { reset() { store.set("menu:" + sc(), []); }, applySaved };
  }

  window.MPBoxes = { arrange, keyOf, sortable };
})();
