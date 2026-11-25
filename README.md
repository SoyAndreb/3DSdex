# 3DSdex

> Audita, organiza y actualiza la tarjeta SD de tu Nintendo 3DS (o una carpeta local de trabajo/respaldo) directamente desde el navegador. Sin instalación, sin servidor y tus archivos nunca salen de tu equipo.

- **Sitio en GitHub Pages:** https://soyandreb.github.io/3DSdex/
- **Repositorio:** https://github.com/SoyAndreb/3DSdex

---

## Funcionalidades principales

- **Selección flexible (SD o carpeta local) + Compatibilidad Chromium y Firefox:**
  - **Chromium (Chrome, Edge, Brave, Opera):** lectura y escritura directa con la File System Access API.
  - **Firefox / Modo Compatible:** lectura completa en memoria y exportación de cambios en un `.zip` listo para extraer sobre la SD respetando la jerarquía de carpetas.
- **Salud y Auditoría SD (Limpieza segura):**
  - Clasificación en 3 categorías: *Basura del sistema operativo* (`._*`, `.DS_Store`, `.fseventsd` sin `no_log`, `.Trashes`, `.Spotlight-V100`, `LOST.DIR` vacío), *Archivos desubicados* (`.cia` → `/cias/`, `.3dsx` → `/3ds/`, `.firm` → `/luma/payloads/`) y *Residuos opcionales* (`.bak`, logs, `.cia` antiguos).
  - Cálculo de espacio total a liberar, selección por elemento y confirmación en dos pasos.
  - Protección estricta sobre `/Nintendo 3DS/` y `/boot9strap/`.
  - **Regla FBI / NSA:** recomienda instalar [NSA](https://github.com/tinaut1986/NSA) únicamente si detecta carpeta de FBI y no existe `/nsa/`.
- **CFW y Arranque (SHA-256 + Respaldo seguro):**
  - Verifica Luma3DS (`/boot.firm`), Homebrew Launcher (`/boot.3dsx`), GodMode9 (`/luma/payloads/*GodMode9*.firm`) y utilidades clave.
  - Respaldo automático en `/luma/backups/3dsdex/` y verificación SHA-256 post-escritura antes de confirmar cualquier sobrescritura.
- **Homebrew (Universal-DB):**
  - Explora el catálogo de Universal-DB (con caché local y fallback offline), cruza con lo instalado en la SD e instala o actualiza `.3dsx`, `.cia` y `.firm` en su ruta estándar.
- **TM++ (TWiLight Menu++ y carátulas automáticas):**
  - Detecta TWiLight Menu++ y descarga carátulas faltantes desde `libretro-thumbnails` guardándolas en `/_nds/TWiLightMenu/boxart/`.

---

## Despliegue automático en GitHub Pages

El repositorio incluye el workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), que compila `dist/` con `GITHUB_PAGES=true` (`base: '/3DSdex/'`) y lo publica en cada `push` a `main` (o manualmente con `workflow_dispatch`).

Para activarlo en GitHub:
1. Abre el repositorio en GitHub: `https://github.com/SoyAndreb/3DSdex`.
2. Ve a **Settings → Pages**.
3. En **Build and deployment → Source**, selecciona **GitHub Actions**.
4. Haz `push` a la rama `main` (o ejecuta el workflow **Deploy to GitHub Pages** desde la pestaña **Actions**).
5. La aplicación quedará publicada en `https://soyandreb.github.io/3DSdex/`.

---

## Desarrollo local

```bash
npm install
npm run dev          # servidor de desarrollo local
npm run lint         # oxlint
npm test             # tests unitarios (vitest)
npm run build        # compilación de producción (dist/)
```
