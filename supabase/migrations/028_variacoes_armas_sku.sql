-- SKU do fabricante (tabela de preços) por variação
ALTER TABLE variacoes_armas
  ADD COLUMN IF NOT EXISTS sku TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_variacoes_armas_sku_unique
  ON variacoes_armas (sku)
  WHERE sku IS NOT NULL;

COMMENT ON COLUMN variacoes_armas.sku IS 'SKU Fire Eagle para custo/tabela';
