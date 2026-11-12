/**
 * Importa acessórios Fire Eagle (folder Out/2026) — mesma regra de preço das armas.
 *
 * Custo: out/26 · imposto 10% · margem 40% · promo = MSRP (tabela VALOR NORMAL)
 *
 *   node scripts/import-fire-eagle-acessorios.mjs
 *   node scripts/import-fire-eagle-acessorios.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dryRun = process.argv.includes("--dry-run");

if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const supabase = createClient(url, key);

let armasDescricao = false;

function missingColumn(err, column) {
  const msg = err?.message ?? "";
  return err?.code === "PGRST204" && msg.includes(`'${column}'`);
}

async function detectSchema() {
  const { error } = await supabase.from("armas").select("descricao").limit(1);
  if (!error) armasDescricao = true;
  else console.warn("Aviso: migration 027 (armas.descricao) não aplicada — descrição omitida.");
}

const IMPOSTO_SIMPLES = 10;
const DIFAL = 0;
const MARGEM = 40;

function precoVendaSugerido(precoCusto, impostoSimples, difal, lucro) {
  const custoComImpostos =
    precoCusto * (1 + impostoSimples / 100) * (1 + difal / 100);
  const valorBruto = custoComImpostos * (1 + lucro / 100);
  if (valorBruto >= 100) {
    return Math.floor(valorBruto / 10 + 1e-9) * 10 - 0.1;
  }
  return Math.floor(valorBruto * 100 + 1e-9) / 100;
}

/** SKU → custo out/26, msrp — TABELA FIRE OUTUBRO 2026 VALOR NORMAL */
const TABELA = {
  18770: { custo: 17, msrp: 22.5 },
  19015: { custo: 428, msrp: 598.5 },
  18768: { custo: 192, msrp: 268.5 },
  19017: { custo: 64, msrp: 88.5 },
  19016: { custo: 64, msrp: 88.5 },
  18758: { custo: 64, msrp: 88.5 },
  19020: { custo: 257, msrp: 358.5 }, // PDF lista 3.358,50 — corrigido para 358,50
  19019: { custo: 224, msrp: 313.5 },
  19032: { custo: 67, msrp: 93 },
  18761: { custo: 289, msrp: 403.5 },
  19018: { custo: 749, msrp: 1048.5 },
  19021: { custo: 70, msrp: 97.5 },
  18762: { custo: 846, msrp: 1183.5 },
  18074: { custo: 889, msrp: 1243.5 },
  18657: { custo: 771, msrp: 1078.5 },
  18756: { custo: 128, msrp: 178.5 },
  23750: { custo: 589, msrp: 893.5 },
  10780: { custo: 179, msrp: 249 },
  18776: { custo: 214, msrp: 299 },
  21322: { custo: 50, msrp: 88.5 },
};

function precificar(sku) {
  const row = TABELA[String(sku)];
  if (!row) throw new Error(`SKU ${sku} sem linha na tabela`);
  const preco = precoVendaSugerido(row.custo, IMPOSTO_SIMPLES, DIFAL, MARGEM);
  return { ...row, preco, sku: String(sku) };
}

const ACESSORIOS = [
  {
    sku: "18770",
    nome: "Kit amortecedor Accuwedge",
    descricao: `Kit amortecedor Accuwedge. Compatível com a plataforma AR; confeccionado em silicone; reduz folgas e ruídos entre upper e lower; aumenta estabilidade, precisão e vida útil dos componentes internos. Montado sob o pino de desmontagem traseiro, instalação fácil sem armeiro.

SKU ${18770}`,
  },
  {
    sku: "19015",
    nome: "Coronha Comfort",
    descricao: `Coronha Comfort. Compatível com AR-15/M4/M16 Mil-Spec, polímero de alta resistência com soleira em borracha. Resistente a calor, impactos e corrosão; furação para visualização da posição e compartimento interno para armazenamento.

SKU ${19015}`,
  },
  {
    sku: "18768",
    nome: "Empunhadura Comfort AR-15",
    descricao: `Empunhadura Comfort AR-15. Compatível com plataforma AR-15; anticorrosiva e autolubrificante; resistente a altas temperaturas e impactos; design ergonômico com texturas para maior firmeza.

SKU ${18768}`,
  },
  {
    sku: "19017",
    nome: "Kit Hand Stop",
    descricao: `Kit Hand Stop. Compatível com AR-15/M4/M16 e sistemas M-LOK e Keymod; polímero de alta resistência, leve e baixo perfil; melhor controle e precisão como batente de mão.

SKU ${19017}`,
  },
  {
    sku: "19016",
    nome: "Kit guarda mato AR-15",
    descricao: `Kit guarda mato AR-15. Protege o gatilho; articulação para manuseio com luvas; perfil que amplia o acesso ao gatilho.

SKU ${19016}`,
  },
  {
    sku: "18758",
    nome: "Kit janela de ejeção polímero AR-15",
    descricao: `Kit janela de ejeção polímero AR-15. Janela em polímero leve; componentes em aço carbono; vedação aprimorada do upper; evita marcas no lower; mola de torção com perfil protetivo.

SKU ${18758}`,
  },
  {
    sku: "19020",
    nome: "Kit de reparo do ferrolho AR-15",
    descricao: `Kit de reparo do ferrolho AR-15. Extrator, pinos, molas, anel amortecedor, ejetor, inserto e anéis de gás (3x). Extrator em aço carbono austemperado; ejetor tratado termicamente; anéis de gás em aço inox.

SKU ${19020}`,
  },
  {
    sku: "19019",
    nome: "Kit de reparo do impulsor",
    descricao: `Kit de reparo do impulsor. Percursor, pino came e contrapino; percursor em aço carbono cromado; pino came tratado termicamente.

SKU ${19019}`,
  },
  {
    sku: "19032",
    nome: "Kit Rubber Cover AR-15",
    descricao: `Kit Rubber Cover AR-15. Borracha vulcanizada; compatível com M-LOK; pegada mais sólida; protege mãos e equipamento.

SKU ${19032}`,
  },
  {
    sku: "18761",
    nome: "Kit trilhos Picatinny",
    descricao: `Kit trilhos Picatinny. Trilhos 3, 7 e 11 slots; porcas M-LOK (7x), Keymod (7x) e parafusos (7x). Compatível com M-LOK e Keymod.

SKU ${18761}`,
  },
  {
    sku: "19018",
    nome: "Kit tubo da coronha AR-15",
    descricao: `Kit tubo da coronha AR-15. Tubo com 6 regulagens, mola recuperador M4, conjunto buffer M4, porca castelo, colar travador com suporte para bandoleira (Mil-Spec).

SKU ${19018}`,
  },
  {
    sku: "19021",
    nome: 'Kit Wooooops!!! AR-15',
    descricao: `Kit Wooooops!!! AR-15. Pinoflex principal de pinos e molas facilmente perdidos na montagem: contrapino do percursor, retenção do ferrolho, buffer, seletor de tiro e demais itens listados no folder.

SKU ${19021}`,
  },
  {
    sku: "18762",
    nome: "Kit conjunto de mira flip-up AR-15 (alumínio)",
    descricao: `Kit conjunto de mira flip-up AR-15 (alumínio). Alça e massa de mira flip-up Gen2, design retrátil.

SKU ${18762}`,
  },
  {
    sku: "18074",
    nome: 'Kit handguard FE AR-15 p/ canos de 14,5" (M-LOK)',
    descricao: `Kit handguard FE AR-15 para canos de 14,5". Trilho Picatinny superior e encaixes M-LOK; alumínio anodizado tipo 3; componentes em inox e aço carbono tratado.

SKU ${18074}`,
  },
  {
    sku: "18657",
    nome: "Kit ambidestro Gen1",
    descricao: `Kit ambidestro Gen1. Alavanca de manejo, seletor de tiro, colar travador e retém do carregador ambidestros; alumínio e aço carbono; acabamento anodizado; engate QD para bandoleira.

SKU ${18657}`,
  },
  {
    sku: "18756",
    nome: "Kit reparo mecanismo de disparo",
    descricao: `Kit reparo mecanismo de disparo. Mola do gatilho, mola do cão e mola do desconector (AR-15/M4/M16); molas em aço carbono.

SKU ${18756}`,
  },
  {
    sku: "23750",
    nome: "Kit manutenção AR-9",
    calibreNome: "9MM",
    descricao: `Kit manutenção AR-9. 2 kits de percursor, extrator, insertos, molas, anéis, pinos elásticos, pinos do cão/gatilho, molas do cão, desconector e gatilho.

SKU ${23750}`,
  },
  {
    sku: "10780",
    nome: "Carregador AR-9 Glock Gen.4–5 (33 tiros)",
    calibreNome: "9MM",
    descricao: `Carregador AR-9 / Glock Gen. 4–5, calibre 9×19 mm. Polímero translúcido, mola inox, 33 tiros; guias internas para movimentação precisa do transportador.

SKU ${10780}`,
    capacidade: "33",
  },
  {
    sku: "18776",
    nome: "Carregador AR-15 (30 tiros)",
    calibreNome: "5,56x45",
    descricao: `Carregador AR-15/M4. Polímero translúcido, mola inox tratada; calibres 5,56×45, .223 Rem e .300 BLK; 30 tiros.

SKU ${18776}`,
    capacidade: "30",
  },
  {
    sku: "21322",
    nome: "Short Hand-Stop",
    descricao: `Short Hand-Stop. AR/M4/M16; M-LOK/Keymod; alumínio com parafusos, porcas e chave Allen; baixo perfil; batente de mão.

SKU ${21322}`,
  },
];

async function ensureNome(table, nome) {
  const { data: found } = await supabase.from(table).select("id").eq("nome", nome).maybeSingle();
  if (found?.id) return found.id;
  if (dryRun) return `dry-${table}-${nome}`;
  const { data, error } = await supabase.from(table).insert({ nome }).select("id").single();
  if (error) throw new Error(`${table} insert ${nome}: ${error.message}`);
  return data.id;
}

function normCat(nome) {
  return String(nome ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const CATEGORIA_ALIASES = { acessorios: "acessorios" };

async function ensureCategoria(nome) {
  const wanted = nome.trim();
  const { data: all, error: listErr } = await supabase.from("categorias").select("id, nome");
  if (listErr) throw new Error(`categorias list: ${listErr.message}`);
  const wantedNorm = CATEGORIA_ALIASES[normCat(wanted)] || normCat(wanted);
  const hit = (all || []).find((c) => normCat(c.nome).replace(/ó/g, "o") === wantedNorm || normCat(c.nome) === wantedNorm);
  if (hit?.id != null) return hit.id;
  if (dryRun) return -1;
  const maxId = Math.max(0, ...(all || []).map((c) => Number(c.id) || 0));
  const newId = maxId + 1;
  const { data, error } = await supabase
    .from("categorias")
    .insert({ id: newId, nome: wanted })
    .select("id")
    .single();
  if (error) throw new Error(`categorias insert: ${error.message}`);
  return data.id;
}

async function findArmaByNome(nome) {
  const { data } = await supabase.from("armas").select("id").eq("nome", nome).maybeSingle();
  return data?.id ?? null;
}

async function upsertAcessorio(item) {
  const p = precificar(item.sku);
  const categoriaId = await ensureCategoria("Acessórios");
  const marcaId = await ensureNome("marcas", "Fire Eagle Armory");
  const calibreId = item.calibreNome
    ? await ensureNome("calibres", item.calibreNome)
    : null;

  const payload = {
    categoria_id: categoriaId,
    nome: item.nome,
    preco: p.preco,
    funcionamento_id: null,
    marca_id: marcaId,
    calibres_id: calibreId,
    espec_capacidade_tiros: item.capacidade ?? null,
    espec_carregadores: null,
    espec_comprimento_cano: null,
    caracteristica_acabamento: null,
    ...(armasDescricao ? { descricao: item.descricao } : {}),
    em_destaque: false,
    em_promocao: true,
    preco_promocional: p.msrp,
    promocao_modo: "avista",
    promocao_parcelas_max: null,
    destaque_promocao: false,
    preco_custo: p.custo,
    margem_venda_percent: MARGEM,
    imposto_simples_percent: IMPOSTO_SIMPLES,
    difal_percent: DIFAL,
  };

  if (dryRun) {
    console.log("\n===", item.nome, "SKU", item.sku, "===");
    console.log("custo", p.custo, "venda", p.preco, "msrp", p.msrp);
    return;
  }

  let armaId = await findArmaByNome(item.nome);
  if (armaId) {
    let { error } = await supabase.from("armas").update(payload).eq("id", armaId);
    if (missingColumn(error, "descricao")) {
      armasDescricao = false;
      delete payload.descricao;
      ({ error } = await supabase.from("armas").update(payload).eq("id", armaId));
    }
    if (error) throw error;
  } else {
    let { error } = await supabase.from("armas").insert(payload);
    if (missingColumn(error, "descricao")) {
      armasDescricao = false;
      delete payload.descricao;
      ({ error } = await supabase.from("armas").insert(payload));
    }
    if (error) throw error;
  }
  console.log("OK:", item.nome, `(SKU ${item.sku})`);
}

async function main() {
  console.log(dryRun ? "DRY-RUN acessórios Fire Eagle" : "Import acessórios Fire Eagle…");
  console.log("Regra: custo out/26 · imposto 10% · lucro 40% · promo = MSRP");
  if (!dryRun) await detectSchema();

  for (const a of ACESSORIOS) {
    await upsertAcessorio(a);
  }
  console.log("\nConcluído.", ACESSORIOS.length, "itens.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
