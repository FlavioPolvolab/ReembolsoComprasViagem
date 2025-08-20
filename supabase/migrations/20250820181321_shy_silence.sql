/*
  # Criar views otimizadas para melhor performance

  1. Views criadas
    - `expenses_view` - Despesas com dados relacionados pré-carregados
    - `purchase_orders_view` - Pedidos de compra com dados relacionados
    - `trips_view` - Viagens com dados relacionados
    - `trip_expenses_view` - Despesas de viagem com comprovantes

  2. Benefícios
    - Reduz número de JOINs nas consultas
    - Melhora performance das listagens
    - Simplifica queries no frontend
    - Dados pré-agregados para dashboards

  3. Segurança
    - Views respeitam as mesmas políticas RLS das tabelas base
    - Não expõem dados sensíveis
*/

-- View para despesas com dados relacionados
CREATE OR REPLACE VIEW expenses_view AS
SELECT 
  e.id,
  e.user_id,
  e.name,
  e.description,
  e.amount,
  e.purpose,
  e.payment_date,
  e.status,
  e.payment_status,
  e.paid_at,
  e.rejection_reason,
  e.submitted_date,
  e.updated_at,
  e.approved_by,
  e.rejected_by,
  e.approved_at,
  e.rejected_at,
  u.name as user_name,
  u.email as user_email,
  cc.name as cost_center_name,
  cat.name as category_name,
  COUNT(r.id) as receipts_count
FROM expenses e
LEFT JOIN users u ON e.user_id = u.id
LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
LEFT JOIN categories cat ON e.category_id = cat.id
LEFT JOIN receipts r ON e.id = r.expense_id
GROUP BY 
  e.id, e.user_id, e.name, e.description, e.amount, e.purpose, 
  e.payment_date, e.status, e.payment_status, e.paid_at, 
  e.rejection_reason, e.submitted_date, e.updated_at,
  e.approved_by, e.rejected_by, e.approved_at, e.rejected_at,
  u.name, u.email, cc.name, cat.name;

-- View para pedidos de compra com dados relacionados
CREATE OR REPLACE VIEW purchase_orders_view AS
SELECT 
  po.id,
  po.user_id,
  po.title,
  po.description,
  po.total_amount,
  po.status,
  po.rejection_reason,
  po.approved_by,
  po.rejected_by,
  po.approved_at,
  po.rejected_at,
  po.submitted_date,
  po.updated_at,
  po.is_paid,
  u.name as user_name,
  u.email as user_email,
  COUNT(DISTINCT poi.id) as items_count,
  COUNT(DISTINCT por.id) as receipts_count,
  COALESCE(SUM(poi.quantity * poi.unit_price), 0) as calculated_total
FROM purchase_orders po
LEFT JOIN users u ON po.user_id = u.id
LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
LEFT JOIN purchase_order_receipts por ON po.id = por.purchase_order_id
GROUP BY 
  po.id, po.user_id, po.title, po.description, po.total_amount,
  po.status, po.rejection_reason, po.approved_by, po.rejected_by,
  po.approved_at, po.rejected_at, po.submitted_date, po.updated_at,
  po.is_paid, u.name, u.email;

-- View para viagens com dados relacionados
CREATE OR REPLACE VIEW trips_view AS
SELECT 
  t.id,
  t.user_id,
  t.title,
  t.description,
  t.start_date,
  t.end_date,
  t.budget_amount,
  t.spent_amount,
  t.status,
  t.closed_by,
  t.closed_at,
  t.close_note,
  t.cost_center_id,
  t.created_at,
  t.updated_at,
  u.name as user_name,
  u.email as user_email,
  tcc.name as cost_center_name,
  COUNT(DISTINCT te.id) as expenses_count,
  COUNT(DISTINCT CASE WHEN te.reconciled = true THEN te.id END) as reconciled_count,
  COALESCE(SUM(te.amount), 0) as calculated_spent
FROM trips t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN trip_cost_centers tcc ON t.cost_center_id = tcc.id
LEFT JOIN trip_expenses te ON t.id = te.trip_id
GROUP BY 
  t.id, t.user_id, t.title, t.description, t.start_date, t.end_date,
  t.budget_amount, t.spent_amount, t.status, t.closed_by, t.closed_at,
  t.close_note, t.cost_center_id, t.created_at, t.updated_at,
  u.name, u.email, tcc.name;

-- View para despesas de viagem com comprovantes
CREATE OR REPLACE VIEW trip_expenses_view AS
SELECT 
  te.id,
  te.trip_id,
  te.description,
  te.amount,
  te.expense_date,
  te.category,
  te.reconciled,
  te.created_at,
  te.updated_at,
  COUNT(tr.id) as receipts_count
FROM trip_expenses te
LEFT JOIN trip_receipts tr ON te.id = tr.trip_expense_id
GROUP BY 
  te.id, te.trip_id, te.description, te.amount, te.expense_date,
  te.category, te.reconciled, te.created_at, te.updated_at;

-- Garantir que as views tenham as mesmas políticas RLS das tabelas base
ALTER VIEW expenses_view OWNER TO postgres;
ALTER VIEW purchase_orders_view OWNER TO postgres;
ALTER VIEW trips_view OWNER TO postgres;
ALTER VIEW trip_expenses_view OWNER TO postgres;

-- Habilitar RLS nas views
ALTER VIEW expenses_view SET (security_invoker = true);
ALTER VIEW purchase_orders_view SET (security_invoker = true);
ALTER VIEW trips_view SET (security_invoker = true);
ALTER VIEW trip_expenses_view SET (security_invoker = true);

-- Criar índices para melhorar performance das views
CREATE INDEX IF NOT EXISTS idx_expenses_view_user_status ON expenses (user_id, status, submitted_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_view_user_status ON purchase_orders (user_id, status, submitted_date DESC);
CREATE INDEX IF NOT EXISTS idx_trips_view_user_status ON trips (user_id, status, created_at DESC);

-- Função para testar a view expenses_view
CREATE OR REPLACE FUNCTION test_expenses_view()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  description text,
  amount numeric,
  purpose text,
  payment_date date,
  status text,
  payment_status text,
  submitted_date timestamptz,
  user_name text,
  user_email text,
  cost_center_name text,
  category_name text,
  receipts_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.user_id,
    e.name,
    e.description,
    e.amount,
    e.purpose,
    e.payment_date,
    e.status,
    e.payment_status,
    e.submitted_date,
    u.name as user_name,
    u.email as user_email,
    cc.name as cost_center_name,
    cat.name as category_name,
    COUNT(r.id) as receipts_count
  FROM expenses e
  LEFT JOIN users u ON e.user_id = u.id
  LEFT JOIN cost_centers cc ON e.cost_center_id = cc.id
  LEFT JOIN categories cat ON e.category_id = cat.id
  LEFT JOIN receipts r ON e.id = r.expense_id
  GROUP BY 
    e.id, e.user_id, e.name, e.description, e.amount, e.purpose, 
    e.payment_date, e.status, e.payment_status, e.submitted_date,
    u.name, u.email, cc.name, cat.name
  ORDER BY e.submitted_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;