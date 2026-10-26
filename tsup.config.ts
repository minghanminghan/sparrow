import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

const common = {
  format: "cjs",
  target: "node22",
  removeNodeProtocol: false,
  banner: { js: "#!/usr/bin/env node" },
} as const;

export default defineConfig([
  // The CLI is served as a single file by /cli/sparrow.js, so it bundles its dependencies.
  { ...common, entry: { cli: "src/cli/index.ts" }, noExternal: [/.*/] },
  { ...common, entry: { import: "src/cli/import.ts", migrate: "src/cli/migrate.ts" }, external: Object.keys(pkg.dependencies ?? {}) },
]);
