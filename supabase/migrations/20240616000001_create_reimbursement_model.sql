-- Create enum for expense status
CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('user', 'admin', 'submitter', 'approver', 'rejector', 'deleter');

-- Update users table to include role as enum
ALTER TABLE users
ADD COLUMN IF NOT EXISTS roles user_role[] DEFAULT ARRAY['user']::user_role[];

-- Create expense categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cost centers table
CREATE TABLE IF NOT EXISTS cost_centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  purpose TEXT,
  category_id UUID REFERENCES expense_categories(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  payment_date DATE,
  status expense_status DEFAULT 'pending',
  rejection_reason TEXT,
  approved_by UUID REFERENCES users(id),
  rejected_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create receipts table for storing expense receipts
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expense history table for audit trail
CREATE TABLE IF NOT EXISTS expense_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  previous_status expense_status,
  new_status expense_status,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to update expense history
CREATE OR REPLACE FUNCTION update_expense_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO expense_history (expense_id, user_id, action, previous_status, new_status)
    VALUES (NEW.id, COALESCE(NEW.approved_by, NEW.rejected_by, NEW.user_id), 
            'Status changed', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for expense history
DROP TRIGGER IF EXISTS expense_history_trigger ON expenses;
CREATE TRIGGER expense_history_trigger
AFTER UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_expense_history();

-- Create function to check if user has a specific role
CREATE OR REPLACE FUNCTION user_has_role(user_id UUID, role user_role)
RETURNS BOOLEAN AS $$
DECLARE
  user_roles user_role[];
BEGIN
  SELECT roles INTO user_roles FROM users WHERE id = user_id;
  RETURN role = ANY(user_roles) OR 'admin' = ANY(user_roles);
END;
$$ LANGUAGE plpgsql;

-- Create function to approve expense
CREATE OR REPLACE FUNCTION approve_expense(expense_id UUID, approver_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  can_approve BOOLEAN;
BEGIN
  -- Check if user has approver role
  SELECT user_has_role(approver_id, 'approver') INTO can_approve;
  
  IF NOT can_approve THEN
    RAISE EXCEPTION 'User does not have permission to approve expenses';
    RETURN FALSE;
  END IF;
  
  -- Update expense status
  UPDATE expenses
  SET status = 'approved',
      approved_by = approver_id,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = expense_id AND status = 'pending';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to reject expense
CREATE OR REPLACE FUNCTION reject_expense(expense_id UUID, rejector_id UUID, reason TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  can_reject BOOLEAN;
BEGIN
  -- Check if user has rejector role
  SELECT user_has_role(rejector_id, 'rejector') INTO can_reject;
  
  IF NOT can_reject THEN
    RAISE EXCEPTION 'User does not have permission to reject expenses';
    RETURN FALSE;
  END IF;
  
  -- Update expense status
  UPDATE expenses
  SET status = 'rejected',
      rejected_by = rejector_id,
      rejected_at = NOW(),
      rejection_reason = reason,
      updated_at = NOW()
  WHERE id = expense_id AND status = 'pending';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to delete expense
CREATE OR REPLACE FUNCTION delete_expense(expense_id UUID, deleter_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  can_delete BOOLEAN;
BEGIN
  -- Check if user has deleter role
  SELECT user_has_role(deleter_id, 'deleter') INTO can_delete;
  
  IF NOT can_delete THEN
    RAISE EXCEPTION 'User does not have permission to delete expenses';
    RETURN FALSE;
  END IF;
  
  -- Delete expense
  DELETE FROM expenses WHERE id = expense_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to add role to user
CREATE OR REPLACE FUNCTION add_role_to_user(target_user_id UUID, new_role user_role, admin_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
  current_roles user_role[];
BEGIN
  -- Check if admin_user_id is an admin
  SELECT 'admin' = ANY(roles) INTO is_admin FROM users WHERE id = admin_user_id;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only administrators can modify user roles';
    RETURN FALSE;
  END IF;
  
  -- Get current roles
  SELECT roles INTO current_roles FROM users WHERE id = target_user_id;
  
  -- Add new role if not already present
  IF NOT (new_role = ANY(current_roles)) THEN
    UPDATE users
    SET roles = array_append(roles, new_role)
    WHERE id = target_user_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to remove role from user
CREATE OR REPLACE FUNCTION remove_role_from_user(target_user_id UUID, role_to_remove user_role, admin_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if admin_user_id is an admin
  SELECT 'admin' = ANY(roles) INTO is_admin FROM users WHERE id = admin_user_id;
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only administrators can modify user roles';
    RETURN FALSE;
  END IF;
  
  -- Remove role
  UPDATE users
  SET roles = array_remove(roles, role_to_remove)
  WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Insert some default categories
INSERT INTO expense_categories (name, description)
VALUES 
  ('Alimentação', 'Despesas com refeições e lanches'),
  ('Transporte', 'Despesas com transporte como táxi, ônibus, metrô'),
  ('Hospedagem', 'Despesas com hotéis e acomodações'),
  ('Material de Escritório', 'Compras de materiais para escritório'),
  ('Eventos', 'Despesas relacionadas a eventos corporativos')
ON CONFLICT DO NOTHING;

-- Insert some default cost centers
INSERT INTO cost_centers (name, code, description)
VALUES 
  ('Marketing', 'MKT-001', 'Departamento de Marketing'),
  ('Vendas', 'VND-001', 'Departamento de Vendas'),
  ('TI', 'TI-001', 'Departamento de Tecnologia da Informação'),
  ('RH', 'RH-001', 'Recursos Humanos'),
  ('Financeiro', 'FIN-001', 'Departamento Financeiro')
ON CONFLICT DO NOTHING;

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT DO NOTHING;

-- Set up storage policies for receipts bucket
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Users can view their own receipts" ON storage.objects;
CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Admins and approvers can view all receipts" ON storage.objects;
CREATE POLICY "Admins and approvers can view all receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND 
    ('admin' = ANY(roles) OR 'approver' = ANY(roles) OR 'rejector' = ANY(roles))
  )
);

-- Enable RLS on the tables
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_history ENABLE ROW LEVEL SECURITY;

-- Create policies for expenses table
DROP POLICY IF EXISTS "Users can view their own expenses" ON expenses;
CREATE POLICY "Users can view their own expenses"
ON expenses FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins and approvers can view all expenses" ON expenses;
CREATE POLICY "Admins and approvers can view all expenses"
ON expenses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND 
    ('admin' = ANY(roles) OR 'approver' = ANY(roles) OR 'rejector' = ANY(roles))
  )
);

DROP POLICY IF EXISTS "Users can insert their own expenses" ON expenses;
CREATE POLICY "Users can insert their own expenses"
ON expenses FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND 
    ('submitter' = ANY(roles) OR 'admin' = ANY(roles))
  )
);

DROP POLICY IF EXISTS "Users can update their own pending expenses" ON expenses;
CREATE POLICY "Users can update their own pending expenses"
ON expenses FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Approvers can approve expenses" ON expenses;
CREATE POLICY "Approvers can approve expenses"
ON expenses FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND 
    ('approver' = ANY(roles) OR 'admin' = ANY(roles))
  ) AND
  status = 'pending'
)
WITH CHECK (
  status = 'approved' AND
  approved_by = auth.uid()
);

DROP POLICY IF EXISTS "Rejectors can reject expenses" ON expenses;
CREATE POLICY "Rejectors can reject expenses"
ON expenses FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND 
    ('rejector' = ANY(roles) OR 'admin' = ANY(roles))
  ) AND
  status = 'pending'
)
WITH CHECK (
  status = 'rejected' AND
  rejected_by = auth.uid()
);

DROP POLICY IF EXISTS "Deleters can delete expenses" ON expenses;
CREATE POLICY "Deleters can delete expenses"
ON expenses FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND 
    ('deleter' = ANY(roles) OR 'admin' = ANY(roles))
  )
);

-- Add realtime for all tables
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table receipts;
alter publication supabase_realtime add table expense_categories;
alter publication supabase_realtime add table cost_centers;
alter publication supabase_realtime add table expense_history;
