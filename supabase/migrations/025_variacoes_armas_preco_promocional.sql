-- Preço promocional por variação (ex.: desconto à vista calculado por % de lucro)
ALTER TABLE variacoes_armas
  ADD COLUMN IF NOT EXISTS preco_promocional DECIMAL(12, 2);

COMMENT ON COLUMN variacoes_armas.preco_promocional IS 'Preço promocional desta combinação (ex.: à vista); quando nulo, usa o da arma';
