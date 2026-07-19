// Generates the webOS launcher icons from the official black "S.T" brand icon
// (brand/app-icon-source.png — the same square logo used by the iOS/Android
// apps). Produces the exact sizes webOS expects, on a solid black background.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "brand", "app-icon-source.png");
const OUT = join(ROOT, "public");
mkdirSync(OUT, { recursive: true });

const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

async function make(size, name) {
  await sharp(SRC)
    .resize(size, size, { fit: "cover" })
    .flatten({ background: BLACK }) // keep the black brand background, no transparency
    .png()
    .toFile(join(OUT, name));
  console.log(`  ${name} (${size}x${size})`);
}

console.log("Generating webOS icons from the black S.T brand icon:");
await make(80, "icon.png");
await make(130, "icon-large.png");
console.log("Done.");
