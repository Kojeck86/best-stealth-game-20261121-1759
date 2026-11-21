// Ember Archive — entry point for the make.fun bundle step.
//
// Copies the static game and the screenshots into the output directory and
// writes dossier.json there by calling the vendored buildDossier helper.
// Node 22 program, standard library only.

import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

// The repository directory is wherever this file lives.
const repoDir = dirname(fileURLToPath(import.meta.url));

// The bundle harness hands us the output directory through the environment.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

await mkdir(outDir, { recursive: true });
await cp(join(repoDir, "game"), join(outDir, "game"), { recursive: true });
await cp(join(repoDir, "screenshots"), join(outDir, "screenshots"), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

// Refuse to hand over a dossier that does not parse.
JSON.parse(new TextDecoder().decode(dossier));

await writeFile(join(outDir, "dossier.json"), dossier);
console.log(`dossier.json written (${dossier.length} bytes) to ${outDir}`);
