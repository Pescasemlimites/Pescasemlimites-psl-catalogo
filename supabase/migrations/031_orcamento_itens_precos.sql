-- Preço lista, promo e desconto avulso por item (orçamentos já criados em 030)

ALTER TABLE orcamento_itens
  ADD COLUMN IF NOT EXISTS preco_lista NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS preco_promocao NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS desconto_linha_tipo TEXT CHECK (
    desconto_linha_tipo IS NULL OR desconto_linha_tipo IN ('percent', 'fixed')
  ),
  ADD COLUMN IF NOT EXISTS desconto_linha_valor NUMERIC(12, 2) DEFAULT 0;
