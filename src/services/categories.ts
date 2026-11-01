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

// ─── Descrições mais usadas por categoria ─────────────────────────────────────

const DESC_STORAGE_KEY = 'desc_freq'
const MAX_SUGGESTIONS = 5 // máximo de sugestões por categoria

interface DescFreq {
  [categoriaId: string]: { text: string; count: number }[]
}

export function getDescSuggestions(categoriaId: string): string[] {
  try {
    const raw = localStorage.getItem(DESC_STORAGE_KEY)
    if (!raw) return []
    const data: DescFreq = JSON.parse(raw)
    const list = data[categoriaId] || []
    // Ordena por frequência decrescente
    return list
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_SUGGESTIONS)
      .map((d) => d.text)
  } catch {
    return []
  }
}

export function recordDescUsage(categoriaId: string, text: string) {
  if (!text.trim()) return
  try {
    const raw = localStorage.getItem(DESC_STORAGE_KEY)
    const data: DescFreq = raw ? JSON.parse(raw) : {}
    const list = data[categoriaId] || []
    const existing = list.find((d) => d.text.toLowerCase() === text.trim().toLowerCase())
    if (existing) {
      existing.count += 1
    } else {
      list.push({ text: text.trim(), count: 1 })
    }
    // Mantém só os top MAX_SUGGESTIONS para não crescer infinitamente
    list.sort((a, b) => b.count - a.count)
    data[categoriaId] = list.slice(0, MAX_SUGGESTIONS * 2)
    localStorage.setItem(DESC_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignora erros de localStorage
  }
}
