"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "../../components/Header";
import ProductListCard from "../../components/ProductListCard";
import { supabase } from "../../lib/supabaseClient";
import {
  armaPassaFiltroCalibre,
  calibreExibicaoLista,
  fetchVariacoesMetaPorArmaIds,
} from "../../lib/fetchVariacoesMinPreco";
import { emPromocaoValida, formatBRL, precoOriginalLista } from "../../lib/promoPreco";

type Arma = {
  id: string;
  nome: string | null;
  preco: number | null;
  foto_url: string | null;
  categoria_id: number | null;
  marca_id: string | null;
  calibres_id: string | null;
  espec_capacidade_tiros: string | null;
  em_promocao?: boolean | null;
  preco_promocional?: number | null;
  promocao_modo?: string | null;
  promocao_parcelas_max?: number | null;
  em_destaque?: boolean | null;
  primeiraFoto?: string | null;
};

type Categoria = { id: number; nome: string };

type Marca = { id: string; nome: string };
type Calibre = { id: string; nome: string };

function formatCategoriaLabel(nome: string): string {
  const spaced = nome
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return nome;
  return spaced
    .split(" ")
    .map((word) => {
      if (!word) return word;
      const lower = word.toLocaleLowerCase("pt-BR");
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

function precoParaFiltro(arma: Arma, minVariacao: number | undefined): number | null {
  if (emPromocaoValida(arma)) {
    const p = Number(arma.preco_promocional);
    return Number.isFinite(p) ? p : null;
  }
  return precoOriginalLista(minVariacao, arma.preco);
}

/** Compatível com filtros antigos salvos como texto no sessionStorage. */
function parsePrecoFiltro(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function limitesPrecoCatalogo(
  armas: Arma[],
  minPrecoPorArma: Map<string, number>
): { floor: number; ceil: number } {
  const vals: number[] = [];
  for (const a of armas) {
    const v = precoParaFiltro(a, minPrecoPorArma.get(a.id));
    if (v != null && Number.isFinite(v)) vals.push(v);
  }
  if (vals.length === 0) return { floor: 0, ceil: 1 };
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  if (mn === mx) return { floor: Math.max(0, mn - 1), ceil: mx + 1 };
  return { floor: mn, ceil: mx };
}

function passoSlider(floor: number, ceil: number): number {
  const span = ceil - floor;
  if (span <= 0) return 1;
  return Math.max(1, Math.round(span / 120));
}

type RangePrecoDuploProps = {
  floor: number;
  ceil: number;
  minVal: number;
  maxVal: number;
  onChangeMin: (n: number) => void;
  onChangeMax: (n: number) => void;
};

function RangePrecoDuplo({
  floor,
  ceil,
  minVal,
  maxVal,
  onChangeMin,
  onChangeMax,
}: RangePrecoDuploProps) {
  const step = useMemo(() => passoSlider(floor, ceil), [floor, ceil]);
  const span = ceil - floor;
  const pctMin = span > 0 ? ((minVal - floor) / span) * 100 : 0;
  const pctMax = span > 0 ? ((maxVal - floor) / span) * 100 : 100;

  const trackClass =
    "pointer-events-none absolute h-1.5 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#9333ea] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-black/40 [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#9333ea]";

  return (
    <div className="relative w-full pt-1 pb-1">
      <div className="relative mx-1 h-10">
        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-zinc-700/90"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#E9B20E]"
          style={{
            left: `${pctMin}%`,
            width: `${Math.max(0, pctMax - pctMin)}%`,
          }}
          aria-hidden
        />
        <input
          type="range"
          min={floor}
          max={ceil}
          step={step}
          value={minVal}
          aria-label="Valor mínimo"
          onChange={(e) => {
            const v = Number(e.target.value);
            onChangeMin(Math.min(v, maxVal));
          }}
          className={`${trackClass} absolute inset-x-0 top-1/2 z-20 w-full -translate-y-1/2`}
        />
        <input
          type="range"
          min={floor}
          max={ceil}
          step={step}
          value={maxVal}
          aria-label="Valor máximo"
          onChange={(e) => {
            const v = Number(e.target.value);
            onChangeMax(Math.max(v, minVal));
          }}
          className={`${trackClass} absolute inset-x-0 top-1/2 z-30 w-full -translate-y-1/2`}
        />
      </div>
      <div className="mt-2 flex justify-between gap-4 text-sm tabular-nums text-zinc-300">
        <span>
          Mín. <span className="font-semibold text-[#E9B20E]">R$ {formatBRL(minVal)}</span>
        </span>
        <span className="text-right">
          Máx. <span className="font-semibold text-[#E9B20E]">R$ {formatBRL(maxVal)}</span>
        </span>
      </div>
    </div>
  );
}

const FILTROS_PRODUTOS_SESSION_KEY = "catalogo:produtos-listagem-filtros";

function ProdutosPageContent() {
  const searchParams = useSearchParams();
  const restoredPrecoRef = useRef<{ min: number | null; max: number | null }>({
    min: null,
    max: null,
  });
  const precoInitRef = useRef(false);

  const [armas, setArmas] = useState<Arma[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [calibres, setCalibres] = useState<Calibre[]>([]);
  const [minPrecoPorArma, setMinPrecoPorArma] = useState<Map<string, number>>(new Map());
  const [calibresPorVariacao, setCalibresPorVariacao] = useState<Map<string, Set<string>>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | null>(null);
  const [marcaFiltro, setMarcaFiltro] = useState<string | null>(null);
  const [calibreFiltro, setCalibreFiltro] = useState<string | null>(null);
  const [nomeFiltro, setNomeFiltro] = useState("");
  const [precoFiltroMin, setPrecoFiltroMin] = useState(0);
  const [precoFiltroMax, setPrecoFiltroMax] = useState(0);
  const [precoSliderReady, setPrecoSliderReady] = useState(false);
  const [filtrosRestaurados, setFiltrosRestaurados] = useState(false);

  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(FILTROS_PRODUTOS_SESSION_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const o = parsed as Record<string, unknown>;
      if (o.categoriaFiltro === null) {
        setCategoriaFiltro(null);
      } else if (
        typeof o.categoriaFiltro === "number" &&
        Number.isFinite(o.categoriaFiltro)
      ) {
        setCategoriaFiltro(Math.trunc(o.categoriaFiltro));
      }
      restoredPrecoRef.current = { min: null, max: null };
      if (typeof o.precoFiltroMin === "number" && Number.isFinite(o.precoFiltroMin)) {
        restoredPrecoRef.current.min = o.precoFiltroMin;
      } else if (typeof o.precoMinStr === "string") {
        const p = parsePrecoFiltro(o.precoMinStr);
        if (p != null) restoredPrecoRef.current.min = p;
      }
      if (typeof o.precoFiltroMax === "number" && Number.isFinite(o.precoFiltroMax)) {
        restoredPrecoRef.current.max = o.precoFiltroMax;
      } else if (typeof o.precoMaxStr === "string") {
        const p = parsePrecoFiltro(o.precoMaxStr);
        if (p != null) restoredPrecoRef.current.max = p;
      }
      if (o.marcaFiltro === null || o.marcaFiltro === "") {
        setMarcaFiltro(null);
      } else if (typeof o.marcaFiltro === "string") {
        setMarcaFiltro(o.marcaFiltro);
      }
      if (o.calibreFiltro === null || o.calibreFiltro === "") {
        setCalibreFiltro(null);
      } else if (typeof o.calibreFiltro === "string") {
        setCalibreFiltro(o.calibreFiltro);
      }
      if (typeof o.nomeFiltro === "string") {
        setNomeFiltro(o.nomeFiltro);
      }
    } catch {
      /* JSON inválido ou storage indisponível */
    } finally {
      setFiltrosRestaurados(true);
    }
  }, []);

  useLayoutEffect(() => {
    const raw = searchParams.get("categoria");
    if (raw == null || raw === "") return;
    const id = Number.parseInt(raw, 10);
    if (!Number.isFinite(id) || id < 1) return;
    setCategoriaFiltro(id);
  }, [searchParams]);

  useEffect(() => {
    if (!filtrosRestaurados || !precoSliderReady) return;
    try {
      sessionStorage.setItem(
        FILTROS_PRODUTOS_SESSION_KEY,
        JSON.stringify({
          categoriaFiltro,
          marcaFiltro,
          calibreFiltro,
          nomeFiltro,
          precoFiltroMin,
          precoFiltroMax,
        })
      );
    } catch {
      /* quota, modo privado */
    }
  }, [categoriaFiltro, marcaFiltro, calibreFiltro, nomeFiltro, precoFiltroMin, precoFiltroMax, filtrosRestaurados, precoSliderReady]);

  useEffect(() => {
    const fetchArmas = async () => {
      try {
        setLoading(true);

        const [armasResult, categoriasResult, marcasResult, calibresResult] = await Promise.all([
          supabase
            .from("armas")
            .select(
              "id, nome, preco, foto_url, categoria_id, marca_id, calibres_id, espec_capacidade_tiros, em_promocao, preco_promocional, promocao_modo, promocao_parcelas_max, em_destaque"
            )
            .order("nome"),
          supabase.from("categorias").select("id, nome").order("nome"),
          supabase.from("marcas").select("id, nome").order("nome"),
          supabase.from("calibres").select("id, nome").order("nome"),
        ]);

        if (marcasResult.data) {
          setMarcas(marcasResult.data as Marca[]);
        } else {
          setMarcas([]);
        }
        if (calibresResult.data) {
          setCalibres(calibresResult.data as Calibre[]);
        } else {
          setCalibres([]);
        }

        if (categoriasResult.data) {
          setCategorias(categoriasResult.data as Categoria[]);
        } else {
          setCategorias([]);
        }

        if (armasResult.error) {
          setError(`Erro ao carregar produtos: ${armasResult.error.message}`);
          setArmas([]);
          setMinPrecoPorArma(new Map());
          setCalibresPorVariacao(new Map());
        } else {
          const armasList = (armasResult.data || []) as Arma[];
          const { minPreco, calibresPorArma } = await fetchVariacoesMetaPorArmaIds(
            armasList.map((a) => a.id)
          );
          setMinPrecoPorArma(minPreco);
          setCalibresPorVariacao(calibresPorArma);

          const ids = armasList.map((a) => a.id);
          const fotosMap = new Map<string, string>();
          if (ids.length > 0) {
            const { data: fotosData } = await supabase
              .from("fotos_armas")
              .select("arma_id, foto_url, ordem")
              .in("arma_id", ids)
              .order("ordem", { ascending: true });
            (fotosData || []).forEach((f: { arma_id: string; foto_url: string }) => {
              if (!fotosMap.has(f.arma_id)) fotosMap.set(f.arma_id, f.foto_url);
            });
          }
          setArmas(
            armasList.map((a) => ({
              ...a,
              primeiraFoto: fotosMap.get(a.id) || a.foto_url || null,
            }))
          );
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao carregar produtos");
      } finally {
        setLoading(false);
      }
    };

    fetchArmas();
  }, []);

  const limitesPreco = useMemo(
    () => limitesPrecoCatalogo(armas, minPrecoPorArma),
    [armas, minPrecoPorArma]
  );

  useLayoutEffect(() => {
    if (loading) return;
    const L = limitesPreco;
    if (!(L.ceil > L.floor)) {
      if (!precoInitRef.current) {
        setPrecoFiltroMin(L.floor);
        setPrecoFiltroMax(L.ceil);
        precoInitRef.current = true;
        setPrecoSliderReady(true);
      }
      return;
    }
    if (precoInitRef.current) return;
    const r = restoredPrecoRef.current;
    let a = r.min ?? L.floor;
    let b = r.max ?? L.ceil;
    if (!Number.isFinite(a)) a = L.floor;
    if (!Number.isFinite(b)) b = L.ceil;
    a = Math.min(Math.max(a, L.floor), L.ceil);
    b = Math.min(Math.max(b, L.floor), L.ceil);
    if (a > b) [a, b] = [b, a];
    setPrecoFiltroMin(a);
    setPrecoFiltroMax(b);
    precoInitRef.current = true;
    setPrecoSliderReady(true);
  }, [loading, limitesPreco]);

  const precoAplicaFiltro = useMemo(() => {
    if (!precoSliderReady) return false;
    return !(
      precoFiltroMin <= limitesPreco.floor && precoFiltroMax >= limitesPreco.ceil
    );
  }, [precoSliderReady, limitesPreco, precoFiltroMin, precoFiltroMax]);

  const marcasPorId = useMemo(() => new Map(marcas.map((m) => [m.id, m.nome])), [marcas]);
  const calibresPorId = useMemo(() => new Map(calibres.map((c) => [c.id, c.nome])), [calibres]);

  const armasFiltradas = useMemo(() => {
    let list = armas;
    if (categoriaFiltro != null) {
      list = list.filter((a) => a.categoria_id === categoriaFiltro);
    }
    if (marcaFiltro) {
      list = list.filter((a) => a.marca_id === marcaFiltro);
    }
    if (calibreFiltro) {
      list = list.filter((a) =>
        armaPassaFiltroCalibre(a.calibres_id, a.id, calibreFiltro, calibresPorVariacao)
      );
    }
    const termoNome = nomeFiltro.trim().toLowerCase();
    if (termoNome) {
      list = list.filter((a) => (a.nome ?? "").toLowerCase().includes(termoNome));
    }
    return list.filter((a) => {
      const minV = minPrecoPorArma.get(a.id);
      const valor = precoParaFiltro(a, minV);
      if (precoAplicaFiltro) {
        if (valor != null && valor < precoFiltroMin) return false;
        if (valor != null && valor > precoFiltroMax) return false;
      }
      return true;
    });
  }, [
    armas,
    categoriaFiltro,
    marcaFiltro,
    calibreFiltro,
    calibresPorVariacao,
    nomeFiltro,
    precoAplicaFiltro,
    precoFiltroMin,
    precoFiltroMax,
    minPrecoPorArma,
  ]);

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
      <div
        className="flex min-h-screen flex-col"
        style={{ backgroundColor: "#030711" }}
      >
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
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#030711" }}
    >
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <div className="container mx-auto max-w-7xl">
          <header className="mb-10 border-b border-zinc-800/80 pb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#E9B20E]/90">
              Catálogo
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              Todas as armas
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Explore o catálogo completo. Clique em um item para ver detalhes, especificações e opções de compra.
            </p>
          </header>

          {armas.length > 0 ? (
            <>
              <section className="mb-6 space-y-6 border-b border-zinc-800/80 pb-8">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Categorias
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoriaFiltro(null)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        categoriaFiltro === null
                          ? "border-[#E9B20E] bg-[#E9B20E]/15 text-[#E9B20E]"
                          : "border-zinc-600 bg-zinc-900/40 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      Todas
                    </button>
                    {categorias.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategoriaFiltro(cat.id)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                          categoriaFiltro === cat.id
                            ? "border-[#E9B20E] bg-[#E9B20E]/15 text-[#E9B20E]"
                            : "border-zinc-600 bg-zinc-900/40 text-zinc-300 hover:border-zinc-500"
                        }`}
                      >
                        {formatCategoriaLabel(cat.nome)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Modelo, marca, calibre e valor
                  </p>
                  <div className="mb-6 flex flex-col gap-1.5 sm:max-w-md">
                    <label htmlFor="filtro-nome" className="text-sm font-medium text-white">
                      Modelo
                    </label>
                    <input
                      id="filtro-nome"
                      type="search"
                      value={nomeFiltro}
                      onChange={(e) => setNomeFiltro(e.target.value)}
                      placeholder="Digite o nome do modelo..."
                      autoComplete="off"
                      className="w-full rounded-lg border border-zinc-500 bg-zinc-950/80 px-3 py-2.5 text-sm text-white shadow-inner placeholder:text-zinc-500 focus:border-[#E9B20E]/70 focus:outline-none focus:ring-1 focus:ring-[#E9B20E]/35"
                    />
                  </div>
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10 xl:gap-12">
                    <div className="flex w-full shrink-0 flex-col gap-4 sm:max-w-[320px] lg:w-72 lg:max-w-none">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="filtro-marca" className="text-sm font-medium text-white">
                          Marca
                        </label>
                        <select
                          id="filtro-marca"
                          value={marcaFiltro ?? ""}
                          onChange={(e) =>
                            setMarcaFiltro(e.target.value === "" ? null : e.target.value)
                          }
                          className="w-full cursor-pointer rounded-lg border border-zinc-500 bg-zinc-950/80 px-3 py-2.5 text-sm text-white shadow-inner focus:border-[#E9B20E]/70 focus:outline-none focus:ring-1 focus:ring-[#E9B20E]/35"
                        >
                          <option value="">Todas</option>
                          {marcas.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="filtro-calibre" className="text-sm font-medium text-white">
                          Calibre
                        </label>
                        <select
                          id="filtro-calibre"
                          value={calibreFiltro ?? ""}
                          onChange={(e) =>
                            setCalibreFiltro(e.target.value === "" ? null : e.target.value)
                          }
                          className="w-full cursor-pointer rounded-lg border border-zinc-500 bg-zinc-950/80 px-3 py-2.5 text-sm text-white shadow-inner focus:border-[#E9B20E]/70 focus:outline-none focus:ring-1 focus:ring-[#E9B20E]/35"
                        >
                          <option value="">Todos</option>
                          {calibres.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">Valor (R$)</p>
                        <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
                          Arraste as bolinhas. Nos extremos do catálogo, entram todos os preços.
                        </p>
                      </div>
                      <div className="flex flex-1 items-center lg:min-h-0">
                        {precoSliderReady && limitesPreco.ceil > limitesPreco.floor ? (
                          <div className="w-full rounded-xl border border-zinc-600/80 bg-zinc-950/40 px-4 py-5 sm:px-6">
                            <RangePrecoDuplo
                              floor={limitesPreco.floor}
                              ceil={limitesPreco.ceil}
                              minVal={precoFiltroMin}
                              maxVal={precoFiltroMax}
                              onChangeMin={setPrecoFiltroMin}
                              onChangeMax={setPrecoFiltroMax}
                            />
                          </div>
                        ) : precoSliderReady ? (
                          <p className="text-sm text-zinc-500">
                            Não há preços numéricos suficientes para montar o intervalo.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <p className="mb-8 text-sm font-medium text-zinc-500">
                {armasFiltradas.length === armas.length
                  ? `${armas.length} ${armas.length === 1 ? "produto" : "produtos"}`
                  : `${armasFiltradas.length} de ${armas.length} produtos`}
              </p>
            </>
          ) : null}

          {armas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 px-6 py-16 text-center">
              <p className="text-zinc-400">Nenhum produto encontrado.</p>
            </div>
          ) : armasFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 px-6 py-16 text-center">
              <p className="text-zinc-400">Nenhum produto corresponde aos filtros selecionados.</p>
            </div>
          ) : (
            <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {armasFiltradas.map((arma) => {
                const calibreNome = calibreExibicaoLista(
                  arma.calibres_id,
                  arma.id,
                  calibresPorId,
                  calibresPorVariacao
                );
                const metaParts = [
                  calibreNome,
                  arma.espec_capacidade_tiros ? `${arma.espec_capacidade_tiros} tiros` : null,
                ].filter(Boolean) as string[];
                const metaLinha = metaParts.length > 0 ? metaParts.join(" · ") : null;
                return (
                  <ProductListCard
                    key={arma.id}
                    product={arma}
                    minVariacaoPreco={minPrecoPorArma.get(arma.id)}
                    metaLinha={metaLinha}
                    marcaNome={arma.marca_id ? marcasPorId.get(arma.marca_id) ?? null : null}
                    showMarcaAboveTitle
                    showDestaqueBadge
                  />
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ProdutosPageFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: "#030711" }}
    >
      <div className="text-white">Carregando...</div>
    </div>
  );
}

export default function ProdutosPage() {
  return (
    <Suspense fallback={<ProdutosPageFallback />}>
      <ProdutosPageContent />
    </Suspense>
  );
}
