import { supabase, withConnection } from "@/lib/supabase";

export const fetchPurchaseOrders = async (userId?: string, isAdmin?: boolean) => {
  console.log('[fetchPurchaseOrders] Called with:', { userId, isAdmin });

  return withConnection(async () => {
    console.log('[fetchPurchaseOrders] Building query...');
    let query = (supabase as any)
      .from("purchase_orders")
      .select("*, users:user_id(name)")
      .order("submitted_date", { ascending: false });

    if (!isAdmin && userId) {
      console.log('[fetchPurchaseOrders] Filtering by user_id:', userId);
      query = query.eq("user_id", userId);
    } else {
      console.log('[fetchPurchaseOrders] Fetching all orders (admin mode)');
    }

    console.log('[fetchPurchaseOrders] Executing query...');
    const { data, error } = await query;

    if (error) {
      console.error('[fetchPurchaseOrders] Query error:', error);
      console.error('[fetchPurchaseOrders] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    console.log('[fetchPurchaseOrders] Query successful, received:', data?.length || 0, 'orders');

    const pedidos = (data || []).map((p: any) => ({
      ...p,
      user_name: p.users?.name || "-"
    }));

    console.log('[fetchPurchaseOrders] Mapped orders:', pedidos.length);
    return pedidos;
  });
};

export const uploadPurchaseOrderReceipt = async (purchaseOrderId: string, file: File) => {
  return withConnection(async () => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${purchaseOrderId}/${Date.now()}_${file.name}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await (supabase as any).storage
      .from("receipts")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

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
  });
};

export const fetchPurchaseOrderItems = async (purchaseOrderId: string) => {
  return withConnection(async () => {
    const { data, error } = await (supabase as any)
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId);

    if (error) throw error;
    return data;
  });
};

export const addPurchaseOrderItem = async (purchaseOrderId: string, name: string, quantity: number, unitPrice: number) => {
  return withConnection(async () => {
    const { error } = await (supabase as any)
      .from("purchase_order_items")
      .insert({
        purchase_order_id: purchaseOrderId,
        name,
        quantity,
        unit_price: unitPrice,
      });

    if (error) throw error;
  });
};

export const updatePurchaseOrderItem = async (itemId: string, name: string, quantity: number, unitPrice: number) => {
  return withConnection(async () => {
    const { error } = await (supabase as any)
      .from("purchase_order_items")
      .update({
        name,
        quantity,
        unit_price: unitPrice,
      })
      .eq("id", itemId);

    if (error) throw error;
  });
};

export const deletePurchaseOrderItem = async (itemId: string) => {
  return withConnection(async () => {
    const { error } = await (supabase as any)
      .from("purchase_order_items")
      .delete()
      .eq("id", itemId);

    if (error) throw error;
  });
};

export const approvePurchaseOrder = async (orderId: string, approverId: string) => {
  return withConnection(async () => {
    const { error } = await (supabase as any).rpc("approve_purchase_order", {
      order_id: orderId,
      approver_id: approverId,
    });

    if (error) throw error;
  });
};

export const rejectPurchaseOrder = async (orderId: string, rejectorId: string, reason: string) => {
  return withConnection(async () => {
    const { error } = await (supabase as any).rpc("reject_purchase_order", {
      order_id: orderId,
      rejector_id: rejectorId,
      rejection_reason: reason,
    });

    if (error) throw error;
  });
};

export const deletePurchaseOrder = async (orderId: string, deleterId: string) => {
  return withConnection(async () => {
    const { error } = await (supabase as any).rpc("delete_purchase_order", {
      order_id: orderId,
      deleter_id: deleterId,
    });

    if (error) throw error;
  });
};