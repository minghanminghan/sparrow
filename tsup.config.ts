import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: { cli: "src/cli/index.ts" },
  format: "cjs",
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  external: Object.keys(pkg.dependencies ?? {}),
});
