import { copyFile, mkdtemp, rm, stat } from "node:fs/promises";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { build } from "esbuild";

const outputPath = resolve(".next/deploy-tools/maintenance.mjs");
const nodeBuiltinModules = new Set(
  builtinModules.flatMap((moduleName) => [moduleName, `node:${moduleName}`]),
);
const result = await build({
  banner: {
    js: "import { createRequire as __prelogCreateRequire } from 'node:module'; const require = __prelogCreateRequire(import.meta.url);",
  },
  bundle: true,
  entryPoints: ["scripts/maintenance.ts"],
  format: "esm",
  legalComments: "none",
  logLevel: "info",
  metafile: true,
  outfile: outputPath,
  packages: "bundle",
  platform: "node",
  plugins: [createPgNativeStubPlugin()],
  target: "node24",
});

assertNoExternalPackages(result.metafile);
await verifyStandaloneBundle(outputPath);

const bundleStats = await stat(outputPath);
console.log(`Deployment tool ready: ${outputPath} (${formatBytes(bundleStats.size)})`);

function assertNoExternalPackages(metafile) {
  const externalImports = Object.values(metafile.outputs)
    .flatMap((output) => output.imports)
    .filter((entry) => entry.external && !nodeBuiltinModules.has(entry.path));

  if (externalImports.length > 0) {
    const paths = externalImports.map((entry) => entry.path).join(", ");
    throw new Error(`Deployment bundle has external package imports: ${paths}`);
  }
}

function createPgNativeStubPlugin() {
  return {
    name: "prelog-pg-native-stub",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^pg-native$/ }, () => ({
        namespace: "prelog-pg-native-stub",
        path: "pg-native",
      }));
      buildContext.onLoad(
        { filter: /.*/, namespace: "prelog-pg-native-stub" },
        () => ({
          contents: `
            const error = new Error("pg-native is not included in the Prelog deployment tool");
            error.code = "MODULE_NOT_FOUND";
            throw error;
          `,
          loader: "js",
        }),
      );
    },
  };
}

async function verifyStandaloneBundle(sourcePath) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "prelog-deploy-tool-"));
  const temporaryBundle = join(temporaryDirectory, basename(sourcePath));

  try {
    await copyFile(sourcePath, temporaryBundle);
    const smokeTest = spawnSync(process.execPath, [temporaryBundle, "--help"], {
      cwd: temporaryDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "",
        NODE_PATH: "",
        NODE_PG_FORCE_NATIVE: "",
      },
    });

    if (smokeTest.status !== 0) {
      process.stderr.write(smokeTest.stderr);
      throw new Error(`Standalone deployment tool smoke test exited ${smokeTest.status}.`);
    }

    process.stdout.write(smokeTest.stdout);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}
