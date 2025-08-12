import { supabase } from "@/lib/supabase";
import { withTimeout, retry } from "@/lib/utils";

export const fetchPurchaseOrders = async (userId?: string, isAdmin?: boolean) => {
  let query = (supabase as any)
    .from("purchase_orders")
    .select("*, users:user_id(name)")
    .order("submitted_date", { ascending: false });
  if (!isAdmin && userId) {
    query = query.eq("user_id", userId);
  }
  const exec = async () => await query;
  const { data, error } = await withTimeout(retry(exec, 2), 12000) as any;
  if (error) throw error;
  // Preencher user_name
  const pedidos = (data || []).map((p: any) => ({
    ...p,
    user_name: p.users?.name || "-"
  }));
  return pedidos;
};

export const uploadPurchaseOrderReceipt = async (purchaseOrderId: string, file: File) => {
  const fileExt = file.name.split(".").pop();
  const fileName = `${purchaseOrderId}/${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Upload para o bucket receipts (mesmo do reembolso)
  const { error: uploadError } = await (supabase as any).storage
    .from("receipts")
    .upload(filePath, file);
  if (uploadError) throw uploadError;

  // Registrar no banco
  const { error: dbError } = await (supabase as any)
    .from("purchase_order_receipts")
    .insert({
      purchase_order_id: purchaseOrderId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: filePath,
    });
  if (dbError) throw dbError;

  return true;
};

export const fetchPurchaseOrderItems = async (purchaseOrderId: string) => {
  const { data, error } = await withTimeout(
    retry(async () => await (supabase as any)
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId)
      .order("created_at", { ascending: true }), 2),
    12000
  ) as any;
  if (error) throw error;
  return data;
};

export const addPurchaseOrderItem = async (purchaseOrderId: string, name: string, quantity: number, unit_price: number) => {
  const res1: any = await withTimeout(
    retry(async () => await (supabase as any)
      .from("purchase_order_items")
      .insert({
        purchase_order_id: purchaseOrderId,
        name,
        quantity,
        unit_price
      }), 2),
    12000
  );
  const { error } = res1 || {};
  if (error) throw error;
  return true;
};

export const updatePurchaseOrderItem = async (itemId: string, name: string, quantity: number, unit_price: number) => {
  const res2: any = await withTimeout(
    retry(async () => await (supabase as any)
      .from("purchase_order_items")
      .update({ name, quantity, unit_price })
      .eq("id", itemId), 2),
    12000
  );
  const { error } = res2 || {};
  if (error) throw error;
  return true;
};

export const deletePurchaseOrderItem = async (itemId: string) => {
  const res3: any = await withTimeout(
    retry(async () => await (supabase as any)
      .from("purchase_order_items")
      .delete()
      .eq("id", itemId), 2),
    12000
  );
  const { error } = res3 || {};
  if (error) throw error;
  return true;
};

export const approvePurchaseOrder = async (orderId: string, approverId: string) => {
  const res4: any = await withTimeout(
    retry(async () => await (supabase as any).rpc("approve_purchase_order", {
      order_id: orderId,
      approver_id: approverId,
    }), 2),
    12000
  );
  const { error } = res4 || {};
  if (error) throw error;
  return true;
};

export const rejectPurchaseOrder = async (orderId: string, rejectorId: string, reason: string) => {
  const res5: any = await withTimeout(
    retry(async () => await (supabase as any).rpc("reject_purchase_order", {
      order_id: orderId,
      rejector_id: rejectorId,
      reason,
    }), 2),
    12000
  );
  const { error } = res5 || {};
  if (error) throw error;
  return true;
};

export const deletePurchaseOrder = async (orderId: string, deleterId: string) => {
  const res6: any = await withTimeout(
    retry(async () => await (supabase as any).rpc("delete_purchase_order", {
      order_id: orderId,
      deleter_id: deleterId,
    }), 2),
    12000
  );
  const { error } = res6 || {};
  if (error) throw error;
  return true;
}; 