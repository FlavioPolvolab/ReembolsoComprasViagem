import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js-web',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

type SupabaseOperation<T> = () => Promise<T>;

export async function withConnection<T>(
  operation: SupabaseOperation<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(`Erro ao verificar sessão: ${sessionError.message}`);
      }

      if (!session) {
        throw new Error('Sessão não encontrada. Por favor, faça login novamente.');
      }

      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

      if (timeUntilExpiry < 60) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('Não foi possível renovar a sessão. Por favor, faça login novamente.');
        }
      }

      return await operation();
    } catch (error: any) {
      lastError = error;

      const isNetworkError = error?.message?.includes('Failed to fetch') ||
                             error?.message?.includes('Network') ||
                             error?.code === 'PGRST301';

      if (!isNetworkError || attempt === maxRetries) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  throw lastError;
}