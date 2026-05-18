import { supabase } from "./supabaseClient";

const CHUNK_SIZE = 200;

export type VariacoesMetaPorArma = {
  minPreco: Map<string, number>;
  calibresPorArma: Map<string, Set<string>>;
};

type VariacaoRow = {
  arma_id: string;
  preco: number | string;
  calibre_id: string | null;
};

/** Preço mínimo e calibres das variações por arma_id (consulta em chunks). */
export async function fetchVariacoesMetaPorArmaIds(
  armaIds: string[]
): Promise<VariacoesMetaPorArma> {
  const minPreco = new Map<string, number>();
  const calibresPorArma = new Map<string, Set<string>>();
  if (armaIds.length === 0) return { minPreco, calibresPorArma };

  for (let i = 0; i < armaIds.length; i += CHUNK_SIZE) {
    const chunk = armaIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("variacoes_armas")
      .select("arma_id, preco, calibre_id")
      .in("arma_id", chunk);

    if (error) {
      console.error("variacoes_armas:", error);
      continue;
    }

    (data || []).forEach((row: VariacaoRow) => {
      const preco = parseFloat(String(row.preco));
      if (Number.isFinite(preco)) {
        const cur = minPreco.get(row.arma_id);
        if (cur == null || preco < cur) minPreco.set(row.arma_id, preco);
      }
      if (row.calibre_id) {
        let set = calibresPorArma.get(row.arma_id);
        if (!set) {
          set = new Set();
          calibresPorArma.set(row.arma_id, set);
        }
        set.add(row.calibre_id);
      }
    });
  }

  return { minPreco, calibresPorArma };
}

/** Preços mínimos por arma_id; consulta só os IDs informados (em chunks). */
export async function fetchMinPrecoPorArmaIds(
  armaIds: string[]
): Promise<Map<string, number>> {
  const { minPreco } = await fetchVariacoesMetaPorArmaIds(armaIds);
  return minPreco;
}

export function armaPassaFiltroCalibre(
  calibresIdArma: string | null | undefined,
  armaId: string,
  calibreFiltro: string,
  calibresPorVariacao: Map<string, Set<string>>
): boolean {
  if (calibresIdArma === calibreFiltro) return true;
  return calibresPorVariacao.get(armaId)?.has(calibreFiltro) ?? false;
}

/** Rótulo de calibre para cards de listagem (arma simples ou variações). */
export function calibreExibicaoLista(
  calibresIdArma: string | null | undefined,
  armaId: string,
  calibresPorId: Map<string, string>,
  calibresPorVariacao: Map<string, Set<string>>
): string | undefined {
  if (calibresIdArma) {
    const nome = calibresPorId.get(calibresIdArma);
    if (nome) return nome;
  }
  const ids = calibresPorVariacao.get(armaId);
  if (!ids?.size) return undefined;
  const nomes = [...ids]
    .map((id) => calibresPorId.get(id))
    .filter((n): n is string => Boolean(n));
  if (nomes.length === 0) return undefined;
  if (nomes.length === 1) return nomes[0];
  return "Vários calibres";
}
