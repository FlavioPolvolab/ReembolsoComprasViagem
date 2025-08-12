-- Criação do modelo de pedidos de compras

-- Enum para status do pedido de compra
CREATE TYPE purchase_order_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

-- Tabela de pedidos de compras
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  status purchase_order_status DEFAULT 'pending',
  rejection_reason TEXT,
  approved_by UUID REFERENCES users(id),
  rejected_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  submitted_date TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de itens do pedido de compra
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de comprovantes do pedido de compra
CREATE TABLE IF NOT EXISTS purchase_order_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de histórico de pedidos de compras
CREATE TABLE IF NOT EXISTS purchase_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  previous_status purchase_order_status,
  new_status purchase_order_status,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Função para atualizar histórico de pedidos de compras
CREATE OR REPLACE FUNCTION update_purchase_order_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO purchase_order_history (purchase_order_id, user_id, action, previous_status, new_status)
    VALUES (NEW.id, COALESCE(NEW.approved_by, NEW.rejected_by, NEW.user_id), 'Status changed', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para histórico de pedidos de compras
DROP TRIGGER IF EXISTS purchase_order_history_trigger ON purchase_orders;
CREATE TRIGGER purchase_order_history_trigger
AFTER UPDATE ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION update_purchase_order_history();

-- Função para aprovar pedido de compra
CREATE OR REPLACE FUNCTION approve_purchase_order(order_id UUID, approver_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  can_approve BOOLEAN;
BEGIN
  -- Verifica se o usuário tem papel de aprovador
  SELECT user_has_role(approver_id, 'approver') INTO can_approve;
  IF NOT can_approve THEN
    RAISE EXCEPTION 'User does not have permission to approve purchase orders';
    RETURN FALSE;
  END IF;
  UPDATE purchase_orders
  SET status = 'approved',
      approved_by = approver_id,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = order_id AND status = 'pending';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Função para rejeitar pedido de compra
CREATE OR REPLACE FUNCTION reject_purchase_order(order_id UUID, rejector_id UUID, reason TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  can_reject BOOLEAN;
BEGIN
  SELECT user_has_role(rejector_id, 'rejector') INTO can_reject;
  IF NOT can_reject THEN
    RAISE EXCEPTION 'User does not have permission to reject purchase orders';
    RETURN FALSE;
  END IF;
  UPDATE purchase_orders
  SET status = 'rejected',
      rejected_by = rejector_id,
      rejected_at = NOW(),
      rejection_reason = reason,
      updated_at = NOW()
  WHERE id = order_id AND status = 'pending';
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Função para deletar pedido de compra
CREATE OR REPLACE FUNCTION delete_purchase_order(order_id UUID, deleter_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  can_delete BOOLEAN;
BEGIN
  SELECT user_has_role(deleter_id, 'deleter') INTO can_delete;
  IF NOT can_delete THEN
    RAISE EXCEPTION 'User does not have permission to delete purchase orders';
    RETURN FALSE;
  END IF;
  DELETE FROM purchase_orders WHERE id = order_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql; 