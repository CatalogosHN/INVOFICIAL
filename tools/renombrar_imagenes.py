#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Renombra imágenes en orden: img1.png, img2.jpg, img3.webp...

Uso:
python tools/renombrar_imagenes.py --carpeta fotos
python tools/renombrar_imagenes.py --carpeta fotos --prefijo producto --inicio 1
"""

from __future__ import annotations

import argparse
from pathlib import Path

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Renombrar imágenes de forma sucesiva.")
    parser.add_argument("--carpeta", required=True, help="Carpeta donde están las imágenes.")
    parser.add_argument("--prefijo", default="img", help="Prefijo del nombre final.")
    parser.add_argument("--inicio", type=int, default=1, help="Número inicial.")
    args = parser.parse_args()

    folder = Path(args.carpeta).resolve()
    if not folder.exists():
        raise FileNotFoundError(f"No existe la carpeta: {folder}")

    files = sorted([p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS])
    if not files:
        print("No encontré imágenes para renombrar.")
        return

    # Paso temporal para evitar choques de nombres.
    temp_files = []
    for index, file in enumerate(files, start=args.inicio):
        temp = file.with_name(f"__tmp_rename_{index}{file.suffix.lower()}")
        file.rename(temp)
        temp_files.append((temp, index))

    for temp, index in temp_files:
        final = folder / f"{args.prefijo}{index}{temp.suffix.lower()}"
        temp.rename(final)
        print(f"✅ {final.name}")

    print(f"Listo. Imágenes renombradas: {len(temp_files)}")


if __name__ == "__main__":
    main()
