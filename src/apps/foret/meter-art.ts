// [SPEC-9.7] [SPEC-8.3.2] The mini sound meter drawn with PixiJS, in screen pixels (not in the
// world units of the clearing): a narrow vertical bar at the bottom left, its fill at the live
// difference to the ambient noise, a `sun` mark at the alert threshold and an `orange` one at the
// flight threshold, both edged with `ink`. A readout for the adult, not a control [SPEC-4.4]. Each frame only moves and
// scales the pieces; the bar is redrawn on resize only.
import { Container, Graphics } from 'pixi.js'
import { PALETTE } from '../../art/palette'
import { METER, meterFraction, meterMarks } from './meter'

export interface MeterView {
  /** Add this to the stage, over the clearing. */
  readonly root: Container
  /** [SPEC-8.6] Places the bar for a screen of this size, in CSS pixels. */
  resize(width: number, height: number): void
  /** Shows the level and the marks of the current sensitivity, both in dB above the ambient noise. */
  update(aboveAmbientDb: number, alertDb: number): void
}

export function createMeter(): MeterView {
  const root = new Container({ label: 'sound-meter' })
  const track = new Graphics()
  // One pixel high, from y = -1 to 0: scaled to the level, it grows up from the bottom of the bar.
  const fill = new Graphics().rect(0, -1, METER.width, 1).fill({ color: PALETTE.cream, alpha: 0.9 })
  const mark = (color: string) => {
    const { markOverhang: overhang, markThickness: thickness, markBorder: border } = METER
    const length = METER.width + 2 * overhang
    return new Graphics()
      .rect(-overhang - border, -thickness / 2 - border, length + 2 * border, thickness + 2 * border)
      .fill(PALETTE.ink)
      .rect(-overhang, -thickness / 2, length, thickness)
      .fill(color)
  }
  const alertMark = mark(PALETTE.sun)
  const fleeMark = mark(PALETTE.orange)
  root.addChild(track, fill, alertMark, fleeMark)

  let barHeight = 0
  return {
    root,
    resize(_width, height) {
      barHeight = Math.round(height * METER.heightShare)
      root.position.set(METER.margin, Math.round(height - METER.margin - barHeight))
      track.clear().rect(0, 0, METER.width, barHeight).fill({ color: PALETTE.ink, alpha: 0.35 })
      fill.y = barHeight
    },
    update(aboveAmbientDb, alertDb) {
      fill.scale.y = meterFraction(aboveAmbientDb) * barHeight
      const marks = meterMarks(alertDb)
      alertMark.y = Math.round(barHeight * (1 - marks.alert))
      fleeMark.y = Math.round(barHeight * (1 - marks.flee))
    },
  }
}
