export interface PurchaseOrder {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  total_amount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  rejection_reason?: string;
  approved_by?: string;
  rejected_by?: string;
  approved_at?: string;
  rejected_at?: string;
  submitted_date?: string;
  updated_at?: string;
  is_paid?: boolean;
  // Adicionados para exibição na tabela
  user_name?: string;
  cost_center?: string;
  category?: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at?: string;
}

export interface PurchaseOrderReceipt {
  id: string;
  purchase_order_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at?: string;
} 