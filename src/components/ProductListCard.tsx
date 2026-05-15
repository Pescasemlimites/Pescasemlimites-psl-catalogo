"use client";

import Link from "next/link";
import {
  emPromocaoValida,
  formatBRL,
  precoOriginalLista,
  textoCondicaoPromocao,
} from "../lib/promoPreco";

export type ProductListCardProduct = {
  id: string;
  nome: string | null;
  preco: number | null;
  foto_url?: string | null;
  primeiraFoto?: string | null;
  em_promocao?: boolean | null;
  preco_promocional?: number | null;
  promocao_modo?: string | null;
  promocao_parcelas_max?: number | null;
  em_destaque?: boolean | null;
};

type ProductListCardProps = {
  product: ProductListCardProduct;
  minVariacaoPreco?: number | null;
  /** Texto curto opcional (ex.: "9mm · 15+1 tiros") */
  metaLinha?: string | null;
  marcaNome?: string | null;
  showMarcaAboveTitle?: boolean;
  showDestaqueBadge?: boolean;
};

function PrecoConteudo({
  product,
  minV,
}: {
  product: ProductListCardProduct;
  minV: number | undefined;
}) {
  const original = precoOriginalLista(minV, product.preco);
  const promoOk = emPromocaoValida(product);

  if (!promoOk && original == null) {
    return <span className="text-sm text-zinc-500">Consulte</span>;
  }

  if (promoOk && original != null) {
    return (
      <div className="min-w-0 space-y-0.5 text-left">
        <p className="text-xs text-zinc-500 line-through">
          {minV != null ? "A partir de " : ""}R$ {formatBRL(original)}
        </p>
        <p className="text-lg font-bold tabular-nums text-[#E9B20E]">
          R$ {formatBRL(Number(product.preco_promocional))}
        </p>
        <p className="text-[11px] leading-snug text-zinc-500">
          {textoCondicaoPromocao(product.promocao_modo, product.promocao_parcelas_max)}
        </p>
      </div>
    );
  }

  if (promoOk) {
    return (
      <div className="min-w-0 space-y-0.5 text-left">
        <p className="text-lg font-bold tabular-nums text-[#E9B20E]">
          R$ {formatBRL(Number(product.preco_promocional))}
        </p>
        <p className="text-[11px] leading-snug text-zinc-500">
          {textoCondicaoPromocao(product.promocao_modo, product.promocao_parcelas_max)}
        </p>
      </div>
    );
  }

  return (
    <p className="text-lg font-bold tabular-nums text-[#E9B20E]">
      {minV != null ? "A partir de " : ""}R$ {formatBRL(original!)}
    </p>
  );
}

export default function ProductListCard({
  product,
  minVariacaoPreco,
  metaLinha,
  marcaNome,
  showMarcaAboveTitle = false,
  showDestaqueBadge = false,
}: ProductListCardProps) {
  const img = product.primeiraFoto || product.foto_url || null;
  const promoOk = emPromocaoValida(product);
  const minV = minVariacaoPreco ?? undefined;
  const destaque = showDestaqueBadge && product.em_destaque;

  return (
    <Link
      href={`/produto/${product.id}`}
      className="group block h-full rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 p-3 text-white shadow-lg shadow-black/20 outline-none ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#E9B20E]/35 hover:shadow-xl hover:shadow-black/30 focus-visible:ring-2 focus-visible:ring-[#E9B20E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#030711]"
    >
      <article className="flex h-full flex-col">
        <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-xl bg-zinc-950 ring-1 ring-inset ring-zinc-800/80">
          {img ? (
            <img
              src={img}
              alt={product.nome || "Produto"}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-600">
              <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-xs">Sem imagem</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
          <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
            {promoOk ? (
              <span className="rounded-md bg-[#E9B20E] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-900 shadow">
                Promoção
              </span>
            ) : null}
            {destaque ? (
              <span className="rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 backdrop-blur-sm">
                Destaque
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-0.5 pb-1">
          {showMarcaAboveTitle && marcaNome ? (
            <p className="mb-1 line-clamp-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              {marcaNome}
            </p>
          ) : null}

          <h2 className="mb-1.5 line-clamp-2 min-h-[2.5rem] text-base font-semibold leading-snug text-white sm:min-h-[2.75rem] sm:text-[1.05rem]">
            {product.nome || "Sem nome"}
          </h2>

          {metaLinha ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">{metaLinha}</p>
          ) : null}

          <div className="min-h-2 flex-1" aria-hidden />

          <div className="flex items-end justify-between gap-2 border-t border-zinc-800/80 pt-3">
            <div className="min-w-0 flex-1">
              <PrecoConteudo product={product} minV={minV} />
            </div>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700/90 bg-zinc-800/50 text-zinc-400 transition-all group-hover:border-[#E9B20E]/40 group-hover:bg-[#E9B20E]/10 group-hover:text-[#E9B20E]"
              aria-hidden
            >
              <svg className="h-4 w-4 translate-x-px transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
