"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { emPromocaoValida, formatBRL } from "../../lib/promoPreco";
import {
  formatOrcamentoBRL,
  recalcularPrecoUnitario,
  subtotalLinhas,
  temPromocaoCatalogo,
  totalComDesconto,
  unitarioEfetivoLinha,
  valorDesconto,
  type DescontoTipo,
  type OrcamentoLinha,
} from "../../lib/orcamentoTotals";
import { exportOrcamentoToImage } from "../../lib/exportOrcamento";

type ArmaRow = {
  id: string;
  nome: string | null;
  marca_id: string | null;
  categoria_id: number | null;
  em_promocao?: boolean | null;
  preco_promocional?: number | null;
  preco?: number | null;
  foto_url?: string | null;
};

type VariacaoRow = {
  id: string;
  arma_id: string;
  preco: number | string | null;
  comprimento_cano: string | null;
  caracteristica_acabamento: string | null;
  preco_promocional?: number | string | null;
};

type MarcaRow = { id: string; nome: string };

function newLinhaId(): string {
  return crypto.randomUUID();
}

type PrecosItem = { lista: number | null; promocao: number | null };

function precosVariacao(arma: ArmaRow, v: VariacaoRow): PrecosItem {
  const lista = v.preco != null ? Number(v.preco) : NaN;
  const listaOk = Number.isFinite(lista) && lista > 0 ? lista : null;
  let promocao: number | null = null;
  if (emPromocaoValida(arma)) {
    const vp = v.preco_promocional != null ? Number(v.preco_promocional) : NaN;
    if (Number.isFinite(vp) && vp > 0) promocao = vp;
    else if (arma.preco_promocional != null) {
      const ap = Number(arma.preco_promocional);
      if (Number.isFinite(ap) && ap > 0) promocao = ap;
    }
  }
  if (promocao != null && listaOk != null && promocao >= listaOk - 0.009) promocao = null;
  return { lista: listaOk, promocao };
}

function precosArmaSemVariacao(arma: ArmaRow, minVariacao?: number): PrecosItem {
  let lista: number | null = null;
  if (minVariacao != null && Number.isFinite(minVariacao)) lista = minVariacao;
  else if (arma.preco != null) {
    const p = Number(arma.preco);
    if (Number.isFinite(p) && p > 0) lista = p;
  }
  let promocao: number | null = null;
  if (emPromocaoValida(arma) && arma.preco_promocional != null) {
    const p = Number(arma.preco_promocional);
    if (Number.isFinite(p) && p > 0) promocao = p;
  }
  if (promocao != null && lista != null && promocao >= lista - 0.009) promocao = null;
  return { lista, promocao };
}

function precoVitrine(p: PrecosItem): number | null {
  if (p.promocao != null) return p.promocao;
  return p.lista;
}

export default function OrcamentosPage() {
  const router = useRouter();
  const { authLoading, isAdmin, userId } = useAuth();

  const [armas, setArmas] = useState<ArmaRow[]>([]);
  const [marcas, setMarcas] = useState<Map<string, string>>(new Map());
  const [fotosPorArma, setFotosPorArma] = useState<Map<string, string>>(new Map());
  const [minPrecoPorArma, setMinPrecoPorArma] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [validade, setValidade] = useState("");
  const [descontoTipo, setDescontoTipo] = useState<DescontoTipo | "">("");
  const [descontoValor, setDescontoValor] = useState("");
  const [linhas, setLinhas] = useState<OrcamentoLinha[]>([]);

  const [buscaArma, setBuscaArma] = useState("");
  const [armaSelecionadaId, setArmaSelecionadaId] = useState<string | null>(null);
  const [variacoes, setVariacoes] = useState<VariacaoRow[]>([]);
  const [variacaoId, setVariacaoId] = useState<string>("");
  const [loadingVariacoes, setLoadingVariacoes] = useState(false);

  const [acessorioNome, setAcessorioNome] = useState("");
  const [acessorioPreco, setAcessorioPreco] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();
      if (profile?.role !== "admin") {
        router.push("/dashboard");
      }
    })();
  }, [authLoading, userId, router]);

  useEffect(() => {
    if (authLoading || !isAdmin) return;

    void (async () => {
      setLoading(true);
      try {
        const [armasRes, marcasRes, fotosRes, varRes] = await Promise.all([
          supabase.from("armas").select("id, nome, marca_id, categoria_id, em_promocao, preco_promocional, preco, foto_url").order("nome"),
          supabase.from("marcas").select("id, nome"),
          supabase.from("fotos_armas").select("arma_id, foto_url, ordem").order("ordem"),
          supabase.from("variacoes_armas").select("arma_id, preco"),
        ]);

        const marcaMap = new Map((marcasRes.data || []).map((m: MarcaRow) => [m.id, m.nome]));
        setMarcas(marcaMap);

        const fotoMap = new Map<string, string>();
        (fotosRes.data || []).forEach((f: { arma_id: string; foto_url: string }) => {
          if (!fotoMap.has(f.arma_id)) fotoMap.set(f.arma_id, f.foto_url);
        });
        setFotosPorArma(fotoMap);

        const minMap = new Map<string, number>();
        (varRes.data || []).forEach((v: { arma_id: string; preco: number | string }) => {
          const p = Number(v.preco);
          if (!Number.isFinite(p)) return;
          const cur = minMap.get(v.arma_id);
          if (cur == null || p < cur) minMap.set(v.arma_id, p);
        });
        setMinPrecoPorArma(minMap);

        setArmas((armasRes.data || []) as ArmaRow[]);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar catálogo");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, isAdmin]);

  const armasFiltradas = useMemo(() => {
    const t = buscaArma.trim().toLowerCase();
    if (!t) return armas.slice(0, 80);
    return armas.filter((a) => (a.nome || "").toLowerCase().includes(t)).slice(0, 80);
  }, [armas, buscaArma]);

  const subtotal = useMemo(() => subtotalLinhas(linhas), [linhas]);
  const descontoNum = parseFloat(descontoValor.replace(",", ".")) || 0;
  const tipoDesconto: DescontoTipo | null =
    descontoTipo === "percent" || descontoTipo === "fixed" ? descontoTipo : null;
  const valorDesc = useMemo(
    () => valorDesconto(subtotal, tipoDesconto, descontoNum),
    [subtotal, tipoDesconto, descontoNum]
  );
  const total = useMemo(
    () => totalComDesconto(subtotal, tipoDesconto, descontoNum),
    [subtotal, tipoDesconto, descontoNum]
  );

  const carregarVariacoes = useCallback(async (armaId: string) => {
    setLoadingVariacoes(true);
    setVariacoes([]);
    setVariacaoId("");
    const { data } = await supabase
      .from("variacoes_armas")
      .select("id, arma_id, preco, comprimento_cano, caracteristica_acabamento, preco_promocional")
      .eq("arma_id", armaId)
      .order("preco");
    setVariacoes((data || []) as VariacaoRow[]);
    if (data && data.length === 1) setVariacaoId(data[0].id);
    setLoadingVariacoes(false);
  }, []);

  const adicionarArma = () => {
    if (!armaSelecionadaId) {
      setErro("Selecione um produto do catálogo.");
      return;
    }
    const arma = armas.find((a) => a.id === armaSelecionadaId);
    if (!arma) return;

    let precos: PrecosItem = { lista: null, promocao: null };
    let detalhe = "";
    let variacaoIdFinal: string | null = null;

    if (variacoes.length > 0) {
      const v = variacoes.find((x) => x.id === variacaoId) || variacoes[0];
      if (!v) {
        setErro("Selecione a variação (cano/acabamento).");
        return;
      }
      variacaoIdFinal = v.id;
      precos = precosVariacao(arma, v);
      const parts = [v.comprimento_cano, v.caracteristica_acabamento].filter(Boolean);
      detalhe = parts.join(" · ");
    } else {
      precos = precosArmaSemVariacao(arma, minPrecoPorArma.get(arma.id));
    }

    const vitrine = precoVitrine(precos);
    if (vitrine == null || vitrine <= 0) {
      setErro("Este item não tem preço definido. Ajuste no cadastro antes de incluir.");
      return;
    }

    const foto = fotosPorArma.get(arma.id) || arma.foto_url || null;
    const marca = arma.marca_id ? marcas.get(arma.marca_id) || null : null;

    const nova: OrcamentoLinha = recalcularPrecoUnitario({
      id: newLinhaId(),
      tipo: "arma",
      armaId: arma.id,
      variacaoId: variacaoIdFinal,
      descricao: arma.nome || "Produto",
      detalhe: detalhe || null,
      quantidade: 1,
      precoLista: precos.lista ?? vitrine,
      precoPromocao: precos.promocao,
      precoUnitario: vitrine,
      descontoLinhaTipo: null,
      descontoLinhaValor: 0,
      fotoUrl: foto,
      marca,
    });

    setLinhas((prev) => [...prev, nova]);
    setErro(null);
    setArmaSelecionadaId(null);
    setBuscaArma("");
    setVariacoes([]);
    setVariacaoId("");
  };

  const adicionarAcessorio = () => {
    const nome = acessorioNome.trim();
    const preco = parseFloat(acessorioPreco.replace(",", "."));
    if (!nome) {
      setErro("Informe o nome do acessório.");
      return;
    }
    if (!Number.isFinite(preco) || preco <= 0) {
      setErro("Informe o valor do acessório.");
      return;
    }
    const nova: OrcamentoLinha = recalcularPrecoUnitario({
      id: newLinhaId(),
      tipo: "acessorio",
      descricao: nome,
      quantidade: 1,
      precoLista: preco,
      precoPromocao: null,
      precoUnitario: preco,
      descontoLinhaTipo: null,
      descontoLinhaValor: 0,
    });
    setLinhas((prev) => [...prev, nova]);
    setAcessorioNome("");
    setAcessorioPreco("");
    setErro(null);
  };

  const removerLinha = (id: string) => {
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  };

  const atualizarLinha = (id: string, patch: Partial<OrcamentoLinha>) => {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        let next = { ...l, ...patch };
        const recalc =
          "descontoLinhaTipo" in patch ||
          "descontoLinhaValor" in patch ||
          "precoLista" in patch ||
          "precoPromocao" in patch;
        if (recalc) next = recalcularPrecoUnitario(next);
        return next;
      })
    );
  };

  const ajustarValorFinalManual = (id: string, raw: string) => {
    const p = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(p)) return;
    setLinhas((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              precoUnitario: p,
              descontoLinhaTipo: null,
              descontoLinhaValor: 0,
            }
          : l
      )
    );
  };

  const salvarOrcamento = async () => {
    if (linhas.length === 0) {
      setErro("Adicione pelo menos um item ao pacote.");
      return;
    }
    setSalvando(true);
    setErro(null);
    setOkMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      const payload = {
        titulo: titulo.trim() || null,
        cliente_nome: clienteNome.trim() || null,
        observacoes: observacoes.trim() || null,
        desconto_tipo: tipoDesconto,
        desconto_valor: descontoNum,
        subtotal,
        total,
        validade: validade || null,
        created_by: uid,
      };
      const { data: orc, error: errOrc } = await supabase
        .from("orcamentos")
        .insert(payload)
        .select("id")
        .single();
      if (errOrc) {
        if (errOrc.code === "PGRST205" || errOrc.message.includes("orcamentos")) {
          setErro(
            "Tabela de orçamentos ainda não existe. Rode a migration supabase/migrations/030_orcamentos.sql no Supabase (SQL Editor)."
          );
        } else {
          setErro(errOrc.message);
        }
        return;
      }
      const itens = linhas.map((l, i) => ({
        orcamento_id: orc.id,
        ordem: i,
        tipo: l.tipo,
        arma_id: l.armaId ?? null,
        variacao_id: l.variacaoId ?? null,
        descricao: l.descricao,
        detalhe: l.detalhe ?? null,
        quantidade: l.quantidade,
        preco_unitario: l.precoUnitario,
        preco_lista: l.precoLista ?? null,
        preco_promocao: l.precoPromocao ?? null,
        desconto_linha_tipo: l.descontoLinhaTipo ?? null,
        desconto_linha_valor: l.descontoLinhaValor ?? 0,
        foto_url: l.fotoUrl ?? null,
      }));
      const { error: errItens } = await supabase.from("orcamento_itens").insert(itens);
      if (errItens) throw new Error(errItens.message);
      setOkMsg("Orçamento salvo no sistema.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const gerarImagem = async () => {
    if (linhas.length === 0) {
      setErro("Adicione itens antes de gerar a imagem.");
      return;
    }
    setExportando(true);
    setErro(null);
    try {
      await exportOrcamentoToImage({
        titulo,
        clienteNome,
        observacoes,
        linhas,
        descontoTipo: tipoDesconto,
        descontoValor: descontoNum,
        geradoEm: new Date(),
        validade: validade || null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar imagem");
    } finally {
      setExportando(false);
    }
  };

  if (authLoading || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#030711" }}>
        <div className="text-white">Carregando...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "#030711" }}>
      <Header />
      <main className="flex-1 px-4 py-8 md:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-light text-white md:text-4xl">Orçamentos</h1>
            <p className="mt-2 text-zinc-400">
              Monte pacotes com várias armas e acessórios, aplique desconto e gere a imagem para enviar ao cliente.
            </p>
          </div>

          {(erro || okMsg) && (
            <div
              className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
                erro ? "border-red-500/50 bg-red-950/40 text-red-200" : "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
              }`}
            >
              {erro || okMsg}
            </div>
          )}

          <section className="mb-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Dados do orçamento</h2>
              <div className="flex flex-col gap-3">
                <label className="text-sm text-zinc-300">
                  Título / referência
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex.: Pacote LE + supressor"
                  />
                </label>
                <label className="text-sm text-zinc-300">
                  Cliente
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                  />
                </label>
                <label className="text-sm text-zinc-300">
                  Válido até
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                    value={validade}
                    onChange={(e) => setValidade(e.target.value)}
                  />
                </label>
                <label className="text-sm text-zinc-300">
                  Observações (aparecem na imagem)
                  <textarea
                    className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                    rows={3}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Desconto</h2>
              <div className="flex flex-col gap-3">
                <select
                  className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                  value={descontoTipo}
                  onChange={(e) => setDescontoTipo(e.target.value as DescontoTipo | "")}
                >
                  <option value="">Sem desconto</option>
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Valor fixo (R$)</option>
                </select>
                {descontoTipo && (
                  <input
                    className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                    value={descontoValor}
                    onChange={(e) => setDescontoValor(e.target.value)}
                    placeholder={descontoTipo === "percent" ? "Ex.: 5" : "Ex.: 500,00"}
                  />
                )}
                <h2 className="mt-4 text-lg font-semibold text-white">Totais</h2>
                <p className="text-zinc-300">
                  Subtotal: <span className="text-white">R$ {formatOrcamentoBRL(subtotal)}</span>
                </p>
                {valorDesc > 0 && (
                  <p className="text-emerald-400">
                    Desconto: − R$ {formatOrcamentoBRL(valorDesc)}
                  </p>
                )}
                <p className="text-2xl font-bold" style={{ color: "#E9B20E" }}>
                  Total: R$ {formatOrcamentoBRL(total)}
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8 rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Adicionar arma do catálogo</h2>
            {loading ? (
              <p className="text-zinc-400">Carregando catálogo…</p>
            ) : (
              <div className="flex flex-col gap-3">
                <input
                  className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                  placeholder="Buscar modelo…"
                  value={buscaArma}
                  onChange={(e) => setBuscaArma(e.target.value)}
                />
                <select
                  className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                  value={armaSelecionadaId || ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setArmaSelecionadaId(id);
                    if (id) void carregarVariacoes(id);
                  }}
                >
                  <option value="">Selecione…</option>
                  {armasFiltradas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
                {armaSelecionadaId && variacoes.length > 0 && (
                  <select
                    className="rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                    value={variacaoId}
                    onChange={(e) => setVariacaoId(e.target.value)}
                    disabled={loadingVariacoes}
                  >
                    <option value="">Variação (cano / acabamento)…</option>
                    {variacoes.map((v) => {
                      const arma = armas.find((a) => a.id === armaSelecionadaId);
                      const pr = arma ? precosVariacao(arma, v) : { lista: null, promocao: null };
                      const vit = precoVitrine(pr);
                      const label = [v.comprimento_cano, v.caracteristica_acabamento]
                        .filter(Boolean)
                        .join(" · ");
                      const precoTxt =
                        pr.promocao != null && pr.lista != null
                          ? `De R$ ${formatBRL(pr.lista)} por R$ ${formatBRL(pr.promocao)}`
                          : vit != null
                            ? `R$ ${formatBRL(vit)}`
                            : "sem preço";
                      return (
                        <option key={v.id} value={v.id}>
                          {label || v.id.slice(0, 8)} — {precoTxt}
                        </option>
                      );
                    })}
                  </select>
                )}
                <button
                  type="button"
                  onClick={adicionarArma}
                  className="rounded-lg px-4 py-2 font-semibold text-zinc-900"
                  style={{ backgroundColor: "#E9B20E" }}
                >
                  Incluir no pacote
                </button>
              </div>
            )}
          </section>

          <section className="mb-8 rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Adicionar acessório / item avulso</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="flex-1 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white"
                placeholder="Descrição"
                value={acessorioNome}
                onChange={(e) => setAcessorioNome(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-white sm:w-40"
                placeholder="Valor R$"
                value={acessorioPreco}
                onChange={(e) => setAcessorioPreco(e.target.value)}
              />
              <button
                type="button"
                onClick={adicionarAcessorio}
                className="rounded-lg border border-[#E9B20E] px-4 py-2 font-semibold text-[#E9B20E]"
              >
                Incluir
              </button>
            </div>
          </section>

          <section className="mb-8 rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Itens do pacote</h2>
            {linhas.length === 0 ? (
              <p className="text-zinc-500">Nenhum item ainda.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {linhas.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-col gap-3 rounded-lg border border-zinc-700/50 bg-zinc-950/50 p-4 sm:flex-row sm:items-start"
                  >
                    {l.fotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.fotoUrl}
                        alt=""
                        className="h-20 w-28 shrink-0 object-contain"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded px-2 py-0.5 text-xs font-semibold"
                          style={{
                            backgroundColor: l.tipo === "acessorio" ? "rgba(233,178,14,0.2)" : "rgba(100,100,120,0.3)",
                            color: "#E9B20E",
                          }}
                        >
                          {l.tipo === "acessorio" ? "Acessório" : "Arma"}
                        </span>
                        <input
                          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-white"
                          value={l.descricao}
                          onChange={(e) => atualizarLinha(l.id, { descricao: e.target.value })}
                        />
                      </div>
                      {l.detalhe != null && (
                        <input
                          className="mt-2 w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-300"
                          value={l.detalhe || ""}
                          onChange={(e) => atualizarLinha(l.id, { detalhe: e.target.value })}
                        />
                      )}
                      <div className="mt-2 text-sm text-zinc-300">
                        {temPromocaoCatalogo(l) && l.precoLista != null ? (
                          <span className="mr-2 text-zinc-500 line-through">
                            R$ {formatOrcamentoBRL(l.precoLista)}
                          </span>
                        ) : null}
                        {l.precoPromocao != null && temPromocaoCatalogo(l) ? (
                          <span className="font-semibold text-emerald-400">
                            Promo: R$ {formatOrcamentoBRL(l.precoPromocao)}
                          </span>
                        ) : l.precoLista != null ? (
                          <span>Lista: R$ {formatOrcamentoBRL(l.precoLista)}</span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <label className="text-sm text-zinc-400">
                          Qtd
                          <input
                            type="number"
                            min={1}
                            className="ml-2 w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-white"
                            value={l.quantidade}
                            onChange={(e) =>
                              atualizarLinha(l.id, {
                                quantidade: Math.max(1, parseInt(e.target.value, 10) || 1),
                              })
                            }
                          />
                        </label>
                        <label className="text-sm text-zinc-400">
                          Desc. nesta peça
                          <select
                            className="ml-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-white"
                            value={l.descontoLinhaTipo ?? ""}
                            onChange={(e) =>
                              atualizarLinha(l.id, {
                                descontoLinhaTipo:
                                  e.target.value === "percent" || e.target.value === "fixed"
                                    ? e.target.value
                                    : null,
                                descontoLinhaValor:
                                  e.target.value === "" ? 0 : l.descontoLinhaValor ?? 0,
                              })
                            }
                          >
                            <option value="">Nenhum</option>
                            <option value="percent">%</option>
                            <option value="fixed">R$</option>
                          </select>
                        </label>
                        {l.descontoLinhaTipo ? (
                          <input
                            className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-white"
                            placeholder={l.descontoLinhaTipo === "percent" ? "5" : "100"}
                            value={
                              l.descontoLinhaValor != null && l.descontoLinhaValor > 0
                                ? String(l.descontoLinhaValor).replace(".", ",")
                                : ""
                            }
                            onChange={(e) =>
                              atualizarLinha(l.id, {
                                descontoLinhaValor:
                                  parseFloat(e.target.value.replace(",", ".")) || 0,
                              })
                            }
                          />
                        ) : null}
                        <label className="text-sm text-zinc-400">
                          Valor final un.
                          <input
                            className="ml-2 w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-semibold text-[#E9B20E]"
                            value={String(unitarioEfetivoLinha(l)).replace(".", ",")}
                            onChange={(e) => ajustarValorFinalManual(l.id, e.target.value)}
                          />
                        </label>
                        <span className="text-sm text-zinc-300">
                          Linha: R$ {formatOrcamentoBRL(unitarioEfetivoLinha(l) * l.quantidade)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerLinha(l.id)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={exportando || linhas.length === 0}
              onClick={() => void gerarImagem()}
              className="rounded-lg px-6 py-3 font-bold text-zinc-900 disabled:opacity-50"
              style={{ backgroundColor: "#E9B20E" }}
            >
              {exportando ? "Gerando imagem…" : "Gerar imagem do orçamento"}
            </button>
            <button
              type="button"
              disabled={salvando || linhas.length === 0}
              onClick={() => void salvarOrcamento()}
              className="rounded-lg border-2 border-[#E9B20E] px-6 py-3 font-bold text-[#E9B20E] disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar no banco"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
