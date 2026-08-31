import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import { Login } from './components/Login'
import { getDailyProfit } from './services/sales'
import { getAllExpenses, deleteExpense } from './services/expenses'
import { TransactionModal } from './components/TransactionModal'
import { SettingsModal } from './components/SettingsModal'
import { getStoredCategories } from './services/categories'
import type { Expense } from './types'

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getCategoryMeta(catId: string) {
  const categories = getStoredCategories()
  const found = categories.find((c) => c.id === catId || c.id === catId?.toLowerCase())
  if (found) return found
  return { id: catId, label: catId, emoji: '📦' }
}

function formatDate(dateObj: any) {
  let d: Date | null = null
  if (dateObj?.toDate) d = dateObj.toDate()
  else if (dateObj?.seconds) d = new Date(dateObj.seconds * 1000)
  else if (dateObj) d = new Date(dateObj)

  if (!d) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [lucro, setLucro] = useState(0)
  const [faturamento, setFaturamento] = useState(0)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Saldo Ajuste (Local Storage)
  const [saldoAjuste, setSaldoAjuste] = useState(() => {
    return parseFloat(localStorage.getItem('saldo_ajuste') || '0')
  })

  // Visibilidade do saldo
  const [showBalance, setShowBalance] = useState(true)

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'despesa' | 'receita'>('despesa')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setCheckingAuth(false)
    })
    return unsubscribe
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const [profit, exps] = await Promise.all([getDailyProfit(), getAllExpenses()])
      setLucro(profit.lucro)
      setFaturamento(profit.faturamento)
      setExpenses(exps)
    } catch (err) {
      console.error("Erro ao carregar dados:", err)
      setErrorMsg("Ocorreu um erro ao carregar os dados do Firebase.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  const handleDeleteExpense = async (id?: string) => {
    if (!id) return
    try {
      await deleteExpense(id)
      load()
    } catch (err) {
      console.error(err)
    }
  }

  const openModal = (type: 'despesa' | 'receita') => {
    setModalType(type)
    setIsModalOpen(true)
  }

  if (checkingAuth) return null
  if (!user) return <Login />

  const totalDespesas = expenses.reduce((sum, e) => sum + e.valor, 0)
  const receitas = faturamento > 0 ? faturamento : lucro
  const saldoAtual = saldoAjuste + receitas - totalDespesas

  const currentMonthName = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)

  return (
    <div className="app-container">
      {/* Header Superior */}
      <header className="top-bar">
        <div className="user-profile">
          <div className="avatar">
            L
          </div>
          <div className="user-info">
            <span className="greeting">Bem-vindo(a)</span>
            <span className="user-name">Láercio</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="month-selector"
            title="Definições (Saldo & Categorias)"
            onClick={() => setIsSettingsOpen(true)}
          >
            <span>⚙️ Definições</span>
          </button>

          <div className="month-selector">
            <span>{capitalizedMonth}</span>
            <span style={{ fontSize: 10 }}>▼</span>
          </div>

          <button className="logout-btn" title="Sair" onClick={() => signOut(auth)}>
            🚪
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="main-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#a1a1aa' }}>
            <p>Carregando finanças...</p>
          </div>
        ) : errorMsg ? (
          <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: 16, margin: '16px 0', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <p>{errorMsg}</p>
            <button onClick={load} style={{ marginTop: 8, padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            {/* Card Principal de Saldo */}
            <div className="balance-card">
              <div className="balance-header">
                <span>Saldo</span>
              </div>

              <div className={`balance-amount ${!showBalance ? 'hidden-val' : ''}`}>
                {showBalance ? formatBRL(saldoAtual) : '••••••••'}
              </div>

              {/* Indicadores Receitas & Despesas */}
              <div className="income-expense-row">
                <div className="indicator-pill">
                  <div className="pill-icon green">↑</div>
                  <div className="pill-details">
                    <span className="pill-label">Receitas</span>
                    <span className="pill-value green">
                      {showBalance ? formatBRL(receitas) : '•••••'}
                    </span>
                  </div>
                </div>

                <div className="indicator-pill">
                  <div className="pill-icon red">↓</div>
                  <div className="pill-details">
                    <span className="pill-label">Despesas</span>
                    <span className="pill-value red">
                      {showBalance ? formatBRL(totalDespesas) : '•••••'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botões de Ação embaixo */}
            <div className="action-buttons-group">
              <button className="action-btn btn-revenue" onClick={() => openModal('receita')}>
                <span className="btn-icon-circle">+</span>
                Registrar Receita
              </button>

              <button className="action-btn btn-expense" onClick={() => openModal('despesa')}>
                <span className="btn-icon-circle">-</span>
                Registrar Despesa
              </button>
            </div>

            {/* Extrato / Histórico de Movimentações */}
            <section>
              <div className="section-title">
                <h2>Histórico de Despesas</h2>
                <span className="badge-count">{expenses.length} lançamentos</span>
              </div>

              {expenses.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhuma despesa registrada ainda.</p>
                  <span style={{ fontSize: 12, color: '#71717a', display: 'block', marginTop: 4 }}>
                    Use os botões acima para registrar.
                  </span>
                </div>
              ) : (
                <div className="transactions-list">
                  {expenses.map((e) => {
                    const catMeta = getCategoryMeta(e.categoria)
                    const formattedDateStr = formatDate(e.createdAt)
                    return (
                      <div key={e.id} className="transaction-card">
                        <div className="tx-info">
                          <div className="tx-icon expense">
                            {catMeta.emoji}
                          </div>
                          <div>
                            <div className="tx-title" style={{ textTransform: 'capitalize' }}>
                              {catMeta.label}
                            </div>
                            {e.descricao && (
                              <div className="tx-sub">{e.descricao}</div>
                            )}
                            {formattedDateStr && (
                              <div className="tx-sub" style={{ fontSize: 11, color: '#71717a' }}>{formattedDateStr}</div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="tx-amount expense">
                            - {showBalance ? formatBRL(e.valor) : '•••••'}
                          </div>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 14, cursor: 'pointer', padding: 4 }}
                            title="Excluir lançamento"
                            onClick={() => handleDeleteExpense(e.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Modal de Transação */}
      <TransactionModal
        isOpen={isModalOpen}
        defaultType={modalType}
        onClose={() => setIsModalOpen(false)}
        onAdded={load}
      />

      {/* Modal Unificado de Definições (Saldo & Categorias) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        currentNetBalance={receitas - totalDespesas}
        onClose={() => setIsSettingsOpen(false)}
        onBalanceUpdated={(newAjuste) => {
          setSaldoAjuste(newAjuste)
          load()
        }}
        onCategoriesUpdated={load}
      />
    </div>
  )
}
