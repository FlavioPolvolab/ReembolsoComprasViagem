/*
  # Admin Full Access to Purchase Orders
  
  1. Changes
    - Add admin policies for UPDATE, DELETE operations on purchase_orders
    - Add admin policies for all operations on purchase_order_items
    - Add admin policies for all operations on purchase_order_receipts
    - Ensure admins can approve, reject, and delete any purchase order
  
  2. Security
    - All admin policies verify user has 'admin' role in users.roles array
    - Admins have full access to view, create, update, and delete all purchase-related records
*/

-- Purchase Orders: Admin UPDATE policy (approve, reject, modify any order)
DO $$ BEGIN
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
          AND 'admin' = ANY(users.roles)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;

-- Purchase Orders: Admin DELETE policy
DO $$ BEGIN
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
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;

-- Purchase Orders: Admin INSERT policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_orders' 
    AND policyname = 'Admins can create orders for anyone'
  ) THEN
    CREATE POLICY "Admins can create orders for anyone"
      ON purchase_orders
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;

-- Purchase Order Items: Admin SELECT policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_items' 
    AND policyname = 'Admins can view all items'
  ) THEN
    CREATE POLICY "Admins can view all items"
      ON purchase_order_items
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;

-- Purchase Order Items: Admin UPDATE policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_items' 
    AND policyname = 'Admins can update all items'
  ) THEN
    CREATE POLICY "Admins can update all items"
      ON purchase_order_items
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;

-- Purchase Order Items: Admin DELETE policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_items' 
    AND policyname = 'Admins can delete all items'
  ) THEN
    CREATE POLICY "Admins can delete all items"
      ON purchase_order_items
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;

-- Purchase Order Receipts: Admin SELECT policy
DO $$ BEGIN
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
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;

-- Purchase Order Receipts: Admin INSERT policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_receipts' 
    AND policyname = 'Admins can insert all receipts'
  ) THEN
    CREATE POLICY "Admins can insert all receipts"
      ON purchase_order_receipts
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;

-- Purchase Order Receipts: Admin UPDATE policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_receipts' 
    AND policyname = 'Admins can update all receipts'
  ) THEN
    CREATE POLICY "Admins can update all receipts"
      ON purchase_order_receipts
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;

-- Purchase Order Receipts: Admin DELETE policy
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_receipts' 
    AND policyname = 'Admins can delete all receipts'
  ) THEN
    CREATE POLICY "Admins can delete all receipts"
      ON purchase_order_receipts
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND 'admin' = ANY(users.roles)
        )
      );
  END IF;
END $$;
