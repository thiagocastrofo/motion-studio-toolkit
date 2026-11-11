// Motion Studio Toolkit — animated icon set (original drawings, 24×24, stroke 1.75).
// Parts marked data-a="verb" animate with the verbs defined in ds.css (draw, slide-x, drop, spin, pop, stagger…).
(function () {
  "use strict";
  const P = (d, a) => `<path d="${d}"${a ? ` data-a="${a}"` : ""}/>`;
  const G = (inner, a) => `<g${a ? ` data-a="${a}"` : ""}>${inner}</g>`;
  // children of a stagger group get --i so each one starts a little later
  const S = (parts, a) => `<g data-a="${a || "stagger"}">${parts.map((p, i) => p.replace(/^<(\w+)/, `<$1 style="--i:${i}"`)).join("")}</g>`;
  const R = (x, y, w, h, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx == null ? 1.5 : rx}"/>`;
  const C = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;

  const I = {
    // sequence family: bars that cascade
    sequence: S([R(3, 4, 9, 3.5), R(7, 10.25, 9, 3.5), R(11, 16.5, 10, 3.5)], "stagger-x"),
    seqReverse: S([R(12, 4, 9, 3.5), R(8, 10.25, 9, 3.5), R(3, 16.5, 10, 3.5)], "stagger-x"),
    seqRandom: S([R(9, 4, 9, 3.5), R(3, 10.25, 9, 3.5), R(12, 16.5, 9, 3.5)], "stagger"),
    chain: S([R(3, 5, 6, 3.5), R(9, 10.25, 6, 3.5), R(15, 15.5, 6, 3.5)], "stagger-x") + P("M9 8.5v1.75M15 13.75v1.75", "draw"),
    stack: S([R(4, 4, 16, 3.5), R(4, 10.25, 16, 3.5), R(4, 16.5, 16, 3.5)], "stagger"),
    // layers
    alignCenter: P("M12 3v18", "draw") + G(R(6, 6, 12, 4) + R(8, 14, 8, 4), "pop"),
    alignLeft: P("M4 3v18", "draw") + G(R(7, 6, 12, 4) + R(7, 14, 7, 4), "slide-x"),
    anchor: C(12, 12, 2.2) + P("M12 4v4M12 16v4M4 12h4M16 12h4", "draw") + G(R(5, 5, 14, 14, 3), "pulse"),
    nullParent: G(R(8, 3, 8, 6, 1.5), "drop") + P("M12 9v3M6 12h12M6 12v3M18 12v3", "draw") + R(3.5, 15, 5, 5, 1.2) + R(15.5, 15, 5, 5, 1.2),
    precomp: R(3, 3, 18, 18, 3) + G(R(7, 7, 10, 10, 2), "pop"),
    trimIn: P("M9 4v16", "draw") + G(R(11, 8, 9, 8, 1.5), "slide-x") + P("M3 12h3", ""),
    trimOut: P("M15 4v16", "draw") + G(R(4, 8, 9, 8, 1.5), "slide-x-r") + P("M18 12h3", ""),
    fit: G(P("M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"), "pulse") + R(8, 8, 8, 8, 1.5),
    motionBlur: G(C(15, 12, 4.5), "slide-x-r") + P("M3 9h5M2 12h6M3 15h5", "draw"),
    split: P("M12 3v18", "draw") + G(R(3, 8, 7, 8, 1.5), "slide-x") + G(R(14, 8, 7, 8, 1.5), "slide-x-r"),
    duplicate: R(3, 7, 12, 12, 2) + G(R(9, 3, 12, 12, 2), "slide-y"),
    // keyframes
    easyEase: P("M4 19C11 19 13 5 20 5", "draw") + G(P("M4 19l0 0M20 5l0 0") + `<path d="M3 18l1 1 1-1-1-1Z"/><path d="M19 4l1 1 1-1-1-1Z"/>`, "pop"),
    easeIn: P("M4 19C13 19 18 14 20 5", "draw") + `<path d="M19 4l1 1 1-1-1-1Z"/>`,
    easeOut: P("M4 19C6 10 11 5 20 5", "draw") + `<path d="M3 18l1 1 1-1-1-1Z"/>`,
    reverse: G(P("M7 7h12l-3-3"), "slide-x-r") + G(P("M17 17H5l3 3"), "slide-x"),
    loop: G(P("M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"), "spin"),
    wiggle: P("M3 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0", "draw"),
    bounce: G(C(12, 6.5, 2.6), "drop") + P("M4 20h16", "") + P("M8 15c1.3 1.7 2.6 2.5 4 2.5s2.7-.8 4-2.5", "draw"),
    keyDiamond: G(`<path d="M12 4l8 8-8 8-8-8Z"/>`, "swing"),
    // animate (quick presets)
    fadeIn: S([C(6, 12, 1.4), C(10.5, 12, 2), C(16.5, 12, 3.5)], "stagger"),
    popIn: G(R(6, 6, 12, 12, 3), "pop") + P("M12 2v2M12 20v2M2 12h2M20 12h2", "draw"),
    slideUp: G(R(6, 10, 12, 10, 2), "slide-y") + P("M12 3v4M9.5 5.5 12 3l2.5 2.5", "draw"),
    typeOn: G(P("M5 6h10M10 6v12"), "pop") + G(P("M18 8v10"), "blink"),
    scaleIn: G(R(8, 8, 8, 8, 1.5), "pulse") + P("M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5", "draw"),
    // audio
    fadeAudio: P("M4 18 12 6h8", "draw") + P("M4 18h16", ""),
    beats: S([P("M5 14v6"), P("M9 8v12"), P("M13 11v9"), P("M17 4v16"), P("M21 12v8")], "stagger"),
    mute: P("M4 10v4h3l5 4V6L7 10Z", "") + G(P("M16 9.5l5 5M21 9.5l-5 5"), "pop"),
    // utilities
    colorPick: G(P("M14 4l6 6-9 9H5v-6Z"), "swing") + P("M12 6l6 6", ""),
    rename: R(3, 7, 18, 10, 2) + G(P("M8 10v4M16 10v4"), "blink") + P("M7 12h3", "draw"),
    organize: S([P("M4 6h16"), P("M4 12h10"), P("M4 18h6")], "stagger-x"),
    purge: G(P("M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"), "swing"),
    center: G(C(12, 12, 3), "pop") + P("M12 3v4M12 17v4M3 12h4M17 12h4", "draw"),
    snap: R(4, 4, 16, 16, 2.5) + G(C(12, 12, 2.5), "drop") + P("M12 4v5", "draw"),
    // create row
    solid: G(R(6, 6, 12, 12, 2.5), "drop"),
    text: G(P("M6 6h12M12 6v13"), "pop") + P("M9.5 19h5", "draw"),
    adjust: C(12, 12, 7.5) + G(P("M12 4.5a7.5 7.5 0 0 1 0 15Z", "") .replace("<path", '<path fill="currentColor"'), "swing"),
    nullL: G(`<rect x="5" y="5" width="14" height="14" rx="2.5" stroke-dasharray="3 2.6"/>`, "spin"),
    precompose: R(3.5, 8.5, 12, 12, 2.5) + G(R(8.5, 3.5, 12, 12, 2.5), "slide-y"),
    // align / distribute (bars + guide)
    aLeft: P("M4 3v18", "draw") + G(R(7, 6, 12, 4, 1) + R(7, 14, 7, 4, 1), "slide-x"),
    aHCenter: P("M12 3v18", "draw") + G(R(6, 6, 12, 4, 1) + R(8, 14, 8, 4, 1), "pop"),
    aRight: P("M20 3v18", "draw") + G(R(5, 6, 12, 4, 1) + R(10, 14, 7, 4, 1), "slide-x-r"),
    aTop: P("M3 4h18", "draw") + G(R(6, 7, 4, 12, 1) + R(14, 7, 4, 7, 1), "slide-y"),
    aVCenter: P("M3 12h18", "draw") + G(R(6, 6, 4, 12, 1) + R(14, 8, 4, 8, 1), "pop"),
    aBottom: P("M3 20h18", "draw") + G(R(6, 5, 4, 12, 1) + R(14, 10, 4, 7, 1), "drop"),
    dH: P("M4 4v16M20 4v16", "") + G(R(10, 7, 4, 10, 1), "pop"),
    dV: P("M4 4h16M4 20h16", "") + G(R(7, 10, 10, 4, 1), "pop"),
    // actions
    bolt: G(P("M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"), "pulse"),
    chevron: P("M9 6l6 6-6 6"),
    chevronDown: P("M6 9l6 6 6-6"),
    play: G(`<path d="M8 5.5v13l10.5-6.5Z"/>`, "pop"),
    copy: R(8, 8, 12, 12, 2) + P("M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"),
    save: P("M5 4h11l3 3v13H5Z") + P("M8 4v5h7V4M8 20v-6h8v6"),
    trash: P("M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"),
    plus: P("M12 5v14M5 12h14"),
    importF: G(P("M12 4v11M7.5 10.5 12 15l4.5-4.5"), "slide-y") + P("M5 19h14"),
    exportF: G(P("M12 15V4M7.5 8.5 12 4l4.5 4.5"), "slide-y") + P("M5 19h14"),
    refresh: G(P("M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"), "spin"),
    select: `<rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3 2.6"/>` + G(P("M10 9l6 3-3 1-1 3Z"), "pop"),
    order: G(P("M12 5v14M7 14l5 5 5-5"), "slide-y"),
    typeIt: G(P("M5 7h9M9.5 7v11"), "pop") + G(P("M17 6v12"), "blink"),
    textPro: S([P("M4 17l2.5-9 2.5 9M5 14h3"), P("M12 17V9h2.5a2 2 0 0 1 0 4H12"), P("M18 9v8")], "stagger"),
    captions: R(3, 5, 18, 14, 3) + S([P("M7 11h6"), P("M15 11h2"), P("M7 15h3"), P("M12 15h5")], "stagger-x"),
    editFx: G(P("M4 7h9M17 7h3M4 17h3M11 17h9"), "") + G(P("M15 5v4"), "slide-x") + G(P("M9 15v4"), "slide-x-r"),
    // ui
    search: C(11, 11, 6) + P("M20 20l-4.5-4.5"),
    sun: C(12, 12, 4) + P("M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"),
    check: P("M5 12.5l4.5 4.5L19 7.5"),
    close: P("M6 6l12 12M18 6 6 18"),
    // categories
    catSeq: S([R(3, 5, 8, 3, 1.2), R(8, 10.5, 8, 3, 1.2), R(13, 16, 8, 3, 1.2)], "stagger-x"),
    catLayer: G(P("M12 3 3 8l9 5 9-5Z"), "drop") + P("M3 12l9 5 9-5M3 16l9 5 9-5", ""),
    catKey: G(`<path d="M12 4l8 8-8 8-8-8Z"/>`, "swing"),
    catAnim: G(C(9, 12, 5), "slide-x-r") + P("M16 7.5c2 1.2 3 2.7 3 4.5s-1 3.3-3 4.5", "draw"),
    catAudio: S([P("M6 10v4"), P("M10 6v12"), P("M14 9v6"), P("M18 7v10")], "stagger"),
    catUtil: G(P("M14.5 5.5a4 4 0 0 0-5 5L4 16v4h4l5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5Z"), "swing"),
    catAll: S([R(4, 4, 7, 7, 2), R(13, 4, 7, 7, 2), R(4, 13, 7, 7, 2), R(13, 13, 7, 7, 2)], "stagger")
  };

  function svg(name, filledDots) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.75");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("class", "st-ic");
    s.innerHTML = I[name] || I.catUtil;
    return s;
  }
  // Restarts the icon's animation (hover and run).
  function play(el) {
    if (!el) return;
    el.classList.remove("play");
    void el.getBoundingClientRect();
    el.classList.add("play");
  }
  window.STIcons = { svg, play, names: Object.keys(I) };
})();
