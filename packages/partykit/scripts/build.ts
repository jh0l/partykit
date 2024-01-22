import * as fs from "fs";

import * as esbuild from "esbuild";
import { zodToJsonSchema } from "zod-to-json-schema";

import * as ConfigSchema from "../src/config-schema";

process.chdir(`${__dirname}/../`);

const minify = process.argv.includes("--minify");
const isProd = process.argv.includes("--production");

const createRequireSnippet = `
import { createRequire as topLevelCreateRequire } from "node:module";
import { fileURLToPath as topLevelFileURLToPath, URL as topLevelURL } from "node:url";
const require = topLevelCreateRequire(import.meta.url);
const __filename = topLevelFileURLToPath(import.meta.url);
const __dirname = topLevelFileURLToPath(new topLevelURL(".", import.meta.url));
`;

// generate dist/generated.js
esbuild.buildSync({
  entryPoints: ["facade/source.ts"],
  banner: {
    js: "// AUTOGENERATED, DO NOT EDIT!\n /* eslint-disable */"
  },
  format: "esm",
  outfile: "dist/generated.js",
  platform: "neutral",
  bundle: true,
  external: ["__WORKER__", "__STATIC_ASSETS_MANIFEST__"]
});

// generate bin/index.js
esbuild.buildSync({
  entryPoints: ["src/bin.tsx"],
  bundle: true,
  format: "esm",
  outfile: "dist/bin.mjs",
  platform: "node",
  external: [
    "react-devtools-core",
    "yoga-wasm-web",
    "esbuild",
    "fsevents",
    "miniflare",
    "clipboardy"
  ],
  banner: isProd
    ? { js: "#!/usr/bin/env node" + createRequireSnippet }
    : { js: "#!/usr/bin/env node --enable-source-maps" + createRequireSnippet },
  alias: {
    "react-devtools-core": "partykit/rdt-mock.js"
  },
  sourcemap: true,
  minify,
  define: {
    PARTYKIT_API_BASE: `"${process.env.PARTYKIT_API_BASE}"`,
    "process.env.NODE_ENV": `"${isProd ? "production" : "development"}"`,
    PARTYKIT_DASHBOARD_BASE: `"${process.env.PARTYKIT_DASHBOARD_BASE}"`,
    CLERK_PUBLISHABLE_KEY: `"${process.env.CLERK_PUBLISHABLE_KEY}"`
  }
});

fs.chmodSync("dist/bin.mjs", 0o755);

// generate dist/server.js
esbuild.buildSync({
  entryPoints: ["src/server.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/server.js",
  sourcemap: true,
  minify
  // platform: "node", // ?neutral?
});

// generate json schema for the config

const jsonSchema = zodToJsonSchema(ConfigSchema.schema);
// write to file
fs.writeFileSync("schema.json", JSON.stringify(jsonSchema, null, 2) + "\n");

// copy to the site's public folder

fs.copyFileSync("schema.json", "../../apps/site/public/schema.json");
