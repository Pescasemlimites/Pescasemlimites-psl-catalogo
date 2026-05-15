-- Promoção no cadastro de armas: preço promocional, condição (à vista / parcelado) e destaque na home
ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS em_promocao BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS preco_promocional DECIMAL(12, 2);

ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS promocao_modo TEXT;

ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS promocao_parcelas_max INTEGER;

ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS destaque_promocao BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN armas.em_promocao IS 'Produto em campanha promocional';
COMMENT ON COLUMN armas.preco_promocional IS 'Valor à exibir na promoção (à vista ou base de parcelamento)';
COMMENT ON COLUMN armas.promocao_modo IS 'avista | parcelado';
COMMENT ON COLUMN armas.promocao_parcelas_max IS 'Quando parcelado: máximo de parcelas anunciado';
COMMENT ON COLUMN armas.destaque_promocao IS 'Exibir como banner de promoção na home (apenas um recomendado)';
