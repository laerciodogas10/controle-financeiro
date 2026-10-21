import { useState, useRef, useEffect, useCallback } from 'react'
import { addExpense } from '../services/expenses'
import { getStoredCategories } from '../services/categories'
import type { ExpenseCategory } from '../types'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DespesaExtracted {
  valor: number
  categoria: string
  descricao: string
  data: string // YYYY-MM-DD
}

type Stage =
  | 'idle'       // aguardando começar
  | 'recording'  // gravando
  | 'processing' // enviando ao Gemini
  | 'confirm'    // tela de confirmação/edição
  | 'saving'     // salvando no Firestore
  | 'error'      // erro

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdded: () => void
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const MAX_SECONDS = 30

// Detecta o melhor mimeType disponível no navegador
function detectMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
  ]
  for (const mt of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mt)) {
      return mt
    }
  }
  return 'audio/mp4' // fallback para Safari/iPhone
}

// Data de hoje no fuso de Fortaleza
function getHojeLocal(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' })
}

// Converte "YYYY-MM-DD" → Date local para salvar no Firestore
function parseDateStr(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date()
  d.setFullYear(year, month - 1, day)
  d.setHours(12, 0, 0, 0) // meio-dia para evitar problemas de fuso
  return d
}

// Formata "YYYY-MM-DD" → "DD/MM/YYYY" para exibição
function formatDateBR(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function AudioExpenseModal({ isOpen, onClose, onAdded }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [seconds, setSeconds] = useState(0)
  const [despesas, setDespesas] = useState<DespesaExtracted[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [globalError, setGlobalError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Reseta ao fechar/abrir
  useEffect(() => {
    if (!isOpen) {
      stopEverything()
      setStage('idle')
      setSeconds(0)
      setDespesas([])
      setErrorMsg('')
      setGlobalError('')
    }
  }, [isOpen])

  // Auto-stop aos 30 s
  useEffect(() => {
    if (stage === 'recording') {
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stopRecording()
            return MAX_SECONDS
          }
          return s + 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [stage])

  function stopEverything() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  // ── Inicia gravação ──────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setGlobalError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = detectMimeType()
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        // Libera o microfone
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        processAudio(mimeType)
      }

      mr.start(200) // chunks a cada 200 ms
      setSeconds(0)
      setStage('recording')
    } catch (err: any) {
      setGlobalError('Não foi possível acessar o microfone. Verifique as permissões.')
      console.error('[AudioExpenseModal] getUserMedia:', err)
    }
  }, [])

  // ── Para gravação ────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setStage('processing')
  }, [])

  // ── Envia ao servidor ────────────────────────────────────────────────────
  async function processAudio(mimeType: string) {
    setStage('processing')
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const base64 = await blobToBase64(blob)

      const resp = await fetch('/api/despesa-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType }),
      })

      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || `Erro ${resp.status}`)
      }

      if (!data.despesas || data.despesas.length === 0) {
        throw new Error('Nenhuma despesa identificada no áudio.')
      }

      setDespesas(data.despesas)
      setStage('confirm')
    } catch (err: any) {
      console.error('[AudioExpenseModal] processAudio:', err)
      setGlobalError(err.message || 'Erro ao processar o áudio.')
      setStage('error')
    }
  }

  // ── Salva todas as despesas confirmadas ──────────────────────────────────
  const handleSaveAll = useCallback(async () => {
    setStage('saving')
    try {
      for (const d of despesas) {
        if (d.valor > 0) {
          await addExpense(
            d.categoria as ExpenseCategory,
            d.valor,
            d.descricao,
            'app',
            parseDateStr(d.data)
          )
        }
      }
      onAdded()
      onClose()
    } catch (err: any) {
      console.error('[AudioExpenseModal] handleSaveAll:', err)
      setGlobalError('Erro ao salvar. Tente novamente.')
      setStage('confirm')
    }
  }, [despesas, onAdded, onClose])

  // ── Atualiza um campo de uma despesa ─────────────────────────────────────
  const updateDespesa = (index: number, field: keyof DespesaExtracted, value: string | number) => {
    setDespesas((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    )
  }

  const removeDespesa = (index: number) => {
    setDespesas((prev) => prev.filter((_, i) => i !== index))
  }

  const categories = getStoredCategories()

  if (!isOpen) return null

  const progress = (seconds / MAX_SECONDS) * 100

  return (
    <div className="dark-modal-overlay" onClick={onClose}>
      <div
        className="dark-modal-container audio-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ gap: 0 }}
      >
        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <div className="dark-modal-topbar" style={{ marginBottom: 8 }}>
          <button className="dark-cancel-link" onClick={onClose}>
            Cancelar
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#f4f4f5' }}>
            🎙️ Despesa por Áudio
          </span>
          <div style={{ width: 60 }} /> {/* spacer */}
        </div>

        {/* ── IDLE ───────────────────────────────────────────────────────── */}
        {stage === 'idle' && (
          <div className="audio-stage-idle">
            <p className="audio-hint">
              Fale suas despesas em voz alta.{' '}
              <br />
              Ex.: <em>"Mercado oitenta e cinco reais e gasolina cinquenta"</em>
            </p>
            {globalError && <p className="audio-error-msg">{globalError}</p>}
            <button
              id="audio-start-btn"
              className="mic-button mic-idle"
              onClick={startRecording}
              aria-label="Iniciar gravação"
            >
              <span className="mic-icon">🎙️</span>
            </button>
            <p className="audio-sub">Toque para gravar</p>
          </div>
        )}

        {/* ── RECORDING ──────────────────────────────────────────────────── */}
        {stage === 'recording' && (
          <div className="audio-stage-idle">
            <p className="audio-hint recording-hint">
              Gravando… fale suas despesas
            </p>

            {/* Progress ring */}
            <div className="mic-progress-ring">
              <svg viewBox="0 0 120 120" className="ring-svg">
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke="rgba(239,68,68,0.15)"
                  strokeWidth="6"
                />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>

              <button
                id="audio-stop-btn"
                className="mic-button mic-recording"
                onClick={stopRecording}
                aria-label="Parar gravação"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
              >
                <span className="mic-icon">⏹</span>
              </button>
            </div>

            <p className="audio-timer">{seconds}s / {MAX_SECONDS}s</p>
            <p className="audio-sub">Toque para parar</p>
          </div>
        )}

        {/* ── PROCESSING ─────────────────────────────────────────────────── */}
        {stage === 'processing' && (
          <div className="audio-stage-idle">
            <div className="mic-button mic-processing" aria-label="Processando">
              <span className="mic-spinner" />
            </div>
            <p className="audio-hint" style={{ marginTop: 16 }}>
              Analisando com IA…
            </p>
          </div>
        )}

        {/* ── ERROR ──────────────────────────────────────────────────────── */}
        {stage === 'error' && (
          <div className="audio-stage-idle">
            <div className="mic-button mic-error" aria-label="Erro">
              <span className="mic-icon">⚠️</span>
            </div>
            <p className="audio-error-msg" style={{ marginTop: 16 }}>
              {globalError}
            </p>
            <button
              className="dark-btn-filled red"
              style={{ marginTop: 20, width: '100%' }}
              onClick={() => {
                setGlobalError('')
                setStage('idle')
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── CONFIRM ────────────────────────────────────────────────────── */}
        {(stage === 'confirm' || stage === 'saving') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <p style={{ fontSize: 13, color: '#a1a1aa', textAlign: 'center' }}>
              {despesas.length === 1
                ? 'Confirme os dados antes de salvar:'
                : `${despesas.length} despesas encontradas — confirme cada uma:`}
            </p>

            {globalError && <p className="audio-error-msg">{globalError}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '55vh', overflowY: 'auto', paddingRight: 2 }}>
              {despesas.map((d, i) => (
                <DespesaCard
                  key={i}
                  despesa={d}
                  index={i}
                  categories={categories}
                  total={despesas.length}
                  onChange={updateDespesa}
                  onRemove={removeDespesa}
                />
              ))}
            </div>

            <div className="dark-modal-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="dark-btn-outline"
                onClick={() => { setStage('idle'); setDespesas([]) }}
                disabled={stage === 'saving'}
              >
                ↩ Regravar
              </button>
              <button
                type="button"
                className="dark-btn-filled red"
                disabled={stage === 'saving' || despesas.every((d) => d.valor <= 0)}
                onClick={handleSaveAll}
              >
                {stage === 'saving' ? 'Salvando…' : `Salvar ${despesas.length > 1 ? 'todas' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-componente: cartão de despesa editável ───────────────────────────────
interface DespesaCardProps {
  despesa: DespesaExtracted
  index: number
  total: number
  categories: Array<{ id: string; label: string; emoji: string }>
  onChange: (i: number, f: keyof DespesaExtracted, v: string | number) => void
  onRemove: (i: number) => void
}

function DespesaCard({ despesa, index, total, categories, onChange, onRemove }: DespesaCardProps) {
  const catMeta = categories.find((c) => c.id === despesa.categoria) || {
    id: 'outros',
    label: 'Outros',
    emoji: '📦',
  }

  return (
    <div className="audio-expense-card">
      {/* Cabeçalho do cartão */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#a1a1aa' }}>
          {total > 1 ? `Despesa ${index + 1}` : 'Despesa'}
        </span>
        {total > 1 && (
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 14 }}
            onClick={() => onRemove(index)}
            title="Remover esta despesa"
          >
            🗑️
          </button>
        )}
      </div>

      {/* Valor */}
      <div className="dark-input-row" style={{ marginBottom: 8 }}>
        <span className="row-icon">💰</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <span style={{ color: '#71717a', fontWeight: 600 }}>R$</span>
          <input
            type="number"
            min="0"
            step="1"
            className="dark-text-input"
            value={despesa.valor || ''}
            onChange={(e) => onChange(index, 'valor', parseFloat(e.target.value) || 0)}
            style={{ fontWeight: 700, fontSize: 18 }}
          />
        </div>
      </div>

      {/* Descrição */}
      <div className="dark-input-row" style={{ marginBottom: 8 }}>
        <span className="row-icon">✏️</span>
        <input
          type="text"
          className="dark-text-input"
          placeholder="Descrição"
          value={despesa.descricao}
          onChange={(e) => onChange(index, 'descricao', e.target.value)}
        />
      </div>

      {/* Data */}
      <div className="dark-input-row" style={{ marginBottom: 10 }}>
        <span className="row-icon">📅</span>
        <input
          type="date"
          className="dark-text-input"
          value={despesa.data}
          max={getHojeLocal()}
          onChange={(e) => onChange(index, 'data', e.target.value)}
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {/* Categorias */}
      <div className="dark-input-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="row-icon">🏷️</span>
          <span style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 600 }}>Categoria</span>
        </div>
        <div className="dark-category-pills" style={{ width: '100%' }}>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`dark-cat-pill ${despesa.categoria === c.id ? 'active' : ''}`}
              onClick={() => onChange(index, 'categoria', c.id)}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Helper: Blob → base64 ────────────────────────────────────────────────────
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove o prefixo "data:...;base64,"
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
