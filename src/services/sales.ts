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
  const q = query(
    collection(db, SALES_COLLECTION),
    where('createdAt', '>=', Timestamp.fromDate(startOfDay(date))),
    where('createdAt', '<=', Timestamp.fromDate(endOfDay(date)))
  )

  const snap = await getDocs(q)

  let faturamento = 0
  let lucro = 0
  let qtdVendas = 0

  snap.forEach((doc) => {
    const sale = doc.data() as Sale
    // Ignora vendas canceladas; conta ATIVO e LIQUIDADO (fiado pago)
    if (sale.status === 'CANCELADO') return
    faturamento += sale.total || 0
    lucro += sale.lucro || 0
    qtdVendas += 1
  })

  return { faturamento, lucro, qtdVendas }
}
