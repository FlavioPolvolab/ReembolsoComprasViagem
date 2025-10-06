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

if (typeof window !== 'undefined') {
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let refreshInterval: NodeJS.Timeout | null = null;

  const refreshSessionIfNeeded = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

        if (timeUntilExpiry < 300) {
          console.log('Renovando sessão preventivamente...');
          await supabase.auth.refreshSession();
        }
      }
    } catch (error) {
      console.error('Erro ao verificar/renovar sessão:', error);
    }
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