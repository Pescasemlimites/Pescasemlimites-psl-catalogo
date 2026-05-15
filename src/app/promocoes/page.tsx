"use client";

import { useEffect, useState } from "react";
import Header from "../../components/Header";
import ProductListCard from "../../components/ProductListCard";
import { supabase } from "../../lib/supabaseClient";
import { fetchMinPrecoPorArmaIds } from "../../lib/fetchVariacoesMinPreco";

type Arma = {
  id: string;
  nome: string | null;
  preco: number | null;
  foto_url: string | null;
  em_promocao?: boolean | null;
  preco_promocional?: number | null;
  promocao_modo?: string | null;
  promocao_parcelas_max?: number | null;
  em_destaque?: boolean | null;
  primeiraFoto?: string | null;
};

export default function PromocoesPage() {
  const [armas, setArmas] = useState<Arma[]>([]);
  const [minPrecoPorArma, setMinPrecoPorArma] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArmas = async () => {
      try {
        setLoading(true);
        const armasResult = await supabase
          .from("armas")
          .select(
            "id, nome, preco, foto_url, em_promocao, preco_promocional, promocao_modo, promocao_parcelas_max, em_destaque"
          )
          .eq("em_promocao", true)
          .order("nome");

        if (armasResult.error) {
          setError(`Erro ao carregar promoções: ${armasResult.error.message}`);
          setArmas([]);
          setMinPrecoPorArma(new Map());
          return;
        }

        const armasList = (armasResult.data || []) as Arma[];
        const minMap = await fetchMinPrecoPorArmaIds(armasList.map((a) => a.id));

        const armaIds = armasList.map((a) => a.id);
        const fotosMap = new Map<string, string>();
        if (armaIds.length > 0) {
          const { data: fotosData } = await supabase
            .from("fotos_armas")
            .select("arma_id, foto_url, ordem")
            .in("arma_id", armaIds)
            .order("ordem", { ascending: true });
          (fotosData || []).forEach((foto: { arma_id: string; foto_url: string }) => {
            if (!fotosMap.has(foto.arma_id)) fotosMap.set(foto.arma_id, foto.foto_url);
          });
        }

        setArmas(
          armasList.map((a) => ({
            ...a,
            primeiraFoto: fotosMap.get(a.id) || a.foto_url || null,
          }))
        );
        setMinPrecoPorArma(minMap);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao carregar promoções");
      } finally {
        setLoading(false);
      }
    };

    fetchArmas();
  }, []);

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#030711" }}
      >
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#030711" }}>
        <Header />
        <main className="flex-1 px-4 py-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-red-400">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#030711" }}>
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <div className="container mx-auto max-w-7xl">
          <header className="mb-10 border-b border-zinc-800/80 pb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#E9B20E]/90">
              Ofertas
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Promoções</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Armas com preço promocional ativo no catálogo.
            </p>
            {armas.length > 0 ? (
              <p className="mt-4 text-sm font-medium text-zinc-500">
                {armas.length} {armas.length === 1 ? "item" : "itens"}
              </p>
            ) : null}
          </header>

          {armas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 px-6 py-16 text-center">
              <p className="text-zinc-400">Nenhuma promoção no momento.</p>
            </div>
          ) : (
            <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {armas.map((arma) => (
                <ProductListCard
                  key={arma.id}
                  product={arma}
                  minVariacaoPreco={minPrecoPorArma.get(arma.id)}
                  showDestaqueBadge
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
