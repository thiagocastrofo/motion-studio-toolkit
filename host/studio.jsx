// Motion Studio Toolkit - host (ExtendScript, ES3, ASCII only).
// Loads the Motion Panel engine (host.jsx + tools.jsx, copied next to this file at install time) and adds
// the toolkit tools to the same dispatcher (MPT.T.*), so the panel calls MPT.run({ id: ... }).
$.global.MST = $.global.MST || {};
var MST = $.global.MST;
MST.dir = File($.fileName).parent.fsName;

MST.load = function () {
    if (typeof MP === "undefined" || !MP.apply) $.evalFile(new File(MST.dir + "/host.jsx"));
    if (typeof MPT === "undefined" || !MPT.run) MP.loadTools(MST.dir);
    if (!MPT.T.sequencePro) MST.register();
    return "ok:loaded";
};

MST.register = function () {
    var T = MPT.T;

    // ---------------------------------------------------------------- comp card
    T.stInfo = function (a, comp) {
        var sel = comp.selectedLayers, nText = 0;
        for (var i = 0; i < sel.length; i++) if (sel[i] instanceof TextLayer) nText++;
        return "json:" + MPT.json({ name: comp.name, w: comp.width, h: comp.height, fps: Math.round(comp.frameRate * 100) / 100,
            dur: Math.round(comp.duration * 10) / 10, sel: sel.length, text: nText, total: comp.numLayers });
    };

    // ---------------------------------------------------------------- sequence
    // order: sel | top | bottom | random ; mode: offset (gap between starts) | chain (gap after each end) | trim (in-points only)
    // curve: linear | in | out | inout (how the gaps grow) ; step: layers per group ; from: first | playhead
    T.sequencePro = function (a, comp, layers) {
        var L = [], i;
        for (i = 0; i < layers.length; i++) L.push(layers[i]);
        if (L.length < 2) return "error:Selecione 2 ou mais layers.";
        if (a.order === "top") L.sort(function (x, y) { return x.index - y.index; });
        else if (a.order === "bottom") L.sort(function (x, y) { return y.index - x.index; });
        else if (a.order === "random") for (i = L.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = L[i]; L[i] = L[j]; L[j] = t; }
        if (a.reverse) L.reverse();
        var fd = comp.frameDuration, gap = (+a.frames || 0) * fd, step = Math.max(1, Math.round(+a.step || 1));
        var base = L[0].inPoint;
        if (a.from === "playhead") base = comp.time;
        else for (i = 1; i < L.length; i++) base = Math.min(base, L[i].inPoint);
        var G = Math.ceil(L.length / step);
        var curve = function (x) {
            if (a.curve === "in") return x * x;
            if (a.curve === "out") return 1 - (1 - x) * (1 - x);
            if (a.curve === "inout") return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
            return x;
        };
        var cursor = base;
        for (i = 0; i < L.length; i++) {
            var g = Math.floor(i / step), at;
            if (a.mode === "chain") {
                if (i > 0 && i % step === 0) cursor = L[i - 1].outPoint + gap;
                at = i === 0 ? base : cursor;
            } else {
                at = base + (G > 1 && a.curve && a.curve !== "linear" ? curve(g / (G - 1)) * (G - 1) * gap : g * gap);
            }
            at = Math.round(at / fd) * fd;
            if (a.mode === "trim") { if (at < L[i].outPoint) L[i].inPoint = Math.max(at, L[i].startTime); }
            else L[i].startTime += at - L[i].inPoint;
        }
        return "ok:" + L.length + " layer(s) em sequ\u00eancia" + (a.mode === "chain" ? " (encadeadas)" : "") + ".";
    };

    // ---------------------------------------------------------------- Type It: typewriter with cursor and erase-out
    MST.slider = function (L, name, v, cb) {
        var fx = L.property("ADBE Effect Parade"), e = null;
        for (var i = 1; i <= fx.numProperties; i++) if (fx.property(i).name === name) e = fx.property(i);
        if (!e) { e = fx.addProperty(cb ? "ADBE Checkbox Control" : "ADBE Slider Control"); e.name = name; }
        e.property(1).setValue(v);
        return e;
    };
    T.typeIt = function (a, comp, layers) {
        var n = 0, unit = a.unit === "w" ? 2 : a.unit === "l" ? 3 : 1;
        for (var i = 0; i < layers.length; i++) {
            var L = layers[i];
            if (!(L instanceof TextLayer)) continue;
            MST.slider(L, "MP Type It - Velocidade", a.speed || 18);
            MST.slider(L, "MP Type It - Cursor", a.cursor ? 1 : 0, true);
            MST.slider(L, "MP Type It - Piscar", a.blink || 2);
            MST.slider(L, "MP Type It - Apagar (s)", a.erase || 0);
            var cur = String(a.cursorChar || "|").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            L.property("ADBE Text Properties").property("ADBE Text Document").expression =
                "// MP Type It\n" +
                "var s = \"\" + value, U = " + unit + ";\n" +
                "var P = U == 1 ? s.split(\"\") : U == 2 ? s.split(/(\\s+)/) : s.split(/(\\r\\n|\\r|\\n)/);\n" +
                "var sp = effect(\"MP Type It - Velocidade\")(1), cu = effect(\"MP Type It - Cursor\")(1), bl = effect(\"MP Type It - Piscar\")(1), er = effect(\"MP Type It - Apagar (s)\")(1);\n" +
                "var k = Math.floor((time - inPoint) * sp);\n" +
                "if (er > 0 && outPoint - time < er) k = Math.floor(P.length * Math.max(0, outPoint - time) / er);\n" +
                "k = Math.max(0, Math.min(P.length, k));\n" +
                "var typing = k > 0 && k < P.length, on = typing || bl <= 0 || Math.floor(time * bl * 2) % 2 == 0;\n" +
                "P.slice(0, k).join(\"\") + (cu == 1 && on ? \"" + cur + "\" : \"\")";
            n++;
        }
        return n ? "ok:Type It em " + n + " layer(s) de texto. Ajuste em Effect Controls." : "error:Selecione layers de texto.";
    };

    // ---------------------------------------------------------------- Text Slicer: one layer per letter / word / line
    // Each piece is a duplicate whose animator hides everything except its own range, so it stays exactly in place.
    T.textSlice = function (a, comp, layers) {
        var made = 0, i, k;
        var src = [];
        for (i = 0; i < layers.length; i++) if (layers[i] instanceof TextLayer) src.push(layers[i]);
        if (!src.length) return "error:Selecione layers de texto.";
        var basedOn = a.unit === "w" ? 3 : a.unit === "l" ? 4 : 2; // 2 = characters excluding spaces
        for (i = 0; i < src.length; i++) {
            var L = src[i], txt = String(L.property("ADBE Text Properties").property("ADBE Text Document").value.text), pieces = [];
            if (a.unit === "w") pieces = txt.replace(/^\s+|\s+$/g, "").split(/\s+/);
            else if (a.unit === "l") pieces = txt.split(/\r\n|\r|\n/);
            else pieces = txt.replace(/\s+/g, "").split("");
            var label = 1;
            for (k = pieces.length - 1; k >= 0; k--) {
                if (!pieces[k]) continue;
                var D = L.duplicate();
                D.name = pieces[k].substr(0, 24);
                var an = D.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
                an.name = "MP Slice";
                an.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity").setValue(0);
                var sels = an.property("ADBE Text Selectors");
                sels.addProperty("ADBE Text Selector");                      // whole text hidden
                var keep = sels.addProperty("ADBE Text Selector");           // ...minus this piece
                var adv = keep.property("ADBE Text Range Advanced");
                adv.property("ADBE Text Range Units").setValue(2);
                adv.property("ADBE Text Range Type2").setValue(basedOn);
                keep.property("ADBE Text Selector Mode").setValue(2);
                keep.property("ADBE Text Index Start").setValue(k);
                keep.property("ADBE Text Index End").setValue(k + 1);
                if (a.label) D.label = (label++ % 16) + 1;
                D.moveBefore(L);
                made++;
            }
            if (a.hide) L.enabled = false;
        }
        return "ok:" + made + " layer(s) criadas" + (a.hide ? "; original oculto." : ".");
    };

    // ---------------------------------------------------------------- captions
    MST.CC = "MP CC ";
    MST.ccLayers = function (comp) {
        var out = [];
        for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name.indexOf(MST.CC) === 0 && comp.layer(i) instanceof TextLayer) out.push(comp.layer(i));
        out.sort(function (x, y) { return x.inPoint - y.inPoint; });
        return out;
    };
    // Reads a caption file chosen by the user; the panel parses it.
    T.ccOpen = function () {
        var f = File.openDialog("Importar legendas (.srt, .vtt, .json)");
        if (!f) return "error:Nenhum arquivo escolhido.";
        f.encoding = "UTF-8";
        if (!f.open("r")) return "error:N\u00e3o consegui abrir o arquivo.";
        var s = f.read(); f.close();
        return "json:" + MPT.json({ name: decodeURI(f.name), text: s });
    };
    // captions: [{ s, e, t, w: [word start offsets in seconds] }]
    T.ccImport = function (a, comp) {
        var C = a.captions || [], i, made = 0;
        if (!C.length) return "error:Nenhuma legenda encontrada no arquivo.";
        var old = MST.ccLayers(comp);
        if (a.replace) for (i = 0; i < old.length; i++) old[i].remove();
        for (i = C.length - 1; i >= 0; i--) {
            var c = C[i];
            if (c.e <= c.s) continue;
            var L = comp.layers.addText(c.t);
            L.name = MST.CC + MST.pad(i + 1) + " " + c.t.substr(0, 20);
            L.inPoint = Math.max(0, c.s); L.outPoint = Math.min(comp.duration, c.e);
            L.comment = MPT.json({ w: c.w || [] });
            made++;
        }
        MST.ccApply(comp, a.style || {});
        return "ok:" + made + " legenda(s) importadas.";
    };
    MST.pad = function (n) { return (n < 10 ? "00" : n < 100 ? "0" : "") + n; };
    MST.words = function (L) {
        try { var o = eval("(" + L.comment + ")"); if (o && o.w && o.w.length) return o.w; } catch (e) {}
        // no word timing: spread words by length over the caption
        var txt = String(L.property("ADBE Text Properties").property("ADBE Text Document").value.text), W = txt.split(/\s+/), tot = 0, i, out = [], acc = 0;
        for (i = 0; i < W.length; i++) tot += W[i].length + 1;
        var dur = L.outPoint - L.inPoint;
        for (i = 0; i < W.length; i++) { out.push(Math.round(acc / tot * dur * 1000) / 1000); acc += W[i].length + 1; }
        return out;
    };
    MST.removeAnimator = function (L, name) {
        var A = L.property("ADBE Text Properties").property("ADBE Text Animators");
        for (var i = A.numProperties; i >= 1; i--) if (A.property(i).name === name) A.property(i).remove();
    };
    MST.wordAnimator = function (L, name, props, amountExpr) {
        MST.removeAnimator(L, name);
        var an = L.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
        an.name = name;
        var P = an.property("ADBE Text Animator Properties");
        for (var k in props) if (props.hasOwnProperty(k)) P.addProperty(k).setValue(props[k]);
        var sel = an.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
        sel.property("ADBE Text Range Type2").setValue(3); // words
        sel.property("ADBE Text Expressible Amount").expression = amountExpr;
        return an;
    };
    // style: size, color, font, y (% of height), hiColor/hi, shadow, plate/plateOpacity, motion (none|fade|scale|slide), per (caption|word), mDur (frames)
    MST.ccApply = function (comp, s) {
        var C = MST.ccLayers(comp), fd = comp.frameDuration, i;
        if (!C.length) return 0;
        var md = Math.max(1, s.mDur || 6) * fd;
        for (i = 0; i < C.length; i++) {
            var L = C[i], td = L.property("ADBE Text Properties").property("ADBE Text Document"), d = td.value;
            d.fontSize = s.size || 64;
            d.fillColor = MPT.hex(s.color || "#ffffff").slice(0, 3);
            d.applyFill = true; d.applyStroke = false;
            d.justification = ParagraphJustification.CENTER_JUSTIFY;
            if (s.font) { try { d.font = s.font; } catch (fe) {} }
            td.setValue(d);
            var r = L.sourceRectAtTime(L.inPoint, false);
            var tr = L.property("ADBE Transform Group");
            tr.property("ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
            tr.property("ADBE Position").setValue([comp.width / 2, comp.height * (s.y || 85) / 100]);
            var W = MPT.json(MST.words(L));
            // highlight of the spoken word
            if (s.hi) MST.wordAnimator(L, "MP CC Destaque", { "ADBE Text Fill Color": MPT.hex(s.hiColor || "#ffd60a").slice(0, 3) },
                "// MP CC\nvar W = " + W + ", t = time - thisLayer.inPoint, k = -1;\nfor (var i = 0; i < W.length; i++) if (t >= W[i]) k = i;\n(textIndex - 1 == k) ? [100, 100, 100] : [0, 0, 0]");
            else MST.removeAnimator(L, "MP CC Destaque");
            // motion per word
            MST.removeAnimator(L, "MP CC Movimento");
            var opx = tr.property("ADBE Opacity"), scx = tr.property("ADBE Scale"), psx = tr.property("ADBE Position");
            opx.expression = ""; scx.expression = ""; psx.expression = "";
            if (s.motion && s.motion !== "none") {
                if (s.per === "word") {
                    var props = { "ADBE Text Opacity": 0 };
                    if (s.motion === "scale") props["ADBE Text Scale 3D"] = [40, 40, 100];
                    if (s.motion === "slide") props["ADBE Text Position 3D"] = [0, 30, 0];
                    MST.wordAnimator(L, "MP CC Movimento", props,
                        "var W = " + W + ", d = " + md.toFixed(4) + ", t = time - thisLayer.inPoint - W[textIndex - 1];\nvar x = Math.max(0, Math.min(1, t / d)); x = 1 - Math.pow(1 - x, 3);\nvar a = 100 * (1 - x); [a, a, a]");
                } else {
                    var ease = "var d = " + md.toFixed(4) + ", a = Math.min(1, Math.max(0, (time - inPoint) / d)), b = Math.min(1, Math.max(0, (outPoint - time) / d)), x = Math.min(a, b); x = 1 - Math.pow(1 - x, 3);\n";
                    if (s.motion === "fade") opx.expression = ease + "value * x";
                    if (s.motion === "scale") { opx.expression = ease + "value * x"; scx.expression = ease + "value * (0.6 + 0.4 * x)"; }
                    if (s.motion === "slide") { opx.expression = ease + "value * x"; psx.expression = ease + "value + [0, 40 * (1 - x)]"; }
                }
            }
            // shadow
            var fx = L.property("ADBE Effect Parade"), sh = null, j;
            for (j = 1; j <= fx.numProperties; j++) if (fx.property(j).name === "MP CC Sombra") sh = fx.property(j);
            if (s.shadow && !sh) { sh = fx.addProperty("ADBE Drop Shadow"); sh.name = "MP CC Sombra"; sh.property(4).setValue(4); sh.property(5).setValue(14); }
            if (!s.shadow && sh) sh.remove();
        }
        MST.ccPlate(comp, s);
        return C.length;
    };
    // One shared rounded plate that follows whichever caption is on screen.
    MST.ccPlate = function (comp, s) {
        var P = null, i;
        for (i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === "MP CC Fundo") P = comp.layer(i);
        if (!s.plate) { if (P) P.remove(); return; }
        if (!P) {
            P = comp.layers.addShape(); P.name = "MP CC Fundo";
            var g = P.property("ADBE Root Vectors Group");
            g.addProperty("ADBE Vector Shape - Rect"); g.addProperty("ADBE Vector Graphic - Fill");
            var C = MST.ccLayers(comp); if (C.length) P.moveAfter(C[C.length - 1]);
        }
        var grp = P.property("ADBE Root Vectors Group"), rect = grp.property(1), fill = grp.property(2);
        fill.property("ADBE Vector Fill Color").setValue(MPT.hex(s.plateColor || "#000000"));
        P.property("ADBE Transform Group").property("ADBE Opacity").setValue(s.plateOpacity == null ? 75 : s.plateOpacity);
        var find = "var L = null;\nfor (var i = 1; i <= thisComp.numLayers; i++) { var c = thisComp.layer(i); if (c.name.indexOf(\"MP CC \") == 0 && c.name != \"MP CC Fundo\" && c.active) { L = c; break; } }\n";
        rect.property("ADBE Vector Rect Size").expression = find + "if (L) { var r = L.sourceRectAtTime(time, false), sc = L.transform.scale[0] / 100; [r.width * sc + 48, r.height * sc + 28]; } else [0, 0]";
        rect.property("ADBE Vector Rect Roundness").setValue(14);
        P.property("ADBE Transform Group").property("ADBE Position").expression = find + "if (L) { var r = L.sourceRectAtTime(time, false); L.toComp([r.left + r.width / 2, r.top + r.height / 2]); } else value";
        P.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]);
    };
    T.ccStyle = function (a, comp) {
        var n = MST.ccApply(comp, a.style || {});
        return n ? "ok:Estilo aplicado em " + n + " legenda(s)." : "error:Nenhuma legenda nesta comp. Importe primeiro.";
    };
    T.ccExport = function (a, comp) {
        var C = MST.ccLayers(comp), out = [], i;
        if (!C.length) return "error:Nenhuma legenda nesta comp.";
        var tc = function (t) {
            var ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000;
            var p2 = function (v) { return (v < 10 ? "0" : "") + v; };
            return p2(h) + ":" + p2(m) + ":" + p2(s) + "," + (r < 10 ? "00" : r < 100 ? "0" : "") + r;
        };
        for (i = 0; i < C.length; i++) out.push((i + 1) + "\n" + tc(C[i].inPoint) + " --> " + tc(C[i].outPoint) + "\n" + String(C[i].property("ADBE Text Properties").property("ADBE Text Document").value.text) + "\n");
        var f = File.saveDialog("Exportar legendas", "SubRip:*.srt");
        if (!f) return "error:Exporta\u00e7\u00e3o cancelada.";
        if (!/\.srt$/i.test(f.name)) f = new File(f.fsName + ".srt");
        f.encoding = "UTF-8"; f.lineFeed = "Windows";
        f.open("w"); f.write(out.join("\n")); f.close();
        return "ok:" + C.length + " legenda(s) exportadas para " + decodeURI(f.name) + ".";
    };
    T.ccSelect = function (a, comp) {
        var C = MST.ccLayers(comp), i;
        for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        for (i = 0; i < C.length; i++) C[i].selected = true;
        return C.length ? "ok:" + C.length + " legenda(s) selecionadas." : "error:Nenhuma legenda nesta comp.";
    };
    T.ccCount = function (a, comp) { return "json:" + MPT.json({ n: MST.ccLayers(comp).length }); };

    var NL = { sequencePro: 1, typeIt: 1, textSlice: 1 }, k;
    for (k in NL) if (NL.hasOwnProperty(k)) MPT.NEEDS_LAYERS[k] = 1;
    MPT.READ_ONLY.stInfo = 1; MPT.READ_ONLY.ccCount = 1; MPT.READ_ONLY.ccOpen = 1;
    MPT.NO_COMP.ccOpen = 1;
};

try { MST.load(); } catch (e) {}
