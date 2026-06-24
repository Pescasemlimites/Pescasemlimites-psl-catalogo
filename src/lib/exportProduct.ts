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
const INSTAGRAM_STORY_BG = '/story/fundo_story.png';
const INSTAGRAM_STORY_PHOTO_SIZE = 820;
const INSTAGRAM_STORY_PRECO_TOP = 1190;
const INSTAGRAM_STORY_PRECO_HEIGHT = 80;
const STORY_TITLE_FONT_FAMILY = "'Oswald', sans-serif";
const STORY_TITLE_FONT_LINK_ID = 'google-font-oswald-story';

export type InstagramStoryData = {
  nome: string;
  foto_url: string | null;
  marca?: { nome: string } | null;
  calibre?: { nome: string } | null;
  funcionamento?: { nome: string } | null;
  categoria?: { nome: string } | null;
  espec_capacidade_tiros?: string | null;
  espec_carregadores?: string | null;
  espec_comprimento_cano?: string | null;
  caracteristica_acabamento?: string | null;
  preco_original?: number | null;
  preco_promocional?: number | null;
  promocao_ativa?: boolean;
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
    precoValor.style.fontSize = '55px';
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

function getInstagramStorySpecsItems(data: InstagramStoryData) {
  return [
    data.marca && { label: 'Marca', value: data.marca.nome },
    data.calibre && { label: 'Calibre', value: data.calibre.nome },
    data.funcionamento && { label: 'Funcionamento', value: data.funcionamento.nome },
    data.espec_capacidade_tiros && { label: 'Capacidade de Tiros', value: data.espec_capacidade_tiros },
    data.espec_carregadores && { label: 'Carregadores', value: data.espec_carregadores },
    data.espec_comprimento_cano && { label: 'Comprimento do Cano', value: data.espec_comprimento_cano },
    data.caracteristica_acabamento && { label: 'Acabamento', value: data.caracteristica_acabamento },
    data.categoria && { label: 'Categoria', value: data.categoria.nome },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

function buildInstagramStoryExportDom(data: InstagramStoryData): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.width = `${INSTAGRAM_STORY_WIDTH}px`;
  container.style.height = `${INSTAGRAM_STORY_HEIGHT}px`;
  container.style.overflow = 'hidden';
  container.style.fontFamily = 'Arial, Helvetica, sans-serif';

  const bgImg = document.createElement('img');
  bgImg.src = INSTAGRAM_STORY_BG;
  bgImg.style.position = 'absolute';
  bgImg.style.top = '0';
  bgImg.style.left = '0';
  bgImg.style.width = `${INSTAGRAM_STORY_WIDTH}px`;
  bgImg.style.height = `${INSTAGRAM_STORY_HEIGHT}px`;
  bgImg.style.objectFit = 'cover';
  container.appendChild(bgImg);

  const photoTop = 185;
  const photoLeft = (INSTAGRAM_STORY_WIDTH - INSTAGRAM_STORY_PHOTO_SIZE) / 2;
  const nomeTop = photoTop + INSTAGRAM_STORY_PHOTO_SIZE + 8;

  if (data.foto_url) {
    const fotoWrap = document.createElement('div');
    fotoWrap.style.position = 'absolute';
    fotoWrap.style.top = `${photoTop}px`;
    fotoWrap.style.left = `${photoLeft}px`;
    fotoWrap.style.width = `${INSTAGRAM_STORY_PHOTO_SIZE}px`;
    fotoWrap.style.height = `${INSTAGRAM_STORY_PHOTO_SIZE}px`;
    fotoWrap.style.display = 'flex';
    fotoWrap.style.alignItems = 'center';
    fotoWrap.style.justifyContent = 'center';
    fotoWrap.style.overflow = 'hidden';
    fotoWrap.style.borderRadius = '30px';

    const fotoImg = document.createElement('img');
    fotoImg.src = data.foto_url;
    fotoImg.crossOrigin = 'anonymous';
    fotoImg.style.width = '100%';
    fotoImg.style.height = '100%';
    fotoImg.style.objectFit = 'contain';
    fotoWrap.appendChild(fotoImg);
    container.appendChild(fotoWrap);
  }

  const nomeModelo = document.createElement('div');
  nomeModelo.textContent = (data.nome || 'Produto').toUpperCase();
  nomeModelo.style.position = 'absolute';
  nomeModelo.style.top = `${nomeTop}px`;
  nomeModelo.style.left = '60px';
  nomeModelo.style.right = '60px';
  nomeModelo.style.textAlign = 'center';
  nomeModelo.style.fontSize = '60px';
  nomeModelo.style.fontFamily = STORY_TITLE_FONT_FAMILY;
  nomeModelo.style.fontWeight = '700';
  nomeModelo.style.color = IMAGE_EXPORT_ACCENT;
  nomeModelo.style.lineHeight = '1.2';
  container.appendChild(nomeModelo);

  const specsWrap = document.createElement('div');
  specsWrap.style.position = 'absolute';
  specsWrap.style.top = `1425px`;
  specsWrap.style.left = '72px';
  specsWrap.style.right = '72px';

  const specsTitle = document.createElement('div');
  specsTitle.textContent = 'Especificações';
  specsTitle.style.fontSize = '36px';
  specsTitle.style.fontWeight = 'bold';
  specsTitle.style.color = '#ffffff';
  specsTitle.style.marginBottom = '20px';
  specsWrap.appendChild(specsTitle);

  const specsGrid = document.createElement('div');
  specsGrid.style.display = 'grid';
  specsGrid.style.gridTemplateColumns = '1fr 1fr';
  specsGrid.style.gap = '12px 40px';

  getInstagramStorySpecsItems(data).forEach((spec) => {
    const specItem = document.createElement('div');
    specItem.style.display = 'flex';
    specItem.style.flexDirection = 'column';
    specItem.style.gap = '4px';

    const specLabel = document.createElement('span');
    specLabel.textContent = spec.label;
    specLabel.style.color = '#a1a1aa';
    specLabel.style.fontSize = '22px';

    const specValue = document.createElement('span');
    specValue.textContent = spec.value;
    specValue.style.color = '#ffffff';
    specValue.style.fontSize = '32px';
    specValue.style.fontWeight = 'bold';
    specValue.style.lineHeight = '1.3';

    specItem.appendChild(specLabel);
    specItem.appendChild(specValue);
    specsGrid.appendChild(specItem);
  });

  specsWrap.appendChild(specsGrid);
  container.appendChild(specsWrap);

  const precoAvista =
    data.promocao_ativa && data.preco_promocional != null
      ? data.preco_promocional
      : (data.preco_promocional ?? data.preco_original);

  if (precoAvista != null) {
    const precoValor = document.createElement('div');
    precoValor.textContent = `R$ ${formatPrice(precoAvista)}`;
    precoValor.style.position = 'absolute';
    precoValor.style.top = `${INSTAGRAM_STORY_PRECO_TOP}px`;
    precoValor.style.left = '50%';
    precoValor.style.transform = 'translateX(-50%)';
    precoValor.style.width = '720px';
    precoValor.style.height = `${INSTAGRAM_STORY_PRECO_HEIGHT}px`;
    precoValor.style.display = 'flex';
    precoValor.style.alignItems = 'center';
    precoValor.style.justifyContent = 'center';
    precoValor.style.textAlign = 'center';
    precoValor.style.fontSize = '70px';
    precoValor.style.fontFamily = STORY_TITLE_FONT_FAMILY;
    precoValor.style.fontWeight = '700';
    precoValor.style.color = '#000000';
    precoValor.style.lineHeight = '1.1';
    precoValor.style.zIndex = '10';
    container.appendChild(precoValor);
  }

  return container;
}

async function ensureStoryTitleFontLoaded(): Promise<void> {
  if (!document.getElementById(STORY_TITLE_FONT_LINK_ID)) {
    const link = document.createElement('link');
    link.id = STORY_TITLE_FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap';
    document.head.appendChild(link);
    await new Promise<void>((resolve) => {
      link.onload = () => resolve();
      link.onerror = () => resolve();
    });
  }

  try {
    await document.fonts.load(`700 50px ${STORY_TITLE_FONT_FAMILY}`);
    await document.fonts.load(`700 70px ${STORY_TITLE_FONT_FAMILY}`);
    await document.fonts.ready;
  } catch {
    // usa fallback sans-serif se a fonte não carregar
  }
}

function waitForImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
    img.src = src;
  });
}

async function waitForContainerImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  const srcs = images
    .map((img) => img.src)
    .filter((src) => src && !src.startsWith('data:'));

  await Promise.all(srcs.map((src) => waitForImage(src).catch(() => undefined)));
}

async function renderDomToJpeg(
  container: HTMLDivElement,
  width: number,
  height: number,
  options?: { backgroundColor?: string | null }
): Promise<HTMLCanvasElement> {
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';

  document.body.appendChild(container);

  await waitForContainerImages(container);
  await new Promise((resolve) => setTimeout(resolve, 300));

  const canvas = await html2canvas(container, {
    backgroundColor: options?.backgroundColor ?? IMAGE_EXPORT_BG,
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

export async function exportProductToInstagramStory(data: InstagramStoryData): Promise<void> {
  await ensureStoryTitleFontLoaded();
  const container = buildInstagramStoryExportDom(data);
  const canvas = await renderDomToJpeg(container, INSTAGRAM_STORY_WIDTH, INSTAGRAM_STORY_HEIGHT, {
    backgroundColor: null,
  });
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

