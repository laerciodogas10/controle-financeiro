import { useState } from 'react'

interface Props {
  isOpen: boolean
  selectedYear: number
  selectedMonth: number // 0-indexed
  onSelect: (year: number, month: number) => void
  onClose: () => void
}

const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr',
  'Mai', 'Jun', 'Jul', 'Ago',
  'Set', 'Out', 'Nov', 'Dez',
]

export function MonthPickerModal({ isOpen, selectedYear, selectedMonth, onSelect, onClose }: Props) {
  const [year, setYear] = useState(selectedYear)
  const now = new Date()

  if (!isOpen) return null

  const isFuture = (y: number, m: number) =>
    y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())

  const handleSelect = (m: number) => {
    if (isFuture(year, m)) return
    onSelect(year, m)
    onClose()
  }

  return (
    <div
      className="picker-overlay"
      onClick={onClose}
      style={{ alignItems: 'center' }}
    >
      <div
        className="picker-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: 24,
          maxWidth: 360,
          margin: '0 auto',
          width: '90%',
          padding: '24px 20px 28px',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Header do ano */}
        <div className="picker-header" style={{ borderBottom: 'none', paddingBottom: 8 }}>
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: 22, cursor: 'pointer', padding: '4px 12px' }}
          >
            ‹
          </button>
          <span className="picker-title">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => Math.min(y + 1, now.getFullYear()))}
            disabled={year >= now.getFullYear()}
            style={{
              background: 'none',
              border: 'none',
              color: year >= now.getFullYear() ? '#3f3f46' : '#a1a1aa',
              fontSize: 22,
              cursor: year >= now.getFullYear() ? 'default' : 'pointer',
              padding: '4px 12px',
            }}
          >
            ›
          </button>
        </div>

        {/* Grid de meses */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            marginTop: 16,
          }}
        >
          {MONTHS.map((label, idx) => {
            const future = isFuture(year, idx)
            const active = year === selectedYear && idx === selectedMonth
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(idx)}
                disabled={future}
                style={{
                  padding: '12px 4px',
                  borderRadius: 14,
                  border: active ? '2px solid #6366f1' : '1px solid #27272a',
                  background: active ? 'rgba(99, 102, 241, 0.2)' : '#27272a',
                  color: future ? '#3f3f46' : active ? '#a5b4fc' : '#e4e4e7',
                  fontSize: 13,
                  fontWeight: active ? 700 : 600,
                  cursor: future ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 20,
            width: '100%',
            padding: '13px',
            borderRadius: 16,
            border: '1px solid #27272a',
            background: 'transparent',
            color: '#a1a1aa',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
