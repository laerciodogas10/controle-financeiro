import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'

export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, senha)
    } catch {
      setErro('Email ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 320, margin: '80px auto', padding: 16 }}>
      <h2>Entrar</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        Use a mesma conta que você já usa no Didi Gás.
      </p>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: 12, marginBottom: 8 }}
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          style={{ width: '100%', padding: 12, marginBottom: 8 }}
        />
        {erro && <p style={{ color: 'red', fontSize: 13 }}>{erro}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 12, background: '#0f766e', color: 'white', border: 'none', borderRadius: 8 }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}