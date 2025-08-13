import { useState, useCallback, useRef, useEffect } from 'react';
import { useConnectionStatus } from './useConnectionStatus';
import { useToast } from '@/components/ui/use-toast';

interface ResilientQueryOptions {
  retryAttempts?: number;
  retryDelay?: number;
  cacheTime?: number;
  staleTime?: number;
  refetchOnReconnect?: boolean;
  refetchOnWindowFocus?: boolean;
}

interface QueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  lastFetched: Date | null;
  isStale: boolean;
}

export const useResilientQuery = <T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options: ResilientQueryOptions = {}
) => {
  const {
    retryAttempts = 3,
    retryDelay = 1000,
    cacheTime = 5 * 60 * 1000, // 5 minutos
    staleTime = 30 * 1000, // 30 segundos
    refetchOnReconnect = true,
    refetchOnWindowFocus = true,
  } = options;

  const [state, setState] = useState<QueryState<T>>({
    data: null,
    isLoading: true,
    error: null,
    lastFetched: null,
    isStale: false,
  });

  const { isConnected, isOnline } = useConnectionStatus();
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const hasInitialLoadRef = useRef(false);

  // Carregar dados inicialmente
  useEffect(() => {
    if (!hasInitialLoadRef.current && isOnline && isConnected) {
      hasInitialLoadRef.current = true;
      refetch(true);
    }
  }, [isOnline, isConnected]);

  const executeQuery = useCallback(async (attempt = 0): Promise<T> => {
    // Verificar cache primeiro
    const cached = cacheRef.current.get(queryKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < cacheTime) {
      return cached.data;
    }

    // Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      const data = await queryFn();
      
      // Atualizar cache
      cacheRef.current.set(queryKey, { data, timestamp: now });
      
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }

      // Tentar novamente se ainda há tentativas disponíveis
      if (attempt < retryAttempts && isOnline && isConnected) {
        const delay = retryDelay * Math.pow(2, attempt); // Backoff exponencial
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeQuery(attempt + 1);
      }

      throw error;
    }
  }, [queryKey, queryFn, retryAttempts, retryDelay, cacheTime, isOnline, isConnected]);

  const refetch = useCallback(async (showLoading = true) => {
    if (!isOnline || !isConnected) {
      return;
    }

    if (showLoading) {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      const data = await executeQuery();
      setState(prev => ({
        ...prev,
        data,
        isLoading: false,
        error: null,
        lastFetched: new Date(),
        isStale: false,
      }));
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }));

        toast({
          title: "Dados atualizados",
          description: "Os dados foram carregados com sucesso.",
          variant: "destructive",
        });

        // Tentar novamente após um delay
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        retryTimeoutRef.current = setTimeout(() => refetch(false), 5000);
      }
    }
  }, [executeQuery, isOnline, isConnected, toast]);

  // Refetch automático quando reconectar
  useEffect(() => {
    if (isConnected && refetchOnReconnect && state.data !== null) {
      refetch(false);
    }
  }, [isConnected, refetchOnReconnect, refetch, state.data]);

  // Refetch quando a janela ganha foco
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      if (isConnected && state.lastFetched) {
        const timeSinceLastFetch = Date.now() - state.lastFetched.getTime();
        if (timeSinceLastFetch > staleTime) {
          refetch(false);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, isConnected, state.lastFetched, staleTime, refetch]);

  // Marcar dados como stale após staleTime
  useEffect(() => {
    if (!state.lastFetched) return;

    const timeout = setTimeout(() => {
      setState(prev => ({ ...prev, isStale: true }));
    }, staleTime);

    return () => clearTimeout(timeout);
  }, [state.lastFetched, staleTime]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    refetch,
    isStale: state.isStale || (state.lastFetched && Date.now() - state.lastFetched.getTime() > staleTime),
  };
};