import { useEffect, useRef } from 'react'

// Цветовая карта: Синий (редко) -> Зеленый -> Желтый -> Красный (часто)
const LUT_SIZE = 256
const LUT = Array.from({ length: LUT_SIZE }, (_, i) => {
  const t = i / (LUT_SIZE - 1)
  // Алгоритм градиента "Rainbow"
  const r = t > 0.5 ? Math.min(255, Math.floor(510 * (t - 0.5))) : 0
  const g = t < 0.5 ? Math.min(255, Math.floor(510 * t)) : Math.min(255, Math.floor(510 * (1 - t)))
  const b = t < 0.5 ? Math.min(255, Math.floor(510 * (0.5 - t))) : 0
  return { r, g, b }
})

export default function GazeHeatmap({ gazePoints, width, height, visible }) {
  const canvasRef = useRef(null)
  const SCALE = 0.5 // Оставляем для скорости

  useEffect(() => {
    if (!visible || !canvasRef.current || !gazePoints.length) return

    const canvas = canvasRef.current
    const w = Math.floor(width * SCALE)
    const h = Math.floor(height * SCALE)
    canvas.width = w; canvas.height = h

    const ctx = canvas.getContext('2d', { alpha: true })
    renderHeatmap(ctx, gazePoints, w, h, SCALE)
  }, [gazePoints, width, height, visible])

  return (
      <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
            opacity: visible ? 0.8 : 0, // Небольшая прозрачность для сайта
            transition: 'opacity 0.4s ease',
            zIndex: 50,
          }}
      />
  )
}

function renderHeatmap(ctx, points, width, height, scale) {
  const RADIUS = 30
  const buffer = document.createElement('canvas')
  buffer.width = width
  buffer.height = height
  const bctx = buffer.getContext('2d')

  // 1. Рисуем "плотность" через радиальные градиенты
  bctx.globalCompositeOperation = 'lighter'
  points.forEach(p => {
    const gx = p.x * scale
    const gy = p.y * scale
    const grad = bctx.createRadialGradient(gx, gy, 0, gx, gy, RADIUS)
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.2)') // Очень мягкое наслоение
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    bctx.fillStyle = grad
    bctx.fillRect(gx - RADIUS, gy - RADIUS, RADIUS * 2, RADIUS * 2)
  })

  // 2. Раскрашиваем через LUT
  const imgData = bctx.getImageData(0, 0, width, height)
  const data = imgData.data
  const outData = ctx.createImageData(width, height)

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i] // Берем интенсивность из красного канала (т.к. рисовали белым)
    if (alpha > 0) {
      const color = LUT[Math.min(255, alpha * 2)] // Коэффициент усиления цвета
      outData.data[i] = color.r
      outData.data[i + 1] = color.g
      outData.data[i + 2] = color.b
      outData.data[i + 3] = alpha * 1.5
    }
  }
  ctx.putImageData(outData, 0, 0)
}