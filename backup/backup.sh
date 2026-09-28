#!/bin/bash
# Backup diario de la base de datos SQLite a Google Drive (cuenta separada) vía rclone.
# Configurar primero: rclone config  (nombrar el remote como "hogar-drive")

FECHA=$(date +%Y-%m-%d_%H-%M)
ORIGEN="$HOME/hogar-app/data/hogar.db"
DESTINO_LOCAL="/tmp/hogar-backup-$FECHA.db"
CARPETA_DRIVE="hogar-drive:BackupsGastosHogar"

cp "$ORIGEN" "$DESTINO_LOCAL"
rclone copy "$DESTINO_LOCAL" "$CARPETA_DRIVE"
rm "$DESTINO_LOCAL"

echo "Backup subido: hogar-backup-$FECHA.db"
