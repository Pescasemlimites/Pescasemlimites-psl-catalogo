-- Custo de aquisição por variação (calibre/cano), para precificação distinta da arma sem variação
ALTER TABLE variacoes_armas
  ADD COLUMN IF NOT EXISTS preco_custo DECIMAL(12, 2);

COMMENT ON COLUMN variacoes_armas.preco_custo IS 'Custo de aquisição desta combinação (opcional; no cadastro, o % de lucro segue o da arma)';
