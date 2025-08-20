import { useState, useCallback, useRef, useEffect } from 'react';

interface QueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isStale: boolean;
}

export const useResilientQuery = <T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options: {
    staleTime?: number;
    cacheTime?: number;
    refetchOnReconnect?: boolean;
    refetchOnWindowFocus?: boolean;
  } = {}
) => {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    isLoading: true,
    error: null,
    isStale: false,
  });

  const hasInitialLoadRef = useRef(false);

  const refetch = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await queryFn();
      setState({
        data,
        isLoading: false,
        error: null,
        isStale: false,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [queryFn]);

  // Carregar dados inicialmente
  useEffect(() => {
    if (!hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      refetch();
    }
  }, [refetch]);

  return {
    ...state,
    refetch,
  };
};