#!/bin/bash
# Motion Studio Toolkit - macOS installer (.pkg). Run on macOS:
#   installer/mac/build-pkg.sh <signed .zxp> <version> <output dir>
# Installs the signed extension for every user in /Library/Application Support/Adobe/CEP/extensions.
set -euo pipefail
ZXP="$1"; VERSION="$2"; OUT="${3:-dist/out}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
mkdir -p "$WORK/root" "$OUT"
# a .zxp is a zip: its contents (including META-INF/signatures.xml) are what After Effects verifies
unzip -q "$ZXP" -d "$WORK/root"
chmod +x "$HERE/scripts/"*
pkgbuild --root "$WORK/root" \
  --identifier com.thiago.motionstudio \
  --version "$VERSION" \
  --install-location "/Library/Application Support/Adobe/CEP/extensions/com.thiago.motionstudio" \
  --scripts "$HERE/scripts" \
  "$OUT/MotionStudioToolkit-$VERSION-macOS.pkg"
rm -rf "$WORK"
echo "built $OUT/MotionStudioToolkit-$VERSION-macOS.pkg"
