-- Inserir categorias de despesas
INSERT INTO categories (id, name, description, created_at)
VALUES 
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Viagens', 'Despesas relacionadas a viagens de trabalho', NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Escritório', 'Material de escritório e suprimentos', NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Marketing', 'Despesas com marketing e publicidade', NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Projetos', 'Despesas específicas de projetos', NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Alimentação', 'Refeições e lanches', NOW()),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Transporte', 'Táxi, Uber, ônibus e outros transportes', NOW())
ON CONFLICT (id) DO NOTHING;

-- Inserir centros de custo
INSERT INTO cost_centers (id, name, description, created_at)
VALUES 
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Institucional', 'Despesas institucionais gerais', NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Babaçu', 'Projeto Babaçu', NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Mel', 'Projeto Mel', NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Milho', 'Projeto Milho', NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Cacau', 'Projeto Cacau', NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'Caju', 'Projeto Caju', NOW()),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Novos Projetos', 'Desenvolvimento de novos projetos', NOW())
ON CONFLICT (id) DO NOTHING;

-- Nota: As despesas serão criadas pela aplicação quando os usuários forem criados
-- pois precisamos dos IDs dos usuários reais