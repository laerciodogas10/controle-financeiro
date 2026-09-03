import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { db, REVENUES_COLLECTION } from '../firebase'
import type { Revenue } from '../types'

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function syncDailyRevenue(lucro: number, quantidadeVendas: number, date = new Date()) {
  if (lucro <= 0 || quantidadeVendas <= 0) return

  const key = dateKey(date)
  await setDoc(doc(db, REVENUES_COLLECTION, `auto_venda_gas_${key}`), {
    categoria: 'venda_gas',
    valor: lucro,
    descricao: `Didi Gás - Lucro do dia (${quantidadeVendas} vendas)`,
    origem: 'auto',
    createdAt: Timestamp.fromDate(date),
  })
}

export async function addRevenue(
  categoria: string,
  valor: number,
  descricao: string,
  customDate?: Date
) {
  const safeDate =
    customDate && customDate instanceof Date && !isNaN(customDate.getTime())
      ? customDate
      : new Date()

  await addDoc(collection(db, REVENUES_COLLECTION), {
    categoria: categoria || 'outros',
    valor,
    descricao: descricao || '',
    origem: 'app',
    createdAt: Timestamp.fromDate(safeDate),
  })
}

export async function getAllRevenues(): Promise<Revenue[]> {
  try {
    const snap = await getDocs(collection(db, REVENUES_COLLECTION))
    const revenues: Revenue[] = []
    snap.docs.forEach((doc) => {
      revenues.push({ id: doc.id, ...(doc.data() as Revenue) })
    })

    // Ordena por data decrescente
    revenues.sort((a, b) => {
      const getMs = (item: any) => {
        if (item.createdAt?.toDate) return item.createdAt.toDate().getTime()
        if (item.createdAt?.seconds) return item.createdAt.seconds * 1000
        if (item.createdAt) return new Date(item.createdAt).getTime()
        return 0
      }
      return getMs(b) - getMs(a)
    })

    return revenues
  } catch (err) {
    console.error("Erro ao carregar receitas:", err)
    return []
  }
}

export async function deleteRevenue(id: string) {
  const { doc, deleteDoc } = await import('firebase/firestore')
  await deleteDoc(doc(db, REVENUES_COLLECTION, id))
}
