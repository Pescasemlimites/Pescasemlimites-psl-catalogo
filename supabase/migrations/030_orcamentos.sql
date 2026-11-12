-- Orçamentos (pacotes) — uso exclusivo admin

CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT,
  cliente_nome TEXT,
  observacoes TEXT,
  desconto_tipo TEXT CHECK (desconto_tipo IS NULL OR desconto_tipo IN ('percent', 'fixed')),
  desconto_valor NUMERIC(12, 2) DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  validade DATE,
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES orcamentos (id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL CHECK (tipo IN ('arma', 'acessorio')),
  arma_id UUID REFERENCES armas (id) ON DELETE SET NULL,
  variacao_id UUID REFERENCES variacoes_armas (id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  detalhe TEXT,
  quantidade INT NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unitario NUMERIC(12, 2) NOT NULL,
  foto_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento ON orcamento_itens (orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_created_at ON orcamentos (created_at DESC);

ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamentos_admin_all ON orcamentos;
CREATE POLICY orcamentos_admin_all
  ON orcamentos FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS orcamento_itens_admin_all ON orcamento_itens;
CREATE POLICY orcamento_itens_admin_all
  ON orcamento_itens FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
