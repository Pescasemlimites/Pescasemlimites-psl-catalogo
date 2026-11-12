import html2canvas from "html2canvas";
import type { OrcamentoLinha } from "./orcamentoTotals";
import {
  formatOrcamentoBRL,
  subtotalLinhas,
  temPromocaoCatalogo,
  totalComDesconto,
  unitarioEfetivoLinha,
  valorDesconto,
  type DescontoTipo,
} from "./orcamentoTotals";

const EXPORT_WIDTH = 1400;
const BG = "#0a0a0f";
const ACCENT = "#E9B20E";

export type OrcamentoExportData = {
  titulo?: string | null;
  clienteNome?: string | null;
  observacoes?: string | null;
  linhas: OrcamentoLinha[];
  descontoTipo: DescontoTipo | null;
  descontoValor: number;
  geradoEm: Date;
  validade?: string | null;
};

function waitForImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Imagem: ${src}`));
    img.src = src;
  });
}

async function waitForContainerImages(container: HTMLElement): Promise<void> {
  const srcs = Array.from(container.querySelectorAll("img"))
    .map((img) => img.src)
    .filter((src) => src && !src.startsWith("data:"));
  await Promise.all(srcs.map((src) => waitForImage(src).catch(() => undefined)));
}

function formatDataHora(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildOrcamentoExportDom(
  data: OrcamentoExportData,
  logoUrl: string
): HTMLDivElement {
  const subtotal = subtotalLinhas(data.linhas);
  const desc = valorDesconto(subtotal, data.descontoTipo, data.descontoValor);
  const total = totalComDesconto(subtotal, data.descontoTipo, data.descontoValor);

  const rowH = 52;
  const baseH = 380;
  const listH = data.linhas.length * rowH;
  const height = Math.min(2200, Math.max(760, baseH + listH));

  const container = document.createElement("div");
  container.style.width = `${EXPORT_WIDTH}px`;
  container.style.height = `${height}px`;
  container.style.padding = "36px 40px";
  container.style.backgroundColor = BG;
  container.style.color = "#ffffff";
  container.style.fontFamily = "Arial, Helvetica, sans-serif";
  container.style.boxSizing = "border-box";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "20px";
  container.style.overflow = "hidden";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "flex-start";
  header.style.gap = "24px";

  const logo = document.createElement("img");
  logo.src = logoUrl;
  logo.style.height = "48px";
  logo.style.objectFit = "contain";
  header.appendChild(logo);

  const meta = document.createElement("div");
  meta.style.textAlign = "right";
  meta.style.fontSize = "15px";
  meta.style.color = "#b8b8c0";
  meta.style.lineHeight = "1.5";
  meta.innerHTML = `<strong style="color:${ACCENT};font-size:22px">ORÇAMENTO</strong><br/>
    Gerado em: ${formatDataHora(data.geradoEm)}${
    data.validade
      ? `<br/>Válido até: ${new Date(data.validade + "T12:00:00").toLocaleDateString("pt-BR")}`
      : ""
  }${data.clienteNome ? `<br/>Cliente: <span style="color:#fff">${data.clienteNome}</span>` : ""}`;
  header.appendChild(meta);
  container.appendChild(header);

  if (data.titulo?.trim()) {
    const t = document.createElement("h1");
    t.textContent = data.titulo.trim();
    t.style.margin = "0";
    t.style.fontSize = "28px";
    t.style.fontWeight = "600";
    t.style.color = ACCENT;
    container.appendChild(t);
  }

  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.flex = "1";
  body.style.minHeight = "0";
  body.style.gap = "28px";

  const left = document.createElement("div");
  left.style.flex = "1";
  left.style.minWidth = "0";
  left.style.display = "flex";
  left.style.flexDirection = "column";
  left.style.gap = "16px";

  const tableWrap = document.createElement("div");
  tableWrap.style.border = `2px solid ${ACCENT}`;
  tableWrap.style.borderRadius = "12px";
  tableWrap.style.padding = "14px 16px";
  tableWrap.style.backgroundColor = "rgba(12, 12, 18, 0.92)";
  tableWrap.style.flex = "1";
  tableWrap.style.overflow = "hidden";

  const tableTitle = document.createElement("div");
  tableTitle.textContent = "Itens do pacote";
  tableTitle.style.fontSize = "20px";
  tableTitle.style.fontWeight = "bold";
  tableTitle.style.marginBottom = "12px";
  tableTitle.style.textAlign = "center";
  tableWrap.appendChild(tableTitle);

  const grid = document.createElement("div");
  grid.style.display = "flex";
  grid.style.flexDirection = "column";
  grid.style.gap = "8px";
  grid.style.fontSize = "16px";

  const head = document.createElement("div");
  head.style.display = "grid";
  head.style.gridTemplateColumns = "1fr 52px 150px 120px";
  head.style.gap = "8px";
  head.style.paddingBottom = "8px";
  head.style.borderBottom = "1px solid #444";
  head.style.color = "#a0a0a8";
  head.style.fontSize = "14px";
  head.innerHTML =
    "<span>Descrição</span><span style='text-align:center'>Qtd</span><span style='text-align:right'>Unit.</span><span style='text-align:right'>Subtotal</span>";
  grid.appendChild(head);

  data.linhas.forEach((linha) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr 52px 150px 120px";
    row.style.gap = "8px";
    row.style.alignItems = "start";
    row.style.padding = "6px 0";
    row.style.borderBottom = "1px solid #2a2a32";

    const desc = document.createElement("div");
    const det = linha.detalhe
      ? `<br/><span style="color:#a8a8b0;font-size:14px">${linha.detalhe}</span>`
      : "";
    const tipo =
      linha.tipo === "acessorio"
        ? `<span style="color:${ACCENT};font-size:12px">ACESSÓRIO</span><br/>`
        : "";
    desc.innerHTML = `${tipo}<strong>${linha.descricao}</strong>${det}`;
    row.appendChild(desc);

    const qtd = document.createElement("div");
    qtd.textContent = String(linha.quantidade);
    qtd.style.textAlign = "center";
    row.appendChild(qtd);

    const unit = document.createElement("div");
    unit.style.textAlign = "right";
    unit.style.fontSize = "15px";
    unit.style.lineHeight = "1.35";
    const efetivo = unitarioEfetivoLinha(linha);
    const temPromo = temPromocaoCatalogo(linha);
    const lista = linha.precoLista != null ? Number(linha.precoLista) : null;
    const promo = linha.precoPromocao != null ? Number(linha.precoPromocao) : null;
    const temDescLinha =
      (linha.descontoLinhaTipo === "percent" || linha.descontoLinhaTipo === "fixed") &&
      Number(linha.descontoLinhaValor) > 0;
    const descAvulso = temDescLinha && promo != null && Math.abs(efetivo - promo) > 0.009;
    const descAvulsoSobreLista =
      temDescLinha && !temPromo && lista != null && Math.abs(efetivo - lista) > 0.009;

    let unitHtml = "";
    if (temPromo && lista != null && !descAvulso) {
      unitHtml += `<div style="color:#888;text-decoration:line-through;font-size:13px">R$ ${formatOrcamentoBRL(lista)}</div>`;
      unitHtml += `<div style="color:#7dcea0;font-weight:bold">R$ ${formatOrcamentoBRL(promo!)}</div>`;
    } else if (temPromo && lista != null && descAvulso) {
      unitHtml += `<div style="color:#888;text-decoration:line-through;font-size:13px">R$ ${formatOrcamentoBRL(lista)}</div>`;
      if (promo != null) {
        unitHtml += `<div style="color:#999;text-decoration:line-through;font-size:13px">R$ ${formatOrcamentoBRL(promo)}</div>`;
      }
      unitHtml += `<div style="color:${ACCENT};font-weight:bold">R$ ${formatOrcamentoBRL(efetivo)}</div>`;
    } else if (descAvulsoSobreLista && lista != null) {
      unitHtml += `<div style="color:#888;text-decoration:line-through;font-size:13px">R$ ${formatOrcamentoBRL(lista)}</div>`;
      unitHtml += `<div style="color:${ACCENT};font-weight:bold">R$ ${formatOrcamentoBRL(efetivo)}</div>`;
    } else {
      unitHtml = `<div style="font-weight:bold">R$ ${formatOrcamentoBRL(efetivo)}</div>`;
    }
    unit.innerHTML = unitHtml;
    row.appendChild(unit);

    const sub = document.createElement("div");
    sub.textContent = `R$ ${formatOrcamentoBRL(efetivo * linha.quantidade)}`;
    sub.style.textAlign = "right";
    sub.style.fontWeight = "bold";
    row.appendChild(sub);

    grid.appendChild(row);
  });

  tableWrap.appendChild(grid);
  left.appendChild(tableWrap);

  const totals = document.createElement("div");
  totals.style.borderRadius = "12px";
  totals.style.padding = "16px 20px";
  totals.style.backgroundColor = "rgba(20, 20, 28, 0.95)";
  totals.style.display = "flex";
  totals.style.flexDirection = "column";
  totals.style.gap = "10px";
  totals.style.fontSize = "18px";

  const rowSub = document.createElement("div");
  rowSub.style.display = "flex";
  rowSub.style.justifyContent = "space-between";
  rowSub.innerHTML = `<span>Subtotal</span><span>R$ ${formatOrcamentoBRL(subtotal)}</span>`;
  totals.appendChild(rowSub);

  if (desc > 0) {
    const rowDesc = document.createElement("div");
    rowDesc.style.display = "flex";
    rowDesc.style.justifyContent = "space-between";
    rowDesc.style.color = "#7dcea0";
    const label =
      data.descontoTipo === "percent"
        ? `Desconto (${data.descontoValor}%)`
        : "Desconto";
    rowDesc.innerHTML = `<span>${label}</span><span>− R$ ${formatOrcamentoBRL(desc)}</span>`;
    totals.appendChild(rowDesc);
  }

  const rowTotal = document.createElement("div");
  rowTotal.style.display = "flex";
  rowTotal.style.justifyContent = "space-between";
  rowTotal.style.marginTop = "8px";
  rowTotal.style.paddingTop = "12px";
  rowTotal.style.borderTop = `2px solid ${ACCENT}`;
  rowTotal.innerHTML = `<span style="font-size:20px;font-weight:bold">Total à vista</span><span style="font-size:42px;font-weight:bold;color:${ACCENT}">R$ ${formatOrcamentoBRL(total)}</span>`;
  totals.appendChild(rowTotal);

  left.appendChild(totals);

  if (data.observacoes?.trim()) {
    const obs = document.createElement("div");
    obs.style.fontSize = "15px";
    obs.style.color = "#c0c0c8";
    obs.style.lineHeight = "1.45";
    obs.innerHTML = `<strong style="color:#fff">Observações:</strong> ${data.observacoes.trim()}`;
    left.appendChild(obs);
  }

  body.appendChild(left);

  const right = document.createElement("div");
  right.style.width = "38%";
  right.style.flexShrink = "0";
  right.style.display = "flex";
  right.style.flexDirection = "column";
  right.style.gap = "12px";
  right.style.alignItems = "center";

  const fotos = data.linhas.filter((l) => l.fotoUrl).slice(0, 6);
  const cols = fotos.length <= 2 ? fotos.length || 1 : 2;
  const photoGrid = document.createElement("div");
  photoGrid.style.display = "grid";
  photoGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  photoGrid.style.gap = "12px";
  photoGrid.style.width = "100%";
  photoGrid.style.flex = "1";
  photoGrid.style.alignContent = "start";

  if (fotos.length === 0) {
    const ph = document.createElement("div");
    ph.textContent = "Sem fotos";
    ph.style.color = "#666";
    ph.style.padding = "40px";
    ph.style.textAlign = "center";
    photoGrid.appendChild(ph);
  } else {
    fotos.forEach((l) => {
      const cell = document.createElement("div");
      cell.style.display = "flex";
      cell.style.flexDirection = "column";
      cell.style.alignItems = "center";
      cell.style.gap = "6px";
      const img = document.createElement("img");
      img.src = l.fotoUrl!;
      img.style.maxWidth = "100%";
      img.style.maxHeight = fotos.length === 1 ? "420px" : "200px";
      img.style.objectFit = "contain";
      cell.appendChild(img);
      if (l.marca) {
        const cap = document.createElement("div");
        cap.textContent = l.marca;
        cap.style.fontSize = "13px";
        cap.style.color = "#b0b0b8";
        cap.style.textAlign = "center";
        cell.appendChild(cap);
      }
      photoGrid.appendChild(cell);
    });
  }
  right.appendChild(photoGrid);
  body.appendChild(right);

  container.appendChild(body);

  const foot = document.createElement("div");
  foot.style.fontSize = "13px";
  foot.style.color = "#888";
  foot.style.textAlign = "center";
  foot.textContent =
    "Valores sujeitos à disponibilidade. Documento gerado pelo catálogo Pesca Sem Limites.";
  container.appendChild(foot);

  return container;
}

export async function exportOrcamentoToImage(
  data: OrcamentoExportData,
  logoUrl = "/logo.png"
): Promise<void> {
  const container = buildOrcamentoExportDom(data, logoUrl);
  const height = parseInt(container.style.height, 10);

  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  await waitForContainerImages(container);
  await new Promise((r) => setTimeout(r, 300));

  const canvas = await html2canvas(container, {
    backgroundColor: BG,
    width: EXPORT_WIDTH,
    height,
    scale: 1,
    useCORS: true,
    logging: false,
  });

  document.body.removeChild(container);

  const slug =
    (data.titulo || data.clienteNome || "orcamento")
      .replace(/[^a-z0-9]/gi, "_")
      .slice(0, 40) || "orcamento";
  const link = document.createElement("a");
  link.download = `${slug}_orcamento.jpg`;
  link.href = canvas.toDataURL("image/jpeg", 0.92);
  link.click();
}
