export function formatBRL(n: number) {
  return parseFloat(String(n)).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type ArmaPromoCampos = {
  em_promocao?: boolean | null;
  preco_promocional?: number | string | null;
  preco?: number | string | null;
};

/** Preço de referência na listagem: menor entre variações ou preço da arma. */
export function precoOriginalLista(
  minVariacao: number | undefined,
  armaPreco: number | null | undefined
): number | null {
  if (minVariacao != null && !Number.isNaN(Number(minVariacao))) return Number(minVariacao);
  if (armaPreco != null && !Number.isNaN(Number(armaPreco))) return Number(armaPreco);
  return null;
}

export function emPromocaoValida(arma: ArmaPromoCampos): boolean {
  if (!arma.em_promocao) return false;
  const p = arma.preco_promocional != null ? Number(arma.preco_promocional) : NaN;
  return !Number.isNaN(p) && p > 0;
}

export function textoCondicaoPromocao(
  modo: string | null | undefined,
  parcelas: number | null | undefined
): string {
  if (modo === "parcelado" && parcelas != null && parcelas > 0) {
    return `Parcela em até ${parcelas}x`;
  }
  if (modo === "avista") return "Promoção à vista";
  return "";
}
