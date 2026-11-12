/**
 * Importa cadastro Fire Eagle (folder Out/2026) com precificação da tabela OUT/2026.
 *
 * Custo (preco_custo): coluna out/26
 * Imposto no produto: 10% (RS), DIFAL 0%
 * Margem: 40% → preço de venda (variacoes_armas.preco)
 * MSRP → preco_promocional (em_promocao à vista)
 *
 * Uso:
 *   set SUPABASE_SERVICE_ROLE_KEY=...  (recomendado)
 *   node scripts/import-fire-eagle-catalogo.mjs
 *   node scripts/import-fire-eagle-catalogo.mjs --dry-run
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

/** Colunas das migrations 027/028 — só usa se existirem no banco */
const schema = { armasDescricao: false, variacaoSku: false };

function missingColumn(err, column) {
  const msg = err?.message ?? "";
  return err?.code === "PGRST204" && msg.includes(`'${column}'`);
}

async function detectSchema() {
  const { error: eSku } = await supabase.from("variacoes_armas").select("sku").limit(1);
  if (!eSku) schema.variacaoSku = true;
  const { error: eDesc } = await supabase.from("armas").select("descricao").limit(1);
  if (!eDesc) schema.armasDescricao = true;
  if (!schema.variacaoSku) {
    console.warn("Aviso: rode a migration 028 (coluna variacoes_armas.sku) para gravar SKU.");
  }
  if (!schema.armasDescricao) {
    console.warn("Aviso: rode a migration 027 (coluna armas.descricao) para gravar descrição.");
  }
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

/** SKU → { custo, msrp } — TABELA FIRE OUTUBRO 2026 VALOR NORMAL */
const TABELA = {
  24206: { custo: 10980, msrp: 15990 },
  24208: { custo: 11503, msrp: 16490 },
  24566: { custo: 13073, msrp: 18990 },
  24567: { custo: 13073, msrp: 18990 },
  24542: { custo: 13073, msrp: 18990 },
  24594: { custo: 34545.6, msrp: 49900 },
  24569: { custo: 13597, msrp: 19690 },
  24570: { custo: 13597, msrp: 19690 },
  24568: { custo: 13597, msrp: 19690 },
  22864: { custo: 9280, msrp: 12990 },
  24733: { custo: 10780, msrp: 14490 },
  24729: { custo: 10780, msrp: 14490 },
  24730: { custo: 10780, msrp: 14490 },
  22986: { custo: 8454, msrp: 10990 },
  22987: { custo: 8839, msrp: 11490 },
  22988: { custo: 9608, msrp: 12490 },
  22966: { custo: 9993, msrp: 13990 },
  22970: { custo: 10350, msrp: 14490 },
  22974: { custo: 11065, msrp: 15490 },
  22978: { custo: 12136, msrp: 16990 },
  22981: { custo: 12850, msrp: 17990 },
  22991: { custo: 10992.86, msrp: 15390 },
  22989: { custo: 11421.43, msrp: 15990 },
  21150: { custo: 3922, msrp: 5490.8 },
  21685: { custo: 3922, msrp: 5490.8 },
  23632: { custo: 3922, msrp: 5490.8 },
  21080: { custo: 3922, msrp: 5490.8 },
};

function precificar(sku) {
  const row = TABELA[String(sku)];
  if (!row) throw new Error(`SKU ${sku} sem linha na tabela`);
  const preco = precoVendaSugerido(row.custo, IMPOSTO_SIMPLES, DIFAL, MARGEM);
  return { ...row, preco, sku: String(sku) };
}

const DESCR = {
  dark300Base: `Ação direta de gases. Ferrolho rotativo. Operação 100% ambidestra. Bloco de gás ajustável. Quebra-chamas de 3 pontas. Carregador polímero 30 tiros. Miras flip-up.

CAL. .300 BLK`,
  dark300Cqb: `Ação direta de gases. Ferrolho rotativo. Operação 100% ambidestra. Bloco de gás ajustável. Quebra-chamas com engate para supressor estilo HUB Mount. Alavanca de manejo FE Gen 2. Carregador polímero 30 tiros. Miras flip-up. Acessórios Magpul: coronha MOE-K2, empunhadura MOE SL-K e empunhadura frontal SVG (quando aplicável).

CAL. .300 BLK`,
  nightEagle: `Acabamento Cerakote Multicam Black. Cano forjado a frio, passo 1:7, 5 raias à direita, nitretado, perfil heavy. Mira reflexiva Trijicon MRO®. Folding stock Law Tactical. Bandoleira MUTHAC GEAR® Sideback Sling. Funcionamento: ação direta dos gases (DI), bloco de gás pistol-length regulável em 8 posições. Charging handle FEA Gen2 ambidestro. Coronha Magpul® MOE SL-K. Grip Magpul® MOE K2. Grip frontal Magpul® SVG. Quebra-chamas FEA Eagle Lock® de 3 pontas. Carregador Magpul® 20 munições.

CAL. .300 BLK`,
  dark300Le: `Ação direta de gases. Ferrolho rotativo. Operação ambidestra. Bloco de gás ajustável. Quebra-chamas com engate para supressor estilo HUB Mount. Alavanca de manejo FE Gen 2. Carregador polímero 30 tiros. Miras flip-up. Acessórios Magpul: coronha MOE-K2 e empunhadura MOE SL-K.

CAL. .300 BLK`,
  fe411: `Ação blow back simples. Operação 100% ambidestra. Cano 11" (279,4 mm), 1:16, nitretado. Carregador polímero 30 tiros, compatível com Glock. Miras flip-up, regulagem lateral e vertical. Trilho Picatinny MIL-STD-1913, encaixes M-LOK. Quebra-chamas FEA® de 3 pontas. Acabamento em alumínio anodizado MIL-SPEC Type III.

CAL. .40 S&W`,
  atlas411: `Ação blow back simples. Operação 100% ambidestra. Cano 11" (279,4 mm), 1:16, nitretado. Carregador polímero 30 tiros, compatível com Glock. Miras flip-up. Trilho Picatinny MIL-STD-1913, encaixes M-LOK. Quebra-chamas FEA Eagle Lock® de 3 pontas.

CAL. .40 S&W`,
  fe905pr: `Fire Eagle FE-905PR — carabina AR-9. Sistema blowback simples. Regime de tiro semi-auto. Principais teclas ambidestras. Cano 5,5" (139 mm), 1:10, nitretado. Quebra-chamas falso supressor Fire Eagle®. Upper/lower em alumínio 7075-T6. Guarda-mão free floating com Picatinny e M-LOK® ou Keymod. Miras rebatíveis ambidestras. Carregador Fire Eagle® 33 munições, compatível com Glock®. Coronha e empunhadura Fire Eagle® Comfort com beavertail. Gatilho revestido em cromo duro.

CAL. 9x19mm`,
  fe908pr: `Fire Eagle FE-908PR — carabina AR-9. Sistema blowback simples. Regime de tiro semi-auto. Principais teclas ambidestras. Cano 8,5" (215 mm), 1:10, nitretado. Upper/lower em alumínio 7075-T6. Guarda-mão free floating com Picatinny e M-LOK® ou Keymod. Miras rebatíveis ambidestras. Carregador Fire Eagle® 33 munições, compatível com Glock®. Coronha e empunhadura Fire Eagle® Comfort com beavertail. Gatilho revestido em cromo duro.

CAL. 9x19mm`,
  fe914pr: `Fire Eagle FE-914PR — carabina AR-9. Sistema blowback simples. Cano 14,5" (368 mm), 1:10, nitretado. Compensador de recuo Fire Eagle® 1,5". Upper/lower em alumínio 7075-T6. Guarda-mão free floating com Picatinny e M-LOK® ou Keymod. Miras rebatíveis ambidestras. Carregador Fire Eagle® 33 munições, compatível com Glock®. Coronha e empunhadura Fire Eagle® Comfort. Gatilho revestido em cromo duro.

CAL. 9x19mm`,
  feS: `Ação direta dos gases. Operação ambidestra. Guarda-mão free floating com Picatinny e M-LOK. Miras rebatíveis ambidestras. Carregador Fire Eagle® 30 munições. Coronha e empunhadura Fire Eagle® Comfort. Gatilho revestido em cromo duro. Quebra-chamas padrão A2.

CAL. 5,56x45mm`,
  fe200hs: `Ação direta dos gases. Cano heavy 20" (508 mm), 1:7, nitretado, com caneluras. Operação ambidestra. Guarda-mão free floating com Picatinny e M-LOK. Miras rebatíveis ambidestras. Carregador Fire Eagle® 30 munições. Coronha e empunhadura Fire Eagle® Comfort. Gatilho revestido em cromo duro.

CAL. 5,56x45mm`,
  feSgp: `Ação por pistão de gás. Operação ambidestra. Guarda-mão free floating com Picatinny e M-LOK. Buffer H. Carregador Fire Eagle® 30 munições. Coronha e empunhadura Fire Eagle® Comfort. Gatilho revestido em cromo duro. Quebra-chamas padrão A2.

CAL. 5,56x45mm`,
};

const PRODUTOS = [
  {
    nome: "Fire Eagle Dark 300",
    categoria: "Fuzil",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: ".300BLK",
    descricao: DESCR.dark300Base,
    capacidade: "30",
    carregadores: "1",
    variacoes: [
      { sku: "24206", cano: '7,5" (190,5 mm)', acabamento: "Preto fosco" },
      { sku: "24208", cano: '10,5" (266,7 mm)', acabamento: "Preto fosco" },
    ],
  },
  {
    nome: "Fire Eagle Dark 300 CQB",
    categoria: "Fuzil",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: ".300BLK",
    descricao: `${DESCR.dark300Cqb}\n\nVariação Night Eagle (SKU 24594):\n${DESCR.nightEagle}`,
    capacidade: "30",
    carregadores: "1",
    variacoes: [
      { sku: "24566", cano: '7,5" (190,5 mm)', acabamento: "Cerakote H-267 FDE (areia)" },
      { sku: "24567", cano: '7,5" (190,5 mm)', acabamento: "Cerakote H-264 ODG (verde)" },
      { sku: "24542", cano: '7,5" (190,5 mm)', acabamento: "Preto fosco" },
      {
        sku: "24594",
        cano: '7,5" (190,5 mm) heavy',
        acabamento: "Cerakote Multicam Black (Night Eagle)",
        capacidade: "20",
      },
    ],
  },
  {
    nome: "Fire Eagle Dark 300 LE",
    categoria: "Fuzil",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: ".300BLK",
    descricao: DESCR.dark300Le,
    capacidade: "30",
    carregadores: "1",
    variacoes: [
      { sku: "24569", cano: '10,5" (266,7 mm)', acabamento: "Cerakote H-267 FDE (areia)" },
      { sku: "24570", cano: '10,5" (266,7 mm)', acabamento: "Cerakote H-264 ODG (verde)" },
      { sku: "24568", cano: '10,5" (266,7 mm)', acabamento: "Preto fosco" },
    ],
  },
  {
    nome: "Fire Eagle FE-411S",
    categoria: "Carabinas",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: ".40 S&W",
    descricao: DESCR.fe411,
    capacidade: "30",
    carregadores: "1",
    variacoes: [{ sku: "22864", cano: '11" (279,4 mm)', acabamento: "Anodizado MIL-SPEC Type III" }],
  },
  {
    nome: "Fire Eagle Atlas 411",
    categoria: "Carabinas",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: ".40 S&W",
    descricao: DESCR.atlas411,
    capacidade: "30",
    carregadores: "1",
    variacoes: [
      { sku: "24733", cano: '11" (279,4 mm)', acabamento: "Preto / Eagle Lock" },
      { sku: "24729", cano: '11" (279,4 mm)', acabamento: "Cerakote H-267 FDE (areia)" },
      { sku: "24730", cano: '11" (279,4 mm)', acabamento: "Cerakote H-264 ODG (verde)" },
    ],
  },
  {
    nome: "Fire Eagle FE-905PR",
    categoria: "Carabinas",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: "9MM",
    descricao: DESCR.fe905pr,
    capacidade: "33",
    carregadores: "1",
    variacoes: [{ sku: "22986", cano: '5,5" (139 mm)', acabamento: "Preto" }],
  },
  {
    nome: "Fire Eagle FE-908PR",
    categoria: "Carabinas",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: "9MM",
    descricao: DESCR.fe908pr,
    capacidade: "33",
    carregadores: "1",
    variacoes: [{ sku: "22987", cano: '8,5" (215 mm)', acabamento: "Preto" }],
  },
  {
    nome: "Fire Eagle FE-914PR",
    categoria: "Carabinas",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: "9MM",
    descricao: DESCR.fe914pr,
    capacidade: "33",
    carregadores: "1",
    variacoes: [{ sku: "22988", cano: '14,5" (368 mm)', acabamento: "Preto" }],
  },
  {
    nome: "Fire Eagle série S",
    categoria: "Fuzil",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: "5,56x45",
    descricao: DESCR.feS,
    capacidade: "30",
    carregadores: "1",
    variacoes: [
      { sku: "22966", cano: '11,5" (292 mm)', acabamento: "Preto" },
      { sku: "22970", cano: '14,5" (368 mm)', acabamento: "Preto" },
      { sku: "22974", cano: '16" (406 mm)', acabamento: "Preto" },
      { sku: "22978", cano: '20" (508 mm)', acabamento: "Preto" },
    ],
  },
  {
    nome: "Fire Eagle FE-200HS",
    categoria: "Fuzil",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: "5,56x45",
    descricao: DESCR.fe200hs,
    capacidade: "30",
    carregadores: "1",
    variacoes: [
      { sku: "22981", cano: '20" heavy (508 mm), caneluras', acabamento: "Preto" },
    ],
  },
  {
    nome: "Fire Eagle série SGP",
    categoria: "Fuzil",
    marca: "Fire Eagle Armory",
    funcionamento: "Semi-Automático",
    calibreNome: "5,56x45",
    descricao: DESCR.feSgp,
    capacidade: "30",
    carregadores: "1",
    variacoes: [
      { sku: "22991", cano: '11,5" (292 mm)', acabamento: "Preto" },
      { sku: "22989", cano: '14,5" (368 mm)', acabamento: "Preto" },
    ],
  },
];

const SUPRESSORES = [
  {
    nome: "Supressor roscado 5.56 / .223",
    sku: "21150",
    calibreNome: "5,56x45",
    descricao: `Supressor modular roscado. Rosca 1/2" x 28 UNEF TPI-RH. Construção em titânio. Cerakote Armor Black C-192. Redução de ruído ~30 dB.

CAL. 5,56 x 45 mm / .223 Rem`,
  },
  {
    nome: "Supressor roscado 9mm / .380 — 1/2x28",
    sku: "21685",
    calibreNome: "9MM",
    descricao: `Supressor modular roscado. Calibre 9 x 19 mm / .380 ACP. Rosca 1/2" x 28 UNEF TPI-RH. Titânio. Cerakote Armor Black C-192. Redução ~30 dB.

CAL. 9 x 19 mm / .380 ACP`,
  },
  {
    nome: "Supressor roscado 9mm / .380 — 1/2x36",
    sku: "23632",
    calibreNome: "9MM",
    descricao: `Supressor modular roscado (Brigade). Rosca 1/2" x 36 UNEF TPI-RH. Titânio. Cerakote Armor Black C-192. Redução ~30 dB.

CAL. 9 x 19 mm / .380 ACP`,
  },
  {
    nome: "Supressor roscado .308 / 300 BLK — 5/8x24",
    sku: "21080",
    calibreNome: "308 WIN",
    descricao: `Supressor modular roscado. Calibre 7.62 x 51 mm / .308 Win / 300 BLK. Rosca 5/8" x 24 UNEF TPI-RH. Titânio. Cerakote Armor Black C-192. Redução ~30 dB.

CAL. 7,62 x 51 mm / .308 Win / 300 BLK`,
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

/** Nomes do folder → nomes reais no catálogo (evita aba duplicada). */
const CATEGORIA_ALIASES = {
  carabina: "carabina",
  carabinas: "carabina",
  fuzil: "fuzil",
  fuzis: "fuzil",
  acessorios: "acessorios",
};

async function ensureCategoria(nome) {
  const wanted = nome.trim();
  const { data: all, error: listErr } = await supabase.from("categorias").select("id, nome");
  if (listErr) throw new Error(`categorias list: ${listErr.message}`);
  const wantedNorm = CATEGORIA_ALIASES[normCat(wanted)] || normCat(wanted);
  const hit = (all || []).find((c) => {
    const n = CATEGORIA_ALIASES[normCat(c.nome)] || normCat(c.nome);
    return n === wantedNorm;
  });
  if (hit?.id != null) return hit.id;
  if (dryRun) return -1;

  // Alguns projetos perderam o DEFAULT da sequence em categorias.id — define id manualmente.
  const maxId = Math.max(0, ...(all || []).map((c) => Number(c.id) || 0));
  const newId = maxId + 1;
  const { data, error } = await supabase
    .from("categorias")
    .insert({ id: newId, nome: wanted })
    .select("id")
    .single();
  if (error) {
    throw new Error(
      `categorias insert "${wanted}": ${error.message}. Crie a categoria no admin ou rode migration 029.`
    );
  }
  return data.id;
}

async function findArmaByNome(nome) {
  const { data } = await supabase.from("armas").select("id").eq("nome", nome).maybeSingle();
  return data?.id ?? null;
}

async function upsertProdutoComVariacoes(prod) {
  const categoriaId = await ensureCategoria(prod.categoria);
  const marcaId = await ensureNome("marcas", prod.marca);
  const funcionamentoId = await ensureNome("funcionamento", prod.funcionamento);
  const calibreId = await ensureNome("calibres", prod.calibreNome);

  const variacoesPreco = prod.variacoes.map((v) => {
    const p = precificar(v.sku);
    return { ...v, ...p, calibreId };
  });

  const minPromo = Math.min(...variacoesPreco.map((v) => v.msrp));

  const armaPayload = {
    categoria_id: categoriaId,
    nome: prod.nome,
    preco: null,
    funcionamento_id: funcionamentoId,
    marca_id: marcaId,
    calibres_id: null,
    espec_capacidade_tiros: prod.capacidade,
    espec_carregadores: prod.carregadores,
    espec_comprimento_cano: null,
    caracteristica_acabamento: null,
    ...(schema.armasDescricao ? { descricao: prod.descricao } : {}),
    em_destaque: false,
    em_promocao: true,
    preco_promocional: minPromo,
    promocao_modo: "avista",
    promocao_parcelas_max: null,
    destaque_promocao: false,
    preco_custo: null,
    margem_venda_percent: MARGEM,
    imposto_simples_percent: IMPOSTO_SIMPLES,
    difal_percent: DIFAL,
  };

  let armaId = await findArmaByNome(prod.nome);
  if (dryRun) {
    console.log("\n===", prod.nome, "===");
    console.log(armaPayload);
    for (const v of variacoesPreco) {
      console.log(" var", v.sku, v.cano, "custo", v.custo, "venda", v.preco, "msrp", v.msrp);
    }
    return;
  }

  if (armaId) {
    let { error } = await supabase.from("armas").update(armaPayload).eq("id", armaId);
    if (missingColumn(error, "descricao")) {
      schema.armasDescricao = false;
      delete armaPayload.descricao;
      ({ error } = await supabase.from("armas").update(armaPayload).eq("id", armaId));
    }
    if (error) throw error;
  } else {
    let { data, error } = await supabase.from("armas").insert(armaPayload).select("id").single();
    if (missingColumn(error, "descricao")) {
      schema.armasDescricao = false;
      delete armaPayload.descricao;
      ({ data, error } = await supabase.from("armas").insert(armaPayload).select("id").single());
    }
    if (error) throw error;
    armaId = data.id;
  }

  const selectVar =
    schema.variacaoSku
      ? "id, sku, comprimento_cano, caracteristica_acabamento"
      : "id, comprimento_cano, caracteristica_acabamento";
  const { data: existentes } = await supabase
    .from("variacoes_armas")
    .select(selectVar)
    .eq("arma_id", armaId);
  const porSku = new Map(
    schema.variacaoSku ? (existentes || []).map((r) => [r.sku, r.id]) : []
  );
  const porCanoAcab = new Map(
    (existentes || []).map((r) => [
      `${r.comprimento_cano}|||${r.caracteristica_acabamento ?? ""}`,
      r.id,
    ])
  );

  for (const v of variacoesPreco) {
    const row = {
      arma_id: armaId,
      calibre_id: calibreId,
      comprimento_cano: v.cano,
      caracteristica_acabamento: v.acabamento,
      preco_custo: v.custo,
      preco: v.preco,
      preco_promocional: v.msrp,
      ...(schema.variacaoSku ? { sku: v.sku } : {}),
    };
    const existId = schema.variacaoSku
      ? porSku.get(v.sku)
      : porCanoAcab.get(`${v.cano}|||${v.acabamento ?? ""}`);
    if (existId) {
      let { error } = await supabase.from("variacoes_armas").update(row).eq("id", existId);
      if (missingColumn(error, "sku")) {
        schema.variacaoSku = false;
        delete row.sku;
        ({ error } = await supabase.from("variacoes_armas").update(row).eq("id", existId));
      }
      if (error) throw error;
    } else {
      let { error } = await supabase.from("variacoes_armas").insert(row);
      if (missingColumn(error, "sku")) {
        schema.variacaoSku = false;
        delete row.sku;
        ({ error } = await supabase.from("variacoes_armas").insert(row));
      }
      if (error) throw error;
    }
  }
  console.log("OK:", prod.nome);
}

async function upsertSupressor(s) {
  const p = precificar(s.sku);
  const categoriaId = await ensureCategoria("Acessórios");
  const marcaId = await ensureNome("marcas", "Fire Eagle Armory");
  const calibreId = await ensureNome("calibres", s.calibreNome);

  const payload = {
    categoria_id: categoriaId,
    nome: s.nome,
    preco: p.preco,
    funcionamento_id: null,
    marca_id: marcaId,
    calibres_id: calibreId,
    espec_capacidade_tiros: null,
    espec_carregadores: null,
    espec_comprimento_cano: null,
    caracteristica_acabamento: "Cerakote Armor Black C-192",
    ...(schema.armasDescricao ? { descricao: s.descricao } : {}),
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
    console.log("\n===", s.nome, "SKU", s.sku, "===");
    console.log(payload);
    return;
  }

  let armaId = await findArmaByNome(s.nome);
  if (armaId) {
    const { error } = await supabase.from("armas").update(payload).eq("id", armaId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("armas").insert(payload);
    if (error) throw error;
  }
  console.log("OK supressor:", s.nome);
}

/** Cadastro antigo (um produto com 3 canos) — removido após split FE-905/908/914 PR. */
const LEGACY_ARMAS_REMOVER = ["Fire Eagle série PR"];

async function removeLegacyArmas() {
  for (const nome of LEGACY_ARMAS_REMOVER) {
    const id = await findArmaByNome(nome);
    if (!id) continue;
    const { error: ev } = await supabase.from("variacoes_armas").delete().eq("arma_id", id);
    if (ev) throw ev;
    const { error: ea } = await supabase.from("armas").delete().eq("id", id);
    if (ea) throw ea;
    console.log("Removido cadastro legado:", nome);
  }
}

async function main() {
  console.log(dryRun ? "DRY-RUN (sem gravar)" : "Import Fire Eagle…");
  console.log("Regra: custo out/26 · imposto 10% · lucro 40% · promo = MSRP");
  if (!dryRun) {
    await detectSchema();
    await removeLegacyArmas();
  }

  for (const p of PRODUTOS) {
    await upsertProdutoComVariacoes(p);
  }
  for (const s of SUPRESSORES) {
    await upsertSupressor(s);
  }
  console.log("\nConcluído.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
