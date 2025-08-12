-- Adicionar campos de status de pagamento
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
ADD COLUMN IF NOT EXISTS paid_at timestamptz DEFAULT NULL;

-- Criar índice para melhor performance em consultas por status de pagamento
CREATE INDEX IF NOT EXISTS idx_expenses_payment_status ON expenses(payment_status);

-- Atualizar a política de segurança para permitir atualização do status de pagamento
CREATE POLICY "Permitir atualização de status de pagamento por administradores"
ON expenses
FOR UPDATE
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE role = 'admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM users WHERE role = 'admin'
  )
); 