/**
 * Type stubs for packages that exist in node_modules (via parent worktree junction)
 * but whose @types packages are not listed in package.json.
 *
 * uuid — has bundled types in uuid/dist but TS can't resolve them without @types/uuid.
 * satori — optional server dep used in render-server.ts with dynamic import + try/catch.
 */

declare module "uuid" {
  export function v4(): string;
  export function v1(): string;
  export function v3(name: string | Uint8Array, namespace: string | Uint8Array): string;
  export function v5(name: string | Uint8Array, namespace: string | Uint8Array): string;
}

declare module "satori" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function satori(element: any, options: { width: number; height: number; fonts: any[] }): Promise<string>;
  export default satori;
}
