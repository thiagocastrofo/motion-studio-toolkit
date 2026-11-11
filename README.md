# Motion Studio Toolkit

After Effects panel (CEP) for motion design: create layers, anchor, align, sequence, an animation library with
looping previews, tools (glow, camera, curves, fonts, shapes, gradients, expressions, audio, text and captions)
and an editor for the effects applied to the selected layer. Light/dark follows After Effects; titles and
explanations can each be in Portuguese or English.

Requires **After Effects 2022 or newer** (Windows and macOS).

## Install
Download the installer from the latest [Release](../../releases):

| System | File | Notes |
|---|---|---|
| Windows | `MotionStudioToolkit-<version>-Windows.exe` | installs for the current user, no admin rights |
| macOS | `MotionStudioToolkit-<version>-macOS.pkg` | installs for all users (asks for the password). The package is not notarized: if macOS blocks it, right-click › Open |
| Any | `MotionStudioToolkit-<version>.zxp` | signed extension for ZXP installers (aescripts ZXP Installer, Anastasiy's) |

Then quit After Effects completely, open it again and use **Window › Extensions › Motion Studio Toolkit**.

## Repository layout
```
CSXS/manifest.xml        extension manifest (id com.thiago.motionstudio)
client/                  panel UI: app.js, icons.js, ds.css (design system), mp-bridge.css
client/mp/               bundled Motion Panel engine UI (animation library, tools, edit); panel.html = its markup
host/                    ExtendScript: studio.jsx (toolkit) + host.jsx / tools.jsx (engine), ES3 + ASCII only
icons/                   panel and app icons (tools/make-icons.js)
design-system/README.md  tokens, components and animated icon verbs
tools/                   compose.js (builds index.html), dev-server.js (browser preview), diagnostico.jsx (AE test)
scripts/stage.js         assembles the shipping extension into dist/stage
installer/               Windows (Inno Setup) and macOS (pkgbuild) installers
.github/workflows/       CI: signs the .zxp and builds both installers on every v* tag
```

## Develop
- Browser preview: `node tools/dev-server.js`, then open `http://127.0.0.1:5179/__frame?w=360&h=900`.
- Test in After Effects: run `tools/diagnostico.jsx` (File › Scripts › Run Script File…).
- Host scripts must stay ES3 and ASCII (ExtendScript): no `let`, arrow functions or non-ASCII characters
  (use `\uXXXX` escapes).

## Release
1. Commit your changes.
2. Tag and push: `git tag v1.0.0 && git push origin v1.0.0`.
3. GitHub Actions signs the extension and attaches the `.zxp`, `.exe` and `.pkg` to the release.

The signing certificate is a personal self-signed certificate stored as repository secrets
`ZXP_CERT_BASE64` and `ZXP_CERT_PASSWORD`; it is never committed.
