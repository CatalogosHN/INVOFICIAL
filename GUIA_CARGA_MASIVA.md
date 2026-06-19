# Guía rápida: carga masiva de productos

Tu `data/adm-store.json` ahora queda más fácil de manipular:

- `recordDate`: fecha real del movimiento, gasto, ingreso o venta.
- `recordDateText`: fecha visible en formato simple.
- `receivedAt` / `receivedAtISO`: fecha y hora automática en que la web recibió/capturó el dato.
- `createdAt` / `createdAtISO`: se conserva por compatibilidad con el sistema anterior.
- Las fotos cargadas masivamente pueden quedar como rutas normales, por ejemplo `media/inventario/items/img1.png`, en vez de base64 gigante.

## 1. Preparar productos

Edita:

```txt
tools/productos_masivos.txt
```

Formato:

```txt
Nombre del producto | stock | costo | minStock | fecha YYYY-MM-DD | imagen
```

Ejemplo:

```txt
Chaleco reflectivo completo Naranja | 60 | 50 | 10 | 2026-05-16 | img1.png
Cámara WiFi exterior 360 | 12 | 420 | 3 | 2026-05-16 | img2.jpg
```

## 2. Guardar fotos

Pon tus fotos en una carpeta, por ejemplo:

```txt
fotos/
```

Puedes renombrarlas primero:

```bash
python tools/renombrar_imagenes.py --carpeta fotos
```

Eso deja algo tipo:

```txt
img1.jpg
img2.jpg
img3.png
```

## 3. Cargar productos a Items

```bash
python tools/cargar_productos_masivo.py --seccion items --entrada tools/productos_masivos.txt --imagenes fotos
```

## 4. Cargar productos a Rauda

```bash
python tools/cargar_productos_masivo.py --seccion rauda --entrada tools/productos_masivos.txt --imagenes fotos
```

## 5. Subir a GitHub

Después de ejecutar el script, sube estos cambios:

```txt
data/adm-store.json
media/inventario/
```

Con eso ya no tienes que meter 100 productos uno por uno desde la web.

## Edición de registros

La web ahora tiene botón **Editar** en todas las secciones principales. Cuando se edita un registro, no se pierde la fecha original en que la web recibió el dato; se agrega auditoría con:

- `updatedAt`: fecha y hora de la última edición.
- `updatedAtISO`: fecha ISO de la última edición.
- `editCount`: cantidad de veces que se editó.
- `editHistory`: historial básico de ediciones.

Esto ayuda a identificar si un producto, cliente, venta, envío CAEX o gasto fue corregido después de registrarlo.


## Importación desde respuestas rápidas

Este paquete incluye `media/inventario/MANIFIESTO_PUBLICACIONES_FACEBOOK.json`.
Ahí queda el mapa de las imágenes que venían referenciadas desde `xrspfastimg`.
Como el ZIP de respuestas rápidas fue enviado sin imágenes físicas, los productos importados usan temporalmente la URL remota de GitHub en `photo` y `photos`.
Si quieres tener todo dentro de INVOFICIAL, copia las imágenes indicadas en el manifiesto dentro de `media/inventario/items/...`.
