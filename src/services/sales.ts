import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { didiGasDb, SALES_COLLECTION } from '../firebase'
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
 * Resolve a data de uma venda em qualquer formato que o Didi Gás use
 * (Timestamp do Firestore, segundos, string ISO, campo "data" alternativo, etc).
 */
function resolveSaleDate(sale: any): Date | null {
  if (sale.createdAt?.toDate) return sale.createdAt.toDate()
  if (sale.createdAt?.seconds) return new Date(sale.createdAt.seconds * 1000)
  if (sale.createdAt) return new Date(sale.createdAt)
  if (sale.data?.toDate) return sale.data.toDate()
  if (sale.data) return new Date(sale.data)
  return null
}

function summarize(snap: any, start: Date, end: Date) {
  let faturamento = 0
  let lucro = 0
  let qtdVendas = 0

  snap.forEach((doc: any) => {
    const sale = doc.data() as any
    if (sale.status === 'CANCELADO') return

    const saleDate = resolveSaleDate(sale)
    // Só descarta se a data existir E estiver claramente fora do dia.
    // Vendas sem data reconhecível não são descartadas aqui (evita perder
    // registros com campos de data em formatos inesperados).
    if (saleDate && (saleDate < start || saleDate > end)) return

    faturamento += Number(sale.total || sale.faturamento || sale.valor || 0)
    lucro += Number(sale.lucro || 0)
    qtdVendas += 1
  })

  return { faturamento, lucro, qtdVendas }
}

/**
 * Lê TODAS as vendas da coleção do Didi Gás (sem filtro de data no Firestore)
 * e filtra o dia no cliente. Isso evita o problema de vendas ficarem de fora
 * quando o campo createdAt não é um Timestamp "puro" (ex: string, formato
 * diferente), o que faz o Firestore excluir o documento silenciosamente de
 * uma query com where(">=") / where("<=").
 */
export async function getDailyProfit(date: Date = new Date()) {
  try {
    const start = startOfDay(date)
    const end = endOfDay(date)

    const snap = await getDocs(collection(didiGasDb, SALES_COLLECTION))
    return summarize(snap, start, end)
  } catch (err) {
    console.error("Erro ao carregar lucro diario:", err)
    return { faturamento: 0, lucro: 0, qtdVendas: 0 }
  }
}

/**
 * Escuta a coleção de vendas do Didi Gás em tempo real (sem filtro de data
 * no Firestore, pelo mesmo motivo do getDailyProfit) e chama o callback com
 * o resumo do dia sempre que houver mudança.
 * Retorna a função de unsubscribe (chame no cleanup do useEffect).
 */
export function subscribeDailyProfit(
  callback: (data: { faturamento: number; lucro: number; qtdVendas: number }) => void,
  date: Date = new Date()
) {
  const start = startOfDay(date)
  const end = endOfDay(date)

  return onSnapshot(
    collection(didiGasDb, SALES_COLLECTION),
    (snap) => {
      const result = summarize(snap, start, end)
      callback(result)
    },
    (err) => {
      console.error('Erro no listener de vendas do Didi Gas:', err)
    }
  )
}