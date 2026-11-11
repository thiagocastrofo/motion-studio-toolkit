// Motion Panel preset library (original content).
// Transition and text presets are written as IN animations; OUT mirrors them in time.
// keys: [t 0..1, value, inInfluence?, outInfluence?]
// value: "base" | number | {mul:k} | {mulv:[x,y]} | {add:n} | {dw:fx, dh:fy} (fraction of comp size)
// prop: position | opacity | scale | rotation | rotX | rotY | "fx:<matchName>:<paramIndex>"
(function () {
  var TR = [], TX = [], LP = [];
  var GBLUR = "fx:ADBE Gaussian Blur 2:1", DBLUR = "fx:ADBE Motion Blur:2";
  var LWIPE = "fx:ADBE Linear Wipe:1", RWIPE = "fx:ADBE Radial Wipe:1";
  var BLINDS = "fx:ADBE Venetian Blinds:1", BLOCKS = "fx:ADBE Block Dissolve:1";

  function tr(id, name, cat, ease, tracks, extra) {
    var p = { type: "transform", id: id, name: name, cat: cat, ease: ease, tracks: tracks };
    for (var k in (extra || {})) p[k] = extra[k];
    TR.push(p);
  }
  function op(end) { return { prop: "opacity", keys: [[0, 0], [end || 0.6, "base"]] }; }
  function pos(dw, dh) { return { prop: "position", keys: [[0, { dw: dw, dh: dh }], [1, "base"]] }; }
  function scl(m) { return { prop: "scale", keys: [[0, typeof m === "number" ? { mul: m } : { mulv: m }], [1, "base"]] }; }
  function rot(prop, deg) { return { prop: prop, keys: [[0, { add: deg }], [1, "base"]] }; }
  function blur(v) { return { prop: GBLUR, keys: [[0, v], [1, "base"]] }; }
  function dblur(v, dir) { return { prop: DBLUR, fxSet: { 1: dir }, keys: [[0, v], [1, "base"]] }; }
  function wipe(prop, set) { return { prop: prop, fxSet: set, keys: [[0, 100], [1, "base"]] }; }

  // ---- Fade
  tr("fade", "Fade", "Fade", "smooth", [op(1)]);
  tr("fade-soft", "Fade Suave", "Fade", "soft", [op(1)]);
  tr("fade-up", "Fade Up", "Fade", "snappy", [pos(0, 0.04), op()]);
  tr("fade-down", "Fade Down", "Fade", "snappy", [pos(0, -0.04), op()]);
  tr("fade-scale", "Fade Scale", "Fade", "snappy", [scl(0.85), op()]);
  // ---- Slide
  tr("slide-l", "Slide \u2190", "Slide", "snappy", [pos(0.12, 0), op(0.5)]);
  tr("slide-r", "Slide \u2192", "Slide", "snappy", [pos(-0.12, 0), op(0.5)]);
  tr("slide-u", "Slide \u2191", "Slide", "snappy", [pos(0, 0.12), op(0.5)]);
  tr("slide-d", "Slide \u2193", "Slide", "snappy", [pos(0, -0.12), op(0.5)]);
  // ---- Off-screen
  tr("off-l", "Da Esquerda", "Fora da Tela", "snappy", [pos(-1, 0)]);
  tr("off-r", "Da Direita", "Fora da Tela", "snappy", [pos(1, 0)]);
  tr("off-t", "De Cima", "Fora da Tela", "snappy", [pos(0, -1)]);
  tr("off-b", "De Baixo", "Fora da Tela", "snappy", [pos(0, 1)]);
  // ---- Scale
  tr("scale-up", "Scale Up", "Escala", "snappy", [scl(0)]);
  tr("scale-down", "Scale Down", "Escala", "snappy", [scl(1.6), op()]);
  tr("zoom-out", "Zoom Forte", "Escala", "snappy", [scl(3), op(0.4)]);
  tr("pop", "Pop", "Escala", "soft", [{ prop: "scale", keys: [[0, { mul: 0 }], [0.6, { mul: 1.12 }], [1, "base"]] }, op(0.3)]);
  tr("squeeze-h", "Abrir Horizontal", "Escala", "snappy", [scl([0, 1]), op(0.3)]);
  tr("squeeze-v", "Abrir Vertical", "Escala", "snappy", [scl([1, 0]), op(0.3)]);
  // ---- Rotation
  tr("rot-in", "Rotate In", "Rota\u00e7\u00e3o", "snappy", [rot("rotation", -90), op(0.5)]);
  tr("rot-cw", "Rotate Clockwise","Rota\u00e7\u00e3o", "snappy", [rot("rotation", 90), op(0.5)]);
  tr("spin", "Spin", "Rota\u00e7\u00e3o", "snappy", [rot("rotation", -180), scl(0)]);
  tr("spin-360", "Spin 360", "Rota\u00e7\u00e3o", "snappy", [rot("rotation", -360), scl(0)]);
  tr("roll", "Rolar \u2190", "Rota\u00e7\u00e3o", "snappy", [rot("rotation", 180), pos(0.2, 0), op(0.4)]);
  tr("tilt", "Inclinar", "Rota\u00e7\u00e3o", "snappy", [rot("rotation", -15), pos(0, 0.05), op(0.5)]);
  // ---- Blur
  tr("blur-in", "Blur In", "Blur", "smooth", [blur(40), op()]);
  tr("zoom-blur", "Zoom Blur", "Blur", "snappy", [scl(1.5), blur(30), op(0.5)]);
  tr("blur-slide-l", "Blur Slide \u2190", "Blur", "snappy", [pos(0.1, 0), dblur(80, 90), op(0.5)]);
  tr("blur-slide-u", "Blur Slide \u2191", "Blur", "snappy", [pos(0, 0.1), dblur(80, 0), op(0.5)]);
  tr("blur-scale", "Blur Scale", "Blur", "snappy", [scl(1.3), blur(25), op(0.5)]);
  // ---- 3D
  var D3 = { threeD: true };
  tr("flip-x", "Flip X", "3D", "snappy", [rot("rotX", -90), op(0.4)], D3);
  tr("flip-y", "Flip Y", "3D", "snappy", [rot("rotY", 90), op(0.4)], D3);
  tr("flip-up", "Flip Up", "3D", "snappy", [rot("rotX", 90), pos(0, 0.05), op(0.4)], D3);
  tr("swing", "Porta", "3D", "soft", [{ prop: "rotY", keys: [[0, { add: -110 }], [0.7, { add: 10 }], [1, "base"]] }, op(0.3)], D3);
  tr("turn-x", "Giro 3D", "3D", "snappy", [rot("rotX", -360), scl(0.5)], D3);
  // ---- Wipes
  tr("wipe-r", "Wipe \u2192", "Wipe", "smooth", [wipe(LWIPE, { 2: 270, 3: 20 })]);
  tr("wipe-l", "Wipe \u2190", "Wipe", "smooth", [wipe(LWIPE, { 2: 90, 3: 20 })]);
  tr("wipe-d", "Wipe \u2193", "Wipe", "smooth", [wipe(LWIPE, { 2: 180, 3: 20 })]);
  tr("wipe-u", "Wipe \u2191", "Wipe", "smooth", [wipe(LWIPE, { 2: 0, 3: 20 })]);
  tr("wipe-diag", "Wipe Diagonal", "Wipe", "smooth", [wipe(LWIPE, { 2: 225, 3: 40 })]);
  tr("wipe-radial", "Wipe Radial", "Wipe", "smooth", [wipe(RWIPE, { 5: 20 })]);
  tr("blinds", "Persiana", "Wipe", "smooth", [wipe(BLINDS, { 3: 20 })]);
  tr("blocks", "Blocos", "Wipe", "linear", [wipe(BLOCKS, {})]);
  // ---- Bounce / elastic
  tr("drop", "Queda Quicando", "El\u00e1stico", "smooth", [{ prop: "position", keys: [[0, { dh: -0.3 }, 33, 10], [0.55, "base", 90, 33], [0.78, { dh: -0.04 }, 33, 33], [1, "base", 90, 33]] }, op(0.2)]);
  tr("rise", "Subida Quicando", "El\u00e1stico", "smooth", [{ prop: "position", keys: [[0, { dh: 0.3 }, 33, 10], [0.55, "base", 90, 33], [0.78, { dh: 0.04 }, 33, 33], [1, "base", 90, 33]] }, op(0.2)]);
  tr("elastic", "El\u00e1stico", "El\u00e1stico", "soft", [{ prop: "scale", keys: [[0, { mul: 0 }], [0.4, { mul: 1.2 }], [0.6, { mul: 0.92 }], [0.8, { mul: 1.04 }], [1, "base"]] }]);
  tr("elastic-slide", "El\u00e1stico \u2192", "El\u00e1stico", "soft", [{ prop: "position", keys: [[0, { dw: -0.15 }], [0.5, { dw: 0.02 }], [0.75, { dw: -0.008 }], [1, "base"]] }, op(0.3)]);
  tr("jelly", "Gelatina", "El\u00e1stico", "soft", [{ prop: "scale", keys: [[0, { mul: 0 }], [0.45, { mulv: [1.25, 0.8] }], [0.65, { mulv: [0.9, 1.1] }], [0.85, { mulv: [1.05, 0.95] }], [1, "base"]] }]);
  tr("pop-spin", "Pop Giro", "El\u00e1stico", "soft", [{ prop: "scale", keys: [[0, { mul: 0 }], [0.65, { mul: 1.1 }], [1, "base"]] }, rot("rotation", -45)]);
  // ---- Shape reveals (masks); -1 = fully closed
  function mask(kind) { return { prop: "mask:" + kind, keys: [[0, -1], [1, "base"]] }; }
  tr("iris", "\u00cdris", "Shapes", "snappy", [mask("ellipse")]);
  tr("iris-scale", "\u00cdris + Escala", "Shapes", "snappy", [mask("ellipse"), scl(1.25)]);
  tr("diamond", "Losango", "Shapes", "snappy", [mask("diamond")]);
  tr("box", "Caixa", "Shapes", "snappy", [mask("box")]);
  tr("curtain-h", "Cortina \u2194", "Shapes", "snappy", [mask("curtainH")]);
  tr("curtain-v", "Cortina \u2195", "Shapes", "snappy", [mask("curtainV")]);
  // ---- Light
  var BRIGHT = "fx:ADBE Brightness & Contrast 2:1";
  tr("flash-in", "Flash de Luz", "Luz", "smooth", [{ prop: BRIGHT, keys: [[0, 150], [1, "base"]] }, op(0.25)]);
  tr("overexpose", "Superexposi\u00e7\u00e3o", "Luz", "snappy", [{ prop: BRIGHT, keys: [[0, 120], [1, "base"]] }, blur(25), scl(1.12), op(0.4)]);
  tr("burn-in", "Queima de Luz", "Luz", "linear", [{ prop: BRIGHT, keys: [[0, 150], [0.35, 60], [1, "base"]] }, { prop: "opacity", keys: [[0, 0], [0.15, "base"], [0.25, 40], [0.4, "base"]] }]);
  // ---- Glitch
  var TURB = "fx:ADBE Turbulent Displace:2";
  tr("glitch-in", "Glitch", "Glitch", "linear", [{ prop: TURB, keys: [[0, 160], [0.4, 90], [0.7, 30], [1, "base"]] },
    { prop: "position", keys: [[0, { dw: 0.03 }], [0.15, { dw: -0.025 }], [0.3, { dw: 0.015 }], [0.45, "base"]] },
    { prop: "opacity", keys: [[0, 0], [0.1, "base"], [0.2, 20], [0.3, "base"], [0.4, 50], [0.5, "base"]] }]);
  tr("glitch-slide", "Glitch Slide", "Glitch", "snappy", [pos(0.15, 0), dblur(120, 90), { prop: TURB, keys: [[0, 120], [0.6, "base"]] }, op(0.3)]);
  tr("glitch-blocks", "Glitch Blocos", "Glitch", "linear", [wipe(BLOCKS, { 2: 40, 3: 12 }), { prop: TURB, keys: [[0, 100], [0.8, "base"]] }]);
  // ---- Z depth (3D)
  tr("z-far", "Entrada Z (do fundo)", "3D", "snappy", [{ prop: "position", keys: [[0, { dz: 1500 }], [1, "base"]] }, op(0.5)], { threeD: true });
  tr("z-near", "Entrada Z (da frente)", "3D", "snappy", [{ prop: "position", keys: [[0, { dz: -700 }], [1, "base"]] }, op(0.4)], { threeD: true });
  tr("spin-y", "Giro Y 360", "3D", "snappy", [rot("rotY", -360), op(0.3)], { threeD: true });

  // ---- Combos
  tr("rise-blur", "Subir + Blur", "Combinados", "snappy", [pos(0, 0.06), blur(20), op()]);
  tr("spin-blur", "Giro + Blur", "Combinados", "snappy", [rot("rotation", -90), blur(25), op()]);
  tr("zoom-rot", "Zoom + Giro", "Combinados", "snappy", [scl(2), rot("rotation", 30), op(0.5)]);
  tr("slide-wipe", "Slide + Wipe", "Combinados", "snappy", [pos(-0.05, 0), wipe(LWIPE, { 2: 270, 3: 30 })]);
  tr("flip-blur", "Flip + Blur", "Combinados", "snappy", [rot("rotY", 90), blur(20), op()], D3);

  // ================================================================ TEXT
  // drive: "offset" (cascading ramp), "start" (typewriter), "amount" (whole text)
  // unit: 1 characters, 3 words, 4 lines
  function tx(id, name, cat, text, ease) {
    TX.push({ type: "text", id: id, name: name, cat: cat, ease: ease || "smooth", text: text });
  }
  var OP = "ADBE Text Opacity", PS = "ADBE Text Position 3D", SC = "ADBE Text Scale 3D", RT = "ADBE Text Rotation",
      BL = "ADBE Text Blur", TK = "ADBE Text Tracking Amount", SK = "ADBE Text Skew";
  function P(o) { return o; }
  function casc(unit, width, props, random) { return { drive: "offset", unit: unit, width: width, shape: 2, props: props, random: !!random }; }

  var C = "Letras", W = "Palavras", L = "Linhas";
  tx("t-fade-c", "Fade Letras", C, casc(1, 35, P({ "ADBE Text Opacity": 0 })));
  tx("t-up-c", "Subir Letras", C, casc(1, 35, P({ "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, 40, 0] })));
  tx("t-down-c", "Descer Letras", C, casc(1, 35, P({ "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, -40, 0] })));
  tx("t-slide-c", "Deslizar Letras", C, casc(1, 35, P({ "ADBE Text Opacity": 0, "ADBE Text Position 3D": [60, 0, 0] })));
  tx("t-scale-c", "Escala Letras", C, casc(1, 35, P({ "ADBE Text Scale 3D": [0, 0, 100] })));
  tx("t-zoom-c", "Zoom Letras", C, casc(1, 35, P({ "ADBE Text Opacity": 0, "ADBE Text Scale 3D": [400, 400, 100], "ADBE Text Blur": [20, 20] })));
  tx("t-blur-c", "Blur Letras", C, casc(1, 35, P({ "ADBE Text Opacity": 0, "ADBE Text Blur": [30, 30] })));
  tx("t-rot-c", "Girar Letras", C, casc(1, 35, P({ "ADBE Text Opacity": 0, "ADBE Text Rotation": -90 })));
  tx("t-skew-c", "Inclinar Letras", C, casc(1, 35, P({ "ADBE Text Opacity": 0, "ADBE Text Skew": 40 })));
  tx("t-rand-c", "Letras Aleat\u00f3rias", C, casc(1, 35, P({ "ADBE Text Opacity": 0 }), true));
  tx("t-randblur-c", "Blur Aleat\u00f3rio", C, casc(1, 35, P({ "ADBE Text Opacity": 0, "ADBE Text Blur": [25, 25] }), true));

  tx("t-fade-w", "Fade Palavras", W, casc(3, 50, P({ "ADBE Text Opacity": 0 })));
  tx("t-up-w", "Subir Palavras", W, casc(3, 50, P({ "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, 50, 0] })));
  tx("t-slide-w", "Deslizar Palavras", W, casc(3, 50, P({ "ADBE Text Opacity": 0, "ADBE Text Position 3D": [-80, 0, 0] })));
  tx("t-scale-w", "Escala Palavras", W, casc(3, 50, P({ "ADBE Text Opacity": 0, "ADBE Text Scale 3D": [0, 0, 100] })));
  tx("t-blur-w", "Blur Palavras", W, casc(3, 50, P({ "ADBE Text Opacity": 0, "ADBE Text Blur": [30, 30] })));
  tx("t-rand-w", "Palavras Aleat\u00f3rias", W, casc(3, 50, P({ "ADBE Text Opacity": 0 }), true));

  tx("t-fade-l", "Fade Linhas", L, casc(4, 60, P({ "ADBE Text Opacity": 0 })));
  tx("t-up-l", "Subir Linhas", L, casc(4, 60, P({ "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, 60, 0] })));
  tx("t-slide-l", "Deslizar Linhas", L, casc(4, 60, P({ "ADBE Text Opacity": 0, "ADBE Text Position 3D": [-120, 0, 0] })));
  tx("t-blur-l", "Blur Linhas", L, casc(4, 60, P({ "ADBE Text Opacity": 0, "ADBE Text Blur": [30, 30] })));

  var WH = "Texto Inteiro";
  function whole(props) { return { drive: "amount", unit: 1, shape: 1, props: props }; }
  tx("t-track-open", "Espa\u00e7amento Abrir", WH, whole(P({ "ADBE Text Opacity": 0, "ADBE Text Tracking Amount": 80 })), "snappy");
  tx("t-track-close", "Espa\u00e7amento Fechar", WH, whole(P({ "ADBE Text Opacity": 0, "ADBE Text Tracking Amount": -40 })), "snappy");
  tx("t-blur-all", "Blur Texto", WH, whole(P({ "ADBE Text Opacity": 0, "ADBE Text Blur": [40, 40] })));
  tx("t-up-all", "Subir Texto", WH, whole(P({ "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, 50, 0] })), "snappy");

  var TY = "Digita\u00e7\u00e3o";
  function type(unit) { return { drive: "start", unit: unit, shape: 1, props: P({ "ADBE Text Opacity": 0 }) }; }
  tx("t-type-c", "M\u00e1quina de Escrever", TY, type(1), "linear");
  tx("t-type-w", "Palavra por Palavra", TY, type(3), "linear");
  tx("t-type-l", "Linha por Linha", TY, type(4), "linear");

  // ---- Elastic and extra text presets (the "wave" adds a triangle-shaped selector riding the reveal front)
  function elastic(unit, width, props, wave, random) {
    var t = casc(unit, width, props, random); t.wave = wave; return t;
  }
  var POP = { "ADBE Text Scale 3D": [135, 135, 100] }, JUMP = { "ADBE Text Position 3D": [0, -28, 0] };
  tx("t-snap-c", "Snap El\u00e1stico", C, elastic(1, 30, { "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, 45, 0] }, POP), "snappy");
  tx("t-escala-c", "Escala El\u00e1stica", C, elastic(1, 30, { "ADBE Text Scale 3D": [0, 0, 100] }, { "ADBE Text Scale 3D": [145, 145, 100] }), "snappy");
  tx("t-jump-c", "Pulo El\u00e1stico", C, elastic(1, 30, { "ADBE Text Opacity": 0 }, JUMP), "smooth");
  tx("t-zoomel-c", "Zoom El\u00e1stico", C, elastic(1, 30, { "ADBE Text Opacity": 0, "ADBE Text Scale 3D": [300, 300, 100] }, { "ADBE Text Scale 3D": [80, 80, 100] }), "snappy");
  tx("t-rotel-c", "Giro El\u00e1stico", C, elastic(1, 30, { "ADBE Text Opacity": 0, "ADBE Text Rotation": -120 }, { "ADBE Text Rotation": 18 }), "snappy");
  tx("t-skewel-c", "Inclina\u00e7\u00e3o El\u00e1stica", C, elastic(1, 30, { "ADBE Text Opacity": 0, "ADBE Text Skew": 45 }, { "ADBE Text Skew": -15 }), "snappy");
  tx("t-fall-c", "Cair Letras", C, casc(1, 35, { "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, -120, 0], "ADBE Text Rotation": 30 }), "snappy");
  tx("t-scatter-c", "Espalhar", C, casc(1, 35, { "ADBE Text Opacity": 0, "ADBE Text Position 3D": [70, -40, 0], "ADBE Text Rotation": 60 }, true), "snappy");
  tx("t-blurscale-c", "Blur + Escala", C, casc(1, 35, { "ADBE Text Opacity": 0, "ADBE Text Scale 3D": [160, 160, 100], "ADBE Text Blur": [25, 25] }), "snappy");
  tx("t-randup-c", "Subir Aleat\u00f3rio", C, casc(1, 35, { "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, 40, 0] }, true), "snappy");
  tx("t-snap-w", "Snap El\u00e1stico", W, elastic(3, 45, { "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, 50, 0] }, POP), "snappy");
  tx("t-escala-w", "Escala El\u00e1stica", W, elastic(3, 45, { "ADBE Text Scale 3D": [0, 0, 100] }, { "ADBE Text Scale 3D": [140, 140, 100] }), "snappy");
  tx("t-fall-w", "Cair Palavras", W, casc(3, 50, { "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, -100, 0] }), "snappy");
  tx("t-zoom-w", "Zoom Palavras", W, casc(3, 50, { "ADBE Text Opacity": 0, "ADBE Text Scale 3D": [300, 300, 100], "ADBE Text Blur": [20, 20] }), "snappy");
  tx("t-escala-l", "Escala El\u00e1stica", L, elastic(4, 55, { "ADBE Text Scale 3D": [0, 0, 100] }, { "ADBE Text Scale 3D": [125, 125, 100] }), "snappy");
  tx("t-zoom-l", "Zoom Linhas", L, casc(4, 60, { "ADBE Text Opacity": 0, "ADBE Text Scale 3D": [250, 250, 100], "ADBE Text Blur": [20, 20] }), "snappy");
  tx("t-zoom-all", "Zoom Texto", WH, whole({ "ADBE Text Opacity": 0, "ADBE Text Scale 3D": [200, 200, 100], "ADBE Text Blur": [30, 30] }), "snappy");

  // ================================================================ LOOPS (expressions + slider controls)
  function lp(id, name, cat, prop, controls, expr, pv, more) {
    LP.push({ type: "loop", id: id, name: name, cat: cat, loop: { prop: prop, controls: controls, expr: expr, more: more || [] }, pv: pv });
  }
  function ctl(n, v) { return { n: n, v: v }; }
  function fx(n) { return 'effect("MP ' + n + '")(1)'; }
  var TAU = "Math.PI*2";

  lp("l-wiggle", "Wiggle", "Movimento", "position", [ctl("Wiggle Freq", 2), ctl("Wiggle Amp", 25)],
    "wiggle(" + fx("Wiggle Freq") + ", " + fx("Wiggle Amp") + ")",
    { k: [{ transform: "translate(0,0)" }, { transform: "translate(6px,-4px)" }, { transform: "translate(-5px,3px)" }, { transform: "translate(3px,5px)" }, { transform: "translate(0,0)" }], d: 1600 });
  lp("l-shake", "Tremor", "Movimento", "position", [ctl("Tremor Freq", 14), ctl("Tremor Amp", 8)],
    "wiggle(" + fx("Tremor Freq") + ", " + fx("Tremor Amp") + ")",
    { k: [{ transform: "translate(0,0)" }, { transform: "translate(2px,-2px)" }, { transform: "translate(-2px,1px)" }, { transform: "translate(1px,2px)" }, { transform: "translate(0,0)" }], d: 300 });
  lp("l-float", "Flutuar", "Movimento", "position", [ctl("Flutuar Amp", 15), ctl("Flutuar Freq", 0.5)],
    "add(value, [0, Math.sin(time*" + fx("Flutuar Freq") + "*" + TAU + ")*" + fx("Flutuar Amp") + "])",
    { k: [{ transform: "translateY(-6px)" }, { transform: "translateY(6px)" }], d: 1400, alt: true });
  lp("l-orbit", "\u00d3rbita", "Movimento", "position", [ctl("\u00d3rbita Raio", 30), ctl("\u00d3rbita Velocidade", 0.5)],
    "var a = time*" + fx("\u00d3rbita Velocidade") + "*" + TAU + ", r = " + fx("\u00d3rbita Raio") + ";\nadd(value, [Math.cos(a)*r, Math.sin(a)*r])",
    { k: [{ transform: "rotate(0deg) translateX(10px) rotate(0deg)" }, { transform: "rotate(360deg) translateX(10px) rotate(-360deg)" }], d: 2000, lin: true });
  lp("l-glitch", "Glitch", "Movimento", "position", [ctl("Glitch FPS", 10), ctl("Glitch Amp", 15)],
    "posterizeTime(" + fx("Glitch FPS") + ");\nwiggle(30, " + fx("Glitch Amp") + ")",
    { k: [{ transform: "translate(0,0)" }, { transform: "translate(5px,0)" }, { transform: "translate(-4px,2px)" }, { transform: "translate(0,0)" }], d: 500, steps: true });

  lp("l-pulse", "Pulsar", "Escala", "scale", [ctl("Pulsar Amp", 8), ctl("Pulsar Freq", 1)],
    "mul(value, 1 + Math.sin(time*" + fx("Pulsar Freq") + "*" + TAU + ")*" + fx("Pulsar Amp") + "/100)",
    { k: [{ transform: "scale(0.92)" }, { transform: "scale(1.08)" }], d: 900, alt: true });
  lp("l-heart", "Batida", "Escala", "scale", [ctl("Batida Amp", 15), ctl("Batida BPM", 70)],
    "var t = (time*" + fx("Batida BPM") + "/60) % 1;\nvar b = Math.exp(-t*8)*Math.abs(Math.sin(t*Math.PI*4));\nmul(value, 1 + b*" + fx("Batida Amp") + "/100)",
    { k: [{ transform: "scale(1)" }, { transform: "scale(1.15)", offset: 0.1 }, { transform: "scale(1)", offset: 0.25 }, { transform: "scale(1.08)", offset: 0.35 }, { transform: "scale(1)", offset: 0.5 }, { transform: "scale(1)" }], d: 900 });
  lp("l-wscale", "Wiggle Escala", "Escala", "scale", [ctl("WEscala Freq", 2), ctl("WEscala Amp", 10)],
    "var w = wiggle(" + fx("WEscala Freq") + ", " + fx("WEscala Amp") + ");\nvar d = w[0] - value[0];\nvalue.length > 2 ? add(value, [d, d, d]) : add(value, [d, d])",
    { k: [{ transform: "scale(1)" }, { transform: "scale(1.1)" }, { transform: "scale(0.94)" }, { transform: "scale(1)" }], d: 1500 });

  lp("l-spin", "Girar", "Rota\u00e7\u00e3o", "rotation", [ctl("Girar Graus/s", 90)],
    "value + time*" + fx("Girar Graus/s"),
    { k: [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], d: 2000, lin: true });
  lp("l-swing", "Balan\u00e7ar", "Rota\u00e7\u00e3o", "rotation", [ctl("Balan\u00e7ar Amp", 10), ctl("Balan\u00e7ar Freq", 1)],
    "value + Math.sin(time*" + fx("Balan\u00e7ar Freq") + "*" + TAU + ")*" + fx("Balan\u00e7ar Amp"),
    { k: [{ transform: "rotate(-10deg)" }, { transform: "rotate(10deg)" }], d: 800, alt: true });
  lp("l-wrot", "Wiggle Rota\u00e7\u00e3o", "Rota\u00e7\u00e3o", "rotation", [ctl("WRot Freq", 2), ctl("WRot Amp", 8)],
    "wiggle(" + fx("WRot Freq") + ", " + fx("WRot Amp") + ")",
    { k: [{ transform: "rotate(0)" }, { transform: "rotate(7deg)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(0)" }], d: 1500 });

  lp("l-blink", "Piscar", "Opacidade", "opacity", [ctl("Piscar Freq", 2), ctl("Piscar M\u00ednimo", 0)],
    "Math.sin(time*" + fx("Piscar Freq") + "*" + TAU + ") >= 0 ? value : " + fx("Piscar M\u00ednimo"),
    { k: [{ opacity: 1 }, { opacity: 0 }], d: 500, alt: true, steps: true });
  lp("l-breathe", "Respirar", "Opacidade", "opacity", [ctl("Respirar Freq", 0.5), ctl("Respirar Quanto", 50)],
    "value * (1 - " + fx("Respirar Quanto") + "/100*(0.5 + 0.5*Math.sin(time*" + fx("Respirar Freq") + "*" + TAU + ")))",
    { k: [{ opacity: 1 }, { opacity: 0.45 }], d: 1600, alt: true });
  lp("l-flicker", "Cintilar", "Opacidade", "opacity", [ctl("Cintilar Freq", 12), ctl("Cintilar Amp", 40)],
    "clamp(wiggle(" + fx("Cintilar Freq") + ", " + fx("Cintilar Amp") + "), 0, 100)",
    { k: [{ opacity: 1 }, { opacity: 0.6 }, { opacity: 0.9 }, { opacity: 0.5 }, { opacity: 1 }], d: 500, steps: true });

  // ---- Combined movement loops (several properties at once)
  lp("l-bounce", "Quique", "Movimento", "position", [ctl("Quique Altura", 60), ctl("Quique Freq", 1.2)],
    "add(value, [0, -Math.abs(Math.sin(time*" + fx("Quique Freq") + "*Math.PI))*" + fx("Quique Altura") + "])",
    { k: [{ transform: "translateY(0)", easing: "cubic-bezier(.3,0,.6,1)" }, { transform: "translateY(-16px)", offset: 0.5, easing: "cubic-bezier(.4,0,.7,1)" }, { transform: "translateY(0)" }], d: 800 });
  lp("l-bounce-sway", "Quique com Balan\u00e7o", "Movimento", "position", [ctl("QB Altura", 50), ctl("QB Freq", 1.2), ctl("QB Balan\u00e7o", 12)],
    "add(value, [0, -Math.abs(Math.sin(time*" + fx("QB Freq") + "*Math.PI))*" + fx("QB Altura") + "])",
    { k: [{ transform: "translateY(0) rotate(-8deg)" }, { transform: "translateY(-14px) rotate(0deg)", offset: 0.5 }, { transform: "translateY(0) rotate(8deg)" }], d: 800, alt: true },
    [{ prop: "rotation", expr: "value + Math.cos(time*" + fx("QB Freq") + "*Math.PI)*" + fx("QB Balan\u00e7o") }]);
  lp("l-sway", "Balan\u00e7o Lateral", "Movimento", "position", [ctl("Lateral Amp", 30), ctl("Lateral Freq", 0.6)],
    "add(value, [Math.sin(time*" + fx("Lateral Freq") + "*" + TAU + ")*" + fx("Lateral Amp") + ", 0])",
    { k: [{ transform: "translateX(-10px)" }, { transform: "translateX(10px)" }], d: 1000, alt: true });
  lp("l-drift", "Movimento Constante", "Movimento", "position", [ctl("Vel X", 40), ctl("Vel Y", 0)],
    "add(value, mul([" + fx("Vel X") + ", " + fx("Vel Y") + "], time - inPoint))",
    { k: [{ transform: "translateX(-14px)" }, { transform: "translateX(14px)" }], d: 2000, lin: true });
  lp("l-wave-spin-scale", "Onda Gira e Escala", "Rota\u00e7\u00e3o", "rotation", [ctl("Onda Freq", 0.8), ctl("Onda Giro", 12), ctl("Onda Escala", 8)],
    "value + Math.sin(time*" + fx("Onda Freq") + "*" + TAU + ")*" + fx("Onda Giro"),
    { k: [{ transform: "rotate(-12deg) scale(0.93)" }, { transform: "rotate(12deg) scale(1.07)" }], d: 1100, alt: true },
    [{ prop: "scale", expr: "mul(value, 1 + Math.sin(time*" + fx("Onda Freq") + "*" + TAU + " + 1.2)*" + fx("Onda Escala") + "/100)" }]);

  window.MP_LIB = { transitions: TR, text: TX, loops: LP };
})();
