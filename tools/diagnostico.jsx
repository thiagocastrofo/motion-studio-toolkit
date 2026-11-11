// Motion Studio Toolkit - diagnostic. Run in After Effects: File > Scripts > Run Script File...
// Creates a temporary comp, exercises every toolkit tool and shows a report (everything it created is removed).
(function () {
    var R = [], i;
    function log(s) { R.push(s); }
    var ext = Folder.userData.fsName + "/Adobe/CEP/extensions/com.thiago.motionstudio/host/studio.jsx";
    var f = new File(ext);
    if (!f.exists) { alert("Motion Studio Toolkit nao esta instalado:\n" + ext); return; }
    $.evalFile(f);
    MST.load();
    function q(o) { return MPT.json(o); }
    var before = {};
    for (i = 1; i <= app.project.numItems; i++) before[app.project.item(i).id] = true;
    try {
        var comp = app.project.items.addComp("MST_DIAG", 1920, 1080, 1, 10, 30);
        comp.openInViewer();
        function wipe() { while (comp.numLayers) comp.layer(1).remove(); }
        function rec(label, fn) {
            var r;
            try { r = fn(); } catch (e) { r = "error:" + e.toString() + " (linha " + e.line + ")"; }
            log((r && (r.indexOf("ok:") === 0 || r.indexOf("json:") === 0) ? "ok   " : "FAIL ") + label + " -> " + String(r).substr(0, 160));
        }
        function solids(n) {
            wipe();
            var out = [];
            for (var k = 0; k < n; k++) { var S = comp.layers.addSolid([0.3, 0.6, 1], "S" + k, 200, 200, 1, 4); S.startTime = k * 0.3; out.push(S); }
            for (k = 0; k < out.length; k++) out[k].selected = true;
            return out;
        }
        function texts(str) {
            wipe();
            var T = comp.layers.addText(str); T.selected = true; return T;
        }
        rec("stInfo", function () { solids(2); return MPT.run(q({ id: "stInfo" })); });
        var MODES = [["offset", "linear"], ["offset", "out"], ["chain", "linear"], ["trim", "inout"]], ORD = ["top", "bottom", "sel", "random"];
        for (i = 0; i < MODES.length; i++) {
            solids(5);
            rec("sequencePro " + MODES[i][0] + "/" + MODES[i][1] + "/" + ORD[i], function () {
                var r = MPT.run(q({ id: "sequencePro", frames: 6, order: ORD[i], mode: MODES[i][0], curve: MODES[i][1], step: i === 1 ? 2 : 1, from: "first", reverse: i === 2 }));
                if (r.indexOf("ok:") !== 0) return r;
                var ins = []; for (var k = 1; k <= comp.numLayers; k++) ins.push(Math.round(comp.layer(k).inPoint * 30));
                return r + " in=" + ins.join(",");
            });
        }
        solids(3); rec("sequencePro playhead", function () { comp.time = 2; return MPT.run(q({ id: "sequencePro", frames: -3, order: "top", mode: "offset", curve: "linear", step: 1, from: "playhead" })); });
        texts("Motion Studio\nToolkit");
        rec("typeIt", function () {
            var r = MPT.run(q({ id: "typeIt", unit: "c", speed: 10, cursor: true, blink: 2, erase: 1, cursorChar: "|" }));
            var T = comp.layer(1), st = T.property("ADBE Text Properties").property("ADBE Text Document");
            return r + " t=0.5 -> \"" + String(st.valueAtTime(T.inPoint + 0.5, false).text) + "\"";
        });
        var U = ["c", "w", "l"];
        for (i = 0; i < U.length; i++) { texts("Make it\nmove"); rec("textSlice " + U[i], function () { return MPT.run(q({ id: "textSlice", unit: U[i], hide: true, label: true })) + " layers=" + comp.numLayers; }); }
        wipe();
        var caps = [{ s: 0.5, e: 2, t: "Ola mundo novo", w: [] }, { s: 2.2, e: 4, t: "Segunda legenda aqui", w: [0, 0.4, 0.9] }];
        var look = { size: 64, color: "#ffffff", y: 85, hi: true, hiColor: "#ffd60a", plate: true, plateColor: "#000000", plateOpacity: 75, shadow: true, motion: "slide", per: "word", mDur: 6 };
        rec("ccImport", function () { return MPT.run(q({ id: "ccImport", captions: caps, style: look, replace: true })); });
        rec("ccCount", function () { return MPT.run(q({ id: "ccCount" })); });
        look.per = "caption"; look.motion = "scale"; look.plate = false;
        rec("ccStyle (caption/scale)", function () { return MPT.run(q({ id: "ccStyle", style: look })); });
        rec("ccSelect", function () { return MPT.run(q({ id: "ccSelect" })); });
        rec("expressions ok", function () {
            var bad = 0;
            for (var k = 1; k <= comp.numLayers; k++) {
                var L = comp.layer(k), tr = L.property("ADBE Transform Group");
                for (var j = 1; j <= tr.numProperties; j++) { var p = tr.property(j); if (p.canSetExpression && p.expression && p.expressionError) bad++; }
            }
            return bad ? "error:" + bad + " expressao(oes) com erro" : "ok:sem erros de expressao";
        });
    } catch (err) { log("FATAL " + err.toString() + " (line " + err.line + ")"); }
    try {
        var created = [];
        for (i = 1; i <= app.project.numItems; i++) if (!before[app.project.item(i).id]) created.push(app.project.item(i));
        for (i = created.length - 1; i >= 0; i--) { try { created[i].remove(); } catch (e) {} }
    } catch (e) {}
    var fails = 0;
    for (i = 0; i < R.length; i++) if (R[i].indexOf("FAIL") === 0 || R[i].indexOf("FATAL") === 0) fails++;
    var w = new Window("dialog", "Motion Studio Toolkit - diagnostico (" + fails + " falha(s))");
    var t = w.add("edittext", undefined, R.join("\n"), { multiline: true, scrolling: true });
    t.preferredSize = [720, 420];
    w.add("button", undefined, "OK");
    w.show();
})();
