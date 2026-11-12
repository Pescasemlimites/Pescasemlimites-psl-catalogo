"""
Recorte de fundo + composição no fundo padrão (equivalente a fotoAutomatica.ts).
Uso: python scripts/composite_produto_foto.py entrada.jpg saida.jpg
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from rembg import remove

ROOT = Path(__file__).resolve().parent.parent
FUNDO = ROOT / "public" / "fundo" / "produto.webp"
TAMANHO = 1200
OCUPACAO_LARGURA = 0.86
OCUPACAO_ALTURA = 0.62


def recorte_visivel(img: Image.Image) -> tuple[int, int, int, int]:
    arr = np.array(img)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 24)
    if len(xs) == 0:
        w, h = img.size
        return 0, 0, w, h
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def compositar(arma_rgba: Image.Image, fundo: Image.Image) -> Image.Image:
    fundo = fundo.convert("RGBA").resize((TAMANHO, TAMANHO), Image.Resampling.LANCZOS)
    x0, y0, x1, y1 = recorte_visivel(arma_rgba)
    crop = arma_rgba.crop((x0, y0, x1, y1))
    rw, rh = crop.size

    escala = min((TAMANHO * OCUPACAO_LARGURA) / rw, (TAMANHO * OCUPACAO_ALTURA) / rh)
    w = int(rw * escala)
    h = int(rh * escala)
    x = (TAMANHO - w) // 2
    y = (TAMANHO - h) // 2

    arma_scaled = crop.resize((w, h), Image.Resampling.LANCZOS)

    canvas = fundo.copy()
    shadow = Image.new("RGBA", (TAMANHO, TAMANHO), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    cx = TAMANHO // 2
    cy = y + h
    rx = int(w * 0.42)
    ry = max(10, int(h * 0.05))
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(0, 0, 0, 140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.paste(arma_scaled, (x, y), arma_scaled)

    out = Image.new("RGB", (TAMANHO, TAMANHO), (0, 0, 0))
    out.paste(canvas, mask=canvas.split()[3])
    return out


def compor_arquivo(entrada: Path, saida: Path) -> None:
    if not entrada.is_file():
        print(f"Arquivo não encontrado: {entrada}", file=sys.stderr)
        sys.exit(1)
    if not FUNDO.is_file():
        print(f"Fundo não encontrado: {FUNDO}", file=sys.stderr)
        sys.exit(1)

    src = Image.open(entrada).convert("RGBA")
    alpha = np.array(src)[:, :, 3]
    ja_recortada = float((alpha < 250).mean()) > 0.08 and float((alpha > 24).mean()) > 0.02
    corners = [
        src.getpixel((2, 2)),
        src.getpixel((src.width - 3, 2)),
        src.getpixel((2, src.height - 3)),
        src.getpixel((src.width - 3, src.height - 3)),
    ]
    dark_studio = all(sum(c[:3]) / 3 < 42 for c in corners)

    if ja_recortada:
        print("já recortada — só compõe o fundo", flush=True)
        arma = src
    elif dark_studio:
        print("fundo preto detectado — recorte rápido", flush=True)
        arr = np.array(src)
        rgb = arr[:, :, :3].astype(np.float32)
        brightness = rgb.mean(axis=2)
        arr[:, :, 3] = np.where(brightness < 38, 0, arr[:, :, 3])
        arma = Image.fromarray(arr, "RGBA")
    else:
        raw = entrada.read_bytes()
        print("rembg…", flush=True)
        sem_fundo = remove(raw)
        arma = Image.open(__import__("io").BytesIO(sem_fundo)).convert("RGBA")
    fundo = Image.open(FUNDO)
    final = compositar(arma, fundo)
    saida.parent.mkdir(parents=True, exist_ok=True)
    final.save(saida, "JPEG", quality=92, optimize=True)
    print(saida)


def main() -> None:
    if len(sys.argv) >= 3 and sys.argv[1] == "--lote":
        lista = Path(sys.argv[2])
        for line in lista.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            origem, destino = line.split("\t")
            print(">>", Path(origem).name, flush=True)
            compor_arquivo(Path(origem), Path(destino))
        return
    if len(sys.argv) < 3:
        print("Uso: composite_produto_foto.py <entrada> <saida.jpg>", file=sys.stderr)
        sys.exit(1)
    compor_arquivo(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    main()
