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
  origem: 'app' | 'whatsapp' = 'app'
) {
  await addDoc(collection(db, EXPENSES_COLLECTION), {
    categoria,
    valor,
    descricao: descricao || '',
    origem,
    createdAt: Timestamp.now(),
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
  const q = query(
    collection(db, EXPENSES_COLLECTION),
    where('createdAt', '>=', Timestamp.fromDate(startOfDay(date))),
    where('createdAt', '<=', Timestamp.fromDate(endOfDay(date))),
    orderBy('createdAt', 'desc')
  )

  const snap = await getDocs(q)
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Expense) }))
}
