# Gastos del Hogar — Guía de despliegue

App para llevar la contabilidad del hogar: salarios, gastos fijos, compras planificadas,
lista semanal de la feria con checkboxes, y ahorro automático del 10% para vacaciones.

Arquitectura: **frontend (Nginx) + backend (Node/Express) + SQLite**, todo en Docker,
expuesto a internet gratis con **Cloudflare Tunnel** (sin abrir puertos ni comprar dominio).

---

## 0. Requisitos en la laptop Ubuntu

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git rclone
sudo usermod -aG docker $USER
# cerrar sesión y volver a entrar para que aplique el grupo docker
```

---

## 1. Subir el proyecto a GitHub (repo privado)

```bash
cd hogar-app
git init
git add .
git commit -m "Primera versión de la app de gastos del hogar"
```

1. Creá un repositorio **privado** en GitHub (gratis).
2. Conectalo:
```bash
git remote add origin https://github.com/TU_USUARIO/hogar-app.git
git branch -M main
git push -u origin main
```

El archivo `.gitignore` ya excluye `.env` y la carpeta `data/` (tu base de datos real y tus
secretos nunca se suben a GitHub).

En la laptop, para actualizar después de un cambio:
```bash
git pull
docker compose up -d --build
```

---

## 2. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Completá `JWT_SECRET` con una cadena larga aleatoria (podés generarla con
`openssl rand -hex 32`). El `TUNNEL_TOKEN` lo conseguís en el paso 3.

---

## 3. Exponer la app a internet gratis con Cloudflare Tunnel

No necesitás comprar dominio ni abrir puertos en tu router.

1. Creá una cuenta gratuita en https://dash.cloudflare.com
2. En el menú lateral: **Zero Trust → Networks → Tunnels → Create a tunnel**
3. Elegí tipo **Cloudflared**, ponele un nombre (ej: `hogar-app`)
4. Cloudflare te muestra un comando con un **token** — copiá solo el token y pegalo en tu
   `.env` como `TUNNEL_TOKEN`
5. En la configuración del túnel, agregá un **Public Hostname**:
   - Subdominio: el que quieras (ej: `gastos`)
   - Dominio: Cloudflare te ofrece un dominio gratuito tipo `.trycloudflare.com`, o si más
     adelante comprás uno propio, lo conectás ahí (opcional, no es necesario)
   - Servicio: `HTTP` → `frontend:80` (el nombre del contenedor del compose)

Con esto, la URL que te da Cloudflare va a servir tu app desde cualquier dispositivo,
con HTTPS automático, sin exponer la IP de tu casa.

---

## 4. Levantar todo

```bash
docker compose up -d --build
docker compose ps        # verificar que los 3 contenedores estén "Up"
docker compose logs -f backend   # ver logs si algo falla
```

Entrá a la URL del túnel de Cloudflare, tocá "Crear una cuenta nueva" y creá el primer
usuario. Cada persona de la casa puede crear su propio usuario para tener su acceso.

---

## 5. Que la laptop funcione como servidor 24/7

Evitar que se suspenda al cerrar la tapa:
```bash
sudo nano /etc/systemd/logind.conf
```
Descomentar y dejar:
```
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
```
```bash
sudo systemctl restart systemd-logind
```

Los contenedores ya tienen `restart: unless-stopped`, así que si hay un corte de luz o se
reinicia la laptop, al volver Docker los levanta solos (asegurate de que Docker esté
habilitado para iniciar con el sistema: `sudo systemctl enable docker`).

Firewall básico (el túnel de Cloudflare no necesita puertos entrantes abiertos):
```bash
sudo ufw enable
sudo ufw allow OpenSSH
```

---

## 6. Cuenta de Google Drive separada, solo para backups

1. Creá una cuenta de Gmail **nueva**, exclusiva para este proyecto (no tu cuenta personal).
2. Configurá `rclone` en la laptop apuntando a esa cuenta:
```bash
rclone config
# n) New remote → nombre: hogar-drive → tipo: Google Drive → seguir el flujo de login
```
3. Compartí la carpeta `BackupsGastosHogar` de esa cuenta con las personas de la casa que
   quieras que puedan ver los backups, sin darles acceso a tu cuenta personal.
4. Probá el script:
```bash
chmod +x backup/backup.sh
./backup/backup.sh
```
5. Automatizarlo diario con cron:
```bash
crontab -e
```
Agregar (backup todos los días a las 23:00):
```
0 23 * * * /home/TU_USUARIO/hogar-app/backup/backup.sh >> /home/TU_USUARIO/hogar-app/backup/backup.log 2>&1
```

---

## 7. Resumen de la arquitectura

```
Internet
   │
Cloudflare Tunnel (gratis, sin puertos abiertos, HTTPS automático)
   │
[frontend: Nginx] ──proxy /api──> [backend: Node/Express] ──> [SQLite en ./data]
```

- **GitHub** (privado, gratis): guarda el código, nunca los datos ni secretos.
- **Cloudflare Tunnel** (gratis): expone la app sin comprar dominio ni abrir el router.
- **Cuenta Drive separada** (gratis): solo backups, aislada de tu cuenta personal.
- **SQLite en `./data`**: toda la información vive en la laptop; hacé backup seguido.

---

## 8. Próximos pasos opcionales

- Dominio propio: si más adelante querés `gastos.tuapellido.com` en vez del subdominio
  gratuito de Cloudflare, comprás el dominio (único costo real de todo el proyecto) y lo
  conectás al mismo túnel.
- HTTPS ya viene incluido por Cloudflare, no hace falta certificado aparte.
- Notificaciones: se puede agregar un recordatorio (ej. por WhatsApp o email) cuando se
  acerque la fecha de vencimiento de un gasto fijo.

## Arranque local en Windows con Docker Desktop

Para probarla solo en esta PC, no hace falta configurar Cloudflare ni abrir puertos del router.

1. Abrí **Docker Desktop** desde el menú Inicio y esperá a que indique que Docker está funcionando.
2. Abrí una terminal de Ubuntu (WSL) y entra a la carpeta del proyecto. Si guardaste esta carpeta en `C:\Users\USUARIO\Documents\Codex\2026-09-28\ten\outputs\hogar-app`, desde Ubuntu ejecutá:
   ```bash
   cd /mnt/c/Users/USUARIO/Documents/Codex/2026-09-28/ten/outputs/hogar-app
   ```
3. Iniciá la app:
   ```bash
   docker compose up -d --build
   ```
4. Abrí [http://localhost:8080](http://localhost:8080) en el navegador y elegí **Crear una cuenta nueva**.
5. Para apagarla: `docker compose down`. Para ver errores: `docker compose logs -f`.

El servicio Cloudflare queda desactivado en el arranque local. Para exponerla a internet, configurá `TUNNEL_TOKEN` en `.env` y ejecutá `docker compose --profile publico up -d --build`. No compartas ni publiques `.env`.
