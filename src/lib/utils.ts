import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Helpers de estabilidade de rede
export async function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  let timeout: NodeJS.Timeout
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Tempo de resposta excedido')), ms)
  })
  try {
    return await Promise.race([promise, timer]) as T
  } finally {
    clearTimeout(timeout!)
  }
}

export function retry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 400): Promise<T> {
  return fn().catch(err => {
    if (attempts <= 0) throw err
    return new Promise<T>((resolve) => setTimeout(resolve, delayMs)).then(() => retry(fn, attempts - 1, delayMs))
  })
}
