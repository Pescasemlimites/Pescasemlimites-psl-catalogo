/**
 * Precificação no cadastro da arma:
 * 1) Custo com impostos: aplica o primeiro % sobre o custo, o segundo sobre esse subtotal (em sequência).
 * 2) Lucro: % sobre o valor "custo + impostos".
 * 3) Arredondamento: para valores >= R$ 100, desce para a dezena de reais imediatamente inferior e subtrai R$ 0,10
 *    (ex.: 8778,21 → 8769,90). Abaixo de R$ 100, apenas piso ao centavo.
 */

const EPS = 1e-9;

/** Custo após aplicar Simples e, em seguida, DIFAL (cada % sobre o subtotal da etapa). */
export function custoComImpostosSequencial(
  precoCusto: number,
  impostoSimplesPercent: number,
  difalPercent: number
): number {
  const s = Number(impostoSimplesPercent) || 0;
  const d = Number(difalPercent) || 0;
  return precoCusto * (1 + s / 100) * (1 + d / 100);
}

/** Valor antes do arredondamento final: (custo com impostos) × (1 + lucro%). */
export function valorComLucroBruto(
  custoComImpostos: number,
  lucroPercent: number
): number {
  const L = Number(lucroPercent) || 0;
  return custoComImpostos * (1 + L / 100);
}

/**
 * Arredondamento para baixo ao estilo comercial para preços >= 100:
 * parte inteira em reais desce à dezena inferior e o preço termina em ,90 (ex.: 8778,21 → 8769,90).
 * Valores &lt; 100: piso ao centavo.
 */
export function arredondarPrecoVendaFinal(valorBruto: number): number {
  if (!Number.isFinite(valorBruto) || valorBruto <= 0) return 0;
  if (valorBruto >= 100) {
    return Math.floor(valorBruto / 10 + EPS) * 10 - 0.1;
  }
  return Math.floor(valorBruto * 100 + EPS) / 100;
}

export type ResultadoPrecificacaoArma = {
  custoComImpostos: number;
  valorBrutoComLucro: number;
  precoSugerido: number;
};

export function calcularPrecificacaoArma(
  precoCusto: number,
  pctSimples: number,
  pctDifal: number,
  lucroPercent: number
): ResultadoPrecificacaoArma {
  const custoComImpostos = custoComImpostosSequencial(precoCusto, pctSimples, pctDifal);
  const valorBrutoComLucro = valorComLucroBruto(custoComImpostos, lucroPercent);
  const precoSugerido = arredondarPrecoVendaFinal(valorBrutoComLucro);
  return { custoComImpostos, valorBrutoComLucro, precoSugerido };
}

/** Preço sugerido final (após arredondamento). */
export function precoVendaSugerido(
  precoCusto: number,
  impostoSimplesPercent: number,
  difalPercent: number,
  lucroPercent: number
): number {
  return calcularPrecificacaoArma(
    precoCusto,
    impostoSimplesPercent,
    difalPercent,
    lucroPercent
  ).precoSugerido;
}
