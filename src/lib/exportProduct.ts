import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type ProdutoData = {
  nome: string;
  preco: number | null;
  marca?: { nome: string } | null;
  calibre?: { nome: string } | null;
  funcionamento?: { nome: string } | null;
  categoria?: { nome: string } | null;
  espec_capacidade_tiros?: string | null;
  espec_carregadores?: string | null;
  espec_comprimento_cano?: string | null;
  caracteristica_acabamento?: string | null;
  foto_url: string | null;
};

type Parcela = {
  vezes: number;
  valorParcela: number;
  valorTotal: number;
  comJuros: boolean;
};

const IMAGE_EXPORT_WIDTH = 1400;
const IMAGE_EXPORT_HEIGHT = 720;
const IMAGE_EXPORT_BG = '#0a0a0f';
const IMAGE_EXPORT_ACCENT = '#ffcc00';

const INSTAGRAM_STORY_WIDTH = 1080;
const INSTAGRAM_STORY_HEIGHT = 1920;

export type InstagramStoryData = {
  nome: string;
  foto_url: string | null;
  marca?: { nome: string } | null;
  calibre?: { nome: string } | null;
  espec_capacidade_tiros?: string | null;
  preco_original?: number | null;
  preco_promocional?: number | null;
  promocao_ativa?: boolean;
  condicao_promocao?: string;
};

function getProdutoEspecsItems(produto: ProdutoData) {
  return [
    produto.marca && { label: 'Marca', value: produto.marca.nome },
    produto.calibre && { label: 'Calibre', value: produto.calibre.nome },
    produto.funcionamento && { label: 'Funcionamento', value: produto.funcionamento.nome },
    produto.espec_capacidade_tiros && { label: 'Capacidade de Tiros', value: produto.espec_capacidade_tiros },
    produto.espec_carregadores && { label: 'Carregadores', value: produto.espec_carregadores },
    produto.espec_comprimento_cano && { label: 'Comprimento do Cano', value: produto.espec_comprimento_cano },
    produto.caracteristica_acabamento && { label: 'Acabamento', value: produto.caracteristica_acabamento },
    produto.categoria && { label: 'Categoria', value: produto.categoria.nome },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

/** DOM do card no formato paisagem: esquerda (logo, título, specs, preço) + direita (foto). */
function buildProductImageExportDom(produto: ProdutoData, logoUrl: string): HTMLDivElement {
  const container = document.createElement('div');
  container.style.width = `${IMAGE_EXPORT_WIDTH}px`;
  container.style.height = `${IMAGE_EXPORT_HEIGHT}px`;
  container.style.padding = '36px 40px';
  container.style.backgroundColor = IMAGE_EXPORT_BG;
  container.style.color = '#ffffff';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.boxSizing = 'border-box';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.overflow = 'hidden';

  const mainRow = document.createElement('div');
  mainRow.style.display = 'flex';
  mainRow.style.flexDirection = 'row';
  mainRow.style.flex = '1';
  mainRow.style.minHeight = '0';
  mainRow.style.gap = '28px';

  const left = document.createElement('div');
  left.style.flex = '1';
  left.style.minWidth = '0';
  left.style.display = 'flex';
  left.style.flexDirection = 'column';
  left.style.gap = '18px';

  const logoWrap = document.createElement('div');
  logoWrap.style.display = 'flex';
  logoWrap.style.justifyContent = 'flex-start';
  const logoImg = document.createElement('img');
  logoImg.src = logoUrl;
  logoImg.style.height = '52px';
  logoImg.style.objectFit = 'contain';
  logoImg.style.maxWidth = '420px';
  logoWrap.appendChild(logoImg);
  left.appendChild(logoWrap);

  const title = document.createElement('h1');
  title.textContent = (produto.nome || 'Produto').toUpperCase();
  title.style.margin = '0';
  title.style.fontSize = '36px';
  title.style.fontWeight = '600';
  title.style.color = IMAGE_EXPORT_ACCENT;
  title.style.lineHeight = '1.2';
  title.style.letterSpacing = '0.03em';
  left.appendChild(title);

  const especsContainer = document.createElement('div');
  especsContainer.style.alignSelf = 'stretch';
  especsContainer.style.width = '100%';
  especsContainer.style.boxSizing = 'border-box';
  especsContainer.style.border = `2px solid ${IMAGE_EXPORT_ACCENT}`;
  especsContainer.style.borderRadius = '12px';
  especsContainer.style.padding = '12px 18px 16px';
  especsContainer.style.backgroundColor = 'rgba(12, 12, 18, 0.92)';
  especsContainer.style.display = 'flex';
  especsContainer.style.flexDirection = 'column';
  especsContainer.style.flex = '1';
  especsContainer.style.minHeight = '0';
  especsContainer.style.gap = '12px';

  const especsTitle = document.createElement('div');
  especsTitle.textContent = 'Especificações';
  especsTitle.style.fontSize = '22px';
  especsTitle.style.fontWeight = 'bold';
  especsTitle.style.color = '#ffffff';
  especsTitle.style.textAlign = 'center';
  especsTitle.style.margin = '0';
  especsContainer.appendChild(especsTitle);

  const especs = getProdutoEspecsItems(produto);
  const especsGrid = document.createElement('div');
  especsGrid.style.display = 'grid';
  especsGrid.style.gridTemplateColumns = '1fr 1fr';
  especsGrid.style.width = '100%';
  especsGrid.style.gap = '14px 36px';
  especsGrid.style.alignContent = 'start';

  especs.forEach((spec) => {
    const specItem = document.createElement('div');
    specItem.style.display = 'flex';
    specItem.style.flexDirection = 'column';
    specItem.style.gap = '6px';

    const specLabel = document.createElement('span');
    specLabel.textContent = spec.label;
    specLabel.style.color = '#b8b8c0';
    specLabel.style.fontSize = '17px';
    specLabel.style.fontWeight = 'normal';

    const specValue = document.createElement('span');
    specValue.textContent = spec.value;
    specValue.style.color = '#ffffff';
    specValue.style.fontSize = '20px';
    specValue.style.fontWeight = 'bold';
    specValue.style.lineHeight = '1.3';

    specItem.appendChild(specLabel);
    specItem.appendChild(specValue);
    especsGrid.appendChild(specItem);
  });

  especsContainer.appendChild(especsGrid);
  left.appendChild(especsContainer);

  if (produto.preco != null) {
    const precoDiv = document.createElement('div');
    precoDiv.style.marginTop = '4px';
    const precoLabel = document.createElement('div');
    precoLabel.textContent = 'Valor à vista';
    precoLabel.style.color = '#a0a0a8';
    precoLabel.style.fontSize = '16px';
    precoLabel.style.marginBottom = '8px';
    precoDiv.appendChild(precoLabel);
    const precoValor = document.createElement('div');
    precoValor.textContent = `R$ ${formatPrice(produto.preco)}`;
    precoValor.style.fontSize = '42px';
    precoValor.style.fontWeight = 'bold';
    precoValor.style.color = IMAGE_EXPORT_ACCENT;
    precoDiv.appendChild(precoValor);
    left.appendChild(precoDiv);
  }

  mainRow.appendChild(left);

  const right = document.createElement('div');
  right.style.width = '44%';
  right.style.flexShrink = '0';
  right.style.display = 'flex';
  right.style.flexDirection = 'column';
  right.style.alignItems = 'center';
  right.style.justifyContent = 'flex-start';
  right.style.minHeight = '0';

  const imageWrap = document.createElement('div');
  imageWrap.style.flex = '1';
  imageWrap.style.display = 'flex';
  imageWrap.style.alignItems = 'center';
  imageWrap.style.justifyContent = 'center';
  imageWrap.style.minHeight = '0';
  imageWrap.style.width = '100%';

  const marcaReservada = Boolean(produto.marca?.nome);
  const fotoMaxH = IMAGE_EXPORT_HEIGHT - 72 - (marcaReservada ? 52 : 0);

  if (produto.foto_url) {
    const fotoImg = document.createElement('img');
    fotoImg.src = produto.foto_url;
    fotoImg.style.maxWidth = '100%';
    fotoImg.style.maxHeight = `${fotoMaxH}px`;
    fotoImg.style.objectFit = 'contain';
    imageWrap.appendChild(fotoImg);
  }

  right.appendChild(imageWrap);

  if (produto.marca?.nome) {
    const marcaCaption = document.createElement('div');
    marcaCaption.textContent = produto.marca.nome;
    marcaCaption.style.flexShrink = '0';
    marcaCaption.style.textAlign = 'center';
    marcaCaption.style.width = '100%';
    marcaCaption.style.marginTop = '8px';
    marcaCaption.style.paddingLeft = '10px';
    marcaCaption.style.paddingRight = '10px';
    marcaCaption.style.boxSizing = 'border-box';
    marcaCaption.style.fontSize = '20px';
    marcaCaption.style.fontWeight = '600';
    marcaCaption.style.color = '#e4e4ec';
    marcaCaption.style.lineHeight = '1.3';
    right.appendChild(marcaCaption);
  }

  mainRow.appendChild(right);
  container.appendChild(mainRow);

  return container;
}

function buildInstagramStoryExportDom(data: InstagramStoryData, logoUrl: string): HTMLDivElement {
  const container = document.createElement('div');
  container.style.width = `${INSTAGRAM_STORY_WIDTH}px`;
  container.style.height = `${INSTAGRAM_STORY_HEIGHT}px`;
  container.style.padding = '48px 40px 56px';
  container.style.backgroundColor = IMAGE_EXPORT_BG;
  container.style.color = '#ffffff';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';
  container.style.boxSizing = 'border-box';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.overflow = 'hidden';

  const logoWrap = document.createElement('div');
  logoWrap.style.display = 'flex';
  logoWrap.style.justifyContent = 'center';
  logoWrap.style.flexShrink = '0';
  logoWrap.style.marginBottom = '24px';
  const logoImg = document.createElement('img');
  logoImg.src = logoUrl;
  logoImg.style.height = '64px';
  logoImg.style.objectFit = 'contain';
  logoImg.style.maxWidth = '480px';
  logoWrap.appendChild(logoImg);
  container.appendChild(logoWrap);

  if (data.promocao_ativa) {
    const badge = document.createElement('div');
    badge.textContent = 'PROMOÇÃO';
    badge.style.flexShrink = '0';
    badge.style.marginBottom = '20px';
    badge.style.padding = '10px 32px';
    badge.style.borderRadius = '999px';
    badge.style.backgroundColor = IMAGE_EXPORT_ACCENT;
    badge.style.color = '#0a0a0f';
    badge.style.fontSize = '28px';
    badge.style.fontWeight = 'bold';
    badge.style.letterSpacing = '0.08em';
    container.appendChild(badge);
  }

  const imageWrap = document.createElement('div');
  imageWrap.style.flex = '1';
  imageWrap.style.display = 'flex';
  imageWrap.style.alignItems = 'center';
  imageWrap.style.justifyContent = 'center';
  imageWrap.style.width = '100%';
  imageWrap.style.minHeight = '0';
  imageWrap.style.marginBottom = '28px';

  if (data.foto_url) {
    const fotoImg = document.createElement('img');
    fotoImg.src = data.foto_url;
    fotoImg.style.maxWidth = '100%';
    fotoImg.style.maxHeight = '900px';
    fotoImg.style.objectFit = 'contain';
    imageWrap.appendChild(fotoImg);
  }

  container.appendChild(imageWrap);

  const title = document.createElement('h1');
  title.textContent = (data.nome || 'Produto').toUpperCase();
  title.style.margin = '0 0 20px';
  title.style.fontSize = '40px';
  title.style.fontWeight = '600';
  title.style.color = IMAGE_EXPORT_ACCENT;
  title.style.lineHeight = '1.2';
  title.style.letterSpacing = '0.03em';
  title.style.textAlign = 'center';
  title.style.flexShrink = '0';
  container.appendChild(title);

  const precoWrap = document.createElement('div');
  precoWrap.style.flexShrink = '0';
  precoWrap.style.marginBottom = '32px';
  precoWrap.style.textAlign = 'center';

  const emPromo =
    data.promocao_ativa &&
    data.preco_promocional != null &&
    data.preco_original != null;

  if (emPromo) {
    const precoOriginal = document.createElement('div');
    precoOriginal.textContent = `R$ ${formatPrice(data.preco_original ?? null)}`;
    precoOriginal.style.fontSize = '32px';
    precoOriginal.style.color = '#888890';
    precoOriginal.style.textDecoration = 'line-through';
    precoOriginal.style.marginBottom = '8px';
    precoWrap.appendChild(precoOriginal);

    const precoPromo = document.createElement('div');
    precoPromo.textContent = `R$ ${formatPrice(data.preco_promocional ?? null)}`;
    precoPromo.style.fontSize = '56px';
    precoPromo.style.fontWeight = 'bold';
    precoPromo.style.color = IMAGE_EXPORT_ACCENT;
    precoWrap.appendChild(precoPromo);
  } else {
    const preco = data.preco_promocional ?? data.preco_original;
    if (preco != null) {
      const precoLabel = document.createElement('div');
      precoLabel.textContent = 'Valor à vista';
      precoLabel.style.fontSize = '22px';
      precoLabel.style.color = '#a0a0a8';
      precoLabel.style.marginBottom = '8px';
      precoWrap.appendChild(precoLabel);

      const precoValor = document.createElement('div');
      precoValor.textContent = `R$ ${formatPrice(preco)}`;
      precoValor.style.fontSize = '56px';
      precoValor.style.fontWeight = 'bold';
      precoValor.style.color = IMAGE_EXPORT_ACCENT;
      precoWrap.appendChild(precoValor);
    }
  }

  container.appendChild(precoWrap);

  const specsContainer = document.createElement('div');
  specsContainer.style.flexShrink = '0';
  specsContainer.style.alignSelf = 'stretch';
  specsContainer.style.width = '100%';
  specsContainer.style.boxSizing = 'border-box';
  specsContainer.style.border = `2px solid ${IMAGE_EXPORT_ACCENT}`;
  specsContainer.style.borderRadius = '16px';
  specsContainer.style.padding = '20px 24px';
  specsContainer.style.backgroundColor = 'rgba(12, 12, 18, 0.92)';
  specsContainer.style.display = 'grid';
  specsContainer.style.gridTemplateColumns = '1fr 1fr 1fr';
  specsContainer.style.gap = '16px';
  specsContainer.style.marginBottom = '24px';

  const specs = [
    data.marca?.nome && { label: 'Marca', value: data.marca.nome },
    data.calibre?.nome && { label: 'Calibre', value: data.calibre.nome },
    data.espec_capacidade_tiros && { label: 'Tiros', value: data.espec_capacidade_tiros },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  specs.forEach((spec) => {
    const specItem = document.createElement('div');
    specItem.style.display = 'flex';
    specItem.style.flexDirection = 'column';
    specItem.style.alignItems = 'center';
    specItem.style.gap = '8px';
    specItem.style.textAlign = 'center';

    const specLabel = document.createElement('span');
    specLabel.textContent = spec.label;
    specLabel.style.color = '#b8b8c0';
    specLabel.style.fontSize = '20px';

    const specValue = document.createElement('span');
    specValue.textContent = spec.value;
    specValue.style.color = '#ffffff';
    specValue.style.fontSize = '24px';
    specValue.style.fontWeight = 'bold';
    specValue.style.lineHeight = '1.3';

    specItem.appendChild(specLabel);
    specItem.appendChild(specValue);
    specsContainer.appendChild(specItem);
  });

  container.appendChild(specsContainer);

  const footer = document.createElement('div');
  footer.style.flexShrink = '0';
  footer.style.textAlign = 'center';
  footer.style.marginTop = 'auto';

  if (data.condicao_promocao) {
    const condicao = document.createElement('div');
    condicao.textContent = data.condicao_promocao;
    condicao.style.fontSize = '22px';
    condicao.style.fontWeight = '600';
    condicao.style.color = '#e4e4ec';
    condicao.style.marginBottom = '12px';
    footer.appendChild(condicao);
  }

  const loja = document.createElement('div');
  loja.textContent = 'Pesca Sem Limites';
  loja.style.fontSize = '20px';
  loja.style.color = '#888890';
  footer.appendChild(loja);

  container.appendChild(footer);

  return container;
}

async function renderDomToJpeg(
  container: HTMLDivElement,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';

  document.body.appendChild(container);

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const canvas = await html2canvas(container, {
    backgroundColor: IMAGE_EXPORT_BG,
    width,
    height,
    scale: 1,
    useCORS: true,
    logging: false,
  });

  document.body.removeChild(container);

  return canvas;
}

function downloadCanvasAsJpeg(canvas: HTMLCanvasElement, filename: string): void {
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const link = document.createElement('a');
  link.download = filename;
  link.href = imgData;
  link.click();
}

// Função auxiliar para carregar imagem
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Função para formatar preço
function formatPrice(price: number | null): string {
  if (price == null) return 'N/A';
  return parseFloat(price.toString()).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function exportProductToPDF(
  produto: ProdutoData,
  parcelas: Parcela[],
  logoUrl: string = '/logo.png'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Fundo escuro
  doc.setFillColor(3, 7, 17); // Cor de fundo escura #030711
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Logo centralizado no topo
  try {
    const logoImg = await loadImage(logoUrl);
    const logoHeight = 15;
    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
    const logoX = (pageWidth - logoWidth) / 2;
    
    doc.addImage(logoImg, 'PNG', logoX, yPosition, logoWidth, logoHeight);
    yPosition += logoHeight + 25; // Aumentado de 15 para 25
  } catch (error) {
    console.warn('Erro ao carregar logo:', error);
  }

  // Seção principal: Foto à esquerda e informações à direita
  const fotoWidth = 100; // Largura da foto (aumentado de 70 para 100)
  const infoX = margin + fotoWidth + 15; // Posição X das informações (aumentado de 10 para 15)
  const infoWidth = contentWidth - fotoWidth - 15;

  // Foto do produto (lado esquerdo)
  if (produto.foto_url) {
    try {
      const fotoImg = await loadImage(produto.foto_url);
      const fotoHeight = 130; // Aumentado de 90 para 130
      const imgRatio = fotoImg.width / fotoImg.height;
      let imgWidth = fotoHeight * imgRatio;
      let imgHeight = fotoHeight;
      
      // Ajustar se a largura exceder o espaço disponível
      if (imgWidth > fotoWidth) {
        imgWidth = fotoWidth;
        imgHeight = fotoWidth / imgRatio;
      }
      
      const imgX = margin + (fotoWidth - imgWidth) / 2;
      doc.addImage(fotoImg, 'JPEG', imgX, yPosition, imgWidth, imgHeight);
    } catch (error) {
      console.warn('Erro ao carregar foto:', error);
    }
  }

  // Informações do produto (lado direito)
  let infoY = yPosition;

  // Marca
  if (produto.marca?.nome) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(produto.marca.nome, infoX, infoY);
    infoY += 8; // Aumentado de 6 para 8
  }

  // Nome do produto
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const nomeLines = doc.splitTextToSize(produto.nome || 'Produto', infoWidth);
  doc.text(nomeLines, infoX, infoY);
  infoY += nomeLines.length * 7 + 12; // Aumentado de 8 para 12

  // Preço
  if (produto.preco != null) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('Valor à vista', infoX, infoY);
    infoY += 8; // Aumentado de 6 para 8
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(233, 178, 14); // Cor dourada
    doc.text(`R$ ${formatPrice(produto.preco)}`, infoX, infoY);
    infoY += 12; // Aumentado de 8 para 12
  }

  // Avançar para próxima seção
  yPosition = Math.max(yPosition + 130, infoY) + 25; // Ajustado para o novo tamanho da foto (130)

  // Seção de Especificações com borda dourada
  const especsStartY = yPosition;
  
  // Calcular altura necessária primeiro
  const especs = [
    produto.marca && { label: 'Marca', value: produto.marca.nome },
    produto.calibre && { label: 'Calibre', value: produto.calibre.nome },
    produto.funcionamento && { label: 'Funcionamento', value: produto.funcionamento.nome },
    produto.espec_capacidade_tiros && { label: 'Capacidade de Tiros', value: produto.espec_capacidade_tiros },
    produto.espec_carregadores && { label: 'Carregadores', value: produto.espec_carregadores },
    produto.espec_comprimento_cano && { label: 'Comprimento do Cano', value: produto.espec_comprimento_cano },
    produto.caracteristica_acabamento && { label: 'Acabamento', value: produto.caracteristica_acabamento },
    produto.categoria && { label: 'Categoria', value: produto.categoria.nome },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const numRows = Math.ceil(especs.length / 2);
  const especsBoxHeight = 22 + (numRows * 16); // Título + linhas (aumentado espaçamento e padding)
  
  // Desenhar borda dourada e fundo primeiro
  doc.setDrawColor(233, 178, 14);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, especsStartY, contentWidth, especsBoxHeight, 2, 2, 'D');
  
  // Fundo escuro da caixa
  doc.setFillColor(20, 20, 20);
  doc.roundedRect(margin + 0.5, especsStartY + 0.5, contentWidth - 1, especsBoxHeight - 1, 1.5, 1.5, 'F');
  
  // Agora escrever o conteúdo por cima
  yPosition = especsStartY + 10; // Aumentado padding superior
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Especificações', margin + 8, yPosition); // Aumentado padding lateral
  yPosition += 12; // Aumentado de 10 para 12

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Dividir em duas colunas
  const col1X = margin + 10; // Aumentado padding lateral
  const col2X = margin + contentWidth / 2 + 12; // Aumentado espaçamento entre colunas
  let col1Y = yPosition;
  let col2Y = yPosition;

  especs.forEach((spec, index) => {
    const isCol1 = index % 2 === 0;
    const currentX = isCol1 ? col1X : col2X;
    let currentY = isCol1 ? col1Y : col2Y;

    // Label
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(spec.label, currentX, currentY);
    currentY += 6; // Aumentado de 5 para 6

    // Value
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(spec.value, currentX, currentY);
    currentY += 10; // Aumentado de 8 para 10

    if (isCol1) {
      col1Y = currentY;
    } else {
      col2Y = currentY;
    }
  });

  // Salvar PDF
  doc.save(`${produto.nome?.replace(/[^a-z0-9]/gi, '_') || 'produto'}.pdf`);
}

// Função alternativa para exportar como imagem PNG
export async function exportProductToImage(
  produto: ProdutoData,
  parcelas: Parcela[],
  logoUrl: string = '/logo.png'
) {
  const container = buildProductImageExportDom(produto, logoUrl);
  const canvas = await renderDomToJpeg(container, IMAGE_EXPORT_WIDTH, IMAGE_EXPORT_HEIGHT);
  downloadCanvasAsJpeg(
    canvas,
    `${produto.nome?.replace(/[^a-z0-9]/gi, '_') || 'produto'}.jpg`
  );
}

export async function exportProductToInstagramStory(
  data: InstagramStoryData,
  logoUrl: string = '/logo.png'
): Promise<void> {
  const container = buildInstagramStoryExportDom(data, logoUrl);
  const canvas = await renderDomToJpeg(container, INSTAGRAM_STORY_WIDTH, INSTAGRAM_STORY_HEIGHT);
  downloadCanvasAsJpeg(
    canvas,
    `${data.nome?.replace(/[^a-z0-9]/gi, '_') || 'produto'}_story.jpg`
  );
}

// Nova função para gerar imagem e compartilhar no WhatsApp
export async function exportProductToImageAndShare(
  produto: ProdutoData,
  parcelas: Parcela[],
  logoUrl: string = '/logo.png',
  phoneNumber?: string
) {
  const container = buildProductImageExportDom(produto, logoUrl);
  const canvas = await renderDomToJpeg(container, IMAGE_EXPORT_WIDTH, IMAGE_EXPORT_HEIGHT);

  // Converter para JPEG
  canvas.toBlob(async (blob) => {
    if (!blob) {
      alert('Erro ao gerar imagem');
      return;
    }

    // Tentar usar Web Share API (funciona em dispositivos móveis)
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], `${produto.nome?.replace(/[^a-z0-9]/gi, '_') || 'produto'}.jpg`, {
          type: 'image/jpeg',
        });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: produto.nome || 'Produto',
            text: `Confira este produto: ${produto.nome}`,
          });
          return;
        }
      } catch (error) {
        console.log('Web Share API não disponível, usando fallback');
      }
    }

    // Fallback: converter para base64 e abrir WhatsApp Web
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Criar link temporário para download primeiro
      const link = document.createElement('a');
      link.download = `${produto.nome?.replace(/[^a-z0-9]/gi, '_') || 'produto'}.jpg`;
      link.href = URL.createObjectURL(blob);
      link.click();
      
      // Abrir WhatsApp Web com mensagem
      const message = encodeURIComponent(`Confira este produto: ${produto.nome || 'Produto'}`);
      const whatsappUrl = phoneNumber
        ? `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${message}`
        : `https://web.whatsapp.com/send?text=${message}`;
      
      window.open(whatsappUrl, '_blank');
    };
    reader.readAsDataURL(blob);
  }, 'image/jpeg', 0.85);
}

