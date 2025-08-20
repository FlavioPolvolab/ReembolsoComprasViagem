import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Função simples para operações com timeout
export async function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  const timeout = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Operação demorou muito para responder')), ms)
  )
  return Promise.race([promise, timeout])
}

// Função simples de retry sem complexidade
export async function simpleRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (attempts <= 1) throw error
    await new Promise(resolve => setTimeout(resolve, 1000))
    return simpleRetry(fn, attempts - 1)
  }
}