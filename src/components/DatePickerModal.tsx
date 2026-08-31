import { useState } from 'react'

interface DatePickerModalProps {
  isOpen: boolean
  initialDate: Date
  onClose: () => void
  onSelectDate: (date: Date) => void
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
]

export function DatePickerModal({ isOpen, initialDate, onClose, onSelectDate }: DatePickerModalProps) {
  const [day, setDay] = useState(initialDate.getDate())
  const [monthIndex, setMonthIndex] = useState(initialDate.getMonth())
  const [year, setYear] = useState(initialDate.getFullYear())

  if (!isOpen) return null

  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const years = Array.from({ length: 11 }, (_, i) => 2020 + i)

  const handleConfirm = () => {
    const selectedDate = new Date(year, monthIndex, day, 12, 0, 0)
    onSelectDate(selectedDate)
    onClose()
  }

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="picker-header">
          <span className="picker-title">Selecione uma data</span>
          <button className="picker-done-btn" onClick={handleConfirm}>
            Pronto
          </button>
        </div>

        {/* Wheel Container */}
        <div className="wheel-container">
          <div className="wheel-selection-bar" />

          {/* Days Column */}
          <div className="wheel-column">
            {days.map((d) => (
              <div
                key={d}
                className={`wheel-item ${d === day ? 'selected' : ''}`}
                onClick={() => setDay(d)}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Months Column */}
          <div className="wheel-column">
            {MONTHS.map((m, idx) => (
              <div
                key={m}
                className={`wheel-item ${idx === monthIndex ? 'selected' : ''}`}
                onClick={() => setMonthIndex(idx)}
              >
                {m}
              </div>
            ))}
          </div>

          {/* Years Column */}
          <div className="wheel-column">
            {years.map((y) => (
              <div
                key={y}
                className={`wheel-item ${y === year ? 'selected' : ''}`}
                onClick={() => setYear(y)}
              >
                {y}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
