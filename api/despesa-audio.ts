import type { VercelRequest, VercelResponse } from '@vercel/node'

// ──────────────────────────────────────────────────────────────────────────────
// Configuração
// ──────────────────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'

// Limite: 4 MB em base64 (≈ 3 MB de áudio bruto — mais que suficiente para 30 s)
const MAX_BASE64_BYTES = 4 * 1024 * 1024

// Categorias de despesas conhecidas pelo app (espelha categories.ts)
const CATEGORIAS_CONHECIDAS = [
  'mercado',
  'energia',
  'agua',
  'gasolina',
  'outros',
]

// ──────────────────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' })
  }

  // Verifica chave Gemini
  if (!GEMINI_API_KEY) {
    console.error('[despesa-audio] GEMINI_API_KEY não configurada.')
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' })
  }

  // ── Lê e valida o corpo ────────────────────────────────────────────────────
  const { audioBase64, mimeType } = req.body as {
    audioBase64?: string
    mimeType?: string
  }

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'Campo "audioBase64" ausente ou inválido.' })
  }

  if (!mimeType || typeof mimeType !== 'string') {
    return res.status(400).json({ error: 'Campo "mimeType" ausente ou inválido.' })
  }

  // Valida tipos permitidos (webm = Chrome, mp4/aac = Safari/iPhone)
  const allowedMimeTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/aac', 'audio/ogg']
  const mimeBase = mimeType.split(';')[0].trim()
  if (!allowedMimeTypes.some((m) => m.startsWith(mimeBase))) {
    return res.status(400).json({ error: `Formato de áudio não suportado: ${mimeType}` })
  }

  // Valida tamanho
  if (Buffer.byteLength(audioBase64, 'base64') > MAX_BASE64_BYTES) {
    return res.status(413).json({
      error: 'Áudio muito grande. Grave no máximo 30 segundos.',
    })
  }

  // ── Monta o prompt ─────────────────────────────────────────────────────────
  // Data/hora atual no fuso de Fortaleza
  const hoje = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const hojeISO = getHojeISO()
  const ontemISO = getOntemISO()

  const prompt = `Você é um assistente de controle financeiro pessoal.
O usuário gravou um áudio descrevendo uma ou mais despesas em português (Brasil).

Hoje é ${hoje} (${hojeISO} em formato YYYY-MM-DD, fuso America/Fortaleza).
Ontem foi ${ontemISO}.

Categorias válidas: ${CATEGORIAS_CONHECIDAS.join(', ')}.
Se a despesa não se encaixar em nenhuma categoria acima, use "outros".

Instruções:
- Extraia TODAS as despesas mencionadas no áudio.
- Para cada despesa, identifique: valor (número, em reais), categoria (string da lista acima), descrição (breve), data (YYYY-MM-DD).
- Se o usuário não mencionar a data, use hoje (${hojeISO}).
- Se disser "ontem", use ${ontemISO}.
- Se disser "dia X" ou "dia XX", calcule a data correta baseada no mês atual.
- Valores: interprete "oitenta e cinco" como 85, "cinquenta reais" como 50, "R$ 120" como 120, etc.
- Retorne SOMENTE o JSON pedido, sem texto adicional.`

  // ── Chama a API do Gemini ──────────────────────────────────────────────────
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: audioBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          despesas: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                valor: { type: 'NUMBER' },
                categoria: { type: 'STRING' },
                descricao: { type: 'STRING' },
                data: { type: 'STRING' },
              },
              required: ['valor', 'categoria', 'descricao', 'data'],
            },
          },
        },
        required: ['despesas'],
      },
      temperature: 0.1,
    },
  }

  let geminiResponse: Response
  try {
    geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  } catch (err) {
    console.error('[despesa-audio] Erro de rede ao chamar Gemini:', err)
    return res.status(502).json({ error: 'Não foi possível conectar à API do Gemini.' })
  }

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text()
    console.error('[despesa-audio] Gemini retornou erro:', geminiResponse.status, errorText)
    return res.status(502).json({
      error: `Gemini retornou status ${geminiResponse.status}. Verifique a chave API e o modelo.`,
    })
  }

  // ── Processa a resposta ────────────────────────────────────────────────────
  let geminiData: any
  try {
    geminiData = await geminiResponse.json()
  } catch {
    return res.status(502).json({ error: 'Resposta inválida do Gemini (não é JSON).' })
  }

  const rawText: string | undefined =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!rawText) {
    console.error('[despesa-audio] Gemini não retornou texto:', JSON.stringify(geminiData))
    return res.status(422).json({ error: 'Gemini não conseguiu processar o áudio.' })
  }

  let parsed: { despesas: Array<{ valor: number; categoria: string; descricao: string; data: string }> }
  try {
    parsed = JSON.parse(rawText)
  } catch {
    console.error('[despesa-audio] JSON inválido do Gemini:', rawText)
    return res.status(422).json({ error: 'Resposta do Gemini não é um JSON válido.' })
  }

  if (!parsed.despesas || !Array.isArray(parsed.despesas) || parsed.despesas.length === 0) {
    return res.status(422).json({ error: 'Nenhuma despesa identificada no áudio.' })
  }

  // Normaliza e valida cada despesa
  const despesas = parsed.despesas.map((d) => ({
    valor: Number(d.valor) || 0,
    categoria: CATEGORIAS_CONHECIDAS.includes(String(d.categoria).toLowerCase())
      ? String(d.categoria).toLowerCase()
      : 'outros',
    descricao: String(d.descricao || '').trim(),
    data: isValidDate(d.data) ? d.data : hojeISO,
  }))

  return res.status(200).json({ despesas })
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers de data (Fortaleza, UTC-3)
// ──────────────────────────────────────────────────────────────────────────────
function getHojeISO(): string {
  return toFortalezaDateString(new Date())
}

function getOntemISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toFortalezaDateString(d)
}

function toFortalezaDateString(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
}

function isValidDate(dateStr: any): boolean {
  if (typeof dateStr !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
}
