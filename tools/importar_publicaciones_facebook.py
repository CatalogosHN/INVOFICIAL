#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Importa la sección "Publicaciones de Facebook" de respuestas_rapidas.json a data/adm-store.json.

Uso desde la raíz de INVOFICIAL:
python tools/importar_publicaciones_facebook.py --respuestas ../xrspfastimg-main/data/respuestas_rapidas.json

Nota: si tu ZIP de respuestas rápidas no incluye imágenes físicas, el script conserva las URLs remotas en photo/photos.
"""
from __future__ import annotations

import argparse, hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HN = ZoneInfo("America/Tegucigalpa")
IMAGE_EXT_RE = re.compile(r"\.(png|jpe?g|webp|gif)(?:$|[?#])", re.I)

def root() -> Path:
    return Path(__file__).resolve().parents[1]

def slugify(text: str) -> str:
    text = str(text or '').lower().translate(str.maketrans('áéíóúüñç', 'aeiouunc'))
    return (re.sub(r'[^a-z0-9]+', '-', text).strip('-')[:80] or 'producto')

def image_src(img: dict) -> str:
    return (img.get('url') or img.get('downloadUrl') or img.get('cloudPath') or img.get('dataUrl') or '').strip()

def basename_from_img(img: dict, fallback='image.png') -> str:
    name = (img.get('cloudPath') or img.get('name') or fallback).split('/')[-1]
    name = re.sub(r'[^A-Za-z0-9._-]+', '-', name).strip('-') or fallback
    if not IMAGE_EXT_RE.search(name): name += '.png'
    return name

def date_text(d):
    return f"{d.day}/{d.month}/{d.year}"

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--respuestas', required=True, help='Ruta al data/respuestas_rapidas.json de xrspfastimg')
    parser.add_argument('--store', default='data/adm-store.json')
    args = parser.parse_args()
    project = root()
    store_path = (project / args.store).resolve()
    rsp_path = Path(args.respuestas).resolve()
    store = json.loads(store_path.read_text(encoding='utf-8'))
    rsp = json.loads(rsp_path.read_text(encoding='utf-8'))
    items = store.setdefault('items', [])
    existing = {str(i.get('sourceResponseId')) for i in items if i.get('sourceResponseId')}
    now = datetime.now(HN)
    now_utc = datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
    imported = 0
    manifest = []
    for r in rsp.get('responses', []):
        if r.get('section') != 'Publicaciones de Facebook' and r.get('category') != 'Publicaciones de Facebook':
            continue
        rid = str(r.get('id') or '')
        if rid and rid in existing: continue
        title = str(r.get('title') or r.get('shortcut') or '').strip()
        if not title: continue
        imgs = [img for img in (r.get('images') or []) if image_src(img)]
        urls = [image_src(img) for img in imgs]
        slug = slugify(r.get('shortcut') or title)
        targets = []
        for idx, img in enumerate(imgs, 1):
            target = f"media/inventario/items/{slug}/{idx:02d}-{basename_from_img(img)}"
            targets.append(target)
            manifest.append({'responseId': rid, 'productName': title, 'sourceCloudPath': img.get('cloudPath') or '', 'sourceUrl': image_src(img), 'targetPathInINVOFICIAL': target})
        suffix = hashlib.sha1((rid or title).encode('utf-8')).hexdigest()[:12]
        text_date = date_text(now.date())
        text_time = now.strftime('%I:%M:%S %p').replace('AM','a. m.').replace('PM','p. m.').lstrip('0')
        received = f"{text_date}, {text_time}"
        items.append({
            'id': f'item_fb_{suffix}', 'name': title, 'stock': 1, 'cost': 0, 'minStock': 0,
            'photo': urls[0] if urls else '', 'photos': urls, 'facebookMessage': str(r.get('message') or ''),
            'tags': r.get('tags') or [], 'source': 'xrspfastimg', 'sourceSection': 'Publicaciones de Facebook',
            'sourceCategory': r.get('category') or '', 'sourceResponseId': rid, 'sourceShortcut': r.get('shortcut') or '',
            'sourceMediaTargets': targets, 'recordDate': now.date().isoformat(), 'recordDateText': text_date,
            'receivedAt': received, 'receivedAtISO': now.isoformat(), 'createdAt': received, 'createdAtISO': now.isoformat()
        })
        imported += 1
    store['updatedAtISO'] = now_utc
    store['updatedAtText'] = datetime.now(HN).strftime('%d/%m/%Y, %I:%M:%S %p')
    store_path.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding='utf-8')
    media = project / 'media' / 'inventario' / 'items'
    media.mkdir(parents=True, exist_ok=True)
    (media / '.gitkeep').write_text('', encoding='utf-8')
    (project / 'media' / 'inventario' / 'MANIFIESTO_PUBLICACIONES_FACEBOOK.json').write_text(json.dumps({'createdAt': now_utc, 'productsImported': imported, 'files': manifest}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Productos importados: {imported}')

if __name__ == '__main__':
    main()
