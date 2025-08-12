-- Verificar e criar tabelas necessárias se não existirem

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar realtime para usuários
alter publication supabase_realtime add table users;

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar realtime para categorias
alter publication supabase_realtime add table categories;

-- Tabela de centros de custo
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar realtime para centros de custo
alter publication supabase_realtime add table cost_centers;

-- Tabela de despesas
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  purpose TEXT NOT NULL,
  cost_center_id UUID REFERENCES cost_centers(id),
  category_id UUID REFERENCES categories(id),
  payment_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar realtime para despesas
alter publication supabase_realtime add table expenses;

-- Tabela de comprovantes
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar realtime para comprovantes
alter publication supabase_realtime add table receipts;

-- Inserir categorias padrão se não existirem
INSERT INTO categories (name)
VALUES 
  ('Viagens'),
  ('Escritório'),
  ('Pessoal'),
  ('Projetos'),
  ('Marketing')
ON CONFLICT DO NOTHING;

-- Inserir centros de custo padrão se não existirem
INSERT INTO cost_centers (name)
VALUES 
  ('Institucional'),
  ('Babaçu'),
  ('Mel'),
  ('Milho'),
  ('Cacau'),
  ('Caju'),
  ('Novos Projetos')
ON CONFLICT DO NOTHING;

-- Criar bucket para armazenar comprovantes se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'receipts'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('receipts', 'receipts', false);
  END IF;
END $$;

-- Criar políticas de acesso para o bucket de comprovantes
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
CREATE POLICY "Usuários autenticados podem fazer upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar seus próprios comprovantes" ON storage.objects;
CREATE POLICY "Usuários autenticados podem visualizar seus próprios comprovantes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'receipts');

-- Criar função para promover usuário a administrador
CREATE OR REPLACE FUNCTION promote_to_admin(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET role = 'admin'
  WHERE email = user_email;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado', user_email;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para criar perfil de usuário automaticamente após registro
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificar se o trigger já existe e criar se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'create_user_profile_trigger'
  ) THEN
    CREATE TRIGGER create_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_user_profile();
  END IF;
END $$;
