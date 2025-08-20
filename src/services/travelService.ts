import { supabase } from "@/lib/supabase";

export type Trip = {
  id: string;
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  budget_amount: number;
  user_id: string;
  cost_center_id?: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  users?: { name: string };
  cost_center?: { name: string };
};

export type TripExpense = {
  id: string;
  trip_id: string;
  description: string;
  amount: number;
  expense_date?: string;
  category?: string;
  reconciled: boolean;
  created_at: string;
  updated_at: string;
};

export type TripReceipt = {
  id: string;
  trip_expense_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
};

export const fetchTrips = async (userId: string, isAdmin: boolean = false) => {
  const { data, error } = await (supabase as any)
    .from("trips")
    .select(`
      *,
      users:user_id(name),
      cost_center:trip_cost_center_id(name)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const createTrip = async (tripData: any) => {
  const { error } = await (supabase as any)
    .from("trips")
    .insert(tripData);

  if (error) throw error;
};

export const deleteTrip = async (tripId: string) => {
  try {
    const { error } = await (supabase as any)
      .from("trips")
      .delete()
      .eq("id", tripId);

    if (error) throw error;
  } catch (error) {
    console.error("Erro ao excluir viagem:", error);
    throw error;
  }
};

export const fetchTripExpenses = async (tripId: string) => {
  const { data, error } = await (supabase as any)
    .from("trip_expenses")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
};

export const addTripExpense = async (expenseData: any) => {
  const { data, error } = await (supabase as any)
    .from("trip_expenses")
    .insert(expenseData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTripExpense = async (expenseId: string, updateData: any) => {
  const { error } = await (supabase as any)
    .from("trip_expenses")
    .update(updateData)
    .eq("id", expenseId);

  if (error) throw error;
};

export const deleteTripExpense = async (expenseId: string) => {
  const { error } = await (supabase as any)
    .from("trip_expenses")
    .delete()
    .eq("id", expenseId);

  if (error) throw error;
};

export const uploadTripReceipt = async (tripId: string, expenseId: string, file: File) => {
  const fileName = `${tripId}/${expenseId}/${Date.now()}_${file.name}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await (supabase as any).storage
    .from("receipts")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { error: dbError } = await (supabase as any)
    .from("trip_receipts")
    .insert({
      trip_expense_id: expenseId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: filePath,
    });

  if (dbError) throw dbError;
};

export const fetchTripReceipts = async (expenseId: string) => {
  try {
    const { data, error } = await (supabase as any)
      .from("trip_receipts")
      .select("*")
      .eq("trip_expense_id", expenseId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Erro ao buscar comprovantes:", error);
    throw error;
  }
};

export const getSignedUrl = async (storagePath: string) => {
  try {
    const { data, error } = await (supabase as any).storage
      .from('receipts')
      .createSignedUrl(storagePath, 60 * 10);

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error("Erro ao gerar URL assinada:", error);
    throw error;
  }
};

export const closeTrip = async (tripId: string, userId: string) => {
  try {
    const { error } = await (supabase as any).rpc("close_trip", {
      trip_id: tripId,
      closer_id: userId,
    });

    if (error) throw error;
  } catch (error) {
    console.error("Erro ao fechar viagem:", error);
    throw error;
  }
};

export const closeTripWithNote = async (tripId: string, userId: string, note?: string) => {
  try {
    const { error } = await (supabase as any).rpc("close_trip", {
      trip_id: tripId,
      closer_id: userId,
      note: note || null,
    });

    if (error) throw error;
  } catch (error) {
    console.error("Erro ao fechar viagem com nota:", error);
    throw error;
  }
};

export const deleteTripDeep = async (tripId: string) => {
  try {
    const { data: expenses, error: expErr } = await (supabase as any)
      .from("trip_expenses")
      .select("id")
      .eq("trip_id", tripId);

    if (expErr) throw expErr;

    const paths: string[] = [];
    for (const exp of expenses || []) {
      const { data: recs, error: recErr } = await (supabase as any)
        .from("trip_receipts")
        .select("storage_path")
        .eq("trip_expense_id", exp.id);

      if (recErr) throw recErr;
      paths.push(...(recs || []).map((r: any) => r.storage_path));
    }

    if (paths.length > 0) {
      const { error: rmErr } = await (supabase as any).storage
        .from("receipts")
        .remove(paths);

      if (rmErr) throw rmErr;
    }

    const { error: delExpErr } = await (supabase as any)
      .from("trip_expenses")
      .delete()
      .eq("trip_id", tripId);

    if (delExpErr) throw delExpErr;

    const { error: delTripErr } = await (supabase as any)
      .from("trips")
      .delete()
      .eq("id", tripId);

    if (delTripErr) throw delTripErr;
  } catch (error) {
    console.error("Erro ao excluir viagem:", error);
    throw error;
  }
};

export const updateTrip = async (
  tripId: string,
  changes: Partial<Pick<Trip, "title" | "description" | "start_date" | "end_date" | "budget_amount" | "cost_center_id">>
) => {
  try {
    const { error } = await (supabase as any)
      .from("trips")
      .update(changes)
      .eq("id", tripId);

    if (error) throw error;
  } catch (error) {
    console.error("Erro ao atualizar viagem:", error);
    throw error;
  }
};