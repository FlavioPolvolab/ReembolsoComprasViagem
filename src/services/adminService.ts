import { supabase } from "@/lib/supabase";

export type UserRole =
  | "user"
  | "admin"
  | "submitter"
  | "approver"
  | "rejector"
  | "deleter";

/**
 * Promove um usuário para o papel de administrador
 * @param email O email do usuário a ser promovido
 * @returns Promise com status de sucesso e mensagem
 */
export const promoteToAdmin = async (email: string) => {
  try {
    // Primeiro, verificar se o usuário existe
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, role") // Corrigido: roles -> role
      .eq("email", email)
      .single();

    if (userError || !userData) {
      return {
        success: false,
        message: `Usuário com email ${email} não encontrado ou erro ao buscar: ${userError?.message}`,
      };
    }

    if (userData.role === "admin") { // Corrigido: roles -> role, includes -> ===
      return {
        success: false,
        message: `Usuário ${email} já é um administrador`,
      };
    }

    // Obter o ID do usuário atual (administrador)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: "Usuário administrador não autenticado ou erro: " + authError?.message,
      };
    }

    // Chamar a função RPC para adicionar o papel de admin
    // Usando 'as any' para contornar possível erro de tipagem TS2345
    const { error: rpcError } = await supabase.rpc("add_role_to_user" as any, {
      target_user_id: userData.id, // Acessado após checar userError
      new_role: "admin",
      admin_user_id: user.id,
    });

    if (rpcError) throw rpcError;

    return {
      success: true,
      message: `Usuário ${email} promovido a administrador com sucesso`,
    };
  } catch (error: any) {
    console.error("Erro ao promover usuário para administrador:", error);
    return {
      success: false,
      message: error.message || "Falha ao promover usuário para administrador",
    };
  }
};

/**
 * Adiciona um papel específico a um usuário
 * @param email Email do usuário
 * @param role Papel a ser adicionado
 * @returns Promise com status de sucesso e mensagem
 */
export const addRoleToUser = async (email: string, role: UserRole) => {
  try {
    // Verificar se o usuário existe
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, role") // Corrigido: roles -> role
      .eq("email", email)
      .single();

    if (userError || !userData) {
      return {
        success: false,
        message: `Usuário com email ${email} não encontrado ou erro ao buscar: ${userError?.message}`,
      };
    }

    // Verificar se o usuário já tem o papel (assumindo um papel por usuário)
    if (userData.role === role) { // Corrigido: roles -> role, includes -> ===
      return {
        success: false,
        message: `Usuário ${email} já possui o papel ${role}`,
      };
    }

    // Obter o ID do usuário atual (administrador)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: "Usuário administrador não autenticado ou erro: " + authError?.message,
      };
    }

    // Chamar a função RPC para adicionar o papel
    // Usando 'as any' para contornar possível erro de tipagem TS2345
    const { error: rpcError } = await supabase.rpc("add_role_to_user" as any, {
      target_user_id: userData.id, // Acessado após checar userError
      new_role: role,
      admin_user_id: user.id,
    });

    if (rpcError) throw rpcError;

    return {
      success: true,
      message: `Papel ${role} adicionado ao usuário ${email} com sucesso`,
    };
  } catch (error: any) {
    console.error(`Erro ao adicionar papel ${role} ao usuário:`, error);
    return {
      success: false,
      message: error.message || `Falha ao adicionar papel ${role} ao usuário`,
    };
  }
};

/**
 * Remove um papel específico de um usuário (assumindo que remover significa definir como 'user')
 * @param email Email do usuário
 * @param role Papel a ser removido (se for admin, volta para user?)
 * @returns Promise com status de sucesso e mensagem
 */
export const removeRoleFromUser = async (email: string, role: UserRole) => {
  try {
    // Verificar se o usuário existe
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, email, role") // Corrigido: roles -> role
      .eq("email", email)
      .single();

    if (userError || !userData) {
      return {
        success: false,
        message: `Usuário com email ${email} não encontrado ou erro ao buscar: ${userError?.message}`,
      };
    }

    // Verificar se o usuário tem o papel a ser removido
    if (userData.role !== role) { // Corrigido: !userData.roles || !userData.roles.includes(role) -> userData.role !== role
      return {
        success: false,
        message: `Usuário ${email} não possui o papel ${role} para ser removido`,
      };
    }

    // Obter o ID do usuário atual (administrador)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: "Usuário administrador não autenticado ou erro: " + authError?.message,
      };
    }

    // Chamar a função RPC para remover o papel
    // Usando 'as any' para contornar possível erro de tipagem TS2345
    const { error: rpcError } = await supabase.rpc("remove_role_from_user" as any, {
        target_user_id: userData.id, // Acessado após checar userError
        role_to_remove: role,
        admin_user_id: user.id,
      },
    );

    if (rpcError) throw rpcError;

    return {
      success: true,
      message: `Papel ${role} removido do usuário ${email} com sucesso`,
    };
  } catch (error: any) {
    console.error(`Erro ao remover papel ${role} do usuário:`, error);
    return {
      success: false,
      message: error.message || `Falha ao remover papel ${role} do usuário`,
    };
  }
};

/**
 * Verifica se o usuário atual é um administrador
 * @returns Promise com booleano indicando se o usuário é administrador
 */
export const checkAdminStatus = async (): Promise<boolean> => {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return false;

    const { data, error } = await supabase
      .from("users")
      .select("role") // Corrigido: roles -> role
      .eq("id", user.id)
      .single();

    if (error || !data) return false;

    return data.role === "admin"; // Corrigido: roles -> role, includes -> ===
  } catch (error) {
    console.error("Erro ao verificar status de administrador:", error);
    return false;
  }
};

/**
 * Verifica se o usuário atual tem um papel específico
 * @param role Papel a ser verificado
 * @returns Promise com booleano indicando se o usuário tem o papel
 */
export const checkUserRole = async (role: UserRole): Promise<boolean> => {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return false;

    const { data, error } = await supabase
      .from("users")
      .select("role") // Corrigido: roles -> role
      .eq("id", user.id)
      .single();

    if (error || !data) return false;

    // Administradores têm acesso a todas as funções
    if (data.role === "admin") return true; // Corrigido: roles -> role, includes -> ===

    return data.role === role; // Corrigido: roles -> role, includes -> ===
  } catch (error) {
    console.error(`Erro ao verificar papel ${role} do usuário:`, error);
    return false;
  }
};

/**
 * Lista todos os usuários com seus papéis
 * @returns Promise com lista de usuários e seus papéis
 */
export const listUsers = async () => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error("Erro ao listar usuários:", error);
    return {
      success: false,
      message: error.message || "Falha ao listar usuários",
      data: [],
    };
  }
};

