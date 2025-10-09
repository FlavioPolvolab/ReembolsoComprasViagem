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

type RetryConfig = {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
};

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 2,
  delayMs: 300,
  backoffMultiplier: 1.5,
};

export const ensureAuthForOperation = async (config: RetryConfig = {}): Promise<void> => {
  const { maxRetries, delayMs, backoffMultiplier } = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: Error | null = null;
  let currentDelay = delayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(`Erro ao obter sessão: ${error.message}`);
      }

      if (!session) {
        throw new Error('Sessão não encontrada. Por favor, faça login novamente.');
      }

      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

      if (timeUntilExpiry < 60) {
        console.log(`[Tentativa ${attempt + 1}] Renovando sessão expirada...`);
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !newSession) {
          throw new Error('Não foi possível renovar a sessão. Por favor, faça login novamente.');
        }
      }

      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Tentativa ${attempt + 1}/${maxRetries + 1}] Erro ao validar autenticação:`, lastError.message);

      if (attempt < maxRetries) {
        console.log(`Aguardando ${currentDelay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay = Math.floor(currentDelay * backoffMultiplier);
      }
    }
  }

  throw lastError || new Error('Falha ao validar autenticação após múltiplas tentativas');
};

export const withAuth = async <T>(
  operation: () => Promise<T>,
  retryConfig?: RetryConfig
): Promise<T> => {
  await ensureAuthForOperation(retryConfig);
  return operation();
};

export const getAuthenticatedClient = async (retryConfig?: RetryConfig) => {
  await ensureAuthForOperation(retryConfig);
  return supabase;
};
