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

  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'visible') {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      reconnectTimeout = setTimeout(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.auth.refreshSession();
          }
        } catch (error) {
          console.error('Erro ao reconectar:', error);
        }
      }, 100);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  window.addEventListener('focus', async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.refreshSession();
      }
    } catch (error) {
      console.error('Erro ao renovar sessão:', error);
    }
  });
}