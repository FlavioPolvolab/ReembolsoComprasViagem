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
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-client-info': 'reembolso-app',
    },
  },
});

// Configurar reconexão automática para realtime
supabase.realtime.onOpen(() => {
  console.log('Realtime connection opened');
});

supabase.realtime.onClose(() => {
  console.log('Realtime connection closed');
});

supabase.realtime.onError((error) => {
  console.error('Realtime connection error:', error);
});
