import { useState } from 'react'

interface Props {
  isOpen: boolean
  currentNetBalance: number
  onClose: () => void
  onUpdated: (newAjuste: number) => void
}

export function BalanceEditModal({ isOpen, currentNetBalance, onClose, onUpdated }: Props) {
  const [novoSaldoStr, setNovoSaldoStr] = useState('')

  if (!isOpen) return null

  const handleResetToZero = () => {
    // Para zerar o saldo, o ajuste deve ser - (lucro - despesas)
    const novoAjuste = -currentNetBalance
    localStorage.setItem('saldo_ajuste', String(novoAjuste))
    onUpdated(novoAjuste)
    onClose()
  }

  const handleCustomSet = (e: React.FormEvent) => {
    e.preventDefault()
    const num = parseFloat(novoSaldoStr.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(num)) {
      const novoAjuste = num - currentNetBalance
      localStorage.setItem('saldo_ajuste', String(novoAjuste))
      onUpdated(novoAjuste)
      onClose()
    }
  }

  return (
    <div className="dark-modal-overlay" onClick={onClose}>
      <div className="dark-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="dark-modal-topbar">
          <h3 style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>
            ✏️ Editar / Zerar Saldo
          </h3>
          <button className="dark-cancel-link" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
          {/* Opção 1: Zerar Saldo */}
          <div style={{ background: '#18181b', padding: 16, borderRadius: 16, border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 15 }}>🔴 Zerar Saldo Atual</span>
            <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>
              Esta ação redefinirá o saldo exibido no painel para <strong>R$ 0,00</strong>.
            </p>
            <button
              type="button"
              className="action-btn btn-expense"
              style={{ padding: 12, borderRadius: 12, marginTop: 6 }}
              onClick={handleResetToZero}
            >
              Zerar Saldo Agora (R$ 0,00)
            </button>
          </div>

          {/* Opção 2: Definir Saldo Customizado */}
          <form onSubmit={handleCustomSet} style={{ background: '#18181b', padding: 16, borderRadius: 16, border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 15 }}>✏️ Definir Saldo Específico</span>
            <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>
              Digite o valor exato que deseja definir como seu Saldo atual:
            </p>

            <input
              type="text"
              inputMode="decimal"
              className="dark-text-input"
              style={{ background: '#27272a', padding: 12, borderRadius: 12, fontSize: 16 }}
              placeholder="Ex: 1500"
              value={novoSaldoStr}
              onChange={(e) => setNovoSaldoStr(e.target.value)}
            />

            <button
              type="submit"
              className="dark-btn-filled green"
              style={{ padding: 12, borderRadius: 12, marginTop: 4 }}
              disabled={!novoSaldoStr.trim()}
            >
              Atualizar Saldo
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
