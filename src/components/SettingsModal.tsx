import { useState } from 'react'
import { CategoryItem, getStoredCategories, saveCategories } from '../services/categories'

interface Props {
  isOpen: boolean
  currentNetBalance: number
  onClose: () => void
  onBalanceUpdated: (newAjuste: number) => void
  onCategoriesUpdated: () => void
}

const COMMON_EMOJIS = ['🛒', '⚡', '💧', '⛽', '📦', '🏠', '🍕', '🚗', '💊', '🎓', '🛍️', '🎮', '✈️', '🐾', '💰', '🛠️']

export function SettingsModal({
  isOpen,
  currentNetBalance,
  onClose,
  onBalanceUpdated,
  onCategoriesUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState<'saldo' | 'categorias'>('saldo')

  // Saldo State
  const [novoSaldoStr, setNovoSaldoStr] = useState('')

  // Categorias State
  const [categories, setCategories] = useState<CategoryItem[]>(getStoredCategories())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editEmoji, setEditEmoji] = useState('📦')

  if (!isOpen) return null

  // --- Saldo Handlers ---
  const handleResetToZero = () => {
    const novoAjuste = -currentNetBalance
    localStorage.setItem('saldo_ajuste', String(novoAjuste))
    onBalanceUpdated(novoAjuste)
    onClose()
  }

  const handleCustomSet = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(novoSaldoStr.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(num)) {
      const novoAjuste = num - currentNetBalance
      localStorage.setItem('saldo_ajuste', String(novoAjuste))
      onBalanceUpdated(novoAjuste)
      onClose()
    }
  }

  // --- Categorias Handlers ---
  const handleStartEdit = (cat: CategoryItem) => {
    setEditingId(cat.id)
    setEditLabel(cat.label)
    setEditEmoji(cat.emoji)
  }

  const handleStartNew = () => {
    setEditingId('NEW_CAT')
    setEditLabel('')
    setEditEmoji('✨')
  }

  const handleSaveCategory = () => {
    if (!editLabel.trim()) return

    let updated: CategoryItem[]
    if (editingId === 'NEW_CAT') {
      const newId = 'cat_' + Date.now()
      updated = [...categories, { id: newId, label: editLabel.trim(), emoji: editEmoji }]
    } else {
      updated = categories.map((c) =>
        c.id === editingId ? { ...c, label: editLabel.trim(), emoji: editEmoji } : c
      )
    }

    setCategories(updated)
    saveCategories(updated)
    setEditingId(null)
    onCategoriesUpdated()
  }

  const handleDeleteCategory = (id: string) => {
    if (categories.length <= 1) return
    const updated = categories.filter((c) => c.id !== id)
    setCategories(updated)
    saveCategories(updated)
    onCategoriesUpdated()
  }

  return (
    <div className="dark-modal-overlay" onClick={onClose}>
      <div className="dark-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dark-modal-topbar">
          <h3 style={{ color: 'white', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            ⚙️ Definições
          </h3>
          <button className="dark-cancel-link" onClick={onClose}>
            Fechar
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: '#18181b', padding: 4, borderRadius: 14, border: '1px solid #27272a' }}>
          <button
            type="button"
            style={{
              background: activeTab === 'saldo' ? '#27272a' : 'transparent',
              color: activeTab === 'saldo' ? '#ffffff' : '#a1a1aa',
              border: 'none',
              padding: '8px 12px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setActiveTab('saldo')}
          >
            💰 Saldo
          </button>
          <button
            type="button"
            style={{
              background: activeTab === 'categorias' ? '#27272a' : 'transparent',
              color: activeTab === 'categorias' ? '#ffffff' : '#a1a1aa',
              border: 'none',
              padding: '8px 12px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setActiveTab('categorias')}
          >
            🏷️ Categorias
          </button>
        </div>

        {/* Tab 1: Saldo */}
        {activeTab === 'saldo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
            {/* Zerar Saldo */}
            <div style={{ background: '#18181b', padding: 16, borderRadius: 16, border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 14 }}>🔴 Zerar Saldo</span>
              <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>
                Redefinir o saldo exibido no painel para <strong>R$ 0,00</strong>.
              </p>
              <button
                type="button"
                className="action-btn btn-expense"
                style={{ padding: 12, borderRadius: 12, marginTop: 4, fontSize: 13 }}
                onClick={handleResetToZero}
              >
                Zerar Saldo Agora (R$ 0,00)
              </button>
            </div>

            {/* Ajustar Saldo */}
            <form onSubmit={handleCustomSet} style={{ background: '#18181b', padding: 16, borderRadius: 16, border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 14 }}>✏️ Definir Saldo Atual</span>
              <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>
                Digite o valor que deseja definir como saldo:
              </p>

              <input
                type="text"
                inputMode="decimal"
                className="dark-text-input"
                style={{ background: '#27272a', padding: 12, borderRadius: 12, fontSize: 15 }}
                placeholder="Ex: 1500"
                value={novoSaldoStr}
                onChange={(e) => setNovoSaldoStr(e.target.value)}
              />

              <button
                type="submit"
                className="dark-btn-filled green"
                style={{ padding: 12, borderRadius: 12, fontSize: 13 }}
                disabled={!novoSaldoStr.trim()}
              >
                Atualizar Saldo
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Categorias */}
        {activeTab === 'categorias' && (
          <div>
            {editingId ? (
              <div className="dark-form-body" style={{ padding: 14, background: '#18181b', borderRadius: 16 }}>
                <h4 style={{ color: '#e4e4e7', fontSize: 14, marginBottom: 10 }}>
                  {editingId === 'NEW_CAT' ? 'Nova Categoria' : 'Editar Categoria'}
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: '#a1a1aa' }}>Emoji:</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 24, padding: '4px 10px', background: '#27272a', borderRadius: 12 }}>
                      {editEmoji}
                    </span>
                    <input
                      type="text"
                      className="dark-text-input"
                      style={{ width: 60, textAlign: 'center', background: '#27272a', padding: 8, borderRadius: 10 }}
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                      maxLength={2}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {COMMON_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        style={{ background: '#27272a', border: 'none', fontSize: 18, padding: '4px 8px', borderRadius: 8, cursor: 'pointer' }}
                        onClick={() => setEditEmoji(em)}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  <label style={{ fontSize: 12, color: '#a1a1aa' }}>Nome da Categoria:</label>
                  <input
                    type="text"
                    className="dark-text-input"
                    style={{ background: '#27272a', padding: 10, borderRadius: 10 }}
                    placeholder="Ex: Alimentação..."
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    className="dark-btn-outline"
                    style={{ flex: 1, padding: 10, fontSize: 13 }}
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="dark-btn-filled green"
                    style={{ flex: 1, padding: 10, fontSize: 13 }}
                    disabled={!editLabel.trim()}
                    onClick={handleSaveCategory}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      className="dark-input-row"
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{c.emoji}</span>
                        <span style={{ color: '#f4f4f5', fontWeight: 600, fontSize: 14 }}>{c.label}</span>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          style={{ background: '#27272a', border: 'none', color: '#e4e4e7', padding: '6px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                          onClick={() => handleStartEdit(c)}
                        >
                          Editar
                        </button>
                        {categories.length > 1 && (
                          <button
                            type="button"
                            style={{ background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#f87171', padding: '6px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 12 }}
                            onClick={() => handleDeleteCategory(c.id)}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="action-btn btn-revenue"
                  style={{ padding: 12, borderRadius: 14, fontSize: 14 }}
                  onClick={handleStartNew}
                >
                  + Criar Nova Categoria
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
