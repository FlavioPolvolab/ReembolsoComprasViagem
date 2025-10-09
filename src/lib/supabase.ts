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

let sessionRefreshInProgress = false;
let sessionRefreshPromise: Promise<void> | null = null;

export const isSessionRefreshing = () => sessionRefreshInProgress;

export const waitForSessionRefresh = async () => {
  if (sessionRefreshPromise) {
    await sessionRefreshPromise;
  }
};

export const ensureValidSession = async () => {
  await waitForSessionRefresh();

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
      console.log('Sessão expirando em breve, renovando...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !newSession) {
        throw new Error('Não foi possível renovar a sessão. Por favor, faça login novamente.');
      }

      return newSession;
    }

    return session;
  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    throw error;
  }
};

if (typeof window !== 'undefined') {
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let refreshInterval: NodeJS.Timeout | null = null;

  const refreshSessionIfNeeded = async () => {
    if (sessionRefreshInProgress) {
      return;
    }

    sessionRefreshInProgress = true;

    sessionRefreshPromise = (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const expiresAt = session.expires_at;
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

          if (timeUntilExpiry < 300) {
            console.log('Renovando sessão preventivamente...');
            await supabase.auth.refreshSession();
            console.log('Sessão renovada com sucesso');
          }
        }
      } catch (error) {
        console.error('Erro ao verificar/renovar sessão:', error);
      } finally {
        sessionRefreshInProgress = false;
        sessionRefreshPromise = null;
      }
    })();

    await sessionRefreshPromise;
  };

  refreshInterval = setInterval(refreshSessionIfNeeded, 60000);

  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      console.log('Aba ficou visível, verificando conexão...');

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      await refreshSessionIfNeeded();
    } else {
      console.log('Aba ficou oculta');
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  window.addEventListener('focus', async () => {
    console.log('Janela recebeu foco');
    await refreshSessionIfNeeded();
  });

  window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
}