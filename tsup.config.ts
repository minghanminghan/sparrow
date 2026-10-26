import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: { cli: "src/cli/index.ts", import: "src/cli/import.ts", migrate: "src/cli/migrate.ts" },
  format: "cjs",
  target: "node22",
  removeNodeProtocol: false,
  banner: { js: "#!/usr/bin/env node" },
  external: Object.keys(pkg.dependencies ?? {}),
});
