// QR payload builder for Syncthing share kits.
//
// We return a syncthing:// URL payload plus a lightweight SVG placeholder
// data-URL so the recipient can copy/paste the text even before a bitmap QR
// library is added. `buildQrPlaceholderSvgDataUrl` is the single swap point
// for a future bitmap QR library.

export function buildSharePayload(opts: {
  deviceId: string;
  folderId: string;
  folderLabel?: string;
}): string {
  const params = new URLSearchParams();
  params.set("device", opts.deviceId);
  params.set("folder", opts.folderId);
  if (opts.folderLabel) params.set("label", opts.folderLabel);
  return `syncthing://?${params.toString()}`;
}

export function buildQrPlaceholderSvgDataUrl(payload: string): string {
  const escaped = payload
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="0 0 280 280"><rect width="280" height="280" fill="#fff" stroke="#111" stroke-width="4"/><text x="140" y="130" text-anchor="middle" font-family="monospace" font-size="11" fill="#111">Scan in Syncthing app</text><text x="140" y="160" text-anchor="middle" font-family="monospace" font-size="9" fill="#555">${escaped.slice(0, 36)}</text><text x="140" y="180" text-anchor="middle" font-family="monospace" font-size="9" fill="#555">${escaped.slice(36, 72)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// 52-char Syncthing device id shape: 7 groups of 7 chars separated by dashes.
const DEVICE_ID_RE = /^[A-Z2-7]{7}-[A-Z2-7]{7}-[A-Z2-7]{7}-[A-Z2-7]{7}-[A-Z2-7]{7}-[A-Z2-7]{7}-[A-Z2-7]{7}-[A-Z2-7]{7}$/;

export function isValidSyncthingDeviceId(id: string): boolean {
  return DEVICE_ID_RE.test(id);
}
