-- Fix database schema and add admin user

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create categories table if not exists
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create cost_centers table if not exists
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create users table if not exists
-- Note: We're not dropping the role column as it's referenced by other objects
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  roles TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create expenses table if not exists
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  purpose TEXT NOT NULL,
  cost_center_id UUID NOT NULL REFERENCES cost_centers(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  payment_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create receipts table if not exists
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES expenses(id),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create function to add role to user
CREATE OR REPLACE FUNCTION add_role_to_user(
  target_user_id UUID,
  new_role TEXT,
  admin_user_id UUID
) RETURNS VOID AS $$
DECLARE
  admin_role TEXT;
  current_roles TEXT[];
BEGIN
  -- Check if the user performing the action is an admin
  SELECT role INTO admin_role FROM users WHERE id = admin_user_id;
  IF admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can add roles';
  END IF;
  
  -- Get current roles
  SELECT roles INTO current_roles FROM users WHERE id = target_user_id;
  
  -- Add the new role if not already present
  IF NOT new_role = ANY(current_roles) THEN
    UPDATE users SET roles = array_append(roles, new_role) WHERE id = target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to remove role from user
CREATE OR REPLACE FUNCTION remove_role_from_user(
  target_user_id UUID,
  role_to_remove TEXT,
  admin_user_id UUID
) RETURNS VOID AS $$
DECLARE
  admin_role TEXT;
  current_roles TEXT[];
BEGIN
  -- Check if the user performing the action is an admin
  SELECT role INTO admin_role FROM users WHERE id = admin_user_id;
  IF admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can remove roles';
  END IF;
  
  -- Get current roles
  SELECT roles INTO current_roles FROM users WHERE id = target_user_id;
  
  -- Remove the role
  UPDATE users SET roles = array_remove(roles, role_to_remove) WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to promote user to admin
CREATE OR REPLACE FUNCTION promote_to_admin(user_email TEXT) RETURNS VOID AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get the user ID
  SELECT id INTO target_user_id FROM users WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Set the role to admin
  UPDATE users SET role = 'admin' WHERE id = target_user_id;
  
  -- Add admin to roles array if not already present
  UPDATE users 
  SET roles = array_append(roles, 'admin') 
  WHERE id = target_user_id AND NOT 'admin' = ANY(roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample categories if they don't exist
INSERT INTO categories (id, name, description, created_at, updated_at)
VALUES 
  ('22624be8-ba65-4bf0-810f-c68fbc10a6fd', 'Obras e Aquisição de Bens', 'Despesas com obras e compra de bens', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('27200362-1cc2-4cad-9e47-a4dbdc6bc225', 'Escritório', 'Despesas de escritório e material', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('3db71986-0b1f-4781-8134-bdd679a5578f', 'Viagens', 'Despesas de viagens e deslocamentos', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('9cbfb3fe-7237-44da-b2db-db1b23471225', 'Pessoal', 'Despesas pessoais reembolsáveis', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('9e30e5f1-2780-4b1b-b5c2-fa7c23512a0d', 'Marketing', 'Despesas de marketing e divulgação', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('a6def5f1-c47a-40d9-9fef-a38a50d1446f', 'Projetos', 'Despesas específicas de projetos', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('c513f6d4-f46d-466b-8491-6faae3ac0e59', 'Outros', 'Outras despesas não categorizadas', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0')
ON CONFLICT (id) DO NOTHING;

-- Insert sample cost centers if they don't exist
INSERT INTO cost_centers (id, name, description, created_at, updated_at)
VALUES 
  ('27905624-e277-4739-b8f8-1240606f66b8', 'Milho', 'Projeto Milho', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('32e5bb98-5fc0-4888-a5cd-7ac8b312539c', 'Babaçu', 'Projeto Babaçu', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('539973ee-6fa0-4570-8bc9-a829da483d60', 'Mel', 'Projeto Mel', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('7163455e-2a1b-4d3b-91b3-59062265faa0', 'Consultorias', 'Serviços de consultoria', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('8fa927e1-1ec2-49a4-86cd-49235baa0237', 'Institucional', 'Despesas institucionais gerais', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('b52b68a6-0f4b-47d5-b9ff-6b162233ae05', 'Cacau', 'Projeto Cacau', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('de9e5887-d878-4948-8d4b-1cedaab151a9', 'Caju', 'Projeto Caju', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0'),
  ('fa39686f-198f-4842-bfb8-1eece7efbb2f', 'Novos Projetos', 'Novos projetos em desenvolvimento', '2025-05-22 15:57:56.368354+0', '2025-05-22 15:57:56.368354+0')
ON CONFLICT (id) DO NOTHING;

-- Create admin user in auth.users and public.users
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'flavio@polvolab.co';
  
  IF admin_user_id IS NULL THEN
    -- Create user in auth.users
    INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
      'flavio@polvolab.co',
      crypt('17Is@pan', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id INTO admin_user_id;
  END IF;
  
  -- Create or update user in public.users
  INSERT INTO public.users (id, name, email, role, roles, created_at, updated_at)
  VALUES (
    admin_user_id,
    'Flavio Admin',
    'flavio@polvolab.co',
    'admin',
    ARRAY['admin', 'submitter', 'approver', 'rejector', 'deleter'],
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    roles = ARRAY['admin', 'submitter', 'approver', 'rejector', 'deleter'],
    updated_at = NOW();
  
  -- Ensure user is in auth.users
  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create admin user';
  END IF;
END;
$$;

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE cost_centers;
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE receipts;

-- Função para atualizar o total_amount da ordem de compra
create or replace function update_purchase_order_total()
returns trigger as $$
begin
  update purchase_orders
  set total_amount = (
    select coalesce(sum(unit_price * quantity), 0)
    from purchase_order_items
    where purchase_order_id = NEW.purchase_order_id
  )
  where id = NEW.purchase_order_id;
  return NEW;
end;
$$ language plpgsql;

-- Trigger para INSERT, UPDATE, DELETE em purchase_order_items
drop trigger if exists trg_update_purchase_order_total on purchase_order_items;
create trigger trg_update_purchase_order_total
after insert or update or delete on purchase_order_items
for each row
execute function update_purchase_order_total();
