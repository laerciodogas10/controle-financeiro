import type { VercelRequest, VercelResponse } from '@vercel/node'
import { timingSafeEqual } from 'node:crypto'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// ──────────────────────────────────────────────────────────────────────────────
// Servidor MCP (Model Context Protocol) para o Claude registrar e consultar
// despesas. Transporte "Streamable HTTP" sem estado: cada POST é um JSON-RPC.
//
// URL para colocar no Claude (Configurações > Conectores > Adicionar conector):
//   https://SEU-APP.vercel.app/api/mcp?token=SEU_MCP_TOKEN
// ──────────────────────────────────────────────────────────────────────────────

const MCP_TOKEN = process.env.MCP_TOKEN || ''
const EXPENSES_COLLECTION = 'despesas'
const CATEGORIAS_PADRAO = ['mercado', 'energia', 'agua', 'gasolina', 'outros']
const PROTOCOLOS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

// ── Datas (Fortaleza = UTC-3 o ano todo, sem horário de verão) ───────────────
const OFFSET_MS = 3 * 60 * 60 * 1000

function hojeISO(): string {
  return new Date(Date.now() - OFFSET_MS).toISOString().slice(0, 10)
}

function isoValido(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Início do dia (00:00 em Fortaleza) em ms UTC */
function inicioDoDia(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime() + OFFSET_MS
}

function paraISO(ms: number): string {
  return new Date(ms - OFFSET_MS).toISOString().slice(0, 10)
}

function msDoDoc(createdAt: any): number {
  if (createdAt?.toMillis) return createdAt.toMillis()
  if (createdAt?.seconds) return createdAt.seconds * 1000
  if (createdAt) return new Date(createdAt).getTime() || 0
  return 0
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── Ferramentas ──────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'registrar_despesa',
    title: 'Registrar despesa',
    description:
      'Registra uma despesa no app de finanças. Use uma chamada por despesa. ' +
      `Categorias usuais: ${CATEGORIAS_PADRAO.join(', ')} (use "outros" se não encaixar). ` +
      'Se o usuário não disser a data, omita "data" para usar hoje.',
    inputSchema: {
      type: 'object',
      properties: {
        valor: { type: 'number', description: 'Valor em reais, ex: 150.5' },
        categoria: { type: 'string', description: 'Categoria em minúsculas, ex: gasolina' },
        descricao: { type: 'string', description: 'Descrição curta, ex: posto shell' },
        data: { type: 'string', description: 'Data no formato YYYY-MM-DD (opcional, padrão hoje)' },
      },
      required: ['valor', 'categoria'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  {
    name: 'listar_despesas',
    title: 'Listar despesas',
    description:
      'Lista despesas num período (padrão: mês atual), da mais recente para a mais antiga. ' +
      'Retorna o id de cada uma (usado em excluir_despesa).',
    inputSchema: {
      type: 'object',
      properties: {
        inicio: { type: 'string', description: 'Data inicial YYYY-MM-DD (inclusiva)' },
        fim: { type: 'string', description: 'Data final YYYY-MM-DD (inclusiva)' },
        categoria: { type: 'string', description: 'Filtrar por categoria (opcional)' },
        limite: { type: 'number', description: 'Máximo de itens (padrão 50, máx 200)' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'resumo_despesas',
    title: 'Resumo de despesas do mês',
    description: 'Total gasto no mês e total por categoria.',
    inputSchema: {
      type: 'object',
      properties: {
        mes: { type: 'string', description: 'Mês no formato YYYY-MM (padrão: mês atual)' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'excluir_despesa',
    title: 'Excluir despesa',
    description:
      'Exclui uma despesa pelo id (obtido em listar_despesas). Confirme com o usuário antes de usar.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'id da despesa' } },
      required: ['id'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
]

class ErroDeEntrada extends Error {}

async function carregarPeriodo(inicioMs: number, fimMs: number) {
  const snap = await db.collection(EXPENSES_COLLECTION).get()
  return snap.docs
    .map((d) => {
      const x = d.data()
      return {
        id: d.id,
        data: paraISO(msDoDoc(x.createdAt)),
        ms: msDoDoc(x.createdAt),
        categoria: String(x.categoria ?? ''),
        valor: Number(x.valor) || 0,
        descricao: String(x.descricao ?? ''),
        origem: String(x.origem ?? ''),
      }
    })
    .filter((d) => d.ms >= inicioMs && d.ms < fimMs)
    .sort((a, b) => b.ms - a.ms)
}

function intervaloDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const prox = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
  return { inicio: inicioDoDia(`${mes}-01`), fim: inicioDoDia(prox) }
}

async function chamarFerramenta(nome: string, args: any): Promise<string> {
  args = args || {}
  switch (nome) {
    case 'registrar_despesa': {
      const valor = Number(args.valor)
      if (!isFinite(valor) || valor <= 0) throw new ErroDeEntrada('"valor" deve ser um número maior que zero.')
      if (valor > 1_000_000) throw new ErroDeEntrada('"valor" grande demais; confira com o usuário.')
      const categoria = String(args.categoria || '').trim().toLowerCase() || 'outros'
      const descricao = String(args.descricao || '').trim().slice(0, 200)
      let createdAt = Timestamp.now()
      let data = hojeISO()
      if (args.data !== undefined && args.data !== '') {
        if (!isoValido(args.data)) throw new ErroDeEntrada('"data" deve estar no formato YYYY-MM-DD.')
        data = args.data
        // meio-dia em Fortaleza, para não "pular" de dia por fuso
        if (data !== hojeISO()) createdAt = Timestamp.fromMillis(inicioDoDia(data) + 12 * 3600_000)
      }
      const ref = await db.collection(EXPENSES_COLLECTION).add({
        categoria,
        valor: Math.round(valor * 100) / 100,
        descricao,
        origem: 'claude',
        createdAt,
      })
      return `Despesa registrada (id ${ref.id}): ${categoria} · ${brl(valor)}` +
        `${descricao ? ` · ${descricao}` : ''} · ${data.split('-').reverse().join('/')}`
    }

    case 'listar_despesas': {
      const hoje = hojeISO()
      const inicio = args.inicio ? args.inicio : `${hoje.slice(0, 7)}-01`
      const fim = args.fim ? args.fim : hoje
      if (!isoValido(inicio) || !isoValido(fim)) throw new ErroDeEntrada('Datas devem estar no formato YYYY-MM-DD.')
      const limite = Math.min(Math.max(Number(args.limite) || 50, 1), 200)
      let itens = await carregarPeriodo(inicioDoDia(inicio), inicioDoDia(fim) + 86400_000)
      if (args.categoria) itens = itens.filter((d) => d.categoria === String(args.categoria).toLowerCase())
      const total = itens.reduce((s, d) => s + d.valor, 0)
      return JSON.stringify({
        periodo: { inicio, fim },
        quantidade: itens.length,
        total: Math.round(total * 100) / 100,
        despesas: itens.slice(0, limite).map(({ ms, ...d }) => d),
      })
    }

    case 'resumo_despesas': {
      const mes = args.mes || hojeISO().slice(0, 7)
      if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new ErroDeEntrada('"mes" deve estar no formato YYYY-MM.')
      const { inicio, fim } = intervaloDoMes(mes)
      const itens = await carregarPeriodo(inicio, fim)
      const porCategoria: Record<string, number> = {}
      for (const d of itens) porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + d.valor
      const total = itens.reduce((s, d) => s + d.valor, 0)
      return JSON.stringify({
        mes,
        quantidade: itens.length,
        total: Math.round(total * 100) / 100,
        porCategoria: Object.fromEntries(
          Object.entries(porCategoria)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
      })
    }

    case 'excluir_despesa': {
      const id = String(args.id || '').trim()
      if (!id || id.includes('/')) throw new ErroDeEntrada('"id" inválido.')
      const ref = db.collection(EXPENSES_COLLECTION).doc(id)
      const doc = await ref.get()
      if (!doc.exists) throw new ErroDeEntrada(`Despesa ${id} não encontrada.`)
      const x = doc.data()!
      await ref.delete()
      return `Despesa excluída: ${x.categoria} · ${brl(Number(x.valor) || 0)}${x.descricao ? ` · ${x.descricao}` : ''}`
    }

    default:
      throw new ErroDeEntrada(`Ferramenta desconhecida: ${nome}`)
  }
}

// ── JSON-RPC ─────────────────────────────────────────────────────────────────
async function processar(msg: any): Promise<any | null> {
  const { id, method, params } = msg || {}
  const isNotification = id === undefined || id === null
  const ok = (result: any) => ({ jsonrpc: '2.0', id, result })
  const erro = (code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

  if (msg?.jsonrpc !== '2.0' || typeof method !== 'string') {
    return isNotification ? null : erro(-32600, 'Requisição inválida')
  }
  if (isNotification) return null

  switch (method) {
    case 'initialize': {
      const pedida = params?.protocolVersion
      return ok({
        protocolVersion: PROTOCOLOS.includes(pedida) ? pedida : PROTOCOLOS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'financas-despesas', title: 'Finanças – Despesas', version: '1.0.0' },
        instructions:
          'Ferramentas do app de finanças pessoal. Valores em reais (BRL), datas no fuso America/Fortaleza. ' +
          'Ao registrar, confirme ao usuário o que foi salvo.',
      })
    }
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({ tools: TOOLS })
    case 'tools/call': {
      try {
        const texto = await chamarFerramenta(params?.name, params?.arguments)
        return ok({ content: [{ type: 'text', text: texto }] })
      } catch (e: any) {
        if (!(e instanceof ErroDeEntrada)) console.error('[mcp] erro na ferramenta', params?.name, e)
        const texto = e instanceof ErroDeEntrada ? e.message : 'Erro interno ao acessar o banco de dados.'
        return ok({ content: [{ type: 'text', text: texto }], isError: true })
      }
    }
    default:
      return erro(-32601, `Método não suportado: ${method}`)
  }
}

function tokenValido(req: VercelRequest): boolean {
  if (MCP_TOKEN.length < 16) return false
  const auth = String(req.headers.authorization || '')
  const recebido = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.query.token || '')
  const a = Buffer.from(recebido)
  const b = Buffer.from(MCP_TOKEN)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!MCP_TOKEN || MCP_TOKEN.length < 16) {
    console.error('[mcp] MCP_TOKEN não configurado (mínimo 16 caracteres).')
    return res.status(500).json({ error: 'Servidor não configurado.' })
  }
  if (!tokenValido(req)) return res.status(401).json({ error: 'Não autorizado.' })

  if (req.method === 'DELETE') return res.status(204).end()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch {
      return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } })
    }
  }

  const lote = Array.isArray(body)
  const respostas = (await Promise.all((lote ? body : [body]).map(processar))).filter(Boolean)

  if (respostas.length === 0) return res.status(202).end()
  return res.status(200).json(lote ? respostas : respostas[0])
}
