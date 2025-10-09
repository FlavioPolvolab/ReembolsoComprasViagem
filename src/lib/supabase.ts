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

  console.log(`[withConnection] Starting operation with ${maxRetries} max retries`);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[withConnection] Attempt ${attempt + 1}/${maxRetries + 1}`);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[withConnection] Session error:', sessionError);
        throw new Error(`Erro ao verificar sessão: ${sessionError.message}`);
      }

      if (!session) {
        console.error('[withConnection] No session found');
        throw new Error('Sessão não encontrada. Por favor, faça login novamente.');
      }

      console.log('[withConnection] Session valid, user:', session.user.id);

      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

      console.log(`[withConnection] Session expires in ${timeUntilExpiry} seconds`);

      if (timeUntilExpiry < 60) {
        console.log('[withConnection] Session expiring soon, refreshing...');
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('[withConnection] Refresh error:', refreshError);
          throw new Error('Não foi possível renovar a sessão. Por favor, faça login novamente.');
        }
        console.log('[withConnection] Session refreshed successfully');
      }

      console.log('[withConnection] Executing operation...');
      const result = await operation();
      console.log('[withConnection] Operation completed successfully');
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`[withConnection] Attempt ${attempt + 1} failed:`, error);

      const isNetworkError = error?.message?.includes('Failed to fetch') ||
                             error?.message?.includes('Network') ||
                             error?.code === 'PGRST301';

      if (!isNetworkError || attempt === maxRetries) {
        console.error('[withConnection] Max retries reached or non-network error, giving up');
        break;
      }

      const waitTime = 1000 * (attempt + 1);
      console.log(`[withConnection] Network error detected, retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  console.error('[withConnection] Operation failed after all retries:', lastError);
  throw lastError;
}