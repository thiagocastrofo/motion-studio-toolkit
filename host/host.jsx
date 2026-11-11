// Motion Panel - ExtendScript host (ES3: no let/const, arrow functions, JSON or Array.indexOf).
// Everything the panel creates is tagged with the "MP " prefix so "Limpar" can find it.

// Registered on $.global so the namespace survives being loaded through $.evalFile inside a function.
$.global.MP = $.global.MP || {};
var MP = $.global.MP;
MP.TAG = "MP ";

MP.parse = function (s) { return eval("(" + s + ")"); };
MP.comp = function () {
    var c = app.project.activeItem;
    return (c && c instanceof CompItem) ? c : null;
};
MP.startsWith = function (s, p) { return String(s).substr(0, p.length) === p; };

MP.TR = { opacity: "ADBE Opacity", scale: "ADBE Scale", rotation: "ADBE Rotate Z", rotX: "ADBE Rotate X", rotY: "ADBE Rotate Y" };

// ---------------------------------------------------------------- effects
MP.findEffect = function (layer, name, match, create) {
    var fx = layer.property("ADBE Effect Parade");
    if (!fx) return null;
    for (var i = 1; i <= fx.numProperties; i++) if (fx.property(i).name === name) return fx.property(i);
    if (!create || !fx.canAddProperty(match)) return null;
    var e = fx.addProperty(match);
    e.name = name;
    return e;
};
MP.fxInfo = function (prop) {
    var p = prop.split(":");
    return { match: p[1], param: parseInt(p[2], 10), name: MP.TAG + p[1].replace("ADBE ", "") };
};
MP.ensureFx = function (layer, track) {
    var info = MP.fxInfo(track.prop);
    var e = MP.findEffect(layer, info.name, info.match, true);
    if (e && track.fxSet) {
        for (var k in track.fxSet) {
            try { MP.findEffect(layer, info.name, info.match, false).property(parseInt(k, 10)).setValue(track.fxSet[k]); } catch (x) {}
        }
    }
    return e;
};

// Returns an array of Property objects (2 entries when position has separated dimensions).
MP.props = function (layer, name) {
    if (MP.startsWith(name, "mask:")) {
        var mk = MP.findMask(layer, name.substr(5));
        return mk ? [mk.property("ADBE Mask Offset")] : [];
    }
    if (MP.startsWith(name, "fx:")) {
        var info = MP.fxInfo(name);
        var e = MP.findEffect(layer, info.name, info.match, false);
        return e ? [e.property(info.param)] : [];
    }
    var tr = layer.property("ADBE Transform Group");
    if (!tr) return [];
    if (name === "position") {
        var p = tr.property("ADBE Position");
        if (p.dimensionsSeparated) return [tr.property("ADBE Position_0"), tr.property("ADBE Position_1")];
        return [p];
    }
    var m = MP.TR[name];
    if (!m) return [];
    var q = tr.property(m);
    return q ? [q] : [];
};

MP.getValue = function (props, t) {
    if (props.length === 1) return props[0].valueAtTime(t, false);
    return [props[0].valueAtTime(t, false), props[1].valueAtTime(t, false)];
};
MP.isArr = function (v) { return v instanceof Array; };

// Resolve a keyframe value spec against the property's resting ("base") value.
MP.resolve = function (spec, base, comp) {
    var out, i;
    if (spec === "base") return base;
    if (typeof spec === "number") return spec;
    if (spec.mul !== undefined) {
        if (!MP.isArr(base)) return base * spec.mul;
        out = [];
        for (i = 0; i < base.length; i++) out.push(base[i] * spec.mul);
        return out;
    }
    if (spec.mulv !== undefined) {
        out = [];
        for (i = 0; i < base.length; i++) out.push(base[i] * (spec.mulv[i] !== undefined ? spec.mulv[i] : 1));
        return out;
    }
    if (spec.add !== undefined) return base + spec.add;
    if (spec.dw !== undefined || spec.dh !== undefined || spec.dz !== undefined) {
        out = base.slice(0);
        out[0] += (spec.dw || 0) * comp.width;
        out[1] += (spec.dh || 0) * comp.height;
        if (spec.dz !== undefined && out.length > 2) out[2] += spec.dz;
        return out;
    }
    return base;
};

// ---------------------------------------------------------------- shape-reveal masks
// "mask:<kind>" tracks animate Mask Expansion on a mask that covers the layer; a value of -1
// means fully closed (scaled by the mask's own radius), "base" means fully open.
MP.findMask = function (layer, kind) {
    var mp = layer.property("ADBE Mask Parade");
    if (!mp) return null;
    for (var i = 1; i <= mp.numProperties; i++) if (mp.property(i).name === MP.TAG + "Mask " + kind) return mp.property(i);
    return null;
};
MP.maskGeom = function (layer, kind, t) {
    var r = layer.sourceRectAtTime(t, false), w = r.width, h = r.height;
    var cx = r.left + w / 2, cy = r.top + h / 2, s = new Shape(), R;
    if (kind === "ellipse") {
        R = Math.sqrt(w * w + h * h) / 2 * 1.04;
        var k = 0.5523 * R;
        s.vertices = [[cx, cy - R], [cx + R, cy], [cx, cy + R], [cx - R, cy]];
        s.inTangents = [[-k, 0], [0, -k], [k, 0], [0, k]];
        s.outTangents = [[k, 0], [0, k], [-k, 0], [0, -k]];
    } else if (kind === "diamond") {
        R = (w + h) / 2 * 1.04;
        s.vertices = [[cx, cy - R], [cx + R, cy], [cx, cy + R], [cx - R, cy]];
    } else if (kind === "curtainH") {
        R = w / 2 + 2;
        s.vertices = [[r.left - 1, cy - h * 2], [r.left + w + 1, cy - h * 2], [r.left + w + 1, cy + h * 2], [r.left - 1, cy + h * 2]];
    } else if (kind === "curtainV") {
        R = h / 2 + 2;
        s.vertices = [[cx - w * 2, r.top - 1], [cx + w * 2, r.top - 1], [cx + w * 2, r.top + h + 1], [cx - w * 2, r.top + h + 1]];
    } else {
        R = Math.max(w, h) / 2 + 2;
        s.vertices = [[r.left - 1, r.top - 1], [r.left + w + 1, r.top - 1], [r.left + w + 1, r.top + h + 1], [r.left - 1, r.top + h + 1]];
    }
    s.closed = true;
    return { shape: s, R: R };
};
MP.ensureMask = function (layer, kind, t) {
    if (MP.findMask(layer, kind)) return;
    var mp = layer.property("ADBE Mask Parade");
    if (!mp || !mp.canAddProperty("ADBE Mask Atom")) return;
    var g = MP.maskGeom(layer, kind, t);
    mp.addProperty("ADBE Mask Atom");
    var m = layer.property("ADBE Mask Parade").property(layer.property("ADBE Mask Parade").numProperties);
    m.name = MP.TAG + "Mask " + kind;
    m.property("ADBE Mask Shape").setValue(g.shape);
};

// ---------------------------------------------------------------- keyframes
MP.easeDims = function (prop) {
    var t = prop.propertyValueType;
    if (t === PropertyValueType.ThreeD) return 3;
    if (t === PropertyValueType.TwoD) return 2;
    return 1;
};
MP.setEase = function (prop, idx, inInf, outInf) {
    var n = MP.easeDims(prop), ei = [], eo = [];
    for (var i = 0; i < n; i++) {
        ei.push(new KeyframeEase(0, Math.max(0.1, Math.min(100, inInf))));
        eo.push(new KeyframeEase(0, Math.max(0.1, Math.min(100, outInf))));
    }
    prop.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER);
    prop.setTemporalEaseAtKey(idx, ei, eo);
};
MP.clearWindow = function (prop, t0, t1) {
    var eps = 0.0005;
    for (var k = prop.numKeys; k >= 1; k--) {
        var kt = prop.keyTime(k);
        if (kt >= t0 - eps && kt <= t1 + eps) prop.removeKey(k);
    }
};
MP.addKey = function (prop, t, v, ease, linear) {
    var k = prop.addKey(t);
    prop.setValueAtKey(k, v);
    if (linear) prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR);
    else MP.setEase(prop, k, ease[0], ease[1]);
};

MP.EASES = { smooth: [33, 33], snappy: [85, 12], soft: [70, 70], strong: [90, 90], linear: [33, 33] };

MP.applyTrack = function (layer, comp, track, ctx) {
    var props = MP.props(layer, track.prop);
    if (!props.length) return 0;
    var keys = track.keys, i, p;
    var baseTime = ctx.mode === "out" ? ctx.start : ctx.start + ctx.dur;
    var base = MP.getValue(props, baseTime);
    var maskR = MP.startsWith(track.prop, "mask:") ? MP.maskGeom(layer, track.prop.substr(5), baseTime).R : 0;
    for (p = 0; p < props.length; p++) MP.clearWindow(props[p], ctx.start, ctx.start + ctx.dur);

    for (i = 0; i < keys.length; i++) {
        var u = ctx.mode === "out" ? 1 - keys[i][0] : keys[i][0];
        var t = ctx.start + u * ctx.dur;
        var v = maskR && typeof keys[i][1] === "number" ? keys[i][1] * maskR : MP.resolve(keys[i][1], base, comp);
        var inInf = keys[i][2] !== undefined ? keys[i][2] : ctx.ease[0];
        var outInf = keys[i][3] !== undefined ? keys[i][3] : ctx.ease[1];
        var ease = ctx.mode === "out" ? [outInf, inInf] : [inInf, outInf];
        for (p = 0; p < props.length; p++) MP.addKey(props[p], t, props.length > 1 ? v[p] : v, ease, ctx.linear);
    }
    return 1;
};

// ---------------------------------------------------------------- text animators
MP.TEXT_DRIVE = { offset: "ADBE Text Percent Offset", start: "ADBE Text Percent Start" };

MP.applyText = function (layer, preset, ctx) {
    if (!(layer instanceof TextLayer)) return 0;
    var t = preset.text, i;
    var nm = MP.TAG + "Text " + (ctx.mode === "in" ? "In" : "Out");
    var anims = layer.property("ADBE Text Properties").property("ADBE Text Animators");
    for (i = anims.numProperties; i >= 1; i--) {
        var an0 = anims.property(i).name;
        if (an0 === nm || an0 === nm + " Onda") anims.property(i).remove();
    }
    MP.textAnimator(layer, nm, t.props, t.unit, t.shape || 1, t.random, t.drive, t.width, ctx);
    // Optional elastic "wave": a triangle-shaped selector riding the same front exaggerates each unit as it lands.
    if (t.wave) MP.textAnimator(layer, nm + " Onda", t.wave, t.unit, 4, t.random, "offset", t.waveWidth || (t.width || 35), ctx);
    return 1;
};

MP.textAnimator = function (layer, name, props, unit, shape, random, drive, width, ctx) {
    var k;
    var an = layer.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
    an.name = name;
    var idx = an.propertyIndex;
    var A = function () { return layer.property("ADBE Text Properties").property("ADBE Text Animators").property(idx); };
    A().property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    for (k in props) A().property("ADBE Text Animator Properties").addProperty(k);
    for (k in props) A().property("ADBE Text Animator Properties").property(k).setValue(props[k]);

    var S = function () { return A().property("ADBE Text Selectors").property(1); };
    var adv = function () { return S().property("ADBE Text Range Advanced"); };
    adv().property("ADBE Text Range Type2").setValue(unit || 1);   // 1 chars, 2 chars w/o spaces, 3 words, 4 lines
    adv().property("ADBE Text Range Shape").setValue(shape || 1);  // 1 square, 2 ramp up, 4 triangle
    if (random) adv().property("ADBE Text Randomize Order").setValue(1);

    var prop, from, to;
    if (drive === "amount") {
        prop = adv().property("ADBE Text Selector Max Amount"); from = 100; to = 0;
    } else if (drive === "start") {
        prop = S().property("ADBE Text Percent Start"); from = 0; to = 100;
    } else {
        var w = width || 35;
        S().property("ADBE Text Percent End").setValue(w);
        prop = S().property("ADBE Text Percent Offset"); from = -w; to = 100;
    }
    var a = ctx.mode === "out" ? to : from, b = ctx.mode === "out" ? from : to;
    MP.addKey(prop, ctx.start, a, ctx.ease, ctx.linear);
    MP.addKey(prop, ctx.start + ctx.dur, b, ctx.ease, ctx.linear);
};

// ---------------------------------------------------------------- adjustable markers + Effect Controls entry
// Each applied window becomes (1) a layer marker with duration and (2) a control in the layer's
// Effect Controls named "MP > <preset> (entrada|sa\u00edda)" whose slider is the animation intensity (%).
// cuePointName keeps "MPW|k0|k1|mode|effectName". The expression below remaps time from the marker
// to the original key window, then blends from the resting value by the control's intensity
// (turning the control's fx switch off disables that animation).
MP.MARKER_TAG = "MPW|";
MP.MARKER_EXPR = [
    "// MP marcador: segue os marcadores MP da layer e o controle em Efeitos",
    "var M = thisLayer.marker, W = [], fd = thisComp.frameDuration;",
    "for (var i = 1; i <= M.numKeys; i++) {",
    "  var k = M.key(i), c = k.cuePointName || \"\";",
    "  if (c.indexOf(\"MPW|\") === 0) { var p = c.split(\"|\"); W.push([k.time, k.time + Math.max(k.duration, fd), parseFloat(p[1]), parseFloat(p[2]), p[3], p[4] || \"\"]); }",
    "}",
    "var s = time, wi = -1;",
    "if (W.length) {",
    "  W.sort(function (a, b) { return a[0] - b[0]; });",
    "  if (time <= W[0][0]) { s = W[0][2]; wi = 0; }",
    "  else {",
    "    s = W[W.length - 1][3]; wi = W.length - 1;",
    "    for (var j = 0; j < W.length; j++) {",
    "      var w = W[j];",
    "      if (time >= w[0] && time <= w[1]) { s = w[2] + (time - w[0]) / (w[1] - w[0]) * (w[3] - w[2]); wi = j; break; }",
    "      if (j + 1 < W.length && time > w[1] && time < W[j + 1][0]) { s = w[3]; wi = j; break; }",
    "    }",
    "  }",
    "}",
    "var res = valueAtTime(s);",
    "if (wi >= 0 && W[wi][5] !== \"\") {",
    "  try {",
    "    var e = effect(W[wi][5]), I = e.active ? e(1) / 100 : 0;",
    "    var rest = valueAtTime(W[wi][4] === \"out\" ? W[wi][2] : W[wi][3]);",
    "    res = add(rest, mul(sub(res, rest), I));",
    "  } catch (err) {}",
    "}",
    "res"
].join("\n");

MP.windowEffectName = function (name, mode) {
    return "MP > " + name + (mode === "out" ? " (sa\u00edda)" : " (entrada)");
};
MP.removeEffectNamed = function (layer, name) {
    var fx = layer.property("ADBE Effect Parade");
    if (!fx || !name) return;
    for (var i = fx.numProperties; i >= 1; i--) if (fx.property(i).name === name) fx.property(i).remove();
};
MP.addWindowMarker = function (layer, mode, start, dur, name) {
    var mk = layer.property("ADBE Marker"), k, fxName = MP.windowEffectName(name, mode);
    // Replace the previous window of the same kind (its marker and its Effect Controls entry).
    for (k = mk.numKeys; k >= 1; k--) {
        var c = layer.property("ADBE Marker").keyValue(k).cuePointName || "", parts = c.split("|");
        if (MP.startsWith(c, MP.MARKER_TAG) && parts[3] === mode) {
            MP.removeEffectNamed(layer, parts[4]);
            layer.property("ADBE Marker").removeKey(k);
        }
    }
    MP.removeEffectNamed(layer, fxName);
    var e = MP.findEffect(layer, fxName, "ADBE Slider Control", true);
    if (e) MP.findEffect(layer, fxName, "ADBE Slider Control", false).property(1).setValue(100);
    var mv = new MarkerValue("MP \u00b7 " + name + (mode === "out" ? " (sa\u00edda)" : " (entrada)"));
    mv.duration = dur;
    mv.cuePointName = MP.MARKER_TAG + start.toFixed(5) + "|" + (start + dur).toFixed(5) + "|" + mode + "|" + (e ? fxName : "");
    try { mv.label = mode === "out" ? 1 : 9; } catch (x) {}
    layer.property("ADBE Marker").setValueAtTime(start, mv);
};

// Puts the marker expression on every keyed property of the layer that has keys at both ends of the window.
MP.linkWindow = function (layer, t0, t1, fd) {
    var eps = fd / 4;
    var hasKeyAt = function (p, t) {
        if (!p.numKeys) return false;
        var k = p.nearestKeyIndex(t);
        return Math.abs(p.keyTime(k) - t) <= eps;
    };
    var walk = function (g) {
        for (var i = 1; i <= g.numProperties; i++) {
            var p = g.property(i);
            if (p.matchName === "ADBE Marker") continue;
            if (p.propertyType === PropertyType.PROPERTY) {
                if (p.numKeys >= 2 && p.canSetExpression && hasKeyAt(p, t0) && hasKeyAt(p, t1) &&
                    (p.expression === "" || MP.startsWith(p.expression, "// MP marcador"))) p.expression = MP.MARKER_EXPR;
            } else if (p.numProperties) walk(p);
        }
    };
    walk(layer);
};

// ---------------------------------------------------------------- expression loops
MP.applyLoop = function (layer, preset) {
    var L = preset.loop, i;
    for (i = 0; i < L.controls.length; i++) {
        var c = L.controls[i];
        var e = MP.findEffect(layer, MP.TAG + c.n, "ADBE Slider Control", true);
        if (!e) return 0;
        MP.findEffect(layer, MP.TAG + c.n, "ADBE Slider Control", false).property(1).setValue(c.v);
    }
    var parts = [{ prop: L.prop, expr: L.expr }].concat(L.more || []), ok = 0;
    for (i = 0; i < parts.length; i++) {
        var props = MP.props(layer, parts[i].prop);
        if (props.length !== 1) continue; // separated position dimensions are not supported
        props[0].expression = "// MP loop\n" + parts[i].expr;
        ok = 1;
    }
    return ok;
};

// ---------------------------------------------------------------- expression animation engine
// Animations are applied WITHOUT keyframes. Each animated property gets one generated expression
// ("// MP anim:<kind>:<dims>") holding a table D of every animation window that affects it:
//   D[id] = { m: "in"|"out", e: easing, k: [[t, contribution], ...] }   (keys written as an entrance)
// Each window has a layer marker (cuePointName "MPW|<id>|<mode>|<control>") that gives its time and
// duration, and a Slider Control in Effect Controls that gives its intensity (fx switch off = disabled).
// kind "add": contributions are offsets added to the property's own value (position, rotation, effects,
// masks); kind "mul": factors multiplied (scale, opacity). So moving / scaling the layer keeps working,
// and several animations on the same layer simply combine.
MP.ser = function (v) {
    var i, out, t = typeof v;
    if (v === null || v === undefined) return "null";
    if (t === "number") return isFinite(v) ? String(Math.round(v * 100000) / 100000) : "0";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    if (v instanceof Array) { out = []; for (i = 0; i < v.length; i++) out.push(MP.ser(v[i])); return "[" + out.join(",") + "]"; }
    out = [];
    for (i in v) if (v.hasOwnProperty(i)) out.push('"' + i + '":' + MP.ser(v[i]));
    return "{" + out.join(",") + "}";
};
MP.animKind = function (propName) {
    return (propName === "scale" || propName === "opacity") ? "mul" : "add";
};
MP.ident = function (kind, dims) {
    var v = kind === "mul" ? 1 : 0;
    if (dims <= 1) return v;
    var a = [];
    for (var i = 0; i < dims; i++) a.push(v);
    return a;
};
// Contribution of one key value spec, relative to the property's own value.
MP.animContrib = function (spec, propName, comp, dims, maskR) {
    var kind = MP.animKind(propName), id = MP.ident(kind, dims), i, out;
    if (spec === "base" || spec === undefined || spec === null) return id;
    if (propName === "position") {
        var full = [(spec.dw || 0) * comp.width, (spec.dh || 0) * comp.height, spec.dz || 0];
        out = [];
        for (i = 0; i < dims; i++) out.push(full[i] || 0);
        return dims <= 1 ? out[0] : out;
    }
    if (propName === "scale") {
        out = [];
        for (i = 0; i < dims; i++) {
            if (spec.mul !== undefined) out.push(i < 2 ? spec.mul : 1);
            else if (spec.mulv !== undefined) out.push(spec.mulv[i] !== undefined ? spec.mulv[i] : 1);
            else out.push(1);
        }
        return out;
    }
    if (propName === "opacity") return typeof spec === "number" ? spec / 100 : 1;
    if (MP.startsWith(propName, "mask:")) return typeof spec === "number" ? spec * maskR : 0;
    if (typeof spec === "number") return spec;             // effect parameters: additive amount
    if (spec.add !== undefined) return spec.add;           // rotations
    return id;
};
MP.ANIM_EASE = [
    "function E(x, e) {",
    "  if (e === \"linear\") return x;",
    "  if (e === \"snappy\") return 1 - Math.pow(1 - x, 4);",
    "  if (e === \"soft\") return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;",
    "  if (e === \"strong\") return x < .5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2;",
    "  return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;",
    "}"
].join("\n");
MP.animExpr = function (kind, dims, D) {
    var L = [
        "// MP anim:" + kind + ":" + dims + " (anima\u00e7\u00f5es do Motion Panel controladas pelos marcadores MP; n\u00e3o edite)",
        "var D = " + MP.ser(D) + ";",
        "var M = thisLayer.marker, fd = thisComp.frameDuration;",
        MP.ANIM_EASE,
        "function L(a, b, x) { return (a instanceof Array) ? add(a, mul(sub(b, a), x)) : a + (b - a) * x; }",
        "function V(k, u, e) {",
        "  if (u <= k[0][0]) return k[0][1];",
        "  for (var j = 0; j < k.length - 1; j++) if (u <= k[j + 1][0]) { var s = k[j + 1][0] - k[j][0]; return L(k[j][1], k[j + 1][1], s > 0 ? E((u - k[j][0]) / s, e) : 1); }",
        "  return k[k.length - 1][1];",
        "}",
        "var acc = " + MP.ser(MP.ident(kind, dims)) + ";",
        "for (var i = 1; i <= M.numKeys; i++) {",
        "  var mk = M.key(i), c = mk.cuePointName || \"\";",
        "  if (c.indexOf(\"MPW|\") !== 0) continue;",
        "  var p = c.split(\"|\"), w = D[p[1]];",
        "  if (!w) continue;",
        "  var u = clamp((time - mk.time) / Math.max(mk.duration, fd), 0, 1);",
        "  if (w.m === \"out\") u = 1 - u;",
        "  var I = 1;",
        "  if (p[3]) { try { var ef = effect(p[3]); I = ef.active ? ef(1) / 100 : 0; } catch (er) {} }",
        "  var v = V(w.k, u, w.e);"
    ];
    if (kind === "add") {
        L.push("  acc = add(acc, mul(v, I));", "}", "add(value, acc)");
    } else if (dims > 1) {
        L.push("  for (var d = 0; d < acc.length; d++) acc[d] = acc[d] * (1 + (v[d] - 1) * I);", "}",
            "var r = [];", "for (var d2 = 0; d2 < value.length; d2++) r.push(value[d2] * (d2 < acc.length ? acc[d2] : 1));", "r");
    } else {
        L.push("  acc = acc * (1 + (v - 1) * I);", "}", "value * acc");
    }
    return L.join("\n");
};
// Reads back { kind, dims, D } from a generated expression (null if it is not one of ours).
MP.readAnim = function (expr) {
    var m = String(expr).match(/^\/\/ MP anim:(add|mul):(\d+)/);
    if (!m) return null;
    var d = String(expr).match(/\nvar D = (.*);\n/);
    var D = {};
    if (d) { try { D = eval("(" + d[1] + ")"); } catch (e) { D = {}; } }
    return { kind: m[1], dims: parseInt(m[2], 10), D: D };
};
MP.hasKeysIn = function (D) { for (var k in D) if (D.hasOwnProperty(k)) return true; return false; };
// Adds (or replaces) window "id" on a property; false if the property has someone else's expression.
MP.attachWindow = function (prop, id, entry, kind, dims) {
    if (!prop.canSetExpression) return false;
    var info = prop.expression !== "" ? MP.readAnim(prop.expression) : { kind: kind, dims: dims, D: {} };
    if (!info) {
        // An older Motion Panel expression (marker-follow or loop) is replaced; anything else is respected.
        if (MP.startsWith(prop.expression, "// MP marcador")) info = { kind: kind, dims: dims, D: {} };
        else return false;
    }
    info.D[id] = entry;
    prop.expression = MP.animExpr(kind, dims, info.D);
    return true;
};
MP.newWindowId = function () {
    MP._seq = (MP._seq || 0) + 1;
    return "w" + (new Date().getTime()).toString(36) + MP._seq.toString(36);
};
MP.applyTrackExpr = function (layer, comp, track, id, mode, easeName, t0) {
    var props = MP.props(layer, track.prop), i, p;
    if (!props.length) return 0;
    var name = track.prop, kind = MP.animKind(MP.startsWith(name, "fx:") ? "fx" : name);
    var maskR = MP.startsWith(name, "mask:") ? MP.maskGeom(layer, name.substr(5), t0).R : 0;
    var ok = 0;
    for (p = 0; p < props.length; p++) {
        var v0 = props[p].value, dims = (v0 instanceof Array) ? v0.length : 1;
        var keys = [];
        for (i = 0; i < track.keys.length; i++) {
            var c = MP.animContrib(track.keys[i][1], name, comp, props.length > 1 ? 3 : dims, maskR);
            if (props.length > 1) c = c instanceof Array ? (c[p] || 0) : c;  // separated X / Y position
            keys.push([track.keys[i][0], c]);
        }
        if (MP.attachWindow(props[p], id, { m: mode, e: easeName, k: keys }, kind, dims)) ok = 1;
    }
    return ok;
};
// Text: one animator per window ("MP Text <id>"), its selector driven by an expression on the marker.
MP.textDriveExpr = function (id, mode, easeName, from, to) {
    return [
        "// MP anim texto:" + id + " (controlado pelo marcador MP; n\u00e3o edite)",
        "var M = thisLayer.marker, fd = thisComp.frameDuration, u = 1, I = 1, found = false;",
        MP.ANIM_EASE,
        "for (var i = 1; i <= M.numKeys; i++) {",
        "  var mk = M.key(i), p = (mk.cuePointName || \"\").split(\"|\");",
        "  if (p[0] === \"MPW\" && p[1] === \"" + id + "\") {",
        "    found = true;",
        "    u = clamp((time - mk.time) / Math.max(mk.duration, fd), 0, 1);",
        "    if (p[3]) { try { var ef = effect(p[3]); I = ef.active ? ef(1) / 100 : 0; } catch (er) {} }",
        "  }",
        "}",
        "if (\"" + mode + "\" === \"out\") u = 1 - u;",
        "var v = " + from + " + (" + (to - from) + ") * E(u, \"" + easeName + "\");",
        "found ? " + to + " + (v - " + to + ") * I : " + to
    ].join("\n");
};
MP.textAnimatorExpr = function (layer, name, props, unit, shape, random, drive, width, id, mode, easeName) {
    var k;
    var an = layer.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
    an.name = name;
    var idx = an.propertyIndex;
    var A = function () { return layer.property("ADBE Text Properties").property("ADBE Text Animators").property(idx); };
    A().property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    for (k in props) A().property("ADBE Text Animator Properties").addProperty(k);
    for (k in props) A().property("ADBE Text Animator Properties").property(k).setValue(props[k]);
    var S = function () { return A().property("ADBE Text Selectors").property(1); };
    var adv = function () { return S().property("ADBE Text Range Advanced"); };
    adv().property("ADBE Text Range Type2").setValue(unit || 1);
    adv().property("ADBE Text Range Shape").setValue(shape || 1);
    if (random) adv().property("ADBE Text Randomize Order").setValue(1);
    var prop, from, to;
    if (drive === "amount") { prop = adv().property("ADBE Text Selector Max Amount"); from = 100; to = 0; }
    else if (drive === "start") { prop = S().property("ADBE Text Percent Start"); from = 0; to = 100; }
    else {
        var w = width || 35;
        S().property("ADBE Text Percent End").setValue(w);
        prop = S().property("ADBE Text Percent Offset"); from = -w; to = 100;
    }
    prop.setValue(to);
    prop.expression = MP.textDriveExpr(id, mode, easeName, from, to);
};
MP.applyTextExpr = function (layer, preset, id, mode, easeName) {
    if (!(layer instanceof TextLayer)) return 0;
    var t = preset.text, nm = MP.TAG + "Text " + id;
    MP.textAnimatorExpr(layer, nm, t.props, t.unit, t.shape || 1, t.random, t.drive, t.width, id, mode, easeName);
    if (t.wave) MP.textAnimatorExpr(layer, nm + " Onda", t.wave, t.unit, 4, t.random, "offset", t.waveWidth || (t.width || 35), id, mode, easeName);
    return 1;
};
// Marker + Effect Controls entry for a new window. Markers cannot share a time, so a window that
// starts where another marker already is moves by one frame. Returns the control's name.
MP.addAnimMarker = function (layer, id, mode, start, dur, name, fd) {
    var base = MP.windowEffectName(name, mode), fxName = base, n = 2;
    while (MP.findEffect(layer, fxName, "", false)) fxName = base + " " + (n++);
    MP.findEffect(layer, fxName, "ADBE Slider Control", true);
    var ctl = MP.findEffect(layer, fxName, "ADBE Slider Control", false);
    if (ctl) ctl.property(1).setValue(100);
    var mk = layer.property("ADBE Marker"), t = start, guard = 0, busy = true;
    while (busy && guard++ < 50) {
        busy = false;
        for (var k = 1; k <= mk.numKeys; k++) if (Math.abs(mk.keyTime(k) - t) < fd / 4) { busy = true; break; }
        if (busy) t += mode === "out" ? -fd : fd;
    }
    var mv = new MarkerValue("MP \u00b7 " + name + (mode === "out" ? " (sa\u00edda)" : " (entrada)"));
    mv.duration = dur;
    mv.cuePointName = MP.MARKER_TAG + id + "|" + mode + "|" + (ctl ? fxName : "");
    try { mv.label = mode === "out" ? 1 : 9; } catch (x) {}
    layer.property("ADBE Marker").setValueAtTime(Math.max(0, t), mv);
    return ctl ? fxName : "";
};
// Removes window "id": its entry in every generated expression, its text animators, its control and
// marker, and preset effects / reveal masks that no window uses any more.
MP.removeAnimWindow = function (L, id, fxName) {
    var touched = 0, k;
    var walk = function (g) {
        for (var i = 1; i <= g.numProperties; i++) {
            var p = g.property(i);
            if (p.matchName === "ADBE Marker") continue;
            if (p.propertyType === PropertyType.PROPERTY) {
                if (!p.canSetExpression || !MP.startsWith(p.expression, "// MP anim:")) continue;
                var info = MP.readAnim(p.expression);
                if (!info || !info.D[id]) continue;
                delete info.D[id];
                p.expression = MP.hasKeysIn(info.D) ? MP.animExpr(info.kind, info.dims, info.D) : "";
                touched++;
            } else if (p.numProperties) walk(p);
        }
    };
    walk(L);
    if (L instanceof TextLayer) {
        var an = L.property("ADBE Text Properties").property("ADBE Text Animators");
        for (k = an.numProperties; k >= 1; k--) {
            var nm = an.property(k).name;
            if (nm === MP.TAG + "Text " + id || nm === MP.TAG + "Text " + id + " Onda") { an.property(k).remove(); touched++; }
        }
    }
    if (fxName) MP.removeEffectNamed(L, fxName);
    var mk = L.property("ADBE Marker");
    for (k = mk.numKeys; k >= 1; k--) {
        var parts = (mk.keyValue(k).cuePointName || "").split("|");
        if (parts[0] === "MPW" && parts[1] === id) L.property("ADBE Marker").removeKey(k);
    }
    // Leftovers: preset effects and reveal masks without any generated expression.
    var usesAnim = function (g) {
        for (var j = 1; j <= g.numProperties; j++) {
            var q = g.property(j);
            if (q.propertyType === PropertyType.PROPERTY) { if (q.canSetExpression && MP.startsWith(q.expression, "// MP anim:")) return true; }
            else if (q.numProperties && usesAnim(q)) return true;
        }
        return false;
    };
    var fx = L.property("ADBE Effect Parade");
    if (fx) for (k = fx.numProperties; k >= 1; k--) {
        var e = fx.property(k);
        if (e.name === MP.TAG + e.matchName.replace("ADBE ", "") && !usesAnim(e)) e.remove();
    }
    var mp = L.property("ADBE Mask Parade");
    if (mp) for (k = mp.numProperties; k >= 1; k--) {
        var m = mp.property(k);
        if (MP.startsWith(m.name, MP.TAG + "Mask ") && !MP.startsWith(m.property("ADBE Mask Offset").expression, "// MP anim:")) m.remove();
    }
    return touched;
};

// ---------------------------------------------------------------- entry point: presets
// args: { preset, mode: "in"|"out"|"both", frames, stagger, anchor: "layer"|"playhead" }
MP.apply = function (argStr) {
    var a;
    try { a = MP.parse(argStr); } catch (e) { return "error:argumentos inv\u00e1lidos"; }
    var comp = MP.comp();
    if (!comp) return "error:Abra uma composi\u00e7\u00e3o.";
    var layers = comp.selectedLayers;
    if (!layers.length) return "error:Selecione pelo menos uma layer.";

    var pr = a.preset, type = pr.type || "transform";
    var fd = comp.frameDuration, dur = a.frames * fd;
    var ease = MP.EASES[pr.ease] || MP.EASES.smooth;
    var modes = a.mode === "both" ? ["in", "out"] : [a.mode];
    var done = 0, skipped = 0, i, m;

    // One animation window on one layer: marker + control + generated expressions (no keyframes).
    // Several windows can be stacked on the same layer and they combine.
    var easeName = MP.EASES[pr.ease] ? pr.ease : "smooth";
    var applyWindow = function (layer, mode, start) {
        var id = MP.newWindowId(), ok = 0, j;
        if (pr.threeD && layer.threeDLayer === false) layer.threeDLayer = true;
        // Marker and control first: adding an effect invalidates property references fetched earlier.
        var fxName = MP.addAnimMarker(layer, id, mode, start, dur, pr.name, fd);
        if (type === "text") ok = MP.applyTextExpr(layer, pr, id, mode, easeName);
        else {
            for (j = 0; j < pr.tracks.length; j++) {
                if (MP.startsWith(pr.tracks[j].prop, "fx:")) MP.ensureFx(layer, pr.tracks[j]);
                if (MP.startsWith(pr.tracks[j].prop, "mask:")) MP.ensureMask(layer, pr.tracks[j].prop.substr(5), start);
            }
            for (j = 0; j < pr.tracks.length; j++) ok += MP.applyTrackExpr(layer, comp, pr.tracks[j], id, mode, easeName, start);
        }
        if (!ok) MP.removeAnimWindow(layer, id, fxName);
        return ok;
    };

    app.beginUndoGroup("Motion Panel: " + pr.name);
    try {
        if (a.mode === "scenes") {
            // Scene transition: order by in-point, overlap each pair by the duration,
            // then animate the outgoing layer out and the incoming layer in over the same window.
            if (layers.length < 2 || type === "loop") { app.endUndoGroup(); return "error:Selecione 2 ou mais layers (cenas) para a transi\u00e7\u00e3o."; }
            var seq = [];
            for (i = 0; i < layers.length; i++) seq.push(layers[i]);
            seq.sort(function (x, y) { return x.inPoint - y.inPoint; });
            for (i = 1; i < seq.length; i++) {
                var A = seq[i - 1], B = seq[i];
                if (a.overlap !== false) B.startTime += (A.outPoint - dur) - B.inPoint;
                var okA = applyWindow(A, "out", A.outPoint - dur), okB = applyWindow(B, "in", B.inPoint);
                if (okA || okB) done++;
            }
            app.endUndoGroup();
            return done ? "ok:" + done + " transi\u00e7\u00e3o(\u00f5es) entre cenas" : "error:Nenhuma layer compat\u00edvel.";
        }
        for (i = 0; i < layers.length; i++) {
            var layer = layers[i], ok = 0;
            if (type === "loop") {
                ok = MP.applyLoop(layer, pr);
            } else {
                var off = i * (a.stagger || 0) * fd;
                for (m = 0; m < modes.length; m++) {
                    var start;
                    if (modes[m] === "in") start = (a.anchor === "playhead" ? comp.time : layer.inPoint) + off;
                    else start = (a.anchor === "playhead" ? comp.time : layer.outPoint) - dur - off;
                    ok += applyWindow(layer, modes[m], start);
                }
            }
            if (ok) done++; else skipped++;
        }
    } catch (err) {
        app.endUndoGroup();
        return "error:" + err.toString() + " (linha " + err.line + ")";
    }
    app.endUndoGroup();
    if (!done) return "error:" + (type === "text" ? "Selecione uma layer de texto." : "Nenhuma layer compat\u00edvel.");
    return "ok:" + done + (skipped ? " (" + skipped + " ignorada(s))" : "");
};

// ---------------------------------------------------------------- entry point: tools
MP.tool = function (argStr) {
    var a;
    try { a = MP.parse(argStr); } catch (e) { return "error:argumentos inv\u00e1lidos"; }
    var comp = MP.comp();
    if (!comp) return "error:Abra uma composi\u00e7\u00e3o.";
    var layers = comp.selectedLayers, fd = comp.frameDuration, n = 0, i, j;
    var needLayers = { sequence: 1, motionBlur: 1, nullParent: 1, counter: 1, centerAnchor: 1 };
    if (needLayers[a.id] && !layers.length) return "error:Selecione pelo menos uma layer.";

    app.beginUndoGroup("Motion Panel: " + a.id);
    try {
        if (a.id === "sequence") {
            var ref = layers[0].inPoint;
            for (i = 0; i < layers.length; i++) {
                var target = ref + i * a.frames * fd;
                layers[i].startTime += target - layers[i].inPoint;
                n++;
            }
        } else if (a.id === "loop" || a.id === "ease") {
            var sp = comp.selectedProperties;
            for (i = 0; i < sp.length; i++) {
                var p = sp[i];
                if (p.propertyType !== PropertyType.PROPERTY) continue;
                if (a.id === "loop") {
                    if (p.canSetExpression && p.numKeys > 1) { p.expression = 'loopOut("' + a.kind + '")'; n++; }
                } else {
                    var sk = p.selectedKeys;
                    for (j = 0; j < sk.length; j++) { MP.setEase(p, sk[j], a.inf[0], a.inf[1]); n++; }
                }
            }
            if (!n) { app.endUndoGroup(); return "error:" + (a.id === "loop" ? "Selecione propriedades com 2+ keyframes." : "Selecione keyframes na timeline."); }
        } else if (a.id === "motionBlur") {
            var on = !layers[0].motionBlur;
            comp.motionBlur = true;
            for (i = 0; i < layers.length; i++) { try { layers[i].motionBlur = on; n++; } catch (x) {} }
        } else if (a.id === "nullParent") {
            var sx = 0, sy = 0;
            for (i = 0; i < layers.length; i++) {
                var pv = layers[i].property("ADBE Transform Group").property("ADBE Position").value;
                sx += pv[0]; sy += pv[1];
            }
            var nl = comp.layers.addNull();
            nl.name = MP.TAG + "Controle";
            nl.property("ADBE Transform Group").property("ADBE Position").setValue([sx / layers.length, sy / layers.length]);
            for (i = 0; i < layers.length; i++) if (!layers[i].parent) { layers[i].parent = nl; n++; }
        } else if (a.id === "centerAnchor") {
            for (i = 0; i < layers.length; i++) {
                var L = layers[i];
                if (!(L instanceof AVLayer) && !(L instanceof TextLayer) && !(L instanceof ShapeLayer)) continue;
                var r = L.sourceRectAtTime(comp.time, false);
                var tg = L.property("ADBE Transform Group");
                var ap = tg.property("ADBE Anchor Point"), pos = tg.property("ADBE Position");
                if (ap.numKeys || pos.numKeys || pos.dimensionsSeparated) continue;
                var old = ap.value, nw = [r.left + r.width / 2, r.top + r.height / 2];
                var sc = tg.property("ADBE Scale").value, rot = tg.property("ADBE Rotate Z").value * Math.PI / 180;
                var dx = (nw[0] - old[0]) * sc[0] / 100, dy = (nw[1] - old[1]) * sc[1] / 100;
                var pv2 = pos.value;
                ap.setValue(old.length > 2 ? [nw[0], nw[1], old[2]] : nw);
                var np = [pv2[0] + dx * Math.cos(rot) - dy * Math.sin(rot), pv2[1] + dx * Math.sin(rot) + dy * Math.cos(rot)];
                pos.setValue(pv2.length > 2 ? [np[0], np[1], pv2[2]] : np);
                n++;
            }
        } else if (a.id === "counter") {
            for (i = 0; i < layers.length; i++) {
                var T = layers[i];
                if (!(T instanceof TextLayer)) continue;
                MP.findEffect(T, MP.TAG + "Contador", "ADBE Slider Control", true);
                MP.findEffect(T, MP.TAG + "Casas decimais", "ADBE Slider Control", true);
                var cnt = MP.findEffect(T, MP.TAG + "Contador", "ADBE Slider Control", false).property(1);
                MP.findEffect(T, MP.TAG + "Casas decimais", "ADBE Slider Control", false).property(1).setValue(a.decimals || 0);
                while (cnt.numKeys) cnt.removeKey(1);
                var t0 = T.inPoint, t1 = T.inPoint + a.frames * fd;
                MP.addKey(cnt, t0, a.from || 0, [33, 15], false);
                MP.addKey(cnt, t1, a.to, [90, 33], false);
                T.property("ADBE Text Properties").property("ADBE Text Document").expression =
                    '// MP contador\nvar v = effect("MP Contador")(1), d = Math.max(0, Math.round(effect("MP Casas decimais")(1)));\n' +
                    'var s = Math.abs(v).toFixed(d).split(".");\n' +
                    's[0] = s[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");\n' +
                    '(v < 0 ? "-" : "") + "' + (a.prefix || "") + '" + s.join(",") + "' + (a.suffix || "") + '"';
                n++;
            }
            if (!n) { app.endUndoGroup(); return "error:Selecione uma layer de texto."; }
        }
    } catch (err) {
        app.endUndoGroup();
        return "error:" + err.toString() + " (linha " + err.line + ")";
    }
    app.endUndoGroup();
    return "ok:" + n;
};

// ---------------------------------------------------------------- load workflow tools
MP.loadTools = function (dir) {
    try {
        var f = new File((dir || File($.fileName).path) + "/tools.jsx");
        if (f.exists) { $.evalFile(f); return "ok:tools"; }
        return "error:tools.jsx n\u00e3o encontrado em " + f.fsName;
    } catch (e) { return "error:" + e.toString() + (e.line ? " (linha " + e.line + " de tools.jsx)" : ""); }
};
try { MP.loadTools(); } catch (e) {}

// ---------------------------------------------------------------- inspector (aba Editar)
// MP.inspect() describes the first selected layer: its MP animation windows (from markers) and every
// effect named "MP ..." with the editable value of expression-control effects.
MP.CONTROL_TYPES = { "ADBE Slider Control": "num", "ADBE Angle Control": "num", "ADBE Color Control": "color", "ADBE Checkbox Control": "check" };
MP.json = function (v) {
    if (typeof MPT !== "undefined" && MPT.json) return MPT.json(v);
    return "null";
};
MP.targetLayer = function (a) {
    var comp = MP.comp();
    if (!comp) return null;
    var L = comp.selectedLayers.length ? comp.selectedLayers[0] : null;
    if (a && a.layerIndex && (!L || L.index !== a.layerIndex)) {
        try { L = comp.layer(a.layerIndex); } catch (e) { L = null; }
    }
    return L;
};
MP.inspect = function () {
    var comp = MP.comp();
    if (!comp) return "json:" + MP.json({ layer: null, reason: "Abra uma composi\u00e7\u00e3o." });
    var L = MP.targetLayer();
    if (!L) return "json:" + MP.json({ layer: null, reason: "Selecione uma layer na composi\u00e7\u00e3o." });
    var fx = L.property("ADBE Effect Parade"), out = { comp: comp.name, fps: comp.frameRate, time: comp.time, layer: L.name, layerIndex: L.index, windows: [], effects: [] }, i;
    var mk = L.property("ADBE Marker");
    for (i = 1; i <= mk.numKeys; i++) {
        var v = mk.keyValue(i), c = v.cuePointName || "";
        if (!MP.startsWith(c, MP.MARKER_TAG)) continue;
        // New format "MPW|id|mode|control"; older keyframe-based format "MPW|k0|k1|mode|control".
        var p = c.split("|"), legacy = p.length >= 5;
        var w = { id: legacy ? "" : p[1], legacy: legacy, mode: legacy ? p[3] : p[2], fx: (legacy ? p[4] : p[3]) || "",
                  name: v.comment, start: mk.keyTime(i), dur: v.duration, intensity: null, on: true };
        var e = fx ? MP.findEffect(L, w.fx, "", false) : null;
        if (e) { w.intensity = e.property(1).value; w.on = e.enabled; }
        out.windows.push(w);
    }
    if (fx) for (i = 1; i <= fx.numProperties; i++) {
        var ef = fx.property(i);
        if (!MP.startsWith(ef.name, MP.TAG) || MP.startsWith(ef.name, "MP > ")) continue;
        var t = MP.CONTROL_TYPES[ef.matchName], item = { name: ef.name, on: ef.enabled, type: t || "fx" };
        if (t) { var pr = ef.property(1); item.value = pr.value; item.keyed = pr.numKeys > 0; item.expr = pr.expressionEnabled && pr.expression !== ""; }
        out.effects.push(item);
    }
    return "json:" + MP.json(out);
};
// Deletes the keyframes of one animation window [k0, k1] on every property of the layer, puts back
// the resting value (end of an entrance / start of an exit) and drops the marker expression where
// no keys are left. Returns how many properties were touched.
MP.removeWindowKeys = function (L, k0, k1, mode, fd) {
    var eps = fd / 2, touched = 0, restTime = mode === "out" ? k0 : k1;
    var walk = function (g) {
        for (var i = 1; i <= g.numProperties; i++) {
            var p = g.property(i);
            if (p.matchName === "ADBE Marker") continue;
            if (p.propertyType === PropertyType.PROPERTY) {
                if (!p.numKeys) continue;
                var hit = false, rest = null, k;
                try { rest = p.valueAtTime(restTime, true); } catch (e) {}
                for (k = p.numKeys; k >= 1; k--) {
                    var t = p.keyTime(k);
                    if (t >= k0 - eps && t <= k1 + eps) { p.removeKey(k); hit = true; }
                }
                if (!hit) continue;
                touched++;
                if (!p.numKeys) {
                    if (rest !== null) { try { p.setValue(rest); } catch (e2) {} }
                    if (p.canSetExpression && MP.startsWith(p.expression, "// MP marcador")) p.expression = "";
                }
            } else if (p.numProperties) walk(p);
        }
    };
    walk(L);
    return touched;
};
// Removes what only that animation needed: its text animators, preset effects and reveal masks
// that no longer have any keyframes (another window still using them keeps them alive).
MP.cleanupWindowLeftovers = function (L, mode) {
    var k, i, hasKeys = function (g) {
        for (var j = 1; j <= g.numProperties; j++) {
            var p = g.property(j);
            if (p.propertyType === PropertyType.PROPERTY) { if (p.numKeys) return true; }
            else if (p.numProperties && hasKeys(p)) return true;
        }
        return false;
    };
    if (L instanceof TextLayer) {
        var nm = MP.TAG + "Text " + (mode === "out" ? "Out" : "In");
        var an = L.property("ADBE Text Properties").property("ADBE Text Animators");
        for (k = an.numProperties; k >= 1; k--) if (an.property(k).name === nm || an.property(k).name === nm + " Onda") an.property(k).remove();
    }
    var fx = L.property("ADBE Effect Parade");
    if (fx) for (k = fx.numProperties; k >= 1; k--) {
        var e = fx.property(k);
        // Preset effects are named "MP " + match name without "ADBE " (see MP.fxInfo).
        if (e.name === MP.TAG + e.matchName.replace("ADBE ", "") && !hasKeys(e)) e.remove();
    }
    var mp = L.property("ADBE Mask Parade");
    if (mp) for (i = mp.numProperties; i >= 1; i--) {
        var m = mp.property(i);
        if (MP.startsWith(m.name, MP.TAG + "Mask ") && !m.property("ADBE Mask Offset").numKeys) m.remove();
    }
};

// a: { op, layerIndex, fx?, value?, on?, mode?, start?, dur? }
MP.edit = function (argStr) {
    var a;
    try { a = MP.parse(argStr); } catch (e) { return "error:argumentos inv\u00e1lidos"; }
    var comp = MP.comp(), L = MP.targetLayer(a);
    if (!comp || !L) return "error:Selecione a layer.";
    app.beginUndoGroup("Motion Panel: editar");
    try {
        if (a.op === "param" || a.op === "enable") {
            var e = MP.findEffect(L, a.fx, "", false);
            if (!e) throw new Error("Efeito n\u00e3o encontrado: " + a.fx);
            if (a.op === "enable") e.enabled = !!a.on;
            else {
                var p = e.property(1), v = a.value;
                if (p.numKeys) p.setValueAtTime(comp.time, v); else p.setValue(v);
            }
        } else if (a.op === "removeGroup") {
            a.removedProps = MP.removeGroup(L, a.names || [], a.prefix || "");
        } else if (a.op === "window" || a.op === "remove") {
            var mk = L.property("ADBE Marker"), found = false;
            for (var k = mk.numKeys; k >= 1; k--) {
                var mv = mk.keyValue(k), c = mv.cuePointName || "", parts = c.split("|");
                if (!MP.startsWith(c, MP.MARKER_TAG)) continue;
                var legacy = parts.length >= 5;
                // New windows are identified by id; older keyframe-based ones by their mode.
                if (a.id ? (legacy || parts[1] !== a.id) : (!legacy || parts[3] !== a.mode)) continue;
                found = true;
                if (a.op === "remove" && !legacy) {
                    // Expression-based window: drop it from every generated expression (no keyframes exist).
                    a.removedProps = MP.removeAnimWindow(L, parts[1], parts[3]);
                } else if (a.op === "remove") {
                    // Older keyframe-based window: delete its keyframes and restore the resting value.
                    var removed = MP.removeWindowKeys(L, parseFloat(parts[1]), parseFloat(parts[2]), parts[3], comp.frameDuration);
                    MP.removeEffectNamed(L, parts[4]);
                    L.property("ADBE Marker").removeKey(k);
                    MP.cleanupWindowLeftovers(L, parts[3]);
                    a.removedProps = removed;
                } else {
                    var nv = new MarkerValue(mv.comment);
                    nv.cuePointName = c;
                    nv.duration = Math.max(comp.frameDuration, a.dur);
                    try { nv.label = mv.label; } catch (x) {}
                    L.property("ADBE Marker").removeKey(k);
                    L.property("ADBE Marker").setValueAtTime(Math.max(0, a.start), nv);
                }
                break;
            }
            if (!found) throw new Error("Marcador da anima\u00e7\u00e3o n\u00e3o encontrado.");
        }
    } catch (err) {
        app.endUndoGroup();
        return "error:" + (err.message || err.toString());
    }
    app.endUndoGroup();
    return "ok:" + (a.removedProps !== undefined ? a.removedProps : 1);
};

// ---------------------------------------------------------------- remove one effect group completely
// names: effect names of the group (sliders, checkboxes, native effects such as "MP Glow - Raio").
// Deletes those effects, every expression that references them (or is tagged "// MP <prefix>"),
// the keyframes left on those expression-driven properties and MP text animators of the group.
MP.walkProps = function (g, fn) {
    for (var i = 1; i <= g.numProperties; i++) {
        var p = g.property(i);
        if (!p) continue;
        if (p.propertyType === PropertyType.PROPERTY) fn(p);
        else MP.walkProps(p, fn);
    }
};
MP.removeGroup = function (L, names, prefix) {
    var n = 0, i, fx = L.property("ADBE Effect Parade"), tag = prefix ? "// MP " + prefix.replace(/^MP /, "") : "";
    var refs = function (expr) {
        if (tag && expr.indexOf(tag) === 0) return true;
        for (var k = 0; k < names.length; k++) if (expr.indexOf('"' + names[k] + '"') >= 0) return true;
        return false;
    };
    // 1) expressions (and their keyframes) on the other properties of the layer
    var targets = [];
    MP.walkProps(L, function (p) {
        try { if (p.canSetExpression && p.expression && refs(p.expression)) targets.push(p); } catch (e) {}
    });
    for (i = 0; i < targets.length; i++) {
        var p = targets[i];
        try { p.expression = ""; while (p.numKeys) p.removeKey(1); n++; } catch (e2) {}
    }
    // 2) the effects themselves (their own keyframes go with them)
    if (fx) for (i = fx.numProperties; i >= 1; i--) {
        var ef = fx.property(i), hit = false;
        for (var k = 0; k < names.length; k++) if (ef.name === names[k]) hit = true;
        if (!hit && prefix && MP.startsWith(ef.name, prefix)) hit = true;
        if (hit) { ef.remove(); n++; }
    }
    // 3) text animators created by the group
    if (prefix && L instanceof TextLayer) {
        var an = L.property("ADBE Text Properties").property("ADBE Text Animators");
        for (i = an.numProperties; i >= 1; i--) if (MP.startsWith(an.property(i).name, prefix)) { an.property(i).remove(); n++; }
    }
    return n;
};

// ---------------------------------------------------------------- clear
// Removes keyframes on transform properties, MP expressions, MP effects and MP text animators.
MP.clear = function () {
    var comp = MP.comp();
    if (!comp) return "error:Abra uma composi\u00e7\u00e3o.";
    var layers = comp.selectedLayers;
    if (!layers.length) return "error:Selecione pelo menos uma layer.";
    var names = ["opacity", "scale", "rotation", "rotX", "rotY", "position"], i, n, p, k;
    app.beginUndoGroup("Motion Panel: limpar");
    for (i = 0; i < layers.length; i++) {
        var L = layers[i];
        for (n = 0; n < names.length; n++) {
            var props = MP.props(L, names[n]);
            for (p = 0; p < props.length; p++) {
                var pr = props[p];
                if (pr.canSetExpression && MP.startsWith(pr.expression, "// MP")) pr.expression = "";
                if (pr.numKeys) {
                    var v = pr.valueAtTime(comp.time, false);
                    while (pr.numKeys) pr.removeKey(1);
                    pr.setValue(v);
                }
            }
        }
        var fx = L.property("ADBE Effect Parade");
        if (fx) for (k = fx.numProperties; k >= 1; k--) if (MP.startsWith(fx.property(k).name, MP.TAG)) fx.property(k).remove();
        var mp = L.property("ADBE Mask Parade");
        if (mp) for (k = mp.numProperties; k >= 1; k--) if (MP.startsWith(mp.property(k).name, MP.TAG)) mp.property(k).remove();
        var mk = L.property("ADBE Marker");
        for (k = mk.numKeys; k >= 1; k--) if (MP.startsWith(mk.keyValue(k).cuePointName || "", MP.MARKER_TAG)) mk.removeKey(k);
        if (L instanceof TextLayer) {
            var an = L.property("ADBE Text Properties").property("ADBE Text Animators");
            for (k = an.numProperties; k >= 1; k--) if (MP.startsWith(an.property(k).name, MP.TAG)) an.property(k).remove();
            var doc = L.property("ADBE Text Properties").property("ADBE Text Document");
            if (MP.startsWith(doc.expression, "// MP")) doc.expression = "";
        }
    }
    app.endUndoGroup();
    return "ok:" + layers.length;
};
