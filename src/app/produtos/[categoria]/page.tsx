"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Header from "../../../components/Header";
import ProductListCard from "../../../components/ProductListCard";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../contexts/AuthContext";

type Arma = {
  id: string;
  nome: string | null;
  preco: number | null;
  foto_url: string | null;
  categoria_id: number | null;
  espec_capacidade_tiros: string | null;
  marca_id: string | null;
  calibre_id: string | null;
  calibres_id: string | null;
  em_promocao?: boolean | null;
  preco_promocional?: number | null;
  promocao_modo?: string | null;
  promocao_parcelas_max?: number | null;
  em_destaque?: boolean | null;
  marca: { nome: string } | null;
  calibre: { nome: string } | null;
  primeiraFoto?: string | null; // Primeira foto da tabela fotos_armas
};

type Marca = {
  id: string;
  nome: string;
};

type Calibre = {
  id: string;
  nome: string;
};

/** Linha bruta de `armas` antes de enriquecer com marca/calibre/foto */
type ArmaRowDb = {
  id: string;
  nome: string | null;
  preco: number | null;
  foto_url: string | null;
  categoria_id: number | null;
  espec_capacidade_tiros: string | null;
  marca_id: string | null;
  calibre_id: string | null;
  calibres_id: string | null;
  em_promocao?: boolean | null;
  preco_promocional?: number | null;
  promocao_modo?: string | null;
  promocao_parcelas_max?: number | null;
  em_destaque?: boolean | null;
};

type FotoRowDb = { arma_id: string; foto_url: string; ordem: number };
type MarcaRowDb = { id: string; nome: string };
type CalibreRowDb = { id: string; nome: string };

export default function ProdutosPorCategoriaPage() {
  const params = useParams();
  const categoria = params.categoria as string;
  const categoriaId = parseInt(categoria);

  const [loading, setLoading] = useState(true);
  const { authLoading } = useAuth();
  const [armas, setArmas] = useState<Arma[]>([]);
  const [armasFiltradas, setArmasFiltradas] = useState<Arma[]>([]);
  const [minPrecoPorArma, setMinPrecoPorArma] = useState<Map<string, number>>(new Map());
  const [nomeCategoria, setNomeCategoria] = useState<string>(`Categoria ${categoriaId}`);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtros
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [calibres, setCalibres] = useState<Calibre[]>([]);
  const [marcaSelecionada, setMarcaSelecionada] = useState<string | null>(null);
  const [calibreSelecionado, setCalibreSelecionado] = useState<string | null>(null);
  const [dropdownMarcaAberto, setDropdownMarcaAberto] = useState(false);
  const [dropdownCalibreAberto, setDropdownCalibreAberto] = useState(false);
  
  // Refs para fechar dropdowns ao clicar fora
  const marcaDropdownRef = useRef<HTMLDivElement>(null);
  const calibreDropdownRef = useRef<HTMLDivElement>(null);

  // Buscar marcas e calibres disponíveis
  useEffect(() => {
    if (authLoading) return;

    const fetchMarcas = async () => {
      const { data } = await supabase
        .from("marcas")
        .select("id, nome")
        .order("nome");
      if (data) setMarcas(data);
    };

    const fetchCalibres = async () => {
      const { data } = await supabase
        .from("calibres")
        .select("id, nome")
        .order("nome");
      if (data) setCalibres(data);
    };

    fetchMarcas();
    fetchCalibres();
  }, [authLoading]);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (marcaDropdownRef.current && !marcaDropdownRef.current.contains(event.target as Node)) {
        setDropdownMarcaAberto(false);
      }
      if (calibreDropdownRef.current && !calibreDropdownRef.current.contains(event.target as Node)) {
        setDropdownCalibreAberto(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Aplicar filtros quando mudarem
  useEffect(() => {
    let filtradas = [...armas];

    if (marcaSelecionada) {
      filtradas = filtradas.filter((arma) => arma.marca_id === marcaSelecionada);
    }

    if (calibreSelecionado) {
      filtradas = filtradas.filter((arma) => {
        const calibreId = arma.calibre_id || arma.calibres_id;
        return calibreId === calibreSelecionado;
      });
    }

    setArmasFiltradas(filtradas);
  }, [armas, marcaSelecionada, calibreSelecionado]);

  useEffect(() => {
    if (authLoading) return;

    // Validação: verificar se o ID é um número válido
    if (isNaN(categoriaId)) {
      setError("Categoria inválida.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Buscar o nome da categoria primeiro
        const { data: categoriaData } = await supabase
          .from("categorias")
          .select("nome")
          .eq("id", categoriaId)
          .single();

        if (categoriaData) {
          setNomeCategoria(categoriaData.nome);
        }

        // Buscar produtos filtrados por categoria_id
        const { data: armasData, error: armasError } = await supabase
          .from("armas")
          .select("*")
          .eq("categoria_id", categoriaId);

        if (armasError) {
          console.error("Erro ao buscar produtos:", armasError);
          setError(`Erro ao carregar produtos: ${armasError.message}`);
        } else {
          // Buscar IDs das armas
          const armaIds = (armasData || []).map((a: ArmaRowDb) => a.id);
          
          // Buscar primeira foto de cada arma (ordem 0 ou menor ordem disponível)
          const fotosMap = new Map<string, string>();
          if (armaIds.length > 0) {
            const { data: fotosData } = await supabase
              .from("fotos_armas")
              .select("arma_id, foto_url, ordem")
              .in("arma_id", armaIds)
              .order("ordem", { ascending: true });

            if (fotosData) {
              (fotosData as FotoRowDb[]).forEach((foto) => {
                // Pegar apenas a primeira foto (menor ordem) de cada arma
                if (!fotosMap.has(foto.arma_id)) {
                  fotosMap.set(foto.arma_id, foto.foto_url);
                }
              });
            }
          }

          // Buscar marcas e calibres em batch para melhor performance
          const marcaIds = [...new Set((armasData || []).map((a: ArmaRowDb) => a.marca_id).filter(Boolean))] as string[];
          const calibreIds = [
            ...new Set(
              (armasData || [])
                .map((a: ArmaRowDb) => a.calibre_id || a.calibres_id)
                .filter((id): id is string => Boolean(id))
            ),
          ];

          const [marcasResult, calibresResult] = await Promise.all([
            marcaIds.length > 0
              ? supabase.from("marcas").select("id, nome").in("id", marcaIds)
              : { data: [] as MarcaRowDb[], error: null },
            calibreIds.length > 0
              ? supabase.from("calibres").select("id, nome").in("id", calibreIds)
              : { data: [] as CalibreRowDb[], error: null },
          ]);

          const marcasMap = new Map((marcasResult.data || []).map((m: MarcaRowDb) => [m.id, m.nome]));
          const calibresMap = new Map((calibresResult.data || []).map((c: CalibreRowDb) => [c.id, c.nome]));

          const armasFormatadas: Arma[] = (armasData || []).map((arma: ArmaRowDb) => {
            const calibreId = arma.calibre_id || arma.calibres_id;
            const marcaNome = arma.marca_id ? marcasMap.get(arma.marca_id) : undefined;
            const calibreNome = calibreId ? calibresMap.get(calibreId) : undefined;
            return {
              ...arma,
              marca: marcaNome != null ? { nome: marcaNome } : null,
              calibre: calibreNome != null ? { nome: calibreNome } : null,
              primeiraFoto: fotosMap.get(arma.id) || arma.foto_url || null, // Usar primeira foto da tabela fotos_armas, ou fallback para foto_url
            };
          });

          const idsFmt = armasFormatadas.map((a) => a.id);
          const minMap = new Map<string, number>();
          if (idsFmt.length > 0) {
            const { data: varsCat } = await supabase
              .from("variacoes_armas")
              .select("arma_id, preco")
              .in("arma_id", idsFmt);
            (varsCat || []).forEach((v: { arma_id: string; preco: number }) => {
              const p = parseFloat(String(v.preco));
              const cur = minMap.get(v.arma_id);
              if (cur == null || p < cur) minMap.set(v.arma_id, p);
            });
          }
          setMinPrecoPorArma(minMap);

          setArmas(armasFormatadas);
          setArmasFiltradas(armasFormatadas);
        }
      } catch (err: unknown) {
        console.error("Erro:", err);
        setError(err instanceof Error ? err.message : "Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, categoriaId]);

  const handleMarcaSelecionada = (marcaId: string | null) => {
    setMarcaSelecionada(marcaId);
    setDropdownMarcaAberto(false);
  };

  const handleCalibreSelecionado = (calibreId: string | null) => {
    setCalibreSelecionado(calibreId);
    setDropdownCalibreAberto(false);
  };

  const limparFiltros = () => {
    setMarcaSelecionada(null);
    setCalibreSelecionado(null);
  };

  if (authLoading || loading) {
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
        <main className="flex-1 px-4 py-8" style={{ backgroundColor: "#030711" }}>
          <div className="mx-auto max-w-4xl">
            <p className="text-red-400">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  const marcaSelecionadaNome = marcaSelecionada 
    ? marcas.find(m => m.id === marcaSelecionada)?.nome || "Marca"
    : "Marca";
  
  const calibreSelecionadoNome = calibreSelecionado
    ? calibres.find(c => c.id === calibreSelecionado)?.nome || "Calibre"
    : "Calibre";

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#030711" }}
    >
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:py-12" style={{ backgroundColor: "#030711" }}>
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 border-b border-zinc-800/80 pb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#E9B20E]/90">
              Categoria
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">{nomeCategoria}</h1>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400">
              Filtre por marca ou calibre para refinar a lista.
            </p>
          </header>

          {/* Filtros */}
          <div className="mb-10 rounded-2xl border border-zinc-700/60 bg-zinc-900/40 p-4 shadow-inner sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-200">Filtros</p>
              {(marcaSelecionada || calibreSelecionado) && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="text-sm font-medium text-[#E9B20E] underline-offset-2 hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {/* Dropdown Marca */}
              <div className="relative" ref={marcaDropdownRef}>
                <button
                  className="flex items-center gap-2 rounded-lg px-4 py-2 transition-colors"
                  style={{ backgroundColor: "#E9B20E" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D4A00D")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E9B20E")}
                  onClick={() => {
                    setDropdownMarcaAberto(!dropdownMarcaAberto);
                    setDropdownCalibreAberto(false);
                  }}
                >
                  <span className="text-sm font-bold text-zinc-900">{marcaSelecionadaNome}</span>
                  <svg
                    className={`h-4 w-4 text-zinc-900 transition-transform ${dropdownMarcaAberto ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {dropdownMarcaAberto && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-48 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg max-h-60 overflow-y-auto">
                    <button
                      onClick={() => handleMarcaSelecionada(null)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                        marcaSelecionada === null
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      Todas as marcas
                    </button>
                    {marcas.map((marca) => (
                      <button
                        key={marca.id}
                        onClick={() => handleMarcaSelecionada(marca.id)}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                          marcaSelecionada === marca.id
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                        }`}
                      >
                        {marca.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dropdown Calibre */}
              <div className="relative" ref={calibreDropdownRef}>
                <button
                  className="flex items-center gap-2 rounded-lg px-4 py-2 transition-colors"
                  style={{ backgroundColor: "#E9B20E" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D4A00D")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E9B20E")}
                  onClick={() => {
                    setDropdownCalibreAberto(!dropdownCalibreAberto);
                    setDropdownMarcaAberto(false);
                  }}
                >
                  <span className="text-sm font-bold text-zinc-900">{calibreSelecionadoNome}</span>
                  <svg
                    className={`h-4 w-4 text-zinc-900 transition-transform ${dropdownCalibreAberto ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {dropdownCalibreAberto && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-48 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg max-h-60 overflow-y-auto">
                    <button
                      onClick={() => handleCalibreSelecionado(null)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                        calibreSelecionado === null
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      Todos os calibres
                    </button>
                    {calibres.map((calibre) => (
                      <button
                        key={calibre.id}
                        onClick={() => handleCalibreSelecionado(calibre.id)}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                          calibreSelecionado === calibre.id
                            ? "bg-zinc-800 text-white"
                          : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                        }`}
                      >
                        {calibre.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!armasFiltradas || armasFiltradas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 px-6 py-16 text-center">
              <p className="text-zinc-400">Nenhum produto encontrado para essa categoria ou filtros.</p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-zinc-500">
                {armasFiltradas.length}{" "}
                {armasFiltradas.length === 1 ? "produto listado" : "produtos listados"}
              </p>
              <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {armasFiltradas.map((arma) => {
                  const metaParts = [
                    arma.calibre?.nome,
                    arma.espec_capacidade_tiros
                      ? `${arma.espec_capacidade_tiros} tiros`
                      : null,
                  ].filter(Boolean) as string[];
                  const metaLinha = metaParts.length > 0 ? metaParts.join(" · ") : null;
                  return (
                    <ProductListCard
                      key={arma.id}
                      product={arma}
                      minVariacaoPreco={minPrecoPorArma.get(arma.id)}
                      metaLinha={metaLinha}
                      marcaNome={arma.marca?.nome ?? null}
                      showMarcaAboveTitle
                      showDestaqueBadge
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}