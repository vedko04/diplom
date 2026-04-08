import { useState, useEffect } from 'react'
import '../../src/styles/global.css'


const VALID_LOGIN    = 'admin'
const VALID_PASSWORD = 'admin'

export default function LoginPage({ onLogin }) {
  const [login, setLogin]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [shaking, setShaking]   = useState(false)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => {
    setTimeout(() => setMounted(true), 50)
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (login === VALID_LOGIN && password === VALID_PASSWORD) {
      onLogin()
    } else {
      setError('Неверные учётные данные')
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      setTimeout(() => setError(''), 3000)
    }
  }

  return (
    <div style={styles.root}>
      {/* Фоновая сетка */}
      <div style={styles.grid} />
      {/* Сканирующая линия */}
      <div style={styles.scanLine} />

      <div style={{
        ...styles.card,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        animation: shaking ? 'shake 0.4s ease' : 'none',
        transition: 'opacity 0.5s ease, transform 0.5s ease'
      }}>
        {/* Лого */}
        <div style={styles.logo}>
          <EyeIcon />
          <span style={styles.logoText}>EYE<span style={styles.logoAccent}>RESEARCH</span></span>
        </div>

        <div style={styles.tagline}>UX Eye Tracking Platform v1.0</div>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>АВТОРИЗАЦИЯ</span>
          <span style={styles.dividerLine} />
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <Field
            label="ЛОГИН"
            value={login}
            onChange={e => setLogin(e.target.value)}
            placeholder="введите логин"
            autoFocus
          />
          <Field
            label="ПАРОЛЬ"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
          />

          {error && (
            <div style={styles.error}>
              <span style={styles.errorDot} />
              {error}
            </div>
          )}

          <button type="submit" style={styles.btn}>
            ВОЙТИ В СИСТЕМУ →
          </button>
        </form>

        <div style={styles.hint}>
          Демо-доступ: <span style={styles.hintCode}>admin / admin</span>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
        @keyframes scan {
          0%   { top: -2px; }
          100% { top: 100%; }
        }
        .login-field:focus {
          border-color: var(--mint) !important;
          box-shadow: 0 0 0 1px var(--mint), 0 0 16px var(--mint-glow) !important;
          outline: none !important;
        }
        .login-btn:hover {
          background: var(--mint) !important;
          color: var(--bg-void) !important;
          box-shadow: 0 0 24px var(--mint-glow) !important;
        }
      `}</style>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', autoFocus }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={styles.label}>{label}</label>
      <input
        className="login-field"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={styles.input}
      />
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="16" rx="14" ry="9" stroke="#3dffa0" strokeWidth="1.5"/>
      <circle cx="16" cy="16" r="5" stroke="#3dffa0" strokeWidth="1.5"/>
      <circle cx="16" cy="16" r="2" fill="#3dffa0"/>
      <circle cx="17.5" cy="14.5" r="0.8" fill="white" opacity="0.8"/>
    </svg>
  )
}

const styles = {
  root: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-void)',
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
    opacity: 0.4,
  },
  scanLine: {
    position: 'absolute',
    left: 0, right: 0, height: '2px',
    background: 'linear-gradient(90deg, transparent, var(--mint-dim), transparent)',
    opacity: 0.3,
    animation: 'scan 6s linear infinite',
  },
  card: {
    position: 'relative',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-lit)',
    borderRadius: 'var(--radius-lg)',
    padding: '48px',
    width: '420px',
    boxShadow: '0 0 60px rgba(0,0,0,0.6), 0 0 120px rgba(61,255,160,0.04)',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 12,
    marginBottom: 8,
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: 22, fontWeight: 800,
    color: 'var(--text-prime)',
    letterSpacing: '0.08em',
  },
  logoAccent: {
    color: 'var(--mint)',
  },
  tagline: {
    color: 'var(--text-dim)',
    fontSize: 11,
    letterSpacing: '0.12em',
    marginBottom: 32,
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12,
    marginBottom: 28,
  },
  dividerLine: {
    flex: 1, height: '1px',
    background: 'var(--border)',
    display: 'block',
  },
  dividerText: {
    fontSize: 10, letterSpacing: '0.2em',
    color: 'var(--text-dim)',
  },
  form: { display: 'flex', flexDirection: 'column' },
  label: {
    display: 'block',
    fontSize: 10, letterSpacing: '0.18em',
    color: 'var(--text-dim)',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    background: 'var(--bg-deep)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-prime)',
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    padding: '12px 16px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  error: {
    display: 'flex', alignItems: 'center', gap: 8,
    color: 'var(--red)',
    fontSize: 12,
    marginBottom: 16,
    padding: '10px 14px',
    background: 'rgba(255,69,103,0.08)',
    borderRadius: 'var(--radius)',
    border: '1px solid rgba(255,69,103,0.2)',
  },
  errorDot: {
    width: 6, height: 6,
    borderRadius: '50%',
    background: 'var(--red)',
    flexShrink: 0,
    display: 'block',
  },
  btn: {
    marginTop: 8,
    padding: '14px',
    background: 'transparent',
    border: '1px solid var(--mint)',
    borderRadius: 'var(--radius)',
    color: 'var(--mint)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13, fontWeight: 500,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  hint: {
    marginTop: 28,
    textAlign: 'center',
    color: 'var(--text-ghost)',
    fontSize: 11,
  },
  hintCode: {
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
  },
}
