/*
  # Fix RLS Policies for Purchase Order Items - Allow Regular Users
  
  ## Problem
  - Users cannot insert items into their own purchase orders
  - purchase_order_items table only has admin policies
  - Regular users get RLS policy violation when creating purchase orders with items
  
  ## Changes
  1. Enable RLS on purchase_order_items table (if not already enabled)
  2. Add SELECT policy for users to view items of their own orders
  3. Add INSERT policy for users to add items to their own orders
  4. Add UPDATE policy for users to update items of their own pending orders
  5. Add DELETE policy for users to delete items from their own pending orders
  
  ## Security
  - Users can only manage items that belong to purchase orders they own
  - Users can only modify items in orders with 'pending' status
  - Admin policies remain unchanged (full access)
*/

-- Ensure RLS is enabled on purchase_order_items
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Users can view items of their own orders
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_items' 
    AND policyname = 'Users can view items of own orders'
  ) THEN
    CREATE POLICY "Users can view items of own orders"
      ON purchase_order_items
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM purchase_orders
          WHERE purchase_orders.id = purchase_order_items.purchase_order_id
          AND purchase_orders.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Users can insert items into their own orders
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_items' 
    AND policyname = 'Users can insert items into own orders'
  ) THEN
    CREATE POLICY "Users can insert items into own orders"
      ON purchase_order_items
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM purchase_orders
          WHERE purchase_orders.id = purchase_order_items.purchase_order_id
          AND purchase_orders.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Users can update items of their own pending orders
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_items' 
    AND policyname = 'Users can update items of own pending orders'
  ) THEN
    CREATE POLICY "Users can update items of own pending orders"
      ON purchase_order_items
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM purchase_orders
          WHERE purchase_orders.id = purchase_order_items.purchase_order_id
          AND purchase_orders.user_id = auth.uid()
          AND purchase_orders.status = 'pending'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM purchase_orders
          WHERE purchase_orders.id = purchase_order_items.purchase_order_id
          AND purchase_orders.user_id = auth.uid()
          AND purchase_orders.status = 'pending'
        )
      );
  END IF;
END $$;

-- Users can delete items from their own pending orders
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_items' 
    AND policyname = 'Users can delete items from own pending orders'
  ) THEN
    CREATE POLICY "Users can delete items from own pending orders"
      ON purchase_order_items
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM purchase_orders
          WHERE purchase_orders.id = purchase_order_items.purchase_order_id
          AND purchase_orders.user_id = auth.uid()
          AND purchase_orders.status = 'pending'
        )
      );
  END IF;
END $$;
