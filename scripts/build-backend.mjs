import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const aliases = [
  ["@contracts/", path.join(root, "contracts")],
  ["@db/", path.join(root, "db")],
];

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["api/boot.ts"],
  outfile: "dist/boot.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  banner: {
    js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
  },
  plugins: [
    {
      name: "project-aliases",
      setup(build) {
        build.onResolve({ filter: /^@(contracts|db)\// }, (args) => {
          const match = aliases.find(([prefix]) => args.path.startsWith(prefix));
          const relative = args.path.slice(match[0].length);
          const file = relative.endsWith(".ts") ? relative : `${relative}.ts`;
          return { path: path.join(match[1], file) };
        });
      },
    },
  ],
});
