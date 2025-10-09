import { supabase, withConnection } from "@/lib/supabase";

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
  return withConnection(async () => {
    let query = (supabase as any).from("expenses_view").select("*");

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

    query = query.order("submitted_date", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar despesas:", error);
      throw error;
    }

    return data;
  });
};

export const fetchExpenseById = async (id: string) => {
  return withConnection(async () => {
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
  });
};

export const createExpense = async (expense: Expense, files: File[]) => {
  return withConnection(async () => {
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
  });
};

export const updateExpense = async (id: string, updateData: any) => {
  return withConnection(async () => {
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
  return withConnection(async () => {
    const { error } = await (supabase as any)
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao excluir despesa:", error);
      throw error;
    }
  });
};

export const approveExpense = async (id: string, approverId: string) => {
  return withConnection(async () => {
    const { error } = await (supabase as any).rpc("approve_expense", {
      expense_id: id,
      approver_id: approverId,
    });

    if (error) throw error;
  });
};

export const rejectExpense = async (id: string, rejectorId: string, reason: string) => {
  return withConnection(async () => {
    const { error } = await (supabase as any).rpc("reject_expense", {
      expense_id: id,
      rejector_id: rejectorId,
      rejection_reason: reason,
    });

    if (error) throw error;
  });
};

export const getReceiptUrl = async (path: string) => {
  return withConnection(async () => {
    const { data, error } = await (supabase as any).storage
      .from("receipts")
      .createSignedUrl(path, 600);

    if (error) throw error;
    return data.signedUrl;
  });
};

export const fetchCategories = async () => {
  return withConnection(async () => {
    const { data, error } = await (supabase as any)
      .from("categories")
      .select("*")
      .order("name");

    if (error) throw error;
    return data;
  });
};

export const fetchCostCenters = async () => {
  return withConnection(async () => {
    const { data, error } = await (supabase as any)
      .from("cost_centers")
      .select("*")
      .order("name");

    if (error) throw error;
    return data;
  });
};

export const deleteExpenseReceipts = async (id: string) => {
  return withConnection(async () => {
    const { error: receiptsError } = await (supabase as any)
      .from("receipts")
      .delete()
      .eq("expense_id", id);

    if (receiptsError) {
      console.error("Erro ao excluir comprovantes:", receiptsError);
      throw receiptsError;
    }
  });
};

export const deleteExpenseDeep = async (id: string) => {
  return withConnection(async () => {
    await deleteExpenseReceipts(id);

    const { error } = await (supabase as any)
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) throw error;
  });
};

export const fetchExpensesTest = async (filters: any = {}) => {
  return withConnection(async () => {
    let query = (supabase as any).from("expenses").select(`
      *,
      users:user_id (name, email),
      cost_centers:cost_center_id (name),
      categories:category_id (name),
      receipts (*)
    `);

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

    query = query.order("submitted_date", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar despesas (teste):", error);
      throw error;
    }

    return data;
  });
};

export const testExpensesView = async () => {
  return withConnection(async () => {
    const { data, error } = await (supabase as any).rpc('test_expenses_view');
    if (error) throw error;
    return data;
  });
};