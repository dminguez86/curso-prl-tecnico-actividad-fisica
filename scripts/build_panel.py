#!/usr/bin/env python3
"""Regenera panel/index.html (inyecta el logo) y copia la plantilla del certificado.

Uso, desde la raíz del repositorio:

    python3 scripts/build_panel.py

El logo se toma del panel ya publicado o, si no está, de /workspace/est/logo.txt.
"""
from pathlib import Path
import re, shutil, sys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "panel.html"
DST = ROOT / "panel" / "index.html"
TPL_SRC = ROOT / "src" / "certificado-plantilla.html"
TPL_DST = ROOT / "panel" / "certificado-plantilla.html"

def logo():
    if DST.exists():
        m = re.search(r'<header class="noprint"><img src="(data:image/[^"]+)"', DST.read_text())
        if m:
            return m.group(1)
    p = Path("/workspace/est/logo.txt")
    if p.exists():
        return p.read_text().strip()
    sys.exit("No se encontró el logo de Previjob (ni en panel/index.html ni en /workspace/est/logo.txt)")

def main():
    html = SRC.read_text()
    if "__LOGO__" not in html:
        sys.exit("src/panel.html no tiene el marcador __LOGO__")
    DST.write_text(html.replace("__LOGO__", logo()))
    if not TPL_SRC.exists():
        sys.exit("Falta " + str(TPL_SRC))
    shutil.copyfile(TPL_SRC, TPL_DST)
    copied=["panel/index.html", "panel/certificado-plantilla.html"]
    for name in ("firma-sello.png", "logo-certificado.png"):
        src, dst = ROOT/"src"/name, ROOT/"panel"/name
        if not src.exists():
            sys.exit("Falta "+str(src))
        shutil.copyfile(src, dst)
        copied.append("panel/"+name)
    print("Actualizados:", ", ".join(copied))

if __name__ == "__main__":
    main()
