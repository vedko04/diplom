import { useEffect, useRef } from 'react'

export default function GazeHeatmap({ gazePoints, width, height, visible }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!visible || !canvasRef.current || gazePoints.length === 0) return

    const canvas = canvasRef.current
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)

    drawHeatmap(ctx, gazePoints, width, height)
  }, [gazePoints, width, height, visible])

  return (
      <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.5s ease',
            zIndex: 50,
          }}
      />
  )
}

// ─────────────────────────────────────────────────────────────────
// Улучшенная цветовая палитра с плавными переходами
// Вдохновлено профессиональными eye-tracking решениями
// ─────────────────────────────────────────────────────────────────
const COLOR_STOPS = [
  { t: 0.00, r:   0, g:   0, b:   0, a: 0.00 },   // Полностью прозрачный
  { t: 0.08, r:  30, g:  50, b: 150, a: 0.35 },   // Глубокий синий
  { t: 0.20, r:  20, g: 130, b: 200, a: 0.50 },   // Синий
  { t: 0.35, r:  10, g: 180, b: 220, a: 0.60 },   // Голубой
  { t: 0.48, r:  30, g: 210, b: 150, a: 0.68 },   // Бирюзовый
  { t: 0.58, r:  80, g: 230, b:  90, a: 0.74 },   // Зелёный
  { t: 0.68, r: 180, g: 240, b:  40, a: 0.78 },   // Жёлто-зелёный
  { t: 0.78, r: 250, g: 210, b:  20, a: 0.82 },   // Жёлтый
  { t: 0.86, r: 255, g: 150, b:  10, a: 0.86 },   // Оранжевый
  { t: 0.93, r: 255, g:  80, b:  20, a: 0.90 },   // Красно-оранжевый
  { t: 1.00, r: 240, g:  20, b:  40, a: 0.94 },   // Яркий красный
]

function heatColor(t) {
  // Находим два соседних стопа и интерполируем
  let lo = COLOR_STOPS[0]
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1]

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (t >= COLOR_STOPS[i].t && t <= COLOR_STOPS[i + 1].t) {
      lo = COLOR_STOPS[i]
      hi = COLOR_STOPS[i + 1]
      break
    }
  }

  // Нормализуем t внутри сегмента
  const span = hi.t - lo.t
  const f    = span < 1e-9 ? 0 : (t - lo.t) / span

  // Плавная S-кривая (smoothstep) для устранения резких границ
  const s = f * f * (3 - 2 * f)

  return [
    Math.round(lo.r + (hi.r - lo.r) * s),
    Math.round(lo.g + (hi.g - lo.g) * s),
    Math.round(lo.b + (hi.b - lo.b) * s),
    lo.a + (hi.a - lo.a) * s,
  ]
}

// ─────────────────────────────────────────────────────────────────
// Улучшенный рендеринг тепловой карты с размытием
// ─────────────────────────────────────────────────────────────────
function drawHeatmap(ctx, points, width, height) {
  const RADIUS  = 20    // Увеличенный радиус для более плавных переходов
  const BLUR    = 20    // Радиус размытия
  const OPACITY = 0.5  // Финальная прозрачность

  // ── Шаг 1: создаём карту интенсивности с улучшенным градиентом
  const alphaCanvas = document.createElement('canvas')
  alphaCanvas.width  = width
  alphaCanvas.height = height
  const aCtx = alphaCanvas.getContext('2d', { willReadFrequently: true })

  aCtx.globalCompositeOperation = 'lighter' // Более яркое наложение

  points.forEach(({ x, y }) => {
    // Улучшенное Гауссово ядро с более плавными переходами
    const grd = aCtx.createRadialGradient(x, y, 0, x, y, RADIUS)

    // Профессиональное распределение интенсивности
    grd.addColorStop(0.00, 'rgba(255,255,255,0.35)')  // Яркий центр
    grd.addColorStop(0.10, 'rgba(255,255,255,0.28)')
    grd.addColorStop(0.25, 'rgba(255,255,255,0.18)')
    grd.addColorStop(0.40, 'rgba(255,255,255,0.12)')
    grd.addColorStop(0.55, 'rgba(255,255,255,0.08)')
    grd.addColorStop(0.70, 'rgba(255,255,255,0.04)')
    grd.addColorStop(0.85, 'rgba(255,255,255,0.015)')
    grd.addColorStop(1.00, 'rgba(255,255,255,0.00)')  // Плавный переход к нулю

    aCtx.fillStyle = grd
    aCtx.beginPath()
    aCtx.arc(x, y, RADIUS, 0, Math.PI * 2)
    aCtx.fill()
  })

  // ── Шаг 2: применяем размытие для ещё более плавного эффекта
  aCtx.filter = `blur(${BLUR}px)`
  aCtx.drawImage(alphaCanvas, 0, 0)
  aCtx.filter = 'none'

  // ── Шаг 3: читаем интенсивность
  const imgData   = aCtx.getImageData(0, 0, width, height)
  const colorData = ctx.createImageData(width, height)
  const pxCount   = width * height

  // ── Шаг 4: динамическая нормализация по 98-му перцентилю
  const vals = []
  for (let i = 0; i < pxCount; i++) {
    const v = imgData.data[i * 4]
    if (v > 0) vals.push(v)
  }
  if (vals.length === 0) return

  vals.sort((a, b) => a - b)
  const p98 = vals[Math.floor(vals.length * 0.98)] || vals[vals.length - 1]
  const min = vals[0]

  // ── Шаг 5: применяем цветовую палитру с улучшенным маппингом
  for (let i = 0; i < pxCount; i++) {
    const raw = imgData.data[i * 4]
    if (raw < min * 0.05) continue // Игнорируем очень слабые значения

    // Нелинейная нормализация для лучшего контраста
    let t = Math.min(1, (raw - min) / (p98 - min))

    // Применяем степенную функцию для усиления контраста в средних тонах
    t = Math.pow(t, 0.75)

    const [r, g, b, a] = heatColor(t)

    const idx = i * 4
    colorData.data[idx]     = r
    colorData.data[idx + 1] = g
    colorData.data[idx + 2] = b
    colorData.data[idx + 3] = Math.round(a * 255 * OPACITY)
  }

  // ── Шаг 6: рендерим финальную карту
  ctx.putImageData(colorData, 0, 0)

  // ── Шаг 7: опциональное лёгкое размытие для идеально плавных переходов
  ctx.filter = 'blur(1px)'
  ctx.drawImage(ctx.canvas, 0, 0)
  ctx.filter = 'none'
}