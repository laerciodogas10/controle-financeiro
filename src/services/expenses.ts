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

export async function getAllExpenses(): Promise<Expense[]> {
  try {
    const snap = await getDocs(collection(db, EXPENSES_COLLECTION))
    const expenses: Expense[] = []
    snap.docs.forEach((doc) => {
      expenses.push({ id: doc.id, ...(doc.data() as Expense) })
    })

    // Ordena por data decrescente
    expenses.sort((a, b) => {
      const getMs = (item: any) => {
        if (item.createdAt?.toDate) return item.createdAt.toDate().getTime()
        if (item.createdAt?.seconds) return item.createdAt.seconds * 1000
        if (item.createdAt) return new Date(item.createdAt).getTime()
        return 0
      }
      return getMs(b) - getMs(a)
    })

    return expenses
  } catch (err) {
    console.error("Erro ao carregar todas as despesas:", err)
    return []
  }
}

export async function getTodayExpenses(): Promise<Expense[]> {
  return getAllExpenses()
}

export async function deleteExpense(id: string) {
  const { doc, deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, EXPENSES_COLLECTION, id))
}
