/**
 * Vincula fotos da pasta FOTOS DAS FIRE EAGLE → variações (por SKU) e sobe no Storage.
 * Processa com fundo padrão (scripts/composite_produto_foto.py + rembg).
 *
 * npm run upload:fire-eagle-fotos
 * npm run upload:fire-eagle-fotos -- --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "fs";
import { dirname, join, basename } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const FOTOS_DIR = String.raw`C:\Users\franc\OneDrive\Área de Trabalho\FOTOS DAS FIRE EAGLE`;

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const supabase = createClient(url, key);

/** arquivo → SKU(s) — foto principal (ordem 0). Nomes com ®️ na pasta. */
const MAP = [
  { match: /FE-905PR/i, skus: ["22986"] },
  { match: /FE-908PR/i, skus: ["22987"] },
  { match: /FE-914PR/i, skus: ["22988"] },
  { match: /FE-200S(?!GP|HS)/i, skus: ["22978"] },
  { match: /FE-200HS|200H/i, skus: ["22981"] },
  { match: /FE-160S/i, skus: ["22974"] },
  { match: /FE-145SGP/i, skus: ["22989"] },
  { match: /FE-115SGP/i, skus: ["22991"] },
  { match: /FE-145S(?!GP)/i, skus: ["22970"] },
  { match: /^11\.5\.png$/i, skus: ["22966"] },
];

/** lifestyle / segunda foto (ordem 1) */
const MAP_EXTRA = [
  { match: /^14\.5\.JPG/i, skus: ["22970"] },
  { match: /^FDE\s*14\.5/i, skus: ["22970"] },
];

function skusForFile(name) {
  const extra = MAP_EXTRA.find((m) => m.match.test(name));
  if (extra) return { skus: extra.skus, ordem: 1 };
  const main = MAP.find((m) => m.match.test(name));
  if (main) return { skus: main.skus, ordem: 0 };
  return null;
}

const SKU_META = {
  22986: { arma: "Fire Eagle FE-905PR", cano: '5,5" (139 mm)' },
  22987: { arma: "Fire Eagle FE-908PR", cano: '8,5" (215 mm)' },
  22988: { arma: "Fire Eagle FE-914PR", cano: '14,5" (368 mm)' },
  22966: { arma: "Fire Eagle série S", cano: '11,5" (292 mm)' },
  22970: { arma: "Fire Eagle série S", cano: '14,5" (368 mm)' },
  22974: { arma: "Fire Eagle série S", cano: '16" (406 mm)' },
  22978: { arma: "Fire Eagle série S", cano: '20" (508 mm)' },
  22981: { arma: "Fire Eagle FE-200HS", cano: '20" heavy (508 mm), caneluras' },
  22989: { arma: "Fire Eagle série SGP", cano: '14,5" (368 mm)' },
  22991: { arma: "Fire Eagle série SGP", cano: '11,5" (292 mm)' },
};

function processFoto(inputPath, outputPath) {
  const py = spawnSync(
    "python",
    [join(root, "scripts", "composite_produto_foto.py"), inputPath, outputPath],
    { encoding: "utf8", timeout: 600000 }
  );
  if (py.status !== 0) {
    throw new Error(py.stderr || py.stdout || "Falha ao processar imagem");
  }
}

async function findVariacaoId(sku) {
  const { data: bySku } = await supabase
    .from("variacoes_armas")
    .select("id, arma_id, comprimento_cano")
    .eq("sku", sku)
    .maybeSingle();
  if (bySku?.id) return bySku;

  const meta = SKU_META[sku];
  if (!meta) return null;
  const { data: arma } = await supabase.from("armas").select("id").eq("nome", meta.arma).maybeSingle();
  if (!arma?.id) return null;
  const { data: v } = await supabase
    .from("variacoes_armas")
    .select("id, arma_id, comprimento_cano")
    .eq("arma_id", arma.id)
    .eq("comprimento_cano", meta.cano)
    .maybeSingle();
  return v;
}

async function uploadParaVariacao(variacao, jpegPath, ordem, itemSku) {
  const buffer = readFileSync(jpegPath);
  const path = `armas/${variacao.arma_id}-var-${variacao.id}-${Date.now()}-${ordem}.jpg`;

  if (dryRun) {
    console.log("[dry-run] SKU", itemSku, "→", path, "ordem", ordem);
    return;
  }

  const { error: upErr } = await supabase.storage.from("fotos-armas").upload(path, buffer, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from("fotos-armas").getPublicUrl(path);

  await supabase.from("fotos_armas").delete().eq("variacao_id", variacao.id).eq("ordem", ordem);

  const { error: insErr } = await supabase.from("fotos_armas").insert({
    arma_id: variacao.arma_id,
    variacao_id: variacao.id,
    foto_url: pub.publicUrl,
    ordem,
  });
  if (insErr) throw insErr;
  console.log("OK SKU", itemSku, "ordem", ordem);
}

async function main() {
  if (!existsSync(FOTOS_DIR)) {
    console.error("Pasta não encontrada:", FOTOS_DIR);
    process.exit(1);
  }

  const files = readdirSync(FOTOS_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const tmpBase = mkdtempSync(join(tmpdir(), "fe-fotos-"));

  const fila = [];
  for (const f of files) {
    const hit = skusForFile(f);
    if (!hit) {
      console.warn("Sem vínculo (ignorado):", f);
      continue;
    }
    for (const sku of hit.skus) {
      fila.push({ file: join(FOTOS_DIR, f), name: f, sku, ordem: hit.ordem });
    }
  }

  console.log(dryRun ? "DRY-RUN" : "Upload", fila.length, "vínculo(s)");

  try {
    for (const item of fila) {
      const variacao = await findVariacaoId(item.sku);
      if (!variacao?.id) {
        console.warn("Variação não encontrada SKU", item.sku, item.name);
        continue;
      }

      const outJpg = join(tmpBase, `${item.sku}-${item.ordem}.jpg`);
      console.log("Processando", item.name, "→ SKU", item.sku);
      if (!dryRun) processFoto(item.file, outJpg);
      await uploadParaVariacao(variacao, dryRun ? item.file : outJpg, item.ordem, item.sku);
    }
  } finally {
    if (!dryRun) rmSync(tmpBase, { recursive: true, force: true });
  }

  console.log("\nSem foto na pasta ainda: Dark 300, FE-411S, Atlas, supressores, etc.");
  console.log("Concluído.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
