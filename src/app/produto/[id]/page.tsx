"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "../../../components/Header";
import { supabase } from "../../../lib/supabaseClient";
import { exportProductToPDF, exportProductToImage, exportProductToImageAndShare } from "../../../lib/exportProduct";
import { emPromocaoValida, textoCondicaoPromocao } from "../../../lib/promoPreco";

const CLIENTE_VITRINE_EMAIL = "cliente@gmail.com";
const WHATSAPP_VENDAS_WA_ME = "5554996717871";

type Arma = {
  id: string;
  nome: string;
  preco: number | null;
  foto_url: string | null;
  categoria_id: number | null;
  espec_capacidade_tiros: string | null;
  espec_carregadores: string | null;
  espec_comprimento_cano: string | null;
  caracteristica_acabamento: string | null;
  em_destaque?: boolean | null;
  em_promocao?: boolean | null;
  preco_promocional?: number | null;
  promocao_modo?: string | null;
  promocao_parcelas_max?: number | null;
  marca: { nome: string } | null;
  calibre: { nome: string } | null;
  funcionamento: { nome: string } | null;
  categoria: { nome: string } | null;
};

type FotoArma = {
  id: string;
  foto_url: string;
  ordem: number;
  variacao_id: string | null;
};

type Variacao = {
  id: string;
  calibre_id: string | null;
  comprimento_cano: string;
  preco: number;
  caracteristica_acabamento: string | null;
  calibre: { nome: string } | null;
};

export default function ProdutoPage() {
  const params = useParams();
  const produtoId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [produto, setProduto] = useState<Arma | null>(null);
  const [fotos, setFotos] = useState<FotoArma[]>([]);
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [selectedVariacaoId, setSelectedVariacaoId] = useState<string | null>(null);
  const [fotoAtualIndex, setFotoAtualIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showParcelamento, setShowParcelamento] = useState(false);
  const [isClienteVitrine, setIsClienteVitrine] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      const email = session?.user?.email?.trim().toLowerCase();
      setIsClienteVitrine(email === CLIENTE_VITRINE_EMAIL);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!produtoId) {
      setLoading(false);
      setError("ID do produto inválido");
      return;
    }

    let cancelled = false;

    const fetchProduto = async () => {
      try {
        setLoading(true);
        setError(null);
        // Buscar o produto com relacionamentos
        const { data: produtoData, error: produtoError } = await supabase
          .from("armas")
          .select("*")
          .eq("id", produtoId)
          .single();

        if (cancelled) return;

        if (produtoError || !produtoData) {
          setError("Produto não encontrado.");
          setLoading(false);
          return;
        }

        // Buscar fotos do produto (com variacao_id para filtrar por variação)
        const { data: fotosData, error: fotosError } = await supabase
          .from("fotos_armas")
          .select("id, foto_url, ordem, variacao_id")
          .eq("arma_id", produtoId)
          .order("ordem", { ascending: true });

        if (fotosError) {
          console.warn("Erro ao buscar fotos:", fotosError);
        }

        // Se não houver fotos na tabela fotos_armas, usar foto_url como fallback
        const fotosFormatadas: FotoArma[] = fotosData && fotosData.length > 0
          ? fotosData.map((foto: { id: string; foto_url: string; ordem: number; variacao_id?: string | null }) => ({
              id: foto.id,
              foto_url: foto.foto_url,
              ordem: foto.ordem,
              variacao_id: foto.variacao_id ?? null,
            }))
          : produtoData.foto_url
          ? [{
              id: 'fallback',
              foto_url: produtoData.foto_url,
              ordem: 0,
              variacao_id: null,
            }]
          : [];

        if (cancelled) return;

        setFotos(fotosFormatadas);

        // Buscar variações do produto (calibre + cano + preço + acabamento)
        const { data: variacoesData, error: variacoesError } = await supabase
          .from("variacoes_armas")
          .select("id, calibre_id, comprimento_cano, preco, caracteristica_acabamento")
          .eq("arma_id", produtoId)
          .order("comprimento_cano");

        if (variacoesError) {
          console.warn("Erro ao buscar variações:", variacoesError);
        }

        if (cancelled) return;

        const variacoesList: Variacao[] = [];
        if (variacoesData && variacoesData.length > 0) {
          const rows = variacoesData as {
            id: string;
            calibre_id: string | null;
            comprimento_cano: string;
            preco: string | number;
            caracteristica_acabamento?: string | null;
          }[];
          const calibreIds = [...new Set(rows.map((v) => v.calibre_id).filter(Boolean))] as string[];
          const calibresMap = new Map<string, string>();
          if (calibreIds.length > 0) {
            const { data: calibresData } = await supabase.from("calibres").select("id, nome").in("id", calibreIds);
            if (cancelled) return;
            (calibresData || []).forEach((c: { id: string; nome: string }) => calibresMap.set(c.id, c.nome));
          }
          rows.forEach((v) => {
            variacoesList.push({
              id: v.id,
              calibre_id: v.calibre_id,
              comprimento_cano: v.comprimento_cano,
              preco: parseFloat(String(v.preco)),
              caracteristica_acabamento: v.caracteristica_acabamento ?? null,
              calibre: v.calibre_id && calibresMap.has(v.calibre_id) ? { nome: calibresMap.get(v.calibre_id)! } : null,
            });
          });
          setVariacoes(variacoesList);
          setSelectedVariacaoId(variacoesList[0].id);
        } else {
          setVariacoes([]);
          setSelectedVariacaoId(null);
        }

        // Buscar dados relacionados
        const [marcaResult, calibreResult, funcionamentoResult, categoriaResult] = await Promise.all([
          produtoData.marca_id
            ? supabase.from("marcas").select("nome").eq("id", produtoData.marca_id).single()
            : { data: null, error: null },
          produtoData.calibre_id || produtoData.calibres_id
            ? supabase
                .from("calibres")
                .select("nome")
                .eq("id", produtoData.calibre_id || produtoData.calibres_id)
                .single()
            : { data: null, error: null },
          produtoData.funcionamento_id
            ? supabase
                .from("funcionamento")
                .select("nome")
                .eq("id", produtoData.funcionamento_id)
                .single()
            : { data: null, error: null },
          produtoData.categoria_id
            ? supabase
                .from("categorias")
                .select("nome")
                .eq("id", produtoData.categoria_id)
                .single()
            : { data: null, error: null },
        ]);

        if (cancelled) return;

        const produtoFormatado: Arma = {
          ...produtoData,
          marca: marcaResult.data ? { nome: marcaResult.data.nome } : null,
          calibre: calibreResult.data ? { nome: calibreResult.data.nome } : null,
          funcionamento: funcionamentoResult.data ? { nome: funcionamentoResult.data.nome } : null,
          categoria: categoriaResult.data ? { nome: categoriaResult.data.nome } : null,
        };

        setProduto(produtoFormatado);
      } catch (err: unknown) {
        if (!cancelled) {
          console.error("Erro:", err);
          setError(err instanceof Error ? err.message : "Erro ao carregar produto");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchProduto();

    return () => {
      cancelled = true;
    };
  }, [produtoId]);

  // Valores atuais: produto com variação selecionada ou dados do produto
  const selectedVariacao = variacoes.find((v) => v.id === selectedVariacaoId) ?? null;
  const precoAtual = selectedVariacao != null ? selectedVariacao.preco : (produto?.preco ?? null);
  const promocaoAtiva = produto != null && emPromocaoValida(produto);
  const precoPromocional =
    promocaoAtiva && produto?.preco_promocional != null ? Number(produto.preco_promocional) : null;
  const precoVitrine = precoPromocional != null ? precoPromocional : precoAtual;
  const calibreAtual = selectedVariacao != null ? selectedVariacao.calibre : produto?.calibre ?? null;
  const comprimentoCanoAtual = selectedVariacao != null ? selectedVariacao.comprimento_cano : (produto?.espec_comprimento_cano ?? null);
  const acabamentoAtual = selectedVariacao?.caracteristica_acabamento ?? produto?.caracteristica_acabamento ?? null;
  const fotosAtual =
    variacoes.length > 0 && selectedVariacaoId
      ? fotos.filter((f) => f.variacao_id === selectedVariacaoId)
      : fotos.filter((f) => !f.variacao_id);
  const fotosExibir = fotosAtual.length > 0 ? fotosAtual : fotos;

  // Resetar índice da foto quando as fotos exibidas ou variação mudarem
  useEffect(() => {
    setFotoAtualIndex(0);
  }, [selectedVariacaoId, fotosExibir.length]);

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

  if (error || !produto) {
    return (
      <div
        className="flex min-h-screen flex-col"
        style={{ backgroundColor: "#030711" }}
      >
        <Header />
        <main className="flex-1 px-4 py-8" style={{ backgroundColor: "#030711" }}>
          <div className="mx-auto max-w-4xl">
            <p className="text-red-400">{error || "Produto não encontrado"}</p>
          </div>
        </main>
      </div>
    );
  }

  const formatPrice = (price: number | null) => {
    if (price == null) return "N/A";
    return parseFloat(price.toString()).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const calcularParcelamento = () => {
    if (precoVitrine == null) return [];

    const preco = parseFloat(precoVitrine.toString());
    const parcelas = [];

    // 1x a 4x sem juros
    for (let i = 1; i <= 4; i++) {
      parcelas.push({
        vezes: i,
        valorParcela: preco / i,
        valorTotal: preco,
        comJuros: false,
      });
    }

    // 5x a 10x com 8% de juros
    for (let i = 5; i <= 10; i++) {
      const valorComJuros = preco * 1.08; // Acréscimo de 8%
      parcelas.push({
        vezes: i,
        valorParcela: valorComJuros / i,
        valorTotal: valorComJuros,
        comJuros: true,
      });
    }

    return parcelas;
  };

  const fotoAtual = fotosExibir[fotoAtualIndex] || null;

  const proximaFoto = () => {
    if (fotosExibir.length > 0) {
      setFotoAtualIndex((prev) => (prev + 1) % fotosExibir.length);
    }
  };

  const fotoAnterior = () => {
    if (fotosExibir.length > 0) {
      setFotoAtualIndex((prev) => (prev - 1 + fotosExibir.length) % fotosExibir.length);
    }
  };

  const handleExportPDF = async () => {
    try {
      const parcelas = calcularParcelamento();
      const produtoData = {
        nome: produto.nome,
        preco: precoVitrine,
        marca: produto.marca,
        calibre: calibreAtual,
        funcionamento: produto.funcionamento,
        categoria: produto.categoria,
        espec_capacidade_tiros: produto.espec_capacidade_tiros,
        espec_carregadores: produto.espec_carregadores,
        espec_comprimento_cano: comprimentoCanoAtual ?? produto.espec_comprimento_cano,
        caracteristica_acabamento: acabamentoAtual ?? produto.caracteristica_acabamento,
        foto_url: fotoAtual?.foto_url || produto.foto_url,
      };
      await exportProductToPDF(produtoData, parcelas);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      alert("Erro ao gerar PDF. Tente novamente.");
    }
  };

  const handleExportImage = async () => {
    try {
      const parcelas = calcularParcelamento();
      const produtoData = {
        nome: produto.nome,
        preco: precoVitrine,
        marca: produto.marca,
        calibre: calibreAtual,
        funcionamento: produto.funcionamento,
        categoria: produto.categoria,
        espec_capacidade_tiros: produto.espec_capacidade_tiros,
        espec_carregadores: produto.espec_carregadores,
        espec_comprimento_cano: comprimentoCanoAtual ?? produto.espec_comprimento_cano,
        caracteristica_acabamento: acabamentoAtual ?? produto.caracteristica_acabamento,
        foto_url: fotoAtual?.foto_url || produto.foto_url,
      };
      await exportProductToImage(produtoData, parcelas);
    } catch (error) {
      console.error("Erro ao exportar imagem:", error);
      alert("Erro ao gerar imagem. Tente novamente.");
    }
  };

  const handleShareWhatsApp = async () => {
    if (isClienteVitrine) {
      const nomeArma = produto.nome?.trim() || "este produto";
      const texto = `Ola! Tenho interesse em comprar a *${nomeArma}*`;
      const url = `https://wa.me/${WHATSAPP_VENDAS_WA_ME}?text=${encodeURIComponent(texto)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const parcelas = calcularParcelamento();
      const produtoData = {
        nome: produto.nome,
        preco: precoVitrine,
        marca: produto.marca,
        calibre: calibreAtual,
        funcionamento: produto.funcionamento,
        categoria: produto.categoria,
        espec_capacidade_tiros: produto.espec_capacidade_tiros,
        espec_carregadores: produto.espec_carregadores,
        espec_comprimento_cano: comprimentoCanoAtual ?? produto.espec_comprimento_cano,
        caracteristica_acabamento: acabamentoAtual ?? produto.caracteristica_acabamento,
        foto_url: fotoAtual?.foto_url || produto.foto_url,
      };
      await exportProductToImageAndShare(produtoData, parcelas);
    } catch (error) {
      console.error("Erro ao compartilhar no WhatsApp:", error);
      alert("Erro ao compartilhar. Tente novamente.");
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#030711" }}
    >
      <Header />
      <main className="flex-1 px-4 py-8" style={{ backgroundColor: "#030711" }}>
        <div className="mx-auto max-w-7xl">
          {/* Seção Principal: Imagem e Detalhes */}
          <div className="mb-8 grid gap-8 md:grid-cols-2">
            {/* Imagem do Produto */}
            <div className="relative">
              {fotoAtual ? (
                <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/40">
                  <img
                    src={fotoAtual.foto_url}
                    alt={produto.nome}
                    className="h-full w-full object-cover"
                  />
                  
                  {/* Navegação de fotos - só mostrar se houver mais de uma foto */}
                  {fotosExibir.length > 1 && (
                    <>
                      {/* Botão anterior */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fotoAnterior();
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-all hover:bg-black/70"
                        aria-label="Foto anterior"
                      >
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                      </button>

                      {/* Botão próximo */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          proximaFoto();
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-all hover:bg-black/70"
                        aria-label="Próxima foto"
                      >
                        <svg
                          className="h-6 w-6"
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
                      </button>

                      {/* Indicador de foto atual */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {fotosExibir.map((_, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.stopPropagation();
                              setFotoAtualIndex(index);
                            }}
                            className={`h-2 rounded-full transition-all ${
                              index === fotoAtualIndex
                                ? "w-8 bg-[#E9B20E]"
                                : "w-2 bg-white/50 hover:bg-white/70"
                            }`}
                            aria-label={`Ir para foto ${index + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  
                  {/* Badges destaque / promoção */}
                  <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                    {produto.em_destaque ? (
                      <div className="rounded-full bg-[#E9B20E] px-3 py-1">
                        <span className="text-xs font-bold text-zinc-900">Destaque</span>
                      </div>
                    ) : null}
                    {promocaoAtiva ? (
                      <div className="rounded bg-[#E9B20E] px-3 py-1 shadow-lg">
                        <span className="text-xs font-black uppercase text-zinc-900">Promoção</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/40">
                  <p className="text-zinc-500">Sem imagem</p>
                </div>
              )}
            </div>

            {/* Detalhes do Produto */}
            <div className="flex flex-col justify-center">
              {/* Marca */}
              {produto.marca && (
                <p className="mb-2 text-sm text-zinc-400">{produto.marca.nome}</p>
              )}

              {/* Nome do Produto */}
              <h1 className="mb-6 text-4xl font-bold text-white md:text-5xl">
                {produto.nome}
              </h1>

              {/* Seletor de variação (calibre + cano) */}
              {variacoes.length > 0 && (
                <div className="mb-6">
                  <p className="mb-2 text-sm text-zinc-400">Escolha a variação</p>
                  <div className="flex flex-wrap gap-2">
                    {variacoes.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariacaoId(v.id)}
                        className="rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors"
                        style={{
                          borderColor: selectedVariacaoId === v.id ? "#E9B20E" : "rgb(63 63 70)",
                          backgroundColor: selectedVariacaoId === v.id ? "rgba(233, 178, 14, 0.15)" : "transparent",
                          color: selectedVariacaoId === v.id ? "#E9B20E" : "rgb(161 161 170)",
                        }}
                      >
                        {v.calibre?.nome ?? "—"} • {v.comprimento_cano}
                        {v.caracteristica_acabamento ? ` • ${v.caracteristica_acabamento}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Preço */}
              <div className="mb-6">
                <p className="mb-1 text-sm text-zinc-400">
                  {promocaoAtiva ? "Promoção" : "Valor à vista"}
                </p>
                {promocaoAtiva && precoAtual != null ? (
                  <>
                    <p className="text-lg text-zinc-500 line-through">R$ {formatPrice(precoAtual)}</p>
                    <p className="text-5xl font-bold" style={{ color: "#E9B20E" }}>
                      R$ {formatPrice(precoPromocional)}
                    </p>
                    <p className="mt-2 text-sm font-medium text-zinc-300">
                      {textoCondicaoPromocao(produto.promocao_modo, produto.promocao_parcelas_max)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Simulação de parcelamento com base no valor promocional.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-5xl font-bold" style={{ color: "#E9B20E" }}>
                      R$ {formatPrice(precoAtual)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-400">
                      ou em até 4x sem juros ou até 10x com juros
                    </p>
                  </>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="mb-6 flex flex-col gap-4 sm:flex-row">
                <button
                  className="flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm transition-colors"
                  style={{ borderColor: "#E9B20E", backgroundColor: "transparent" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "rgba(233, 178, 14, 0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  onClick={() => setShowParcelamento(true)}
                >
                  <svg
                    className="h-4 w-4"
                    style={{ color: "#E9B20E" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="font-bold" style={{ color: "#E9B20E" }}>
                    Ver Parcelamento
                  </span>
                </button>
                
                {!isClienteVitrine && (
                <button
                  className="flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors"
                  style={{ backgroundColor: "#E9B20E", color: "#030711" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#D4A00D")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#E9B20E")
                  }
                  onClick={handleExportPDF}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Exportar PDF
                </button>
                )}
                
                {/* Botão de Exportar Imagem */}
                <button
                  className="flex items-center justify-center gap-2 rounded-lg border-2 px-5 py-2.5 text-sm transition-colors"
                  style={{ borderColor: "#E9B20E", backgroundColor: "transparent" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "rgba(233, 178, 14, 0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                  onClick={handleExportImage}
                >
                  <svg
                    className="h-4 w-4"
                    style={{ color: "#E9B20E" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="font-bold" style={{ color: "#E9B20E" }}>
                    Exportar Imagem
                  </span>
                </button>
              </div>

              <div className="mb-6 flex justify-start">
                <button
                  className="flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors"
                  style={{
                    backgroundColor: "#25D366",
                    color: isClienteVitrine ? "#000000" : "#ffffff",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#20BA5A")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#25D366")
                  }
                  onClick={handleShareWhatsApp}
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 20"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <span>
                    {isClienteVitrine ? "Chamar no WhatsApp" : "Compartilhar no WhatsApp"}
                  </span>
                </button>
              </div>

              {/* Garantias/Features */}
              <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span>Garantia de fábrica</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <span>Produto original</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Especificações */}
          <div className="rounded-lg border border-[#E9B20E] bg-zinc-900/40 p-6">
            <h2 className="mb-6 text-2xl font-bold text-white">Especificações</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {produto.marca && (
                <div>
                  <p className="text-sm text-zinc-400">Marca</p>
                  <p className="text-lg font-semibold text-white">{produto.marca.nome}</p>
                </div>
              )}
              {calibreAtual && (
                <div>
                  <p className="text-sm text-zinc-400">Calibre</p>
                  <p className="text-lg font-semibold text-white">{calibreAtual.nome}</p>
                </div>
              )}
              {produto.funcionamento && (
                <div>
                  <p className="text-sm text-zinc-400">Funcionamento</p>
                  <p className="text-lg font-semibold text-white">
                    {produto.funcionamento.nome}
                  </p>
                </div>
              )}
              {produto.espec_capacidade_tiros && (
                <div>
                  <p className="text-sm text-zinc-400">Capacidade de Tiros</p>
                  <p className="text-lg font-semibold text-white">
                    {produto.espec_capacidade_tiros}
                  </p>
                </div>
              )}
              {produto.espec_carregadores && (
                <div>
                  <p className="text-sm text-zinc-400">Carregadores</p>
                  <p className="text-lg font-semibold text-white">
                    {produto.espec_carregadores}
                  </p>
                </div>
              )}
              {comprimentoCanoAtual && (
                <div>
                  <p className="text-sm text-zinc-400">Comprimento do Cano</p>
                  <p className="text-lg font-semibold text-white">
                    {comprimentoCanoAtual}
                  </p>
                </div>
              )}
              {acabamentoAtual && (
                <div>
                  <p className="text-sm text-zinc-400">Acabamento</p>
                  <p className="text-lg font-semibold text-white">
                    {acabamentoAtual}
                  </p>
                </div>
              )}
              {produto.categoria && (
                <div>
                  <p className="text-sm text-zinc-400">Categoria</p>
                  <p className="text-lg font-semibold text-white">{produto.categoria.nome}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Parcelamento */}
      {showParcelamento && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowParcelamento(false)}
        >
         <div
            className="relative w-full max-w-2xl rounded-lg p-6"
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'rgba(31, 41, 55, 0.17)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Opções de Parcelamento</h2>
              <button
                onClick={() => setShowParcelamento(false)}
                className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Valor Total */}
            {precoVitrine != null && (
              <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
                <p className="text-sm text-zinc-400">Valor para parcelamento</p>
                {promocaoAtiva && precoAtual != null ? (
                  <p className="text-sm text-zinc-500 line-through">De R$ {formatPrice(precoAtual)}</p>
                ) : null}
                <p className="text-3xl font-bold" style={{ color: "#E9B20E" }}>
                  R$ {formatPrice(precoVitrine)}
                </p>
              </div>
            )}

            {/* Lista de Parcelas */}
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {calcularParcelamento().map((parcela, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/30 p-4 transition-colors hover:bg-zinc-800/50"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-lg font-bold"
                      style={{
                        backgroundColor: parcela.comJuros
                          ? "rgba(233, 178, 14, 0.2)"
                          : "rgba(34, 197, 94, 0.2)",
                        color: parcela.comJuros ? "#E9B20E" : "#22c55e",
                      }}
                    >
                      {parcela.vezes}x
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {parcela.vezes}x de R$ {formatPrice(parcela.valorParcela)}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {parcela.comJuros ? (
                          <span>
                            Total: R$ {formatPrice(parcela.valorTotal)} (com juros de 8%)
                          </span>
                        ) : (
                          <span>Sem juros</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {!parcela.comJuros && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold"
                      style={{
                        backgroundColor: "rgba(34, 197, 94, 0.2)",
                        color: "#22c55e",
                      }}
                    >
                      Sem juros
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowParcelamento(false)}
                className="rounded-lg px-6 py-2 font-bold text-zinc-900 transition-colors"
                style={{ backgroundColor: "#E9B20E" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#D4A00D")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#E9B20E")
                }
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}