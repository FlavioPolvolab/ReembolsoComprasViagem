import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

export interface ConnectionStatus {
  isOnline: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

export const useConnectionStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    isConnected: true,
    isReconnecting: false,
    lastConnected: new Date(),
    reconnectAttempts: 0,
  });
  const { toast } = useToast();

  const checkConnection = useCallback(async () => {
    try {
      // Teste simples de conectividade com timeout curto
      const { data, error } = await Promise.race([
        supabase.from('users').select('id').limit(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        )
      ]) as any;

      if (error && error.message.includes('JWT')) {
        // Token expirado - tentar renovar sessão
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('Session expired');
        }
        return true;
      }

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }, []);

  const reconnect = useCallback(async () => {
    if (status.isReconnecting) return;

    setStatus(prev => ({ 
      ...prev, 
      isReconnecting: true,
      reconnectAttempts: prev.reconnectAttempts + 1 
    }));

    try {
      const isConnected = await checkConnection();
      
      if (isConnected) {
        setStatus(prev => ({
          ...prev,
          isConnected: true,
          isReconnecting: false,
          lastConnected: new Date(),
          reconnectAttempts: 0,
        }));

        toast({
          title: "Conexão restaurada",
          description: "A conexão com o banco de dados foi restabelecida.",
        });
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        isReconnecting: false,
      }));

      // Tentar reconectar novamente após um delay progressivo
      const delay = Math.min(1000 * Math.pow(2, status.reconnectAttempts), 30000);
      setTimeout(reconnect, delay);
    }
  }, [status.isReconnecting, status.reconnectAttempts, checkConnection, toast]);

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      if (!status.isConnected) {
        reconnect();
      }
    };

    const handleOffline = () => {
      setStatus(prev => ({ 
        ...prev, 
        isOnline: false, 
        isConnected: false 
      }));
      toast({
        title: "Conexão perdida",
        description: "Você está offline. Tentaremos reconectar automaticamente.",
        variant: "destructive",
      });
    };

    // Monitorar status de rede
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar conexão periodicamente
    const connectionInterval = setInterval(async () => {
      if (status.isOnline && !status.isReconnecting) {
        const isConnected = await checkConnection();
        if (!isConnected && status.isConnected) {
          setStatus(prev => ({ ...prev, isConnected: false }));
          toast({
            title: "Conexão instável",
            description: "Detectamos problemas de conexão. Tentando reconectar...",
            variant: "destructive",
          });
          reconnect();
        }
      }
    }, 30000); // Verificar a cada 30 segundos

    // Verificar conexão quando a aba fica visível
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status.isOnline) {
        checkConnection().then(isConnected => {
          if (!isConnected && status.isConnected) {
            reconnect();
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(connectionInterval);
    };
  }, [status.isOnline, status.isConnected, status.isReconnecting, checkConnection, reconnect, toast]);

  return {
    ...status,
    reconnect,
    checkConnection,
  };
};