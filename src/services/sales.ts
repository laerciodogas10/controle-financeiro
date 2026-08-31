import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { db, SALES_COLLECTION } from '../firebase'
import type { Sale } from '../types'

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Lê as vendas do dia direto do Firestore e soma o lucro.
 * Não depende de nenhum resumo pré-calculado — funciona mesmo que
 * o Didi Gás só calcule estatísticas "ao vivo" na tela dele.
 */
export async function getDailyProfit(date: Date = new Date()) {
  try {
    const start = startOfDay(date)
    const end = endOfDay(date)

    let snap
    try {
      const q = query(
        collection(db, SALES_COLLECTION),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<=', Timestamp.fromDate(end))
      )
      snap = await getDocs(q)
    } catch (e) {
      console.warn("Filtro Firestore falhou (pode requerer índice). Buscando todas as vendas para filtrar no cliente:", e)
      snap = await getDocs(collection(db, SALES_COLLECTION))
    }

    let faturamento = 0
    let lucro = 0
    let qtdVendas = 0

    snap.forEach((doc) => {
      const sale = doc.data() as any
      if (sale.status === 'CANCELADO') return

      let saleDate: Date | null = null
      if (sale.createdAt?.toDate) {
        saleDate = sale.createdAt.toDate()
      } else if (sale.createdAt?.seconds) {
        saleDate = new Date(sale.createdAt.seconds * 1000)
      } else if (sale.createdAt) {
        saleDate = new Date(sale.createdAt)
      } else if (sale.data?.toDate) {
        saleDate = sale.data.toDate()
      } else if (sale.data) {
        saleDate = new Date(sale.data)
      }

      if (saleDate && (saleDate < start || saleDate > end)) {
        return
      }

      faturamento += Number(sale.total || sale.faturamento || sale.valor || 0)
      lucro += Number(sale.lucro || 0)
      qtdVendas += 1
    })

    return { faturamento, lucro, qtdVendas }
  } catch (err) {
    console.error("Erro ao carregar lucro diário:", err)
    return { faturamento: 0, lucro: 0, qtdVendas: 0 }
  }
}
