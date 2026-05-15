import { supabase } from "./supabaseClient";

const CHUNK_SIZE = 200;

/** Preços mínimos por arma_id; consulta só os IDs informados (em chunks). */
export async function fetchMinPrecoPorArmaIds(
  armaIds: string[]
): Promise<Map<string, number>> {
  const minMap = new Map<string, number>();
  if (armaIds.length === 0) return minMap;

  for (let i = 0; i < armaIds.length; i += CHUNK_SIZE) {
    const chunk = armaIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("variacoes_armas")
      .select("arma_id, preco")
      .in("arma_id", chunk);

    if (error) {
      console.error("variacoes_armas:", error);
      continue;
    }

    (data || []).forEach((row: { arma_id: string; preco: number | string }) => {
      const preco = parseFloat(String(row.preco));
      const cur = minMap.get(row.arma_id);
      if (cur == null || preco < cur) minMap.set(row.arma_id, preco);
    });
  }

  return minMap;
}
