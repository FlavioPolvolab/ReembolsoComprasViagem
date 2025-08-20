-- Migration: admin tem acesso a todos os papéis

CREATE OR REPLACE FUNCTION user_has_role(uid UUID, role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = uid AND (role = role OR role = 'admin')
  );
END;
$$ LANGUAGE plpgsql; 