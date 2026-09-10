import { useState, useMemo } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import type { TransactionItem } from '../types'
import { getStoredCategories, getStoredRevenueCategories } from '../services/categories'

// Registrando módulos do Chart.js
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
)

interface ChartsPageProps {
  transactions: TransactionItem[]
  onBack?: () => void
}

type PeriodFilter = 'month' | '7d' | '30d' | 'all'

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function getDateMs(dateObj: any): number {
  if (dateObj?.toDate) return dateObj.toDate().getTime()
  if (dateObj?.seconds) return dateObj.seconds * 1000
  if (dateObj) return new Date(dateObj).getTime()
  return 0
}

function getCategoryMeta(catId: string, tipo: 'despesa' | 'receita') {
  const categories = tipo === 'despesa' ? getStoredCategories() : getStoredRevenueCategories()
  const found = categories.find((c) => c.id === catId || c.id === catId?.toLowerCase())
  if (found) return found
  if (catId === 'venda_gas') return { id: 'venda_gas', label: 'Venda de Gás', emoji: '🔥' }
  return { id: catId, label: catId, emoji: tipo === 'receita' ? '💰' : '📦' }
}

const PALETTE = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#84cc16', // Lime
  '#3b82f6', // Blue
]

export function ChartsPage({ transactions }: ChartsPageProps) {
  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [categoryType, setCategoryType] = useState<'despesa' | 'receita'>('despesa')

  // Filtragem por período
  const filteredTransactions = useMemo(() => {
    const now = new Date()
    return transactions.filter((t) => {
      const time = getDateMs(t.createdAt)
      if (!time) return true
      const date = new Date(time)

      if (period === 'month') {
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        )
      }
      if (period === '7d') {
        const diffDays = (now.getTime() - time) / (1000 * 60 * 60 * 24)
        return diffDays >= 0 && diffDays <= 7
      }
      if (period === '30d') {
        const diffDays = (now.getTime() - time) / (1000 * 60 * 60 * 24)
        return diffDays >= 0 && diffDays <= 30
      }
      return true
    })
  }, [transactions, period])

  // Métricas do período
  const { totalDespesas, totalReceitas } = useMemo(() => {
    let desp = 0
    let rec = 0
    filteredTransactions.forEach((t) => {
      if (t.tipo === 'despesa') desp += t.valor
      else rec += t.valor
    })
    return { totalDespesas: desp, totalReceitas: rec }
  }, [filteredTransactions])

  const saldoPeriodo = totalReceitas - totalDespesas

  // 1. DADOS PARA O GRÁFICO DE ROSCA (POR CATEGORIA)
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredTransactions
      .filter((t) => t.tipo === categoryType)
      .forEach((t) => {
        const cat = t.categoria || 'outros'
        map[cat] = (map[cat] || 0) + t.valor
      })

    const entries = Object.entries(map).sort((a, b) => b[1] - a[1])
    const total = entries.reduce((s, [, val]) => s + val, 0)

    const labels: string[] = []
    const values: number[] = []
    const colors: string[] = []
    const breakdown: Array<{ id: string; label: string; emoji: string; valor: number; pct: number; color: string }> = []

    entries.forEach(([catId, val], index) => {
      const meta = getCategoryMeta(catId, categoryType)
      const color = PALETTE[index % PALETTE.length]
      const pct = total > 0 ? Math.round((val / total) * 100) : 0

      labels.push(meta.label)
      values.push(val)
      colors.push(color)
      breakdown.push({
        id: catId,
        label: meta.label,
        emoji: meta.emoji,
        valor: val,
        pct,
        color,
      })
    })

    return { labels, values, colors, breakdown, total }
  }, [filteredTransactions, categoryType])

  // Configuração do Gráfico de Rosca
  const doughnutChartData = {
    labels: categoryData.labels,
    datasets: [
      {
        data: categoryData.values,
        backgroundColor: categoryData.colors,
        borderColor: '#18181b',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1f1f23',
        titleColor: '#ffffff',
        bodyColor: '#e4e4e7',
        borderColor: '#3f3f46',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => {
            const val = context.parsed || 0
            const pct = categoryData.total > 0 ? Math.round((val / categoryData.total) * 100) : 0
            return ` ${formatBRL(val)} (${pct}%)`
          },
        },
      },
    },
  }

  // 2. DADOS PARA O GRÁFICO DE BARRAS POR CATEGORIA
  const barCategoryChartData = {
    labels: categoryData.labels.map((l, i) => `${categoryData.breakdown[i]?.emoji || ''} ${l}`),
    datasets: [
      {
        label: categoryType === 'despesa' ? 'Despesas' : 'Receitas',
        data: categoryData.values,
        backgroundColor: categoryData.colors,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }

  const barCategoryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#1f1f23',
        titleColor: '#ffffff',
        bodyColor: '#e4e4e7',
        borderColor: '#3f3f46',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => ` ${formatBRL(context.parsed.y || 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#a1a1aa',
          font: {
            family: "'Plus Jakarta Sans', sans-serif",
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.06)',
        },
        ticks: {
          color: '#a1a1aa',
          font: {
            family: "'Plus Jakarta Sans', sans-serif",
            size: 11,
          },
          callback: (val: any) => 'R$ ' + val,
        },
      },
    },
  }

  // 3. DADOS PARA O GRÁFICO DE BARRAS POR DIA
  const dailyData = useMemo(() => {
    // Agrupa despesas e receitas por dia (YYYY-MM-DD)
    const dayMap: Record<string, { despesa: number; receita: number; date: Date }> = {}

    filteredTransactions.forEach((t) => {
      const ms = getDateMs(t.createdAt)
      if (!ms) return
      const d = new Date(ms)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      if (!dayMap[key]) {
        dayMap[key] = { despesa: 0, receita: 0, date: d }
      }
      if (t.tipo === 'despesa') {
        dayMap[key].despesa += t.valor
      } else {
        dayMap[key].receita += t.valor
      }
    })

    // Ordena por data crescente
    const sortedKeys = Object.keys(dayMap).sort()

    // Se houver mais de 14 dias, pega os últimos 14 para não espremer no celular
    const displayKeys = sortedKeys.length > 14 ? sortedKeys.slice(-14) : sortedKeys

    const labels = displayKeys.map((k) => {
      const [, m, day] = k.split('-')
      return `${day}/${m}`
    })

    const despesas = displayKeys.map((k) => dayMap[k].despesa)
    const receitas = displayKeys.map((k) => dayMap[k].receita)

    return { labels, despesas, receitas, hasData: displayKeys.length > 0 }
  }, [filteredTransactions])

  const barDailyChartData = {
    labels: dailyData.labels,
    datasets: [
      {
        label: 'Receitas',
        data: dailyData.receitas,
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
      {
        label: 'Despesas',
        data: dailyData.despesas,
        backgroundColor: '#ef4444',
        borderRadius: 4,
      },
    ],
  }

  const barDailyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#e4e4e7',
          boxWidth: 12,
          font: {
            family: "'Plus Jakarta Sans', sans-serif",
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: '#1f1f23',
        titleColor: '#ffffff',
        bodyColor: '#e4e4e7',
        borderColor: '#3f3f46',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${formatBRL(context.parsed.y || 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#a1a1aa',
          font: {
            family: "'Plus Jakarta Sans', sans-serif",
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.06)',
        },
        ticks: {
          color: '#a1a1aa',
          font: {
            family: "'Plus Jakarta Sans', sans-serif",
            size: 11,
          },
          callback: (val: any) => 'R$ ' + val,
        },
      },
    },
  }

  return (
    <div className="charts-page">
      {/* Seletor de Período */}
      <div className="period-selector">
        <button
          type="button"
          className={`period-pill ${period === 'month' ? 'active' : ''}`}
          onClick={() => setPeriod('month')}
        >
          Este Mês
        </button>
        <button
          type="button"
          className={`period-pill ${period === '7d' ? 'active' : ''}`}
          onClick={() => setPeriod('7d')}
        >
          7 Dias
        </button>
        <button
          type="button"
          className={`period-pill ${period === '30d' ? 'active' : ''}`}
          onClick={() => setPeriod('30d')}
        >
          30 Dias
        </button>
        <button
          type="button"
          className={`period-pill ${period === 'all' ? 'active' : ''}`}
          onClick={() => setPeriod('all')}
        >
          Tudo
        </button>
      </div>

      {/* Cards de Resumo do Período */}
      <div className="charts-summary-grid">
        <div className="summary-mini-card">
          <span className="summary-label">Receitas</span>
          <span className="summary-value green">{formatBRL(totalReceitas)}</span>
        </div>
        <div className="summary-mini-card">
          <span className="summary-label">Despesas</span>
          <span className="summary-value red">{formatBRL(totalDespesas)}</span>
        </div>
        <div className="summary-mini-card">
          <span className="summary-label">Balanço</span>
          <span className={`summary-value ${saldoPeriodo >= 0 ? 'green' : 'red'}`}>
            {formatBRL(saldoPeriodo)}
          </span>
        </div>
      </div>

      {/* 1. GRÁFICO DE PIZZA / ROSCA (CATEGORIAS) */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <h3 className="chart-title">Distribuição por Categoria</h3>
            <span className="chart-subtitle">Gráfico de rosca</span>
          </div>

          {/* Toggle Despesas / Receitas */}
          <div className="type-toggle-pill">
            <button
              type="button"
              className={`toggle-sub-pill ${categoryType === 'despesa' ? 'active-red' : ''}`}
              onClick={() => setCategoryType('despesa')}
            >
              Despesas
            </button>
            <button
              type="button"
              className={`toggle-sub-pill ${categoryType === 'receita' ? 'active-green' : ''}`}
              onClick={() => setCategoryType('receita')}
            >
              Receitas
            </button>
          </div>
        </div>

        {categoryData.values.length === 0 ? (
          <div className="chart-empty">
            <span>Nenhuma {categoryType} neste período</span>
          </div>
        ) : (
          <>
            <div className="donut-wrapper">
              <div className="donut-canvas-box">
                <Doughnut data={doughnutChartData} options={doughnutOptions} />
                <div className="donut-center-info">
                  <span className="center-label">Total</span>
                  <span className="center-val">{formatBRL(categoryData.total)}</span>
                </div>
              </div>
            </div>

            {/* Legenda Detalhada com Porcentagens */}
            <div className="category-breakdown-list">
              {categoryData.breakdown.map((item) => (
                <div key={item.id} className="category-breakdown-row">
                  <div className="cat-meta-left">
                    <span className="cat-color-dot" style={{ backgroundColor: item.color }} />
                    <span className="cat-emoji">{item.emoji}</span>
                    <span className="cat-name">{item.label}</span>
                  </div>
                  <div className="cat-meta-right">
                    <span className="cat-pct">{item.pct}%</span>
                    <span className="cat-amount">{formatBRL(item.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 2. GRÁFICO DE BARRAS (POR CATEGORIA) */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <h3 className="chart-title">Comparativo por Categoria</h3>
            <span className="chart-subtitle">
              Gráfico de barras ({categoryType === 'despesa' ? 'Despesas' : 'Receitas'})
            </span>
          </div>
        </div>

        {categoryData.values.length === 0 ? (
          <div className="chart-empty">
            <span>Sem lançamentos no período</span>
          </div>
        ) : (
          <div className="bar-canvas-box" style={{ height: Math.max(220, categoryData.labels.length * 36) }}>
            <Bar data={barCategoryChartData} options={barCategoryOptions} />
          </div>
        )}
      </div>

      {/* 3. GRÁFICO DE BARRAS (POR DIA) */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div>
            <h3 className="chart-title">Evolução Diária</h3>
            <span className="chart-subtitle">Gráfico de barras por dia</span>
          </div>
        </div>

        {!dailyData.hasData ? (
          <div className="chart-empty">
            <span>Sem atividade registrada neste período</span>
          </div>
        ) : (
          <div className="bar-canvas-box" style={{ height: 260 }}>
            <Bar data={barDailyChartData} options={barDailyOptions} />
          </div>
        )}
      </div>
    </div>
  )
}
