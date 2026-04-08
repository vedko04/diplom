import { useState, useEffect, useRef, useCallback } from 'react'
import '../../src/styles/global.css'

// 9 точек калибровки — 3×3 сетка (в % от экрана)
const CALIBRATION_POINTS = [
  { id: 0, xPct: 10, yPct: 10 },
  { id: 1, xPct: 50, yPct: 10 },
  { id: 2, xPct: 90, yPct: 10 },
  { id: 3, xPct: 10, yPct: 50 },
  { id: 4, xPct: 50, yPct: 50 },
  { id: 5, xPct: 90, yPct: 50 },
  { id: 6, xPct: 10, yPct: 90 },
  { id: 7, xPct: 50, yPct: 90 },
  { id: 8, xPct: 90, yPct: 90 },
]

const CLICKS_REQUIRED = 3  // увеличено до 3 для лучшей калибровки

export default function CalibrationPage({ onComplete }) {
  const [phase, setPhase]         = useState('intro')   // intro | calibrating | done
  const [clicks, setClicks]       = useState({})        // { pointId: count }
  const [activePoint, setActive]  = useState(0)
  const [camOk, setCamOk]         = useState(false)
  const [camError, setCamError]   = useState('')
  const [wgReady, setWgReady]     = useState(false)

  // ── Инициализация WebGazer ─────────────────────────────────────
  const initWebGazer = useCallback(async () => {
    if (!window.webgazer) {
      setCamError('WebGazer не загружен')
      return
    }

    try {
      // Ждём готовности DOM
      await new Promise(res => setTimeout(res, 300))

      await window.webgazer
          .setRegression('ridge')
          .setTracker('TFFacemesh')
          .setGazeListener(() => {})
          .begin()

      // Настройки для улучшения производительности
      window.webgazer.showVideoPreview(true)
      window.webgazer.showPredictionPoints(false)

      // Применяем фильтр Калмана для сглаживания
      window.webgazer.applyKalmanFilter(true)

      setCamOk(true)
      setWgReady(true)
    } catch (err) {
      console.error(err)
      setCamError(`Ошибка: ${err.message}`)
    }
  }, [])

  // ── Клик по точке калибровки ───────────────────────────────────
  const handlePointClick = useCallback((point, e) => {
    if (phase !== 'calibrating') return

    const x = (point.xPct / 100) * window.innerWidth
    const y = (point.yPct / 100) * window.innerHeight

    // Сообщаем WebGazer: пользователь смотрел сюда
    if (window.webgazer) {
      // Записываем несколько раз для лучшей калибровки
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          window.webgazer.recordScreenPosition(x, y, 'click')
        }, i * 50)
      }
    }

    setClicks(prev => {
      const next = { ...prev, [point.id]: (prev[point.id] || 0) + 1 }

      // Если точка набрала нужное кол-во кликов → переходим к следующей
      if (next[point.id] >= CLICKS_REQUIRED) {
        const nextActive = activePoint + 1
        if (nextActive >= CALIBRATION_POINTS.length) {
          // Все точки откалиброваны
          setTimeout(() => setPhase('done'), 400)
        } else {
          setActive(nextActive)
        }
      }
      return next
    })
  }, [phase, activePoint])

  // Считаем общий прогресс
  const totalClicks = Object.values(clicks).reduce((a, b) => a + b, 0)
  const totalRequired = CALIBRATION_POINTS.length * CLICKS_REQUIRED
  const progress = Math.min(100, (totalClicks / totalRequired) * 100)

  return (
      <div style={styles.root}>
        {/* ── ВСТУПИТЕЛЬНЫЙ ЭКРАН ── */}
        {phase === 'intro' && (
            <div style={styles.introCard}>
              <div style={styles.eyeAnim}>
                <AnimatedEye />
              </div>
              <h1 style={styles.title}>Калибровка трекера взгляда</h1>
              <p style={styles.desc}>
                Для точного отслеживания взгляда необходимо настроить систему.
                Убедитесь, что камера направлена на лицо и вы находитесь
                на расстоянии 50–70 см от экрана.
              </p>
              <ul style={styles.checklist}>
                <CheckItem>Хорошее освещение лица</CheckItem>
                <CheckItem>Камера на уровне глаз</CheckItem>
                <CheckItem>Голова прямо, без очков (по возможности)</CheckItem>
                <CheckItem>9 точек × {CLICKS_REQUIRED} кликов = ~60 секунд</CheckItem>
              </ul>

              {camError && <div style={styles.errBox}>{camError}</div>}

              {!camOk ? (
                  <button style={styles.btnPrimary} onClick={initWebGazer}>
                    ВКЛЮЧИТЬ КАМЕРУ →
                  </button>
              ) : (
                  <button style={styles.btnPrimary} onClick={() => setPhase('calibrating')}>
                    НАЧАТЬ КАЛИБРОВКУ →
                  </button>
              )}

              {camOk && (
                  <div style={styles.camOk}>
                    <span style={styles.dot} /> Камера подключена
                  </div>
              )}
            </div>
        )}

        {/* ── КАЛИБРОВКА ── */}
        {phase === 'calibrating' && (
            <>
              {/* Инструкция сверху */}
              <div style={styles.topBar}>
            <span style={styles.topBarText}>
              Кликайте по светящейся точке {CLICKS_REQUIRED} раза, глядя на неё
            </span>
                <div style={styles.progressWrap}>
                  <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                </div>
                <span style={styles.topBarProgress}>{Math.round(progress)}%</span>
              </div>

              {/* Точки */}
              {CALIBRATION_POINTS.map((pt) => {
                const ptClicks  = clicks[pt.id] || 0
                const isDone    = ptClicks >= CLICKS_REQUIRED
                const isActive  = pt.id === activePoint
                const fillPct   = Math.min(1, ptClicks / CLICKS_REQUIRED)

                return (
                    <CalibPoint
                        key={pt.id}
                        point={pt}
                        isActive={isActive}
                        isDone={isDone}
                        fillPct={fillPct}
                        onClick={(e) => isActive && handlePointClick(pt, e)}
                    />
                )
              })}

              {/* Счётчик текущей точки */}
              <div style={styles.pointCounter}>
                Точка {activePoint + 1} / {CALIBRATION_POINTS.length} —
                кликов: {clicks[activePoint] || 0} / {CLICKS_REQUIRED}
              </div>
            </>
        )}

        {/* ── ГОТОВО ── */}
        {phase === 'done' && (
            <div style={styles.doneCard}>
              <div style={styles.doneIcon}>✓</div>
              <h2 style={styles.doneTitle}>Калибровка завершена</h2>
              <p style={styles.doneDesc}>
                Система настроена и готова к сеансу исследования.
                WebGazer сохранил модель в памяти браузера — не перезагружайте страницу.
              </p>
              <button style={styles.btnPrimary} onClick={onComplete}>
                ПЕРЕЙТИ К ИССЛЕДОВАНИЮ →
              </button>
            </div>
        )}

        <style>{`
        .calib-btn-primary:hover {
          background: var(--mint) !important;
          color: var(--bg-void) !important;
        }
      `}</style>
      </div>
  )
}

// ── Компонент точки калибровки ─────────────────────────────────────────────
function CalibPoint({ point, isActive, isDone, fillPct, onClick }) {
  const size = 36

  const baseStyle = {
    position: 'absolute',
    left:   `${point.xPct}%`,
    top:    `${point.yPct}%`,
    transform: 'translate(-50%, -50%)',
    width:  size, height: size,
    borderRadius: '50%',
    cursor: isActive ? 'crosshair' : 'default',
    transition: 'transform 0.15s, box-shadow 0.15s',
    zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  if (isDone) {
    return (
        <div style={{ ...baseStyle, background: 'var(--mint)', boxShadow: '0 0 12px var(--mint)' }}>
          <span style={{ color: '#000', fontSize: 16, fontWeight: 700 }}>✓</span>
        </div>
    )
  }

  if (isActive) {
    return (
        <div style={baseStyle} onClick={onClick}>
          {/* Пульсирующее кольцо */}
          <div style={{
            position: 'absolute',
            width: size, height: size,
            borderRadius: '50%',
            border: '2px solid var(--mint)',
            animation: 'pulse-ring 1.2s ease-out infinite',
          }} />
          {/* Заполняющийся круг по прогрессу */}
          <svg width={size} height={size} style={{ position: 'absolute' }}>
            <circle
                cx={size/2} cy={size/2} r={size/2 - 2}
                fill={`rgba(61,255,160,${fillPct * 0.3})`}
                stroke="var(--mint)"
                strokeWidth="2"
            />
            {/* Дуга прогресса */}
            <circle
                cx={size/2} cy={size/2} r={size/2 - 6}
                fill="none"
                stroke="var(--mint)"
                strokeWidth="3"
                strokeDasharray={`${fillPct * 2 * Math.PI * (size/2 - 6)} 999`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`}
            />
          </svg>
          {/* Центральная точка */}
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mint)', zIndex: 1 }} />
        </div>
    )
  }

  // Неактивная точка
  return (
      <div style={{ ...baseStyle, opacity: 0.25 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--text-dim)' }} />
      </div>
  )
}

function AnimatedEye() {
  return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <ellipse cx="40" cy="40" rx="35" ry="22" stroke="#3dffa0" strokeWidth="2" opacity="0.4"/>
        <ellipse cx="40" cy="40" rx="35" ry="22" stroke="#3dffa0" strokeWidth="1.5"
                 strokeDasharray="4 6" style={{ animation: 'spin 12s linear infinite', transformOrigin: '40px 40px' }}/>
        <circle cx="40" cy="40" r="14" stroke="#3dffa0" strokeWidth="1.5"/>
        <circle cx="40" cy="40" r="7" fill="#3dffa0" opacity="0.8"/>
        <circle cx="44" cy="36" r="2.5" fill="white" opacity="0.9"/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </svg>
  )
}

function CheckItem({ children }) {
  return (
      <li style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: 'var(--text-dim)', fontSize: 13 }}>
        <span style={{ color: 'var(--mint)', fontSize: 16 }}>›</span>
        {children}
      </li>
  )
}

const styles = {
  root: {
    width: '100%', height: '100%',
    background: 'var(--bg-void)',
    position: 'relative',
    overflow: 'hidden',
    backgroundImage: `
      radial-gradient(ellipse at 50% 50%, rgba(61,255,160,0.03) 0%, transparent 70%),
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px)
    `,
    backgroundSize: 'auto, 60px 60px, 60px 60px',
  },
  introCard: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-lit)',
    borderRadius: 'var(--radius-lg)',
    padding: 48,
    width: 480,
    animation: 'fade-in 0.4s ease',
  },
  eyeAnim: { textAlign: 'center', marginBottom: 24 },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 22, fontWeight: 700,
    color: 'var(--text-prime)',
    marginBottom: 16,
    textAlign: 'center',
  },
  desc: {
    color: 'var(--text-dim)',
    fontSize: 13, lineHeight: 1.7,
    marginBottom: 24,
    textAlign: 'center',
  },
  checklist: {
    listStyle: 'none',
    marginBottom: 28,
    background: 'var(--bg-deep)',
    borderRadius: 'var(--radius)',
    padding: '16px 20px',
    border: '1px solid var(--border)',
  },
  errBox: {
    marginBottom: 16,
    padding: '12px 16px',
    background: 'rgba(255,69,103,0.1)',
    border: '1px solid rgba(255,69,103,0.3)',
    borderRadius: 'var(--radius)',
    color: 'var(--red)',
    fontSize: 12,
  },
  btnPrimary: {
    width: '100%',
    padding: '14px',
    background: 'transparent',
    border: '1px solid var(--mint)',
    borderRadius: 'var(--radius)',
    color: 'var(--mint)',
    fontFamily: 'var(--font-mono)',
    fontSize: 13, fontWeight: 500,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  camOk: {
    marginTop: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, color: 'var(--mint)', fontSize: 12,
  },
  dot: {
    display: 'inline-block',
    width: 7, height: 7, borderRadius: '50%',
    background: 'var(--mint)',
    boxShadow: '0 0 6px var(--mint)',
  },
  topBar: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border)',
    padding: '10px 24px',
    display: 'flex', alignItems: 'center', gap: 16,
    zIndex: 100,
  },
  topBarText: {
    color: 'var(--text-dim)', fontSize: 12,
    letterSpacing: '0.06em', flexShrink: 0,
  },
  progressWrap: {
    flex: 1, height: 3, background: 'var(--bg-deep)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--mint-dim), var(--mint))',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  topBarProgress: {
    color: 'var(--mint)', fontSize: 11,
    fontWeight: 500, flexShrink: 0,
  },
  pointCounter: {
    position: 'fixed',
    bottom: 16, left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '8px 20px',
    fontSize: 11,
    color: 'var(--text-dim)',
    letterSpacing: '0.06em',
    zIndex: 100,
  },
  doneCard: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'var(--bg-panel)',
    border: '1px solid var(--mint-dim)',
    boxShadow: '0 0 40px var(--mint-glow)',
    borderRadius: 'var(--radius-lg)',
    padding: 48, width: 440,
    textAlign: 'center',
    animation: 'fade-in 0.4s ease',
  },
  doneIcon: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'var(--mint)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 700, color: '#000',
    margin: '0 auto 24px',
    boxShadow: '0 0 30px var(--mint-glow)',
  },
  doneTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 22, fontWeight: 700,
    color: 'var(--text-prime)',
    marginBottom: 12,
  },
  doneDesc: {
    color: 'var(--text-dim)',
    fontSize: 13, lineHeight: 1.7,
    marginBottom: 28,
  },
}