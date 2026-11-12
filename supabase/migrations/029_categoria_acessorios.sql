-- Categoria para supressores (sem depender de UNIQUE em categorias.nome)
INSERT INTO categorias (id, nome)
SELECT COALESCE((SELECT MAX(id) FROM categorias), 0) + 1, 'Acessórios'
WHERE NOT EXISTS (
  SELECT 1 FROM categorias WHERE TRIM(nome) = 'Acessórios'
);
