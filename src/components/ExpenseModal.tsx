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

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdded: () => void
}

export function ExpenseModal({ isOpen, onClose, onAdded }: Props) {
  const [categoria, setCategoria] = useState<ExpenseCategory>('mercado')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valor) return
    setSaving(true)
    try {
      const numVal = parseFloat(valor.replace(/\./g, '').replace(',', '.'))
      if (!isNaN(numVal) && numVal > 0) {
        await addExpense(categoria, numVal, descricao)
        setValor('')
        setDescricao('')
        onAdded()
        onClose()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><span className="icon-badge red">↓</span> Registrar Despesa</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Categoria</label>
            <div className="category-grid">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={`category-btn ${categoria === c.id ? 'active' : ''}`}
                  onClick={() => setCategoria(c.id)}
                >
                  <span className="emoji">{c.emoji}</span>
                  <span className="cat-name">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Valor (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Descrição (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Almoço, combustível, etc..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary red" disabled={!valor || saving}>
              {saving ? 'Salvando...' : 'Salvar Despesa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
