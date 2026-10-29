#!/usr/bin/env node
/**
 * Embeds parent-reminder JPEGs for Deno edge functions.
 * Run from tyler-hill: node scripts/embed-parent-reminder-templates.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const assetDir = path.join(root, "public/parent-reminders");
const outFile = path.join(root, "supabase/functions/_shared/parentReminderTemplatesEmbedded.ts");

const KEYS = [
  ["sunscreen", "sunscreen.jpg"],
  ["extra_clothes", "extra_clothing.jpg"],
  ["rain_gear", "rain_gear.jpg"],
  ["water_bottle", "water_bottle.jpg"],
];

let body = `/** Auto-generated — run: node scripts/embed-parent-reminder-templates.mjs */\n\n`;
body += `import type { ParentEmailTemplateKey } from "./parentReminderLayout.ts";\n\n`;

const mapEntries = [];
for (const [key, file] of KEYS) {
  const buf = fs.readFileSync(path.join(assetDir, file));
  const b64 = buf.toString("base64");
  const constName = `PARENT_REMINDER_${key.toUpperCase()}_JPEG_BASE64`;
  body += `export const ${constName} = "${b64}";\n\n`;
  mapEntries.push(`  "${key}": ${constName},`);
}

body += `export const PARENT_REMINDER_JPEG_BASE64: Record<ParentEmailTemplateKey, string> = {\n`;
body += mapEntries.join("\n");
body += `\n};\n`;

fs.writeFileSync(outFile, body);
console.log(`Wrote ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB)`);
