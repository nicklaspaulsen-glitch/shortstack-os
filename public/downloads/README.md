# public/downloads/

Static assets served from `https://<host>/downloads/*`.

## Desktop installers

Large Electron installers (>25MB) live here but are NOT committed to git
(see root `.gitignore`). They are produced by `electron-builder` and must be
staged before Vercel can serve them, OR uploaded to Cloudflare R2 for hosts
with tight static-file limits.

### Build and stage locally

```bash
# Build the Windows installer (produces dist-electron/ShortStack-OS-<ver>-Setup.exe)
npm run electron:build

# Copy into public/downloads/ with stable names and write manifest.json
npm run postbuild:electron
```

After running those, `public/downloads/` contains:

- `ShortStack-OS-Setup.exe` (Windows NSIS installer, ~177 MB)
- `ShortStack-OS.dmg` (macOS, only if built on a Mac / cross-build)
- `ShortStack-OS.AppImage` (Linux, only if cross-built)
- `manifest.json` (metadata consumed by `/api/desktop/manifest`)

### Hosting on Vercel

Vercel bundles everything under `public/` into the deployment. Static assets
are served from the edge network, but files >25MB may fail to upload or be
rejected at build time. If `npm run electron:build` + `postbuild:electron`
leaves files larger than that, switch to external hosting.

### Hosting on Cloudflare R2 (recommended for >25MB)

1. Create an R2 bucket (e.g. `shortstack-desktop`) and enable public access
   (or put it behind a custom domain like `r2.shortstack.dev`).
2. Upload the files from `public/downloads/` — keep the filenames identical
   to `manifest.json`.
3. Set `DESKTOP_DOWNLOAD_BASE_URL` in Vercel env:
   ```
   DESKTOP_DOWNLOAD_BASE_URL=https://r2.shortstack.dev/desktop
   ```
4. Redeploy. `/api/desktop/download/windows` now 302s to
   `https://r2.shortstack.dev/desktop/ShortStack-OS-Setup.exe`.

`manifest.json` stays tracked in git so the page still shows correct size +
version even when the actual binaries live on R2.

## GitHub Releases fallback

If neither `public/downloads/` nor R2 has the file, the page renders a
graceful "contact support" banner with a link to the GitHub releases page
configured in `src/app/dashboard/download/page.tsx`.
