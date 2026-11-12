import { formatBRL } from "./promoPreco";

export type DescontoTipo = "percent" | "fixed";

export type OrcamentoLinha = {
  id: string;
  tipo: "arma" | "acessorio";
  armaId?: string | null;
  variacaoId?: string | null;
  descricao: string;
  detalhe?: string | null;
  quantidade: number;
  /** Valor normal de tabela (para riscar quando houver promo). */
  precoLista?: number | null;
  /** Promo do catálogo (quando aplicável). */
  precoPromocao?: number | null;
  /** Preço unitário efetivo (promo + desconto avulso ou ajuste manual). */
  precoUnitario: number;
  descontoLinhaTipo?: DescontoTipo | null;
  descontoLinhaValor?: number | null;
  fotoUrl?: string | null;
  marca?: string | null;
};

export function precoBaseLinha(linha: OrcamentoLinha): number {
  const promo = linha.precoPromocao != null ? Number(linha.precoPromocao) : NaN;
  if (Number.isFinite(promo) && promo > 0) return promo;
  const lista = linha.precoLista != null ? Number(linha.precoLista) : NaN;
  if (Number.isFinite(lista) && lista > 0) return lista;
  const unit = Number(linha.precoUnitario);
  return Number.isFinite(unit) ? unit : 0;
}

export function aplicarDescontoLinha(base: number, tipo: DescontoTipo | null | undefined, valor: number): number {
  if (!tipo || !Number.isFinite(valor) || valor <= 0) {
    return Math.round(base * 100) / 100;
  }
  const desc =
    tipo === "percent"
      ? Math.round((base * Math.min(100, valor)) / 100 * 100) / 100
      : Math.min(base, valor);
  return Math.max(0, Math.round((base - desc) * 100) / 100);
}

export function recalcularPrecoUnitario(linha: OrcamentoLinha): OrcamentoLinha {
  const base = precoBaseLinha(linha);
  const unit = aplicarDescontoLinha(base, linha.descontoLinhaTipo, Number(linha.descontoLinhaValor ?? 0));
  return { ...linha, precoUnitario: unit };
}

export function unitarioEfetivoLinha(linha: OrcamentoLinha): number {
  const u = Number(linha.precoUnitario);
  return Number.isFinite(u) ? u : 0;
}

export function temPromocaoCatalogo(linha: OrcamentoLinha): boolean {
  const lista = linha.precoLista != null ? Number(linha.precoLista) : NaN;
  const promo = linha.precoPromocao != null ? Number(linha.precoPromocao) : NaN;
  return (
    Number.isFinite(lista) &&
    Number.isFinite(promo) &&
    promo > 0 &&
    lista > promo + 0.009
  );
}

export function subtotalLinhas(linhas: OrcamentoLinha[]): number {
  return linhas.reduce((acc, l) => {
    const u = unitarioEfetivoLinha(l);
    const q = Number(l.quantidade);
    if (!Number.isFinite(u) || !Number.isFinite(q) || q < 1) return acc;
    return acc + u * q;
  }, 0);
}

export function valorDesconto(
  subtotal: number,
  tipo: DescontoTipo | null,
  valor: number
): number {
  if (subtotal <= 0 || valor <= 0 || !tipo) return 0;
  if (tipo === "percent") {
    const pct = Math.min(100, Math.max(0, valor));
    return Math.round((subtotal * pct) / 100 * 100) / 100;
  }
  return Math.min(subtotal, Math.max(0, valor));
}

export function totalComDesconto(
  subtotal: number,
  tipo: DescontoTipo | null,
  valorDescontoInput: number
): number {
  const desc = valorDesconto(subtotal, tipo, valorDescontoInput);
  return Math.max(0, Math.round((subtotal - desc) * 100) / 100);
}

export function formatOrcamentoBRL(n: number): string {
  return formatBRL(n);
}
