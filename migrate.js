"use strict";

/**
 * Migra os dados do PC para o Supabase.
 *
 * Uso (PowerShell):
 *   $env:STORAGE="supabase"
 *   $env:NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
 *   node migrate.js
 */

process.env.STORAGE = "supabase";
const storage = require("./lib/storage");
const fs = require("fs");
const path = require("path");

const LOCAL_ROOT = process.env.LOCAL_VAULT || path.resolve(__dirname, "..");
const DATA_FILES = [
  "finances.json",
  "notes.json",
  "tasks.json",
  "events.json",
  "goals.json",
  "recurring.json",
  "profile.json",
];

async function main() {
  if (!storage.isCloud) throw new Error("Defina STORAGE=supabase");
  let count = 0;

  // 1) componentes: indice + arquivos
  const indexFile = path.join(LOCAL_ROOT, "components", "index.json");
  if (fs.existsSync(indexFile)) {
    await storage.writeText("components/index.json", fs.readFileSync(indexFile, "utf8"));
    count++;
    const idx = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    for (const comp of idx.components || []) {
      const abs = path.join(LOCAL_ROOT, comp.file);
      if (fs.existsSync(abs)) {
        await storage.writeText(comp.file, fs.readFileSync(abs, "utf8"));
        count++;
      }
    }
    console.log(`componentes: ${(idx.components || []).length} migrados`);
  } else {
    console.log("componentes: nenhum index.json encontrado, pulando");
  }

  // 2) designs
  const designsDir = path.join(LOCAL_ROOT, "designs");
  if (fs.existsSync(designsDir)) {
    const files = fs.readdirSync(designsDir).filter((f) => f.endsWith(".md"));
    for (const f of files) {
      await storage.writeText("designs/" + f, fs.readFileSync(path.join(designsDir, f), "utf8"));
      count++;
    }
    console.log(`designs: ${files.length} migrados`);
  }

  // 3) dados (financas, notas, tarefas, eventos, metas, gastos fixos, perfil)
  const dataDir = path.join(LOCAL_ROOT, "data");
  for (const f of DATA_FILES) {
    const abs = path.join(dataDir, f);
    if (fs.existsSync(abs)) {
      await storage.writeText("data/" + f, fs.readFileSync(abs, "utf8"));
      count++;
    }
  }
  console.log(`dados: ${DATA_FILES.filter((f) => fs.existsSync(path.join(dataDir, f))).length} arquivos migrados`);

  // 4) backups
  const backupDir = path.join(LOCAL_ROOT, "backups");
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir).filter((f) => fs.statSync(path.join(backupDir, f)).isFile());
    for (const f of files) {
      await storage.writeText("backups/" + f, fs.readFileSync(path.join(backupDir, f), "utf8"));
      count++;
    }
    console.log(`backups: ${files.length} migrados`);
  }

  console.log(`\nTotal enviado para o Supabase: ${count} registros.`);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
