/*
  # Cleanup Overly Permissive Policies on Purchase Order Items
  
  ## Problem
  - There are legacy "Allow * for all" policies with role {public}
  - These policies allow unrestricted access to purchase_order_items
  - They conflict with proper RLS security model
  
  ## Changes
  1. Drop overly permissive policies that allow public access
  2. Keep only properly scoped policies for authenticated users and admins
  
  ## Security
  - Removes security vulnerability from public access policies
  - Ensures only authenticated users with proper ownership can access data
  - Maintains admin full access and user scoped access
*/

-- Drop overly permissive public policies
DROP POLICY IF EXISTS "Allow select for all" ON purchase_order_items;
DROP POLICY IF EXISTS "Allow insert for all" ON purchase_order_items;
DROP POLICY IF EXISTS "Allow update for all" ON purchase_order_items;
DROP POLICY IF EXISTS "Allow delete for all" ON purchase_order_items;

-- Verify RLS is enabled
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
