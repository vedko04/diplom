import { useState, useEffect, useRef, useCallback } from 'react'
import MockWebsite from '../components/MockWebsite.jsx'
import GazeHeatmap from '../components/GazeHeatmap.jsx'

export default function ResearchPage() {
  const [phase, setPhase] = useState('ready')
  const [gazePoints, setGazePoints] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const [showHeatmap, setShowHeatmap] = useState(true)

  const gazeRef = useRef([])
  const timerRef = useRef(null)
  const containerRef = useRef(null)
  const cursorRef = useRef(null) // Реф для курсора, чтобы не лагал

  // Запуск сессии
  const startSession = useCallback(() => {
    if (!window.webgazer) return

    gazeRef.current = []
    setPhase('recording')

    window.webgazer.showVideo(false)
    window.webgazer.showPredictionPoints(false)

    window.webgazer.setGazeListener((data) => {
      if (!data) return

      // Двигаем курсор напрямую через DOM (это исключает лаги)
      if (cursorRef.current) {
        cursorRef.current.style.left = `${data.x}px`
        cursorRef.current.style.top = `${data.y}px`
      }

      gazeRef.current.push({ x: data.x, y: data.y, t: Date.now() })
    })

    const start = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
  }, [])

  // Остановка
  const stopSession = () => {
    window.webgazer.setGazeListener(() => {})
    clearInterval(timerRef.current)

    const rect = containerRef.current.getBoundingClientRect()
    const localPoints = gazeRef.current.map(p => ({
      x: Math.round(p.x - rect.left),
      y: Math.round(p.y - rect.top),
      t: p.t
    })).filter(p => p.x >= 0 && p.y >= 0 && p.x <= rect.width && p.y <= rect.height)

    setGazePoints(localPoints)
    setPhase('done')
  }

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

const styles = {
  root: { width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#05080f' },
  nav: { height: 60, borderBottom: '1px solid #1e2533', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' },
  area: { flex: 1, position: 'relative', overflow: 'hidden' },
  cursor: {
    position: 'fixed', width: 20, height: 20, border: '2px solid #3dffa0',
    borderRadius: '50%', pointerEvents: 'none', zIndex: 9999,
    transform: 'translate(-50%, -50%)', background: 'rgba(61, 255, 160, 0.2)',
    transition: 'left 0.05s linear, top 0.05s linear' // Чуть-чуть сглаживания
  },
  btn: { background: '#3dffa0', color: '#000', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 700 },
  btnStop: { background: '#ff4567', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }
}