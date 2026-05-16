#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Carga masiva de productos para WebOwnerAdmin / INVOFICIAL.

Formato recomendado por línea:
Nombre del producto | stock | costo | minStock | fecha YYYY-MM-DD | imagen

Ejemplo:
Chaleco reflectivo completo Naranja | 60 | 50 | 10 | 2026-05-16 | img1.png

Uso:
python tools/cargar_productos_masivo.py --seccion items --entrada tools/productos_masivos.txt --imagenes fotos
python tools/cargar_productos_masivo.py --seccion rauda --entrada tools/productos_masivos.txt --imagenes fotos
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import uuid
from datetime import datetime, timezone, date
from pathlib import Path
from zoneinfo import ZoneInfo

HN_TZ = ZoneInfo("America/Tegucigalpa")
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def now_meta() -> tuple[str, str]:
    now_hn = datetime.now(HN_TZ)
    return now_hn.isoformat(), now_hn.strftime("%d/%m/%Y, %I:%M:%S %p")


def today_value() -> str:
    return datetime.now(HN_TZ).date().isoformat()


def normalize_date(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return today_value()

    # YYYY-MM-DD
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        pass

    # DD/MM/YYYY or D/M/YYYY
    match = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", value)
    if match:
        day, month, year = map(int, match.groups())
        return date(year, month, day).isoformat()

    raise ValueError(f"Fecha inválida: {value}. Usa YYYY-MM-DD o DD/MM/YYYY.")


def date_text(value: str) -> str:
    d = date.fromisoformat(value)
    return f"{d.day}/{d.month}/{d.year}"


def to_number(value: str, default: float = 0) -> float:
    value = str(value or "").strip().replace(",", ".")
    if not value:
        return default
    return float(value)


def to_int(value: str, default: int = 0) -> int:
    return int(round(to_number(value, default)))


def load_store(path: Path) -> dict:
    if not path.exists():
        return {
            "version": 2,
            "app": "WebOwnerAdmin",
            "schema": "WebOwnerAdmin.v2",
            "schemaNote": "recordDate = fecha real del movimiento; receivedAt/createdAt = fecha y hora en que la web recibió el dato.",
            "items": [],
            "rauda": [],
            "clients": [],
            "caex": [],
            "salesEncuentro": [],
            "salesMoto": [],
            "salesCaex": [],
            "expenses": [],
        }
    return json.loads(path.read_text(encoding="utf-8"))


def save_store(path: Path, data: dict) -> None:
    now_iso_utc = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    _, now_text = now_meta()
    data["version"] = 2
    data["app"] = data.get("app") or "WebOwnerAdmin"
    data["schema"] = "WebOwnerAdmin.v2"
    data["schemaNote"] = "recordDate = fecha real del movimiento; receivedAt/createdAt = fecha y hora en que la web recibió el dato."
    data["updatedAtISO"] = now_iso_utc
    data["updatedAtText"] = now_text
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read_lines(path: Path) -> list[list[str]]:
    rows: list[list[str]] = []
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "|" in line:
            row = [part.strip() for part in line.split("|")]
        else:
            row = next(csv.reader([line]))
            row = [part.strip() for part in row]
        if row and row[0].lower() in {"nombre", "producto", "name"}:
            continue
        rows.append(row)
    return rows


def next_image_number(target_dir: Path, prefix: str) -> int:
    max_number = 0
    for file in target_dir.glob(f"{prefix}*.*"):
        match = re.fullmatch(rf"{re.escape(prefix)}(\d+)\..+", file.name)
        if match:
            max_number = max(max_number, int(match.group(1)))
    return max_number + 1


def list_images(folder: Path) -> list[Path]:
    if not folder or not folder.exists():
        return []
    return sorted([p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS])


def copy_or_move_image(source: Path, target_dir: Path, prefix: str, move: bool = False) -> str:
    target_dir.mkdir(parents=True, exist_ok=True)
    number = next_image_number(target_dir, prefix)
    ext = source.suffix.lower() if source.suffix.lower() in IMAGE_EXTENSIONS else ".png"
    target = target_dir / f"{prefix}{number}{ext}"
    if move:
        shutil.move(str(source), target)
    else:
        shutil.copy2(source, target)
    return target.as_posix()


def resolve_photo(row_photo: str, image_pool: list[Path], image_folder: Path | None, assets_dir: Path, prefix: str, move: bool) -> str:
    row_photo = (row_photo or "").strip()
    source: Path | None = None

    if row_photo:
        candidate = Path(row_photo)
        if not candidate.is_absolute() and image_folder:
            candidate = image_folder / row_photo
        if candidate.exists() and candidate.is_file():
            source = candidate
        else:
            # También puedes escribir directamente una ruta ya publicada, por ejemplo assets/productos/items/img1.png
            return row_photo
    elif image_pool:
        source = image_pool.pop(0)

    if not source:
        return ""

    rel = copy_or_move_image(source, assets_dir, prefix, move)
    # convertir ruta absoluta a ruta relativa del proyecto si hace falta
    root = project_root()
    try:
        return Path(rel).resolve().relative_to(root).as_posix()
    except Exception:
        return rel


def build_product(row: list[str], seccion: str, photo: str) -> dict:
    # nombre | stock | costo | minStock | fecha | imagen
    name = row[0].strip() if len(row) > 0 else ""
    if not name:
        raise ValueError("Hay una línea sin nombre de producto.")

    stock = to_int(row[1], 0) if len(row) > 1 else 0
    cost = to_number(row[2], 0) if len(row) > 2 else 0
    min_stock = to_int(row[3], 0) if len(row) > 3 else 0
    record_date = normalize_date(row[4] if len(row) > 4 else "")

    received_iso, received_text = now_meta()
    payload = {
        "id": f"{'item' if seccion == 'items' else 'rauda'}_{uuid.uuid4()}",
        "name": name,
        "stock": stock,
        "cost": cost,
        "photo": photo,
        "recordDate": record_date,
        "recordDateText": date_text(record_date),
        "receivedAt": received_text,
        "receivedAtISO": received_iso,
        "createdAt": received_text,
        "createdAtISO": received_iso,
    }

    if seccion == "items":
        payload["minStock"] = min_stock

    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Carga productos masivamente en data/adm-store.json")
    parser.add_argument("--seccion", choices=["items", "rauda"], required=True, help="Inventario destino.")
    parser.add_argument("--entrada", default="tools/productos_masivos.txt", help="Archivo de texto/CSV con productos.")
    parser.add_argument("--imagenes", default="", help="Carpeta con fotos para asignarlas en orden si la línea no trae imagen.")
    parser.add_argument("--json", default="data/adm-store.json", help="Ruta del adm-store.json.")
    parser.add_argument("--assets", default="", help="Carpeta destino para fotos. Por defecto assets/productos/<seccion>.")
    parser.add_argument("--prefijo", default="img", help="Prefijo para fotos renombradas: img1.png, img2.jpg, etc.")
    parser.add_argument("--mover", action="store_true", help="Mover fotos en vez de copiarlas.")
    args = parser.parse_args()

    root = project_root()
    json_path = (root / args.json).resolve()
    input_path = (root / args.entrada).resolve()
    image_folder = (root / args.imagenes).resolve() if args.imagenes else None
    assets_dir = (root / args.assets).resolve() if args.assets else (root / "assets" / "productos" / args.seccion).resolve()

    if not input_path.exists():
        raise FileNotFoundError(f"No existe el archivo de entrada: {input_path}")

    data = load_store(json_path)
    data.setdefault(args.seccion, [])

    rows = read_lines(input_path)
    image_pool = list_images(image_folder) if image_folder else []

    added = []
    for row in rows:
        row_photo = row[5] if len(row) > 5 else ""
        photo = resolve_photo(row_photo, image_pool, image_folder, assets_dir, args.prefijo, args.mover)
        added.append(build_product(row, args.seccion, photo))

    data[args.seccion].extend(added)
    save_store(json_path, data)

    print(f"✅ Productos agregados: {len(added)}")
    print(f"✅ JSON actualizado: {json_path}")
    print(f"✅ Fotos guardadas en: {assets_dir}")
    if image_pool:
        print(f"ℹ️ Fotos sobrantes sin usar: {len(image_pool)}")


if __name__ == "__main__":
    main()
