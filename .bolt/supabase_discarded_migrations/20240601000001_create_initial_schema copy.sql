-- Create users table that extends the auth.users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create cost_centers table
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  purpose TEXT NOT NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) NOT NULL,
  category_id UUID REFERENCES public.categories(id) NOT NULL,
  payment_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create receipts table
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Set up initial data for cost centers
INSERT INTO public.cost_centers (name, description) VALUES
('Institucional', 'Despesas institucionais gerais'),
('Babaçu', 'Projeto Babaçu'),
('Mel', 'Projeto Mel'),
('Milho', 'Projeto Milho'),
('Cacau', 'Projeto Cacau'),
('Caju', 'Projeto Caju'),
('Novos Projetos', 'Novos projetos em desenvolvimento'),
('Consultorias', 'Serviços de consultoria');

-- Set up initial data for categories
INSERT INTO public.categories (name, description) VALUES
('Escritório', 'Despesas de escritório e material'),
('Marketing', 'Despesas de marketing e divulgação'),
('Viagens', 'Despesas de viagens e deslocamentos'),
('Projetos', 'Despesas específicas de projetos'),
('Pessoal', 'Despesas pessoais reembolsáveis'),
('Obras e Aquisição de Bens', 'Despesas com obras e compra de bens'),
('Outros', 'Outras despesas não categorizadas');

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
DROP POLICY IF EXISTS "Users can view their own user data" ON public.users;
CREATE POLICY "Users can view their own user data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all user data" ON public.users;
CREATE POLICY "Admins can view all user data"
  ON public.users FOR SELECT
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- Create policies for cost_centers table
DROP POLICY IF EXISTS "Cost centers are viewable by all authenticated users" ON public.cost_centers;
CREATE POLICY "Cost centers are viewable by all authenticated users"
  ON public.cost_centers FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create policies for categories table
DROP POLICY IF EXISTS "Categories are viewable by all authenticated users" ON public.categories;
CREATE POLICY "Categories are viewable by all authenticated users"
  ON public.categories FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create policies for expenses table
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
CREATE POLICY "Users can view their own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
CREATE POLICY "Admins can view all expenses"
  ON public.expenses FOR SELECT
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
CREATE POLICY "Users can insert their own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own pending expenses" ON public.expenses;
CREATE POLICY "Users can update their own pending expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Admins can update any expense" ON public.expenses;
CREATE POLICY "Admins can update any expense"
  ON public.expenses FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- Create policies for receipts table
DROP POLICY IF EXISTS "Users can view receipts for their own expenses" ON public.receipts;
CREATE POLICY "Users can view receipts for their own expenses"
  ON public.receipts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.expenses
    WHERE expenses.id = receipts.expense_id
    AND expenses.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can view all receipts" ON public.receipts;
CREATE POLICY "Admins can view all receipts"
  ON public.receipts FOR SELECT
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Users can insert receipts for their own expenses" ON public.receipts;
CREATE POLICY "Users can insert receipts for their own expenses"
  ON public.receipts FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses
    WHERE expenses.id = receipts.expense_id
    AND expenses.user_id = auth.uid()
  ));

-- Create storage policies
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;
CREATE POLICY "Users can view their own receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts' AND
    EXISTS (
      SELECT 1 FROM public.receipts
      JOIN public.expenses ON receipts.expense_id = expenses.id
      WHERE receipts.storage_path = storage.objects.name
      AND expenses.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all receipts" ON storage.objects;
CREATE POLICY "Admins can view all receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts' AND
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Enable realtime for all tables
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.cost_centers;
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.receipts;
