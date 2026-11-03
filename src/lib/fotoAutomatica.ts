/** Fundo padrão de estúdio (public/fundo/produto.webp) */
const FUNDO_URL = "/fundo/produto.webp";
/** Tamanho final da foto (quadrada) */
const TAMANHO = 1200;
/** Área máxima ocupada pela arma (fração da largura/altura) */
const OCUPACAO_LARGURA = 0.86;
const OCUPACAO_ALTURA = 0.62;
/** Linha do "chão" do fundo, onde a base da arma encosta (fração da altura) */
const LINHA_CHAO = 0.86;

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Retângulo dos pixels não transparentes (ignora sombras quase invisíveis). */
function recorteVisivel(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Remove o fundo da foto enviada e enquadra a arma no fundo padrão.
 * Roda no navegador; o modelo é baixado na primeira vez (pode demorar).
 */
export async function gerarFotoAutomatica(file: File): Promise<File> {
  const { removeBackground } = await import("@imgly/background-removal");
  const semFundo = await removeBackground(file);
  const urlSemFundo = URL.createObjectURL(semFundo);

  try {
    const [fundo, arma] = await Promise.all([carregarImagem(FUNDO_URL), carregarImagem(urlSemFundo)]);
    const r = recorteVisivel(arma);

    const canvas = document.createElement("canvas");
    canvas.width = TAMANHO;
    canvas.height = TAMANHO;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(fundo, 0, 0, TAMANHO, TAMANHO);

    const escala = Math.min((TAMANHO * OCUPACAO_LARGURA) / r.w, (TAMANHO * OCUPACAO_ALTURA) / r.h);
    const w = r.w * escala;
    const h = r.h * escala;
    const x = (TAMANHO - w) / 2;
    const y = TAMANHO * LINHA_CHAO - h;

    // Sombra de contato no chão
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.filter = "blur(18px)";
    ctx.beginPath();
    ctx.ellipse(TAMANHO / 2, y + h, w * 0.42, Math.max(10, h * 0.05), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.drawImage(arma, r.x, r.y, r.w, r.h, x, y, w, h);

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/jpeg", 0.92)
    );
    const nome = file.name.replace(/\.[^.]+$/, "") + "-auto.jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(urlSemFundo);
  }
}
