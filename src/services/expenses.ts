import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db, EXPENSES_COLLECTION } from '../firebase'
import type { Expense, ExpenseCategory } from '../types'

export async function addExpense(
  categoria: ExpenseCategory,
  valor: number,
  descricao: string,
  origem: 'app' | 'whatsapp' = 'app',
  customDate?: Date
) {
  await addDoc(collection(db, EXPENSES_COLLECTION), {
    categoria,
    valor,
    descricao: descricao || '',
    origem,
    createdAt: customDate ? Timestamp.fromDate(customDate) : Timestamp.now(),
  })
}

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

export async function getTodayExpenses(date: Date = new Date()): Promise<Expense[]> {
  try {
    const start = startOfDay(date)
    const end = endOfDay(date)

    let snap
    try {
      const q = query(
        collection(db, EXPENSES_COLLECTION),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<=', Timestamp.fromDate(end)),
        orderBy('createdAt', 'desc')
      )
      snap = await getDocs(q)
    } catch (e) {
      console.warn("Query ordenada de despesas falhou (possível falta de índice). Buscando coleção inteira:", e)
      snap = await getDocs(collection(db, EXPENSES_COLLECTION))
    }

    const expenses: Expense[] = []
    snap.docs.forEach((doc) => {
      const data = doc.data() as any
      let expDate: Date | null = null
      if (data.createdAt?.toDate) {
        expDate = data.createdAt.toDate()
      } else if (data.createdAt?.seconds) {
        expDate = new Date(data.createdAt.seconds * 1000)
      } else if (data.createdAt) {
        expDate = new Date(data.createdAt)
      }

      if (!expDate || (expDate >= start && expDate <= end)) {
        expenses.push({ id: doc.id, ...data })
      }
    })

    return expenses
  } catch (err) {
    console.error("Erro ao carregar despesas de hoje:", err)
    return []
  }
}
