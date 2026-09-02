export interface CategoryItem {
  id: string
  label: string
  emoji: string
}

// Categorias de DESPESAS
export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'mercado', label: 'Mercado', emoji: '🛒' },
  { id: 'energia', label: 'Energia', emoji: '⚡' },
  { id: 'agua', label: 'Água', emoji: '💧' },
  { id: 'gasolina', label: 'Gasolina', emoji: '⛽' },
  { id: 'outros', label: 'Outros', emoji: '📦' },
]

// Categorias de RECEITAS
export const DEFAULT_REVENUE_CATEGORIES: CategoryItem[] = [
  { id: 'venda_gas', label: 'Venda de Gás', emoji: '🔥' },
  { id: 'servico', label: 'Serviço', emoji: '🛠️' },
  { id: 'transferencia', label: 'Transferência', emoji: '💸' },
  { id: 'outros_receita', label: 'Outros', emoji: '💰' },
]

export function getStoredCategories(): CategoryItem[] {
  const data = localStorage.getItem('user_categories')
  if (data) {
    try {
      return JSON.parse(data)
    } catch (e) {
      console.error('Erro ao ler categorias:', e)
    }
  }
  return DEFAULT_CATEGORIES
}

export function saveCategories(categories: CategoryItem[]) {
  localStorage.setItem('user_categories', JSON.stringify(categories))
}

export function getStoredRevenueCategories(): CategoryItem[] {
  const data = localStorage.getItem('user_revenue_categories')
  if (data) {
    try {
      return JSON.parse(data)
    } catch (e) {
      console.error('Erro ao ler categorias de receita:', e)
    }
  }
  return DEFAULT_REVENUE_CATEGORIES
}

export function saveRevenueCategories(categories: CategoryItem[]) {
  localStorage.setItem('user_revenue_categories', JSON.stringify(categories))
}
