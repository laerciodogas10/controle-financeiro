import { Timestamp } from 'firebase/firestore'

// Espelha o formato usado no Didi Gás (sales.ts)
export interface Sale {
  id?: string
  total: number
  custoTotal: number
  lucro: number
  formaPagto: string
  status: 'ATIVO' | 'CANCELADO' | 'LIQUIDADO'
  createdAt?: Timestamp | Date
}

export type ExpenseCategory =
  | 'mercado'
  | 'energia'
  | 'agua'
  | 'gasolina'
  | 'outros'
  | string

export interface Expense {
  id?: string
  categoria: ExpenseCategory
  valor: number
  descricao?: string
  origem: 'app' | 'whatsapp'
  createdAt?: Timestamp | Date
}

export interface Revenue {
  id?: string
  categoria: string
  valor: number
  descricao?: string
  origem: 'app' | 'auto'
  createdAt?: Timestamp | Date
}

// Tipo unificado para o histórico
export interface TransactionItem {
  id: string
  tipo: 'receita' | 'despesa'
  categoria: string
  valor: number
  descricao?: string
  createdAt?: any
}
