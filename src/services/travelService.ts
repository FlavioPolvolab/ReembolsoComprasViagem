import { supabase } from "@/lib/supabase";
import { withTimeout, retry } from "@/lib/utils";

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
  let query = (supabase as any)
    .from("trips")
    .select("*, users:user_id(name), cost_center:cost_center_id(name)")
    .order("created_at", { ascending: false });
  if (!isAdmin && userId) {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await withTimeout(query, 12000) as any;
  if (error) throw error;
  return (data || []) as Trip[];
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
  const { data, error } = await (supabase as any)
    .from("trips")
    .insert(trip)
    .select()
    .single();
  if (error) throw error;
  return data as Trip;
};

export const deleteTrip = async (tripId: string) => {
  const { error } = await (supabase as any).from("trips").delete().eq("id", tripId);
  if (error) throw error;
  return true;
};

export const fetchTripExpenses = async (tripId: string) => {
  const resA: any = await withTimeout(
    retry(async () => await (supabase as any)
      .from("trip_expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }), 2),
    12000
  ) as any;
  if (resA?.error) throw resA.error;
  return (resA?.data || []) as TripExpense[];
};

export const addTripExpense = async (expense: {
  trip_id: string;
  description: string;
  amount: number;
  expense_date?: string | null;
  category?: string | null;
}) => {
  const resB: any = await withTimeout(
    (supabase as any)
      .from("trip_expenses")
      .insert({ ...expense })
      .select()
      .single(),
    12000
  ) as any;
  if (resB?.error) throw resB.error;
  return resB?.data as TripExpense;
};

export const updateTripExpense = async (
  expenseId: string,
  changes: Partial<Pick<TripExpense, "description" | "amount" | "expense_date" | "category" | "reconciled">>
) => {
  const resC: any = await withTimeout(
    (supabase as any)
      .from("trip_expenses")
      .update(changes)
      .eq("id", expenseId),
    12000
  );
  if (resC?.error) throw resC.error;
  return true;
};

export const deleteTripExpense = async (expenseId: string) => {
  const resD: any = await withTimeout(
    (supabase as any)
      .from("trip_expenses")
      .delete()
      .eq("id", expenseId),
    12000
  );
  if (resD?.error) throw resD.error;
  return true;
};

export const uploadTripReceipt = async (tripId: string, expenseId: string, file: File) => {
  // Sanitiza o nome do arquivo para evitar caracteres inválidos no Storage (ex.: "°", espaços, acentos)
  const baseName = file.name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]+/g, '_') // mantém apenas [a-zA-Z0-9._-]
    .replace(/_+/g, '_')
    .slice(0, 150);
  const fileName = `trips/${tripId}/${expenseId}/${Date.now()}_${baseName}`;
  const resUp: any = await withTimeout(
    (supabase as any).storage
      .from("receipts")
      .upload(fileName, file),
    20000
  );
  if (resUp?.error) throw resUp.error;
  const resE: any = await withTimeout(
    (supabase as any)
      .from("trip_receipts")
      .insert({
        trip_expense_id: expenseId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: fileName,
      }),
    12000
  );
  if (resE?.error) throw resE.error;
  return true;
};

export const fetchTripReceipts = async (expenseId: string) => {
  const resF: any = await withTimeout(
    (supabase as any)
      .from("trip_receipts")
      .select("*")
      .eq("trip_expense_id", expenseId)
      .order("created_at", { ascending: false }),
    12000
  ) as any;
  if (resF?.error) throw resF.error;
  return (resF?.data || []) as TripReceipt[];
};

export const getSignedUrl = async (storagePath: string) => {
  // 1) tentativa direta
  const direct: any = await withTimeout(
    retry(async () => await (supabase as any).storage
      .from("receipts")
      .createSignedUrl(storagePath, 60 * 10), 2),
    15000
  );
  if (direct?.data?.signedUrl) return direct.data.signedUrl as string;
  // 2) fallback: localizar arquivo via list no diretório e assinar com nome exato
  try {
    const lastSlash = storagePath.lastIndexOf('/');
    const dir = lastSlash > 0 ? storagePath.substring(0, lastSlash) : '';
    const base = lastSlash > 0 ? storagePath.substring(lastSlash + 1) : storagePath;
    const listed: any = await withTimeout(
      (supabase as any).storage.from('receipts').list(dir, { search: base, limit: 100 }),
      10000
    );
    const files = listed?.data as Array<{ name: string }> | undefined;
    if (files && files.length > 0) {
      const match = files.find(f => f.name === base) || files[0];
      const altPath = dir ? `${dir}/${match.name}` : match.name;
      const alt: any = await withTimeout(
        (supabase as any).storage.from('receipts').createSignedUrl(altPath, 60 * 10),
        10000
      );
      if (alt?.data?.signedUrl) return alt.data.signedUrl as string;
    }
  } catch {}
  // 3) se ainda falhar, propaga erro para UI tratar
  throw new Error('Não foi possível gerar link do comprovante');
};

export const closeTrip = async (tripId: string, userId: string) => {
  const resH: any = await withTimeout(
    (supabase as any).rpc("close_trip", {
      trip_id: tripId,
      closer_id: userId,
    }),
    12000
  );
  if (resH?.error) throw resH.error;
  return true;
};

export const closeTripWithNote = async (tripId: string, userId: string, note?: string) => {
  const resI: any = await withTimeout(
    (supabase as any).rpc("close_trip", {
      trip_id: tripId,
      closer_id: userId,
      note: note || null,
    }),
    12000
  );
  if (resI?.error) throw resI.error;
  return true;
};

export const deleteTripDeep = async (tripId: string) => {
  // Coletar todas as despesas e comprovantes para remover arquivos do storage
  const resListExp: any = await withTimeout(
    (supabase as any)
      .from("trip_expenses")
      .select("id")
      .eq("trip_id", tripId),
    12000
  );
  const { data: expenses, error: expErr } = resListExp || {};
  if (expErr) throw expErr;

  const paths: string[] = [];
  for (const exp of expenses || []) {
    const resListRec: any = await withTimeout(
      (supabase as any)
        .from("trip_receipts")
        .select("storage_path")
        .eq("trip_expense_id", exp.id),
      12000
    );
    const { data: recs, error: recErr } = resListRec || {};
    if (recErr) throw recErr;
    for (const r of recs || []) paths.push(r.storage_path);
  }

  if (paths.length > 0) {
    const resRm: any = await withTimeout(
      (supabase as any).storage
        .from("receipts")
        .remove(paths),
      20000
    );
    const { error: rmErr } = resRm || {};
    if (rmErr) throw rmErr;
  }

  // Excluir dados (recibos serão removidos por cascade ao deletar despesas)
  const resDelExp: any = await withTimeout(
    (supabase as any)
      .from("trip_expenses")
      .delete()
      .eq("trip_id", tripId),
    12000
  );
  const { error: delExpErr } = resDelExp || {};
  if (delExpErr) throw delExpErr;

  const resDelTrip: any = await withTimeout(
    (supabase as any)
      .from("trips")
      .delete()
      .eq("id", tripId),
    12000
  );
  const { error: delTripErr } = resDelTrip || {};
  if (delTripErr) throw delTripErr;

  return true;
};

export const updateTrip = async (
  tripId: string,
  changes: Partial<{ close_note: string | null; budget_amount: number; cost_center_id: string | null }>
) => {
  const resJ: any = await withTimeout(
    (supabase as any)
      .from("trips")
      .update(changes)
      .eq("id", tripId),
    12000
  );
  if (resJ?.error) throw resJ.error;
  return true;
};


