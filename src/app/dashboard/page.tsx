"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { supabase } from "../../../src/lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import {
  emPromocaoValida,
  formatBRL,
  precoOriginalLista,
  textoCondicaoPromocao,
} from "../../lib/promoPreco";

type ArmaDestaque = {
  id: string;
  nome: string;
  preco: number | null;
  foto_url: string | null;
  categoria_id: number | null;
  marca_id: string | null;
  calibres_id: string | null;
  espec_capacidade_tiros: string | null;
  marca?: { nome: string } | null;
  calibre?: { nome: string } | null;
  primeiraFoto?: string | null;
  em_promocao?: boolean | null;
  preco_promocional?: number | null;
  promocao_modo?: string | null;
  promocao_parcelas_max?: number | null;
  destaque_promocao?: boolean | null;
};

function PromoBannerBigCard({
  arma,
  minPrecoVariacao,
  onCardClick,
}: {
  arma: ArmaDestaque;
  minPrecoVariacao: number | undefined;
  onCardClick: () => void;
}) {
  const orig = precoOriginalLista(minPrecoVariacao, arma.preco);
  const cond = textoCondicaoPromocao(arma.promocao_modo, arma.promocao_parcelas_max);
  return (
    <button
      type="button"
      onClick={onCardClick}
      className="group relative flex w-full flex-col overflow-hidden rounded-2xl border-2 border-[#E9B20E]/85 bg-zinc-900/90 text-left shadow-xl transition-all hover:border-[#f5d978] sm:flex-row"
    >
      <div className="pointer-events-none absolute right-0 top-0 z-10 origin-top-right translate-x-2 -translate-y-1 rotate-12 transform bg-[#E9B20E] px-10 py-1 text-xs font-black uppercase tracking-widest text-zinc-900 shadow-md sm:px-12">
        Promoção
      </div>
      {(arma.primeiraFoto || arma.foto_url) && (
        <div className="relative aspect-square w-full shrink-0 overflow-hidden sm:w-64 md:w-72">
          <img
            src={arma.primeiraFoto || arma.foto_url || ""}
            alt={arma.nome}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3 rounded bg-[#E9B20E] px-3 py-1 text-xs font-black uppercase text-zinc-900 shadow-lg">
            PROMOÇÃO
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col justify-center gap-3 p-6 sm:py-8">
        {arma.marca && <p className="text-sm text-zinc-400">{arma.marca.nome}</p>}
        <h2 className="text-2xl font-bold text-white md:text-3xl">{arma.nome}</h2>
        <div className="flex flex-wrap gap-1 text-sm text-zinc-400">
          {arma.calibre && <span>{arma.calibre.nome}</span>}
          {arma.calibre && arma.espec_capacidade_tiros && <span>•</span>}
          {arma.espec_capacidade_tiros && <span>{arma.espec_capacidade_tiros} tiros</span>}
        </div>
        <div className="mt-2 space-y-1">
          {orig != null && (
            <p className="text-sm text-zinc-500 line-through">De R$ {formatBRL(orig)}</p>
          )}
          <p className="text-3xl font-bold text-[#E9B20E] md:text-4xl">
            R$ {formatBRL(Number(arma.preco_promocional))}
          </p>
          {cond ? <p className="text-sm text-zinc-400">{cond}</p> : null}
        </div>
        <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#E9B20E]">
          Ver produto
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </button>
  );
}

function PromoCarouselModal({
  open,
  onClose,
  items,
  minPrecoByArmaId,
  onVerProduto,
}: {
  open: boolean;
  onClose: () => void;
  items: ArmaDestaque[];
  minPrecoByArmaId: Map<string, number>;
  onVerProduto: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setActive(0);
  }, [open, items.length]);

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  const onScrollSnap = () => {
    const el = scrollRef.current;
    if (!el || !items.length) return;
    const w = el.clientWidth || 1;
    const i = Math.round(el.scrollLeft / w);
    setActive(Math.min(items.length - 1, Math.max(0, i)));
  };

  if (!open || items.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Promoções"
      onClick={onClose}
    >
      <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 z-20 rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-zinc-700 sm:-top-2 sm:right-2"
        >
          Fechar
        </button>
        <p className="mb-3 text-center text-sm text-zinc-300">
          Arraste para o lado <span className="text-zinc-500">(ou use as setas)</span> para ver cada arma
        </p>

        <div className="relative">
          {items.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Promoção anterior"
                onClick={() => scrollByDir(-1)}
                className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white shadow hover:bg-black/70 sm:left-2 sm:p-2.5"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Próxima promoção"
                onClick={() => scrollByDir(1)}
                className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white shadow hover:bg-black/70 sm:right-2 sm:p-2.5"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : null}

          <div
            ref={scrollRef}
            onScroll={onScrollSnap}
            className="flex max-h-[min(85vh,880px)] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-2xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((arma) => (
              <div key={arma.id} className="w-full min-w-full shrink-0 snap-center px-0.5 sm:px-2">
                <PromoBannerBigCard
                  arma={arma}
                  minPrecoVariacao={minPrecoByArmaId.get(arma.id)}
                  onCardClick={() => onVerProduto(arma.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {items.length > 1 ? (
          <div className="mt-4 flex justify-center gap-2">
            {items.map((arma, i) => (
              <button
                key={arma.id}
                type="button"
                aria-label={`Ir para promoção ${i + 1}`}
                onClick={() => {
                  const el = scrollRef.current;
                  if (!el) return;
                  el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
                }}
                className={`h-2 rounded-full transition-all ${i === active ? "w-8 bg-[#E9B20E]" : "w-2 bg-white/40 hover:bg-white/60"}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { authLoading } = useAuth();
  const [armasDestaque, setArmasDestaque] = useState<ArmaDestaque[]>([]);
  const [minPrecoPorArma, setMinPrecoPorArma] = useState<Map<string, number>>(new Map());
  const [armasBannerPromo, setArmasBannerPromo] = useState<ArmaDestaque[]>([]);
  const [minPrecoBannerPromoByArmaId, setMinPrecoBannerPromoByArmaId] = useState<Map<string, number>>(
    new Map()
  );
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [loadingDestaques, setLoadingDestaques] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    const fetchDestaques = async () => {
      const loadPromoBanner = async () => {
        const { data: promoRows } = await supabase
          .from("armas")
          .select("*")
          .eq("em_promocao", true)
          .not("preco_promocional", "is", null)
          .order("nome", { ascending: true })
          .limit(40);

        let rows = (promoRows || []).filter((r: ArmaDestaque) => emPromocaoValida(r));
        rows.sort((a: any, b: any) => {
          const d = Number(Boolean(b.destaque_promocao)) - Number(Boolean(a.destaque_promocao));
          if (d !== 0) return d;
          return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
        });

        if (rows.length === 0) {
          setArmasBannerPromo([]);
          setMinPrecoBannerPromoByArmaId(new Map());
          return;
        }

        const ids = rows.map((r: any) => r.id as string);

        const { data: fotosData } = await supabase
          .from("fotos_armas")
          .select("arma_id, foto_url, ordem")
          .in("arma_id", ids)
          .order("ordem", { ascending: true });
        const fotosMap = new Map<string, string>();
        (fotosData || []).forEach((f: { arma_id: string; foto_url: string }) => {
          if (!fotosMap.has(f.arma_id)) fotosMap.set(f.arma_id, f.foto_url);
        });

        const { data: varsB } = await supabase
          .from("variacoes_armas")
          .select("arma_id, preco")
          .in("arma_id", ids);
        const minVarMap = new Map<string, number>();
        (varsB || []).forEach((row: { arma_id: string; preco: number }) => {
          const p = parseFloat(String(row.preco));
          const cur = minVarMap.get(row.arma_id);
          if (cur == null || p < cur) minVarMap.set(row.arma_id, p);
        });

        const marcaIds = [...new Set(rows.map((r: any) => r.marca_id).filter(Boolean))];
        const calibreIds = [...new Set(rows.map((r: any) => r.calibre_id || r.calibres_id).filter(Boolean))];

        const [marcasResult, calibresResult] = await Promise.all([
          marcaIds.length > 0
            ? supabase.from("marcas").select("id, nome").in("id", marcaIds as string[])
            : { data: [] as { id: string; nome: string }[] },
          calibreIds.length > 0
            ? supabase.from("calibres").select("id, nome").in("id", calibreIds as string[])
            : { data: [] as { id: string; nome: string }[] },
        ]);

        const marcasMap = new Map((marcasResult.data || []).map((m: { id: string; nome: string }) => [m.id, m.nome]));
        const calibresMap = new Map(
          (calibresResult.data || []).map((c: { id: string; nome: string }) => [c.id, c.nome])
        );

        const formatted: ArmaDestaque[] = rows.map((rawB: any) => {
          const calibreIdB = rawB.calibre_id || rawB.calibres_id;
          return {
            ...rawB,
            marca: rawB.marca_id && marcasMap.has(rawB.marca_id) ? { nome: marcasMap.get(rawB.marca_id)! } : null,
            calibre:
              calibreIdB && calibresMap.has(calibreIdB) ? { nome: calibresMap.get(calibreIdB)! } : null,
            primeiraFoto: fotosMap.get(rawB.id) || rawB.foto_url || null,
          };
        });

        setArmasBannerPromo(formatted);
        setMinPrecoBannerPromoByArmaId(minVarMap);
      };

      try {
        setLoadingDestaques(true);
        // Buscar armas em destaque
        const { data: armasData, error: armasError } = await supabase
          .from("armas")
          .select("*")
          .eq("em_destaque", true)
          .limit(8); // Limitar a 8 produtos em destaque

        if (armasError) {
          console.error("Erro ao buscar destaques:", armasError);
          return;
        }

        if (!armasData || armasData.length === 0) {
          setArmasDestaque([]);
          setMinPrecoPorArma(new Map());
          return;
        }

        // Buscar IDs das armas
        const armaIds = armasData.map((a: any) => a.id);

        // Buscar preço mínimo por variação (para "A partir de R$ X")
        const { data: variacoesData } = await supabase
          .from("variacoes_armas")
          .select("arma_id, preco")
          .in("arma_id", armaIds);
        const minMap = new Map<string, number>();
        (variacoesData || []).forEach((v: { arma_id: string; preco: number }) => {
          const preco = parseFloat(String(v.preco));
          const current = minMap.get(v.arma_id);
          if (current == null || preco < current) minMap.set(v.arma_id, preco);
        });
        setMinPrecoPorArma(minMap);

        // Buscar primeira foto de cada arma
        let fotosMap = new Map<string, string>();
        if (armaIds.length > 0) {
          const { data: fotosData } = await supabase
            .from("fotos_armas")
            .select("arma_id, foto_url, ordem")
            .in("arma_id", armaIds)
            .order("ordem", { ascending: true });

          if (fotosData) {
            fotosData.forEach((foto: any) => {
              if (!fotosMap.has(foto.arma_id)) {
                fotosMap.set(foto.arma_id, foto.foto_url);
              }
            });
          }
        }

        // Buscar marcas e calibres
        const marcaIds = [...new Set(armasData.map((a: any) => a.marca_id).filter(Boolean))];
        const calibreIds = [...new Set(armasData.map((a: any) => a.calibre_id || a.calibres_id).filter(Boolean))];

        const [marcasResult, calibresResult] = await Promise.all([
          marcaIds.length > 0
            ? supabase.from("marcas").select("id, nome").in("id", marcaIds)
            : { data: [], error: null },
          calibreIds.length > 0
            ? supabase.from("calibres").select("id, nome").in("id", calibreIds)
            : { data: [], error: null },
        ]);

        const marcasMap = new Map((marcasResult.data || []).map((m: any) => [m.id, m.nome]));
        const calibresMap = new Map((calibresResult.data || []).map((c: any) => [c.id, c.nome]));

        const armasFormatadas = armasData.map((arma: any) => {
          const calibreId = arma.calibre_id || arma.calibres_id;
          return {
            ...arma,
            marca: arma.marca_id && marcasMap.has(arma.marca_id) ? { nome: marcasMap.get(arma.marca_id) } : null,
            calibre: calibreId && calibresMap.has(calibreId) ? { nome: calibresMap.get(calibreId) } : null,
            primeiraFoto: fotosMap.get(arma.id) || arma.foto_url || null,
          };
        });

        setArmasDestaque(armasFormatadas);
      } catch (err: any) {
        console.error("Erro ao buscar destaques:", err);
      } finally {
        try {
          await loadPromoBanner();
        } catch (e) {
          console.error("Erro ao carregar banner de promoção:", e);
        }
        setLoadingDestaques(false);
      }
    };

    fetchDestaques();
  }, [authLoading]);

  if (authLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#030711" }}
      >
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Background Image with Dark Overlay */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/fundo/desktop.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Dark Overlay */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundColor: "rgba(3, 7, 17, 0.85)", // Overlay escuro sobre a imagem
          }}
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 flex-col items-center px-4 py-12 md:py-16">
      <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-8 text-center">
        {/* Premium Badge */}
        <div
          className="flex items-center gap-2 rounded-full border bg-zinc-800/50 px-4 py-2"
          style={{ borderColor: "rgba(233, 178, 14, 0.5)" }}
        >
          <svg
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 20 20"
            style={{ color: "#E9B20E" }}
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-sm font-medium" style={{ color: "#E9B20E" }}>
            Catalogo 2026
          </span>
        </div>

        {/* Main Headline */}
        <div className="flex flex-col gap-2">
          <h1 className="text-5xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
            Excelência em
          </h1>
          <h1
            className="text-5xl font-bold leading-tight md:text-6xl lg:text-7xl"
            style={{ color: "#E9B20E" }}
          >
            Armamento de alta
          </h1>
          <h1 className="text-5xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
          qualidade
          </h1>
        </div>

        {/* Descriptive Paragraph */}
        <p className="max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-xl">
          Descubra nossa coleção de armas de fogo com a mais alta
          qualidade, precisão incomparável e design sofisticado.
        </p>

        {/* Call-to-Action Buttons */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            onClick={() => router.push("/categorias")}
            className="flex items-center justify-center gap-2 rounded-lg px-8 py-4 text-base font-bold text-black transition-colors"
            style={{ backgroundColor: "#E9B20E" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#D4A00D")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#E9B20E")
            }
          >
            Explorar Catálogo
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
        </div>

        {armasBannerPromo.length > 0 && emPromocaoValida(armasBannerPromo[0]) && (
          <section className="mt-10 w-full max-w-4xl px-1">
            {armasBannerPromo.length === 1 ? (
              <PromoBannerBigCard
                arma={armasBannerPromo[0]}
                minPrecoVariacao={minPrecoBannerPromoByArmaId.get(armasBannerPromo[0].id)}
                onCardClick={() => router.push(`/produto/${armasBannerPromo[0].id}`)}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setPromoModalOpen(true)}
                  className="group flex w-full items-center gap-4 overflow-hidden rounded-2xl border-2 border-[#E9B20E]/85 bg-zinc-900/90 p-4 text-left shadow-xl transition-all hover:border-[#f5d978] sm:gap-5 sm:p-5"
                >
                  {(armasBannerPromo[0].primeiraFoto || armasBannerPromo[0].foto_url) && (
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg sm:size-24">
                      <img
                        src={armasBannerPromo[0].primeiraFoto || armasBannerPromo[0].foto_url || ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute left-1 top-1 rounded bg-[#E9B20E] px-1.5 py-0.5 text-[9px] font-black uppercase text-zinc-900">
                        Promo
                      </div>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-white sm:text-xl">
                      {armasBannerPromo.length} armas em promoção
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Toque para abrir. No painel, arraste para o lado para ver cada arma.
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-[#E9B20E] group-hover:underline">
                    Abrir
                  </span>
                </button>
                <PromoCarouselModal
                  open={promoModalOpen}
                  onClose={() => setPromoModalOpen(false)}
                  items={armasBannerPromo}
                  minPrecoByArmaId={minPrecoBannerPromoByArmaId}
                  onVerProduto={(id) => {
                    setPromoModalOpen(false);
                    router.push(`/produto/${id}`);
                  }}
                />
              </>
            )}
          </section>
        )}
        </div>

        {/* Modelos em Destaque Section */}
        {armasDestaque.length > 0 && (
          <section className="w-full px-4 py-16">
          <div className="container mx-auto flex flex-col items-center gap-6 text-center mb-12">
            {/* Destaques Badge */}
            <div
              className="flex items-center justify-center rounded-full border px-4 py-2"
              style={{
                borderColor: "rgba(233, 178, 14, 0.5)",
                backgroundColor: "rgba(15, 23, 42, 0.5)",
              }}
            >
              <span className="text-sm font-medium" style={{ color: "#E9B20E" }}>Destaques</span>
            </div>

            {/* Main Title */}
            <h2 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
              Modelos em Destaque
            </h2>

            {/* Subtitle */}
            <p className="max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
              Conheça os modelos mais procurados da nossa coleção premium
            </p>
          </div>

          {/* Grid de Produtos em Destaque */}
          <div className="container mx-auto">
            {loadingDestaques ? (
              <div className="text-center text-white py-12">Carregando destaques...</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {armasDestaque.map((arma) => (
                  <div
                    key={arma.id}
                    className="group cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900/40 p-4 text-white transition-all hover:border-zinc-600"
                    onClick={() => router.push(`/produto/${arma.id}`)}
                  >
                    {(arma.primeiraFoto || arma.foto_url) && (
                      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded">
                        <img
                          src={arma.primeiraFoto || arma.foto_url || ""}
                          alt={arma.nome}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        {emPromocaoValida(arma) ? (
                          <div className="absolute left-2 top-2 rounded bg-[#E9B20E] px-2 py-0.5 text-[10px] font-black uppercase text-zinc-900 shadow">
                            Promoção
                          </div>
                        ) : null}
                      </div>
                    )}

                    {arma.marca && (
                      <p className="mb-1 text-sm text-zinc-400">{arma.marca.nome}</p>
                    )}

                    <h2 className="mb-2 text-lg font-semibold text-white">{arma.nome}</h2>

                    {/* Especificações */}
                    <div className="mb-3 flex flex-wrap gap-1 text-sm text-zinc-400">
                      {arma.calibre && <span>{arma.calibre.nome}</span>}
                      {arma.calibre && arma.espec_capacidade_tiros && <span>•</span>}
                      {arma.espec_capacidade_tiros && (
                        <span>{arma.espec_capacidade_tiros} tiros</span>
                      )}
                    </div>

                    {/* Preço com seta (mínimo das variações ou preço do produto) */}
                    <div className="flex items-center justify-between">
                      {(() => {
                        const minVariacao = minPrecoPorArma.get(arma.id);
                        const original = precoOriginalLista(minVariacao, arma.preco);
                        const promoOk = emPromocaoValida(arma);
                        if (!promoOk && original == null) return null;
                        if (promoOk && original != null) {
                          return (
                            <div className="text-left">
                              <p className="text-xs text-zinc-500 line-through">
                                {minVariacao != null ? "A partir de " : ""}R$ {formatBRL(original)}
                              </p>
                              <p className="font-bold text-[#E9B20E]">
                                R$ {formatBRL(Number(arma.preco_promocional))}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {textoCondicaoPromocao(arma.promocao_modo, arma.promocao_parcelas_max)}
                              </p>
                            </div>
                          );
                        }
                        if (promoOk) {
                          return (
                            <div>
                              <p className="font-bold text-[#E9B20E]">
                                R$ {formatBRL(Number(arma.preco_promocional))}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {textoCondicaoPromocao(arma.promocao_modo, arma.promocao_parcelas_max)}
                              </p>
                            </div>
                          );
                        }
                        const formatado = formatBRL(original!);
                        return (
                          <p className="font-bold text-[#E9B20E]">
                            {minVariacao != null ? "A partir de " : ""}R$ {formatado}
                          </p>
                        );
                      })()}
                      <svg
                        className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        )}
        
        {/* Footer - Logo abaixo dos Modelos em Destaque */}
        <Footer />
      </div>
    </div>
  );
}

