-- Configuração global: % de imposto sobre o custo (usado no cálculo sugerido de venda)
CREATE TABLE IF NOT EXISTS catalogo_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  imposto_percentual NUMERIC(10, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO catalogo_config (id, imposto_percentual)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE catalogo_config IS 'Configuração única do catálogo (linha id=1)';
COMMENT ON COLUMN catalogo_config.imposto_percentual IS 'Percentual aplicado sobre o preço de custo antes da margem de venda';

ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS preco_custo DECIMAL(12, 2);

ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS margem_venda_percent NUMERIC(10, 4);

COMMENT ON COLUMN armas.preco_custo IS 'Custo de aquisição da arma';
COMMENT ON COLUMN armas.margem_venda_percent IS 'Margem de lucro desejada (%) sobre custo já com imposto';

ALTER TABLE catalogo_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_config_select"
  ON catalogo_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "catalogo_config_insert"
  ON catalogo_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "catalogo_config_update"
  ON catalogo_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
