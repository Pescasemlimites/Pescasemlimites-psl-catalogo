-- Impostos por produto (sobrescrevem os padrões de catalogo_config quando preenchidos)
ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS imposto_simples_percent NUMERIC(10, 4);

ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS difal_percent NUMERIC(10, 4);

COMMENT ON COLUMN armas.imposto_simples_percent IS '% do primeiro imposto sobre o custo deste produto';
COMMENT ON COLUMN armas.difal_percent IS '% do segundo imposto sobre o subtotal após o primeiro imposto';
