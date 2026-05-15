-- Imposto em duas camadas (Simples + DIFAL), com rótulos editáveis pelo admin
ALTER TABLE catalogo_config ADD COLUMN IF NOT EXISTS nome_imposto_simples TEXT;
ALTER TABLE catalogo_config ADD COLUMN IF NOT EXISTS nome_difal TEXT;
ALTER TABLE catalogo_config ADD COLUMN IF NOT EXISTS imposto_simples_percent NUMERIC(10, 4);
ALTER TABLE catalogo_config ADD COLUMN IF NOT EXISTS difal_percent NUMERIC(10, 4);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'catalogo_config' AND column_name = 'imposto_percentual'
  ) THEN
    UPDATE catalogo_config
    SET imposto_simples_percent = imposto_percentual
    WHERE id = 1 AND (imposto_simples_percent IS NULL OR imposto_simples_percent = 0);
  END IF;
END $$;

UPDATE catalogo_config
SET
  nome_imposto_simples = COALESCE(NULLIF(trim(nome_imposto_simples), ''), 'Imposto Simples'),
  nome_difal = COALESCE(NULLIF(trim(nome_difal), ''), 'DIFAL'),
  imposto_simples_percent = COALESCE(imposto_simples_percent, 0),
  difal_percent = COALESCE(difal_percent, 0)
WHERE id = 1;

ALTER TABLE catalogo_config DROP COLUMN IF EXISTS imposto_percentual;

ALTER TABLE catalogo_config ALTER COLUMN nome_imposto_simples SET DEFAULT 'Imposto Simples';
ALTER TABLE catalogo_config ALTER COLUMN nome_difal SET DEFAULT 'DIFAL';
ALTER TABLE catalogo_config ALTER COLUMN imposto_simples_percent SET DEFAULT 0;
ALTER TABLE catalogo_config ALTER COLUMN difal_percent SET DEFAULT 0;

ALTER TABLE catalogo_config ALTER COLUMN nome_imposto_simples SET NOT NULL;
ALTER TABLE catalogo_config ALTER COLUMN nome_difal SET NOT NULL;
ALTER TABLE catalogo_config ALTER COLUMN imposto_simples_percent SET NOT NULL;
ALTER TABLE catalogo_config ALTER COLUMN difal_percent SET NOT NULL;

COMMENT ON COLUMN catalogo_config.nome_imposto_simples IS 'Rótulo exibido no cadastro (editável)';
COMMENT ON COLUMN catalogo_config.nome_difal IS 'Rótulo exibido no cadastro (editável)';
COMMENT ON COLUMN catalogo_config.imposto_simples_percent IS '% sobre o custo (primeira camada)';
COMMENT ON COLUMN catalogo_config.difal_percent IS '% sobre o valor após o primeiro imposto';
