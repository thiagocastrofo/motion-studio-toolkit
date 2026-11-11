// Host bridge shared by every page of the extension (main panel and the floating search window).
(function () {
  "use strict";
  const cep = window.__adobe_cep__;

  // Host folder of the installed extension (where host.jsx and tools.jsx live).
  let HOST_DIR = "";
  if (cep) {
    let ext = decodeURI(cep.getSystemPath("extension")).replace(/^file:\/{2,3}/, "");
    if (!/^[A-Za-z]:/.test(ext) && ext[0] !== "/") ext = "/" + ext;
    HOST_DIR = ext + "/host";
  }
  // Every call is wrapped so that (1) host.jsx / tools.jsx are (re)loaded if the engine lost them and
  // (2) any exception comes back as "error:<message> (linha N)" instead of the generic "EvalScript error.".
  function guard(script) {
    const dir = JSON.stringify(HOST_DIR);
    return "(function(){try{" +
      "if(typeof MP==='undefined'||!MP.apply){$.evalFile(new File(" + dir + "+'/host.jsx'));}" +
      "if(typeof MPT==='undefined'||!MPT.run){var lr=MP.loadTools(" + dir + ");if(typeof MPT==='undefined'||!MPT.run)return 'error:Falha ao carregar tools.jsx: '+lr;}" +
      "return " + script + ";" +
      "}catch(e){return 'error:'+e.toString()+(e.line?' (linha '+e.line+')':'');}})()";
  }
  function evalHost(script, cb) {
    if (!cep) { cb && cb("error:Fora do After Effects (só pré-visualização)."); return; }
    cep.evalScript(guard(script), cb || (() => {}));
  }
  function setStatus(el, msg, kind) {
    if (!el) return;
    el.textContent = msg; el.className = "status " + (kind || ""); el.title = msg;
  }
  function handle(el, res, okMsg) {
    if (!res || res === "EvalScript error.") return setStatus(el, "Erro no AE sem detalhes (EvalScript error). Reabra o painel e tente de novo.", "err");
    if (res.indexOf("error:") === 0) return setStatus(el, res.slice(6), "err");
    if (res.indexOf("ok:") === 0) return setStatus(el, okMsg ? okMsg.replace("{n}", res.slice(3)) : res.slice(3), "ok");
    setStatus(el, res);
  }
  // Calls fn(JSON) on the host; json results are parsed and passed to onJson; onDone gets the raw result.
  function call(fn, obj, okMsg, statusEl, onJson, onDone) {
    const el = statusEl || document.getElementById("status");
    evalHost(fn + "(" + JSON.stringify(JSON.stringify(obj)) + ")", (r) => {
      if (r && r.indexOf("json:") === 0) {
        try { onJson && onJson(JSON.parse(r.slice(5))); } catch (e) { setStatus(el, "Resposta inválida do AE.", "err"); }
        return;
      }
      handle(el, r, okMsg);
      if (onDone) onDone(r);
    });
  }
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem("mp." + k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
    set(k, v) { localStorage.setItem("mp." + k, JSON.stringify(v)); }
  };
  const isMac = cep ? /mac/i.test(cep.getOSInformation ? cep.getOSInformation() : navigator.platform) : /mac/i.test(navigator.platform);

  // Light / dark appearance follows After Effects' interface brightness (Preferences > Appearance);
  // outside AE it follows the operating system setting.
  function applyAppearance() {
    let light = false;
    if (cep && cep.getHostEnvironment) {
      try {
        const c = JSON.parse(cep.getHostEnvironment()).appSkinInfo.panelBackgroundColor.color;
        light = 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue > 140;
      } catch (e) {}
    } else if (window.matchMedia) light = window.matchMedia("(prefers-color-scheme: light)").matches;
    document.documentElement.dataset.appearance = light ? "light" : "dark";
  }
  applyAppearance();
  try { if (cep && cep.addEventListener) cep.addEventListener("com.adobe.csxs.events.ThemeColorChanged", applyAppearance); } catch (e) {}
  if (!cep && window.matchMedia) window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyAppearance);
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  window.MPUI = Object.assign(window.MPUI || {}, { evalHost, call, handle, setStatus, store, cep: !!cep, isMac, HOST_DIR, applyAppearance, reduceMotion });
})();
