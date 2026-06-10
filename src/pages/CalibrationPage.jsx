import { useState, useEffect, useRef, useCallback } from 'react'
import '../../src/styles/global.css'

// ── 16 точек калибровки — 4×4 сетка ─────────────────────────────────────────
// Края экрана намеренно чуть отступают (8%) чтобы точки были кликабельны
const CALIBRATION_POINTS = [
  { id:  0, xPct:  8, yPct:  8 },
  { id:  1, xPct: 35, yPct:  8 },
  { id:  2, xPct: 65, yPct:  8 },
  { id:  3, xPct: 92, yPct:  8 },
  { id:  4, xPct:  8, yPct: 35 },
  { id:  5, xPct: 35, yPct: 35 },
  { id:  6, xPct: 65, yPct: 35 },
  { id:  7, xPct: 92, yPct: 35 },
  { id:  8, xPct:  8, yPct: 65 },
  { id:  9, xPct: 35, yPct: 65 },
  { id: 10, xPct: 65, yPct: 65 },
  { id: 11, xPct: 92, yPct: 65 },
  { id: 12, xPct:  8, yPct: 92 },
  { id: 13, xPct: 35, yPct: 92 },
  { id: 14, xPct: 65, yPct: 92 },
  { id: 15, xPct: 92, yPct: 92 },
]

// 5 точек валидации — центр + 4 угла (другие координаты, не из калибровки)
const VALIDATION_POINTS = [
  { id: 'v0', xPct: 50, yPct: 50 },
  { id: 'v1', xPct: 20, yPct: 20 },
  { id: 'v2', xPct: 80, yPct: 20 },
  { id: 'v3', xPct: 20, yPct: 80 },
  { id: 'v4', xPct: 80, yPct: 80 },
]

const FOCUS_DELAY_MS  = 2000  // 2 сек держать взгляд
const RECORD_REPEATS  = 10    // замеров на точку
const RECORD_INTERVAL = 80    // мс между замерами
// Порог точности: среднее отклонение в пикселях должно быть ниже этого
const ACCURACY_THRESHOLD_PX = 120

export default function CalibrationPage({ onComplete }) {
  const [phase, setPhase]       = useState('intro')   // intro|calibrating|validating|result|done
  const [activeIdx, setActive]  = useState(0)
  const [doneIds, setDoneIds]   = useState(new Set())
  const [camOk, setCamOk]       = useState(false)
  const [camError, setCamError] = useState('')
  const [focusState, setFocus]  = useState('waiting') // waiting|focusing|ready|recording
  const [focusProgress, setFp]  = useState(0)

  // Валидация
  const [valIdx, setValIdx]         = useState(0)
  const [valFocus, setValFocus]     = useState('waiting')
  const [valProgress, setValProg]   = useState(0)
  const [valSamples, setValSamples] = useState([]) // { expected, measured }[]
  const [accuracy, setAccuracy]     = useState(null) // среднее отклонение px

  const rafRef      = useRef(null)
  const valRafRef   = useRef(null)
  const gazeRef     = useRef(null) // последние координаты WebGazer

  const totalPoints = CALIBRATION_POINTS.length
  const progress    = doneIds.size / totalPoints

  // ── WebGazer init ────────────────────────────────────────────────────────────
  const initWebGazer = useCallback(async () => {
    if (!window.webgazer) return
    try {
      window.webgazer.saveDataAcrossSessions(false)
      await window.webgazer.begin()
      window.webgazer.showVideoPreview(false)
      window.webgazer.showPredictionPoints(false)
      window.webgazer.applyKalmanFilter(false)
      const c = document.getElementById('webgazerVideoContainer')
      if (c) c.style.display = 'none'
      setCamOk(true)
    } catch (err) {
      setCamError('Не удалось подключить камеру: ' + err.message)
    }
  }, [])

  // ── Слушаем взгляд во время валидации ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'validating') return
    if (!window.webgazer) return
    window.webgazer.setGazeListener((data) => {
      if (data) gazeRef.current = { x: data.x, y: data.y }
    })
    return () => {
      if (window.webgazer) window.webgazer.setGazeListener(() => {})
    }
  }, [phase])

  // ── Навели мышь на точку калибровки ─────────────────────────────────────────
  const handleCalibEnter = useCallback(() => {
    if (focusState !== 'waiting') return
    setFocus('focusing')
    setFp(0)
    const start = performance.now()
    const animate = () => {
      const p = Math.min(1, (performance.now() - start) / FOCUS_DELAY_MS)
      setFp(p)
      if (p < 1) rafRef.current = requestAnimationFrame(animate)
      else setFocus('ready')
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [focusState])

  const handleCalibLeave = useCallback(() => {
    if (focusState === 'recording') return
    cancelAnimationFrame(rafRef.current)
    setFocus('waiting')
    setFp(0)
  }, [focusState])

  const handleCalibClick = useCallback((point) => {
    if (phase !== 'calibrating' || focusState !== 'ready') return
    setFocus('recording')

    const x = (point.xPct / 100) * window.innerWidth
    const y = (point.yPct / 100) * window.innerHeight

    for (let i = 0; i < RECORD_REPEATS; i++) {
      setTimeout(() => {
        if (window.webgazer) window.webgazer.recordScreenPosition(x, y, 'click')
      }, i * RECORD_INTERVAL)
    }

    setTimeout(() => {
      setDoneIds(prev => { const n = new Set(prev); n.add(point.id); return n })
      const nextIdx = activeIdx + 1
      if (nextIdx >= CALIBRATION_POINTS.length) {
        setTimeout(() => {
          setPhase('validating')
          setValIdx(0)
          setValFocus('waiting')
          setValProg(0)
          setValSamples([])
          gazeRef.current = null
        }, 300)
      } else {
        setActive(nextIdx)
        setFocus('waiting')
        setFp(0)
      }
    }, RECORD_REPEATS * RECORD_INTERVAL + 100)
  }, [phase, focusState, activeIdx])

  // ── Навели мышь на точку валидации ──────────────────────────────────────────
  const handleValEnter = useCallback(() => {
    if (valFocus !== 'waiting') return
    setValFocus('focusing')
    setValProg(0)
    const start = performance.now()
    const animate = () => {
      const p = Math.min(1, (performance.now() - start) / FOCUS_DELAY_MS)
      setValProg(p)
      if (p < 1) valRafRef.current = requestAnimationFrame(animate)
      else setValFocus('ready')
    }
    valRafRef.current = requestAnimationFrame(animate)
  }, [valFocus])

  const handleValLeave = useCallback(() => {
    if (valFocus === 'recording') return
    cancelAnimationFrame(valRafRef.current)
    setValFocus('waiting')
    setValProg(0)
  }, [valFocus])

  const handleValClick = useCallback((point) => {
    if (phase !== 'validating' || valFocus !== 'ready') return
    setValFocus('recording')

    const ex = (point.xPct / 100) * window.innerWidth
    const ey = (point.yPct / 100) * window.innerHeight
    const measured = gazeRef.current || { x: ex, y: ey } // fallback

    const newSamples = [...valSamples, { expected: { x: ex, y: ey }, measured }]

    setTimeout(() => {
      const nextIdx = valIdx + 1
      if (nextIdx >= VALIDATION_POINTS.length) {
        // Считаем среднее отклонение
        const avgErr = newSamples.reduce((acc, s) => {
          const dx = s.measured.x - s.expected.x
          const dy = s.measured.y - s.expected.y
          return acc + Math.sqrt(dx * dx + dy * dy)
        }, 0) / newSamples.length

        setAccuracy(Math.round(avgErr))
        setValSamples(newSamples)
        setPhase('result')
      } else {
        setValSamples(newSamples)
        setValIdx(nextIdx)
        setValFocus('waiting')
        setValProg(0)
        gazeRef.current = null
      }
    }, 400)
  }, [phase, valFocus, valIdx, valSamples])

  // Пересобрать калибровку
  const recalibrate = useCallback(() => {
    if (window.webgazer) {
      window.webgazer.clearData()
      window.webgazer.setGazeListener(() => {})
    }
    setPhase('calibrating')
    setActive(0)
    setDoneIds(new Set())
    setFocus('waiting')
    setFp(0)
    setValIdx(0)
    setValFocus('waiting')
    setValProg(0)
    setValSamples([])
    setAccuracy(null)
    gazeRef.current = null
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    cancelAnimationFrame(valRafRef.current)
  }, [])

  // ── Рендер ──────────────────────────────────────────────────────────────────
  return (
      <div style={styles.root}>

        {/* INTRO */}
        {phase === 'intro' && (
            <div style={styles.card}>
              <h1 style={styles.title}>Калибровка трекера взгляда</h1>
              <p style={styles.desc}>
                Для точного отслеживания необходимо пройти калибровку из 16 точек
                и автоматическую проверку точности.
              </p>
              <ul style={styles.checklist}>
                <CheckItem>Хорошее освещение лица спереди</CheckItem>
                <CheckItem>Камера строго на уровне глаз, 50–70 см</CheckItem>
                <CheckItem>Голова неподвижна, без очков по возможности</CheckItem>
                <CheckItem>Наведите курсор → подождите кольцо (2 с) → кликните</CheckItem>
                <CheckItem>После калибровки — автоматическая проверка точности</CheckItem>
              </ul>
              {camError && <div style={styles.errBox}>{camError}</div>}
              {!camOk
                  ? <button style={styles.btn} onClick={initWebGazer}>ВКЛЮЧИТЬ КАМЕРУ →</button>
                  : <button style={styles.btn} onClick={() => setPhase('calibrating')}>НАЧАТЬ КАЛИБРОВКУ →</button>
              }
              {camOk && <div style={styles.camOk}><span style={styles.dot} /> Камера подключена</div>}
            </div>
        )}

        {/* КАЛИБРОВКА */}
        {phase === 'calibrating' && (
            <>
              <div style={styles.topBar}>
            <span style={styles.topBarText}>
              {focusState === 'waiting'  && 'Наведите курсор на светящуюся точку и держите взгляд'}
              {focusState === 'focusing' && 'Держите взгляд на точке…'}
              {focusState === 'ready'    && '✓ Взгляд зафиксирован — кликните!'}
              {focusState === 'recording'&& 'Записываю данные…'}
            </span>
                <div style={styles.progressWrap}>
                  <div style={{ ...styles.progressFill, width: `${progress * 100}%` }} />
                </div>
                <span style={styles.progressLabel}>{doneIds.size} / {totalPoints}</span>
              </div>

              {CALIBRATION_POINTS.map((pt) => {
                const isDone   = doneIds.has(pt.id)
                const isActive = pt.id === CALIBRATION_POINTS[activeIdx]?.id && !isDone
                return (
                    <CalibDot
                        key={pt.id}
                        point={pt}
                        isDone={isDone}
                        isActive={isActive}
                        focusState={isActive ? focusState : 'waiting'}
                        focusProgress={isActive ? focusProgress : 0}
                        onEnter={isActive ? handleCalibEnter : undefined}
                        onLeave={isActive ? handleCalibLeave : undefined}
                        onClick={isActive ? () => handleCalibClick(pt) : undefined}
                    />
                )
              })}

              <div style={styles.counter}>
                Точка {activeIdx + 1} / {totalPoints}
              </div>
            </>
        )}

        {/* ВАЛИДАЦИЯ */}
        {phase === 'validating' && (
            <>
              <div style={styles.topBar}>
            <span style={styles.topBarText}>
              {valFocus === 'waiting'   && `Проверка точности: наведите взгляд и курсор на точку (${valIdx + 1}/5)`}
              {valFocus === 'focusing'  && 'Держите взгляд…'}
              {valFocus === 'ready'     && '✓ Кликните!'}
              {valFocus === 'recording' && 'Измеряю отклонение…'}
            </span>
                <div style={styles.progressWrap}>
                  <div style={{ ...styles.progressFill,
                    background: 'linear-gradient(90deg,rgba(255,196,0,0.5),#ffc400)',
                    width: `${(valIdx / VALIDATION_POINTS.length) * 100}%` }} />
                </div>
                <span style={{ ...styles.progressLabel, color: '#ffc400' }}>
              {valIdx} / {VALIDATION_POINTS.length}
            </span>
              </div>

              {VALIDATION_POINTS.map((pt, i) => {
                if (i < valIdx) return null // уже пройдена
                if (i > valIdx) return null // ещё не дошли
                return (
                    <CalibDot
                        key={pt.id}
                        point={pt}
                        isDone={false}
                        isActive={true}
                        focusState={valFocus}
                        focusProgress={valProgress}
                        color="#ffc400"
                        onEnter={handleValEnter}
                        onLeave={handleValLeave}
                        onClick={() => handleValClick(pt)}
                    />
                )
              })}

              <div style={styles.counter}>Проверка точности: точка {valIdx + 1} / {VALIDATION_POINTS.length}</div>
            </>
        )}

        {/* РЕЗУЛЬТАТ ВАЛИДАЦИИ */}
        {phase === 'result' && (
            <div style={styles.card}>
              <div style={{
                ...styles.resultIcon,
                background: accuracy <= ACCURACY_THRESHOLD_PX ? 'var(--mint,#3dffa0)' : '#ff4567',
              }}>
                {accuracy <= ACCURACY_THRESHOLD_PX ? '✓' : '✗'}
              </div>
              <h2 style={styles.title}>
                {accuracy <= ACCURACY_THRESHOLD_PX ? 'Калибровка прошла успешно' : 'Точность недостаточна'}
              </h2>
              <p style={styles.desc}>
                Среднее отклонение взгляда: <strong style={{
                color: accuracy <= ACCURACY_THRESHOLD_PX ? 'var(--mint,#3dffa0)' : '#ff4567'
              }}>{accuracy} px</strong>
                {accuracy <= ACCURACY_THRESHOLD_PX
                    ? ` — отлично! Система готова к работе.`
                    : ` — слишком много (порог ${ACCURACY_THRESHOLD_PX} px). Попробуйте пройти калибровку ещё раз, смотря точно на точки.`
                }
              </p>

              {/* Визуализация отклонений */}
              <AccuracyMap samples={valSamples} />

              {accuracy <= ACCURACY_THRESHOLD_PX
                  ? <button style={styles.btn} onClick={onComplete}>ПЕРЕЙТИ К ИССЛЕДОВАНИЮ →</button>
                  : <button style={styles.btn} onClick={recalibrate}>↺ ПОВТОРИТЬ КАЛИБРОВКУ</button>
              }
              {accuracy <= ACCURACY_THRESHOLD_PX && (
                  <button style={{ ...styles.btn, marginTop: 10,
                    borderColor: '#1e2533', color: '#556' }} onClick={recalibrate}>
                    ↺ Перекалибровать заново
                  </button>
              )}
            </div>
        )}

        <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2);   opacity: 0; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      </div>
  )
}

// ── Компонент точки (используется и для калибровки, и для валидации) ──────────
function CalibDot({ point, isDone, isActive, focusState, focusProgress, color = 'var(--mint,#3dffa0)', onEnter, onLeave, onClick }) {
  const size = 44
  const r    = size / 2 - 5
  const circ = 2 * Math.PI * r
  const dash = focusProgress * circ

  const dotColor = focusState === 'ready' ? color : `rgba(61,255,160,${0.3 + focusProgress * 0.7})`

  const base = {
    position: 'absolute',
    left: `${point.xPct}%`, top: `${point.yPct}%`,
    transform: 'translate(-50%,-50%)',
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  }

  if (isDone) return (
      <div style={{ ...base, background: color, boxShadow: `0 0 14px ${color}` }}>
        <span style={{ color: '#000', fontSize: 18, fontWeight: 700 }}>✓</span>
      </div>
  )

  if (isActive) return (
      <div style={{ ...base, cursor: focusState === 'ready' ? 'crosshair' : 'default' }}
           onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}>
        {focusState === 'waiting' && (
            <div style={{
              position: 'absolute', width: size, height: size, borderRadius: '50%',
              border: `2px solid ${color}`, opacity: 0.5,
              animation: 'pulse-ring 1.4s ease-out infinite',
            }} />
        )}
        <svg width={size} height={size} style={{ position: 'absolute' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none"
                  stroke="rgba(61,255,160,0.1)" strokeWidth="3" />
          <circle cx={size/2} cy={size/2} r={r} fill="none"
                  stroke={dotColor} strokeWidth="3"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size/2} ${size/2})`}
                  style={{ transition: 'stroke 0.2s' }} />
        </svg>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: dotColor, zIndex: 1,
          boxShadow: focusState === 'ready' ? `0 0 10px ${color}` : 'none',
          transition: 'background 0.2s, box-shadow 0.2s',
        }} />
      </div>
  )

  return (
      <div style={{ ...base, opacity: 0.18 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #556' }} />
      </div>
  )
}

// ── Мини-карта отклонений ────────────────────────────────────────────────────
function AccuracyMap({ samples }) {
  const W = 280, H = 160
  return (
      <div style={{ margin: '20px auto', width: W }}>
        <svg width={W} height={H} style={{ background: '#07090f', borderRadius: 8, border: '1px solid #1e2533' }}>
          {samples.map((s, i) => {
            const ex = (s.expected.x / window.innerWidth)  * W
            const ey = (s.expected.y / window.innerHeight) * H
            const mx = (s.measured.x / window.innerWidth)  * W
            const my = (s.measured.y / window.innerHeight) * H
            return (
                <g key={i}>
                  <line x1={ex} y1={ey} x2={mx} y2={my} stroke="#ff4567" strokeWidth="1" opacity="0.6" />
                  <circle cx={ex} cy={ey} r={4} fill="#3dffa0" />
                  <circle cx={mx} cy={my} r={3} fill="#ff4567" opacity="0.8" />
                </g>
            )
          })}
        </svg>
        <div style={{ fontSize: 10, color: '#445', textAlign: 'center', marginTop: 6 }}>
          <span style={{ color: '#3dffa0' }}>●</span> ожидаемое &nbsp;
          <span style={{ color: '#ff4567' }}>●</span> измеренное
        </div>
      </div>
  )
}

function CheckItem({ children }) {
  return (
      <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10,
        color: 'var(--text-dim,#667)', fontSize: 13 }}>
        <span style={{ color: 'var(--mint,#3dffa0)', fontSize: 16, flexShrink: 0 }}>›</span>
        {children}
      </li>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  root: {
    width: '100%', height: '100%',
    background: 'var(--bg-void,#05080f)',
    position: 'relative', overflow: 'hidden',
    backgroundImage: `
      radial-gradient(ellipse at 50% 50%, rgba(61,255,160,0.03) 0%, transparent 70%),
      linear-gradient(rgba(30,37,51,0.4) 1px, transparent 1px),
      linear-gradient(90deg, rgba(30,37,51,0.4) 1px, transparent 1px)
    `,
    backgroundSize: 'auto, 60px 60px, 60px 60px',
  },
  card: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)',
    background: 'var(--bg-panel,#0a0f1a)',
    border: '1px solid #1e2533', borderRadius: 12,
    padding: 44, width: 500, animation: 'fade-in 0.4s ease',
  },
  title: {
    fontFamily: 'monospace', fontSize: 20, fontWeight: 700,
    color: '#c8d0e0', marginBottom: 14, textAlign: 'center',
  },
  desc: { color: '#667', fontSize: 13, lineHeight: 1.7, marginBottom: 20, textAlign: 'center' },
  checklist: {
    listStyle: 'none', marginBottom: 24,
    background: '#07090f', borderRadius: 8,
    padding: '14px 18px', border: '1px solid #1e2533',
  },
  errBox: {
    marginBottom: 14, padding: '10px 14px',
    background: 'rgba(255,69,103,0.1)', border: '1px solid rgba(255,69,103,0.3)',
    borderRadius: 8, color: '#ff4567', fontSize: 12,
  },
  btn: {
    display: 'block', width: '100%', padding: 14, marginTop: 0,
    background: 'transparent', border: '1px solid var(--mint,#3dffa0)',
    borderRadius: 6, color: 'var(--mint,#3dffa0)',
    fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.08em',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  camOk: {
    marginTop: 14, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, color: 'var(--mint,#3dffa0)', fontSize: 12,
  },
  dot: {
    display: 'inline-block', width: 7, height: 7,
    borderRadius: '50%', background: 'var(--mint,#3dffa0)',
    boxShadow: '0 0 6px var(--mint,#3dffa0)',
  },
  topBar: {
    position: 'fixed', top: 0, left: 0, right: 0,
    background: '#0a0f1a', borderBottom: '1px solid #1e2533',
    padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16, zIndex: 100,
  },
  topBarText: { color: '#667', fontSize: 12, letterSpacing: '0.05em', flexShrink: 0, minWidth: 360 },
  progressWrap: { flex: 1, height: 3, background: '#07090f', borderRadius: 2, overflow: 'hidden' },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg,rgba(61,255,160,0.4),#3dffa0)',
    borderRadius: 2, transition: 'width 0.4s ease',
  },
  progressLabel: { color: 'var(--mint,#3dffa0)', fontSize: 11, fontWeight: 500, flexShrink: 0 },
  counter: {
    position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
    background: '#0a0f1a', border: '1px solid #1e2533', borderRadius: 8,
    padding: '8px 20px', fontSize: 11, color: '#667', letterSpacing: '0.06em', zIndex: 100,
  },
  resultIcon: {
    width: 64, height: 64, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 700, color: '#000',
    margin: '0 auto 20px', boxShadow: '0 0 30px rgba(61,255,160,0.2)',
  },
}