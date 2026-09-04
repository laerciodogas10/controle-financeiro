import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import { Login } from './components/Login'
import { subscribeDailyProfit } from './services/sales'
import { getAllExpenses, deleteExpense } from './services/expenses'
import { getAllRevenues, deleteRevenue, syncDailyRevenue } from './services/revenues'
import { TransactionModal } from './components/TransactionModal'
import { SettingsModal } from './components/SettingsModal'
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

function isToday(dateObj: any) {
  const ms = getDateMs(dateObj)
  if (!ms) return false
  const date = new Date(ms)
  const today = new Date()
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
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
      const [exps, revs] = await Promise.all([getAllExpenses(), getAllRevenues()])

      // Monta lista unificada de transações
      const items: TransactionItem[] = []

      // Receitas automáticas e manuais ficam na coleção local "receitas".
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

      // Despesas ficam na coleção local "despesas".
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

      // Ordena por data (mais recente primeiro).
      items.sort((a, b) => {
        return getDateMs(b.createdAt) - getDateMs(a.createdAt)
      })

      setTransactions(items)

      // Calcula totais
      const totRec = revs.reduce((sum, revenue) => {
        const isAutomatic = revenue.id?.startsWith('auto_venda_gas_')
        return sum + (!isAutomatic || isToday(revenue.createdAt) ? revenue.valor : 0)
      }, 0)
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

  // Escuta o lucro do dia do Didi Gás em tempo real.
  // Toda vez que houver uma venda nova, cancelada, etc., recalcula e
  // sincroniza a receita automática "Venda de Gás" sozinho.
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
    if (item.id.startsWith('auto_venda_gas_')) return // Não pode deletar entrada automática
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

  if (checkingAuth) return null
  if (!user) return <Login />

  const saldoAtual = saldoAjuste + totalReceitas - totalDespesas

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
                      {showBalance ? formatBRL(totalReceitas) : '•••••'}
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

            {/* Botões de Ação */}
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

            {/* Histórico Unificado */}
            <section>
              <div className="section-title">
                <h2>Histórico</h2>
                <span className="badge-count">{transactions.length} lançamentos</span>
              </div>

              {transactions.length === 0 ? (
                <div className="empty-state">
                  <p>Nenhum lançamento registrado ainda.</p>
                  <span style={{ fontSize: 12, color: '#71717a', display: 'block', marginTop: 4 }}>
                    Use os botões acima para registrar.
                  </span>
                </div>
              ) : (
                <div className="transactions-list">
                  {transactions.map((t) => {
                    const isReceita = t.tipo === 'receita'
                    const catMeta = getCategoryMeta(t.categoria, t.tipo)
                    const formattedDateStr = formatDate(t.createdAt)
                    const isAuto = t.id === 'auto_venda_gas'

                    return (
                      <div key={t.id} className="transaction-card">
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
                          {!isAuto && (
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 14, cursor: 'pointer', padding: 4 }}
                              title="Excluir lançamento"
                              onClick={() => handleDeleteTransaction(t)}
                            >
                              🗑️
                            </button>
                          )}
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
        currentNetBalance={totalReceitas - totalDespesas}
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