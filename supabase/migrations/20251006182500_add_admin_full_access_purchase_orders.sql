/*
  # Add Admin Full Access to Purchase Orders

  ## Changes
  1. Add admin policies for full access to purchase_orders
  2. Add admin policies for purchase_order_items
  3. Add admin policies for purchase_order_receipts

  ## Security
  - Admins (role = 'admin') have full SELECT, INSERT, UPDATE, DELETE access
  - Regular users maintain their existing restricted access
*/

-- Admin policies for purchase_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purchase_orders'
    AND policyname = 'Admins have full select access to all orders'
  ) THEN
    CREATE POLICY "Admins have full select access to all orders"
      ON purchase_orders
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purchase_orders'
    AND policyname = 'Admins can insert any order'
  ) THEN
    CREATE POLICY "Admins can insert any order"
      ON purchase_orders
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purchase_orders'
    AND policyname = 'Admins can update any order'
  ) THEN
    CREATE POLICY "Admins can update any order"
      ON purchase_orders
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purchase_orders'
    AND policyname = 'Admins can delete any order'
  ) THEN
    CREATE POLICY "Admins can delete any order"
      ON purchase_orders
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- Admin policies for purchase_order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purchase_order_items'
    AND policyname = 'Admins have full access to all items'
  ) THEN
    CREATE POLICY "Admins have full access to all items"
      ON purchase_order_items
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- Admin policies for purchase_order_receipts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purchase_order_receipts'
    AND policyname = 'Admins can view all receipts'
  ) THEN
    CREATE POLICY "Admins can view all receipts"
      ON purchase_order_receipts
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purchase_order_receipts'
    AND policyname = 'Admins can insert any receipt'
  ) THEN
    CREATE POLICY "Admins can insert any receipt"
      ON purchase_order_receipts
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purchase_order_receipts'
    AND policyname = 'Admins can update any receipt'
  ) THEN
    CREATE POLICY "Admins can update any receipt"
      ON purchase_order_receipts
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'purchase_order_receipts'
    AND policyname = 'Admins can delete any receipt'
  ) THEN
    CREATE POLICY "Admins can delete any receipt"
      ON purchase_order_receipts
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;
