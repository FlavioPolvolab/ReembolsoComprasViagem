import { supabase, withConnection } from "@/lib/supabase";

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
  return withConnection(async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, role")
        .eq("email", email)
        .single();

      if (userError || !userData) {
        return {
          success: false,
          message: `Usuário com email ${email} não encontrado ou erro ao buscar: ${userError?.message}`,
        };
      }

      if (userData.role === "admin") {
        return {
          success: false,
          message: `Usuário ${email} já é um administrador`,
        };
      }

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

      const { error: rpcError } = await supabase.rpc("add_role_to_user" as any, {
        target_user_id: userData.id,
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
  });
};

/**
 * Adiciona um papel específico a um usuário
 * @param email Email do usuário
 * @param role Papel a ser adicionado
 * @returns Promise com status de sucesso e mensagem
 */
export const addRoleToUser = async (email: string, role: UserRole) => {
  return withConnection(async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, role")
        .eq("email", email)
        .single();

      if (userError || !userData) {
        return {
          success: false,
          message: `Usuário com email ${email} não encontrado ou erro ao buscar: ${userError?.message}`,
        };
      }

      if (userData.role === role) {
        return {
          success: false,
          message: `Usuário ${email} já possui o papel ${role}`,
        };
      }

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

      const { error: rpcError } = await supabase.rpc("add_role_to_user" as any, {
        target_user_id: userData.id,
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
  });
};

/**
 * Remove um papel específico de um usuário (assumindo que remover significa definir como 'user')
 * @param email Email do usuário
 * @param role Papel a ser removido (se for admin, volta para user?)
 * @returns Promise com status de sucesso e mensagem
 */
export const removeRoleFromUser = async (email: string, role: UserRole) => {
  return withConnection(async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, email, role")
        .eq("email", email)
        .single();

      if (userError || !userData) {
        return {
          success: false,
          message: `Usuário com email ${email} não encontrado ou erro ao buscar: ${userError?.message}`,
        };
      }

      if (userData.role !== role) {
        return {
          success: false,
          message: `Usuário ${email} não possui o papel ${role} para ser removido`,
        };
      }

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

      const { error: rpcError } = await supabase.rpc("remove_role_from_user" as any, {
          target_user_id: userData.id,
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
  });
};

/**
 * Verifica se o usuário atual é um administrador
 * @returns Promise com booleano indicando se o usuário é administrador
 */
export const checkAdminStatus = async (): Promise<boolean> => {
  return withConnection(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) return false;

      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || !data) return false;

      return data.role === "admin";
    } catch (error) {
      console.error("Erro ao verificar status de administrador:", error);
      return false;
    }
  });
};

/**
 * Verifica se o usuário atual tem um papel específico
 * @param role Papel a ser verificado
 * @returns Promise com booleano indicando se o usuário tem o papel
 */
export const checkUserRole = async (role: UserRole): Promise<boolean> => {
  return withConnection(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) return false;

      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || !data) return false;

      if (data.role === "admin") return true;

      return data.role === role;
    } catch (error) {
      console.error(`Erro ao verificar papel ${role} do usuário:`, error);
      return false;
    }
  });
};

/**
 * Lista todos os usuários com seus papéis
 * @returns Promise com lista de usuários e seus papéis
 */
export const listUsers = async () => {
  return withConnection(async () => {
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
  });
};

