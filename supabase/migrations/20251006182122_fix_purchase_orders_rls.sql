/*
  # Fix Purchase Orders RLS Policies

  ## Problem
  - RLS is disabled on purchase_orders table
  - Missing INSERT, UPDATE, and DELETE policies
  - Users cannot create new purchase orders

  ## Changes
  1. Enable RLS on purchase_orders table
  2. Add INSERT policy for authenticated users
  3. Add UPDATE policy for order owners
  4. Add DELETE policy for order owners (pending status only)
  5. Clean up duplicate SELECT policies

  ## Security
  - Users can only insert their own orders
  - Users can only update/delete their own pending orders
  - Admins can view all orders (existing policy)
*/

-- Enable RLS on purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Drop duplicate/old policies
DROP POLICY IF EXISTS "purchase_orders_select_policy" ON purchase_orders;

-- Keep the admin view policy and add user view policy
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_orders' 
    AND policyname = 'Users can view own orders'
  ) THEN
    CREATE POLICY "Users can view own orders"
      ON purchase_orders
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Add INSERT policy
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_orders' 
    AND policyname = 'Users can create own orders'
  ) THEN
    CREATE POLICY "Users can create own orders"
      ON purchase_orders
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Add UPDATE policy (only for pending orders)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_orders' 
    AND policyname = 'Users can update own pending orders'
  ) THEN
    CREATE POLICY "Users can update own pending orders"
      ON purchase_orders
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid() AND status = 'pending')
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Add DELETE policy (only for pending orders)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_orders' 
    AND policyname = 'Users can delete own pending orders'
  ) THEN
    CREATE POLICY "Users can delete own pending orders"
      ON purchase_orders
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid() AND status = 'pending');
  END IF;
END $$;

-- Ensure purchase_order_receipts has proper policies
ALTER TABLE purchase_order_receipts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_receipts' 
    AND policyname = 'Users can view receipts of own orders'
  ) THEN
    CREATE POLICY "Users can view receipts of own orders"
      ON purchase_order_receipts
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM purchase_orders
          WHERE purchase_orders.id = purchase_order_receipts.purchase_order_id
          AND purchase_orders.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_order_receipts' 
    AND policyname = 'Users can insert receipts for own orders'
  ) THEN
    CREATE POLICY "Users can insert receipts for own orders"
      ON purchase_order_receipts
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM purchase_orders
          WHERE purchase_orders.id = purchase_order_receipts.purchase_order_id
          AND purchase_orders.user_id = auth.uid()
        )
      );
  END IF;
END $$;
