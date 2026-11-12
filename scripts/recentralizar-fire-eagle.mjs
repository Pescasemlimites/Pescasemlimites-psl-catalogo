/**
 * Recompõe as fotos da Fire Eagle com a arma no centro e substitui no catálogo.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const DIR_PRONTAS = String.raw`C:\Users\franc\OneDrive\Área de Trabalho\FOTOS DAS FIRE EAGLE`;
const DIR_NOVAS = String.raw`C:\Users\franc\OneDrive\Área de Trabalho\FOTOS DAS FIRE EAGLE\FOTOS QUE NAO TINHA`;

function loadEnv() {
  for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !m[1].trim().startsWith("#")) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAPA_NOME = [
  { match: /FE-905PR/i, sku: "22986", ordem: 0 },
  { match: /FE-908PR/i, sku: "22987", ordem: 0 },
  { match: /FE-914PR/i, sku: "22988", ordem: 0 },
  { match: /FE-200HS|^200H/i, sku: "22981", ordem: 0 },
  { match: /FE-200S/i, sku: "22978", ordem: 0 },
  { match: /FE-160S/i, sku: "22974", ordem: 0 },
  { match: /FE-145SGP/i, sku: "22989", ordem: 0 },
  { match: /FE-115SGP/i, sku: "22991", ordem: 0 },
  { match: /FE-145S/i, sku: "22970", ordem: 0 },
  { match: /^11\.5\.png$/i, sku: "22966", ordem: 0 },
  { match: /^14\.5\.JPG/i, sku: "22970", ordem: 1 },
  { match: /^FDE\s*14\.5/i, sku: "22970", ordem: 1 },
  { match: /DARK 300 - 7,5/i, sku: "24206", ordem: 0 },
  { match: /DARK 300 10,5/i, sku: "24208", ordem: 0 },
  { match: /5\.56/i, sku: "21150", ordem: 0, produto: "Supressor roscado 5.56 / .223" },
  { match: /1-2 x 36|1\/2 x 36/i, sku: "23632", ordem: 0, produto: "Supressor roscado 9mm / .380 — 1/2x36" },
  { match: /1-2 x 28|1\/2 x 28/i, sku: "21685", ordem: 0, produto: "Supressor roscado 9mm / .380 — 1/2x28" },
  { match: /5-8 x 24|5\/8 x 24/i, sku: "21080", ordem: 0, produto: "Supressor roscado .308 / 300 BLK — 5/8x24" },
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (p === DIR_NOVAS && dir === DIR_PRONTAS) walk(p, acc);
      else if (dir !== DIR_PRONTAS) walk(p, acc);
    } else if (/\.(png|jpe?g|webp)$/i.test(name.name)) acc.push({ name: name.name, file: p });
  }
  return acc;
}

function classificar(name) {
  const skuNoNome = name.match(/SKU\s*(\d{5})/i);
  if (skuNoNome) return { sku: skuNoNome[1], ordem: 0, produto: null };
  const hit = MAPA_NOME.find((r) => r.match.test(name));
  if (!hit) return null;
  return { sku: hit.sku, ordem: hit.ordem, produto: hit.produto || null };
}

async function subir(armaId, variacaoId, jpegPath, ordem) {
  const buffer = readFileSync(jpegPath);
  const path = variacaoId
    ? `armas/${armaId}-var-${variacaoId}-${Date.now()}-${ordem}.jpg`
    : `armas/${armaId}-${Date.now()}-${ordem}.jpg`;
  const { error: upErr } = await supabase.storage.from("fotos-armas").upload(path, buffer, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("fotos-armas").getPublicUrl(path);
  if (variacaoId) {
    await supabase.from("fotos_armas").delete().eq("variacao_id", variacaoId).eq("ordem", ordem);
  } else {
    await supabase.from("fotos_armas").delete().eq("arma_id", armaId).is("variacao_id", null).eq("ordem", ordem);
  }
  const { error } = await supabase.from("fotos_armas").insert({
    arma_id: armaId,
    variacao_id: variacaoId,
    foto_url: pub.publicUrl,
    ordem,
  });
  if (error) throw error;
  if (!variacaoId) await supabase.from("armas").update({ foto_url: pub.publicUrl }).eq("id", armaId);
}

async function main() {
  const arquivos = walk(DIR_PRONTAS);
  const itens = [];
  for (const f of arquivos) {
    const c = classificar(f.name);
    if (!c) continue;
    itens.push({ ...f, ...c });
  }
  const tmp = mkdtempSync(join(tmpdir(), "fe-centro-"));
  const lote = join(tmp, "lote.txt");
  const linhas = itens.map((item, i) => `${item.file}\t${join(tmp, `${i}.jpg`)}`);
  writeFileSync(lote, linhas.join("\n"), "utf8");
  console.log("Compondo", itens.length, "fotos centralizadas…");
  const py = spawnSync("python", [join(root, "scripts", "composite_produto_foto.py"), "--lote", lote], {
    encoding: "utf8",
    timeout: 3600000,
  });
  process.stdout.write(py.stdout || "");
  if (py.status !== 0) throw new Error(py.stderr || "Falha ao recompor");

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    let armaId;
    let variacaoId = null;
    if (item.produto) {
      const { data: arma } = await supabase.from("armas").select("id").eq("nome", item.produto).maybeSingle();
      if (!arma) {
        console.warn("Produto não encontrado", item.produto);
        continue;
      }
      armaId = arma.id;
    } else {
      const { data: v } = await supabase
        .from("variacoes_armas")
        .select("id, arma_id")
        .eq("sku", item.sku)
        .maybeSingle();
      if (!v) {
        console.warn("SKU não encontrado", item.sku, item.name);
        continue;
      }
      armaId = v.arma_id;
      variacaoId = v.id;
    }
    await subir(armaId, variacaoId, join(tmp, `${i}.jpg`), item.ordem);
    console.log("OK", item.sku, item.name);
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log("Concluído.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
