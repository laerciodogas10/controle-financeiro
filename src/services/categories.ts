export interface CategoryItem {
  id: string
  label: string
  emoji: string
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'mercado', label: 'Mercado', emoji: '🛒' },
  { id: 'energia', label: 'Energia', emoji: '⚡' },
  { id: 'agua', label: 'Água', emoji: '💧' },
  { id: 'gasolina', label: 'Gasolina', emoji: '⛽' },
  { id: 'outros', label: 'Outros', emoji: '📦' },
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
