import { supabase } from "@/lib/supabase";
import { withTimeout, simpleRetry } from "@/lib/utils";

export type Trip = {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget_amount: number;
  spent_amount: number;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  users?: { name?: string } | null;
  cost_center_id?: string | null;
  cost_center?: { name: string } | null;
  close_note?: string | null;
};

export type TripExpense = {
  id: string;
  trip_id: string;
  description: string;
  amount: number;
  expense_date?: string | null;
  category?: string | null;
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

export const fetchTrips = async (userId?: string, isAdmin?: boolean) => {
  try {
    let query = supabase
      .from("trips_view")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!isAdmin && userId) {
      query = query.eq("user_id", userId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Erro ao buscar viagens:", error);
    throw error;
  }
};

export const createTrip = async (trip: {
  title: string;
  description?: string;
  start_date?: string | null;
  end_date?: string | null;
  budget_amount: number;
  user_id: string;
  cost_center_id?: string | null;
}) => {
  try {
    const { data, error } = await withTimeout(
      (supabase as any).from("trips").insert(trip).select().single(),
      8000
    );
    if (error) throw error;
    return data as Trip;
  } catch (error) {
    console.error("Erro ao criar viagem:", error);
    throw error;
  }
};

export const deleteTrip = async (tripId: string) => {
  try {
    const { error } = await withTimeout(
      (supabase as any).from("trips").delete().eq("id", tripId),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao deletar viagem:", error);
    throw error;
  }
};

export const fetchTripExpenses = async (tripId: string) => {
  try {
    const { data, error } = await withTimeout(
      (supabase as any)
        .from("trip_expenses")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true }),
      8000
    );
    if (error) throw error;
    return (data || []) as TripExpense[];
  } catch (error) {
    console.error("Erro ao buscar despesas da viagem:", error);
    throw error;
  }
};

export const addTripExpense = async (expense: {
  trip_id: string;
  description: string;
  amount: number;
  expense_date?: string | null;
  category?: string | null;
}) => {
  try {
    const { data, error } = await withTimeout(
      (supabase as any)
        .from("trip_expenses")
        .insert({ ...expense })
        .select()
        .single(),
      8000
    );
    if (error) throw error;
    return data as TripExpense;
  } catch (error) {
    console.error("Erro ao adicionar despesa:", error);
    throw error;
  }
};

export const updateTripExpense = async (
  expenseId: string,
  changes: Partial<Pick<TripExpense, "description" | "amount" | "expense_date" | "category" | "reconciled">>
) => {
  try {
    const { error } = await withTimeout(
      (supabase as any)
        .from("trip_expenses")
        .update(changes)
        .eq("id", expenseId),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao atualizar despesa:", error);
    throw error;
  }
};

export const deleteTripExpense = async (expenseId: string) => {
  try {
    const { error } = await withTimeout(
      (supabase as any)
        .from("trip_expenses")
        .delete()
        .eq("id", expenseId),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao deletar despesa:", error);
    throw error;
  }
};

export const uploadTripReceipt = async (tripId: string, expenseId: string, file: File) => {
  try {
    const baseName = file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 150);
    const fileName = `trips/${tripId}/${expenseId}/${Date.now()}_${baseName}`;
    
    const { error: uploadError } = await withTimeout(
      (supabase as any).storage.from("receipts").upload(fileName, file),
      15000
    );
    if (uploadError) throw uploadError;
    
    const { error: dbError } = await withTimeout(
      (supabase as any)
        .from("trip_receipts")
        .insert({
          trip_expense_id: expenseId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: fileName,
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

export const fetchTripReceipts = async (expenseId: string) => {
  try {
    const { data, error } = await withTimeout(
      (supabase as any)
        .from("trip_receipts")
        .select("*")
        .eq("trip_expense_id", expenseId)
        .order("created_at", { ascending: false }),
      8000
    );
    if (error) throw error;
    return (data || []) as TripReceipt[];
  } catch (error) {
    console.error("Erro ao buscar comprovantes:", error);
    throw error;
  }
};

export const getSignedUrl = async (storagePath: string) => {
  try {
    const { data, error } = await withTimeout(
      (supabase as any).storage.from('receipts').createSignedUrl(storagePath, 60 * 10),
      8000
    );
    if (error) throw error;
    if (data?.signedUrl) return data.signedUrl;
    throw new Error('URL não gerada');
  } catch (error) {
    console.error("Erro ao gerar URL:", error);
    throw new Error('Não foi possível gerar link do comprovante');
  }
};

export const closeTrip = async (tripId: string, userId: string) => {
  try {
    const { error } = await withTimeout(
      (supabase as any).rpc("close_trip", {
        trip_id: tripId,
        closer_id: userId,
      }),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao fechar viagem:", error);
    throw error;
  }
};

export const closeTripWithNote = async (tripId: string, userId: string, note?: string) => {
  try {
    const { error } = await withTimeout(
      (supabase as any).rpc("close_trip", {
        trip_id: tripId,
        closer_id: userId,
        note: note || null,
      }),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao fechar viagem:", error);
    throw error;
  }
};

export const deleteTripDeep = async (tripId: string) => {
  try {
    const { data: expenses, error: expErr } = await withTimeout(
      (supabase as any)
        .from("trip_expenses")
        .select("id")
        .eq("trip_id", tripId),
      8000
    );
    if (expErr) throw expErr;

    const paths: string[] = [];
    for (const exp of expenses || []) {
      const { data: recs, error: recErr } = await withTimeout(
        (supabase as any)
          .from("trip_receipts")
          .select("storage_path")
          .eq("trip_expense_id", exp.id),
        8000
      );
      if (recErr) throw recErr;
      for (const r of recs || []) paths.push(r.storage_path);
    }

    if (paths.length > 0) {
      const { error: rmErr } = await withTimeout(
        (supabase as any).storage.from("receipts").remove(paths),
        15000
      );
      if (rmErr) throw rmErr;
    }

    const { error: delExpErr } = await withTimeout(
      (supabase as any).from("trip_expenses").delete().eq("trip_id", tripId),
      8000
    );
    if (delExpErr) throw delExpErr;

    const { error: delTripErr } = await withTimeout(
      (supabase as any).from("trips").delete().eq("id", tripId),
      8000
    );
    if (delTripErr) throw delTripErr;

    return true;
  } catch (error) {
    console.error("Erro ao deletar viagem:", error);
    throw error;
  }
};

export const updateTrip = async (
  tripId: string,
  changes: Partial<{ close_note: string | null; budget_amount: number; cost_center_id: string | null }>
) => {
  try {
    const { error } = await withTimeout(
      (supabase as any).from("trips").update(changes).eq("id", tripId),
      8000
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Erro ao atualizar viagem:", error);
    throw error;
  }
};