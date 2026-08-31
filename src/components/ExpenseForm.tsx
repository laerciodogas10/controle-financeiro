import { useState } from 'react'
import { addExpense } from '../services/expenses'
import type { ExpenseCategory } from '../types'

const CATEGORIES: { id: ExpenseCategory; label: string; emoji: string }[] = [
  { id: 'mercado', label: 'Mercado', emoji: '🛒' },
  { id: 'energia', label: 'Energia', emoji: '⚡' },
  { id: 'agua', label: 'Água', emoji: '💧' },
  { id: 'gasolina', label: 'Gasolina', emoji: '⛽' },
  { id: 'outros', label: 'Outros', emoji: '📦' },
]

export function ExpenseForm({ onAdded }: { onAdded: () => void }) {
  const [categoria, setCategoria] = useState<ExpenseCategory | null>(null)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoria || !valor) return
    setSaving(true)
    try {
      await addExpense(categoria, parseFloat(valor.replace(',', '.')), descricao)
      setCategoria(null)
      setValor('')
      setDescricao('')
      onAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="expense-form">
      <div className="category-grid">
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c.id}
            className={`category-btn ${categoria === c.id ? 'active' : ''}`}
            onClick={() => setCategoria(c.id)}
          >
            <span className="emoji">{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        inputMode="decimal"
        placeholder="Valor (ex: 45,90)"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />

      <input
        type="text"
        placeholder="Descrição (opcional)"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />

      <button type="submit" disabled={!categoria || !valor || saving}>
        {saving ? 'Salvando...' : 'Lançar despesa'}
      </button>
    </form>
  )
}
