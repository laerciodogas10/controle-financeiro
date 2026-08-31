import { useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'
import { Login } from './components/Login'
import { getDailyProfit } from './services/sales'
import { getTodayExpenses } from './services/expenses'
import { ExpenseForm } from './components/ExpenseForm'
import type { Expense } from './types'

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [lucro, setLucro] = useState(0)
  const [faturamento, setFaturamento] = useState(0)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setCheckingAuth(false)
    })
    return unsubscribe
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [profit, exps] = await Promise.all([getDailyProfit(), getTodayExpenses()])
    setLucro(profit.lucro)
    setFaturamento(profit.faturamento)
    setExpenses(exps)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  if (checkingAuth) return null
  if (!user) return <Login />

  const totalDespesas = expenses.reduce((sum, e) => sum + e.valor, 0)
  const resultado = lucro - totalDespesas

  return (
    <div className="app">
      <header>
        <h1>Didi Gas - Financas</h1>
        <p className="subtitle">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
          })}
        </p>
      </header>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <>
          <section className="summary-cards">
            <div className="card">
              <span className="label">Faturamento hoje</span>
              <span className="value">{formatBRL(faturamento)}</span>
            </div>
            <div className="card">
              <span className="label">Lucro (vendas)</span>
              <span className="value positive">{formatBRL(lucro)}</span>
            </div>
            <div className="card">
              <span className="label">Despesas hoje</span>
              <span className="value negative">{formatBRL(totalDespesas)}</span>
            </div>
            <div className="card highlight">
              <span className="label">Resultado liquido</span>
              <span className={`value ${resultado >= 0 ? 'positive' : 'negative'}`}>
                {formatBRL(resultado)}
              </span>
            </div>
          </section>

          <section>
            <h2>Lancar despesa</h2>
            <ExpenseForm onAdded={load} />
          </section>

          <section>
            <h2>Despesas de hoje</h2>
            {expenses.length === 0 ? (
              <p className="empty">Nenhuma despesa lancada ainda hoje.</p>
            ) : (
              <ul className="expense-list">
                {expenses.map((e) => (
                  <li key={e.id}>
                    <span>
                      {e.categoria}
                      {e.descricao ? ` - ${e.descricao}` : ''}
                    </span>
                    <span>{formatBRL(e.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
