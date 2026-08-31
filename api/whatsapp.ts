import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// Inicializa o Firebase Admin (permissão de escrita direta, sem precisar de login)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // No painel da Vercel, cole a chave com \n literais nas quebras de linha
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  })
}

const db = getFirestore()

const CATEGORY_KEYWORDS: Record<string, string> = {
  mercado: 'mercado',
  supermercado: 'mercado',
  energia: 'energia',
  luz: 'energia',
  agua: 'agua',
  água: 'agua',
  gasolina: 'gasolina',
  combustivel: 'gasolina',
  combustível: 'gasolina',
}

/**
 * Entende mensagens tipo:
 *   "gasolina 150"
 *   "mercado 320,50 compras da semana"
 * Formato: categoria + valor (+ descrição opcional)
 */
function parseMessage(text: string) {
  const parts = text.trim().toLowerCase().split(/\s+/)
  if (parts.length < 2) return null

  const categoriaRaw = parts[0]
  const categoria = CATEGORY_KEYWORDS[categoriaRaw] || 'outros'

  const valorMatch = text.match(/(\d+[.,]?\d*)/)
  if (!valorMatch) return null
  const valor = parseFloat(valorMatch[1].replace(',', '.'))
  if (isNaN(valor)) return null

  const descricao = parts.slice(2).join(' ')

  return { categoria, valor, descricao }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  // Twilio manda o texto da mensagem no campo "Body" (form-urlencoded)
  const body = (req.body?.Body || req.body?.text || '') as string

  const parsed = parseMessage(body)

  if (!parsed) {
    res.status(200).send(
      'Não entendi. Manda assim: "categoria valor descrição", ex: gasolina 150 posto shell'
    )
    return
  }

  await db.collection('despesas').add({
    categoria: parsed.categoria,
    valor: parsed.valor,
    descricao: parsed.descricao || '',
    origem: 'whatsapp',
    createdAt: Timestamp.now(),
  })

  res.status(200).send(
    `Despesa registrada: ${parsed.categoria} - R$ ${parsed.valor.toFixed(2)}`
  )
}
