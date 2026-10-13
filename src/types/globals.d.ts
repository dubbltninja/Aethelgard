// Build-time constants (PLAN §3.5, §3.7). esbuild `define` replaces them in tools/build.ts and tools/dev.ts;
// bunfig.toml [define] sets them for `bun test`. Production builds see literal `false`, so dev/e2e-only code
// guarded by `if (__DEV__)` / `if (__E2E__)` is tree-shaken away.
declare const __DEV__: boolean;
declare const __E2E__: boolean;
declare const __VERSION__: string;

/** Stylesheets imported for their side effect from src/main.tsx; esbuild bundles them into app-[hash].css. */
declare module '*.css';
