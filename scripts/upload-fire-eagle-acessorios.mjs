/**
 * Fotos dos acessórios Fire Eagle (SKU no nome do arquivo).
 * Produtos sem variação → fotos_armas com variacao_id null + armas.foto_url (ordem 0).
 *
 * Pasta padrão: OneDrive\...\FOTOS DAS FIRE EAGLE\ACESSORIOS
 * Ou: --dir="caminho"
 *
 *   npm run upload:fire-eagle-acessorios
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const DEFAULT_DIR = String.raw`C:\Users\franc\OneDrive\Área de Trabalho\FOTOS DAS FIRE EAGLE\ACESSORIOS`;
const ASSETS_FALLBACK = String.raw`C:\Users\franc\.cursor\projects\c-Users-franc-projetos-catalogo\assets`;

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
const dirArg = process.argv.find((a) => a.startsWith("--dir="));
let fotosDir = dirArg ? dirArg.slice("--dir=".length) : DEFAULT_DIR;
if (!existsSync(fotosDir) && existsSync(ASSETS_FALLBACK)) {
  console.log("Pasta ACESSORIOS não encontrada, usando assets do projeto:", ASSETS_FALLBACK);
  fotosDir = ASSETS_FALLBACK;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** SKU → nome exato no cadastro */
const SKU_NOME = {
  18770: "Kit amortecedor Accuwedge",
  19015: "Coronha Comfort",
  18768: "Empunhadura Comfort AR-15",
  19017: "Kit Hand Stop",
  19016: "Kit guarda mato AR-15",
  18758: "Kit janela de ejeção polímero AR-15",
  19020: "Kit de reparo do ferrolho AR-15",
  19019: "Kit de reparo do impulsor",
  19032: "Kit Rubber Cover AR-15",
  18761: "Kit trilhos Picatinny",
  19018: "Kit tubo da coronha AR-15",
  19021: "Kit Wooooops!!! AR-15",
  18762: "Kit conjunto de mira flip-up AR-15 (alumínio)",
  18074: 'Kit handguard FE AR-15 p/ canos de 14,5" (M-LOK)',
  18657: "Kit ambidestro Gen1",
  18756: "Kit reparo mecanismo de disparo",
  23750: "Kit manutenção AR-9",
  10780: "Carregador AR-9 Glock Gen.4–5 (33 tiros)",
  18776: "Carregador AR-15 (30 tiros)",
  21322: "Short Hand-Stop",
};

function parseArquivo(name) {
  const skuM = name.match(/SKU[_\s-]*(\d{5})/i) || name.match(/(?:^|\D)(\d{5})(?:\D|$)/);
  if (!skuM) return null;
  const sku = skuM[1];
  if (!SKU_NOME[sku]) return null;
  const ordem = /foto[_\s-]*2|_2\./i.test(name) ? 1 : 0;
  return { sku, ordem };
}

function processFoto(inputPath, outputPath) {
  const py = spawnSync(
    "python",
    [join(root, "scripts", "composite_produto_foto.py"), inputPath, outputPath],
    { encoding: "utf8", timeout: 600000 }
  );
  if (py.status !== 0) throw new Error(py.stderr || py.stdout || "Falha ao processar imagem");
}

async function uploadBuffer(armaId, jpegPath, ordem) {
  const buffer = readFileSync(jpegPath);
  const stamp = Date.now();
  const path = `armas/${armaId}-acc-${stamp}-${ordem}.jpg`;
  if (dryRun) {
    console.log("[dry-run]", path, "ordem", ordem);
    return;
  }
  const { error: upErr } = await supabase.storage.from("fotos-armas").upload(path, buffer, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("fotos-armas").getPublicUrl(path);
  await supabase
    .from("fotos_armas")
    .delete()
    .eq("arma_id", armaId)
    .is("variacao_id", null)
    .eq("ordem", ordem);
  const { error: insErr } = await supabase.from("fotos_armas").insert({
    arma_id: armaId,
    variacao_id: null,
    foto_url: pub.publicUrl,
    ordem,
  });
  if (insErr) throw insErr;
  if (ordem === 0) {
    await supabase.from("armas").update({ foto_url: pub.publicUrl }).eq("id", armaId);
  }
}

async function main() {
  if (!existsSync(fotosDir)) {
    console.error("Pasta não encontrada:", fotosDir);
    process.exit(1);
  }

  const files = readdirSync(fotosDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const tmp = mkdtempSync(join(tmpdir(), "fe-acc-"));
  const parsed = [];
  for (const name of files) {
    const p = parseArquivo(name);
    if (!p) {
      console.warn("Ignorado (sem SKU conhecido):", name);
      continue;
    }
    parsed.push({ ...p, file: join(fotosDir, name), name });
  }
  parsed.sort((a, b) => a.sku.localeCompare(b.sku) || a.ordem - b.ordem);

  console.log(dryRun ? "DRY-RUN" : "Upload acessórios", "·", parsed.length, "arquivo(s) ·", fotosDir);

  const uploadedSku = new Set();
  try {
    for (const item of parsed) {
      const nome = SKU_NOME[item.sku];
      const { data: arma } = await supabase.from("armas").select("id").eq("nome", nome).maybeSingle();
      if (!arma?.id) {
        console.warn("Cadastro não encontrado:", nome, "SKU", item.sku);
        continue;
      }
      const out = join(tmp, `${item.sku}-${item.ordem}.jpg`);
      console.log("Processando", item.name, "→", item.sku, "ordem", item.ordem);
      if (!dryRun) {
        processFoto(item.file, out);
        await uploadBuffer(arma.id, out, item.ordem);
      }
      uploadedSku.add(item.sku);
      console.log("OK", item.sku, nome);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const faltam = Object.keys(SKU_NOME).filter((s) => !uploadedSku.has(s));
  if (faltam.length) {
    console.log("\nSem foto na pasta:", faltam.map((s) => `${s} (${SKU_NOME[s]})`).join("; "));
  }
  console.log("Concluído.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
