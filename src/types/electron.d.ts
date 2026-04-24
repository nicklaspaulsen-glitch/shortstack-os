/**
 * Ambient declaration for the Electron preload bridge.
 *
 * Two call sites were declaring window.electron with DIFFERENT shapes
 * (video-editor/electron-bar.tsx vs dashboard/thumbnail-generator/page.tsx),
 * which made TS reject the build with:
 *
 *   Type error: Subsequent property declarations must have the same type.
 *   Property 'electron' must be of type ... but here has type 'ElectronApi'.
 *
 * Merging them here gives TS one canonical shape. Every field stays
 * optional so the web build (where window.electron is undefined) still
 * type-checks: call sites already guard with `window.electron?.foo`.
 */

interface ElectronApi {
  // video-editor/electron-bar.tsx
  openFiles?: () => Promise<string[]>;
  renderLocal?: (
    composition: unknown,
  ) => Promise<{ ok: boolean; path?: string; error?: string }>;
  gpuAvailable?: () => Promise<boolean>;

  // dashboard/thumbnail-generator/page.tsx
  openFilePicker?: () => Promise<string | null>;
  readFileDataUrl?: (path: string) => Promise<string>;
}

interface Window {
  electron?: ElectronApi;
}
