import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface ConnectionStatus {
  isOnline: boolean;
  isConnected: boolean;
  isReconnecting: boolean;
}

export const useConnectionStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    isConnected: true,
    isReconnecting: false,
  });

  const checkConnection = useCallback(async () => {
    try {
      const { data, error } = await Promise.race([
        supabase.from('users').select('id').limit(1),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 3000)
        )
      ]) as any;

      return !error;
    } catch (error) {
      return false;
    }
  }, []);

  const reconnect = useCallback(async () => {
    if (status.isReconnecting) return;

    setStatus(prev => ({ ...prev, isReconnecting: true }));

    try {
      const isConnected = await checkConnection();
      setStatus(prev => ({
        ...prev,
        isConnected,
        isReconnecting: false,
      }));
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        isReconnecting: false,
      }));
    }
  }, [status.isReconnecting, checkConnection]);

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus(prev => ({ 
        ...prev, 
        isOnline: false, 
        isConnected: false 
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    ...status,
    reconnect,
    checkConnection,
  };
};