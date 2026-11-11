// Motion Panel - workflow tools (ExtendScript ES3). Loaded by host.jsx.
// Single entry point: MPT.run('{"id": "...", ...}') -> "ok:<msg>" | "error:<msg>" | "json:<data>"

// $.evalFile called from inside a function evaluates in that function's scope, so the namespace is
// registered on $.global explicitly; "var MPT" only aliases the global object.
$.global.MPT = $.global.MPT || {};
var MPT = $.global.MPT;
MPT.TAG = "MP ";

// ------------------------------------------------------------ helpers
MPT.json = function (v) {
    var i, out, t = typeof v;
    if (v === null || v === undefined) return "null";
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
    if (v instanceof Array) {
        out = [];
        for (i = 0; i < v.length; i++) out.push(MPT.json(v[i]));
        return "[" + out.join(",") + "]";
    }
    out = [];
    for (i in v) if (v.hasOwnProperty(i)) out.push(MPT.json(String(i)) + ":" + MPT.json(v[i]));
    return "{" + out.join(",") + "}";
};
MPT.comp = function () {
    var c = app.project.activeItem;
    return (c && c instanceof CompItem) ? c : null;
};
MPT.hex = function (h) {
    h = String(h || "#ffffff").replace("#", "");
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255, 1];
};
MPT.tr = function (layer, m) { return layer.property("ADBE Transform Group").property(m); };
MPT.isVisual = function (L) { return (L instanceof AVLayer) || (L instanceof TextLayer) || (L instanceof ShapeLayer); };
MPT.addKeyOrSet = function (prop, v, t) { if (prop.numKeys) prop.setValueAtTime(t, v); else prop.setValue(v); };
MPT.shiftProp = function (prop, d) {
    // Adds a 2D offset to a (possibly keyframed) position property.
    var k, v;
    if (prop.numKeys) {
        for (k = 1; k <= prop.numKeys; k++) {
            v = prop.keyValue(k);
            prop.setValueAtKey(k, v.length > 2 ? [v[0] + d[0], v[1] + d[1], v[2]] : [v[0] + d[0], v[1] + d[1]]);
        }
    } else {
        v = prop.value;
        prop.setValue(v.length > 2 ? [v[0] + d[0], v[1] + d[1], v[2]] : [v[0] + d[0], v[1] + d[1]]);
    }
};
// Approximate bounds in comp space (ignores parenting and rotation).
MPT.bounds = function (L, t) {
    var r = L.sourceRectAtTime(t, false);
    var ap = MPT.tr(L, "ADBE Anchor Point").valueAtTime(t, false);
    var p = MPT.tr(L, "ADBE Position").valueAtTime(t, false);
    var s = MPT.tr(L, "ADBE Scale").valueAtTime(t, false);
    var x0 = p[0] + (r.left - ap[0]) * s[0] / 100, y0 = p[1] + (r.top - ap[1]) * s[1] / 100;
    var w = r.width * s[0] / 100, h = r.height * s[1] / 100;
    if (w < 0) { x0 += w; w = -w; }
    if (h < 0) { y0 += h; h = -h; }
    return { l: x0, t: y0, r: x0 + w, b: y0 + h, cx: x0 + w / 2, cy: y0 + h / 2 };
};
MPT.moveAnchor = function (L, nx, ny, t) {
    var r = L.sourceRectAtTime(t, false);
    var ap = MPT.tr(L, "ADBE Anchor Point"), pos = MPT.tr(L, "ADBE Position");
    if (ap.numKeys || pos.dimensionsSeparated) return false;
    var old = ap.value, nw = [r.left + r.width * nx, r.top + r.height * ny];
    var sc = MPT.tr(L, "ADBE Scale").value, rot = MPT.tr(L, "ADBE Rotate Z").value * Math.PI / 180;
    var dx = (nw[0] - old[0]) * sc[0] / 100, dy = (nw[1] - old[1]) * sc[1] / 100;
    ap.setValue(old.length > 2 ? [nw[0], nw[1], old[2]] : nw);
    MPT.shiftProp(pos, [dx * Math.cos(rot) - dy * Math.sin(rot), dx * Math.sin(rot) + dy * Math.cos(rot)]);
    return true;
};
MPT.findEffect = function (L, name, match, create) {
    var fx = L.property("ADBE Effect Parade");
    if (!fx) return null;
    for (var i = 1; i <= fx.numProperties; i++) if (fx.property(i).name === name) return fx.property(i);
    if (!create || !fx.canAddProperty(match)) return null;
    var e = fx.addProperty(match);
    e.name = name;
    return e;
};
MPT.slider = function (L, name, v) {
    MPT.findEffect(L, MPT.TAG + name, "ADBE Slider Control", true);
    MPT.findEffect(L, MPT.TAG + name, "ADBE Slider Control", false).property(1).setValue(v);
};
MPT.sortByIndex = function (arr) { arr.sort(function (a, b) { return a.index - b.index; }); return arr; };
MPT.selProps = function (comp) {
    var out = [], sp = comp.selectedProperties;
    for (var i = 0; i < sp.length; i++) if (sp[i].propertyType === PropertyType.PROPERTY) out.push(sp[i]);
    return out;
};
MPT.layerOf = function (prop) { return prop.propertyGroup(prop.propertyDepth); };
MPT.textLayersDeep = function (comp, seen, out) {
    // Collects text layers in comp and nested precomps (each comp visited once).
    if (seen[comp.id]) return out;
    seen[comp.id] = true;
    for (var i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        if (L instanceof TextLayer) out.push(L);
        else if (L.source && L.source instanceof CompItem) MPT.textLayersDeep(L.source, seen, out);
    }
    return out;
};

// ------------------------------------------------------------ tool implementations
MPT.T = {};

MPT.T.align = function (a, comp, layers) {
    var t = comp.time, i, n = 0, ref;
    if (a.to === "sel" && layers.length > 1) {
        ref = MPT.bounds(layers[0], t);
        for (i = 1; i < layers.length; i++) {
            var q = MPT.bounds(layers[i], t);
            ref.l = Math.min(ref.l, q.l); ref.t = Math.min(ref.t, q.t); ref.r = Math.max(ref.r, q.r); ref.b = Math.max(ref.b, q.b);
        }
        ref.cx = (ref.l + ref.r) / 2; ref.cy = (ref.t + ref.b) / 2;
    } else {
        ref = { l: 0, t: 0, r: comp.width, b: comp.height, cx: comp.width / 2, cy: comp.height / 2 };
    }
    for (i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!MPT.isVisual(L) || L.parent) continue;
        var pos = MPT.tr(L, "ADBE Position");
        if (pos.dimensionsSeparated) continue;
        var b = MPT.bounds(L, t), d = [0, 0];
        if (a.dir === "left") d[0] = ref.l - b.l;
        if (a.dir === "hcenter") d[0] = ref.cx - b.cx;
        if (a.dir === "right") d[0] = ref.r - b.r;
        if (a.dir === "top") d[1] = ref.t - b.t;
        if (a.dir === "vcenter") d[1] = ref.cy - b.cy;
        if (a.dir === "bottom") d[1] = ref.b - b.b;
        if (a.dir === "center") { d[0] = ref.cx - b.cx; d[1] = ref.cy - b.cy; }
        MPT.shiftProp(pos, d);
        n++;
    }
    return "ok:" + n + " layer(s) alinhadas.";
};

MPT.T.distribute = function (a, comp, layers) {
    var t = comp.time, items = [], i;
    for (i = 0; i < layers.length; i++) if (MPT.isVisual(layers[i]) && !layers[i].parent) items.push({ L: layers[i], b: MPT.bounds(layers[i], t) });
    if (items.length < 3) return "error:Selecione 3 ou mais layers.";
    var v = a.axis === "v", delta;
    // edge: l / cx / r (horizontal) or t / cy / b (vertical); mode "space" makes the gaps between layers equal.
    var k = a.edge || (v ? "cy" : "cx");
    if (a.mode === "space") {
        var lo = v ? "t" : "l", hi = v ? "b" : "r", total = 0;
        items.sort(function (x, y) { return x.b[lo] - y.b[lo]; });
        for (i = 0; i < items.length; i++) total += items[i].b[hi] - items[i].b[lo];
        var gap = (items[items.length - 1].b[hi] - items[0].b[lo] - total) / (items.length - 1), cur = items[0].b[hi] + gap;
        for (i = 1; i < items.length - 1; i++) {
            delta = cur - items[i].b[lo];
            MPT.shiftProp(MPT.tr(items[i].L, "ADBE Position"), v ? [0, delta] : [delta, 0]);
            cur += items[i].b[hi] - items[i].b[lo] + gap;
        }
        return "ok:Espa\u00e7amento igual entre " + items.length + " layer(s).";
    }
    items.sort(function (x, y) { return x.b[k] - y.b[k]; });
    var first = items[0].b[k], step = (items[items.length - 1].b[k] - first) / (items.length - 1);
    for (i = 1; i < items.length - 1; i++) {
        delta = first + step * i - items[i].b[k];
        MPT.shiftProp(MPT.tr(items[i].L, "ADBE Position"), v ? [0, delta] : [delta, 0]);
    }
    return "ok:" + items.length + " layer(s) distribu\u00eddas.";
};

MPT.T.anchor = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) if (MPT.isVisual(layers[i]) && MPT.moveAnchor(layers[i], a.x, a.y, comp.time)) n++;
    return "ok:\u00c2ncora movida em " + n + " layer(s).";
};

MPT.T.precomp = function (a, comp, layers) {
    var idx = [], i;
    for (i = 0; i < layers.length; i++) idx.push(layers[i].index);
    idx.sort(function (x, y) { return x - y; });
    if (a.mode === "together") {
        comp.layers.precompose(idx, a.name || (layers[0].name + " Comp"), true);
        return "ok:" + idx.length + " layer(s) precompostas juntas.";
    }
    for (i = idx.length - 1; i >= 0; i--) {
        var L = comp.layer(idx[i]);
        comp.layers.precompose([idx[i]], L.name + " Comp", true);
    }
    return "ok:" + idx.length + " precomp(s) criadas.";
};

MPT.T.unprecomp = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        var P = layers[i];
        if (!(P.source instanceof CompItem)) continue;
        var inner = P.source, j;
        for (j = inner.numLayers; j >= 1; j--) inner.layer(j).copyToComp(comp);
        for (j = 1; j <= inner.numLayers; j++) {
            var c = comp.layer(1);
            c.moveBefore(P);
            c.startTime += P.startTime;
        }
        P.remove();
        n++;
    }
    return n ? "ok:" + n + " precomp(s) desfeitas." : "error:Selecione layers de precomp.";
};

MPT.T.organize = function () {
    var root = app.project.rootFolder, i, groups = {}, n = 0;
    var VIDEO = /\.(mp4|mov|avi|mxf|webm|mkv|m4v|r3d|braw)$/i, AUDIO = /\.(wav|mp3|aif|aiff|m4a|aac|ogg|flac)$/i;
    var folder = function (name) {
        if (groups[name]) return groups[name];
        for (var k = 1; k <= root.numItems; k++) if (root.item(k) instanceof FolderItem && root.item(k).name === name) return (groups[name] = root.item(k));
        return (groups[name] = app.project.items.addFolder(name));
    };
    var items = [];
    for (i = 1; i <= root.numItems; i++) items.push(root.item(i));
    for (i = 0; i < items.length; i++) {
        var it = items[i], dest = null;
        if (it instanceof FolderItem) continue;
        if (it instanceof CompItem) dest = "Comps";
        else if (it instanceof FootageItem) {
            if (it.mainSource instanceof SolidSource) dest = "Solids";
            else if (it.file && AUDIO.test(it.file.name)) dest = "\u00c1udio";
            else if (it.file && VIDEO.test(it.file.name)) dest = "V\u00eddeos";
            else if (it.file) dest = "Imagens";
        }
        if (dest) { it.parentFolder = folder(dest); n++; }
    }
    return "ok:" + n + " item(ns) organizados em pastas.";
};

MPT.T.clipCopy = function (a, comp) {
    var props = MPT.selProps(comp), slot = [], i;
    for (i = 0; i < props.length; i++) {
        try { slot.push({ match: props[i].matchName, name: props[i].name, value: props[i].valueAtTime(comp.time, false) }); } catch (e) {}
    }
    if (!slot.length) return "error:Selecione propriedades na timeline.";
    if (!$.global.MPT_SLOTS) $.global.MPT_SLOTS = {};
    $.global.MPT_SLOTS[a.slot] = slot;
    return "ok:" + slot.length + " valor(es) copiados para o slot " + a.slot + ".";
};
MPT.T.clipPaste = function (a, comp) {
    var slot = ($.global.MPT_SLOTS || {})[a.slot];
    if (!slot) return "error:Slot " + a.slot + " vazio.";
    var props = MPT.selProps(comp), n = 0, i, j;
    for (i = 0; i < props.length; i++) {
        for (j = 0; j < slot.length; j++) {
            if (slot.length === 1 || slot[j].match === props[i].matchName) {
                try { MPT.addKeyOrSet(props[i], slot[j].value, comp.time); n++; } catch (e) {}
                break;
            }
        }
    }
    return n ? "ok:" + n + " propriedade(s) coladas." : "error:Selecione propriedades compat\u00edveis.";
};
MPT.T.clipClear = function (a) {
    if ($.global.MPT_SLOTS) delete $.global.MPT_SLOTS[a.slot];
    return "ok:Slot " + a.slot + " limpo.";
};

MPT.T.trim = function (a, comp, layers) {
    for (var i = 0; i < layers.length; i++) {
        if (a.side === "before") layers[i].inPoint = comp.time;
        else layers[i].outPoint = comp.time;
    }
    return "ok:" + layers.length + " layer(s) cortadas.";
};

MPT.CREATE_FX = {
    glow: ["ADBE Glo2", "Glow"], fill: ["ADBE Fill", "Preenchimento"], tint: ["ADBE Tint", "Tint"],
    blur: ["ADBE Gaussian Blur 2", "Blur"], ramp: ["ADBE Ramp", "Gradiente"], mirror: ["ADBE Mirror", "Espelho"],
    shadow: ["ADBE Drop Shadow", "Sombra"], curves: ["ADBE CurvesCustom", "Curvas"], lumetri: ["ADBE Lumetri", "Lumetri"],
    stroke: ["ADBE Stroke", "Contorno"], noise: ["ADBE Noise", "Ru\u00eddo"], sharpen: ["ADBE Sharpen", "Nitidez"]
};
MPT.T.create = function (a, comp, layers) {
    var L, above = layers.length ? layers[0] : null;
    if (a.kind === "solid") L = comp.layers.addSolid(MPT.hex(a.color || "#1c1c1e").slice(0, 3), "S\u00f3lido", comp.width, comp.height, comp.pixelAspect, comp.duration);
    else if (a.kind === "null") L = comp.layers.addNull(comp.duration);
    else if (a.kind === "camera") L = comp.layers.addCamera("C\u00e2mera", [comp.width / 2, comp.height / 2]);
    else if (a.kind === "light") { L = comp.layers.addLight("Luz", [comp.width / 2, comp.height / 2]); }
    else if (a.kind === "text") L = comp.layers.addText("Texto");
    else if (a.kind === "shape") L = comp.layers.addShape();
    else if (a.kind === "adj") {
        L = comp.layers.addSolid([1, 1, 1], "Ajuste", comp.width, comp.height, comp.pixelAspect, comp.duration);
        L.adjustmentLayer = true;
    } else return "error:tipo desconhecido";
    if (above && L.index !== above.index) L.moveBefore(above);
    return "ok:Layer criada.";
};
MPT.T.fx = function (a, comp, layers) {
    var f = MPT.CREATE_FX[a.fx], n = 0;
    if (!f) return "error:efeito desconhecido";
    for (var i = 0; i < layers.length; i++) {
        var fx = layers[i].property("ADBE Effect Parade");
        if (fx && fx.canAddProperty(f[0])) { fx.addProperty(f[0]); n++; }
    }
    return n ? "ok:" + f[1] + " adicionado em " + n + " layer(s)." : "error:Efeito indispon\u00edvel nessas layers.";
};
MPT.T.removeFx = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        var fx = layers[i].property("ADBE Effect Parade");
        if (!fx) continue;
        for (var k = fx.numProperties; k >= 1; k--) { fx.property(k).remove(); n++; }
    }
    return "ok:" + n + " efeito(s) removidos.";
};
MPT.T.fit = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!MPT.isVisual(L)) continue;
        var r = L.sourceRectAtTime(comp.time, false);
        if (!r.width || !r.height) continue;
        var sx = comp.width / r.width, sy = comp.height / r.height;
        var s = (a.mode === "fill" ? Math.max(sx, sy) : Math.min(sx, sy)) * 100;
        if (a.mode === "stretch") MPT.addKeyOrSet(MPT.tr(L, "ADBE Scale"), [sx * 100, sy * 100, 100], comp.time);
        else MPT.addKeyOrSet(MPT.tr(L, "ADBE Scale"), [s, s, 100], comp.time);
        MPT.moveAnchor(L, 0.5, 0.5, comp.time);
        var pos = MPT.tr(L, "ADBE Position");
        if (!pos.numKeys && !pos.dimensionsSeparated) {
            var v = pos.value;
            pos.setValue(v.length > 2 ? [comp.width / 2, comp.height / 2, v[2]] : [comp.width / 2, comp.height / 2]);
        }
        n++;
    }
    return "ok:" + n + " layer(s) ajustadas \u00e0 comp.";
};
MPT.T.caseText = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        if (!(layers[i] instanceof TextLayer)) continue;
        var st = layers[i].property("ADBE Text Properties").property("ADBE Text Document");
        if (st.numKeys) continue;
        var doc = st.value, s = doc.text;
        if (a.mode === "upper") s = s.toUpperCase();
        else if (a.mode === "lower") s = s.toLowerCase();
        else s = s.toLowerCase().replace(/(^|[\s\-\/])(\S)/g, function (m, p, c) { return p + c.toUpperCase(); });
        doc.text = s;
        st.setValue(doc);
        n++;
    }
    return n ? "ok:" + n + " texto(s) alterados." : "error:Selecione layers de texto (sem keyframes no texto).";
};
MPT.T.trueDup = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!(L.source instanceof CompItem)) continue;
        var d = L.duplicate();
        d.replaceSource(L.source.duplicate(), false);
        n++;
    }
    return n ? "ok:" + n + " precomp(s) duplicadas de forma independente." : "error:Selecione layers de precomp.";
};
MPT.T.splitMasks = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i], masks = L.property("ADBE Mask Parade");
        if (!masks || masks.numProperties < 2) continue;
        var count = masks.numProperties;
        for (var m = count; m >= 1; m--) {
            var d = L.duplicate();
            var dm = d.property("ADBE Mask Parade");
            for (var k = dm.numProperties; k >= 1; k--) if (k !== m) dm.property(k).remove();
            d.name = L.name + " \u00b7 " + masks.property(m).name;
            n++;
        }
        L.enabled = false;
    }
    return n ? "ok:" + n + " layer(s) criadas a partir das m\u00e1scaras." : "error:Selecione layers com 2+ m\u00e1scaras.";
};

// ---- previous Motion Panel tools
MPT.T.sequence = function (a, comp, layers) {
    var fd = comp.frameDuration, ref = layers[0].inPoint;
    for (var i = 0; i < layers.length; i++) layers[i].startTime += ref + i * a.frames * fd - layers[i].inPoint;
    return "ok:" + layers.length + " layer(s) sequenciadas.";
};
MPT.T.loopOut = function (a, comp) {
    var props = MPT.selProps(comp), n = 0;
    for (var i = 0; i < props.length; i++) if (props[i].canSetExpression && props[i].numKeys > 1) { props[i].expression = 'loopOut("' + a.kind + '")'; n++; }
    return n ? "ok:Loop em " + n + " propriedade(s)." : "error:Selecione propriedades com 2+ keyframes.";
};
MPT.T.motionBlur = function (a, comp, layers) {
    var on = !layers[0].motionBlur, n = 0;
    comp.motionBlur = true;
    for (var i = 0; i < layers.length; i++) { try { layers[i].motionBlur = on; n++; } catch (x) {} }
    return "ok:Motion blur " + (on ? "ligado" : "desligado") + " em " + n + " layer(s).";
};
MPT.T.nullParent = function (a, comp, layers) {
    var sx = 0, sy = 0, i, n = 0;
    for (i = 0; i < layers.length; i++) { var b = MPT.bounds(layers[i], comp.time); sx += b.cx; sy += b.cy; }
    var nl = comp.layers.addNull();
    nl.name = MPT.TAG + "Controle";
    MPT.tr(nl, "ADBE Position").setValue([sx / layers.length, sy / layers.length]);
    nl.moveBefore(layers[0]);
    for (i = 0; i < layers.length; i++) if (!layers[i].parent) { layers[i].parent = nl; n++; }
    return "ok:" + n + " layer(s) ligadas ao null.";
};
// Number counter. AE Slider Controls are capped at +/-1,000,000, so the slider holds the PROGRESS
// (0-100 %, keyframed) and the start/end values live in the expression, with no size limit.
MPT.T.counter = function (a, comp, layers) {
    var n = 0, fd = comp.frameDuration, from = Number(a.from) || 0, to = Number(a.to) || 0;
    for (var i = 0; i < layers.length; i++) {
        var T = layers[i];
        if (!(T instanceof TextLayer)) continue;
        // Older versions stored the value itself in "MP Contador"; replace it by the progress slider.
        var fx = T.property("ADBE Effect Parade");
        for (var k = fx.numProperties; k >= 1; k--) if (fx.property(k).name === MPT.TAG + "Contador") fx.property(k).remove();
        MPT.slider(T, "Contador %", 0);
        MPT.slider(T, "Casas decimais", a.decimals || 0);
        var cnt = MPT.findEffect(T, MPT.TAG + "Contador %", "ADBE Slider Control", false).property(1);
        while (cnt.numKeys) cnt.removeKey(1);
        var k1 = cnt.addKey(T.inPoint), k2;
        cnt.setValueAtKey(k1, 0);
        k2 = cnt.addKey(T.inPoint + a.frames * fd);
        cnt.setValueAtKey(k2, 100);
        cnt.setTemporalEaseAtKey(k1, [new KeyframeEase(0, 15)], [new KeyframeEase(0, 15)]);
        cnt.setTemporalEaseAtKey(k2, [new KeyframeEase(0, 90)], [new KeyframeEase(0, 33)]);
        T.property("ADBE Text Properties").property("ADBE Text Document").expression =
            '// MP contador: de ' + from + ' at\u00e9 ' + to + ' (o slider MP Contador % \u00e9 o progresso)\n' +
            'var de = ' + from + ', ate = ' + to + ';\n' +
            'var p = clamp(effect("MP Contador %")(1), 0, 100) / 100;\n' +
            'var v = de + (ate - de) * p, d = Math.max(0, Math.round(effect("MP Casas decimais")(1)));\n' +
            'var s = Math.abs(v).toFixed(d).split(".");\n' +
            's[0] = s[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, "' + (a.sep === "," ? "," : ".") + '");\n' +
            '(v < 0 ? "-" : "") + "' + (a.prefix || "") + '" + s.join("' + (a.sep === "," ? "." : ",") + '") + "' + (a.suffix || "") + '"';
        n++;
    }
    return n ? "ok:Contador criado em " + n + " layer(s)." : "error:Selecione uma layer de texto.";
};

// Template: a brand-new centred text layer (font, size, colour) that counts from "from" to "to".
MPT.T.counterLayer = function (a, comp) {
    var size = a.size || 140, warn = "";
    var T = comp.layers.addText(String(a.from || 0));
    T.name = MPT.TAG + "Contador";
    var st = T.property("ADBE Text Properties").property("ADBE Text Document"), doc = st.value;
    doc.fontSize = size;
    doc.applyFill = true;
    doc.fillColor = MPT.hex(a.color || "#ffffff").slice(0, 3);
    doc.justification = ParagraphJustification.CENTER_JUSTIFY;
    if (a.font) { try { doc.font = a.font; } catch (e) { warn = " (fonte \u201c" + a.font + "\u201d n\u00e3o encontrada; usei a padr\u00e3o)"; } }
    st.setValue(doc);
    if (a.font && st.value.font !== a.font) warn = " (fonte \u201c" + a.font + "\u201d n\u00e3o encontrada; usei a padr\u00e3o)";
    MPT.tr(T, "ADBE Position").setValue([comp.width / 2, comp.height / 2 + size * 0.35]);
    T.startTime = comp.time;
    var r = MPT.T.counter(a, comp, [T]);
    if (r.indexOf("ok:") !== 0) return r;
    return "ok:Contador criado numa layer nova no playhead" + warn + ".";
};

// ---- Graph: apply a cubic-bezier curve to segments between selected keyframes
MPT.T.bezier = function (a, comp) {
    var b = a.b, props = MPT.selProps(comp), segs = 0, i, j;
    var x1 = Math.max(0.001, Math.min(1, b[0])), y1 = b[1], x2 = Math.max(0, Math.min(0.999, b[2])), y2 = b[3];
    for (i = 0; i < props.length; i++) {
        var p = props[i], sk = p.selectedKeys;
        if (sk.length < 2) continue;
        var vt = p.propertyValueType;
        var spatial = vt === PropertyValueType.TwoD_SPATIAL || vt === PropertyValueType.ThreeD_SPATIAL;
        for (j = 0; j < sk.length - 1; j++) {
            var k1 = sk[j], k2 = sk[j + 1];
            if (k2 !== k1 + 1) continue;
            var dt = p.keyTime(k2) - p.keyTime(k1), v1 = p.keyValue(k1), v2 = p.keyValue(k2), dv = [], d;
            if (dt <= 0) continue;
            if (spatial) {
                var s = 0;
                for (d = 0; d < v1.length; d++) s += (v2[d] - v1[d]) * (v2[d] - v1[d]);
                dv = [Math.sqrt(s)];
            } else if (v1 instanceof Array) {
                for (d = 0; d < v1.length; d++) dv.push(v2[d] - v1[d]);
            } else if (typeof v1 === "number") dv = [v2 - v1];
            else continue;
            var outE = [], inE = [];
            for (d = 0; d < dv.length; d++) {
                var avg = dv[d] / dt;
                outE.push(new KeyframeEase((y1 / x1) * avg, Math.max(0.1, x1 * 100)));
                inE.push(new KeyframeEase(((1 - y2) / (1 - x2)) * avg, Math.max(0.1, (1 - x2) * 100)));
            }
            p.setInterpolationTypeAtKey(k1, p.keyInInterpolationType(k1), KeyframeInterpolationType.BEZIER);
            p.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.BEZIER, p.keyOutInterpolationType(k2));
            if (outE.length === p.keyOutTemporalEase(k1).length) p.setTemporalEaseAtKey(k1, p.keyInTemporalEase(k1), outE);
            if (inE.length === p.keyInTemporalEase(k2).length) p.setTemporalEaseAtKey(k2, inE, p.keyOutTemporalEase(k2));
            segs++;
        }
    }
    return segs ? "ok:Curva aplicada em " + segs + " intervalo(s)." : "error:Selecione 2+ keyframes vizinhos na timeline.";
};

// ---- Fonts
MPT.T.fontsScan = function (a, comp) {
    var layers = MPT.textLayersDeep(comp, {}, []), map = {}, list = [], i;
    for (i = 0; i < layers.length; i++) {
        var f = layers[i].property("ADBE Text Properties").property("ADBE Text Document").value.font;
        map[f] = (map[f] || 0) + 1;
    }
    for (var k in map) if (map.hasOwnProperty(k)) list.push({ font: k, count: map[k] });
    return "json:" + MPT.json(list);
};
MPT.T.fontsAll = function () {
    var out = [];
    try {
        var fams = app.fonts.allFonts;
        for (var i = 0; i < fams.length && out.length < 6000; i++)
            for (var j = 0; j < fams[i].length; j++) out.push(fams[i][j].postScriptName);
    } catch (e) { return "error:Lista de fontes indispon\u00edvel nesta vers\u00e3o do AE."; }
    return "json:" + MPT.json(out);
};
MPT.T.fontsReplace = function (a, comp, layers) {
    var pool = a.selectedOnly ? layers : MPT.textLayersDeep(comp, {}, []), n = 0, i;
    for (i = 0; i < pool.length; i++) {
        if (!(pool[i] instanceof TextLayer)) continue;
        var st = pool[i].property("ADBE Text Properties").property("ADBE Text Document");
        if (st.numKeys) continue;
        var doc = st.value;
        if (doc.font !== a.from) continue;
        doc.font = a.to;
        st.setValue(doc);
        n++;
    }
    return n ? "ok:Fonte trocada em " + n + " layer(s)." : "error:Nenhuma layer usa essa fonte (ou o texto tem keyframes).";
};

// ---- Shapes
MPT.vectorItems = function (group, match, out) {
    for (var i = 1; i <= group.numProperties; i++) {
        var p = group.property(i);
        if (p.matchName === match) out.push(p);
        else if (p.propertyType !== PropertyType.PROPERTY && p.numProperties) MPT.vectorItems(p, match, out);
    }
    return out;
};
MPT.shapeLayers = function (layers) {
    var out = [];
    for (var i = 0; i < layers.length; i++) if (layers[i] instanceof ShapeLayer) out.push(layers[i]);
    return out;
};
MPT.T.shapeStyle = function (a, comp, layers) {
    var shapes = MPT.shapeLayers(layers), n = 0, errs = [], i, j;
    if (!shapes.length) return "error:Selecione layers de shape.";
    for (i = 0; i < shapes.length; i++) {
        var root = shapes[i].property("ADBE Root Vectors Group");
        try {
            if (a.fill) {
                var fills = MPT.vectorItems(root, "ADBE Vector Graphic - Fill", []);
                if (!fills.length) { shapes[i].property("ADBE Root Vectors Group").addProperty("ADBE Vector Graphic - Fill"); fills = MPT.vectorItems(shapes[i].property("ADBE Root Vectors Group"), "ADBE Vector Graphic - Fill", []); }
                for (j = 0; j < fills.length; j++) {
                    fills[j].property("ADBE Vector Fill Color").setValue(MPT.hex(a.fill));
                    fills[j].property("ADBE Vector Fill Opacity").setValue(a.opacity);
                }
            }
            if (a.stroke) {
                var strokes = MPT.vectorItems(shapes[i].property("ADBE Root Vectors Group"), "ADBE Vector Graphic - Stroke", []);
                if (!strokes.length) { shapes[i].property("ADBE Root Vectors Group").addProperty("ADBE Vector Graphic - Stroke"); strokes = MPT.vectorItems(shapes[i].property("ADBE Root Vectors Group"), "ADBE Vector Graphic - Stroke", []); }
                for (j = 0; j < strokes.length; j++) {
                    strokes[j].property("ADBE Vector Stroke Color").setValue(MPT.hex(a.stroke));
                    strokes[j].property("ADBE Vector Stroke Width").setValue(a.width);
                    strokes[j].property("ADBE Vector Stroke Opacity").setValue(a.opacity);
                    if (a.round) {
                        strokes[j].property("ADBE Vector Stroke Line Cap").setValue(2);
                        strokes[j].property("ADBE Vector Stroke Line Join").setValue(2);
                    }
                }
            }
            n++;
        } catch (e) { errs.push(e.toString()); }
    }
    return n ? "ok:Estilo aplicado em " + n + " shape(s)." : "error:" + errs.join("; ");
};
MPT.T.trimPaths = function (a, comp, layers) {
    var shapes = MPT.shapeLayers(layers), n = 0, fd = comp.frameDuration;
    if (!shapes.length) return "error:Selecione layers de shape.";
    for (var i = 0; i < shapes.length; i++) {
        var S = shapes[i];
        var tp = MPT.vectorItems(S.property("ADBE Root Vectors Group"), "ADBE Vector Filter - Trim", [])[0];
        if (!tp) tp = S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Trim");
        tp = MPT.vectorItems(S.property("ADBE Root Vectors Group"), "ADBE Vector Filter - Trim", [])[0];
        var st = tp.property("ADBE Vector Trim Start"), en = tp.property("ADBE Vector Trim End"), of = tp.property("ADBE Vector Trim Offset");
        while (en.numKeys) en.removeKey(1);
        st.setValue(a.start); of.setValue(a.offset);
        if (a.animate) {
            var k1 = en.addKey(S.inPoint), k2 = en.addKey(S.inPoint + a.frames * fd);
            en.setValueAtKey(k1, a.start); en.setValueAtKey(k2, a.end);
            en.setTemporalEaseAtKey(k1, [new KeyframeEase(0, 33)], [new KeyframeEase(0, 75)]);
            en.setTemporalEaseAtKey(k2, [new KeyframeEase(0, 75)], [new KeyframeEase(0, 33)]);
        } else en.setValue(a.end);
        n++;
    }
    return "ok:Trim Paths em " + n + " shape(s).";
};
MPT.T.dashes = function (a, comp, layers) {
    var shapes = MPT.shapeLayers(layers), n = 0;
    if (!shapes.length) return "error:Selecione layers de shape.";
    for (var i = 0; i < shapes.length; i++) {
        var S = shapes[i];
        var count = MPT.vectorItems(S.property("ADBE Root Vectors Group"), "ADBE Vector Graphic - Stroke", []).length;
        for (var j = 0; j < count; j++) {
            // Adding a dash property invalidates earlier references, so the group is fetched again every time.
            var D = function () {
                return MPT.vectorItems(S.property("ADBE Root Vectors Group"), "ADBE Vector Graphic - Stroke", [])[j].property("ADBE Vector Stroke Dashes");
            };
            // The Dashes group always exposes Dash/Gap/Offset as hidden placeholders, so property() is not a
            // reliable "exists" test; canAddProperty() is true until the element has really been added.
            if (D().canAddProperty("ADBE Vector Stroke Dash 1")) D().addProperty("ADBE Vector Stroke Dash 1");
            if (D().canAddProperty("ADBE Vector Stroke Gap 1")) D().addProperty("ADBE Vector Stroke Gap 1");
            if (D().canAddProperty("ADBE Vector Stroke Offset")) D().addProperty("ADBE Vector Stroke Offset");
            D().property("ADBE Vector Stroke Dash 1").setValue(a.dash);
            D().property("ADBE Vector Stroke Gap 1").setValue(a.gap);
            if (a.animate) D().property("ADBE Vector Stroke Offset").expression = "// MP dash\ntime * " + (a.speed || 60);
            else D().property("ADBE Vector Stroke Offset").setValue(a.offset || 0);
            n++;
        }
    }
    return n ? "ok:Tracejado em " + n + " contorno(s)." : "error:As shapes n\u00e3o t\u00eam contorno (Stroke).";
};
MPT.T.taper = function (a, comp, layers) {
    var shapes = MPT.shapeLayers(layers), n = 0;
    if (!shapes.length) return "error:Selecione layers de shape.";
    for (var i = 0; i < shapes.length; i++) {
        var strokes = MPT.vectorItems(shapes[i].property("ADBE Root Vectors Group"), "ADBE Vector Graphic - Stroke", []);
        for (var j = 0; j < strokes.length; j++) {
            var tg = strokes[j].property("ADBE Vector Stroke Taper");
            tg.property("ADBE Vector Taper Start Length").setValue(a.startLen);
            tg.property("ADBE Vector Taper End Length").setValue(a.endLen);
            tg.property("ADBE Vector Taper Start Width").setValue(a.startW);
            tg.property("ADBE Vector Taper End Width").setValue(a.endW);
            n++;
        }
    }
    return n ? "ok:Afunilamento em " + n + " contorno(s)." : "error:As shapes n\u00e3o t\u00eam contorno (Stroke).";
};

// ---- Effects manager
MPT.fxLayers = function (scope, comp) {
    var out = [], i, j;
    if (scope === "selected") return comp ? comp.selectedLayers : [];
    if (scope === "comp") { if (comp) for (i = 1; i <= comp.numLayers; i++) out.push(comp.layer(i)); return out; }
    for (i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof CompItem) for (j = 1; j <= it.numLayers; j++) out.push(it.layer(j));
    }
    return out;
};
MPT.T.fxScan = function (a, comp) {
    var layers = MPT.fxLayers(a.scope, comp), map = {}, list = [], i, k;
    for (i = 0; i < layers.length; i++) {
        var fx = layers[i].property("ADBE Effect Parade");
        if (!fx) continue;
        for (k = 1; k <= fx.numProperties; k++) {
            var e = fx.property(k), m = e.matchName;
            if (!map[m]) map[m] = { match: m, name: e.name, count: 0, on: 0 };
            map[m].count++;
            if (e.enabled) map[m].on++;
        }
    }
    for (k in map) if (map.hasOwnProperty(k)) list.push(map[k]);
    list.sort(function (x, y) { return y.count - x.count; });
    return "json:" + MPT.json(list);
};
MPT.T.fxToggle = function (a, comp) {
    var layers = MPT.fxLayers(a.scope, comp), want = {}, n = 0, i, k;
    for (i = 0; i < a.matches.length; i++) want[a.matches[i]] = true;
    for (i = 0; i < layers.length; i++) {
        var fx = layers[i].property("ADBE Effect Parade");
        if (!fx) continue;
        for (k = 1; k <= fx.numProperties; k++) if (want[fx.property(k).matchName]) { fx.property(k).enabled = a.on; n++; }
    }
    return "ok:" + n + " efeito(s) " + (a.on ? "ativados" : "desativados") + ".";
};

// ---- Gradient
MPT.T.gradient = function (a, comp, layers) {
    var targets = [], i;
    for (i = 0; i < layers.length; i++) if (layers[i] instanceof AVLayer || layers[i] instanceof ShapeLayer || layers[i] instanceof TextLayer) targets.push(layers[i]);
    if (!targets.length) targets.push(comp.layers.addSolid([0, 0, 0], "MP Gradiente", comp.width, comp.height, comp.pixelAspect, comp.duration));
    for (i = 0; i < targets.length; i++) {
        var L = targets[i];
        var e = MPT.findEffect(L, MPT.TAG + "Gradiente", "ADBE Ramp", true);
        e = MPT.findEffect(L, MPT.TAG + "Gradiente", "ADBE Ramp", false);
        var w = L.width || comp.width, h = L.height || comp.height;
        var radial = a.shape === "radial";
        e.property(1).setValue(radial ? [w / 2, h / 2] : [0, h / 2]);
        e.property(2).setValue(MPT.hex(a.c1));
        e.property(3).setValue(radial ? [w, h / 2] : [w, h / 2]);
        e.property(4).setValue(MPT.hex(a.c2));
        e.property(5).setValue(radial ? 2 : 1);
        e.property(1).expression = ""; e.property(3).expression = "";
        if (a.animate && !radial) {
            MPT.slider(L, "Gradiente Velocidade", a.speed || 45);
            e = MPT.findEffect(L, MPT.TAG + "Gradiente", "ADBE Ramp", false);
            var base = 'var c = [thisLayer.width/2, thisLayer.height/2], ang = time*effect("MP Gradiente Velocidade")(1)*Math.PI/180, r = Math.max(thisLayer.width, thisLayer.height)/2;\n';
            e.property(1).expression = "// MP gradiente\n" + base + "sub(c, mul([Math.cos(ang), Math.sin(ang)], r))";
            e.property(3).expression = "// MP gradiente\n" + base + "add(c, mul([Math.cos(ang), Math.sin(ang)], r))";
        }
    }
    return "ok:Gradiente aplicado em " + targets.length + " layer(s).";
};

// ---- Expressions
MPT.T.exprApply = function (a, comp) {
    var props = MPT.selProps(comp), n = 0, err = "";
    for (var i = 0; i < props.length; i++) {
        if (!props[i].canSetExpression) continue;
        try { props[i].expression = a.code; n++; } catch (e) { err = e.toString(); }
        if (props[i].expressionError) err = props[i].expressionError;
    }
    if (!n) return "error:Selecione uma propriedade na timeline.";
    return err ? "error:Aplicada, mas com erro: " + err : "ok:Express\u00e3o aplicada em " + n + " propriedade(s).";
};
MPT.walkExpr = function (group, layer, out) {
    for (var i = 1; i <= group.numProperties; i++) {
        var p = group.property(i);
        if (p.propertyType === PropertyType.PROPERTY) {
            if (p.canSetExpression && p.expression !== "") out.push({ layer: layer.name, prop: p.name, code: p.expression.split("\n")[0].substr(0, 80), on: p.expressionEnabled });
        } else if (p.numProperties) MPT.walkExpr(p, layer, out);
    }
    return out;
};
MPT.T.exprScan = function (a, comp, layers) {
    var out = [], pool = layers.length ? layers : [], i;
    if (!pool.length) for (i = 1; i <= comp.numLayers; i++) pool.push(comp.layer(i));
    for (i = 0; i < pool.length; i++) MPT.walkExpr(pool[i], pool[i], out);
    return "json:" + MPT.json(out);
};
MPT.setExprEnabled = function (group, on) {
    var n = 0;
    for (var i = 1; i <= group.numProperties; i++) {
        var p = group.property(i);
        if (p.propertyType === PropertyType.PROPERTY) {
            if (p.canSetExpression && p.expression !== "") { p.expressionEnabled = on; n++; }
        } else if (p.numProperties) n += MPT.setExprEnabled(p, on);
    }
    return n;
};
MPT.T.exprToggle = function (a, comp, layers) {
    var n = 0, pool = layers.length ? layers : [], i;
    if (!pool.length) for (i = 1; i <= comp.numLayers; i++) pool.push(comp.layer(i));
    for (i = 0; i < pool.length; i++) n += MPT.setExprEnabled(pool[i], a.on);
    return "ok:" + n + " express\u00e3o(\u00f5es) " + (a.on ? "ativadas" : "desativadas") + ".";
};

// ---- Carousel (3D) and Orbit (2D)
MPT.T.carousel = function (a, comp, layers) {
    if (layers.length !== 1) return "error:Selecione exatamente 1 layer.";
    var src = layers[0];
    if (!MPT.isVisual(src)) return "error:Selecione uma layer visual.";
    var n = Math.max(2, Math.min(60, a.copies || 6)), threeD = a.mode !== "orbit";
    var r = a.radius || Math.round(comp.width * 0.3), i;
    var ctrl = comp.layers.addNull(comp.duration);
    ctrl.name = MPT.TAG + (threeD ? "Carrossel" : "\u00d3rbita");
    if (threeD) ctrl.threeDLayer = true;
    ctrl.moveBefore(src);
    MPT.tr(ctrl, "ADBE Position").setValue(threeD ? [comp.width / 2, comp.height / 2, 0] : [comp.width / 2, comp.height / 2]);
    MPT.slider(ctrl, "Velocidade", a.speed !== undefined ? a.speed : 30);
    MPT.tr(ctrl, threeD ? "ADBE Rotate Y" : "ADBE Rotate Z").expression = '// MP carrossel\nvalue + time*effect("MP Velocidade")(1)';
    var anc = MPT.tr(ctrl, "ADBE Anchor Point").value;
    var copies = [src];
    for (i = 1; i < n; i++) copies.push(src.duplicate());
    for (i = 0; i < n; i++) {
        var L = copies[i], th = (360 / n) * i, rad = th * Math.PI / 180;
        if (threeD) L.threeDLayer = true;
        L.parent = ctrl;
        MPT.moveAnchor(L, 0.5, 0.5, comp.time);
        var pos = MPT.tr(L, "ADBE Position");
        while (pos.numKeys) pos.removeKey(1);
        if (threeD) {
            pos.setValue([anc[0] + r * Math.sin(rad), anc[1], -r * Math.cos(rad)]);
            if (a.faceCam) MPT.tr(L, "ADBE Rotate Y").expression = "// MP carrossel\n-parent.transform.yRotation";
            else MPT.tr(L, "ADBE Rotate Y").setValue(-th);
            if (a.depthFade) MPT.tr(L, "ADBE Opacity").expression = "// MP carrossel\nvar z = toWorld(anchorPoint)[2];\nlinear(z, -" + r + ", " + r + ", value, value*0.25)";
        } else {
            pos.setValue([anc[0] + r * Math.cos(rad), anc[1] + r * Math.sin(rad)]);
            if (a.faceCam) MPT.tr(L, "ADBE Rotate Z").expression = "// MP carrossel\n-parent.transform.rotation";
        }
        if (a.bob) pos.expression = "// MP carrossel\nadd(value, [0, Math.sin(time*2 + " + i + ")*" + Math.round(r * 0.05) + "])";
        L.name = src.name + " " + (i + 1);
    }
    return "ok:" + (threeD ? "Carrossel 3D" : "\u00d3rbita 2D") + " com " + n + " c\u00f3pias criado.";
};

// ---- Easy Ease family on selected keyframes
MPT.T.easyEase = function (a, comp) {
    var props = MPT.selProps(comp), n = 0, i, j, d;
    for (i = 0; i < props.length; i++) {
        var p = props[i], sk = p.selectedKeys;
        for (j = 0; j < sk.length; j++) {
            var k = sk[j];
            if (a.mode === "linear") {
                p.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
                n++; continue;
            }
            var dims = p.keyInTemporalEase(k).length, easy = [];
            for (d = 0; d < dims; d++) easy.push(new KeyframeEase(0, 33.333));
            var inType = a.mode === "out" ? p.keyInInterpolationType(k) : KeyframeInterpolationType.BEZIER;
            var outType = a.mode === "in" ? p.keyOutInterpolationType(k) : KeyframeInterpolationType.BEZIER;
            p.setInterpolationTypeAtKey(k, inType, outType);
            p.setTemporalEaseAtKey(k, a.mode === "out" ? p.keyInTemporalEase(k) : easy, a.mode === "in" ? p.keyOutTemporalEase(k) : easy);
            n++;
        }
    }
    return n ? "ok:" + n + " keyframe(s) ajustados." : "error:Selecione keyframes na timeline.";
};

// ---- 3D camera rig: one-node camera parented to a 3D null target at the comp center.
MPT.cameraRig = function (comp) {
    var cam = null, tgt = null, i;
    for (i = 1; i <= comp.numLayers; i++) {
        var L = comp.layer(i);
        if (L instanceof CameraLayer && L.name === MPT.TAG + "C\u00e2mera") cam = L;
        if (L.name === MPT.TAG + "C\u00e2mera Alvo") tgt = L;
    }
    if (cam && tgt) return { cam: cam, tgt: tgt, created: false };
    tgt = comp.layers.addNull(comp.duration);
    tgt.name = MPT.TAG + "C\u00e2mera Alvo";
    tgt.threeDLayer = true;
    MPT.tr(tgt, "ADBE Position").setValue([comp.width / 2, comp.height / 2, 0]);
    cam = comp.layers.addCamera(MPT.TAG + "C\u00e2mera", [comp.width / 2, comp.height / 2]);
    cam.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
    var zoom = cam.property("ADBE Camera Options Group").property("ADBE Camera Zoom").value;
    cam.parent = tgt;
    var anc = MPT.tr(tgt, "ADBE Anchor Point").value;
    MPT.tr(cam, "ADBE Position").setValue([anc[0], anc[1], (anc[2] || 0) - zoom]);
    return { cam: cam, tgt: tgt, created: true };
};
MPT.key = function (prop, t, v, inf) {
    var k = prop.addKey(t);
    prop.setValueAtKey(k, v);
    if (!inf) { prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR); return; }
    var dims = prop.keyInTemporalEase(k).length, e = [];
    for (var d = 0; d < dims; d++) e.push(new KeyframeEase(0, inf));
    prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.BEZIER);
    prop.setTemporalEaseAtKey(k, e, e);
};
MPT.CAM_MOVES = {
    push: ["cam", "ADBE Position", [0, 0, 1]], pull: ["cam", "ADBE Position", [0, 0, -1]],
    truckL: ["tgt", "ADBE Position", [-1, 0, 0]], truckR: ["tgt", "ADBE Position", [1, 0, 0]],
    up: ["tgt", "ADBE Position", [0, -1, 0]], down: ["tgt", "ADBE Position", [0, 1, 0]],
    orbitL: ["tgt", "ADBE Rotate Y", 1], orbitR: ["tgt", "ADBE Rotate Y", -1],
    tiltUp: ["tgt", "ADBE Rotate X", 1], tiltDown: ["tgt", "ADBE Rotate X", -1],
    rollL: ["tgt", "ADBE Rotate Z", -1], rollR: ["tgt", "ADBE Rotate Z", 1],
    zoomIn: ["cam", "zoom", 1], zoomOut: ["cam", "zoom", -1]
};
// a: { moves: [{type, amount, dur(s)}], ease: "suave"|"forte"|"linear", from: "playhead"|"start" }
MPT.T.camera = function (a, comp) {
    var rig = MPT.cameraRig(comp), t = a.from === "start" ? 0 : comp.time, n = 0, i, d;
    var inf = { suave: 75, forte: 95, linear: 0 }[a.ease || "suave"];
    for (i = 0; i < a.moves.length; i++) {
        var mv = a.moves[i], dur = Math.max(comp.frameDuration, mv.dur || 1.5);
        if (mv.type === "hold") { t += dur; continue; }
        var spec = MPT.CAM_MOVES[mv.type];
        if (!spec) continue;
        var layer = spec[0] === "cam" ? rig.cam : rig.tgt;
        var prop = spec[1] === "zoom" ? layer.property("ADBE Camera Options Group").property("ADBE Camera Zoom") : MPT.tr(layer, spec[1]);
        var v0 = prop.valueAtTime(t, false), v1;
        if (spec[1] === "zoom") v1 = spec[2] > 0 ? v0 * (mv.amount || 1.4) : v0 / (mv.amount || 1.4);
        else if (v0 instanceof Array) {
            v1 = [];
            for (d = 0; d < v0.length; d++) v1.push(v0[d] + (spec[2][d] || 0) * mv.amount);
        } else v1 = v0 + spec[2] * mv.amount;
        MPT.key(prop, t, v0, inf);
        MPT.key(prop, t + dur, v1, inf);
        t += dur;
        n++;
    }
    return n ? "ok:" + n + " movimento(s) de c\u00e2mera criados" + (rig.created ? " (c\u00e2mera nova)." : ".") : "error:Nenhum movimento reconhecido.";
};
MPT.T.parallax = function (a, comp, layers) {
    var items = [], i;
    for (i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (L instanceof CameraLayer || L instanceof LightLayer || !MPT.isVisual(L)) continue;
        if (MPT.tr(L, "ADBE Position").dimensionsSeparated) continue;
        items.push(L);
    }
    if (!items.length) return "error:Selecione layers visuais.";
    MPT.sortByIndex(items);
    var rig = a.withCamera ? MPT.cameraRig(comp) : null;
    var zoom = rig ? rig.cam.property("ADBE Camera Options Group").property("ADBE Camera Zoom").value : comp.width * 1.38889;
    var n = items.length, sp = a.spacing || 300;
    for (i = 0; i < n; i++) {
        var X = items[i];
        X.threeDLayer = true;
        var z = -sp * ((n - 1) / 2 - i);
        var pos = MPT.tr(X, "ADBE Position"), v = pos.value, zOld = v.length > 2 ? v[2] : 0;
        if (pos.numKeys) { for (var k = 1; k <= pos.numKeys; k++) { var kv = pos.keyValue(k); pos.setValueAtKey(k, [kv[0], kv[1], z]); } }
        else pos.setValue([v[0], v[1], z]);
        if (a.compensate) {
            var f = (zoom + z) / (zoom + zOld), sc = MPT.tr(X, "ADBE Scale");
            if (!sc.numKeys) { var s = sc.value; sc.setValue([s[0] * f, s[1] * f, s.length > 2 ? s[2] : 100]); }
        }
    }
    var msg = n + " layer(s) distribu\u00eddas em profundidade";
    if (a.move && a.move !== "none") MPT.T.camera({ moves: [{ type: a.move, amount: a.amount || 400, dur: a.dur || 3 }], ease: "suave", from: "playhead" }, comp);
    return "ok:" + msg + (a.move && a.move !== "none" ? " com movimento de c\u00e2mera." : ".");
};

// ---- Overlays
MPT.topSolid = function (comp, col, name) {
    var L = comp.layers.addSolid(col, name, comp.width, comp.height, comp.pixelAspect, comp.duration);
    L.moveToBeginning();
    return L;
};
MPT.ellipseShape = function (cx, cy, rx, ry) {
    var k = 0.5523, s = new Shape();
    s.vertices = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]];
    s.inTangents = [[-rx * k, 0], [0, -ry * k], [rx * k, 0], [0, ry * k]];
    s.outTangents = [[rx * k, 0], [0, ry * k], [-rx * k, 0], [0, -ry * k]];
    s.closed = true;
    return s;
};
MPT.rectShape = function (x0, y0, x1, y1) {
    var s = new Shape();
    s.vertices = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    s.closed = true;
    return s;
};
MPT.addMask = function (L, shape, inverted, feather) {
    L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
    var m = L.property("ADBE Mask Parade").property(L.property("ADBE Mask Parade").numProperties);
    m.property("ADBE Mask Shape").setValue(shape);
    m.inverted = !!inverted;
    if (feather) m.property("ADBE Mask Feather").setValue([feather, feather]);
    return m;
};
MPT.T.overlay = function (a, comp) {
    var w = comp.width, h = comp.height, L;
    if (a.kind === "vignette") {
        L = MPT.topSolid(comp, [0, 0, 0], MPT.TAG + "Vinheta");
        MPT.addMask(L, MPT.ellipseShape(w / 2, h / 2, w * 0.56, h * 0.62), true, w * 0.22);
        MPT.tr(L, "ADBE Opacity").setValue(a.amount || 65);
    } else if (a.kind === "grain") {
        L = MPT.topSolid(comp, [0.5, 0.5, 0.5], MPT.TAG + "Gr\u00e3o");
        L.adjustmentLayer = true;
        L.property("ADBE Effect Parade").addProperty("ADBE Noise");
        L.property("ADBE Effect Parade").property(1).property(1).setValue(a.amount || 8);
    } else if (a.kind === "letterbox") {
        var ratio = a.ratio || 2.39, bar = Math.max(0, (h - w / ratio) / 2);
        L = MPT.topSolid(comp, [0, 0, 0], MPT.TAG + "Letterbox " + ratio + ":1");
        MPT.addMask(L, MPT.rectShape(-2, bar, w + 2, h - bar), true, 0);
    } else if (a.kind === "leak") {
        L = MPT.topSolid(comp, [0, 0, 0], MPT.TAG + "Light Leak");
        L.blendingMode = BlendingMode.SCREEN;
        var e = MPT.findEffect(L, MPT.TAG + "Leak", "ADBE Ramp", true);
        e = MPT.findEffect(L, MPT.TAG + "Leak", "ADBE Ramp", false);
        e.property(1).setValue([w * 0.15, h * 0.2]);
        e.property(2).setValue(MPT.hex(a.color || "#ff8a3d"));
        e.property(3).setValue([w * 0.75, h * 0.9]);
        e.property(4).setValue([0, 0, 0, 1]);
        e.property(5).setValue(2);
        e.property(1).expression = "// MP leak\nwiggle(0.4, thisComp.width * 0.18)";
        MPT.tr(L, "ADBE Opacity").expression = "// MP leak\nclamp(wiggle(0.6, 25), 0, 100)";
        MPT.tr(L, "ADBE Opacity").setValue(70);
    } else if (a.kind === "flash") {
        L = MPT.topSolid(comp, [1, 1, 1], MPT.TAG + "Flash");
        var op = MPT.tr(L, "ADBE Opacity"), fd = comp.frameDuration, t = comp.time;
        MPT.key(op, Math.max(0, t - 3 * fd), 0, 33);
        MPT.key(op, t, 100, 33);
        MPT.key(op, t + 8 * fd, 0, 70);
    } else return "error:overlay desconhecido";
    return "ok:" + L.name.replace(MPT.TAG, "") + " adicionado no topo da comp.";
};

// ---- One-click templates (each built in its own comp and placed at the playhead)
MPT.newComp = function (comp, name, dur) {
    var c = app.project.items.addComp(name, comp.width, comp.height, comp.pixelAspect, dur || 5, comp.frameRate);
    var L = comp.layers.add(c);
    L.startTime = comp.time;
    return c;
};
MPT.text = function (c, str, size, col, just, pos) {
    var T = c.layers.addText(str);
    var st = T.property("ADBE Text Properties").property("ADBE Text Document"), doc = st.value;
    doc.fontSize = size;
    doc.applyFill = true;
    doc.fillColor = col;
    doc.justification = just;
    st.setValue(doc);
    MPT.tr(T, "ADBE Position").setValue(pos);
    return T;
};
MPT.rectLayer = function (c, name, size, pos, col, anchorLeft) {
    var S = c.layers.addShape();
    S.name = name;
    S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    var g = function () { return S.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group"); };
    g().addProperty("ADBE Vector Shape - Rect");
    g().property(1).property("ADBE Vector Rect Size").setValue(size);
    g().property(1).property("ADBE Vector Rect Position").setValue(anchorLeft ? [size[0] / 2, 0] : [0, 0]);
    g().property(1).property("ADBE Vector Rect Roundness").setValue(Math.min(size[1] / 2, 8));
    g().addProperty("ADBE Vector Graphic - Fill");
    g().property(2).property("ADBE Vector Fill Color").setValue(col);
    MPT.tr(S, "ADBE Anchor Point").setValue([0, 0]);
    MPT.tr(S, "ADBE Position").setValue(pos);
    return S;
};
MPT.T.template = function (a, comp) {
    var w = comp.width, h = comp.height, fd = comp.frameDuration, c, T, S, ease = 85;
    var white = [1, 1, 1], accent = MPT.hex(a.color || "#0a84ff");
    if (a.kind === "lowerThird") {
        c = MPT.newComp(comp, MPT.TAG + "Lower Third", 6);
        var x = w * 0.07, y = h * 0.8, size = Math.round(h * 0.045);
        S = MPT.rectLayer(c, "Barra", [w * 0.34, size * 2.6], [x, y], accent, true);
        var sc = MPT.tr(S, "ADBE Scale");
        MPT.key(sc, 0, [0, 100], 15); MPT.key(sc, 14 * fd, [100, 100], ease);
        MPT.key(sc, 5 - 14 * fd, [100, 100], ease); MPT.key(sc, 5, [0, 100], 15);
        var lines = [[a.title || "Nome Sobrenome", size, white, -size * 0.15], [a.subtitle || "Cargo ou descri\u00e7\u00e3o", Math.round(size * 0.6), [0.92, 0.92, 0.96], size * 0.75]];
        for (var i = 0; i < lines.length; i++) {
            T = MPT.text(c, lines[i][0], lines[i][1], lines[i][2], ParagraphJustification.LEFT_JUSTIFY, [x + size * 0.6, y + lines[i][3]]);
            var op = MPT.tr(T, "ADBE Opacity"), ps = MPT.tr(T, "ADBE Position"), p = ps.value, t0 = (8 + i * 4) * fd;
            MPT.key(op, t0, 0, 33); MPT.key(op, t0 + 10 * fd, 100, ease);
            MPT.key(ps, t0, [p[0] - 40, p[1]], 15); MPT.key(ps, t0 + 14 * fd, p, ease);
            MPT.key(op, 5 - 12 * fd, 100, 33); MPT.key(op, 5 - 4 * fd, 0, 33);
        }
    } else if (a.kind === "title") {
        c = MPT.newComp(comp, MPT.TAG + "T\u00edtulo", 5);
        var fs = Math.round(h * 0.09);
        T = MPT.text(c, a.title || "Seu T\u00edtulo", fs, white, ParagraphJustification.CENTER_JUSTIFY, [w / 2, h / 2]);
        if (typeof MP !== "undefined" && MP.textAnimator) {
            MP.textAnimator(T, MPT.TAG + "Text In", { "ADBE Text Opacity": 0, "ADBE Text Position 3D": [0, fs * 0.5, 0] }, 1, 2, false, "offset", 35,
                { mode: "in", start: 0.15, dur: 1.1, ease: [85, 12], linear: false });
        }
        S = MPT.rectLayer(c, "Linha", [w * 0.22, Math.max(4, h * 0.006)], [w / 2, h / 2 + fs * 0.45], accent, false);
        var ls = MPT.tr(S, "ADBE Scale");
        MPT.key(ls, 0.3, [0, 100], 15); MPT.key(ls, 1.1, [100, 100], ease);
    } else if (a.kind === "countdown") {
        var n = Math.max(1, Math.min(60, a.from || 3));
        c = MPT.newComp(comp, MPT.TAG + "Contagem " + n, n);
        var big = Math.round(h * 0.28);
        T = MPT.text(c, String(n), big, white, ParagraphJustification.CENTER_JUSTIFY, [w / 2, h / 2 + big * 0.35]);
        T.property("ADBE Text Properties").property("ADBE Text Document").expression = "// MP contagem\nMath.max(1, Math.ceil(" + n + " - time))";
        MPT.tr(T, "ADBE Scale").expression = "// MP contagem\nvar t = time % 1, s = 100 + 35 * Math.exp(-t * 7) * Math.cos(t * 18);\n[s, s]";
        MPT.tr(T, "ADBE Opacity").expression = "// MP contagem\nlinear(time % 1, 0.8, 1, 100, 0)";
        var ring = c.layers.addShape();
        ring.name = "Anel";
        ring.property("ADBE Root Vectors Group").addProperty("ADBE Vector Shape - Ellipse");
        ring.property("ADBE Root Vectors Group").property(1).property("ADBE Vector Ellipse Size").setValue([big * 1.6, big * 1.6]);
        ring.property("ADBE Root Vectors Group").addProperty("ADBE Vector Graphic - Stroke");
        var stroke = ring.property("ADBE Root Vectors Group").property(2);
        stroke.property("ADBE Vector Stroke Color").setValue(accent);
        stroke.property("ADBE Vector Stroke Width").setValue(Math.max(6, big * 0.06));
        stroke.property("ADBE Vector Stroke Line Cap").setValue(2);
        ring.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Trim");
        ring.property("ADBE Root Vectors Group").property(3).property("ADBE Vector Trim End").expression = "// MP contagem\n(1 - time % 1) * 100";
        MPT.tr(ring, "ADBE Position").setValue([w / 2, h / 2]);
        MPT.tr(ring, "ADBE Rotate Z").setValue(0);
    } else return "error:modelo desconhecido";
    return "ok:Modelo \u201c" + c.name.replace(MPT.TAG, "") + "\u201d criado no playhead (edite os textos dentro da precomp).";
};

// ============================================================ shortcuts (Atalhos)
MPT.LABELS = { text: 5, shape: 3, solid: 2, adj: 15, precomp: 9, video: 4, image: 6, audio: 11, nul: 1, camera: 14 };
MPT.kindOf = function (L) {
    if (L instanceof CameraLayer || L instanceof LightLayer) return "camera";
    if (L instanceof TextLayer) return "text";
    if (L instanceof ShapeLayer) return "shape";
    if (L.nullLayer) return "nul";
    if (L.adjustmentLayer) return "adj";
    if (L.source instanceof CompItem) return "precomp";
    if (L.source && L.source.mainSource instanceof SolidSource) return "solid";
    if (L.hasAudio && !L.hasVideo) return "audio";
    if (L.source && L.source.mainSource && L.source.mainSource.isStill) return "image";
    return "video";
};
MPT.T.organizeLayers = function (a, comp, layers) {
    var pool = layers.length ? layers : [], i, n = 0;
    if (!pool.length) for (i = 1; i <= comp.numLayers; i++) pool.push(comp.layer(i));
    for (i = 0; i < pool.length; i++) { try { pool[i].label = MPT.LABELS[MPT.kindOf(pool[i])]; n++; } catch (e) {} }
    return "ok:" + n + " layer(s) coloridas por tipo (texto, shape, precomp, v\u00eddeo, \u00e1udio\u2026).";
};
MPT.T.toggle3D = function (a, comp, layers) {
    var on = !layers[0].threeDLayer, n = 0;
    for (var i = 0; i < layers.length; i++) { try { layers[i].threeDLayer = on; n++; } catch (e) {} }
    return "ok:3D " + (on ? "ligado" : "desligado") + " em " + n + " layer(s).";
};
MPT.T.purgeCache = function () {
    app.purge(PurgeTarget.ALL_CACHES);
    return "ok:Cache de mem\u00f3ria e de disco limpos.";
};
MPT.T.reverseKeys = function (a, comp) {
    var props = MPT.selProps(comp), n = 0, i, j;
    for (i = 0; i < props.length; i++) {
        var p = props[i], idx = [];
        if (p.numKeys < 2) continue;
        var sk = p.selectedKeys;
        if (sk.length >= 2) idx = sk.slice(0); else for (j = 1; j <= p.numKeys; j++) idx.push(j);
        var t0 = p.keyTime(idx[0]), t1 = p.keyTime(idx[idx.length - 1]), data = [];
        for (j = 0; j < idx.length; j++) {
            var k = idx[j];
            data.push({ t: t0 + t1 - p.keyTime(k), v: p.keyValue(k), ii: p.keyOutInterpolationType(k), oi: p.keyInInterpolationType(k),
                ie: p.keyOutTemporalEase(k), oe: p.keyInTemporalEase(k) });
        }
        for (j = idx.length - 1; j >= 0; j--) p.removeKey(idx[j]);
        for (j = 0; j < data.length; j++) {
            var nk = p.addKey(data[j].t);
            p.setValueAtKey(nk, data[j].v);
            p.setInterpolationTypeAtKey(nk, data[j].ii, data[j].oi);
            if (data[j].ii === KeyframeInterpolationType.BEZIER || data[j].oi === KeyframeInterpolationType.BEZIER) {
                try { p.setTemporalEaseAtKey(nk, data[j].ie, data[j].oe); } catch (e) {}
            }
        }
        n++;
    }
    return n ? "ok:Keyframes invertidos em " + n + " propriedade(s)." : "error:Selecione propriedades (ou keyframes) com 2+ keyframes.";
};
MPT.T.lightSweep = function (a, comp, layers) {
    var n = 0, fd = comp.frameDuration;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!MPT.isVisual(L)) continue;
        var e = MPT.findEffect(L, MPT.TAG + "Light Sweep", "CC Light Sweep", true);
        if (!e) return "error:O efeito CC Light Sweep n\u00e3o est\u00e1 dispon\u00edvel.";
        e = MPT.findEffect(L, MPT.TAG + "Light Sweep", "CC Light Sweep", false);
        var r = L.sourceRectAtTime(comp.time, false), c = e.property(1), y = r.top + r.height / 2, t = comp.time;
        while (c.numKeys) c.removeKey(1);
        MPT.key(c, t, [r.left - r.width * 0.4, y], 60);
        MPT.key(c, t + (a.frames || 24) * fd, [r.left + r.width * 1.4, y], 60);
        n++;
    }
    return "ok:Light Sweep no playhead em " + n + " layer(s).";
};
MPT.T.glitchFx = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!MPT.isVisual(L)) continue;
        MPT.slider(L, "Glitch Chance %", a.chance || 18);
        MPT.slider(L, "Glitch FPS", a.fps || 12);
        var e = MPT.findEffect(L, MPT.TAG + "Glitch", "ADBE Turbulent Displace", true);
        e = MPT.findEffect(L, MPT.TAG + "Glitch", "ADBE Turbulent Displace", false);
        e.property(2).expression = '// MP glitch\nposterizeTime(effect("MP Glitch FPS")(1));\nrandom() * 100 < effect("MP Glitch Chance %")(1) ? random(40, 160) : 0';
        e.property(3).expression = "// MP glitch\nposterizeTime(12);\nrandom(15, 120)";
        MPT.tr(L, "ADBE Position").expression = '// MP glitch\nposterizeTime(effect("MP Glitch FPS")(1));\nrandom() * 100 < effect("MP Glitch Chance %")(1) / 2 ? add(value, [random(-25, 25), 0]) : value';
        n++;
    }
    return "ok:Glitch cont\u00ednuo em " + n + " layer(s) (ajuste nos sliders MP).";
};
MPT.T.turbulence = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!MPT.isVisual(L)) continue;
        var e = MPT.findEffect(L, MPT.TAG + "Turbul\u00eancia", "ADBE Turbulent Displace", true);
        e = MPT.findEffect(L, MPT.TAG + "Turbul\u00eancia", "ADBE Turbulent Displace", false);
        e.property(2).setValue(a.amount || 30);
        var evo = null;
        try { evo = e.property("Evolution"); } catch (x) {}
        if (!evo) evo = e.property(6);
        evo.expression = "// MP turbulencia\ntime * " + (a.speed || 120);
        n++;
    }
    return "ok:Turbul\u00eancia animada em " + n + " layer(s).";
};
MPT.T.chromaKey = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!(L instanceof AVLayer)) continue;
        var e = MPT.findEffect(L, MPT.TAG + "Chroma", "Keylight 906", true);
        if (!e) e = MPT.findEffect(L, MPT.TAG + "Chroma", "ADBE Color Key", true);
        if (!e) return "error:Keylight n\u00e3o est\u00e1 dispon\u00edvel.";
        e = MPT.findEffect(L, MPT.TAG + "Chroma", e.matchName, false);
        try { e.property("Screen Colour").setValue(MPT.hex(a.color || "#00b140")); } catch (x) { try { e.property(1).setValue(MPT.hex(a.color || "#00b140")); } catch (y) {} }
        n++;
    }
    return n ? "ok:Chroma key em " + n + " layer(s); refine no Keylight." : "error:Selecione layers de v\u00eddeo ou imagem.";
};
MPT.T.infiniteScroll = function (a, comp, layers) {
    var n = 0;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!MPT.isVisual(L)) continue;
        MPT.slider(L, "Esteira Vel X", a.vx !== undefined ? a.vx : 120);
        MPT.slider(L, "Esteira Vel Y", a.vy || 0);
        var e = MPT.findEffect(L, MPT.TAG + "Esteira", "ADBE Tile", true);
        e = MPT.findEffect(L, MPT.TAG + "Esteira", "ADBE Tile", false);
        e.property(4).setValue(300);
        e.property(5).setValue(300);
        e.property(1).expression = '// MP esteira\nadd(value, mul([effect("MP Esteira Vel X")(1), effect("MP Esteira Vel Y")(1)], time - inPoint))';
        n++;
    }
    return "ok:Esteira infinita em " + n + " layer(s).";
};
MPT.T.infiniteVideo = function (a, comp, layers) {
    var n = 0, fd = comp.frameDuration;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!(L instanceof AVLayer) || !L.canSetTimeRemapEnabled) continue;
        var src = L.source.duration;
        L.timeRemapEnabled = true;
        var tr = L.property("ADBE Time Remapping");
        while (tr.numKeys > 1) tr.removeKey(tr.numKeys);
        var k = tr.addKey(L.startTime + src - fd);
        tr.setValueAtKey(k, src - fd);
        tr.expression = '// MP video infinito\nloopOut("cycle")';
        L.outPoint = comp.duration;
        n++;
    }
    return n ? "ok:V\u00eddeo em loop at\u00e9 o fim da comp em " + n + " layer(s)." : "error:Selecione layers de v\u00eddeo ou precomp.";
};
MPT.T.fadeAudio = function (a, comp, layers) {
    var n = 0, fd = comp.frameDuration, fi = (a.fadeIn || 15) * fd, fo = (a.fadeOut || 30) * fd;
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!L.hasAudio) continue;
        var lv = L.property("ADBE Audio Group").property("ADBE Audio Levels"), v = lv.value;
        while (lv.numKeys) lv.removeKey(1);
        if (fi > 0) { MPT.key(lv, L.inPoint, [-48, -48], 33); MPT.key(lv, L.inPoint + fi, v, 33); }
        if (fo > 0) { MPT.key(lv, L.outPoint - fo, v, 33); MPT.key(lv, L.outPoint, [-48, -48], 33); }
        n++;
    }
    return n ? "ok:Fade de \u00e1udio em " + n + " layer(s)." : "error:Selecione layers com \u00e1udio.";
};
MPT.T.fadeFinal = function (a, comp) {
    var fd = comp.frameDuration, end = comp.workAreaStart + comp.workAreaDuration, d = (a.frames || 20) * fd;
    var L = MPT.topSolid(comp, MPT.hex(a.color || "#000000").slice(0, 3), MPT.TAG + "Fade final");
    var op = MPT.tr(L, "ADBE Opacity");
    MPT.key(op, end - d, 0, 33);
    MPT.key(op, end, 100, 70);
    return "ok:Fade final nos \u00faltimos " + (a.frames || 20) + " frames da \u00e1rea de trabalho.";
};

// ---- audio beats: convert audio to keyframes, find peaks, add markers
MPT.amplitudeLayer = function (comp, audio) {
    for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === MPT.TAG + "Amplitude") return comp.layer(i);
    if (!audio) return null;
    for (i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    audio.selected = true;
    var before = comp.numLayers, id = 0;
    try { id = app.findMenuCommandId("Convert Audio to Keyframes"); } catch (e) {}
    app.executeCommand(id || 5015);
    if (comp.numLayers === before) return null;
    var amp = comp.layer(1);
    amp.name = MPT.TAG + "Amplitude";
    amp.shy = true;
    return amp;
};
MPT.audioOf = function (layers) {
    for (var i = 0; i < layers.length; i++) if (layers[i].hasAudio && !layers[i].hasVideo) return layers[i];
    for (i = 0; i < layers.length; i++) if (layers[i].hasAudio) return layers[i];
    return null;
};
MPT.T.markBeats = function (a, comp, layers) {
    var audio = MPT.audioOf(layers);
    if (!audio) return "error:Selecione a layer de \u00e1udio (m\u00fasica).";
    var amp = MPT.amplitudeLayer(comp, audio);
    if (!amp) return "error:N\u00e3o consegui converter o \u00e1udio em keyframes.";
    var s = amp.property("ADBE Effect Parade").property(amp.property("ADBE Effect Parade").numProperties).property(1);
    var vals = [], max = 0, i;
    for (i = 1; i <= s.numKeys; i++) { var v = s.keyValue(i); vals.push([s.keyTime(i), v]); if (v > max) max = v; }
    var thr = max * (a.sensitivity ? (1 - a.sensitivity / 100) : 0.6), gap = (a.gap || 8) * comp.frameDuration, last = -1e9, n = 0;
    var mk = audio.property("ADBE Marker");
    for (i = 1; i < vals.length - 1; i++) {
        if (vals[i][1] >= thr && vals[i][1] >= vals[i - 1][1] && vals[i][1] > vals[i + 1][1] && vals[i][0] - last >= gap) {
            mk.setValueAtTime(vals[i][0], new MarkerValue("batida"));
            last = vals[i][0]; n++;
        }
    }
    return "ok:" + n + " batida(s) marcadas na layer \u201c" + audio.name + "\u201d.";
};
MPT.T.reactBeat = function (a, comp, layers) {
    var audio = MPT.audioOf(layers), amp = MPT.amplitudeLayer(comp, audio);
    if (!amp) return "error:Selecione a m\u00fasica junto com as layers que v\u00e3o reagir.";
    var fx = amp.property("ADBE Effect Parade"), s = fx.property(fx.numProperties).property(1), max = 0, i, n = 0;
    for (i = 1; i <= s.numKeys; i++) max = Math.max(max, s.keyValue(i));
    var ref = 'thisComp.layer("' + amp.name + '").effect(' + fx.numProperties + ')(1)';
    for (i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (L === audio || L === amp || !MPT.isVisual(L) || (L.hasAudio && !L.hasVideo)) continue;
        MPT.slider(L, "Batida Intensidade", a.amount || 15);
        MPT.tr(L, "ADBE Scale").expression = "// MP batida\nvar a = " + ref + ";\nvar s = linear(a, " + (max * 0.35).toFixed(2) + ", " + max.toFixed(2) + ', 0, effect("MP Batida Intensidade")(1));\nvalue.length > 2 ? add(value, [s, s, 0]) : add(value, [s, s])';
        n++;
    }
    return n ? "ok:" + n + " layer(s) reagindo \u00e0 batida (slider MP Batida Intensidade)." : "error:Selecione tamb\u00e9m as layers que v\u00e3o reagir.";
};

// ---- Stories <-> Feed: duplicate the comp in a new size and reframe with a null
MPT.T.convertFormat = function (a, comp) {
    var nc = comp.duplicate(), ow = comp.width, oh = comp.height, i;
    nc.name = comp.name + " " + a.label;
    nc.width = a.w; nc.height = a.h;
    var nl = nc.layers.addNull(nc.duration);
    nl.name = MPT.TAG + "Reenquadrar";
    MPT.tr(nl, "ADBE Position").setValue([ow / 2, oh / 2]);
    for (i = 2; i <= nc.numLayers; i++) {
        var L = nc.layer(i);
        if (!L.parent && !(L instanceof CameraLayer)) L.parent = nl;
    }
    var f = (a.mode === "fill" ? Math.max(a.w / ow, a.h / oh) : Math.min(a.w / ow, a.h / oh)) * 100;
    MPT.tr(nl, "ADBE Position").setValue([a.w / 2, a.h / 2]);
    MPT.tr(nl, "ADBE Scale").setValue([f, f]);
    nc.openInViewer();
    return "ok:Comp \u201c" + nc.name + "\u201d criada em " + a.w + "\u00d7" + a.h + " (ajuste pelo null MP Reenquadrar).";
};

// ---- Curves: read the ease of the first selected segment as a cubic-bezier
MPT.T.bezierRead = function (a, comp) {
    var props = MPT.selProps(comp);
    for (var i = 0; i < props.length; i++) {
        var p = props[i], sk = p.selectedKeys;
        for (var j = 0; j < sk.length - 1; j++) {
            var k1 = sk[j], k2 = sk[j + 1];
            if (k2 !== k1 + 1) continue;
            var dt = p.keyTime(k2) - p.keyTime(k1), v1 = p.keyValue(k1), v2 = p.keyValue(k2), dv;
            if (v1 instanceof Array) { var s = 0; for (var d = 0; d < v1.length; d++) s += (v2[d] - v1[d]) * (v2[d] - v1[d]); dv = Math.sqrt(s); }
            else dv = Math.abs(v2 - v1);
            var avg = dv / dt, oe = p.keyOutTemporalEase(k1)[0], ie = p.keyInTemporalEase(k2)[0];
            var x1 = oe.influence / 100, x2 = 1 - ie.influence / 100;
            var y1 = avg ? x1 * Math.abs(oe.speed) / avg : 0, y2 = avg ? 1 - (1 - x2) * Math.abs(ie.speed) / avg : 1;
            return "json:" + MPT.json([x1, y1, x2, y2]);
        }
    }
    return "error:Selecione 2 keyframes vizinhos na timeline.";
};

// ============================================================ glow (own implementation, built from native effects)
// Control map (Deep-Glow-style controls, approximated with native AE effects):
//   Raio / Exposi\u00e7\u00e3o / Espalhamento / Camadas -> N stacked "ADBE Glo2": radius doubles per step, intensity = 2^exp * spread^k
//   Limiar + Suavizar limiar -> each step's threshold is lowered progressively (soft knee)
//   Propor\u00e7\u00e3o + \u00c2ngulo       -> Transform effects squash/rotate before the stack and undo it after (anisotropic glow)
//   Tingir                   -> Glow colors A&B from one color control
//   Aberra\u00e7\u00e3o crom\u00e1tica      -> Channel Blur with different red/blue amounts after the stack
//   Dither                   -> very light Noise to break banding
//   Blending linear          -> project linear blending (gamma-correct compositing)
//   Fundo preto (Unmult)     -> layer blending mode Screen
MPT.GLOW_RE = /^MP Glow/;
// Runs a risky parameter edit; on failure it records a warning instead of aborting the whole tool.
MPT.attempt = function (warn, label, fn) {
    try { fn(); } catch (e) { warn.push(label + ": " + e.toString()); }
};
MPT.T.physGlow = function (a, comp, layers) {
    var n = 0, N = Math.max(2, Math.min(10, a.steps || 6)), i, k, warn = [];
    var useXf = (a.aspect && Math.abs(a.aspect - 1) > 0.001) || (a.angle && a.angle % 360 !== 0);
    if (a.linear !== undefined) { try { app.project.linearBlending = !!a.linear; } catch (e) {} }
    for (i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!MPT.isVisual(L)) continue;
        var fx = L.property("ADBE Effect Parade");
        for (k = fx.numProperties; k >= 1; k--) if (MPT.GLOW_RE.test(fx.property(k).name)) fx.property(k).remove();

        MPT.slider(L, "Glow - Raio", a.radius || 12);
        MPT.slider(L, "Glow - Exposicao", a.exposure || 0);
        MPT.slider(L, "Glow - Limiar %", a.threshold !== undefined ? a.threshold : 55);
        MPT.slider(L, "Glow - Suavizar %", a.smooth !== undefined ? a.smooth : 20);
        MPT.slider(L, "Glow - Espalhamento", a.spread || 0.62);
        MPT.slider(L, "Glow - Proporcao", a.aspect || 1);
        MPT.slider(L, "Glow - Angulo", a.angle || 0);
        MPT.slider(L, "Glow - Aberracao", a.ca || 0);
        MPT.findEffect(L, MPT.TAG + "Glow - Cor", "ADBE Color Control", true);
        MPT.findEffect(L, MPT.TAG + "Glow - Cor", "ADBE Color Control", false).property(1).setValue(MPT.hex(a.color || "#ffffff"));
        var S = function (name) { return 'effect("MP Glow - ' + name + '")(1)'; };

        var xf = function (name, rotExpr, widthExpr) {
            MPT.findEffect(L, MPT.TAG + name, "ADBE Geometry2", true);
            var t = MPT.findEffect(L, MPT.TAG + name, "ADBE Geometry2", false);
            if (rotExpr) MPT.attempt(warn, name + " rotacao", function () { t.property(8).expression = "// MP glow\n" + rotExpr; });
            if (widthExpr) MPT.attempt(warn, name + " escala", function () { t.property(3).setValue(0); t.property(5).expression = "// MP glow\n" + widthExpr; });
        };
        if (useXf) {
            xf("Glow Pre Rotacao", "-" + S("Angulo"), null);
            xf("Glow Pre Escala", null, "100 / Math.max(0.05, " + S("Proporcao") + ")");
        }
        for (k = 0; k < N; k++) {
            var name = MPT.TAG + "Glow " + (k + 1);
            MPT.findEffect(L, name, "ADBE Glo2", true);
            var g = MPT.findEffect(L, name, "ADBE Glo2", false);
            var thr = "// MP glow\nclamp(" + S("Limiar %") + " - " + S("Suavizar %") + " * " + (N > 1 ? (k / (N - 1)).toFixed(4) : "0") + ", 0, 100)";
            var rad = "// MP glow\n" + S("Raio") + " * Math.pow(2, " + k + ")";
            var inten = "// MP glow\nMath.pow(2, " + S("Exposicao") + ") * Math.pow(" + S("Espalhamento") + ", " + k + ")";
            MPT.attempt(warn, "limiar", function () { g.property(2).expression = thr; });
            MPT.attempt(warn, "raio", function () { g.property(3).expression = rad; });
            MPT.attempt(warn, "intensidade", function () { g.property(4).expression = inten; });
            if (a.mode === "screen") MPT.attempt(warn, "modo", function () { g.property(6).setValue(5); });
            if (a.tint) MPT.attempt(warn, "tingir", function () {
                g.property(7).setValue(2);
                g.property(12).expression = '// MP glow\neffect("MP Glow - Cor")(1)';
                g.property(13).expression = '// MP glow\neffect("MP Glow - Cor")(1)';
            });
        }
        if (useXf) {
            xf("Glow Pos Escala", null, "100 * Math.max(0.05, " + S("Proporcao") + ")");
            xf("Glow Pos Rotacao", S("Angulo"), null);
        }
        if (a.ca > 0) {
            MPT.findEffect(L, MPT.TAG + "Glow Aberracao", "ADBE Channel Blur", true);
            var cb = MPT.findEffect(L, MPT.TAG + "Glow Aberracao", "ADBE Channel Blur", false);
            MPT.attempt(warn, "aberracao", function () {
                cb.property(1).expression = "// MP glow\n" + S("Aberracao");
                cb.property(3).expression = "// MP glow\n" + S("Aberracao") + " * 2";
            });
        }
        if (a.dither) {
            MPT.findEffect(L, MPT.TAG + "Glow Dither", "ADBE Noise", true);
            MPT.attempt(warn, "dither", function () { MPT.findEffect(L, MPT.TAG + "Glow Dither", "ADBE Noise", false).property(1).setValue(0.6); });
        }
        if (a.unmult) { try { L.blendingMode = BlendingMode.SCREEN; } catch (e) {} }
        n++;
    }
    if (!n) return "error:Selecione layers visuais.";
    return "ok:Glow (" + N + " camadas) em " + n + " layer(s)." + (warn.length ? " Avisos: " + warn.slice(0, 3).join("; ") : " Ajuste nos sliders \u201cMP Glow -\u201d; reaplicar substitui.");
};

// ============================================================ solid / gradient layers (Shape tab)
MPT.T.compInfo = function (a, comp) {
    return "json:" + MPT.json({ w: comp.width, h: comp.height, name: comp.name });
};
// Full-comp shape layer with a solid fill (color + opacity stay editable in the layer's Contents).
MPT.T.solidLayer = function (a, comp, layers) {
    var S = comp.layers.addShape();
    S.name = MPT.TAG + (a.name || "S\u00f3lido");
    S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Shape - Rect");
    S.property("ADBE Root Vectors Group").property(1).property("ADBE Vector Rect Size").setValue([comp.width, comp.height]);
    S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Graphic - Fill");
    var fill = S.property("ADBE Root Vectors Group").property(2);
    fill.property("ADBE Vector Fill Color").setValue(MPT.hex(a.color || "#000000"));
    fill.property("ADBE Vector Fill Opacity").setValue(Math.max(0, Math.min(100, a.opacity === undefined ? 100 : a.opacity)));
    MPT.tr(S, "ADBE Anchor Point").setValue([0, 0]);
    MPT.tr(S, "ADBE Position").setValue([comp.width / 2, comp.height / 2]);
    if (layers.length) S.moveBefore(layers[0]);
    return "ok:Camada s\u00f3lida criada (cor e opacidade edit\u00e1veis em Conte\u00fado \u203a Preenchimento).";
};
// Imports a gradient PNG rendered by the panel and places it as a layer covering the comp.
MPT.T.importGradient = function (a, comp, layers) {
    var f = new File(a.path);
    if (!f.exists) return "error:Arquivo do gradiente n\u00e3o encontrado: " + a.path;
    var item = app.project.importFile(new ImportOptions(f));
    item.name = a.name || item.name;
    var L = comp.layers.add(item);
    L.name = MPT.TAG + "Gradiente";
    if (item.width && item.height) {
        var sx = comp.width / item.width * 100, sy = comp.height / item.height * 100;
        MPT.tr(L, "ADBE Scale").setValue([sx, sy]);
    }
    MPT.tr(L, "ADBE Position").setValue([comp.width / 2, comp.height / 2]);
    if (layers.length) L.moveBefore(layers[0]);
    return "ok:Gradiente criado como layer (" + item.width + "\u00d7" + item.height + ").";
};

// ============================================================ expression assistant: apply to a chosen property
MPT.EXPR_TARGETS = { position: "ADBE Position", scale: "ADBE Scale", rotation: "ADBE Rotate Z", opacity: "ADBE Opacity" };
MPT.T.exprApplyTo = function (a, comp, layers) {
    if (a.target === "selected" || !a.target) return MPT.T.exprApply(a, comp);
    var n = 0, err = "";
    for (var i = 0; i < layers.length; i++) {
        var L = layers[i], p = null;
        if (a.target === "sourceText") {
            if (!(L instanceof TextLayer)) continue;
            p = L.property("ADBE Text Properties").property("ADBE Text Document");
        } else {
            var tg = L.property("ADBE Transform Group");
            if (!tg) continue;
            p = tg.property(MPT.EXPR_TARGETS[a.target]);
            if (a.target === "position" && p.dimensionsSeparated) { err = "posi\u00e7\u00e3o com dimens\u00f5es separadas"; continue; }
        }
        if (!p || !p.canSetExpression) continue;
        p.expression = a.code;
        if (p.expressionError) err = p.expressionError;
        n++;
    }
    if (!n) return "error:" + (a.target === "sourceText" ? "Selecione uma layer de texto." : "Selecione layers compat\u00edveis" + (err ? " (" + err + ")" : "") + ".");
    return err ? "error:Aplicada em " + n + " layer(s), mas com erro: " + err : "ok:Express\u00e3o aplicada em " + n + " layer(s).";
};

// ============================================================ quick search (Busca)
// Every installed effect (display name, match name, category). Hidden effects have no category.
MPT.T.listEffects = function () {
    var out = [], fx = app.effects;
    for (var i = 0; i < fx.length; i++) {
        var e = fx[i];
        if (!e.category || !e.displayName) continue;
        out.push({ n: e.displayName, m: e.matchName, c: e.category });
    }
    return "json:" + MPT.json(out);
};
// Animation presets (.ffx): the user's "User Presets" plus the presets shipped with After Effects.
MPT.presetFolders = function () {
    var v = String(app.version).match(/^(\d+\.\d+)/), list = [];
    var ver = v ? v[1] : "";
    list.push([Folder.myDocuments.fsName + "/Adobe/After Effects " + ver + "/User Presets", "User Presets"]);
    try { list.push([Folder.appPackage.fsName + "/Presets", "Presets"]); } catch (e) {}
    try { list.push([Folder.appPackage.parent.fsName + "/Presets", "Presets"]); } catch (e2) {}
    return list;
};
MPT.collectFfx = function (folder, label, out, depth) {
    if (!folder.exists || depth > 6 || out.length > 4000) return;
    var items = folder.getFiles();
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it instanceof Folder) MPT.collectFfx(it, label + " / " + decodeURI(it.name), out, depth + 1);
        else if (/\.ffx$/i.test(it.name)) out.push({ n: decodeURI(it.name).replace(/\.ffx$/i, ""), p: it.fsName, c: label });
    }
};
MPT.T.listPresets = function () {
    var out = [], seen = {}, roots = MPT.presetFolders();
    for (var i = 0; i < roots.length; i++) {
        var f = new Folder(roots[i][0]);
        if (!f.exists || seen[f.fsName]) continue;
        seen[f.fsName] = true;
        MPT.collectFfx(f, roots[i][1], out, 0);
    }
    return "json:" + MPT.json(out);
};
MPT.T.addEffect = function (a, comp, layers) {
    var n = 0, name = a.name || a.match;
    for (var i = 0; i < layers.length; i++) {
        var fx = layers[i].property("ADBE Effect Parade");
        if (!fx) continue;
        if (fx.canAddProperty(a.match)) { fx.addProperty(a.match); n++; }
        else if (a.alt && fx.canAddProperty(a.alt)) { fx.addProperty(a.alt); n++; }
    }
    return n ? "ok:" + name + " aplicado em " + n + " layer(s)." : "error:" + name + " n\u00e3o pode ser aplicado nessas layers.";
};
MPT.T.applyPresetFile = function (a, comp, layers) {
    var f = new File(a.path), n = 0;
    if (!f.exists) return "error:Preset n\u00e3o encontrado: " + a.path;
    for (var i = 0; i < layers.length; i++) { layers[i].applyPreset(f); n++; }
    return "ok:Preset \u201c" + (a.name || f.name) + "\u201d aplicado em " + n + " layer(s).";
};

// ============================================================ camera FX (on the MP camera rig)
MPT.camProps = function (rig) {
    var o = rig.cam.property("ADBE Camera Options Group");
    return { pos: MPT.tr(rig.cam, "ADBE Position"), zoom: o.property("ADBE Camera Zoom"), dof: o.property("ADBE Camera Depth of Field"),
             focus: o.property("ADBE Camera Focus Distance"), aperture: o.property("ADBE Camera Aperture"),
             tpos: MPT.tr(rig.tgt, "ADBE Position"), rx: MPT.tr(rig.tgt, "ADBE Rotate X"), ry: MPT.tr(rig.tgt, "ADBE Rotate Y"), rz: MPT.tr(rig.tgt, "ADBE Rotate Z") };
};
MPT.addZ = function (v, dz) { return [v[0], v[1], v[2] + dz]; };
MPT.addX = function (v, dx) { return [v[0] + dx, v[1], v[2]]; };
MPT.T.camFx = function (a, comp, layers) {
    var rig = MPT.cameraRig(comp), P = MPT.camProps(rig), t = comp.time, d = a.dur || 2, amt = a.amount;
    var z0 = P.pos.valueAtTime(t, false);
    if (a.kind === "dolly") {
        var zoom0 = P.zoom.valueAtTime(t, false), anc = MPT.tr(rig.tgt, "ADBE Anchor Point").value;
        var dist0 = Math.abs(z0[2] - (anc[2] || 0)), X = Math.min(amt || 600, dist0 * 0.8);
        MPT.key(P.pos, t, z0, 70); MPT.key(P.pos, t + d, MPT.addZ(z0, X), 70);
        MPT.key(P.zoom, t, zoom0, 70); MPT.key(P.zoom, t + d, zoom0 * (dist0 - X) / dist0, 70);
    } else if (a.kind === "handheld") {
        var tg = rig.tgt;
        MPT.slider(tg, "M\u00e3o Freq", a.freq || 1.2);
        MPT.slider(tg, "M\u00e3o Amp", a.amount || 0.8);
        tg = rig.tgt;
        var ex = '// MP camera na mao\nwiggle(effect("MP M\u00e3o Freq")(1), effect("MP M\u00e3o Amp")(1))';
        MPT.tr(tg, "ADBE Rotate X").expression = ex;
        MPT.tr(tg, "ADBE Rotate Y").expression = ex;
        MPT.tr(tg, "ADBE Rotate Z").expression = '// MP camera na mao\nwiggle(effect("MP M\u00e3o Freq")(1) * 0.7, effect("MP M\u00e3o Amp")(1) * 0.5)';
        return "ok:C\u00e2mera na m\u00e3o ligada (sliders MP M\u00e3o no null-alvo).";
    } else if (a.kind === "impact") {
        MPT.slider(rig.tgt, "Impacto", a.amount || 40);
        rig.tgt.property("ADBE Marker").setValueAtTime(t, new MarkerValue("impacto"));
        P = MPT.camProps(rig);
        P.tpos.expression = '// MP impacto\nvar m = marker, n = 0;\nif (m.numKeys) { n = m.nearestKey(time).index; if (m.key(n).time > time) n--; }\n' +
            'if (n < 1) value; else {\n  var t = time - m.key(n).time, A = effect("MP Impacto")(1) * Math.exp(-t * 7);\n  add(value, [Math.sin(t * 70) * A, Math.cos(t * 55) * A, 0]);\n}';
        return "ok:Tremida de impacto no playhead (cada clique adiciona outro impacto).";
    } else if (a.kind === "entrance") {
        MPT.key(P.pos, t, MPT.addZ(z0, -(amt || 2500)), 30); MPT.key(P.pos, t + d, z0, 92);
    } else if (a.kind === "escape") {
        MPT.key(P.pos, t, z0, 92); MPT.key(P.pos, t + d, MPT.addZ(z0, -(amt || 3000)), 30);
    } else if (a.kind === "reveal") {
        var tp = P.tpos.valueAtTime(t, false), ry = P.ry.valueAtTime(t, false);
        MPT.key(P.tpos, t, MPT.addX(tp, -(amt || 700)), 40); MPT.key(P.tpos, t + d, tp, 85);
        MPT.key(P.ry, t, ry + 20, 40); MPT.key(P.ry, t + d, ry, 85);
    } else if (a.kind === "zoomBeat") {
        var audio = MPT.audioOf(layers);
        if (!audio || !audio.property("ADBE Marker").numKeys) return "error:Selecione a m\u00fasica j\u00e1 com batidas marcadas (Atalhos \u203a Marcar batidas).";
        P.zoom.expression = '// MP zoom na batida\nvar m = thisComp.layer("' + audio.name.replace(/"/g, '\\"') + '").marker, n = 0;\n' +
            'if (m.numKeys) { n = m.nearestKey(time).index; if (m.key(n).time > time) n--; }\n' +
            'if (n < 1) value; else { var t = time - m.key(n).time; value * (1 + ' + ((amt || 12) / 100) + ' * Math.exp(-t * 8)); }';
        return "ok:Zoom na batida ligado em " + audio.property("ADBE Marker").numKeys + " marcador(es).";
    } else if (a.kind === "rackFocus" || a.kind === "focusOn") {
        var targets = [];
        for (var i = 0; i < layers.length; i++) if (layers[i] !== rig.cam && layers[i] !== rig.tgt && MPT.isVisual(layers[i])) targets.push(layers[i]);
        if (a.kind === "rackFocus" && targets.length < 2) return "error:Selecione 2 layers: primeiro a que come\u00e7a em foco, depois a que termina.";
        if (!targets.length) return "error:Selecione a layer que deve ficar em foco.";
        for (i = 0; i < targets.length; i++) targets[i].threeDLayer = true;
        P = MPT.camProps(rig);
        P.dof.setValue(1);
        P.aperture.setValue(a.aperture || 120);
        var q = function (L) { return 'thisComp.layer("' + L.name.replace(/"/g, '\\"') + '")'; };
        var dist = function (L) { return "length(toWorld([0,0,0]), " + q(L) + ".toWorld(" + q(L) + ".anchorPoint))"; };
        if (a.kind === "focusOn") P.focus.expression = "// MP foco\n" + dist(targets[0]);
        else P.focus.expression = "// MP rack focus\nvar u = clamp((time - " + t.toFixed(3) + ") / " + d + ", 0, 1); u = u * u * (3 - 2 * u);\nlinear(u, 0, 1, " + dist(targets[0]) + ", " + dist(targets[1]) + ")";
        return "ok:" + (a.kind === "focusOn" ? "Foco preso em \u201c" + targets[0].name + "\u201d." : "Rack focus de \u201c" + targets[0].name + "\u201d para \u201c" + targets[1].name + "\u201d.");
    } else return "error:efeito de c\u00e2mera desconhecido";
    return "ok:Movimento de c\u00e2mera criado no playhead.";
};

// ------------------------------------------------------------ dispatcher
// ============================================================ audio
MPT.audioLayers = function (layers) {
    var out = [];
    for (var i = 0; i < layers.length; i++) if (layers[i].hasAudio) out.push(layers[i]);
    return out;
};
MPT.levels = function (L) { return L.property("ADBE Audio Group").property("ADBE Audio Levels"); };
// Volume: sets the level (dB) or, when the levels are keyed, shifts every key by the difference.
MPT.T.audioLevel = function (a, comp, layers) {
    var A = MPT.audioLayers(layers), db = +a.db || 0;
    if (!A.length) return "error:Selecione layers com \u00e1udio.";
    for (var i = 0; i < A.length; i++) {
        var lv = MPT.levels(A[i]);
        if (lv.numKeys) {
            var d = db - lv.valueAtTime(A[i].inPoint, false)[0];
            for (var k = 1; k <= lv.numKeys; k++) { var v = lv.keyValue(k); lv.setValueAtKey(k, [v[0] + d, v[1] + d]); }
        } else lv.setValue([db, db]);
    }
    return "ok:Volume " + db + " dB em " + A.length + " layer(s).";
};
MPT.T.audioMute = function (a, comp, layers) {
    var A = MPT.audioLayers(layers);
    if (!A.length) return "error:Selecione layers com \u00e1udio.";
    for (var i = 0; i < A.length; i++) A[i].audioEnabled = a.mode === "on" ? true : a.mode === "off" ? false : !A[i].audioEnabled;
    return "ok:\u00c1udio " + (a.mode === "on" ? "ligado" : a.mode === "off" ? "mudo" : "alternado") + " em " + A.length + " layer(s).";
};
// Runs "Convert Audio to Keyframes" on L and returns the new amplitude layer (always a new one).
MPT.convertAmp = function (comp, L, name) {
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
    L.selected = true;
    var before = comp.numLayers, id = 0;
    try { id = app.findMenuCommandId("Convert Audio to Keyframes"); } catch (e) {}
    app.executeCommand(id || 5015);
    if (comp.numLayers === before) return null;
    var amp = comp.layer(1);
    amp.name = name; amp.shy = true; amp.enabled = false;
    return amp;
};
MPT.ampSlider = function (amp) { var fx = amp.property("ADBE Effect Parade"); return fx.property(fx.numProperties).property(1); };
MPT.peakOf = function (s) { var m = 0; for (var i = 1; i <= s.numKeys; i++) m = Math.max(m, s.keyValue(i)); return m; };
// Ducking: select the voice first, then the music. The music level drops while the voice is present.
MPT.T.duck = function (a, comp, layers) {
    var A = MPT.audioLayers(layers);
    if (A.length < 2) return "error:Selecione a voz primeiro e depois a m\u00fasica (2 layers com \u00e1udio).";
    var voice = A[0], name = MPT.TAG + "Voz " + voice.index, amp = null, i;
    for (i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) amp = comp.layer(i);
    if (!amp) amp = MPT.convertAmp(comp, voice, name);
    if (!amp) return "error:N\u00e3o consegui analisar o \u00e1udio da voz.";
    var thr = MPT.peakOf(MPT.ampSlider(amp)) * ((a.threshold || 15) / 100), dep = +a.depth || 12, w = Math.max(1, Math.round(a.smooth || 6));
    var expr = "// MP ducking\nvar s = thisComp.layer(\"" + name + "\").effect(3)(1), f = thisComp.frameDuration, m = 0;\n" +
        "for (var i = -" + w + "; i <= " + w + "; i++) m = Math.max(m, s.valueAtTime(time + i * f));\n" +
        "var k = Math.min(1, m / " + thr.toFixed(3) + ");\nvalue - [" + dep + " * k, " + dep + " * k];";
    for (i = 1; i < A.length; i++) MPT.levels(A[i]).expression = expr;
    return "ok:Ducking de " + dep + " dB em " + (A.length - 1) + " layer(s) de m\u00fasica.";
};
// Crossfade between consecutive audio layers (sorted by start); makes them overlap if needed.
MPT.T.crossfade = function (a, comp, layers) {
    var A = MPT.audioLayers(layers), fd = comp.frameDuration, d = (a.frames || 24) * fd, i;
    if (A.length < 2) return "error:Selecione 2 ou mais layers com \u00e1udio.";
    A.sort(function (x, y) { return x.inPoint - y.inPoint; });
    for (i = 1; i < A.length; i++) {
        var P = A[i - 1], N = A[i];
        if (P.outPoint - N.inPoint < d) N.startTime -= N.inPoint - (P.outPoint - d);
        var lp = MPT.levels(P), ln = MPT.levels(N), vp = lp.valueAtTime(P.outPoint - d, false), vn = ln.valueAtTime(N.inPoint + d, false);
        MPT.key(lp, P.outPoint - d, vp, 33); MPT.key(lp, P.outPoint, [-48, -48], 33);
        MPT.key(ln, N.inPoint, [-48, -48], 33); MPT.key(ln, N.inPoint + d, vn, 33);
    }
    return "ok:Crossfade de " + (a.frames || 24) + " fr entre " + A.length + " layer(s).";
};
// Match volumes: brings every selected audio layer to the loudest peak (relative, via amplitude analysis).
MPT.T.matchLevels = function (a, comp, layers) {
    var A = MPT.audioLayers(layers), peaks = [], top = 0, i;
    if (!A.length) return "error:Selecione layers com \u00e1udio.";
    for (i = 0; i < A.length; i++) {
        var amp = MPT.convertAmp(comp, A[i], MPT.TAG + "tmp");
        if (!amp) return "error:N\u00e3o consegui analisar o \u00e1udio.";
        peaks.push(MPT.peakOf(MPT.ampSlider(amp)));
        amp.remove();
        top = Math.max(top, peaks[i]);
    }
    if (!top) return "error:As layers parecem estar em sil\u00eancio.";
    var target = a.mode === "max" ? top : top;
    for (i = 0; i < A.length; i++) {
        if (!peaks[i]) continue;
        var g = 20 * Math.log(target / peaks[i]) / Math.LN10 + (+a.boost || 0), lv = MPT.levels(A[i]);
        if (lv.numKeys) { for (var k = 1; k <= lv.numKeys; k++) { var v = lv.keyValue(k); lv.setValueAtKey(k, [v[0] + g, v[1] + g]); } }
        else { var c = lv.value; lv.setValue([c[0] + g, c[1] + g]); }
    }
    for (i = 0; i < A.length; i++) A[i].selected = true;
    return "ok:Volumes igualados em " + A.length + " layer(s).";
};
// ============================================================ text & paragraph (Character / Paragraph panel equivalents)
MPT.JUST = function () {
    var J = ParagraphJustification;
    return { left: J.LEFT_JUSTIFY, center: J.CENTER_JUSTIFY, right: J.RIGHT_JUSTIFY, fullLeft: J.FULL_JUSTIFY_LASTLINE_LEFT,
             fullCenter: J.FULL_JUSTIFY_LASTLINE_CENTER, fullRight: J.FULL_JUSTIFY_LASTLINE_RIGHT, full: J.FULL_JUSTIFY_LASTLINE_FULL };
};
MPT.rgbHex = function (c) {
    var s = "#";
    for (var i = 0; i < 3; i++) { var v = Math.round(Math.max(0, Math.min(1, c[i])) * 255).toString(16); s += v.length < 2 ? "0" + v : v; }
    return s;
};
// Applies only the properties sent (a.set) to every selected text layer. Properties this AE version cannot
// change are skipped and listed in the message.
MPT.T.textStyle = function (a, comp, layers) {
    var n = 0, failed = {}, i, k, S = a.set || {}, J = MPT.JUST();
    for (i = 0; i < layers.length; i++) {
        var L = layers[i];
        if (!(L instanceof TextLayer)) continue;
        var prop = L.property("ADBE Text Properties").property("ADBE Text Document"), d = prop.value;
        for (k in S) {
            if (!S.hasOwnProperty(k)) continue;
            var v = S[k];
            try {
                if (k === "fillColor" || k === "strokeColor") d[k] = MPT.hex(v).slice(0, 3);
                else if (k === "justification") d.justification = J[v];
                else if (k === "leading") { d.autoLeading = false; d.leading = v; }
                else d[k] = v;
            } catch (e) { failed[k] = true; }
        }
        prop.setValue(d);
        n++;
    }
    if (!n) return "error:Selecione layers de texto.";
    var miss = [];
    for (k in failed) if (failed.hasOwnProperty(k)) miss.push(k);
    return "ok:Texto ajustado em " + n + " layer(s)" + (miss.length ? " (esta vers\u00e3o do AE n\u00e3o altera: " + miss.join(", ") + ")" : "") + ".";
};
MPT.T.textRead = function (a, comp, layers) {
    var L = null, i;
    for (i = 0; i < layers.length; i++) if (layers[i] instanceof TextLayer) { L = layers[i]; break; }
    if (!L) return "error:Selecione uma layer de texto.";
    var d = L.property("ADBE Text Properties").property("ADBE Text Document").value, out = { layer: L.name }, J = MPT.JUST(), k;
    var keys = ["font", "fontSize", "leading", "autoLeading", "tracking", "applyFill", "applyStroke", "strokeWidth", "horizontalScale", "verticalScale",
                "baselineShift", "tsume", "allCaps", "smallCaps", "superscript", "subscript", "fauxBold", "fauxItalic", "firstLineIndent", "startIndent",
                "endIndent", "spaceBefore", "spaceAfter"];
    for (i = 0; i < keys.length; i++) { try { var v = d[keys[i]]; if (v !== undefined) out[keys[i]] = typeof v === "number" ? Math.round(v * 100) / 100 : v; } catch (e) {} }
    try { if (d.applyFill) out.fillColor = MPT.rgbHex(d.fillColor); } catch (e1) {}
    try { if (d.applyStroke) out.strokeColor = MPT.rgbHex(d.strokeColor); } catch (e2) {}
    try { for (k in J) if (J.hasOwnProperty(k) && J[k] === d.justification) out.justification = k; } catch (e3) {}
    return "json:" + MPT.json(out);
};

// Zoom on beat (2D, no camera): scale pulse on every beat marker of the music. Marks the beats first when the
// music has no markers yet. Selected visual layers pulse; with only the music selected, an adjustment layer
// with a Transform effect zooms everything below it.
MPT.T.zoomBeat = function (a, comp, layers) {
    var audio = MPT.audioOf(layers), i;
    if (!audio) return "error:Selecione a m\u00fasica (e, se quiser, as layers que v\u00e3o pulsar).";
    if (!audio.property("ADBE Marker").numKeys) {
        var mb = MPT.T.markBeats({ sensitivity: a.sensitivity || 40, gap: a.gap || 8 }, comp, [audio]);
        if (mb.indexOf("ok:") !== 0) return mb;
    }
    var k = ((a.amount || 12) / 100).toFixed(3), name = audio.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    var pulse = "var m = thisComp.layer(\"" + name + "\").marker, n = 0;\n" +
        "if (m.numKeys) { n = m.nearestKey(time).index; if (m.key(n).time > time) n--; }\n" +
        "var p = n < 1 ? 0 : " + k + " * Math.exp(-(time - m.key(n).time) * 8);\n";
    var targets = [];
    for (i = 0; i < layers.length; i++) if (layers[i] !== audio && MPT.isVisual(layers[i]) && !(layers[i].hasAudio && !layers[i].hasVideo)) targets.push(layers[i]);
    if (targets.length) {
        for (i = 0; i < targets.length; i++) MPT.tr(targets[i], "ADBE Scale").expression = "// MP zoom na batida\n" + pulse + "value * (1 + p)";
        return "ok:Zoom na batida em " + targets.length + " layer(s), " + audio.property("ADBE Marker").numKeys + " batida(s).";
    }
    var adj = comp.layers.addSolid([1, 1, 1], MPT.TAG + "Zoom na batida", comp.width, comp.height, comp.pixelAspect, comp.duration);
    adj.adjustmentLayer = true;
    adj.moveToBeginning();
    var tf = adj.property("ADBE Effect Parade").addProperty("ADBE Geometry2");
    tf.property(4).expression = "// MP zoom na batida\n" + pulse + "value * (1 + p)";
    return "ok:Zoom na batida numa layer de ajuste (afeta tudo abaixo), " + audio.property("ADBE Marker").numKeys + " batida(s).";
};
// Visualizer: new solid with Audio Spectrum or Audio Waveform reading the selected audio layer.
MPT.T.audioViz = function (a, comp, layers) {
    var audio = MPT.audioOf(layers);
    if (!audio) return "error:Selecione a layer de \u00e1udio.";
    var wave = a.kind === "waveform", L = comp.layers.addSolid([0, 0, 0], MPT.TAG + (wave ? "Forma de onda" : "Espectro"), comp.width, comp.height, comp.pixelAspect, comp.duration);
    var fx = L.property("ADBE Effect Parade"), m = wave ? "ADBE AudWave" : "ADBE AudSpect";
    if (!fx.canAddProperty(m)) { L.remove(); return "error:Efeito " + (wave ? "Audio Waveform" : "Audio Spectrum") + " indispon\u00edvel."; }
    var e = fx.addProperty(m);
    try { e.property(1).setValue(audio.index); } catch (er) {}
    var col = MPT.hex(a.color || "#0a84ff").slice(0, 3);
    for (var i = 1; i <= e.numProperties; i++) {
        var p = e.property(i);
        try { if (p.propertyValueType === PropertyValueType.COLOR) p.setValue(col.concat([1])); } catch (er2) {}
    }
    return "ok:" + (wave ? "Forma de onda" : "Espectro") + " criado a partir de \u201c" + audio.name + "\u201d.";
};

MPT.NEEDS_LAYERS = {
    align: 1, distribute: 1, anchor: 1, precomp: 1, unprecomp: 1, trim: 1, fx: 1, removeFx: 1, fit: 1, caseText: 1,
    trueDup: 1, splitMasks: 1, sequence: 1, motionBlur: 1, nullParent: 1, counter: 1, shapeStyle: 1, trimPaths: 1,
    dashes: 1, taper: 1, carousel: 1, parallax: 1, toggle3D: 1, lightSweep: 1, glitchFx: 1, turbulence: 1, chromaKey: 1,
    infiniteScroll: 1, infiniteVideo: 1, fadeAudio: 1, markBeats: 1, reactBeat: 1, physGlow: 1, addEffect: 1, applyPresetFile: 1, exprApplyTo: 1,
    audioLevel: 1, audioMute: 1, duck: 1, crossfade: 1, matchLevels: 1, audioViz: 1, zoomBeat: 1, textStyle: 1, textRead: 1
};
MPT.NO_COMP = { organize: 1, fontsAll: 1, fxScan: 1, fxToggle: 1, purgeCache: 1, listEffects: 1, listPresets: 1 };
MPT.READ_ONLY = { textRead: 1, fontsScan: 1, fontsAll: 1, fxScan: 1, exprScan: 1, clipCopy: 1, bezierRead: 1, purgeCache: 1, listEffects: 1, listPresets: 1, compInfo: 1 };

MPT.run = function (argStr) {
    var a;
    try { a = eval("(" + argStr + ")"); } catch (e) { return "error:argumentos inv\u00e1lidos"; }
    var fn = MPT.T[a.id];
    if (!fn) return "error:ferramenta desconhecida: " + a.id;
    var comp = MPT.comp();
    if (!comp && !MPT.NO_COMP[a.id]) return "error:Abra uma composi\u00e7\u00e3o.";
    if ((a.id === "fxScan" || a.id === "fxToggle") && a.scope !== "project" && !comp) return "error:Abra uma composi\u00e7\u00e3o.";
    var layers = comp ? comp.selectedLayers : [];
    if (MPT.NEEDS_LAYERS[a.id] && !layers.length) return "error:Selecione pelo menos uma layer.";
    var undo = !MPT.READ_ONLY[a.id];
    if (undo) app.beginUndoGroup("Motion Panel: " + a.id);
    var res;
    try { res = fn(a, comp, layers); }
    catch (err) { res = "error:" + err.toString() + " (linha " + err.line + ")"; }
    if (undo) app.endUndoGroup();
    return res;
};
