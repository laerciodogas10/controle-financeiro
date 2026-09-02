import {
  collection,
  addDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db, REVENUES_COLLECTION } from '../firebase'
import type { Revenue } from '../types'

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
