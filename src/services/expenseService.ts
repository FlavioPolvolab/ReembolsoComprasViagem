import { supabase, withAuth } from "@/lib/supabase";

export interface Expense {
  id?: string;
  user_id: string;
  name: string;
  description?: string;
  amount: number;
  purpose: string;
  cost_center_id: string;
  category_id: string;
  payment_date: string;
  submitted_date?: string;
  status?: string;
  payment_status?: string;
}

export interface Receipt {
  id?: string;
  expense_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  created_at?: string;
}

export const fetchExpenses = async (filters: any = {}) => {
  let query = (supabase as any).from("expenses_view").select("*");

  // Aplicar filtros
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
    );
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.category) {
    query = query.eq("category_name", filters.category);
  }

  if (filters.costCenter) {
    query = query.eq("cost_center_name", filters.costCenter);
  }

  if (filters.dateRange?.from) {
    query = query.gte("submitted_date", filters.dateRange.from.toISOString());
  }

  if (filters.dateRange?.to) {
    query = query.lte("submitted_date", filters.dateRange.to.toISOString());
  }

  // Ordenar por data de envio, mais recentes primeiro
  query = query.order("submitted_date", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar despesas:", error);
    throw error;
  }

  return data;
};

export const fetchExpenseById = async (id: string) => {
  try {
    const { data, error } = await (supabase as any)
      .from("expenses")
      .select(`
        *,
        users:user_id (name, email),
        cost_centers:cost_center_id (name),
        categories:category_id (name),
        receipts (*)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao buscar despesa:", error);
    throw error;
  }
};

export const createExpense = async (expense: Expense, files: File[]) => {
  return withAuth(async () => {
    try {
      const { data: expenseData, error: expenseError } = await (supabase as any)
        .from("expenses")
        .insert([expense])
        .select()
        .single();

      if (expenseError) throw expenseError;

      if (files.length > 0) {
        const receipts: any[] = [];

        for (const file of files) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${expenseData.id}/${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await (supabase as any).storage
            .from("receipts")
            .upload(filePath, file);
          if (uploadError) throw uploadError;

          receipts.push({
            expense_id: expenseData.id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            storage_path: filePath,
          });
        }

        const { error: receiptsError } = await (supabase as any)
          .from("receipts")
          .insert(receipts);
        if (receiptsError) throw receiptsError;
      }

      return expenseData;
    } catch (error) {
      console.error("Erro ao criar despesa:", error);
      throw error;
    }
  });
};

export const updateExpense = async (id: string, updateData: any) => {
  return withAuth(async () => {
    const { data, error } = await (supabase as any)
      .from("expenses")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Erro ao atualizar despesa:", error);
      throw error;
    }

    return data;
  });
};

export const deleteExpense = async (id: string) => {
  const { error } = await (supabase as any)
    .from("expenses")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir despesa:", error);
    throw error;
  }
};

export const approveExpense = async (id: string, approverId: string) => {
  try {
    const { error } = await (supabase as any).rpc("approve_expense", {
      expense_id: id,
      approver_id: approverId,
    });

    if (error) throw error;
  } catch (error) {
    console.error("Erro ao aprovar despesa:", error);
    throw error;
  }
};

export const rejectExpense = async (id: string, rejectorId: string, reason: string) => {
  try {
    const { error } = await (supabase as any).rpc("reject_expense", {
      expense_id: id,
      rejector_id: rejectorId,
      rejection_reason: reason,
    });

    if (error) throw error;
  } catch (error) {
    console.error("Erro ao rejeitar despesa:", error);
    throw error;
  }
};

export const getReceiptUrl = async (path: string) => {
  try {
    const { data, error } = await (supabase as any).storage
      .from("receipts")
      .createSignedUrl(path, 600);

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error("Erro ao gerar URL do comprovante:", error);
    throw error;
  }
};

export const fetchCategories = async () => {
  try {
    const { data, error } = await (supabase as any)
      .from("categories")
      .select("*")
      .order("name");

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    throw error;
  }
};

export const fetchCostCenters = async () => {
  try {
    const { data, error } = await (supabase as any)
      .from("cost_centers")
      .select("*")
      .order("name");

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao buscar centros de custo:", error);
    throw error;
  }
};

export const deleteExpenseReceipts = async (id: string) => {
  const { error: receiptsError } = await (supabase as any)
    .from("receipts")
    .delete()
    .eq("expense_id", id);

  if (receiptsError) {
    console.error("Erro ao excluir comprovantes:", receiptsError);
    throw receiptsError;
  }
};

export const deleteExpenseDeep = async (id: string) => {
  try {
    // Primeiro, excluir comprovantes
    await deleteExpenseReceipts(id);

    // Depois, excluir a despesa
    const { error } = await (supabase as any)
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) throw error;
  } catch (error) {
    console.error("Erro ao excluir despesa:", error);
    throw error;
  }
};

export const fetchExpensesTest = async (filters: any = {}) => {
  let query = (supabase as any).from("expenses").select(`
    *,
    users:user_id (name, email),
    cost_centers:cost_center_id (name),
    categories:category_id (name),
    receipts (*)
  `);

  // Aplicar filtros
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`,
    );
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.category) {
    query = query.eq("category_id", filters.category);
  }

  if (filters.costCenter) {
    query = query.eq("cost_center_id", filters.costCenter);
  }

  if (filters.dateRange?.from) {
    query = query.gte("submitted_date", filters.dateRange.from.toISOString());
  }

  if (filters.dateRange?.to) {
    query = query.lte("submitted_date", filters.dateRange.to.toISOString());
  }

  // Ordenar por data de envio, mais recentes primeiro
  query = query.order("submitted_date", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar despesas (teste):", error);
    throw error;
  }

  return data;
};

export const testExpensesView = async () => {
  try {
    const { data, error } = await (supabase as any).rpc('test_expenses_view');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao testar view:", error);
    throw error;
  }
};