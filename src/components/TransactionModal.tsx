import { useState, useEffect } from 'react'
import { addExpense } from '../services/expenses'
import { addRevenue } from '../services/sales'
import { DatePickerModal } from './DatePickerModal'
import { CategoryEditModal } from './CategoryEditModal'
import { getStoredCategories, CategoryItem } from '../services/categories'
import type { ExpenseCategory } from '../types'

interface Props {
  isOpen: boolean
  defaultType?: 'despesa' | 'receita'
  onClose: () => void
  onAdded: () => void
}

export function TransactionModal({ isOpen, defaultType = 'despesa', onClose, onAdded }: Props) {
  const [type, setType] = useState<'despesa' | 'receita'>(defaultType)
  const [amountStr, setAmountStr] = useState('0')
  const [descricao, setDescricao] = useState('')
  
  // Categorias Dinâmicas
  const [categories, setCategories] = useState<CategoryItem[]>(getStoredCategories())
  const [categoria, setCategoria] = useState<string>('')
  const [isCategoryEditOpen, setIsCategoryEditOpen] = useState(false)

  const [dateMode, setDateMode] = useState<'hoje' | 'ontem' | 'outros'>('hoje')
  const [customDate, setCustomDate] = useState<Date>(new Date())
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setType(defaultType)
    const stored = getStoredCategories()
    setCategories(stored)
    if (stored.length > 0 && !categoria) {
      setCategoria(stored[0].id)
    }
  }, [defaultType, isOpen])

  const refreshCategories = () => {
    const updated = getStoredCategories()
    setCategories(updated)
    if (updated.length > 0) {
      setCategoria(updated[0].id)
    }
  }

  if (!isOpen) return null

  // Trata o número inteiro (sem centavos)
  const getFormattedValue = () => {
    const numeric = parseInt(amountStr || '0', 10)
    return numeric.toLocaleString('pt-BR')
  }

  const getNumericValue = () => {
    return parseInt(amountStr || '0', 10)
  }

  // Teclado Numérico
  const handleKeyClick = (key: string) => {
    if (key === 'backspace') {
      if (amountStr.length <= 1) {
        setAmountStr('0')
      } else {
        setAmountStr(amountStr.slice(0, -1))
      }
    } else if (key === 'clear') {
      setAmountStr('0')
    } else if (key === '00') {
      if (amountStr !== '0' && amountStr.length < 8) {
        setAmountStr(amountStr + '00')
      }
    } else if (/^[0-9]$/.test(key)) {
      if (amountStr === '0') {
        setAmountStr(key)
      } else if (amountStr.length < 9) {
        setAmountStr(amountStr + key)
      }
    }
  }

  // Manipulação de Datas
  const handleDateModeChange = (mode: 'hoje' | 'ontem' | 'outros') => {
    setDateMode(mode)
    if (mode === 'hoje') {
      setCustomDate(new Date())
    } else if (mode === 'ontem') {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      setCustomDate(yesterday)
    } else if (mode === 'outros') {
      setIsDatePickerOpen(true)
    }
  }

  const handleCustomDateSelected = (selectedDate: Date) => {
    setCustomDate(selectedDate)
    setDateMode('outros')
  }

  const handleSubmit = async () => {
    if (type === 'receita') {
      onClose()
      return
    }

    const val = getNumericValue()
    if (val <= 0) return

    setSaving(true)
    try {
      await addExpense((categoria || 'outros') as ExpenseCategory, val, descricao, 'app', customDate)
      // Limpa formulário
      setAmountStr('0')
      setDescricao('')
      setDateMode('hoje')
      setCustomDate(new Date())
      onAdded()
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const isDespesa = type === 'despesa'

  return (
    <>
      <div className="dark-modal-overlay" onClick={onClose}>
        <div className="dark-modal-container" onClick={(e) => e.stopPropagation()}>
          {/* Barra Superior */}
          <div className="dark-modal-topbar">
            <button className="dark-cancel-link" onClick={onClose}>
              Cancelar
            </button>

            {/* Alternador de Tipo */}
            <div className="type-toggle-dropdown">
              <span
                className={`type-badge-btn ${isDespesa ? 'red' : 'green'}`}
                style={{ opacity: isDespesa ? 1 : 0.7, cursor: 'default' }}
              >
                {isDespesa ? 'Despesa' : 'Receita (somente leitura)'}
              </span>
            </div>
          </div>

          {/* Exibição do Valor */}
          <div className="dark-amount-section">
            <span className="dark-amount-label">
              {isDespesa ? 'Valor da despesa' : 'Valor da receita'}
            </span>
            <div className="dark-amount-row">
              <div className="dark-amount-value">
                R$ {getFormattedValue()}
              </div>
            </div>
          </div>

          {/* Campos do Formulário */}
          <div className="dark-form-body">
            {/* Seletor de Data */}
            <div className="dark-input-row">
              <span className="row-icon">📅</span>
              <div className="date-pills-group">
                <button
                  type="button"
                  className={`date-pill ${dateMode === 'hoje' ? (isDespesa ? 'active-red' : 'active-green') : ''}`}
                  onClick={() => handleDateModeChange('hoje')}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className={`date-pill ${dateMode === 'ontem' ? (isDespesa ? 'active-red' : 'active-green') : ''}`}
                  onClick={() => handleDateModeChange('ontem')}
                >
                  Ontem
                </button>
                <button
                  type="button"
                  className={`date-pill ${dateMode === 'outros' ? (isDespesa ? 'active-red' : 'active-green') : ''}`}
                  onClick={() => handleDateModeChange('outros')}
                >
                  {dateMode === 'outros'
                    ? customDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    : 'Outros'}
                </button>
              </div>
            </div>

            {/* Descrição */}
            <div className="dark-input-row">
              <span className="row-icon">✏️</span>
              <input
                type="text"
                className="dark-text-input"
                placeholder="Descrição"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            {/* Categorias com Botão de Editar ⚙️ */}
            {isDespesa && (
              <div className="dark-input-row category-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="row-icon">🏷️</span>
                    <span style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 600 }}>Categorias</span>
                  </div>
                  <button
                    type="button"
                    style={{ background: '#27272a', border: 'none', color: '#e4e4e7', padding: '4px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setIsCategoryEditOpen(true)}
                  >
                    ⚙️ Editar Categorias
                  </button>
                </div>

                <div className="dark-category-pills" style={{ width: '100%', marginTop: 4 }}>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`dark-cat-pill ${categoria === c.id ? 'active' : ''}`}
                      onClick={() => setCategoria(c.id)}
                    >
                      <span>{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Teclado Numérico */}
          <div className="numeric-keypad">
            <div className="keypad-row">
              <button type="button" onClick={() => handleKeyClick('7')}>7</button>
              <button type="button" onClick={() => handleKeyClick('8')}>8</button>
              <button type="button" onClick={() => handleKeyClick('9')}>9</button>
              <button type="button" className="op-key" onClick={() => handleKeyClick('clear')}>C</button>
            </div>
            <div className="keypad-row">
              <button type="button" onClick={() => handleKeyClick('4')}>4</button>
              <button type="button" onClick={() => handleKeyClick('5')}>5</button>
              <button type="button" onClick={() => handleKeyClick('6')}>6</button>
              <button type="button" className="op-key" onClick={() => handleKeyClick('00')}>00</button>
            </div>
            <div className="keypad-row">
              <button type="button" onClick={() => handleKeyClick('1')}>1</button>
              <button type="button" onClick={() => handleKeyClick('2')}>2</button>
              <button type="button" onClick={() => handleKeyClick('3')}>3</button>
              <button type="button" className="op-key" onClick={() => handleKeyClick('backspace')}>⌫</button>
            </div>
            <div className="keypad-row single-zero">
              <button type="button" className="wide-key" onClick={() => handleKeyClick('0')}>0</button>
            </div>
          </div>

          {/* Ações Inferiores */}
          <div className="dark-modal-actions">
            <button type="button" className="dark-btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className={`dark-btn-filled ${isDespesa ? 'red' : 'green'}`}
              disabled={getNumericValue() <= 0 || saving}
              onClick={handleSubmit}
            >
              {saving ? 'Salvando...' : 'Pronto'}
            </button>
          </div>
        </div>
      </div>

      {/* Roleta de Data */}
      <DatePickerModal
        isOpen={isDatePickerOpen}
        initialDate={customDate}
        onClose={() => setIsDatePickerOpen(false)}
        onSelectDate={handleCustomDateSelected}
      />

      {/* Modal de Edição de Categorias */}
      <CategoryEditModal
        isOpen={isCategoryEditOpen}
        onClose={() => setIsCategoryEditOpen(false)}
        onUpdated={refreshCategories}
      />
    </>
  )
}
