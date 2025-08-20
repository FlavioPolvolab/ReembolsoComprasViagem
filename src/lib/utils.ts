import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helpers de estabilidade de rede melhorados
export async function withTimeout<T>(promise: Promise<T>, ms = 30000): Promise<T> {
  let timeout: NodeJS.Timeout
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Tempo de resposta excedido. Verifique sua conexão e tente novamente.')), ms)
  })
  try {
    return await Promise.race([promise, timer]) as T
  } finally {
    clearTimeout(timeout!)
  }
}

export function retry<T>(fn: () => Promise<T>, attempts = 5, delayMs = 1000): Promise<T> {
  return fn().catch(err => {
    if (attempts <= 0) {
      console.error('Todas as tentativas de retry falharam:', err);
      throw err;
    }
    console.log(`Tentativa falhou, tentando novamente em ${delayMs}ms. Tentativas restantes: ${attempts - 1}`);
    return new Promise<T>((resolve) => setTimeout(resolve, delayMs)).then(() => retry(fn, attempts - 1, delayMs * 1.5))
  })
}

// Função para executar operações com reconexão automática
export async function withReconnect<T>(
  operation: () => Promise<T>,
  maxAttempts = 5,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(operation(), 30000);
    } catch (error: any) {
      lastError = error;
      
      // Se é erro de rede ou timeout, tentar novamente
      if (
        error.message?.includes('fetch') ||
        error.message?.includes('network') ||
        error.message?.includes('timeout') ||
        error.message?.includes('Tempo de resposta excedido') ||
        error.message?.includes('NetworkError') ||
        error.message?.includes('Failed to fetch') ||
        error.code === 'PGRST301' // Supabase connection error
      ) {
        if (attempt < maxAttempts) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 10000); // Max 10s delay
          console.log(`Tentativa ${attempt} falhou, tentando novamente em ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Para outros tipos de erro, não tentar novamente
      throw error;
    }
  }
  
  throw lastError!;
