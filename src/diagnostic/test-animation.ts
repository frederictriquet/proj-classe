// [SPEC-10 V9] PixiJS test animation with a frame-rate counter, used by the diagnostic
// page and by the test window opened on the other screen.
import { Application, Graphics, GraphicsContext } from 'pixi.js'
import { FpsMeter, type FpsStats } from './fps-meter'

const COLORS = ['#7CC36A', '#F4C430', '#E8743B', '#5B8DEF', '#FFFFFF', '#C25B9C']
const SHAPE_COUNT = 400

export interface TestAnimation {
  stop(): void
}

interface Mover {
  shape: Graphics
  vx: number
  vy: number
  spin: number
}

export function formatFps(stats: FpsStats): string {
  if (stats.current === undefined) return 'mesure en cours…'
  const min = stats.min === undefined ? '' : ` · minimum ${Math.round(stats.min)}`
  return `${Math.round(stats.current)} images/s${min}`
}

export async function startTestAnimation(
  stage: HTMLElement,
  onStats: (stats: FpsStats) => void,
): Promise<TestAnimation> {
  const app = new Application()
  await app.init({
    resizeTo: stage,
    background: '#2E6B3F',
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
    preference: 'webgl',
  })
  stage.prepend(app.canvas)

  const overlay = document.createElement('div')
  overlay.className = 'fps-overlay'
  overlay.textContent = 'mesure en cours…'
  stage.append(overlay)

  const contexts = COLORS.map((color) => new GraphicsContext().circle(0, 0, 1).fill(color))
  const blobs = COLORS.map((color) => new GraphicsContext().roundRect(-1, -0.6, 2, 1.2, 0.5).fill(color))
  const movers: Mover[] = []
  for (let i = 0; i < SHAPE_COUNT; i++) {
    const shape = new Graphics(i % 3 === 0 ? blobs[i % blobs.length] : contexts[i % contexts.length])
    shape.scale.set(10 + Math.random() * 40)
    shape.position.set(Math.random() * app.screen.width, Math.random() * app.screen.height)
    shape.alpha = 0.85
    app.stage.addChild(shape)
    const speed = 20 + Math.random() * 60
    const angle = Math.random() * Math.PI * 2
    movers.push({ shape, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, spin: (Math.random() - 0.5) * 0.6 })
  }

  const meter = new FpsMeter()
  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000
    const { width, height } = app.screen
    for (const m of movers) {
      const p = m.shape.position
      p.x += m.vx * dt
      p.y += m.vy * dt
      if (p.x < 0 || p.x > width) m.vx = -m.vx
      if (p.y < 0 || p.y > height) m.vy = -m.vy
      m.shape.rotation += m.spin * dt
    }
    const before = meter.value.windows
    const stats = meter.frame(performance.now())
    if (stats.windows !== before) {
      overlay.textContent = formatFps(stats)
      onStats(stats)
    }
  })

  return {
    stop() {
      // Contexts are shared between shapes: destroy them once, after the shapes.
      app.destroy({ removeView: true }, { children: true })
      for (const ctx of [...contexts, ...blobs]) ctx.destroy()
      overlay.remove()
    },
  }
}
