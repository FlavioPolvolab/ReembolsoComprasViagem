import { supabase } from "@/lib/supabase";
import { withTimeout, simpleRetry } from "@/lib/utils";

export const fetchPurchaseOrders = async (userId?: string, isAdmin?: boolean) => {
  try {
    let query = (supabase as any)
      .from("purchase_orders_view")
      .select("*")
      .order("submitted_date", { ascending: false });
    
    if (!isAdmin && userId) {
      query = query.eq("user_id", userId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    throw error;
  }
};

export const uploadPurchaseOrderReceipt = async (purchaseOrderId: string, file: File) => {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${purchaseOrderId}/${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await withTimeout(
      (supabase as any).storage.from("receipts").upload(filePath, file),
      15000
    );
    if (uploadError) throw uploadError;

    const { error: dbError } = await withTimeout(
      (supabase as any)
        .from("purchase_order_receipts")
        .insert({
          purchase_order_id: purchaseOrderId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: filePath,
        }),
      8000
    );
    if (dbError) throw dbError;

    return true;
  } catch (error) {
    console.error("Erro ao fazer upload:", error);
    throw error;
  }
};

export const fetchPurchaseOrderItems = async (purchaseOrderId: string) => {
  try {
    const { data, error } = await withTimeout(
      (supabase as any)
        .from("purchase_order_items")
        .select("*")
        .eq("purchase_order_id", purchaseOrderId)
        .order("created_at", { ascending: true }),
      8000
    );
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao buscar itens:", error);
    throw error;
  }
};

export const addPurchaseOrderItem = async (purchaseOrderId: string, name: string, quantity: number, unit_price: number) => {
  try {
    const { error } = await withTimeout(
      (supabase as any)
        .from("purchase_order_items")
        .insert({
          purchase_order_id: purchaseOrderId,
          name,
          quantity,
          unit_price
        }),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao adicionar item:", error);
    throw error;
  }
};

export const updatePurchaseOrderItem = async (itemId: string, name: string, quantity: number, unit_price: number) => {
  try {
    const { error } = await withTimeout(
      (supabase as any)
        .from("purchase_order_items")
        .update({ name, quantity, unit_price })
        .eq("id", itemId),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao atualizar item:", error);
    throw error;
  }
};

export const deletePurchaseOrderItem = async (itemId: string) => {
  try {
    const { error } = await withTimeout(
      (supabase as any)
        .from("purchase_order_items")
        .delete()
        .eq("id", itemId),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao deletar item:", error);
    throw error;
  }
};

export const approvePurchaseOrder = async (orderId: string, approverId: string) => {
  try {
    const { error } = await withTimeout(
      (supabase as any).rpc("approve_purchase_order", {
        order_id: orderId,
        approver_id: approverId,
      }),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao aprovar pedido:", error);
    throw error;
  }
};

export const rejectPurchaseOrder = async (orderId: string, rejectorId: string, reason: string) => {
  try {
    const { error } = await withTimeout(
      (supabase as any).rpc("reject_purchase_order", {
        order_id: orderId,
        rejector_id: rejectorId,
        reason,
      }),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao rejeitar pedido:", error);
    throw error;
  }
};

export const deletePurchaseOrder = async (orderId: string, deleterId: string) => {
  try {
    const { error } = await withTimeout(
      (supabase as any).rpc("delete_purchase_order", {
        order_id: orderId,
        deleter_id: deleterId,
      }),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao deletar pedido:", error);
    throw error;
  }
};