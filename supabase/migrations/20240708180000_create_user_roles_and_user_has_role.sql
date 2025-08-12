-- Migration: user roles compartilhados para reembolso e pedidos de compras

-- Cria a tabela de papéis do usuário se não existir
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

-- Cria ou substitui a função user_has_role
CREATE OR REPLACE FUNCTION user_has_role(uid UUID, role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = uid AND role = role
  );
END;
$$ LANGUAGE plpgsql; 