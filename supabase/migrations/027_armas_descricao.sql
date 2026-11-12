-- Texto livre do produto (folder, diferenciais, CAL.)
ALTER TABLE armas
  ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN armas.descricao IS 'Descrição livre do produto, exibida na ficha';
