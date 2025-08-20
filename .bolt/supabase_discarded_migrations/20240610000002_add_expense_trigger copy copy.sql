-- Adicionar trigger para atualizar o campo submitted_date automaticamente
CREATE OR REPLACE FUNCTION set_submitted_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.submitted_date IS NULL THEN
    NEW.submitted_date := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar o trigger na tabela expenses
DROP TRIGGER IF EXISTS set_submitted_date_trigger ON expenses;
CREATE TRIGGER set_submitted_date_trigger
BEFORE INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION set_submitted_date();

-- Adicionar trigger para definir o status padrão como 'pending'
CREATE OR REPLACE FUNCTION set_default_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS NULL THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar o trigger na tabela expenses
DROP TRIGGER IF EXISTS set_default_status_trigger ON expenses;
CREATE TRIGGER set_default_status_trigger
BEFORE INSERT ON expenses
FOR EACH ROW
EXECUTE FUNCTION set_default_status();