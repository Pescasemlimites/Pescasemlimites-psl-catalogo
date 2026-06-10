"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import {
  calcularPrecificacaoArma,
  custoComImpostosSequencial,
} from "../../lib/precoCustoMargem";
import {
  armaPassaFiltroCalibre,
  fetchVariacoesMetaPorArmaIds,
} from "../../lib/fetchVariacoesMinPreco";
import { emPromocaoValida } from "../../lib/promoPreco";

type Marca = { id: string; nome: string };
type Calibre = { id: string; nome: string };
type Funcionamento = { id: string; nome: string };
type Categoria = { id: number; nome: string };

type FotoArma = {
  id: string;
  foto_url: string;
  ordem: number;
};

type Arma = {
  id: string;
  categoria_id: number | null;
  nome: string | null;
  preco: number | null;
  calibres_id: string | null;
  funcionamento_id: string | null;
  espec_capacidade_tiros: string | null;
  espec_carregadores: string | null;
  marca_id: string | null;
  espec_comprimento_cano: string | null;
  caracteristica_acabamento: string | null;
  foto_url: string | null;
  em_destaque: boolean | null;
  em_promocao?: boolean | null;
  preco_promocional?: number | null;
  promocao_modo?: string | null;
  promocao_parcelas_max?: number | null;
  destaque_promocao?: boolean | null;
  preco_custo?: number | null;
  margem_venda_percent?: number | null;
  imposto_simples_percent?: number | null;
  difal_percent?: number | null;
  marca?: { nome: string } | null;
  calibre?: { nome: string } | null;
  funcionamento?: { nome: string } | null;
  categoria?: { nome: string } | null;
  fotos?: FotoArma[];
};

type FormArma = {
  categoria_id: string;
  nome: string;
  preco: string;
  calibre_id: string;
  funcionamento_id: string;
  espec_capacidade_tiros: string;
  espec_carregadores: string;
  marca_id: string;
  espec_comprimento_cano: string;
  caracteristica_acabamento: string;
  em_destaque: boolean;
  em_promocao: boolean;
  preco_promocional: string;
  promocao_modo: "avista" | "parcelado";
  promocao_parcelas_max: string;
  destaque_promocao: boolean;
  preco_custo: string;
  margem_venda_percent: string;
  /** Só para calcular promo à vista no formulário (não salvo no banco) */
  margem_promocao_percent: string;
  imposto_simples_percent: string;
  difal_percent: string;
};

type Variacao = {
  id?: string;
  calibre_id: string;
  comprimento_cano: string;
  /** Custo desta variação (opcional; se vazio, ações de precificação usam o custo geral da arma) */
  preco_custo: string;
  preco: string;
  /** Preço promocional desta combinação (variacoes_armas.preco_promocional) */
  preco_promocional: string;
  caracteristica_acabamento: string;
  fotoFiles?: File[];
  fotoPreviews?: string[];
  fotosExistentes?: FotoArma[];
  fotosParaRemover?: string[];
};

const initialForm: FormArma = {
  categoria_id: "",
  nome: "",
  preco: "",
  calibre_id: "",
  funcionamento_id: "",
  espec_capacidade_tiros: "",
  espec_carregadores: "",
  marca_id: "",
  espec_comprimento_cano: "",
  caracteristica_acabamento: "",
  em_destaque: false,
  em_promocao: false,
  preco_promocional: "",
  promocao_modo: "avista",
  promocao_parcelas_max: "12",
  destaque_promocao: false,
  preco_custo: "",
  margem_venda_percent: "",
  margem_promocao_percent: "",
  imposto_simples_percent: "",
  difal_percent: "",
};

function formatPctStr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return Number(n).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function impostosFormDoCatalogo(tributacao: {
  pctSimplesStr: string;
  pctDifalStr: string;
}): Pick<FormArma, "imposto_simples_percent" | "difal_percent"> {
  return {
    imposto_simples_percent: tributacao.pctSimplesStr,
    difal_percent: tributacao.pctDifalStr,
  };
}

const inputClass =
  "w-full rounded-lg border border-zinc-600 bg-zinc-800/50 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-[#E9B20E] focus:outline-none focus:ring-1 focus:ring-[#E9B20E]";

const labelClass = "mb-1.5 block text-sm font-medium text-zinc-300";

/** Primeira foto (capa) para listagem admin */
function armaCapaUrl(arma: Arma): string | null {
  const sorted = [...(arma.fotos || [])].sort((a, b) => a.ordem - b.ordem);
  return sorted[0]?.foto_url ?? arma.foto_url ?? null;
}

function armaFotosExtrasCount(arma: Arma): number {
  const n = arma.fotos?.length ?? 0;
  return n > 0 ? Math.max(0, n - 1) : 0;
}

function rotuloVariacaoPromo(
  v: { calibre_id?: string | null; comprimento_cano?: string | null },
  calibresPorId: Map<string, string>
): string {
  const calibre = v.calibre_id ? calibresPorId.get(v.calibre_id) ?? "?" : "sem calibre";
  const cano = (v.comprimento_cano ?? "").trim() || "sem cano";
  return `${calibre} • ${cano}`;
}

type VariacaoPromoRow = {
  id: string;
  preco: number;
  preco_custo: number | null;
  calibre_id: string | null;
  comprimento_cano: string | null;
};

export default function CadastrosPage() {
  const router = useRouter();
  const { authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [calibres, setCalibres] = useState<Calibre[]>([]);
  const [funcionamentos, setFuncionamentos] = useState<Funcionamento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [armas, setArmas] = useState<Arma[]>([]);
  const [calibresPorVariacao, setCalibresPorVariacao] = useState<Map<string, Set<string>>>(
    () => new Map()
  );
  const [form, setForm] = useState<FormArma>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([]);
  const [fotosExistentes, setFotosExistentes] = useState<FotoArma[]>([]);
  const [fotosParaRemover, setFotosParaRemover] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filtroMarca, setFiltroMarca] = useState<string>("");
  const [filtroCalibre, setFiltroCalibre] = useState<string>("");
  const [filtroNome, setFiltroNome] = useState<string>("");
  const [selectedArmaIds, setSelectedArmaIds] = useState<Set<string>>(() => new Set());
  const [bulkMargemStr, setBulkMargemStr] = useState("");
  const [bulkMargemLoading, setBulkMargemLoading] = useState(false);
  const [bulkPromoMargemStr, setBulkPromoMargemStr] = useState("");
  const [bulkPromoLoading, setBulkPromoLoading] = useState(false);
  const [bulkDestaquePromoLoading, setBulkDestaquePromoLoading] = useState(false);
  const [promoAvisos, setPromoAvisos] = useState<string[]>([]);
  const [comVariacao, setComVariacao] = useState(false);
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [activeTab, setActiveTab] = useState<
    "armas" | "marcas" | "calibres" | "configuracoes"
  >("armas");
  const [tributacao, setTributacao] = useState({
    nomeSimples: "Imposto Simples",
    nomeDifal: "DIFAL",
    pctSimplesStr: "0",
    pctDifalStr: "0",
  });
  const [configSaving, setConfigSaving] = useState(false);
  // Marcas
  const [novaMarca, setNovaMarca] = useState("");
  const [marcaEditandoId, setMarcaEditandoId] = useState<string | null>(null);
  const [marcaEditandoNome, setMarcaEditandoNome] = useState("");

  // Calibres
  const [novoCalibre, setNovoCalibre] = useState("");
  const [calibreEditandoId, setCalibreEditandoId] = useState<string | null>(null);
  const [calibreEditandoNome, setCalibreEditandoNome] = useState("");

  const fetchMarcas = async () => {
    const { data, error } = await supabase
      .from("marcas")
      .select("id, nome")
      .order("nome");

    if (error) {
      console.error(error);
      return;
    }

    if (data) setMarcas(data);
  };

  const fetchCalibres = async () => {
    const { data, error } = await supabase
      .from("calibres")
      .select("id, nome")
      .order("nome");

    if (error) {
      console.error(error);
      return;
    }

    if (data) setCalibres(data);
  };

  const fetchFuncionamentos = async () => {
    const { data, error } = await supabase
      .from("funcionamento")
      .select("id, nome")
      .order("nome");

    if (error) {
      console.error(error);
      return;
    }

    if (data) setFuncionamentos(data);
  };

  const fetchCategorias = async () => {
    const { data, error } = await supabase
      .from("categorias")
      .select("id, nome")
      .order("nome");

    if (error) {
      console.error(error);
      return;
    }

    if (data) setCategorias(data);
  };

  const handleCriarMarca = async () => {
    if (!novaMarca.trim()) return;

    const { error } = await supabase
      .from("marcas")
      .insert({ nome: novaMarca.trim() });

    if (error) {
      console.error(error);
      return;
    }

    setNovaMarca("");
    await fetchMarcas();
  };

  const handleIniciarEdicaoMarca = (id: string, nome: string) => {
    setMarcaEditandoId(id);
    setMarcaEditandoNome(nome);
  };

  const handleSalvarEdicaoMarca = async () => {
    if (!marcaEditandoId || !marcaEditandoNome.trim()) return;

    const { error } = await supabase
      .from("marcas")
      .update({ nome: marcaEditandoNome.trim() })
      .eq("id", marcaEditandoId);

    if (error) {
      console.error(error);
      return;
    }

    setMarcaEditandoId(null);
    setMarcaEditandoNome("");
    await fetchMarcas();
  };

  const handleExcluirMarca = async (id: string) => {
    const { error } = await supabase.from("marcas").delete().eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    await fetchMarcas();
  };

  const handleCriarCalibre = async () => {
    if (!novoCalibre.trim()) return;

    const { error } = await supabase
      .from("calibres")
      .insert({ nome: novoCalibre.trim() });

    if (error) {
      console.error(error);
      return;
    }

    setNovoCalibre("");
    await fetchCalibres();
  };

  const handleIniciarEdicaoCalibre = (id: string, nome: string) => {
    setCalibreEditandoId(id);
    setCalibreEditandoNome(nome);
  };

  const handleSalvarEdicaoCalibre = async () => {
    if (!calibreEditandoId || !calibreEditandoNome.trim()) return;

    const { error } = await supabase
      .from("calibres")
      .update({ nome: calibreEditandoNome.trim() })
      .eq("id", calibreEditandoId);

    if (error) {
      console.error(error);
      return;
    }

    setCalibreEditandoId(null);
    setCalibreEditandoNome("");
    await fetchCalibres();
  };

  const handleExcluirCalibre = async (id: string) => {
    const { error } = await supabase.from("calibres").delete().eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    await fetchCalibres();
  };

  useEffect(() => {
    if (authLoading) return;

    fetchMarcas();
    fetchCalibres();
    fetchFuncionamentos();
    fetchCategorias();
    fetchArmas();
    fetchCatalogoConfig();
  }, [authLoading]);

  const fetchCatalogoConfig = async () => {
    const { data, error } = await supabase
      .from("catalogo_config")
      .select(
        "nome_imposto_simples, nome_difal, imposto_simples_percent, difal_percent"
      )
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.warn("catalogo_config:", error);
      return;
    }
    const s = data?.imposto_simples_percent != null ? Number(data.imposto_simples_percent) : 0;
    const d = data?.difal_percent != null ? Number(data.difal_percent) : 0;
    setTributacao({
      nomeSimples: (data?.nome_imposto_simples as string)?.trim() || "Imposto Simples",
      nomeDifal: (data?.nome_difal as string)?.trim() || "DIFAL",
      pctSimplesStr: (Number.isFinite(s) ? s : 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      }),
      pctDifalStr: (Number.isFinite(d) ? d : 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      }),
    });
  };

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profile?.role !== "admin") {
          router.push("/dashboard");
        }
      }
    };

    if (!authLoading) {
      checkAdminAccess();
    }
  }, [authLoading, router]);

  const fetchArmas = async () => {
    setLoading(true);
    try {
      // Buscar armas e dados relacionados em paralelo
      const [armasResult, fotosResult] = await Promise.all([
        supabase
          .from("armas")
          .select("*")
          .order("nome"),
        // Buscar todas as fotos de uma vez (se houver armas)
        supabase
          .from("fotos_armas")
          .select("id, arma_id, foto_url, ordem")
          .order("arma_id, ordem")
      ]);

      if (armasResult.error) throw armasResult.error;

      const armasData = armasResult.data || [];
      const armaIds = armasData.map((a: any) => a.id);
      
      // Processar fotos
      let fotosMap = new Map<string, FotoArma[]>();
      if (fotosResult.data && armaIds.length > 0) {
        fotosResult.data.forEach((foto: any) => {
          if (!fotosMap.has(foto.arma_id)) {
            fotosMap.set(foto.arma_id, []);
          }
          fotosMap.get(foto.arma_id)!.push({
            id: foto.id,
            foto_url: foto.foto_url,
            ordem: foto.ordem,
          });
        });
      }

      // Extrair IDs únicos para buscar relacionamentos
      const marcaIds = [...new Set(armasData.map((a: any) => a.marca_id).filter(Boolean))];
      const calibreIds = [...new Set(armasData.map((a: any) => a.calibre_id || a.calibres_id).filter(Boolean))];
      const funcionamentoIds = [...new Set(armasData.map((a: any) => a.funcionamento_id).filter(Boolean))];
      const categoriaIds = [...new Set(armasData.map((a: any) => a.categoria_id).filter(Boolean))];

      // Buscar todos os relacionamentos em paralelo
      const [marcasResult, calibresResult, funcionamentosResult, categoriasResult] = await Promise.all([
        marcaIds.length > 0
          ? supabase.from("marcas").select("id, nome").in("id", marcaIds)
          : Promise.resolve({ data: [], error: null }),
        calibreIds.length > 0
          ? supabase.from("calibres").select("id, nome").in("id", calibreIds)
          : Promise.resolve({ data: [], error: null }),
        funcionamentoIds.length > 0
          ? supabase.from("funcionamento").select("id, nome").in("id", funcionamentoIds)
          : Promise.resolve({ data: [], error: null }),
        categoriaIds.length > 0
          ? supabase.from("categorias").select("id, nome").in("id", categoriaIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Criar maps para lookup rápido
      const marcasMap = new Map((marcasResult.data || []).map((m: any) => [m.id, m.nome]));
      const calibresMap = new Map((calibresResult.data || []).map((c: any) => [c.id, c.nome]));
      const funcionamentosMap = new Map((funcionamentosResult.data || []).map((f: any) => [f.id, f.nome]));
      const categoriasMap = new Map((categoriasResult.data || []).map((c: any) => [c.id, c.nome]));

      // Formatar dados
      const armasFormatadas = armasData.map((arma: any) => {
        const calibreId = arma.calibre_id || arma.calibres_id;
        return {
          ...arma,
          marca: arma.marca_id && marcasMap.has(arma.marca_id) ? { nome: marcasMap.get(arma.marca_id) } : null,
          calibre: calibreId && calibresMap.has(calibreId) ? { nome: calibresMap.get(calibreId) } : null,
          funcionamento: arma.funcionamento_id && funcionamentosMap.has(arma.funcionamento_id) ? { nome: funcionamentosMap.get(arma.funcionamento_id) } : null,
          categoria: arma.categoria_id && categoriasMap.has(arma.categoria_id) ? { nome: categoriasMap.get(arma.categoria_id) } : null,
          fotos: fotosMap.get(arma.id) || [],
        };
      });

      setArmas(armasFormatadas);

      const { calibresPorArma } = await fetchVariacoesMetaPorArmaIds(armaIds);
      setCalibresPorVariacao(calibresPorArma);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Erro ao carregar armas",
      });
      setCalibresPorVariacao(new Map());
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target;
    const name = target.name;
    const rawValue =
      target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
    const value =
      name === "promocao_modo" && typeof rawValue === "string"
        ? rawValue === "parcelado"
          ? "parcelado"
          : "avista"
        : rawValue;
    setForm((prev) => ({ ...prev, [name]: value } as FormArma));
    setMessage(null);
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > 0) {
      setFotoFiles(files);
      
      // Criar previews das imagens
      const previews = files.map(file => URL.createObjectURL(file));
      setFotoPreviews(previews);
    }
    
    setMessage(null);
  };

  const removeFoto = (index: number) => {
    const newFiles = fotoFiles.filter((_, i) => i !== index);
    const newPreviews = fotoPreviews.filter((_, i) => i !== index);
    
    // Revogar URL do preview removido
    URL.revokeObjectURL(fotoPreviews[index]);
    
    setFotoFiles(newFiles);
    setFotoPreviews(newPreviews);
  };

  const definirFotoNovaComoCapa = (index: number) => {
    if (index === 0) return;
    const newFiles = [...fotoFiles];
    const newPreviews = [...fotoPreviews];
    
    // Mover para primeira posição
    const [fotoMovida] = newFiles.splice(index, 1);
    const [previewMovido] = newPreviews.splice(index, 1);
    
    newFiles.unshift(fotoMovida);
    newPreviews.unshift(previewMovido);
    
    setFotoFiles(newFiles);
    setFotoPreviews(newPreviews);
  };

  const definirFotoExistenteComoCapa = (fotoId: string) => {
    const foto = fotosExistentes.find(f => f.id === fotoId);
    if (!foto || foto.ordem === 0) return;
    
    // Reordenar: mover a foto selecionada para ordem 0 e ajustar as outras
    const novasFotos = [...fotosExistentes];
    
    // Ordenar por ordem atual
    novasFotos.sort((a, b) => a.ordem - b.ordem);
    
    // Encontrar o índice da foto a ser movida
    const index = novasFotos.findIndex(f => f.id === fotoId);
    
    // Remover a foto da posição atual
    const [fotoMovida] = novasFotos.splice(index, 1);
    
    // Inserir no início
    novasFotos.unshift(fotoMovida);
    
    // Reordenar todas as fotos (a primeira terá ordem 0, segunda ordem 1, etc.)
    novasFotos.forEach((f, i) => {
      f.ordem = i;
    });
    
    setFotosExistentes(novasFotos);
  };

  const removeFotoExistente = (fotoId: string) => {
    setFotosParaRemover([...fotosParaRemover, fotoId]);
    setFotosExistentes(fotosExistentes.filter(f => f.id !== fotoId));
  };

  const addVariacao = () => {
    setVariacoes((prev) => [
      ...prev,
      {
        calibre_id: "",
        comprimento_cano: "",
        preco_custo: "",
        preco: "",
        preco_promocional: "",
        caracteristica_acabamento: "",
        fotoFiles: [],
        fotoPreviews: [],
        fotosExistentes: [],
        fotosParaRemover: [],
      },
    ]);
  };

  const removeVariacao = (index: number) => {
    const v = variacoes[index];
    if (v.fotoPreviews) v.fotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setVariacoes((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariacao = (index: number, field: keyof Variacao, value: string | string[] | File[] | FotoArma[]) => {
    setVariacoes((prev) => {
      const next = [...prev];
      const cur = { ...next[index] };
      if (field === "fotoFiles") cur.fotoFiles = value as File[];
      else if (field === "fotoPreviews") cur.fotoPreviews = value as string[];
      else if (field === "fotosExistentes") cur.fotosExistentes = value as FotoArma[];
      else if (field === "fotosParaRemover") cur.fotosParaRemover = value as string[];
      else (cur as any)[field] = value;
      next[index] = cur;
      return next;
    });
  };

  const handleVariacaoFotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const previews = files.map((f) => URL.createObjectURL(f));
    setVariacoes((prev) => {
      const next = [...prev];
      const cur = { ...next[index] };
      cur.fotoFiles = [...(cur.fotoFiles || []), ...files];
      cur.fotoPreviews = [...(cur.fotoPreviews || []), ...previews];
      next[index] = cur;
      return next;
    });
  };

  const removeVariacaoFoto = (variacaoIndex: number, fotoIndex: number) => {
    setVariacoes((prev) => {
      const next = [...prev];
      const cur = { ...next[variacaoIndex] };
      const files = cur.fotoFiles || [];
      const previews = cur.fotoPreviews || [];
      if (previews[fotoIndex]) URL.revokeObjectURL(previews[fotoIndex]);
      cur.fotoFiles = files.filter((_, i) => i !== fotoIndex);
      cur.fotoPreviews = previews.filter((_, i) => i !== fotoIndex);
      next[variacaoIndex] = cur;
      return next;
    });
  };

  const removeVariacaoFotoExistente = (variacaoIndex: number, fotoId: string) => {
    setVariacoes((prev) => {
      const next = [...prev];
      const cur = { ...next[variacaoIndex] };
      cur.fotosExistentes = (cur.fotosExistentes || []).filter((f) => f.id !== fotoId);
      cur.fotosParaRemover = [...(cur.fotosParaRemover || []), fotoId];
      next[variacaoIndex] = cur;
      return next;
    });
  };

  const openEditModal = async (arma: Arma) => {
    setEditingId(arma.id);
    setForm({
      categoria_id: arma.categoria_id?.toString() || "",
      nome: arma.nome || "",
      preco: arma.preco?.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "",
      calibre_id: arma.calibres_id || "",
      funcionamento_id: arma.funcionamento_id || "",
      espec_capacidade_tiros: arma.espec_capacidade_tiros || "",
      espec_carregadores: arma.espec_carregadores || "",
      marca_id: arma.marca_id || "",
      espec_comprimento_cano: arma.espec_comprimento_cano || "",
      caracteristica_acabamento: arma.caracteristica_acabamento || "",
      em_destaque: arma.em_destaque || false,
      em_promocao: arma.em_promocao || false,
      preco_promocional:
        arma.preco_promocional != null
          ? Number(arma.preco_promocional).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "",
      promocao_modo:
        arma.promocao_modo === "parcelado" || arma.promocao_modo === "avista"
          ? arma.promocao_modo
          : "avista",
      promocao_parcelas_max:
        arma.promocao_parcelas_max != null ? String(arma.promocao_parcelas_max) : "12",
      destaque_promocao: arma.destaque_promocao || false,
      preco_custo:
        arma.preco_custo != null
          ? Number(arma.preco_custo).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "",
      margem_venda_percent:
        arma.margem_venda_percent != null
          ? Number(arma.margem_venda_percent).toLocaleString("pt-BR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 4,
            })
          : "",
      margem_promocao_percent: "",
      imposto_simples_percent:
        arma.imposto_simples_percent != null
          ? formatPctStr(Number(arma.imposto_simples_percent))
          : tributacao.pctSimplesStr,
      difal_percent:
        arma.difal_percent != null
          ? formatPctStr(Number(arma.difal_percent))
          : tributacao.pctDifalStr,
    });
    setFotoFiles([]);
    setFotoPreviews([]);
    setFotosExistentes(arma.fotos || []);
    setFotosParaRemover([]);
    setComVariacao(false);
    setVariacoes([]);

    // Buscar variações e fotos em paralelo
    const [variacoesResult, fotosResult] = await Promise.all([
      supabase
        .from("variacoes_armas")
        .select("id, calibre_id, comprimento_cano, preco, preco_custo, preco_promocional, caracteristica_acabamento")
        .eq("arma_id", arma.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("fotos_armas")
        .select("id, variacao_id, foto_url, ordem")
        .eq("arma_id", arma.id)
        .order("variacao_id, ordem")
    ]);

    const variacoesData = variacoesResult.data || [];
    const fotosData = fotosResult.data || [];

    if (variacoesData.length > 0) {
      setComVariacao(true);
      
      // Criar mapa de fotos por variação
      const fotosPorVariacao = new Map<string, FotoArma[]>();
      fotosData.forEach((foto: any) => {
        if (foto.variacao_id) {
          if (!fotosPorVariacao.has(foto.variacao_id)) {
            fotosPorVariacao.set(foto.variacao_id, []);
          }
          fotosPorVariacao.get(foto.variacao_id)!.push({
            id: foto.id,
            foto_url: foto.foto_url,
            ordem: foto.ordem,
          });
        }
      });

      // Formatar variações com suas fotos
      const variacoesComFotos = variacoesData.map((v: any) => ({
        id: v.id,
        calibre_id: v.calibre_id || "",
        comprimento_cano: v.comprimento_cano || "",
        preco_custo:
          v.preco_custo != null
            ? Number(v.preco_custo).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "",
        preco: v.preco != null ? Number(v.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
        preco_promocional:
          v.preco_promocional != null
            ? Number(v.preco_promocional).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "",
        caracteristica_acabamento: v.caracteristica_acabamento ?? "",
        fotosExistentes: fotosPorVariacao.get(v.id) || [],
        fotosParaRemover: [] as string[],
      }));
      
      setVariacoes(variacoesComFotos);
    }

    // Carregar fotos gerais (sem variacao_id) ordenadas
    const fotosGerais = fotosData
      .filter((foto: any) => !foto.variacao_id)
      .map((foto: any) => ({
        id: foto.id,
        foto_url: foto.foto_url,
        ordem: foto.ordem || 0,
      }))
      .sort((a, b) => a.ordem - b.ordem);
    
    setFotosExistentes(fotosGerais);

    setShowModal(true);
  };

  const openNewModal = () => {
    setEditingId(null);
    setForm({ ...initialForm, ...impostosFormDoCatalogo(tributacao) });
    setFotoFiles([]);
    setFotoPreviews([]);
    setFotosExistentes([]);
    setFotosParaRemover([]);
    setComVariacao(false);
    setVariacoes([]);
    setShowModal(true);
  };

  const closeModal = () => {
    fotoPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    variacoes.forEach((v) => {
      (v.fotoPreviews || []).forEach((url) => URL.revokeObjectURL(url));
    });
    setShowModal(false);
    setEditingId(null);
    setForm(initialForm);
    setFotoFiles([]);
    setFotoPreviews([]);
    setFotosExistentes([]);
    setFotosParaRemover([]);
    setComVariacao(false);
    setVariacoes([]);
    setMessage(null);
  };

  const parsePreco = (s: string) => {
    if (!s || !s.trim()) return null;
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  };

  const formatPrecoBr = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const precoPromocionalVariacaoParaDb = (v: Variacao): number | null => {
    if (!form.em_promocao) return null;
    const p = parsePreco(v.preco_promocional);
    return p != null && p > 0 ? p : null;
  };

  const custoMargemParaDb = (): {
    preco_custo: number | null;
    margem_venda_percent: number | null;
    imposto_simples_percent: number | null;
    difal_percent: number | null;
  } => {
    const custo = parsePreco(form.preco_custo);
    const margem = parsePreco(form.margem_venda_percent);
    const pctSimples = parsePreco(form.imposto_simples_percent);
    const pctDifal = parsePreco(form.difal_percent);
    return {
      preco_custo: custo != null && custo >= 0 ? custo : null,
      margem_venda_percent: margem != null && margem >= 0 ? margem : null,
      imposto_simples_percent: pctSimples != null && pctSimples >= 0 ? pctSimples : null,
      difal_percent: pctDifal != null && pctDifal >= 0 ? pctDifal : null,
    };
  };

  const handleSalvarCatalogoConfig = async () => {
    const nomeS = tributacao.nomeSimples.trim() || "Imposto Simples";
    const nomeD = tributacao.nomeDifal.trim() || "DIFAL";
    const parsedS = parsePreco(tributacao.pctSimplesStr);
    const parsedD = parsePreco(tributacao.pctDifalStr);
    if (parsedS == null || parsedS < 0 || parsedD == null || parsedD < 0) {
      setMessage({
        type: "error",
        text: "Informe percentuais válidos (≥ 0) para Imposto Simples e DIFAL.",
      });
      return;
    }
    setConfigSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.from("catalogo_config").upsert(
        {
          id: 1,
          nome_imposto_simples: nomeS,
          nome_difal: nomeD,
          imposto_simples_percent: parsedS,
          difal_percent: parsedD,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) throw error;
      setTributacao((prev) => ({
        ...prev,
        nomeSimples: nomeS,
        nomeDifal: nomeD,
        pctSimplesStr: parsedS.toLocaleString("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 4,
        }),
        pctDifalStr: parsedD.toLocaleString("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 4,
        }),
      }));
      setMessage({ type: "ok", text: "Configuração de tributos salva." });
    } catch (e: any) {
      setMessage({ type: "error", text: e?.message || "Erro ao salvar configuração." });
    } finally {
      setConfigSaving(false);
    }
  };

  const promocaoColunasParaDb = (): Record<string, unknown> => {
    if (!form.em_promocao) {
      return {
        em_promocao: false,
        preco_promocional: null,
        promocao_modo: null,
        promocao_parcelas_max: null,
        destaque_promocao: false,
      };
    }
    const promosVariacoes = variacoes
      .map((v) => parsePreco(v.preco_promocional))
      .filter((p): p is number => p != null && p > 0);
    const precoForm = parsePreco(form.preco_promocional);
    const precoPromo =
      comVariacao && promosVariacoes.length > 0
        ? Math.min(...promosVariacoes)
        : precoForm;
    return {
      em_promocao: true,
      preco_promocional: precoPromo,
      promocao_modo: form.promocao_modo,
      promocao_parcelas_max:
        form.promocao_modo === "parcelado"
          ? Math.max(2, parseInt(String(form.promocao_parcelas_max), 10) || 2)
          : null,
      destaque_promocao: Boolean(form.destaque_promocao),
    };
  };

  const limparDestaquePromoOutros = async (armaId: string) => {
    if (form.em_promocao && form.destaque_promocao) {
      await supabase.from("armas").update({ destaque_promocao: false }).neq("id", armaId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitLoading(true);

    try {
      // Validação básica
      if (!form.nome || !form.nome.trim()) {
        setMessage({ type: "error", text: "O nome do produto é obrigatório." });
        setSubmitLoading(false);
        return;
      }

      if (form.em_promocao) {
        const promosVariacoes = comVariacao
          ? variacoes
              .map((v) => parsePreco(v.preco_promocional))
              .filter((p): p is number => p != null && p > 0)
          : [];
        const precoPromoForm = parsePreco(form.preco_promocional);
        const temPromoVariacao = promosVariacoes.length > 0;
        const temPromoForm = precoPromoForm != null && precoPromoForm > 0;
        if (!temPromoVariacao && !temPromoForm) {
          setMessage({
            type: "error",
            text: comVariacao
              ? "Informe o preço promocional no produto ou em pelo menos uma variação."
              : "Informe um preço promocional válido.",
          });
          setSubmitLoading(false);
          return;
        }
        if (form.promocao_modo === "parcelado") {
          const n = parseInt(String(form.promocao_parcelas_max), 10);
          if (!n || n < 2) {
            setMessage({
              type: "error",
              text: "Em promoção parcelada, informe o máximo de parcelas (2 ou mais).",
            });
            setSubmitLoading(false);
            return;
          }
        }
      }

      const pctImpostoProduto = parsePreco(form.imposto_simples_percent);
      const pctDifalProduto = parsePreco(form.difal_percent);
      if (
        (parsePreco(form.preco_custo) != null || parsePreco(form.margem_venda_percent) != null) &&
        (pctImpostoProduto == null ||
          pctImpostoProduto < 0 ||
          pctDifalProduto == null ||
          pctDifalProduto < 0)
      ) {
        setMessage({
          type: "error",
          text: "Informe percentuais válidos (≥ 0) para os impostos deste produto.",
        });
        setSubmitLoading(false);
        return;
      }

      const precoValue = form.preco
        ? parseFloat(form.preco.replace(/\./g, "").replace(",", "."))
        : null;

      if (comVariacao) {
        if (variacoes.length === 0) {
          setMessage({ type: "error", text: "Adicione pelo menos uma variação (calibre, cano e valor)." });
          setSubmitLoading(false);
          return;
        }
        for (const v of variacoes) {
          if (!v.calibre_id || !String(v.comprimento_cano).trim() || !String(v.preco).trim()) {
            setMessage({ type: "error", text: "Preencha calibre, comprimento do cano e preço em todas as variações." });
            setSubmitLoading(false);
            return;
          }
        }

        if (editingId) {
          const updateData: any = {
            categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
            nome: form.nome || null,
            preco: null,
            funcionamento_id: form.funcionamento_id || null,
            espec_capacidade_tiros: form.espec_capacidade_tiros || null,
            espec_carregadores: form.espec_carregadores || null,
            marca_id: form.marca_id || null,
            calibres_id: null,
            espec_comprimento_cano: null,
            caracteristica_acabamento: form.caracteristica_acabamento || null,
            em_destaque: form.em_destaque || false,
            ...promocaoColunasParaDb(),
            ...custoMargemParaDb(),
          };
          const { error: updateError } = await supabase.from("armas").update(updateData).eq("id", editingId);
          if (updateError) throw updateError;
          await limparDestaquePromoOutros(editingId);

          const currentVariacaoIds = variacoes.map((v) => v.id).filter(Boolean) as string[];
          if (currentVariacaoIds.length > 0) {
            const { data: existingVar } = await supabase.from("variacoes_armas").select("id").eq("arma_id", editingId);
            const toDelete = (existingVar || []).filter((ev: any) => !currentVariacaoIds.includes(ev.id)).map((ev: any) => ev.id);
            if (toDelete.length > 0) await supabase.from("variacoes_armas").delete().in("id", toDelete);
          } else {
            await supabase.from("variacoes_armas").delete().eq("arma_id", editingId);
          }

          for (let i = 0; i < variacoes.length; i++) {
            const v = variacoes[i];
            const precoVar = parsePreco(v.preco);
            if (precoVar == null) continue;
            const custoVarDb = (() => {
              const c = parsePreco(v.preco_custo);
              return c != null && c >= 0 ? c : null;
            })();
            const precoPromoVarDb = precoPromocionalVariacaoParaDb(v);
            let variacaoId: string;
            if (v.id) {
              await supabase
                .from("variacoes_armas")
                .update({
                  calibre_id: v.calibre_id || null,
                  comprimento_cano: v.comprimento_cano.trim(),
                  preco: precoVar,
                  preco_custo: custoVarDb,
                  preco_promocional: precoPromoVarDb,
                  caracteristica_acabamento: v.caracteristica_acabamento?.trim() || null,
                })
                .eq("id", v.id);
              variacaoId = v.id;
            } else {
              const { data: inserted, error: insErr } = await supabase
                .from("variacoes_armas")
                .insert({
                  arma_id: editingId,
                  calibre_id: v.calibre_id || null,
                  comprimento_cano: v.comprimento_cano.trim(),
                  preco: precoVar,
                  preco_custo: custoVarDb,
                  preco_promocional: precoPromoVarDb,
                  caracteristica_acabamento: v.caracteristica_acabamento?.trim() || null,
                })
                .select("id")
                .single();
              if (insErr || !inserted) throw insErr || new Error("Erro ao criar variação");
              variacaoId = inserted.id;
            }

            const fotosToRemove = v.fotosParaRemover || [];
            if (fotosToRemove.length > 0) {
              const { data: urls } = await supabase.from("fotos_armas").select("foto_url").in("id", fotosToRemove);
              if (urls) {
                const paths = urls.map((f: any) => f.foto_url?.includes("/fotos-armas/") ? f.foto_url.substring(f.foto_url.indexOf("/fotos-armas/") + "/fotos-armas/".length) : null).filter(Boolean);
                if (paths.length) await supabase.storage.from("fotos-armas").remove(paths);
              }
              await supabase.from("fotos_armas").delete().in("id", fotosToRemove);
            }

            const files = v.fotoFiles || [];
            if (files.length > 0) {
              // Buscar ordem base uma vez
              let ordemBase = 0;
              const { data: maxOrdem } = await supabase.from("fotos_armas").select("ordem").eq("variacao_id", variacaoId).order("ordem", { ascending: false }).limit(1);
              if (maxOrdem && maxOrdem[0]) ordemBase = (maxOrdem[0] as any).ordem + 1;
              
              // Upload paralelo de todas as fotos
              const uploadPromises = files.map(async (file, j) => {
                const ext = file.name.split(".").pop();
                const timestamp = Date.now();
                const path = `armas/${editingId}-var-${variacaoId}-${timestamp}-${j}.${ext}`;
                
                const { error: upErr } = await supabase.storage.from("fotos-armas").upload(path, file, { cacheControl: "3600", upsert: false });
                if (upErr) throw new Error(`Upload da foto ${j + 1}: ${upErr.message}`);
                
                const { data: pub } = supabase.storage.from("fotos-armas").getPublicUrl(path);
                const { error: insFoto } = await supabase.from("fotos_armas").insert({ 
                  arma_id: editingId, 
                  variacao_id: variacaoId, 
                  foto_url: pub.publicUrl, 
                  ordem: ordemBase + j 
                });
                if (insFoto) throw new Error(`Salvar foto ${j + 1}: ${insFoto.message}`);
              });
              
              await Promise.all(uploadPromises);
            }
          }

          setMessage({ type: "ok", text: "Arma atualizada com sucesso." });
        } else {
          const { data: insertData, error: insertError } = await supabase
            .from("armas")
            .insert({
              categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
              nome: form.nome || null,
              preco: null,
              funcionamento_id: form.funcionamento_id || null,
              espec_capacidade_tiros: form.espec_capacidade_tiros || null,
              espec_carregadores: form.espec_carregadores || null,
              marca_id: form.marca_id || null,
              calibres_id: null,
              espec_comprimento_cano: null,
              caracteristica_acabamento: form.caracteristica_acabamento || null,
              em_destaque: form.em_destaque || false,
              ...promocaoColunasParaDb(),
              ...custoMargemParaDb(),
            })
            .select("id")
            .single();
          if (insertError || !insertData) throw insertError || new Error("Erro ao cadastrar arma");
          const armaId = insertData.id as string;
          await limparDestaquePromoOutros(armaId);

          for (let i = 0; i < variacoes.length; i++) {
            const v = variacoes[i];
            const precoVar = parsePreco(v.preco);
            if (precoVar == null) continue;
            const custoVarDb = (() => {
              const c = parsePreco(v.preco_custo);
              return c != null && c >= 0 ? c : null;
            })();
            const precoPromoVarDb = precoPromocionalVariacaoParaDb(v);
            const { data: varRow, error: varErr } = await supabase
              .from("variacoes_armas")
              .insert({
                arma_id: armaId,
                calibre_id: v.calibre_id || null,
                comprimento_cano: v.comprimento_cano.trim(),
                preco: precoVar,
                preco_custo: custoVarDb,
                preco_promocional: precoPromoVarDb,
                caracteristica_acabamento: v.caracteristica_acabamento?.trim() || null,
              })
              .select("id")
              .single();
            if (varErr || !varRow) throw varErr || new Error("Erro ao criar variação");
            const variacaoId = varRow.id;

            const files = v.fotoFiles || [];
            if (files.length > 0) {
              // Upload paralelo de todas as fotos
              const uploadPromises = files.map(async (file, j) => {
                const ext = file.name.split(".").pop();
                const timestamp = Date.now();
                const path = `armas/${armaId}-var-${variacaoId}-${timestamp}-${j}.${ext}`;
                
                const { error: upErr } = await supabase.storage.from("fotos-armas").upload(path, file, { cacheControl: "3600", upsert: false });
                if (upErr) throw new Error(`Upload da foto ${j + 1}: ${upErr.message}`);
                
                const { data: pub } = supabase.storage.from("fotos-armas").getPublicUrl(path);
                const { error: insFoto } = await supabase.from("fotos_armas").insert({ 
                  arma_id: armaId, 
                  variacao_id: variacaoId, 
                  foto_url: pub.publicUrl, 
                  ordem: j 
                });
                if (insFoto) throw new Error(`Salvar foto ${j + 1}: ${insFoto.message}`);
              });
              
              await Promise.all(uploadPromises);
            }
          }

          setMessage({ type: "ok", text: "Arma cadastrada com sucesso." });
        }

        // Aguardar um pouco para garantir que tudo foi salvo antes de recarregar
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetchArmas();
        setTimeout(() => closeModal(), 1000);
        setSubmitLoading(false);
        return;
      }

      if (editingId) {
        // Editar arma existente (sem variação)
        const updateData: any = {
          categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
          nome: form.nome || null,
          preco: precoValue,
          funcionamento_id: form.funcionamento_id || null,
          espec_capacidade_tiros: form.espec_capacidade_tiros || null,
          espec_carregadores: form.espec_carregadores || null,
          marca_id: form.marca_id || null,
          calibres_id: form.calibre_id || null,
          espec_comprimento_cano: form.espec_comprimento_cano || null,
          caracteristica_acabamento: form.caracteristica_acabamento || null,
          em_destaque: form.em_destaque || false,
          ...promocaoColunasParaDb(),
          ...custoMargemParaDb(),
        };

        const { error: updateError } = await supabase
          .from("armas")
          .update(updateData)
          .eq("id", editingId);

        if (updateError) throw updateError;
        await limparDestaquePromoOutros(editingId);

        // Remover fotos marcadas para remoção
        if (fotosParaRemover.length > 0) {
          try {
            // Buscar URLs das fotos para deletar do storage
            const { data: fotosParaDeletar, error: fetchError } = await supabase
              .from("fotos_armas")
              .select("foto_url")
              .in("id", fotosParaRemover);

            // Deletar do storage
            if (!fetchError && fotosParaDeletar) {
              const pathsToDelete = fotosParaDeletar.map((foto: any) => {
                if (foto.foto_url && foto.foto_url.includes("/fotos-armas/")) {
                  const pathIndex = foto.foto_url.indexOf("/fotos-armas/") + "/fotos-armas/".length;
                  return foto.foto_url.substring(pathIndex);
                }
                return null;
              }).filter(Boolean);

              if (pathsToDelete.length > 0) {
                await supabase.storage
                  .from("fotos-armas")
                  .remove(pathsToDelete);
              }
            }

            // Deletar do banco
            const { error: deleteFotosError } = await supabase
              .from("fotos_armas")
              .delete()
              .in("id", fotosParaRemover);

            if (deleteFotosError) {
              console.warn("Erro ao remover fotos do banco:", deleteFotosError);
              // Não falhar se a tabela não existir
              if (deleteFotosError.code !== "PGRST116" && deleteFotosError.code !== "42P01") {
                throw new Error("Erro ao remover fotos");
              }
            }
          } catch (err: any) {
            console.warn("Erro ao remover fotos (tabela pode não existir):", err);
            // Continuar mesmo se não conseguir remover
          }
        }

        // Atualizar ordem das fotos existentes (garantir que a primeira tenha ordem 0)
        if (fotosExistentes.length > 0) {
          try {
            const fotosOrdenadas = [...fotosExistentes].sort((a, b) => a.ordem - b.ordem);
            const updatePromises = fotosOrdenadas.map((foto, index) =>
              supabase
                .from("fotos_armas")
                .update({ ordem: index })
                .eq("id", foto.id)
            );
            await Promise.all(updatePromises);
          } catch (err: any) {
            console.warn("Erro ao atualizar ordem das fotos existentes:", err);
          }
        }

        // Fazer upload de novas fotos
        if (fotoFiles.length > 0) {
          // Calcular ordem inicial: se há fotos existentes, começar após a última; senão, começar em 0
          const fotosExistentesOrdenadas = [...fotosExistentes].sort((a, b) => a.ordem - b.ordem);
          const ordemInicial = fotosExistentesOrdenadas.length > 0 
            ? fotosExistentesOrdenadas.length 
            : 0;

          const uploadPromises = fotoFiles.map(async (file, index) => {
            const fileExt = file.name.split(".").pop();
            const timestamp = Date.now();
            const filePath = `armas/${editingId}-${timestamp}-${index}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("fotos-armas")
              .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
              });

            if (uploadError) {
              console.error("Erro no upload:", uploadError);
              throw new Error(`Erro ao fazer upload da foto ${index + 1}: ${uploadError.message}`);
            }

            const { data: publicUrlData } = supabase.storage
              .from("fotos-armas")
              .getPublicUrl(filePath);

            // Inserir na tabela fotos_armas
            const { error: insertFotoError } = await supabase
              .from("fotos_armas")
              .insert({
                arma_id: editingId,
                foto_url: publicUrlData.publicUrl,
                ordem: ordemInicial + index,
              });

            if (insertFotoError) {
              console.error("Erro ao inserir foto:", insertFotoError);
              throw new Error(`Erro ao salvar URL da foto ${index + 1}: ${insertFotoError.message || insertFotoError.code || "Erro desconhecido"}`);
            }
          });

          await Promise.all(uploadPromises);
        }

        setMessage({ type: "ok", text: "Arma atualizada com sucesso." });
      } else {
        // Criar nova arma
        const { data: insertData, error: insertError } = await supabase
          .from("armas")
          .insert([
            {
              categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
              nome: form.nome || null,
              preco: precoValue,
              funcionamento_id: form.funcionamento_id || null,
              espec_capacidade_tiros: form.espec_capacidade_tiros || null,
              espec_carregadores: form.espec_carregadores || null,
              marca_id: form.marca_id || null,
              calibres_id: form.calibre_id || null,
              espec_comprimento_cano: form.espec_comprimento_cano || null,
              caracteristica_acabamento: form.caracteristica_acabamento || null,
              em_destaque: form.em_destaque || false,
              ...promocaoColunasParaDb(),
              ...custoMargemParaDb(),
            },
          ])
          .select("id")
          .single();

        if (insertError || !insertData) {
          throw insertError || new Error("Erro ao cadastrar arma");
        }

        const armaId = insertData.id as string;
        await limparDestaquePromoOutros(armaId);

        // Fazer upload de todas as fotos
        if (fotoFiles.length > 0) {
          const uploadPromises = fotoFiles.map(async (file, index) => {
            const fileExt = file.name.split(".").pop();
            const timestamp = Date.now();
            const filePath = `armas/${armaId}-${timestamp}-${index}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from("fotos-armas")
              .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false,
              });

            if (uploadError) {
              console.error("Erro no upload:", uploadError);
              throw new Error(`Erro ao fazer upload da foto ${index + 1}: ${uploadError.message}`);
            }

            const { data: publicUrlData } = supabase.storage
              .from("fotos-armas")
              .getPublicUrl(filePath);

            // Inserir na tabela fotos_armas
            const { error: insertFotoError } = await supabase
              .from("fotos_armas")
              .insert({
                arma_id: armaId,
                foto_url: publicUrlData.publicUrl,
                ordem: index,
              });

            if (insertFotoError) {
              console.error("Erro ao inserir foto:", insertFotoError);
              throw new Error(`Erro ao salvar URL da foto ${index + 1}: ${insertFotoError.message || insertFotoError.code || "Erro desconhecido"}`);
            }
          });

          await Promise.all(uploadPromises);
        }

        setMessage({ type: "ok", text: "Arma cadastrada com sucesso." });
      }

      // Aguardar um pouco para garantir que tudo foi salvo antes de recarregar
      await new Promise(resolve => setTimeout(resolve, 500));
      // Recarregar lista e fechar modal após 1 segundo
      await fetchArmas();
      setTimeout(() => {
        closeModal();
      }, 1000);
    } catch (err: any) {
      console.error("Erro ao salvar produto:", err);
      setMessage({
        type: "error",
        text: err?.message || "Erro ao salvar produto. Verifique o console para mais detalhes.",
      });
    } finally {
      // Garantir que o loading sempre seja desativado
      setSubmitLoading(false);
    }
  };

  // Filtrar armas baseado nos filtros
  const armasFiltradas = armas.filter((arma) => {
    const matchMarca = !filtroMarca || arma.marca_id === filtroMarca;
    const matchCalibre =
      !filtroCalibre ||
      armaPassaFiltroCalibre(arma.calibres_id, arma.id, filtroCalibre, calibresPorVariacao);
    const matchNome = !filtroNome || (arma.nome || "").toLowerCase().includes(filtroNome.toLowerCase());
    return matchMarca && matchCalibre && matchNome;
  });

  const filtroArmasAtivo = !!(filtroMarca || filtroCalibre || filtroNome);
  const selectedVisibleCount = armasFiltradas.filter((a) => selectedArmaIds.has(a.id)).length;
  const headerSelectRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = headerSelectRef.current;
    if (!el) return;
    el.indeterminate =
      armasFiltradas.length > 0 &&
      selectedVisibleCount > 0 &&
      selectedVisibleCount < armasFiltradas.length;
  }, [selectedVisibleCount, armasFiltradas.length]);

  const limparFiltros = () => {
    setFiltroMarca("");
    setFiltroCalibre("");
    setFiltroNome("");
  };

  const aplicarMargemEmMassa = async () => {
    const ids = [...selectedArmaIds];
    if (ids.length === 0) {
      setMessage({ type: "error", text: "Selecione pelo menos uma arma." });
      return;
    }
    const margem = parsePreco(bulkMargemStr);
    if (margem == null || margem < 0) {
      setMessage({
        type: "error",
        text: "Informe um percentual de lucro válido (número ≥ 0).",
      });
      return;
    }
    setBulkMargemLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from("armas")
        .update({ margem_venda_percent: margem })
        .in("id", ids);
      if (error) throw error;
      setMessage({
        type: "ok",
        text: `% de lucro (${margem.toLocaleString("pt-BR")}%) aplicado a ${ids.length} produto(s).`,
      });
      setBulkMargemStr("");
      setSelectedArmaIds(new Set());
      await fetchArmas();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err?.message || "Erro ao atualizar margem em massa.",
      });
    } finally {
      setBulkMargemLoading(false);
    }
  };

  const destacarTodasPromocoesNaHome = async () => {
    setBulkDestaquePromoLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from("armas")
        .select("id, em_promocao, preco_promocional")
        .eq("em_promocao", true)
        .not("preco_promocional", "is", null);

      if (error) throw error;

      const ids = (data || []).filter((a) => emPromocaoValida(a)).map((a) => a.id);
      if (ids.length === 0) {
        setMessage({
          type: "error",
          text: "Nenhum produto com promoção ativa e preço promocional válido.",
        });
        return;
      }

      const { error: updErr } = await supabase
        .from("armas")
        .update({ destaque_promocao: true })
        .in("id", ids);

      if (updErr) throw updErr;

      setMessage({
        type: "ok",
        text: `${ids.length} promoção(ões) destacada(s) no banner da página inicial.`,
      });
      await fetchArmas();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Erro ao destacar promoções.";
      setMessage({ type: "error", text: msg });
    } finally {
      setBulkDestaquePromoLoading(false);
    }
  };

  const aplicarPromocaoAvistaEmMassa = async () => {
    const ids = [...selectedArmaIds];
    if (ids.length === 0) {
      setMessage({ type: "error", text: "Selecione pelo menos uma arma." });
      return;
    }
    const margemAvista = parsePreco(bulkPromoMargemStr);
    if (margemAvista == null || margemAvista < 0) {
      setMessage({
        type: "error",
        text: "Informe um % de lucro à vista válido (número ≥ 0).",
      });
      return;
    }
    const pctS = parsePreco(tributacao.pctSimplesStr) ?? 0;
    const pctD = parsePreco(tributacao.pctDifalStr) ?? 0;

    setBulkPromoLoading(true);
    setMessage(null);
    setPromoAvisos([]);
    try {
      const [{ data: armasData, error: armasErr }, { data: varsData, error: varsErr }] =
        await Promise.all([
          supabase.from("armas").select("id, nome, preco_custo, preco").in("id", ids),
          supabase
            .from("variacoes_armas")
            .select("id, arma_id, preco, preco_custo, calibre_id, comprimento_cano")
            .in("arma_id", ids),
        ]);
      if (armasErr) throw armasErr;
      if (varsErr) throw varsErr;

      const calibresPorId = new Map(calibres.map((c) => [c.id, c.nome]));
      const armasMap = new Map((armasData || []).map((a) => [a.id, a]));
      const varsByArma = new Map<string, VariacaoPromoRow[]>();
      (varsData || []).forEach((v) => {
        const preco = Number(v.preco);
        if (!Number.isFinite(preco)) return;
        const list = varsByArma.get(v.arma_id) || [];
        list.push({
          id: v.id,
          preco,
          preco_custo: v.preco_custo != null ? Number(v.preco_custo) : null,
          calibre_id: v.calibre_id ?? null,
          comprimento_cano: v.comprimento_cano ?? null,
        });
        varsByArma.set(v.arma_id, list);
      });

      const calcPromo = (custo: number) =>
        calcularPrecificacaoArma(custo, pctS, pctD, margemAvista).precoSugerido;

      const avisos: string[] = [];
      let promovidas = 0;
      let ignoradas = 0;

      for (const id of ids) {
        const arma = armasMap.get(id);
        if (!arma) {
          ignoradas++;
          continue;
        }
        const armaNome =
          typeof arma.nome === "string" && arma.nome.trim()
            ? arma.nome.trim()
            : `Produto ${id.slice(0, 8)}`;
        const custoArma =
          arma.preco_custo != null && Number(arma.preco_custo) >= 0
            ? Number(arma.preco_custo)
            : null;
        const vars = varsByArma.get(id) || [];

        if (vars.length > 0) {
          const promosVar: number[] = [];
          let varsComCusto = 0;

          for (const v of vars) {
            const custo =
              v.preco_custo != null && Number.isFinite(v.preco_custo) && v.preco_custo >= 0
                ? v.preco_custo
                : null;

            if (custo == null) {
              avisos.push(
                `${armaNome} — variação ${rotuloVariacaoPromo(v, calibresPorId)} não entrou na promoção: informe o custo desta variação.`
              );
              continue;
            }

            varsComCusto++;
            const promo = calcPromo(custo);
            if (promo <= 0 || promo >= v.preco) continue;

            promosVar.push(promo);
            const { error: varErr } = await supabase
              .from("variacoes_armas")
              .update({ preco_promocional: promo })
              .eq("id", v.id);
            if (varErr) throw varErr;
          }

          if (promosVar.length === 0) {
            ignoradas++;
            if (varsComCusto === 0) {
              avisos.push(
                `${armaNome} — não foi adicionado à promoção: nenhuma variação possui custo cadastrado.`
              );
            } else {
              avisos.push(
                `${armaNome} — não foi adicionado à promoção: o preço promocional não ficou menor que o preço de venda em nenhuma variação com custo.`
              );
            }
            continue;
          }

          const minPromo = Math.min(...promosVar);
          const { error: armaErr } = await supabase
            .from("armas")
            .update({
              em_promocao: true,
              preco_promocional: minPromo,
              promocao_modo: "avista",
              promocao_parcelas_max: null,
            })
            .eq("id", id);
          if (armaErr) throw armaErr;
          promovidas++;
        } else {
          if (custoArma == null) {
            ignoradas++;
            avisos.push(
              `${armaNome} — não foi adicionado à promoção: informe o custo do produto.`
            );
            continue;
          }
          const precoRegular =
            arma.preco != null && Number(arma.preco) > 0 ? Number(arma.preco) : null;
          const promo = calcPromo(custoArma);
          if (promo <= 0 || (precoRegular != null && promo >= precoRegular)) {
            ignoradas++;
            avisos.push(
              `${armaNome} — não foi adicionado à promoção: o preço promocional não ficou menor que o preço de venda.`
            );
            continue;
          }
          const { error: armaErr } = await supabase
            .from("armas")
            .update({
              em_promocao: true,
              preco_promocional: promo,
              promocao_modo: "avista",
              promocao_parcelas_max: null,
            })
            .eq("id", id);
          if (armaErr) throw armaErr;
          promovidas++;
        }
      }

      setPromoAvisos(avisos);
      const margemTxt = margemAvista.toLocaleString("pt-BR");
      let textoResumo = `Promoção à vista (${margemTxt}% lucro) aplicada a ${promovidas} produto(s).`;
      if (ignoradas > 0) {
        textoResumo += ` ${ignoradas} produto(s) ignorado(s).`;
      }
      if (avisos.length > 0) {
        textoResumo += " Veja os avisos abaixo.";
      }
      setMessage({
        type: promovidas === 0 && avisos.length > 0 ? "error" : "ok",
        text: textoResumo,
      });
      setBulkPromoMargemStr("");
      setSelectedArmaIds(new Set());
      await fetchArmas();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Erro ao aplicar promoção em massa.";
      setMessage({ type: "error", text: msg });
      setPromoAvisos([]);
    } finally {
      setBulkPromoLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      // Buscar todas as fotos da arma
      try {
        const { data: fotosData, error: fotosError } = await supabase
          .from("fotos_armas")
          .select("foto_url")
          .eq("arma_id", id);

        // Deletar fotos do storage
        if (!fotosError && fotosData && fotosData.length > 0) {
          try {
            const pathsToDelete = fotosData.map((foto: any) => {
              if (foto.foto_url && foto.foto_url.includes("/fotos-armas/")) {
                const pathIndex = foto.foto_url.indexOf("/fotos-armas/") + "/fotos-armas/".length;
                return foto.foto_url.substring(pathIndex);
              }
              return null;
            }).filter(Boolean);

            if (pathsToDelete.length > 0) {
              const { error: storageError } = await supabase.storage
                .from("fotos-armas")
                .remove(pathsToDelete);

              // Não falhar se não conseguir deletar as fotos (pode já ter sido deletadas)
              if (storageError) {
                console.warn("Erro ao deletar fotos do storage:", storageError);
              }
            }
          } catch (storageErr) {
            console.warn("Erro ao deletar fotos:", storageErr);
            // Continuar mesmo se não conseguir deletar as fotos
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar fotos para deletar (tabela pode não existir):", err);
        // Continuar mesmo se não conseguir buscar fotos
      }

      
      // Deletar a arma do banco de dados (o CASCADE vai deletar as fotos automaticamente)
      const { error: deleteError } = await supabase
        .from("armas")
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      setMessage({ type: "ok", text: "Arma excluída com sucesso." });
      setDeleteConfirm(null);
      setDeletingId(null);
      await fetchArmas();
    } catch (err: any) {
      console.error("Erro ao excluir arma:", err);
      setMessage({
        type: "error",
        text: err?.message || "Erro ao excluir arma. Verifique o console para mais detalhes.",
      });
      setDeletingId(null);
    }
  };

  const custoParsedModal = parsePreco(form.preco_custo);
  const margemParsedModal = parsePreco(form.margem_venda_percent);
  const pctSimplesModal = parsePreco(form.imposto_simples_percent) ?? 0;
  const pctDifalModal = parsePreco(form.difal_percent) ?? 0;
  const impostosProdutoValidos =
    parsePreco(form.imposto_simples_percent) != null &&
    parsePreco(form.imposto_simples_percent)! >= 0 &&
    parsePreco(form.difal_percent) != null &&
    parsePreco(form.difal_percent)! >= 0;
  const subtotalAposSimplesModal =
    custoParsedModal != null && custoParsedModal >= 0
      ? custoParsedModal * (1 + pctSimplesModal / 100)
      : null;
  const valorImpostoSimplesModal =
    custoParsedModal != null && subtotalAposSimplesModal != null
      ? subtotalAposSimplesModal - custoParsedModal
      : null;
  const valorImpostoDifalModal =
    subtotalAposSimplesModal != null
      ? custoComImpostosSequencial(custoParsedModal!, pctSimplesModal, pctDifalModal) -
        subtotalAposSimplesModal
      : null;
  const precificacaoModal =
    custoParsedModal != null &&
    custoParsedModal >= 0 &&
    margemParsedModal != null &&
    margemParsedModal >= 0 &&
    impostosProdutoValidos
      ? calcularPrecificacaoArma(
          custoParsedModal,
          pctSimplesModal,
          pctDifalModal,
          margemParsedModal
        )
      : null;
  const valorLucroModal =
    precificacaoModal != null
      ? precificacaoModal.valorBrutoComLucro - precificacaoModal.custoComImpostos
      : null;

  const podeUsarMargemVariacoes =
    margemParsedModal != null && margemParsedModal >= 0 && impostosProdutoValidos;

  /** Custo numérico para precificação: custo da linha ou custo geral do produto */
  const custoNumericoVariacao = (v: Variacao): number | null => {
    const local = parsePreco(v.preco_custo);
    if (local != null && local >= 0) return local;
    if (custoParsedModal != null && custoParsedModal >= 0) return custoParsedModal;
    return null;
  };

  const precoSugeridoParaVariacao = (v: Variacao): number | null => {
    if (!podeUsarMargemVariacoes) return null;
    const custo = custoNumericoVariacao(v);
    if (custo == null) return null;
    return calcularPrecificacaoArma(
      custo,
      pctSimplesModal,
      pctDifalModal,
      margemParsedModal!
    ).precoSugerido;
  };

  const margemPromoParsed = parsePreco(form.margem_promocao_percent);

  const precoPromoSugeridoDeCusto = (custo: number, margemPromo: number): number =>
    calcularPrecificacaoArma(custo, pctSimplesModal, pctDifalModal, margemPromo).precoSugerido;

  const precoPromoSugeridoVariacao = (v: Variacao): number | null => {
    if (margemPromoParsed == null || margemPromoParsed < 0 || !impostosProdutoValidos) return null;
    const custo = custoNumericoVariacao(v);
    if (custo == null) return null;
    return precoPromoSugeridoDeCusto(custo, margemPromoParsed);
  };

  const precoPromoSugeridoProduto = (): number | null => {
    if (margemPromoParsed == null || margemPromoParsed < 0 || !impostosProdutoValidos) return null;
    if (custoParsedModal == null || custoParsedModal < 0) return null;
    return precoPromoSugeridoDeCusto(custoParsedModal, margemPromoParsed);
  };

  const aplicarPromoSugeridaProduto = () => {
    const sug = precoPromoSugeridoProduto();
    if (sug == null) {
      setMessage({
        type: "error",
        text: "Informe custo, impostos e % de lucro promocional válidos.",
      });
      return;
    }
    const precoVenda = parsePreco(form.preco);
    if (precoVenda != null && sug >= precoVenda) {
      setMessage({
        type: "error",
        text: "O preço promocional calculado precisa ser menor que o preço de venda.",
      });
      return;
    }
    setForm((p) => ({ ...p, preco_promocional: formatPrecoBr(sug) }));
    setMessage(null);
  };

  const aplicarPromoSugeridaTodasVariacoes = () => {
    if (margemPromoParsed == null || margemPromoParsed < 0 || !impostosProdutoValidos) {
      setMessage({
        type: "error",
        text: "Informe % de lucro promocional e impostos válidos.",
      });
      return;
    }
    let aplicadas = 0;
    let ignoradas = 0;
    setVariacoes((prev) =>
      prev.map((v) => {
        const sug = precoPromoSugeridoVariacao(v);
        if (sug == null) {
          ignoradas++;
          return v;
        }
        const precoVenda = parsePreco(v.preco);
        if (precoVenda != null && sug >= precoVenda) {
          ignoradas++;
          return v;
        }
        aplicadas++;
        return { ...v, preco_promocional: formatPrecoBr(sug) };
      })
    );
    if (aplicadas === 0) {
      setMessage({
        type: "error",
        text: "Nenhuma variação recebeu promo: verifique custo, preço de venda e % de lucro promocional.",
      });
      return;
    }
    setMessage({
      type: "ok",
      text:
        ignoradas > 0
          ? `Promo calculada em ${aplicadas} variação(ões); ${ignoradas} ignorada(s) (sem custo ou promo ≥ venda).`
          : `Promo calculada em ${aplicadas} variação(ões).`,
    });
  };

  const aplicarCustoGeralEmTodasVariacoes = () => {
    if (variacoes.length === 0) return;
    if (custoParsedModal == null || custoParsedModal < 0) {
      setMessage({
        type: "error",
        text: "Informe um preço de custo geral válido no bloco Custo, impostos e lucro.",
      });
      return;
    }
    const formatado = formatPrecoBr(custoParsedModal);
    setVariacoes((prev) => prev.map((v) => ({ ...v, preco_custo: formatado })));
    setMessage(null);
  };

  const podeAplicarCustoGeralVariacoes =
    variacoes.length > 0 && custoParsedModal != null && custoParsedModal >= 0;

  const mostrarBlocoPrecificacao =
    (custoParsedModal != null && custoParsedModal >= 0 && impostosProdutoValidos) ||
    precificacaoModal != null ||
    (comVariacao && podeUsarMargemVariacoes);

  const restaurarImpostosPadraoCatalogo = () => {
    setForm((prev) => ({
      ...prev,
      ...impostosFormDoCatalogo(tributacao),
    }));
    setMessage(null);
  };

  const calibresPorIdModal = useMemo(
    () => new Map(calibres.map((c) => [c.id, c.nome])),
    [calibres]
  );

  const resumoPromoVariacoes = useMemo(() => {
    if (!comVariacao || variacoes.length === 0) return [];
    return variacoes.map((v, idx) => ({
      idx,
      rotulo: rotuloVariacaoPromo(v, calibresPorIdModal),
      precoVenda: parsePreco(v.preco),
      precoPromo: parsePreco(v.preco_promocional),
    }));
  }, [comVariacao, variacoes, calibresPorIdModal]);

  const fotosExistentesSorted = useMemo(
    () => [...fotosExistentes].sort((a, b) => a.ordem - b.ordem),
    [fotosExistentes]
  );
  const armaPrincipalUrl =
    fotosExistentesSorted[0]?.foto_url ?? fotoPreviews[0] ?? null;
  const armaExtrasExistentes =
    fotosExistentesSorted.length > 0 ? fotosExistentesSorted.slice(1) : [];
  const armaExtrasPreviewsIndices =
    fotosExistentesSorted.length > 0
      ? fotoPreviews.map((url, i) => ({ url, i }))
      : fotoPreviews.slice(1).map((url, j) => ({ url, i: j + 1 }));

  const fileInputClass = `${inputClass} file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-600`;

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
    <div
      className="flex min-h-screen flex-col"
      style={{ backgroundColor: "#030711" }}
    >
      <Header />

      <main className="flex-1 px-4 py-8 md:px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Gerenciar Cadastros
            </h1>
            <button
              type="button"
              onClick={openNewModal}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium text-zinc-900 transition-colors"
              style={{ backgroundColor: "#E9B20E" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#D4A00D";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#E9B20E";
              }}
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Novo Cadastro
            </button>
          </div>

          {message && (
            <div
              className={`mb-4 rounded-lg px-4 py-3 text-sm ${
                message.type === "ok"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Abas de gerenciamento */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("armas")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeTab === "armas"
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Armas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("marcas")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeTab === "marcas"
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Marcas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("calibres")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeTab === "calibres"
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Calibres
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("configuracoes")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeTab === "configuracoes"
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Configurações
            </button>
          </div>

          {/* Conteúdo da aba Marcas */}
          {activeTab === "marcas" && (
            <section className="mb-6 rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Marcas</h2>
              </div>

              <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={novaMarca}
                  onChange={(e) => setNovaMarca(e.target.value)}
                  className={inputClass}
                  placeholder="Nova marca"
                />
                <button
                  type="button"
                  onClick={handleCriarMarca}
                  className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-900 sm:w-auto"
                  style={{ backgroundColor: "#E9B20E" }}
                >
                  Adicionar marca
                </button>
              </div>

              <div className="space-y-2">
                {marcas.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    Nenhuma marca cadastrada. Cadastre uma nova acima.
                  </p>
                ) : (
                  marcas.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col items-start justify-between gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-2 sm:flex-row sm:items-center"
                    >
                      {marcaEditandoId === m.id ? (
                        <input
                          type="text"
                          value={marcaEditandoNome}
                          onChange={(e) =>
                            setMarcaEditandoNome(e.target.value)
                          }
                          className={inputClass}
                        />
                      ) : (
                        <span className="text-sm text-zinc-200">{m.nome}</span>
                      )}

                      <div className="flex gap-2">
                        {marcaEditandoId === m.id ? (
                          <>
                            <button
                              type="button"
                              onClick={handleSalvarEdicaoMarca}
                              className="rounded px-3 py-1 text-xs font-medium text-zinc-900"
                              style={{ backgroundColor: "#E9B20E" }}
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMarcaEditandoId(null);
                                setMarcaEditandoNome("");
                              }}
                              className="rounded px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleIniciarEdicaoMarca(m.id, m.nome)
                              }
                              className="rounded px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirMarca(m.id)}
                              className="rounded px-3 py-1 text-xs text-red-400 hover:bg-red-500/20"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Conteúdo da aba Calibres */}
          {activeTab === "calibres" && (
            <section className="mb-6 rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Calibres</h2>
              </div>

              <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={novoCalibre}
                  onChange={(e) => setNovoCalibre(e.target.value)}
                  className={inputClass}
                  placeholder="Novo calibre"
                />
                <button
                  type="button"
                  onClick={handleCriarCalibre}
                  className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-900 sm:w-auto"
                  style={{ backgroundColor: "#E9B20E" }}
                >
                  Adicionar calibre
                </button>
              </div>

              <div className="space-y-2">
                {calibres.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    Nenhum calibre cadastrado. Cadastre um novo acima.
                  </p>
                ) : (
                  calibres.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col items-start justify-between gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-2 sm:flex-row sm:items-center"
                    >
                      {calibreEditandoId === c.id ? (
                        <input
                          type="text"
                          value={calibreEditandoNome}
                          onChange={(e) =>
                            setCalibreEditandoNome(e.target.value)
                          }
                          className={inputClass}
                        />
                      ) : (
                        <span className="text-sm text-zinc-200">{c.nome}</span>
                      )}

                      <div className="flex gap-2">
                        {calibreEditandoId === c.id ? (
                          <>
                            <button
                              type="button"
                              onClick={handleSalvarEdicaoCalibre}
                              className="rounded px-3 py-1 text-xs font-medium text-zinc-900"
                              style={{ backgroundColor: "#E9B20E" }}
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCalibreEditandoId(null);
                                setCalibreEditandoNome("");
                              }}
                              className="rounded px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleIniciarEdicaoCalibre(c.id, c.nome)
                              }
                              className="rounded px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirCalibre(c.id)}
                              className="rounded px-3 py-1 text-xs text-red-400 hover:bg-red-500/20"
                            >
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activeTab === "configuracoes" && (
            <section className="mb-6 rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-4">
              <h2 className="mb-1 text-lg font-semibold text-white">Configurações do catálogo</h2>
              <p className="mb-4 text-sm text-zinc-400">
                Os tributos são aplicados <strong className="text-zinc-300">em sequência</strong>: primeiro sobre o
                custo da arma, o segundo sobre esse subtotal (não é apenas a soma dos percentuais de uma vez). O{" "}
                <strong className="text-zinc-300">lucro (%)</strong> incide sobre o valor já com impostos. O preço
                sugerido no cadastro usa arredondamento para baixo (regra especial para valores a partir de R$ 100).
              </p>
              <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-zinc-700/60 bg-zinc-900/40 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Primeira camada</p>
                  <div>
                    <label htmlFor="nome_imposto_simples" className={labelClass}>
                      Nome exibido
                    </label>
                    <input
                      id="nome_imposto_simples"
                      type="text"
                      value={tributacao.nomeSimples}
                      onChange={(e) =>
                        setTributacao((t) => ({ ...t, nomeSimples: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="Imposto Simples"
                    />
                  </div>
                  <div>
                    <label htmlFor="pct_imposto_simples" className={labelClass}>
                      Percentual (%)
                    </label>
                    <input
                      id="pct_imposto_simples"
                      type="text"
                      inputMode="decimal"
                      value={tributacao.pctSimplesStr}
                      onChange={(e) =>
                        setTributacao((t) => ({ ...t, pctSimplesStr: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border border-zinc-700/60 bg-zinc-900/40 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Segunda camada</p>
                  <div>
                    <label htmlFor="nome_difal" className={labelClass}>
                      Nome exibido
                    </label>
                    <input
                      id="nome_difal"
                      type="text"
                      value={tributacao.nomeDifal}
                      onChange={(e) =>
                        setTributacao((t) => ({ ...t, nomeDifal: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="DIFAL"
                    />
                  </div>
                  <div>
                    <label htmlFor="pct_difal" className={labelClass}>
                      Percentual (%)
                    </label>
                    <input
                      id="pct_difal"
                      type="text"
                      inputMode="decimal"
                      value={tributacao.pctDifalStr}
                      onChange={(e) =>
                        setTributacao((t) => ({ ...t, pctDifalStr: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={configSaving}
                onClick={handleSalvarCatalogoConfig}
                className="mt-4 rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
                style={{ backgroundColor: "#E9B20E" }}
              >
                {configSaving ? "Salvando…" : "Salvar configuração de tributos"}
              </button>
            </section>
          )}

          {/* Conteúdo da aba Armas */}
          {activeTab === "armas" && (
            <>
              {/* Filtros */}
              <div className="mb-8 rounded-2xl border border-zinc-700/60 bg-zinc-900/40 p-5 shadow-inner sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">Filtros da lista</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Refine por nome, marca ou calibre. A tabela abaixo reflete só o que passar pelos filtros.
                    </p>
                  </div>
                  {(filtroMarca || filtroCalibre || filtroNome) && (
                    <button
                      type="button"
                      onClick={limparFiltros}
                      className="text-sm font-medium text-[#E9B20E] underline-offset-2 hover:underline"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <label htmlFor="filtro-nome" className={labelClass}>
                  Nome
                </label>
                <input
                  id="filtro-nome"
                  type="text"
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  className={inputClass}
                  placeholder="Buscar por nome..."
                />
              </div>
              <div>
                <label htmlFor="filtro-marca" className={labelClass}>
                  Marca
                </label>
                <select
                  id="filtro-marca"
                  value={filtroMarca}
                  onChange={(e) => setFiltroMarca(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Todas as marcas</option>
                  {marcas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filtro-calibre" className={labelClass}>
                  Calibre
                </label>
                <select
                  id="filtro-calibre"
                  value={filtroCalibre}
                  onChange={(e) => setFiltroCalibre(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Todos os calibres</option>
                  {calibres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(filtroMarca || filtroCalibre || filtroNome) && (
              <div className="mt-5 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-400">
                Mostrando <span className="font-medium text-zinc-200">{armasFiltradas.length}</span> de{" "}
                <span className="text-zinc-300">{armas.length}</span> armas
                {filtroArmasAtivo && armasFiltradas.length > 0 && (
                  <span className="text-zinc-500">
                    {" "}
                    — use &quot;Selecionar todos&quot; abaixo para marcar os {armasFiltradas.length} itens visíveis.
                  </span>
                )}
              </div>
            )}
              </div>

              {!loading && armas.length > 0 && (
                <div className="mb-6 flex flex-col gap-3 rounded-xl border border-[#E9B20E]/25 bg-[#E9B20E]/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Banner de promoções na home</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Marca todos os produtos em promoção para o carrossel abaixo de &quot;Explorar catálogo&quot; na
                      página inicial.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={bulkDestaquePromoLoading || bulkMargemLoading || bulkPromoLoading}
                    onClick={destacarTodasPromocoesNaHome}
                    className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
                    style={{ backgroundColor: "#E9B20E" }}
                  >
                    {bulkDestaquePromoLoading ? "Aplicando…" : "Destacar todas as promoções"}
                  </button>
                </div>
              )}

              {!loading && armas.length > 0 && (
                <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-700/60 bg-zinc-950/30 p-5 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-zinc-400">
                      {selectedArmaIds.size} selecionada(s)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedArmaIds(new Set(armasFiltradas.map((a) => a.id)))
                      }
                      disabled={armasFiltradas.length === 0}
                      className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Selecionar{" "}
                      {filtroArmasAtivo
                        ? `todos os ${armasFiltradas.length} filtrados`
                        : `todos (${armasFiltradas.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedArmaIds(new Set())}
                      disabled={selectedArmaIds.size === 0}
                      className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Limpar seleção
                    </button>
                  </div>
                  {selectedArmaIds.size > 0 ? (
                    <div className="flex flex-wrap items-end gap-2 border-t border-zinc-700/60 pt-3 sm:border-l sm:border-t-0 sm:border-zinc-700/60 sm:pl-4 sm:pt-0">
                      <div>
                        <label htmlFor="bulk-margem" className={labelClass}>
                          Novo % de lucro (sobre custo + impostos)
                        </label>
                        <input
                          id="bulk-margem"
                          type="text"
                          inputMode="decimal"
                          value={bulkMargemStr}
                          onChange={(e) => setBulkMargemStr(e.target.value)}
                          className={`${inputClass} w-36`}
                          placeholder="ex.: 10"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={bulkMargemLoading || bulkPromoLoading}
                        onClick={aplicarMargemEmMassa}
                        className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-50"
                        style={{ backgroundColor: "#E9B20E" }}
                      >
                        {bulkMargemLoading ? "Aplicando…" : "Aplicar margem"}
                      </button>
                      <div className="mt-3 flex w-full flex-wrap items-end gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 px-3 py-3 sm:mt-0 sm:ml-2 sm:flex-1">
                        <div className="min-w-[12rem] flex-1">
                          <label htmlFor="bulk-promo-margem" className={labelClass}>
                            % lucro à vista (promoção)
                          </label>
                          <p className="mb-2 text-xs text-zinc-500">
                            Usa o custo de cada variação (sem usar o custo geral). Custo + impostos + este % de lucro; só
                            aplica se ficar menor que o preço de venda.
                          </p>
                          <input
                            id="bulk-promo-margem"
                            type="text"
                            inputMode="decimal"
                            value={bulkPromoMargemStr}
                            onChange={(e) => setBulkPromoMargemStr(e.target.value)}
                            className={`${inputClass} w-36`}
                            placeholder="ex.: 5"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={bulkPromoLoading || bulkMargemLoading}
                          onClick={aplicarPromocaoAvistaEmMassa}
                          className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                        >
                          {bulkPromoLoading ? "Aplicando…" : "Aplicar promo à vista"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {promoAvisos.length > 0 && (
                <div className="mb-6 rounded-xl border border-amber-700/50 bg-amber-950/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-amber-100">Avisos da promoção em massa</p>
                    <button
                      type="button"
                      onClick={() => setPromoAvisos([])}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-amber-200/90 hover:bg-amber-900/40"
                    >
                      Fechar
                    </button>
                  </div>
                  <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-amber-100/90">
                    {promoAvisos.map((texto, i) => (
                      <li key={i}>{texto}</li>
                    ))}
                  </ul>
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 py-20 text-zinc-400">
                  <div
                    className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-600 border-t-[#E9B20E]"
                    aria-hidden
                  />
                  <p className="text-sm">Carregando armas…</p>
                </div>
              ) : armas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 px-6 py-16 text-center">
                  <p className="text-zinc-400">Nenhuma arma cadastrada ainda.</p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Use o botão &quot;Nova arma&quot; acima para incluir o primeiro item.
                  </p>
                </div>
              ) : armasFiltradas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 px-6 py-16 text-center">
                  <p className="text-zinc-400">Nenhuma arma encontrada com os filtros aplicados.</p>
                  <button
                    type="button"
                    onClick={limparFiltros}
                    className="mt-4 text-sm font-medium text-[#E9B20E] underline-offset-2 hover:underline"
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <>
                  {/* Lista em cards — mobile / tablet */}
                  <div className="space-y-4 lg:hidden">
                    {armasFiltradas.map((arma) => {
                      const capa = armaCapaUrl(arma);
                      const extras = armaFotosExtrasCount(arma);
                      return (
                        <div
                          key={arma.id}
                          className="relative overflow-hidden rounded-2xl border border-zinc-700/70 bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-4 shadow-md shadow-black/20"
                        >
                          <div className="absolute right-3 top-3 z-10">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-zinc-500 bg-zinc-900 text-[#E9B20E] focus:ring-[#E9B20E]"
                              checked={selectedArmaIds.has(arma.id)}
                              onChange={() => {
                                setSelectedArmaIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(arma.id)) next.delete(arma.id);
                                  else next.add(arma.id);
                                  return next;
                                });
                              }}
                              aria-label={`Selecionar ${arma.nome || "arma"}`}
                            />
                          </div>
                          <div className="flex gap-4 pr-10">
                            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
                              {capa ? (
                                <img
                                  src={capa}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-600">
                                  Sem foto
                                </div>
                              )}
                              {extras > 0 ? (
                                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
                                  +{extras}
                                </span>
                              ) : null}
                              {arma.em_promocao ? (
                                <span className="absolute left-1 top-1 rounded bg-rose-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                  Promo
                                </span>
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 pr-2 text-base font-semibold leading-snug text-white">
                                {arma.nome || "—"}
                              </h3>
                              <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                                {[arma.categoria?.nome, arma.marca?.nome, arma.calibre?.nome]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold tabular-nums text-[#E9B20E]">
                                  {arma.preco != null
                                    ? `R$ ${arma.preco.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}`
                                    : "—"}
                                </span>
                                {arma.margem_venda_percent != null &&
                                Number.isFinite(Number(arma.margem_venda_percent)) ? (
                                  <button
                                    type="button"
                                    title="Editar (custo e % de lucro)"
                                    onClick={() => openEditModal(arma)}
                                    className="inline-flex rounded-full border border-zinc-600 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-semibold text-[#E9B20E] hover:border-[#E9B20E]/50"
                                  >
                                    {Number(arma.margem_venda_percent).toLocaleString("pt-BR", {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })}
                                    %
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    title="Sem % — editar"
                                    onClick={() => openEditModal(arma)}
                                    className="rounded-full border border-dashed border-zinc-600 px-2 py-0.5 text-[11px] text-zinc-500"
                                  >
                                    % —
                                  </button>
                                )}
                                {arma.em_destaque ? (
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                    style={{
                                      backgroundColor: "rgba(233, 178, 14, 0.2)",
                                      color: "#E9B20E",
                                    }}
                                  >
                                    ★ Destaque
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-3 flex gap-2 border-t border-zinc-800/80 pt-3">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(arma)}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-600 py-2 text-sm font-medium text-[#E9B20E] hover:bg-zinc-800/80"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm(arma.id)}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-900/40 py-2 text-sm font-medium text-red-400 hover:bg-red-950/30"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Excluir
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tabela — desktop */}
                  <div className="hidden overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-950/40 shadow-inner lg:block">
                    <div className="max-h-[min(70vh,52rem)] overflow-auto">
                      <table className="w-full min-w-[860px] border-collapse text-left">
                        <thead className="sticky top-0 z-10 border-b border-zinc-700/80 bg-zinc-950/95 backdrop-blur-sm">
                          <tr>
                            <th className="w-12 px-3 py-3.5 text-center">
                              <input
                                ref={headerSelectRef}
                                type="checkbox"
                                className="h-4 w-4 rounded border-zinc-500 bg-zinc-900 text-[#E9B20E] focus:ring-[#E9B20E]"
                                checked={
                                  armasFiltradas.length > 0 &&
                                  selectedVisibleCount === armasFiltradas.length
                                }
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedArmaIds((prev) => {
                                    const next = new Set(prev);
                                    const ids = armasFiltradas.map((a) => a.id);
                                    if (checked) ids.forEach((id) => next.add(id));
                                    else ids.forEach((id) => next.delete(id));
                                    return next;
                                  });
                                }}
                                title="Selecionar ou limpar todas as linhas visíveis (respeita filtros)"
                              />
                            </th>
                            <th className="w-[88px] px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              Capa
                            </th>
                            <th className="min-w-[200px] px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              Produto
                            </th>
                            <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              Categoria
                            </th>
                            <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              Marca
                            </th>
                            <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              Calibre
                            </th>
                            <th className="px-3 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              Preço
                            </th>
                            <th className="w-24 px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              % Lucro
                            </th>
                            <th className="w-28 px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              Destaque
                            </th>
                            <th className="w-[100px] px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {armasFiltradas.map((arma) => {
                            const capa = armaCapaUrl(arma);
                            const extras = armaFotosExtrasCount(arma);
                            return (
                              <tr
                                key={arma.id}
                                className="border-b border-zinc-800/80 transition-colors hover:bg-zinc-800/25"
                              >
                                <td className="px-3 py-3 align-middle text-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-zinc-500 bg-zinc-900 text-[#E9B20E] focus:ring-[#E9B20E]"
                                    checked={selectedArmaIds.has(arma.id)}
                                    onChange={() => {
                                      setSelectedArmaIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(arma.id)) next.delete(arma.id);
                                        else next.add(arma.id);
                                        return next;
                                      });
                                    }}
                                    aria-label={`Selecionar ${arma.nome || "arma"}`}
                                  />
                                </td>
                                <td className="px-3 py-3 align-middle">
                                  <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
                                    {capa ? (
                                      <img src={capa} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[9px] text-zinc-600">
                                        —
                                      </div>
                                    )}
                                    {extras > 0 ? (
                                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[9px] font-medium text-zinc-200">
                                        +{extras}
                                      </span>
                                    ) : null}
                                    {arma.em_promocao ? (
                                      <span className="absolute left-0.5 top-0.5 rounded bg-rose-600/90 px-1 text-[8px] font-bold uppercase leading-none text-white">
                                        P
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-3 align-middle">
                                  <span className="line-clamp-2 font-medium text-zinc-100">{arma.nome || "—"}</span>
                                </td>
                                <td className="max-w-[140px] px-3 py-3 align-middle">
                                  <span className="line-clamp-2 text-sm text-zinc-400">
                                    {arma.categoria?.nome || "—"}
                                  </span>
                                </td>
                                <td className="max-w-[120px] px-3 py-3 align-middle">
                                  <span className="line-clamp-2 text-sm text-zinc-400">{arma.marca?.nome || "—"}</span>
                                </td>
                                <td className="max-w-[120px] px-3 py-3 align-middle">
                                  <span className="line-clamp-2 text-sm text-zinc-400">{arma.calibre?.nome || "—"}</span>
                                </td>
                                <td className="px-3 py-3 align-middle">
                                  <span className="text-sm font-semibold tabular-nums text-[#E9B20E]">
                                    {arma.preco != null
                                      ? `R$ ${arma.preco.toLocaleString("pt-BR", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}`
                                      : "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-3 align-middle text-center">
                                  {arma.margem_venda_percent != null &&
                                  Number.isFinite(Number(arma.margem_venda_percent)) ? (
                                    <button
                                      type="button"
                                      title="Editar produto (custo e % de lucro no formulário)"
                                      onClick={() => openEditModal(arma)}
                                      className="inline-flex min-w-[3.25rem] justify-center rounded-full border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-xs font-semibold text-[#E9B20E] transition-colors hover:border-[#E9B20E]/60 hover:bg-zinc-700"
                                    >
                                      {Number(arma.margem_venda_percent).toLocaleString("pt-BR", {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 4,
                                      })}
                                      %
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      title="Sem % cadastrado — clique para editar"
                                      onClick={() => openEditModal(arma)}
                                      className="rounded-full border border-dashed border-zinc-600 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-400"
                                    >
                                      —
                                    </button>
                                  )}
                                </td>
                                <td className="px-3 py-3 align-middle text-center">
                                  {arma.em_destaque ? (
                                    <span
                                      className="inline-flex rounded-full px-2 py-1 text-[11px] font-medium"
                                      style={{
                                        backgroundColor: "rgba(233, 178, 14, 0.2)",
                                        color: "#E9B20E",
                                      }}
                                    >
                                      ★ Sim
                                    </span>
                                  ) : (
                                    <span className="text-xs text-zinc-600">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-3 align-middle">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(arma)}
                                      className="rounded-lg p-2 text-[#E9B20E] transition-colors hover:bg-zinc-800"
                                      title="Editar"
                                    >
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
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                        />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirm(arma.id)}
                                      className="rounded-lg p-2 text-red-400 transition-colors hover:bg-zinc-800"
                                      title="Excluir"
                                    >
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
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal de Cadastro/Edição */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-600/60 bg-gradient-to-b from-zinc-900 to-zinc-950 p-8 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-8 flex items-start justify-between gap-4 border-b border-zinc-800 pb-6">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#E9B20E]/90">
                  Catálogo
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {editingId ? "Editar arma" : "Nova arma"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Preencha os blocos abaixo. A imagem em destaque é a <span className="text-zinc-200">foto principal</span>{" "}
                  (capa do produto); fotos extras ficam na faixa menor embaixo.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 rounded-xl p-2.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                aria-label="Fechar"
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

            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Dados gerais */}
              <section className="rounded-2xl border border-zinc-700/50 bg-zinc-900/40 p-8 shadow-inner">
                <h3 className="mb-2 text-lg font-semibold text-white">Dados gerais</h3>
                <p className="mb-8 text-sm text-zinc-500">
                  Identificação do produto e imagem de capa. Você pode enviar várias imagens; só a principal aparece em destaque.
                </p>

                <div className="space-y-10">
                  <div className="grid gap-8 lg:grid-cols-2">
                    <div className="space-y-6">
                      <div>
                        <label htmlFor="categoria_id" className={labelClass}>
                          Categoria
                        </label>
                        <select
                          id="categoria_id"
                          name="categoria_id"
                          value={form.categoria_id}
                          onChange={handleChange}
                          className={inputClass}
                        >
                          <option value="">Selecione</option>
                          {categorias.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="nome" className={labelClass}>
                          Nome
                        </label>
                        <input
                          id="nome"
                          name="nome"
                          type="text"
                          value={form.nome}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="Nome da arma"
                        />
                      </div>
                      <div className="rounded-xl border border-zinc-700/40 bg-zinc-950/50 p-4">
                        <div className="flex items-start gap-3">
                          <input
                            id="comVariacao"
                            type="checkbox"
                            checked={comVariacao}
                            onChange={(e) => {
                              setComVariacao(e.target.checked);
                              if (!e.target.checked) setVariacoes([]);
                              else if (variacoes.length === 0) addVariacao();
                            }}
                            className="mt-0.5 h-5 w-5 shrink-0 rounded border-zinc-600 bg-zinc-800/50 text-[#E9B20E] focus:ring-1 focus:ring-[#E9B20E]"
                          />
                          <label htmlFor="comVariacao" className="cursor-pointer text-sm leading-relaxed text-zinc-300">
                            <span className="font-medium text-zinc-200">Produto com variação</span> — calibre, tamanho de
                            cano e preço por opção. Com isso ativo, use a seção Variações para fotos por cano.
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Foto principal + extras */}
                    <div className="space-y-5">
                      <div>
                        <span className={labelClass}>Foto principal (capa)</span>
                        <p className="mb-3 text-xs text-zinc-500">
                          {!comVariacao && editingId && "Inclua novas imagens abaixo; a capa continua sendo a primeira da lista."}
                          {comVariacao &&
                            "Imagens gerais do produto; fotos específicas de cada cano ficam em Variações."}
                        </p>
                        <div className="relative overflow-hidden rounded-2xl border border-zinc-600/70 bg-zinc-950 ring-1 ring-black/20">
                          {armaPrincipalUrl ? (
                            <>
                              <div className="aspect-[4/3] w-full max-h-[min(280px,40vh)] sm:max-h-[320px]">
                                <img
                                  src={armaPrincipalUrl}
                                  alt="Foto principal do produto"
                                  className="h-full w-full object-contain bg-zinc-950"
                                />
                              </div>
                              <div className="absolute left-3 top-3 rounded-md bg-[#E9B20E] px-2.5 py-1 text-xs font-bold text-zinc-900 shadow">
                                Principal
                              </div>
                              <div className="absolute bottom-3 right-3 flex gap-2">
                                {fotosExistentesSorted[0] ? (
                                  <button
                                    type="button"
                                    onClick={() => removeFotoExistente(fotosExistentesSorted[0].id)}
                                    className="rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-red-500"
                                  >
                                    Remover capa
                                  </button>
                                ) : fotoPreviews.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => removeFoto(0)}
                                    className="rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-red-500"
                                  >
                                    Remover
                                  </button>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <div className="flex aspect-[4/3] max-h-[min(220px,35vh)] w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-700 bg-zinc-900/50 p-6 text-center sm:max-h-[280px]">
                              <svg
                                className="h-10 w-10 text-zinc-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <p className="text-sm text-zinc-500">Nenhuma imagem ainda</p>
                              <p className="text-xs text-zinc-600">Envie arquivos abaixo — a primeira vira a capa</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="foto" className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Adicionar imagens
                        </label>
                        <input
                          id="foto"
                          name="foto"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFotoChange}
                          className={`mt-2 ${fileInputClass}`}
                        />
                      </div>

                      {(armaExtrasExistentes.length > 0 || armaExtrasPreviewsIndices.length > 0) && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Outras fotos ({armaExtrasExistentes.length + armaExtrasPreviewsIndices.length})
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {armaExtrasExistentes.map((foto) => (
                              <div key={foto.id} className="group relative w-[4.5rem] shrink-0">
                                <img
                                  src={foto.foto_url}
                                  alt=""
                                  className="aspect-square w-full rounded-lg border border-zinc-700 object-cover"
                                />
                                <div className="absolute inset-0 flex items-start justify-end gap-0.5 rounded-lg bg-black/30 p-1 sm:bg-black/0 sm:opacity-0 sm:transition-opacity sm:group-hover:bg-black/40 sm:group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => definirFotoExistenteComoCapa(foto.id)}
                                    className="rounded-md bg-[#E9B20E] p-1 text-zinc-900 shadow hover:bg-[#D4A00D]"
                                    title="Tornar principal"
                                  >
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeFotoExistente(foto.id)}
                                    className="rounded-md bg-red-600 p-1 text-white hover:bg-red-500"
                                    title="Remover"
                                  >
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                            {armaExtrasPreviewsIndices.map(({ url, i }) => (
                              <div key={`p-${i}`} className="group relative w-[4.5rem] shrink-0">
                                <img
                                  src={url}
                                  alt=""
                                  className="aspect-square w-full rounded-lg border border-zinc-700 object-cover"
                                />
                                <div className="absolute inset-0 flex items-start justify-end gap-0.5 rounded-lg bg-black/30 p-1 sm:bg-black/0 sm:opacity-0 sm:transition-opacity sm:group-hover:bg-black/40 sm:group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => definirFotoNovaComoCapa(i)}
                                    className="rounded-md bg-[#E9B20E] p-1 text-zinc-900 shadow hover:bg-[#D4A00D]"
                                    title="Tornar principal"
                                  >
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeFoto(i)}
                                    className="rounded-md bg-red-600 p-1 text-white hover:bg-red-500"
                                    title="Remover"
                                  >
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="mt-3 text-xs text-zinc-600">
                            Passe o mouse nos quadradinhos para trocar a capa ou excluir. A primeira foto da lista é a que aparece no catálogo.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-600/80 bg-zinc-800/20 p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-200">Custo, impostos e lucro</p>
                      <button
                        type="button"
                        onClick={restaurarImpostosPadraoCatalogo}
                        className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
                        title={`Restaurar ${tributacao.nomeSimples} ${tributacao.pctSimplesStr}% e ${tributacao.nomeDifal} ${tributacao.pctDifalStr}% da aba Configurações`}
                      >
                        Usar impostos padrão do catálogo
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Os impostos são aplicados <strong className="text-zinc-300">em sequência</strong> sobre o
                      custo deste produto. Você pode ajustar os percentuais abaixo sem alterar a configuração
                      global. O lucro (%) incide sobre <strong className="text-zinc-300">custo + impostos</strong>.
                      {comVariacao && (
                        <>
                          {" "}
                          Com <strong className="text-zinc-300">variações</strong>, cada opção pode ter{" "}
                          <strong className="text-zinc-300">custo próprio</strong> no cartão abaixo; impostos e % de
                          lucro deste bloco valem para todas.
                        </>
                      )}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="preco_custo" className={labelClass}>
                          Preço de custo (R$) {comVariacao && <span className="font-normal text-zinc-500">— geral da arma</span>}
                        </label>
                        <input
                          id="preco_custo"
                          name="preco_custo"
                          type="text"
                          inputMode="decimal"
                          value={form.preco_custo}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="0,00"
                        />
                      </div>
                      <div>
                        <label htmlFor="margem_venda_percent" className={labelClass}>
                          % de lucro sobre custo + impostos
                        </label>
                        <input
                          id="margem_venda_percent"
                          name="margem_venda_percent"
                          type="text"
                          inputMode="decimal"
                          value={form.margem_venda_percent}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="ex.: 8"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-lg border border-zinc-700/60 bg-zinc-900/30 p-4 sm:grid-cols-2">
                      <p className="col-span-full text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Impostos deste produto
                      </p>
                      <div>
                        <label htmlFor="imposto_simples_percent" className={labelClass}>
                          {tributacao.nomeSimples} (% sobre o custo)
                        </label>
                        <input
                          id="imposto_simples_percent"
                          name="imposto_simples_percent"
                          type="text"
                          inputMode="decimal"
                          value={form.imposto_simples_percent}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="difal_percent" className={labelClass}>
                          {tributacao.nomeDifal} (% sobre o subtotal)
                        </label>
                        <input
                          id="difal_percent"
                          name="difal_percent"
                          type="text"
                          inputMode="decimal"
                          value={form.difal_percent}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {mostrarBlocoPrecificacao ? (
                      <div className="space-y-3 rounded-md border border-zinc-600/60 bg-zinc-900/40 px-3 py-3">
                        {custoParsedModal != null && custoParsedModal >= 0 && impostosProdutoValidos ? (
                          <div className="space-y-1.5 border-b border-zinc-700/80 pb-3 text-xs">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                              Composição do preço (custo geral)
                            </p>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-zinc-400">
                              <span>Custo</span>
                              <span className="font-medium text-zinc-200">
                                R$ {formatPrecoBr(custoParsedModal)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-zinc-400">
                              <span>
                                + {tributacao.nomeSimples} ({pctSimplesModal.toLocaleString("pt-BR")}%)
                              </span>
                              <span className="font-medium text-amber-200/90">
                                + R$ {formatPrecoBr(valorImpostoSimplesModal ?? 0)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-zinc-400">
                              <span>
                                + {tributacao.nomeDifal} ({pctDifalModal.toLocaleString("pt-BR")}%)
                              </span>
                              <span className="font-medium text-amber-200/90">
                                + R$ {formatPrecoBr(valorImpostoDifalModal ?? 0)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-zinc-700/60 pt-1.5 text-zinc-300">
                              <span>= Custo com impostos</span>
                              <span className="font-semibold text-zinc-100">
                                R${" "}
                                {custoComImpostosSequencial(
                                  custoParsedModal,
                                  pctSimplesModal,
                                  pctDifalModal
                                ).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                            {precificacaoModal != null ? (
                              <>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-zinc-400">
                                  <span>
                                    + Lucro ({margemParsedModal!.toLocaleString("pt-BR")}%)
                                  </span>
                                  <span className="font-medium text-emerald-300/90">
                                    + R$ {formatPrecoBr(valorLucroModal ?? 0)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-zinc-400">
                                  <span>Valor bruto (antes do arredondamento)</span>
                                  <span className="font-medium text-zinc-200">
                                    R${" "}
                                    {precificacaoModal.valorBrutoComLucro.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <p className="pt-1 text-zinc-500">
                                Informe o <strong className="text-zinc-300">% de lucro</strong> para ver o valor
                                final sugerido.
                              </p>
                            )}
                          </div>
                        ) : null}
                        {precificacaoModal != null ? (
                          <>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm text-zinc-300">
                                Preço sugerido (arred., custo geral):{" "}
                                <span className="font-semibold text-[#E9B20E]">
                                  R${" "}
                                  {precificacaoModal.precoSugerido.toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </p>
                              {!comVariacao ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-900"
                                    style={{ backgroundColor: "#E9B20E" }}
                                    onClick={() =>
                                      setForm((p) => ({
                                        ...p,
                                        preco: precificacaoModal.precoSugerido.toLocaleString("pt-BR", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }),
                                      }))
                                    }
                                  >
                                    Aplicar ao preço de venda
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </>
                        ) : custoParsedModal == null || custoParsedModal < 0 ? (
                          <p className="text-xs text-zinc-500">
                            Informe o <strong className="text-zinc-300">custo geral</strong> para ver a composição
                            com impostos. Cada variação pode ter custo próprio nos cartões abaixo.
                          </p>
                        ) : !impostosProdutoValidos ? (
                          <p className="text-xs text-red-400/90">
                            Informe percentuais válidos (≥ 0) para os impostos deste produto.
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-500">
                            Informe o <strong className="text-zinc-300">% de lucro</strong> para calcular o preço
                            sugerido. Cada variação pode ter custo próprio nos cartões abaixo.
                          </p>
                        )}
                        {comVariacao && variacoes.length > 0 ? (
                          <div className="flex flex-wrap gap-2 border-t border-zinc-700/80 pt-2">
                            <button
                              type="button"
                              disabled={!podeAplicarCustoGeralVariacoes}
                              className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                              title="Copia o custo geral para o campo de custo de cada variação"
                              onClick={aplicarCustoGeralEmTodasVariacoes}
                            >
                              Aplicar custo geral em todas as variações
                            </button>
                            {podeUsarMargemVariacoes ? (
                              <button
                                type="button"
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-900"
                                style={{ backgroundColor: "#E9B20E" }}
                                onClick={() => {
                                  setVariacoes((prev) =>
                                    prev.map((v) => {
                                      const sug = precoSugeridoParaVariacao(v);
                                      if (sug == null) return v;
                                      return { ...v, preco: formatPrecoBr(sug) };
                                    })
                                  );
                                }}
                              >
                                Aplicar sugerido em todas as variações
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {!comVariacao && (
                    <div className="rounded-xl border border-zinc-700/40 bg-zinc-950/30 p-5">
                      <label htmlFor="preco" className={labelClass}>
                        Preço (R$)
                      </label>
                      <input
                        id="preco"
                        name="preco"
                        type="text"
                        value={form.preco}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="0,00"
                      />
                    </div>
                  )}
                  <div className="rounded-xl border border-zinc-700/40 bg-zinc-950/25 p-5">
                    <div className="flex items-center gap-3">
                      <input
                        id="em_destaque"
                        name="em_destaque"
                        type="checkbox"
                        checked={form.em_destaque}
                        onChange={handleChange}
                        className="h-5 w-5 rounded border-zinc-600 bg-zinc-800/50 text-[#E9B20E] focus:ring-1 focus:ring-[#E9B20E]"
                      />
                      <label htmlFor="em_destaque" className="cursor-pointer text-sm font-medium text-zinc-300">
                        Marcar como destaque
                      </label>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-600/80 bg-zinc-800/20 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <input
                        id="em_promocao"
                        name="em_promocao"
                        type="checkbox"
                        checked={form.em_promocao}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setForm((prev) => ({
                            ...prev,
                            em_promocao: checked,
                            ...(!checked ? { destaque_promocao: false, preco_promocional: "" } : {}),
                          }));
                          if (!checked && comVariacao) {
                            setVariacoes((prev) =>
                              prev.map((v) => ({ ...v, preco_promocional: "" }))
                            );
                          }
                          setMessage(null);
                        }}
                        className="h-5 w-5 rounded border-zinc-600 bg-zinc-800/50 text-[#E9B20E] focus:ring-1 focus:ring-[#E9B20E]"
                      />
                      <label htmlFor="em_promocao" className="text-sm font-medium text-zinc-300 cursor-pointer">
                        Promoção ativa
                      </label>
                    </div>
                    {form.em_promocao && (
                      <>
                        <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-4 space-y-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-200">Promoção à vista</p>
                            <p className="mt-1 text-xs text-zinc-500">
                              Calcula sobre custo + impostos deste produto. O valor pode ser ajustado manualmente
                              depois. Válido somente para pagamento à vista.
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label htmlFor="margem_promocao_percent" className={labelClass}>
                                % de lucro promocional (à vista)
                              </label>
                              <input
                                id="margem_promocao_percent"
                                name="margem_promocao_percent"
                                type="text"
                                inputMode="decimal"
                                value={form.margem_promocao_percent}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="ex.: 5"
                              />
                            </div>
                            <div>
                              <label htmlFor="preco_promocional" className={labelClass}>
                                Preço promocional à vista (R$)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  id="preco_promocional"
                                  name="preco_promocional"
                                  type="text"
                                  inputMode="decimal"
                                  value={form.preco_promocional}
                                  onChange={handleChange}
                                  className={inputClass}
                                  placeholder="0,00"
                                />
                                {!comVariacao ? (
                                  <button
                                    type="button"
                                    onClick={aplicarPromoSugeridaProduto}
                                    disabled={precoPromoSugeridoProduto() == null}
                                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                                    title="Usa custo + impostos + % de lucro promocional"
                                  >
                                    Calcular
                                  </button>
                                ) : null}
                              </div>
                              {comVariacao && variacoes.length > 0 ? (
                                <p className="mt-1 text-xs text-zinc-500">
                                  Na listagem, usa o menor valor entre as variações abaixo.
                                </p>
                              ) : null}
                            </div>
                          </div>
                          {comVariacao && variacoes.length > 0 ? (
                            <button
                              type="button"
                              onClick={aplicarPromoSugeridaTodasVariacoes}
                              disabled={margemPromoParsed == null || margemPromoParsed < 0}
                              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Calcular promo em todas as variações
                            </button>
                          ) : null}
                        </div>
                        {comVariacao && resumoPromoVariacoes.length > 0 ? (
                          <div className="overflow-x-auto rounded-lg border border-zinc-700/60">
                            <table className="w-full min-w-[420px] text-left text-sm">
                              <thead className="border-b border-zinc-700/80 bg-zinc-950/50 text-xs uppercase tracking-wide text-zinc-500">
                                <tr>
                                  <th className="px-3 py-2 font-medium">Variação</th>
                                  <th className="px-3 py-2 font-medium">Venda</th>
                                  <th className="px-3 py-2 font-medium">Promo à vista (R$)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-800/80">
                                {resumoPromoVariacoes.map((row) => (
                                  <tr key={row.idx} className="text-zinc-300">
                                    <td className="px-3 py-2">{row.rotulo}</td>
                                    <td className="px-3 py-2 tabular-nums text-zinc-400">
                                      {row.precoVenda != null
                                        ? `R$ ${formatPrecoBr(row.precoVenda)}`
                                        : "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={variacoes[row.idx]?.preco_promocional ?? ""}
                                        onChange={(e) =>
                                          updateVariacao(row.idx, "preco_promocional", e.target.value)
                                        }
                                        className={`${inputClass} min-w-[7rem] py-1.5 text-sm`}
                                        placeholder="0,00"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                        <fieldset className="space-y-2">
                          <legend className={`${labelClass} mb-2`}>Texto na vitrine</legend>
                          <p className="mb-2 text-xs text-zinc-500">
                            Define o que aparece junto ao preço promocional. O parcelamento na loja usa sempre o preço
                            normal.
                          </p>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                              <input
                                type="radio"
                                name="promocao_modo"
                                value="avista"
                                checked={form.promocao_modo === "avista"}
                                onChange={handleChange}
                                className="h-4 w-4 border-zinc-600 text-[#E9B20E] focus:ring-[#E9B20E]"
                              />
                              Promoção à vista
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                              <input
                                type="radio"
                                name="promocao_modo"
                                value="parcelado"
                                checked={form.promocao_modo === "parcelado"}
                                onChange={handleChange}
                                className="h-4 w-4 border-zinc-600 text-[#E9B20E] focus:ring-[#E9B20E]"
                              />
                              Anunciar parcelamento (até X vezes)
                            </label>
                          </div>
                        </fieldset>
                        {form.promocao_modo === "parcelado" && (
                          <div>
                            <label htmlFor="promocao_parcelas_max" className={labelClass}>
                              Máximo de parcelas
                            </label>
                            <input
                              id="promocao_parcelas_max"
                              name="promocao_parcelas_max"
                              type="number"
                              min={2}
                              max={48}
                              value={form.promocao_parcelas_max}
                              onChange={handleChange}
                              className={inputClass}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <input
                            id="destaque_promocao"
                            name="destaque_promocao"
                            type="checkbox"
                            checked={form.destaque_promocao}
                            onChange={handleChange}
                            disabled={!form.em_promocao}
                            className="h-5 w-5 rounded border-zinc-600 bg-zinc-800/50 text-[#E9B20E] focus:ring-1 focus:ring-[#E9B20E] disabled:opacity-40"
                          />
                          <label htmlFor="destaque_promocao" className="text-sm font-medium text-zinc-300 cursor-pointer">
                            Banner de promoção na página inicial (abaixo de Explorar catálogo)
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Variações (calibre + cano + preço + fotos por opção) */}
              {comVariacao && (
                <section className="rounded-2xl border border-zinc-700/50 bg-zinc-900/40 p-8 shadow-inner">
                  <div className="mb-6 flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Variações</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Calibre, cano, valores e foto principal por opção.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!podeAplicarCustoGeralVariacoes}
                        onClick={aplicarCustoGeralEmTodasVariacoes}
                        className="shrink-0 rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Usa o preço de custo geral do bloco Custo, impostos e lucro"
                      >
                        Aplicar custo geral em todas
                      </button>
                      <button
                        type="button"
                        onClick={addVariacao}
                        className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
                        style={{ backgroundColor: "#E9B20E", color: "#030711" }}
                      >
                        + Adicionar variação
                      </button>
                    </div>
                  </div>
                  <div className="space-y-8">
                    {variacoes.map((v, idx) => {
                      const vExSorted = [...(v.fotosExistentes || [])].sort((a, b) => a.ordem - b.ordem);
                      const vPr = v.fotoPreviews || [];
                      const vPrincipalUrl = vExSorted[0]?.foto_url ?? vPr[0] ?? null;
                      const vExtrasEx = vExSorted.length > 0 ? vExSorted.slice(1) : [];
                      const vExtrasPr =
                        vExSorted.length > 0
                          ? vPr.map((url, i) => ({ url, i }))
                          : vPr.slice(1).map((url, j) => ({ url, i: j + 1 }));
                      const vHasExtras = vExtrasEx.length > 0 || vExtrasPr.length > 0;

                      return (
                      <div
                        key={idx}
                        className="rounded-2xl border border-zinc-600/60 bg-zinc-950/40 p-6 shadow-sm"
                      >
                        <div className="mb-6 flex items-center justify-between border-b border-zinc-800/80 pb-4">
                          <span className="text-sm font-semibold text-zinc-200">Variação {idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeVariacao(idx)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/15"
                          >
                            Remover
                          </button>
                        </div>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <label className={labelClass}>Calibre</label>
                            <select
                              value={v.calibre_id}
                              onChange={(e) => updateVariacao(idx, "calibre_id", e.target.value)}
                              className={inputClass}
                            >
                              <option value="">Selecione</option>
                              {calibres.map((c) => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Comprimento do cano</label>
                            <input
                              type="text"
                              value={v.comprimento_cano}
                              onChange={(e) => updateVariacao(idx, "comprimento_cano", e.target.value)}
                              className={inputClass}
                              placeholder="Ex.: 4 pol."
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Custo (R$) desta variação</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={v.preco_custo}
                              onChange={(e) => updateVariacao(idx, "preco_custo", e.target.value)}
                              className={inputClass}
                              placeholder="opcional"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Preço de venda (R$)</label>
                            <input
                              type="text"
                              value={v.preco}
                              onChange={(e) => updateVariacao(idx, "preco", e.target.value)}
                              className={inputClass}
                              placeholder="0,00"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>
                              Preço promocional (R$)
                              {!form.em_promocao ? (
                                <span className="ml-1 font-normal text-zinc-500">(ative a promoção)</span>
                              ) : null}
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={v.preco_promocional}
                              onChange={(e) =>
                                updateVariacao(idx, "preco_promocional", e.target.value)
                              }
                              disabled={!form.em_promocao}
                              readOnly={!form.em_promocao}
                              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
                              placeholder={form.em_promocao ? "0,00" : "—"}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Acabamento</label>
                            <input
                              type="text"
                              value={v.caracteristica_acabamento}
                              onChange={(e) => updateVariacao(idx, "caracteristica_acabamento", e.target.value)}
                              className={inputClass}
                              placeholder="Ex.: fosco, niquelado"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={precoPromoSugeridoVariacao(v) == null}
                            title="Usa o custo desta variação (ou geral) + impostos + % de lucro promocional"
                            className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-900/50 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              const sug = precoPromoSugeridoVariacao(v);
                              if (sug == null) return;
                              const precoVenda = parsePreco(v.preco);
                              if (precoVenda != null && sug >= precoVenda) {
                                setMessage({
                                  type: "error",
                                  text: `Variação ${idx + 1}: promo calculada não ficou menor que o preço de venda.`,
                                });
                                return;
                              }
                              updateVariacao(idx, "preco_promocional", formatPrecoBr(sug));
                              setMessage(null);
                            }}
                          >
                            Calcular promo
                          </button>
                          <button
                            type="button"
                            disabled={precoSugeridoParaVariacao(v) == null}
                            title="Usa o custo desta linha (ou o custo geral) e o % de lucro do bloco Custo, impostos e lucro"
                            className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              const sug = precoSugeridoParaVariacao(v);
                              if (sug == null) return;
                              updateVariacao(idx, "preco", formatPrecoBr(sug));
                            }}
                          >
                            Aplicar sugerido
                          </button>
                          <button
                            type="button"
                            disabled={parsePreco(v.preco_custo) == null}
                            title="Copia o custo desta variação para o campo de preço de venda (sem impostos nem lucro)"
                            className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              const c = parsePreco(v.preco_custo);
                              if (c == null) return;
                              updateVariacao(idx, "preco", formatPrecoBr(c));
                            }}
                          >
                            Preço = custo (variação)
                          </button>
                          <button
                            type="button"
                            disabled={!String(form.preco_custo).trim()}
                            title="Preenche o custo desta linha com o valor do custo geral da arma"
                            className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => updateVariacao(idx, "preco_custo", form.preco_custo)}
                          >
                            Usar custo geral
                          </button>
                        </div>
                        <div className="mt-8 border-t border-zinc-800/80 pt-6">
                          <label className={labelClass}>Foto principal desta variação</label>
                          <p className="mb-3 text-xs text-zinc-500">
                            A primeira imagem é a capa deste cano no catálogo. Outras ficam na faixa abaixo.
                          </p>
                          <div className="relative mb-4 overflow-hidden rounded-xl border border-zinc-600/70 bg-zinc-950">
                            {vPrincipalUrl ? (
                              <>
                                <div className="aspect-[5/3] w-full max-h-[200px]">
                                  <img
                                    src={vPrincipalUrl}
                                    alt=""
                                    className="h-full w-full object-contain bg-zinc-950"
                                  />
                                </div>
                                <div className="absolute left-2 top-2 rounded bg-[#E9B20E] px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-900">
                                  Principal
                                </div>
                                <div className="absolute bottom-2 right-2">
                                  {vExSorted[0] ? (
                                    <button
                                      type="button"
                                      onClick={() => removeVariacaoFotoExistente(idx, vExSorted[0].id)}
                                      className="rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
                                    >
                                      Remover
                                    </button>
                                  ) : vPr.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => removeVariacaoFoto(idx, 0)}
                                      className="rounded-lg bg-red-600/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500"
                                    >
                                      Remover
                                    </button>
                                  ) : null}
                                </div>
                              </>
                            ) : (
                              <div className="flex aspect-[5/3] max-h-[160px] items-center justify-center border-2 border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-center text-xs text-zinc-500">
                                Sem foto — envie imagens abaixo
                              </div>
                            )}
                          </div>
                          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Adicionar imagens
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleVariacaoFotoChange(idx, e)}
                            className={`mt-2 ${fileInputClass}`}
                          />
                          {vHasExtras && (
                            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                Outras fotos ({vExtrasEx.length + vExtrasPr.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {vExtrasEx.map((f) => (
                                  <div key={f.id} className="relative h-16 w-16 shrink-0">
                                    <img src={f.foto_url} alt="" className="h-full w-full rounded-lg border border-zinc-700 object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => removeVariacaoFotoExistente(idx, f.id)}
                                      className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white shadow hover:bg-red-500"
                                      title="Remover"
                                    >
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                ))}
                                {vExtrasPr.map(({ url, i }) => (
                                  <div key={`pv-${i}`} className="relative h-16 w-16 shrink-0">
                                    <img src={url} alt="" className="h-full w-full rounded-lg border border-zinc-700 object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => removeVariacaoFoto(idx, i)}
                                      className="absolute -right-1 -top-1 rounded-full bg-red-600 p-0.5 text-white shadow hover:bg-red-500"
                                      title="Remover"
                                    >
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Especificações */}
              <section className="rounded-2xl border border-zinc-700/50 bg-zinc-900/40 p-8 shadow-inner">
                <h3 className="mb-2 text-lg font-semibold text-white">Especificações</h3>
                <p className="mb-8 text-sm text-zinc-500">
                  Dados técnicos exibidos na ficha do produto.
                </p>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="calibre_id" className={labelClass}>
                      Calibre
                    </label>
                    <select
                      id="calibre_id"
                      name="calibre_id"
                      value={form.calibre_id}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="">Selecione</option>
                      {calibres.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="funcionamento_id" className={labelClass}>
                      Tipo de funcionamento
                    </label>
                    <select
                      id="funcionamento_id"
                      name="funcionamento_id"
                      value={form.funcionamento_id}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="">Selecione</option>
                      {funcionamentos.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="espec_capacidade_tiros" className={labelClass}>
                      Capacidade de tiros
                    </label>
                    <input
                      id="espec_capacidade_tiros"
                      name="espec_capacidade_tiros"
                      type="text"
                      value={form.espec_capacidade_tiros}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Ex.: 15+1"
                    />
                  </div>
                  <div>
                    <label htmlFor="espec_carregadores" className={labelClass}>
                      Carregadores
                    </label>
                    <input
                      id="espec_carregadores"
                      name="espec_carregadores"
                      type="text"
                      value={form.espec_carregadores}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Ex.: 2"
                    />
                  </div>
                  <div>
                    <label htmlFor="marca_id" className={labelClass}>
                      Marca da arma
                    </label>
                    <select
                      id="marca_id"
                      name="marca_id"
                      value={form.marca_id}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="">Selecione</option>
                      {marcas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="espec_comprimento_cano" className={labelClass}>
                      Comprimento do cano
                    </label>
                    <input
                      id="espec_comprimento_cano"
                      name="espec_comprimento_cano"
                      type="text"
                      value={form.espec_comprimento_cano}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Ex.: 4 pol."
                    />
                  </div>
                  <div>
                    <label htmlFor="caracteristica_acabamento" className={labelClass}>
                      Acabamento
                    </label>
                    <input
                      id="caracteristica_acabamento"
                      name="caracteristica_acabamento"
                      type="text"
                      value={form.caracteristica_acabamento}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Ex.: fosco, cromado"
                    />
                  </div>
                </div>
              </section>

              {message && (
                <div
                  className={`rounded-lg px-4 py-3 text-sm ${
                    message.type === "ok"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-zinc-800 pt-8 sm:flex-row sm:gap-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border-2 px-6 py-3.5 text-sm font-medium transition-colors hover:bg-zinc-800/50 sm:text-base"
                  style={{
                    borderColor: "#E9B20E",
                    color: "#E9B20E",
                    backgroundColor: "transparent",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 rounded-xl px-6 py-3.5 text-base font-bold text-zinc-900 shadow-lg shadow-[#E9B20E]/10 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: "#E9B20E" }}
                >
                  {submitLoading
                    ? editingId
                      ? "Salvando..."
                      : "Cadastrando..."
                    : editingId
                    ? "Salvar"
                    : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="relative w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-xl font-bold text-white">
              Confirmar Exclusão
            </h3>
            <p className="mb-6 text-zinc-300">
              Tem certeza que deseja excluir esta arma? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-lg border-2 px-4 py-2 font-medium transition-colors"
                style={{
                  borderColor: "#E9B20E",
                  color: "#E9B20E",
                  backgroundColor: "transparent",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deletingId === deleteConfirm}
                className="flex-1 rounded-lg px-4 py-2 font-bold text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "#dc2626" }}
                onMouseEnter={(e) => {
                  if (deletingId !== deleteConfirm) {
                    e.currentTarget.style.backgroundColor = "#b91c1c";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#dc2626";
                }}
              >
                {deletingId === deleteConfirm ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
