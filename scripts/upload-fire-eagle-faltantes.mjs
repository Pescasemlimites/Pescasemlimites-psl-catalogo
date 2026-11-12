/**
 * Fotos que faltavam: pasta "FOTOS QUE NAO TINHA".
 * SKU no nome do arquivo. Dark 300 base e supressores pelo nome.
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
const FOTOS_DIR = String.raw`C:\Users\franc\OneDrive\Área de Trabalho\FOTOS DAS FIRE EAGLE\FOTOS QUE NAO TINHA`;

function loadEnv() {
  const envPath = join(root, ".env");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !m[1].trim().startsWith("#")) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv();

const dryRun = process.argv.includes("--dry-run");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const POR_NOME = [
  { match: /DARK 300 - 7,5/i, sku: "24206" },
  { match: /DARK 300 10,5/i, sku: "24208" },
  { match: /5\.56/i, sku: "21150", produto: "Supressor roscado 5.56 / .223" },
  { match: /1-2 x 28|1\/2 x 28/i, sku: "21685", produto: "Supressor roscado 9mm / .380 — 1/2x28" },
  { match: /1-2 x 36|1\/2 x 36/i, sku: "23632", produto: "Supressor roscado 9mm / .380 — 1/2x36" },
  { match: /5-8 x 24|5\/8 x 24/i, sku: "21080", produto: "Supressor roscado .308 / 300 BLK — 5/8x24" },
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walk(p, acc);
    else if (/\.(png|jpe?g|webp)$/i.test(name.name)) acc.push({ name: name.name, file: p });
  }
  return acc;
}

function classificar(name) {
  const skuNoNome = name.match(/SKU\s*(\d{5})/i);
  if (skuNoNome) return { sku: skuNoNome[1], produto: null };
  const hit = POR_NOME.find((r) => r.match.test(name));
  if (hit) return { sku: hit.sku, produto: hit.produto || null };
  return null;
}

function processFoto(inputPath, outputPath) {
  const py = spawnSync(
    "python",
    [join(root, "scripts", "composite_produto_foto.py"), inputPath, outputPath],
    { encoding: "utf8", timeout: 600000 }
  );
  if (py.status !== 0) throw new Error(py.stderr || py.stdout || "Falha ao processar imagem");
  process.stdout.write(py.stdout || "");
}

async function uploadBuffer(armaId, variacaoId, jpegPath, ordem) {
  const buffer = readFileSync(jpegPath);
  const stamp = Date.now();
  const path = variacaoId
    ? `armas/${armaId}-var-${variacaoId}-${stamp}-0.jpg`
    : `armas/${armaId}-${stamp}-0.jpg`;
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
  const { error: insErr } = await supabase.from("fotos_armas").insert({
    arma_id: armaId,
    variacao_id: variacaoId,
    foto_url: pub.publicUrl,
    ordem,
  });
  if (insErr) throw insErr;
  if (!variacaoId) {
    await supabase.from("armas").update({ foto_url: pub.publicUrl }).eq("id", armaId);
  }
}

async function main() {
  const files = walk(FOTOS_DIR);
  const tmp = mkdtempSync(join(tmpdir(), "fe-falt-"));
  console.log(files.length, "arquivo(s)");
  try {
    for (const f of files) {
      const c = classificar(f.name);
      if (!c) {
        console.warn("Sem vínculo:", f.name);
        continue;
      }
      let armaId;
      let variacaoId = null;
      if (c.produto) {
        const { data: arma } = await supabase.from("armas").select("id").eq("nome", c.produto).maybeSingle();
        if (!arma) {
          console.warn("Produto não encontrado", c.produto);
          continue;
        }
        armaId = arma.id;
      } else {
        const { data: v } = await supabase
          .from("variacoes_armas")
          .select("id, arma_id")
          .eq("sku", c.sku)
          .maybeSingle();
        if (!v) {
          console.warn("Variação não encontrada SKU", c.sku, f.name);
          continue;
        }
        armaId = v.arma_id;
        variacaoId = v.id;
      }
      const out = join(tmp, `${c.sku}.jpg`);
      console.log("Processando", f.name, "→", c.sku);
      if (!dryRun) {
        processFoto(f.file, out);
        await uploadBuffer(armaId, variacaoId, out, 0);
      }
      console.log("OK", c.sku, f.name);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log("Concluído. Sem arquivo na pasta: Atlas 11\" FDE (SKU 24729).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
