// Quick-search overlay inside the main panel + keyboard shortcut.
// The shortcut is registered with CEP (registerKeyEventsInterest) so After Effects hands those keys
// to the panel instead of using them itself while the panel has focus.
(function () {
  "use strict";
  const { store, isMac } = window.MPUI;
  const cep = window.__adobe_cep__;
  const $ = (id) => document.getElementById(id);
  const overlay = $("searchOverlay");
  let api = null;

  function open() {
    if (!api) api = window.MPSearch.mount($("searchMount"), { mode: "overlay", onApplied: () => setTimeout(close, 300), onClose: close });
    overlay.classList.remove("hidden");
    api.reset();
    setTimeout(() => api.focus(), 0);
  }
  function close() { overlay.classList.add("hidden"); $("searchHelp").classList.add("hidden"); }
  window.MPUI.openSearch = open;

  $("openSearch").addEventListener("click", open);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });

  // ------------------------------------------------------------ shortcut
  // Virtual key codes CEP reports: Windows uses VK codes, macOS uses Carbon key codes.
  const CODES = isMac ? { space: 49, k: 40 } : { space: 32, k: 75 };
  const COMBOS = {
    "ctrl+space": { key: "space", ctrlKey: true },
    "alt+space": { key: "space", altKey: true },
    "shift+space": { key: "space", shiftKey: true },
    "mod+k": isMac ? { key: "k", metaKey: true } : { key: "k", ctrlKey: true }
  };
  let combo = store.get("searchKey", "ctrl+space");
  if (!COMBOS[combo]) combo = "ctrl+space";
  $("searchKey").value = combo;

  function registerKeys() {
    if (!cep || !cep.registerKeyEventsInterest) return;
    const c = COMBOS[combo];
    const spec = [{ keyCode: CODES[c.key], ctrlKey: !!c.ctrlKey, altKey: !!c.altKey, shiftKey: !!c.shiftKey, metaKey: !!c.metaKey }];
    try { cep.registerKeyEventsInterest(JSON.stringify(spec)); } catch (e) {}
  }
  registerKeys();
  $("searchKey").addEventListener("change", (e) => { combo = e.target.value; store.set("searchKey", combo); registerKeys(); });

  document.addEventListener("keydown", (e) => {
    const c = COMBOS[combo];
    const keyOk = c.key === "space" ? (e.code === "Space" || e.key === " ") : (e.code === "KeyK" || e.key === "k" || e.key === "K");
    if (keyOk && !!e.ctrlKey === !!c.ctrlKey && !!e.altKey === !!c.altKey && !!e.shiftKey === !!c.shiftKey && !!e.metaKey === !!c.metaKey) {
      e.preventDefault();
      if (overlay.classList.contains("hidden")) open(); else close();
    }
  }, true);

  // ------------------------------------------------------------ help: shortcut with After Effects in front
  const HELP_MAC = `
    <b>Mac — atalho que só vale com o After Effects em primeiro plano</b>
    <ol>
      <li>Abra <i>Ajustes do Sistema › Teclado › Atalhos de Teclado › Atalhos de Apps</i>.</li>
      <li>Clique em <b>+</b>. Em <i>Aplicativo</i>, escolha o Adobe After Effects.</li>
      <li>Em <i>Título do menu</i>, digite exatamente: <code>Motion Panel Busca</code></li>
      <li>Em <i>Atalho</i>, pressione a combinação (ex.: ⌥ Espaço) e clique em Concluído.</li>
    </ol>
    <p>O macOS só usa esse atalho quando o After Effects está na frente; nos outros apps a tecla continua com a função de sempre.
    <b>Exceção:</b> se outro app (Spotlight, Raycast, Alfred…) registrou a mesma combinação como atalho <i>global</i>, o sistema entrega a tecla a ele primeiro.
    Nesse caso, troque o atalho desse app ou use outra combinação aqui.</p>`;
  const HELP_WIN = `
    <b>Windows</b>
    <ol>
      <li>No After Effects, abra <i>Editar › Atalhos de teclado</i> e procure por <code>Motion Panel Busca</code>.</li>
      <li>Se o item aparecer, arraste a combinação desejada (ex.: Ctrl + Espaço) para ele.</li>
    </ol>
    <p>Se o item não aparecer na lista, use o atalho do painel (vale quando o Motion Panel está em foco) ou abra a busca por
    <i>Janela › Extensões › Motion Panel Busca</i> e deixe a janela encaixada.</p>`;
  $("searchHelpBtn").addEventListener("click", () => {
    const h = $("searchHelp");
    h.innerHTML = isMac ? HELP_MAC + HELP_WIN.replace("<b>Windows</b>", "<b>No Windows</b>") : HELP_WIN + HELP_MAC;
    h.classList.toggle("hidden");
  });
})();
