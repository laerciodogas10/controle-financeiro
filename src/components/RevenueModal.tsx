import { useState } from 'react'
import { addRevenue } from '../services/revenues'

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdded: () => void
}

export function RevenueModal({ isOpen, onClose, onAdded }: Props) {
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
        await addRevenue('outros_receita', numVal, descricao)
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
          <h3><span className="icon-badge green">↑</span> Registrar Receita</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
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
            <label>Descrição / Origem (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Venda extra, Serviços..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary green" disabled={!valor || saving}>
              {saving ? 'Salvando...' : 'Salvar Receita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
