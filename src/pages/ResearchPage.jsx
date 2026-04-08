import { useState, useEffect, useRef, useCallback } from 'react'
import MockWebsite from '../components/MockWebsite.jsx'
import GazeHeatmap from '../components/GazeHeatmap.jsx'
import '../../src/styles/global.css'


// Интервал записи точки взгляда (мс)
const SAMPLE_INTERVAL_MS = 100 // увеличено для стабильности

export default function ResearchPage() {
  const [phase, setPhase]         = useState('ready')    // ready | recording | done
  const [gazePoints, setGazePoints] = useState([])
  const [elapsed, setElapsed]     = useState(0)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [stats, setStats]         = useState(null)

  const gazeRef    = useRef([])       // мутабельный буфер — не вызывает ре-рендер каждые 50мс
  const timerRef   = useRef(null)
  const sampleRef  = useRef(null)
  const containerRef = useRef(null)
  const lastGazeRef = useRef(null)    // последняя валидная точка
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // ── Размер контейнера исследования ────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current
        setContainerSize({ w: clientWidth, h: clientHeight })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // ── Включаем точку взгляда и настраиваем listener ─────────────
  const startSession = useCallback(() => {
    if (!window.webgazer) {
      alert('WebGazer не инициализирован. Вернитесь на страницу калибровки.')
      return
    }

    gazeRef.current = []
    lastGazeRef.current = null
    setGazePoints([])
    setElapsed(0)
    setPhase('recording')

    // Показываем точку предсказания с улучшенной плавностью
    window.webgazer.showPredictionPoints(true)

    // Применяем сглаживание для WebGazer
    window.webgazer.applyKalmanFilter(true) // Включаем фильтр Калмана

    // Listener — получаем координаты взгляда с фильтрацией
    window.webgazer.setGazeListener((data) => {
      if (!data) return

      const x = Math.round(data.x)
      const y = Math.round(data.y)

      // Фильтр резких скачков
      if (lastGazeRef.current) {
        const dx = x - lastGazeRef.current.x
        const dy = y - lastGazeRef.current.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Игнорируем точки, которые слишком далеко (вероятные ошибки)
        if (distance > 300) return
      }

      const point = { x, y, t: Date.now() }
      lastGazeRef.current = point
      gazeRef.current.push(point)
    })

    // Таймер секундомера
    const start = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
  }, [])

  // ── Стоп — завершаем сеанс ────────────────────────────────────
  const stopSession = useCallback(() => {
    // Выключаем listener и точку
    if (window.webgazer) {
      window.webgazer.setGazeListener(() => {})
      window.webgazer.showPredictionPoints(false)
    }
    clearInterval(timerRef.current)
    clearInterval(sampleRef.current)

    const collected = [...gazeRef.current]

    // Переводим глобальные координаты в координаты контейнера
    const rect = containerRef.current?.getBoundingClientRect()
    let localPoints = collected.map(p => ({
      x: p.x - (rect ? rect.left : 0),
      y: p.y - (rect ? rect.top : 0),
      t: p.t,
    })).filter(p =>
        p.x >= 0 && p.y >= 0 &&
        p.x <= containerSize.w &&
        p.y <= containerSize.h
    )

    // Дополнительное сглаживание траектории
    localPoints = smoothGazePath(localPoints)

    setGazePoints(localPoints)
    setStats(computeStats(localPoints, elapsed))
    setPhase('done')
  }, [elapsed, containerSize])

  // ── Сброс ─────────────────────────────────────────────────────
  const reset = useCallback(() => {
    gazeRef.current = []
    lastGazeRef.current = null
    setGazePoints([])
    setStats(null)
    setElapsed(0)
    setPhase('ready')
  }, [])

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`

  return (
      <div style={styles.root}>
        {/* ── Панель управления (сверху) ── */}
        <div style={styles.controlBar}>
          <div style={styles.barLeft}>
            <EyeIcon small />
            <span style={styles.barTitle}>EYERESEARCH</span>
            <span style={styles.barSep}>›</span>
            <span style={styles.barSub}>СЕАНС ИССЛЕДОВАНИЯ</span>
          </div>

          <div style={styles.barCenter}>
            {phase === 'recording' && (
                <>
                  <span style={styles.recDot} />
                  <span style={styles.recLabel}>REC</span>
                  <span style={styles.timer}>{fmt(elapsed)}</span>
                  <span style={styles.pointsCount}>{gazeRef.current.length} точек</span>
                </>
            )}
            {phase === 'done' && (
                <span style={styles.doneLabel}>● СЕАНС ЗАВЕРШЁН — {gazePoints.length} точек взгляда</span>
            )}
          </div>

          <div style={styles.barRight}>
            {phase === 'ready' && (
                <button style={styles.btnStart} onClick={startSession}>
                  ▶ НАЧАТЬ ЗАПИСЬ
                </button>
            )}
            {phase === 'recording' && (
                <button style={styles.btnStop} onClick={stopSession}>
                  ■ СТОП
                </button>
            )}
            {phase === 'done' && (
                <>
                  <button
                      style={{ ...styles.btnToggle, borderColor: showHeatmap ? 'var(--mint)' : 'var(--border)' }}
                      onClick={() => setShowHeatmap(v => !v)}
                  >
                    {showHeatmap ? 'СКРЫТЬ КАРТУ' : 'ПОКАЗАТЬ КАРТУ'}
                  </button>
                  <button style={styles.btnReset} onClick={reset}>
                    ↺ НОВЫЙ СЕАНС
                  </button>
                </>
            )}
          </div>
        </div>

        {/* ── Область исследования (мок-сайт) ── */}
        <div ref={containerRef} style={styles.researchArea}>
          <MockWebsite />

          {/* Тепловая карта поверх */}
          {phase === 'done' && (
              <GazeHeatmap
                  gazePoints={gazePoints}
                  width={containerSize.w}
                  height={containerSize.h}
                  visible={showHeatmap}
              />
          )}

          {/* Оверлей готовности */}
          {phase === 'ready' && (
              <div style={styles.readyOverlay}>
                <div style={styles.readyCard}>
                  <div style={styles.readyIcon}>👁</div>
                  <h2 style={styles.readyTitle}>Готов к записи</h2>
                  <p style={styles.readyDesc}>
                    Смотрите на интерфейс справа и нажмите кнопку
                    <strong style={{ color: 'var(--mint)' }}> «НАЧАТЬ ЗАПИСЬ»</strong> наверху.
                    <br /><br />
                    После завершения сеанса система построит тепловую карту,
                    показывающую, куда был направлен взгляд.
                  </p>
                </div>
              </div>
          )}
        </div>

        {/* ── Статистика (только после сеанса) ── */}
        {phase === 'done' && stats && (
            <div style={styles.statsBar}>
              <StatChip label="Точек взгляда" value={stats.totalPoints} />
              <StatChip label="Длительность" value={`${elapsed}с`} />
              <StatChip label="Частота сэмплинга" value={`~${stats.hz} Гц`} />
              <StatChip label="Центр внимания X" value={`${stats.cx}px`} />
              <StatChip label="Центр внимания Y" value={`${stats.cy}px`} />
              <StatChip label="Область покрытия" value={`${stats.coverage}%`} />
            </div>
        )}

        <style>{`
        @keyframes blink-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
        .btn-start:hover { background: var(--mint) !important; color: #000 !important; }
        .btn-stop:hover  { background: var(--red)  !important; }
      `}</style>
      </div>
  )
}


// ── Сглаживание траектории взгляда ─────────────────────────────────────────
function smoothGazePath(points, windowSize = 5) {
  if (points.length < windowSize) return points

  const smoothed = []

  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2))
    const end = Math.min(points.length, i + Math.ceil(windowSize / 2))
    const window = points.slice(start, end)

    const avgX = window.reduce((sum, p) => sum + p.x, 0) / window.length
    const avgY = window.reduce((sum, p) => sum + p.y, 0) / window.length

    smoothed.push({
      x: Math.round(avgX),
      y: Math.round(avgY),
      t: points[i].t
    })
  }

  return smoothed
}

// ── Вычисление статистики ──────────────────────────────────────────────────
function computeStats(points, elapsed) {
  if (!points.length) return null
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const cx = Math.round(xs.reduce((a,b) => a+b, 0) / xs.length)
  const cy = Math.round(ys.reduce((a,b) => a+b, 0) / ys.length)
  const hz = elapsed > 0 ? Math.round(points.length / elapsed) : 0

  // Грубая оценка покрытия — уникальные ячейки 50×50
  const cells = new Set(points.map(p => `${Math.floor(p.x/50)}_${Math.floor(p.y/50)}`))
  const maxCells = Math.ceil(window.innerWidth / 50) * Math.ceil(window.innerHeight / 50)
  const coverage = Math.round((cells.size / maxCells) * 100)

  return { totalPoints: points.length, hz, cx, cy, coverage }
}

function StatChip({ label, value }) {
  return (
      <div style={statStyles.chip}>
        <span style={statStyles.label}>{label}</span>
        <span style={statStyles.value}>{value}</span>
      </div>
  )
}

function EyeIcon({ small }) {
  const s = small ? 18 : 24
  return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="12" rx="10" ry="6.5" stroke="#3dffa0" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="3.5" stroke="#3dffa0" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="1.5" fill="#3dffa0"/>
      </svg>
  )
}

const styles = {
  root: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    background: 'var(--bg-void)',
    overflow: 'hidden',
  },
  controlBar: {
    height: 52,
    background: 'var(--bg-panel)',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center',
    padding: '0 16px',
    gap: 16,
    flexShrink: 0,
    zIndex: 200,
  },
  barLeft: {
    display: 'flex', alignItems: 'center', gap: 8,
    flexShrink: 0,
  },
  barTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800, fontSize: 13,
    letterSpacing: '0.12em',
    color: 'var(--mint)',
  },
  barSep: { color: 'var(--text-ghost)', fontSize: 14 },
  barSub: {
    fontSize: 10, letterSpacing: '0.14em',
    color: 'var(--text-dim)',
  },
  barCenter: {
    flex: 1, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 12,
  },
  recDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--red)',
    boxShadow: '0 0 6px var(--red)',
    animation: 'blink-dot 1s infinite',
    display: 'block',
  },
  recLabel: {
    color: 'var(--red)', fontSize: 11,
    fontWeight: 700, letterSpacing: '0.1em',
  },
  timer: {
    fontFamily: 'var(--font-mono)',
    fontSize: 18, fontWeight: 500,
    color: 'var(--text-prime)',
    letterSpacing: '0.06em',
  },
  pointsCount: {
    fontSize: 11, color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
  },
  doneLabel: {
    fontSize: 12, color: 'var(--mint)',
    letterSpacing: '0.06em',
  },
  barRight: {
    display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
  },
  btnStart: {
    padding: '8px 18px',
    background: 'transparent',
    border: '1px solid var(--mint)',
    borderRadius: 'var(--radius)',
    color: 'var(--mint)',
    fontFamily: 'var(--font-mono)',
    fontSize: 12, fontWeight: 500,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  btnStop: {
    padding: '8px 18px',
    background: 'rgba(255,69,103,0.15)',
    border: '1px solid var(--red)',
    borderRadius: 'var(--radius)',
    color: 'var(--red)',
    fontFamily: 'var(--font-mono)',
    fontSize: 12, fontWeight: 500,
    letterSpacing: '0.08em',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  btnToggle: {
    padding: '7px 14px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  btnReset: {
    padding: '7px 14px',
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    cursor: 'pointer',
  },
  researchArea: {
    flex: 1,
    position: 'relative',
    overflow: 'auto',
  },
  readyOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(5,8,15,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(2px)',
    zIndex: 40,
  },
  readyCard: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border-lit)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px 48px',
    maxWidth: 460,
    textAlign: 'center',
    animation: 'fade-in 0.4s ease',
  },
  readyIcon: { fontSize: 48, marginBottom: 16 },
  readyTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 20, fontWeight: 700,
    color: 'var(--text-prime)',
    marginBottom: 12,
  },
  readyDesc: {
    color: 'var(--text-dim)',
    fontSize: 13, lineHeight: 1.7,
  },
  statsBar: {
    height: 52,
    background: 'var(--bg-deep)',
    borderTop: '1px solid var(--border)',
    display: 'flex', alignItems: 'center',
    padding: '0 16px', gap: 8,
    flexShrink: 0,
    overflowX: 'auto',
  },
}

const statStyles = {
  chip: {
    display: 'flex', flexDirection: 'column',
    padding: '4px 14px',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    flexShrink: 0,
    minWidth: 100,
  },
  label: {
    fontSize: 9, letterSpacing: '0.12em',
    color: 'var(--text-ghost)',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontSize: 14, fontWeight: 500,
    color: 'var(--mint)',
    fontFamily: 'var(--font-mono)',
  },
}