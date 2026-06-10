import { useState, useRef, useCallback, useEffect } from 'react'
import MockWebsite from '../components/MockWebsite.jsx'
import GazeHeatmap from '../components/GazeHeatmap.jsx'

// ═══════════════════════════════════════════════════════════════════════════════
// GazeProcessor — многослойная обработка сырых координат WebGazer
//
// Слои (в порядке применения):
//   1. Медианный буфер   — отсекает случайные выбросы (моргания, артефакты)
//   2. Фильтр Калмана    — сглаживает траекторию, учитывает скорость движения
//   3. Dead zone         — подавляет микродрожание когда взгляд стоит на месте
//   4. Velocity clamp    — ограничивает прыжки > MAX_JUMP px за кадр
//
// Параметры для тюнинга:
//   MEDIAN_WINDOW  — сколько последних точек брать для медианы (3–7)
//   KALMAN_R       — доверие к сенсору: меньше = плавнее, но с лагом
//   KALMAN_Q       — скорость реакции: больше = быстрее, но дрожит
//   DEAD_ZONE_PX   — радиус мёртвой зоны в пикселях (20–50)
//   MAX_JUMP_PX    — максимальный прыжок за кадр (80–200)
// ═══════════════════════════════════════════════════════════════════════════════

const MEDIAN_WINDOW = 5
const KALMAN_R      = 0.008
const KALMAN_Q      = 2.5
const DEAD_ZONE_PX  = 28
const MAX_JUMP_PX   = 160

class GazeProcessor {
  constructor() {
    // Медианный буфер
    this.bufX = []
    this.bufY = []

    // Калман: состояние [x, y, vx, vy], ковариация P
    this.kx  = [0, 0, 0, 0]
    this.P   = [10, 10, 10, 10]
    this.kInit = false

    // Dead zone: последняя выданная позиция
    this.outX = 0
    this.outY = 0
    this.initialized = false
  }

  // ── 1. Медианный буфер ──────────────────────────────────────────────────────
  _median(arr) {
    const s = [...arr].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2
  }

  _pushMedian(rx, ry) {
    this.bufX.push(rx)
    this.bufY.push(ry)
    if (this.bufX.length > MEDIAN_WINDOW) { this.bufX.shift(); this.bufY.shift() }
    return { x: this._median(this.bufX), y: this._median(this.bufY) }
  }

  // ── 2. Фильтр Калмана ───────────────────────────────────────────────────────
  _kalman(mx, my) {
    if (!this.kInit) {
      this.kx = [mx, my, 0, 0]
      this.kInit = true
      return { x: mx, y: my }
    }
    const dt = 1
    const px  = this.kx[0] + this.kx[2] * dt
    const py  = this.kx[1] + this.kx[3] * dt
    const pvx = this.kx[2], pvy = this.kx[3]
    const Pp  = [this.P[0]+KALMAN_Q, this.P[1]+KALMAN_Q, this.P[2]+KALMAN_Q, this.P[3]+KALMAN_Q]
    const Kx  = Pp[0] / (Pp[0] + KALMAN_R)
    const Ky  = Pp[1] / (Pp[1] + KALMAN_R)
    const nx  = px  + Kx * (mx - px)
    const ny  = py  + Ky * (my - py)
    const nvx = pvx + Kx * (mx - px) / dt
    const nvy = pvy + Ky * (my - py) / dt
    this.kx = [nx, ny, nvx, nvy]
    this.P  = [(1-Kx)*Pp[0], (1-Ky)*Pp[1], Pp[2], Pp[3]]
    return { x: nx, y: ny }
  }

  // ── 3. Dead zone ────────────────────────────────────────────────────────────
  _deadZone(x, y) {
    const dx = x - this.outX
    const dy = y - this.outY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < DEAD_ZONE_PX) return { x: this.outX, y: this.outY } // не двигаемся
    // Плавно сдвигаемся: начинаем движение только когда вышли из зоны
    const ratio = (dist - DEAD_ZONE_PX) / dist
    return {
      x: this.outX + dx * ratio,
      y: this.outY + dy * ratio,
    }
  }

  // ── 4. Velocity clamp ───────────────────────────────────────────────────────
  _clamp(x, y) {
    const dx   = x - this.outX
    const dy   = y - this.outY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist <= MAX_JUMP_PX) return { x, y }
    // Ограничиваем прыжок — двигаемся в том же направлении, но не дальше MAX_JUMP
    const scale = MAX_JUMP_PX / dist
    return {
      x: this.outX + dx * scale,
      y: this.outY + dy * scale,
    }
  }

  // ── Главный метод: пропустить сырые координаты через все слои ───────────────
  process(rawX, rawY) {
    // 1. Медиана
    const med = this._pushMedian(rawX, rawY)
    // 2. Калман
    const kal = this._kalman(med.x, med.y)
    // 3. Velocity clamp (до dead zone, чтобы большие движения проходили)
    const clamped = this.initialized ? this._clamp(kal.x, kal.y) : kal
    // 4. Dead zone
    const out = this.initialized ? this._deadZone(clamped.x, clamped.y) : clamped

    this.outX = out.x
    this.outY = out.y
    this.initialized = true
    return out
  }

  reset() {
    this.bufX = []; this.bufY = []
    this.kx = [0, 0, 0, 0]; this.P = [10, 10, 10, 10]; this.kInit = false
    this.outX = 0; this.outY = 0; this.initialized = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

function computeStats(points, elapsed) {
  if (!points.length) return null
  const totalPoints = points.length
  const hz = elapsed > 0 ? Math.round(totalPoints / elapsed) : 0
  const cx = Math.round(points.reduce((a, p) => a + p.x, 0) / totalPoints)
  const cy = Math.round(points.reduce((a, p) => a + p.y, 0) / totalPoints)
  const cellSize = 50
  const cells = new Set(points.map(p => `${Math.floor(p.x/cellSize)},${Math.floor(p.y/cellSize)}`))
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const bboxCols = Math.ceil((Math.max(...xs) - Math.min(...xs)) / cellSize) || 1
  const bboxRows = Math.ceil((Math.max(...ys) - Math.min(...ys)) / cellSize) || 1
  const coverage = Math.min(100, Math.round((cells.size / (bboxCols * bboxRows)) * 100))
  return { totalPoints, hz, cx, cy, coverage }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EyeIcon({ small }) {
  const size = small ? 18 : 32
  return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
           stroke="var(--mint,#3dffa0)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
  )
}

function StatChip({ label, value }) {
  return (
      <div style={chipStyles.chip}>
        <span style={chipStyles.label}>{label}</span>
        <span style={chipStyles.value}>{value}</span>
      </div>
  )
}

const chipStyles = {
  chip: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '6px 16px', borderRadius: 6,
    border: '1px solid #1e2533', background: '#0a0f1a', minWidth: 100,
  },
  label: { fontSize: 10, color: '#556', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: 700, color: '#3dffa0', fontVariantNumeric: 'tabular-nums' },
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [phase, setPhase]             = useState('ready')
  const [gazePoints, setGazePoints]   = useState([])
  const [elapsed, setElapsed]         = useState(0)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  const gazeRef      = useRef([])
  const timerRef     = useRef(null)
  const containerRef = useRef(null)
  const cursorRef    = useRef(null)
  const procRef      = useRef(new GazeProcessor())

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(([entry]) => {
      setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const stats = phase === 'done' ? computeStats(gazePoints, elapsed) : null

  const reset = useCallback(() => {
    if (window.webgazer) window.webgazer.setGazeListener(() => {})
    clearInterval(timerRef.current)
    procRef.current.reset()
    gazeRef.current = []
    setGazePoints([])
    setElapsed(0)
    setPhase('ready')
  }, [])

  const startSession = useCallback(() => {
    if (!window.webgazer) return
    gazeRef.current = []
    procRef.current.reset()
    setPhase('recording')
    window.webgazer.showVideo(false)
    window.webgazer.showPredictionPoints(false)

    window.webgazer.setGazeListener((data) => {
      if (!data) return
      // Пропускаем через все 4 слоя обработки
      const { x, y } = procRef.current.process(data.x, data.y)

      if (cursorRef.current) {
        cursorRef.current.style.left = `${x}px`
        cursorRef.current.style.top  = `${y}px`
      }
      gazeRef.current.push({ x, y, t: Date.now() })
    })

    const start = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
  }, [])

  const stopSession = useCallback(() => {
    if (window.webgazer) window.webgazer.setGazeListener(() => {})
    clearInterval(timerRef.current)
    const rect = containerRef.current?.getBoundingClientRect()
    const localPoints = rect
        ? gazeRef.current
            .map(p => ({ x: Math.round(p.x - rect.left), y: Math.round(p.y - rect.top), t: p.t }))
            .filter(p => p.x >= 0 && p.y >= 0 && p.x <= rect.width && p.y <= rect.height)
        : gazeRef.current
    setGazePoints(localPoints)
    setPhase('done')
  }, [])

  return (
      <div style={styles.root}>

        {phase === 'recording' && <div ref={cursorRef} style={styles.cursor} />}

        {/* ── Control bar ── */}
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
                <button className="btn-start" style={styles.btnStart} onClick={startSession}>
                  ▶ НАЧАТЬ ЗАПИСЬ
                </button>
            )}
            {phase === 'recording' && (
                <button className="btn-stop" style={styles.btnStop} onClick={stopSession}>
                  ■ СТОП
                </button>
            )}
            {phase === 'done' && (
                <>
                  <button
                      style={{ ...styles.btnToggle, borderColor: showHeatmap ? 'var(--mint,#3dffa0)' : '#1e2533' }}
                      onClick={() => setShowHeatmap(v => !v)}
                  >
                    {showHeatmap ? 'СКРЫТЬ КАРТУ' : 'ПОКАЗАТЬ КАРТУ'}
                  </button>
                  <button style={styles.btnReset} onClick={reset}>↺ НОВЫЙ СЕАНС</button>
                </>
            )}
          </div>
        </div>

        {/* ── Research area ── */}
        <div ref={containerRef} style={styles.researchArea}>
          <MockWebsite />

          {phase === 'done' && (
              <GazeHeatmap
                  gazePoints={gazePoints}
                  width={containerSize.w}
                  height={containerSize.h}
                  visible={showHeatmap}
              />
          )}

          {phase === 'ready' && (
              <div style={styles.readyOverlay}>
                <div style={styles.readyCard}>
                  <div style={styles.readyIcon}>👁</div>
                  <h2 style={styles.readyTitle}>Готов к записи</h2>
                  <p style={styles.readyDesc}>
                    Смотрите на интерфейс и нажмите кнопку
                    <strong style={{ color: 'var(--mint,#3dffa0)' }}> «НАЧАТЬ ЗАПИСЬ»</strong> наверху.
                    <br /><br />
                    После завершения сеанса система построит тепловую карту,
                    показывающую, куда был направлен взгляд.
                  </p>
                </div>
              </div>
          )}
        </div>

        {/* ── Stats bar ── */}
        {phase === 'done' && stats && (
            <div style={styles.statsBar}>
              <StatChip label="Точек взгляда"     value={stats.totalPoints} />
              <StatChip label="Длительность"      value={`${elapsed}с`} />
              <StatChip label="Частота сэмплинга" value={`~${stats.hz} Гц`} />
              <StatChip label="Центр внимания X"  value={`${stats.cx}px`} />
              <StatChip label="Центр внимания Y"  value={`${stats.cy}px`} />
              <StatChip label="Область покрытия"  value={`${stats.coverage}%`} />
            </div>
        )}

        <style>{`
        :root { --mint: #3dffa0; --red: #ff4567; --border: #1e2533; }
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

const styles = {
  root: {
    width: '100vw', height: '100vh',
    display: 'flex', flexDirection: 'column',
    background: '#05080f', color: '#c8d0e0', fontFamily: 'monospace',
  },
  cursor: {
    position: 'fixed', width: 20, height: 20,
    border: '2px solid #3dffa0', borderRadius: '50%',
    pointerEvents: 'none', zIndex: 9999,
    transform: 'translate(-50%,-50%)',
    background: 'rgba(61,255,160,0.2)',
    // Нет CSS transition — плавность обеспечивает GazeProcessor
  },
  controlBar: {
    height: 52, flexShrink: 0,
    borderBottom: '1px solid #1e2533',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px', gap: 12, background: '#07090f',
  },
  barLeft:   { display: 'flex', alignItems: 'center', gap: 8 },
  barTitle:  { fontWeight: 800, fontSize: 13, letterSpacing: 2, color: '#3dffa0' },
  barSep:    { color: '#2a3040', fontSize: 16 },
  barSub:    { fontSize: 11, color: '#556', letterSpacing: 1 },
  barCenter: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' },
  recDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#ff4567',
    animation: 'blink-dot 1s ease-in-out infinite', display: 'inline-block',
  },
  recLabel:    { fontSize: 11, color: '#ff4567', fontWeight: 700, letterSpacing: 2 },
  timer:       { fontSize: 14, color: '#c8d0e0', fontVariantNumeric: 'tabular-nums' },
  pointsCount: { fontSize: 11, color: '#556' },
  doneLabel:   { fontSize: 12, color: '#3dffa0', letterSpacing: 1 },
  barRight: { display: 'flex', alignItems: 'center', gap: 8 },
  btnStart: {
    background: 'transparent', color: '#3dffa0', border: '1px solid #3dffa0',
    padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
    fontWeight: 700, fontSize: 11, letterSpacing: 1,
    transition: 'background 0.15s, color 0.15s',
  },
  btnStop: {
    background: 'transparent', color: '#ff4567', border: '1px solid #ff4567',
    padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
    fontWeight: 700, fontSize: 11, letterSpacing: 1,
    transition: 'background 0.15s',
  },
  btnToggle: {
    background: 'transparent', color: '#c8d0e0', border: '1px solid #1e2533',
    padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 11, letterSpacing: 1,
  },
  btnReset: {
    background: 'transparent', color: '#556', border: '1px solid #1e2533',
    padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 11, letterSpacing: 1,
  },
  researchArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  readyOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(5,8,15,0.82)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  readyCard: {
    background: '#0a0f1a', border: '1px solid #1e2533',
    borderRadius: 12, padding: '36px 48px', maxWidth: 420, textAlign: 'center',
  },
  readyIcon:  { fontSize: 40, marginBottom: 12 },
  readyTitle: { fontSize: 18, fontWeight: 700, color: '#c8d0e0', margin: '0 0 12px' },
  readyDesc:  { fontSize: 13, color: '#667', lineHeight: 1.7, margin: 0 },
  statsBar: {
    flexShrink: 0, height: 64, borderTop: '1px solid #1e2533',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: '0 16px', background: '#07090f',
  },
}