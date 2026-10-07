import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import { Login } from './components/Login'
import { subscribeDailyProfit } from './services/sales'
import { getAllExpenses, deleteExpense } from './services/expenses'
import { getAllRevenues, deleteRevenue, syncDailyRevenue } from './services/revenues'
import { TransactionModal } from './components/TransactionModal'
import { SettingsModal } from './components/SettingsModal'
import { ChartsPage } from './components/ChartsPage'
import { MonthPickerModal } from './components/MonthPickerModal'
import { getStoredCategories, getStoredRevenueCategories } from './services/categories'
import type { Expense, Revenue, TransactionItem } from './types'

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getCategoryMeta(catId: string, tipo: 'despesa' | 'receita') {
  const categories = tipo === 'despesa' ? getStoredCategories() : getStoredRevenueCategories()
  const found = categories.find((c) => c.id === catId || c.id === catId?.toLowerCase())
  if (found) return found
  // Fallback especial para venda_gas (auto)
  if (catId === 'venda_gas') return { id: 'venda_gas', label: 'Venda de Gás', emoji: '🔥' }
  return { id: catId, label: catId, emoji: tipo === 'receita' ? '💰' : '📦' }
}

function getDateMs(dateObj: any): number {
  if (dateObj?.toDate) return dateObj.toDate().getTime()
  if (dateObj?.seconds) return dateObj.seconds * 1000
  if (dateObj) return new Date(dateObj).getTime()
  return 0
}

function formatDate(dateObj: any) {
  const ms = getDateMs(dateObj)
  if (!ms) return ''
  const d = new Date(ms)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function getDayLabel(date: Date) {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (isSameDay(date, today)) return 'Hoje'
  if (isSameDay(date, yesterday)) return 'Ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [lucro, setLucro] = useState(0)
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [totalReceitas, setTotalReceitas] = useState(0)
  const [totalDespesas, setTotalDespesas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Dia selecionado para o resumo diário (com navegação < / >)
  const [selectedDay, setSelectedDay] = useState(() => new Date())

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

  // Aba ativa: 'home' | 'charts'
  const [activeTab, setActiveTab] = useState<'home' | 'charts'>('home')

  // Mês/Ano selecionado para filtrar transações
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth())
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)

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
      const [exps, revs] = await Promise.all([getAllExpenses(), getAllRevenues()])

      const items: TransactionItem[] = []

      revs.forEach((r) => {
        items.push({
          id: r.id || 'rev_' + Math.random(),
          tipo: 'receita',
          categoria: r.categoria,
          valor: r.valor,
          descricao: r.descricao,
          createdAt: r.createdAt,
        })
      })

      exps.forEach((e) => {
        items.push({
          id: e.id || 'exp_' + Math.random(),
          tipo: 'despesa',
          categoria: e.categoria,
          valor: e.valor,
          descricao: e.descricao,
          createdAt: e.createdAt,
        })
      })

      items.sort((a, b) => {
        return getDateMs(b.createdAt) - getDateMs(a.createdAt)
      })

      setTransactions(items)

      const totRec = revs.reduce((sum, revenue) => sum + (revenue.valor || 0), 0)
      const totDesp = exps.reduce((s, e) => s + e.valor, 0)
      setTotalReceitas(totRec)
      setTotalDespesas(totDesp)
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

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeDailyProfit(async (profit) => {
      setLucro(profit.lucro)
      await syncDailyRevenue(profit.lucro, profit.qtdVendas)
      load()
    })
    return () => unsubscribe()
  }, [user, load])

  const handleDeleteTransaction = async (item: TransactionItem) => {
    try {
      if (item.tipo === 'despesa') {
        await deleteExpense(item.id)
      } else {
        await deleteRevenue(item.id)
      }
      load()
    } catch (err) {
      console.error(err)
    }
  }

  const openModal = (type: 'despesa' | 'receita') => {
    setModalType(type)
    setIsModalOpen(true)
  }

  const goToPreviousDay = () => {
    setSelectedDay((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 1)
      return d
    })
  }

  const goToNextDay = () => {
    setSelectedDay((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 1)
      return d
    })
  }

  if (checkingAuth) return null
  if (!user) return <Login />

  // Filtra transações pelo mês/ano selecionado
  const filteredTransactions = transactions.filter((t) => {
    const d = new Date(getDateMs(t.createdAt))
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth
  })

  const filteredReceitas = filteredTransactions
    .filter((t) => t.tipo === 'receita')
    .reduce((sum, t) => sum + t.valor, 0)

  const filteredDespesas = filteredTransactions
    .filter((t) => t.tipo === 'despesa')
    .reduce((sum, t) => sum + t.valor, 0)

  const saldoAtual = saldoAjuste + totalReceitas - totalDespesas

  const selectedMonthDate = new Date(selectedYear, selectedMonth, 1)
  const currentMonthName = selectedMonthDate.toLocaleDateString('pt-BR', { month: 'long' })
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)

  const receitaDoDia = filteredTransactions
    .filter((t) => t.tipo === 'receita' && isSameDay(new Date(getDateMs(t.createdAt)), selectedDay))
    .reduce((sum, t) => sum + t.valor, 0)

  const despesaDoDia = filteredTransactions
    .filter((t) => t.tipo === 'despesa' && isSameDay(new Date(getDateMs(t.createdAt)), selectedDay))
    .reduce((sum, t) => sum + t.valor, 0)

  const isFutureDay = new Date(selectedDay).setHours(0, 0, 0, 0) > new Date().setHours(0, 0, 0, 0)

  return (
    <div className="app-container">
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

          <button
            type="button"
            className="month-selector"
            onClick={() => setIsMonthPickerOpen(true)}
            title="Selecionar mês"
          >
            <span>{capitalizedMonth} {selectedYear !== new Date().getFullYear() ? selectedYear : ''}</span>
            <span style={{ fontSize: 10 }}>▼</span>
          </button>

          <button className="logout-btn" title="Sair" onClick={() => signOut(auth)}>
            🚪
          </button>
        </div>
      </header>

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
        ) : activeTab === 'charts' ? (
          <ChartsPage transactions={transactions} />
        ) : (
          <>
            <div className="balance-card">
              <div className="balance-header">
                <span>Saldo</span>
              </div>

              <div className={`balance-amount ${!showBalance ? 'hidden-val' : ''}`}>
                {showBalance ? formatBRL(saldoAtual) : '••••••••'}
              </div>

              <div className="income-expense-row">
                <div className="indicator-pill">
                  <div className="pill-icon green">↑</div>
                  <div className="pill-details">
                    <span className="pill-label">Receitas</span>
                    <span className="pill-value green">
                      {showBalance ? formatBRL(filteredReceitas) : '•••••'}
                    </span>
                  </div>
                </div>

                <div className="indicator-pill">
                  <div className="pill-icon red">↓</div>
                  <div className="pill-details">
                    <span className="pill-label">Despesas</span>
                    <span className="pill-value red">
                      {showBalance ? formatBRL(filteredDespesas) : '•••••'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resumo do dia selecionado, com navegação < Dia > */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={goToPreviousDay}
                    aria-label="Dia anterior"
                    style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: 18, cursor: 'pointer', padding: 4 }}
                  >
                    ‹
                  </button>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{getDayLabel(selectedDay)}</span>
                  <button
                    type="button"
                    onClick={goToNextDay}
                    disabled={isFutureDay}
                    aria-label="Próximo dia"
                    style={{ background: 'none', border: 'none', color: isFutureDay ? '#3f3f46' : '#a1a1aa', fontSize: 18, cursor: isFutureDay ? 'default' : 'pointer', padding: 4 }}
                  >
                    ›
                  </button>
                </div>

                <div className="income-expense-row" style={{ gap: 8 }}>
                  <div className="indicator-pill" style={{ padding: '8px 10px', gap: 8 }}>
                    <div className="pill-icon green" style={{ width: 22, height: 22, fontSize: 11 }}>↑</div>
                    <div className="pill-details">
                      <span className="pill-label" style={{ fontSize: 11 }}>Receita do dia</span>
                      <span className="pill-value green" style={{ fontSize: 13 }}>
                        {showBalance ? formatBRL(receitaDoDia) : '•••••'}
                      </span>
                    </div>
                  </div>

                  <div className="indicator-pill" style={{ padding: '8px 10px', gap: 8 }}>
                    <div className="pill-icon red" style={{ width: 22, height: 22, fontSize: 11 }}>↓</div>
                    <div className="pill-details">
                      <span className="pill-label" style={{ fontSize: 11 }}>Despesa do dia</span>
                      <span className="pill-value red" style={{ fontSize: 13 }}>
                        {showBalance ? formatBRL(despesaDoDia) : '•••••'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

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

            <section>
              <div className="section-title">
                <h2>Histórico</h2>
                <span className="badge-count">{filteredTransactions.length} lançamentos</span>
              </div>

              {filteredTransactions.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhum lançamento em {capitalizedMonth}{selectedYear !== new Date().getFullYear() ? ` de ${selectedYear}` : ''}.</p>
                  <span style={{ fontSize: 12, color: '#71717a', display: 'block', marginTop: 4 }}>
                    {transactions.length > 0 ? 'Selecione outro mês para ver lançamentos.' : 'Use os botões acima para registrar.'}
                  </span>
                </div>
              ) : (
                <div className="transactions-list">
                  {(() => {
                    let lastDayKey: string | null = null
                    return filteredTransactions.map((t) => {
                      const isReceita = t.tipo === 'receita'
                      const catMeta = getCategoryMeta(t.categoria, t.tipo)
                      const formattedDateStr = formatDate(t.createdAt)
                      const isAuto = t.id?.startsWith('auto_venda_gas_')

                      const itemDate = new Date(getDateMs(t.createdAt))
                      const dayKey = itemDate.toDateString()
                      const showSeparator = dayKey !== lastDayKey
                      lastDayKey = dayKey

                      return (
                        <div key={t.id}>
                          {showSeparator && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', padding: '12px 4px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 8 }}>
                              {getDayLabel(itemDate)}
                            </div>
                          )}
                          <div className="transaction-card">
                            <div className="tx-info">
                              <div className={`tx-icon ${isReceita ? 'revenue' : 'expense'}`}>
                                {catMeta.emoji}
                              </div>
                              <div>
                                <div className="tx-title" style={{ textTransform: 'capitalize' }}>
                                  {catMeta.label}
                                  {isAuto && (
                                    <span style={{ fontSize: 10, color: '#a1a1aa', marginLeft: 6, fontWeight: 400 }}>
                                      (auto)
                                    </span>
                                  )}
                                </div>
                                {t.descricao && (
                                  <div className="tx-sub">{t.descricao}</div>
                                )}
                                {formattedDateStr && (
                                  <div className="tx-sub" style={{ fontSize: 11, color: '#71717a' }}>{formattedDateStr}</div>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className={`tx-amount ${isReceita ? 'revenue' : 'expense'}`}>
                                {isReceita ? '+ ' : '- '}{showBalance ? formatBRL(t.valor) : '•••••'}
                              </div>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 14, cursor: 'pointer', padding: 4 }}
                                title="Excluir lançamento"
                                onClick={() => handleDeleteTransaction(t)}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Barra de Navegação Inferior */}
      <nav className="bottom-nav">
        <button
          type="button"
          className={`bottom-nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Início</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Gráficos</span>
        </button>
      </nav>

      <TransactionModal
        isOpen={isModalOpen}
        defaultType={modalType}
        onClose={() => setIsModalOpen(false)}
        onAdded={load}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        currentNetBalance={totalReceitas - totalDespesas}
        onClose={() => setIsSettingsOpen(false)}
        onBalanceUpdated={(newAjuste) => {
          setSaldoAjuste(newAjuste)
          load()
        }}
        onCategoriesUpdated={load}
      />

      <MonthPickerModal
        isOpen={isMonthPickerOpen}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onSelect={(y, m) => {
          setSelectedYear(y)
          setSelectedMonth(m)
          setSelectedDay(new Date(y, m, 1))
        }}
        onClose={() => setIsMonthPickerOpen(false)}
      />
    </div>
  )
}
