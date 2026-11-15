// [SPEC-9.7] [SPEC-8.3.2] [SPEC-9.8] The mini sound meter drawn with PixiJS, in screen pixels (not
// in the world units of the decor): a narrow vertical bar at the bottom left, its fill at the live
// difference to the ambient noise, a mark at the alert threshold and one at the flight threshold,
// both edged with ink. The colours come from the activity's palette. A readout for the adult, not
// a control [SPEC-4.4]. Each frame only moves and scales the pieces; the bar is redrawn on resize
// only.
import { Container, Graphics } from 'pixi.js'
import { METER, meterFraction, meterMarks } from './meter'

/** [SPEC-8.3] Colours of the meter, from the activity's palette. */
export interface MeterColors {
  /** Track (see-through) and edges of the marks. */
  ink: string
  /** Fill at the live level. */
  level: string
  /** Mark at the alert threshold; edged with ink, so it shows on any decor. */
  alert: string
  /** Mark at the flight threshold. */
  flee: string
}

export interface MeterView {
  /** Add this to the stage, over the decor. */
  readonly root: Container
  /** [SPEC-8.6] Places the bar for a screen of this size, in CSS pixels. */
  resize(width: number, height: number): void
  /** Shows the level and the marks of the current sensitivity, both in dB above the ambient noise. */
  update(aboveAmbientDb: number, alertDb: number): void
}

export function createMeter(colors: MeterColors): MeterView {
  const root = new Container({ label: 'sound-meter' })
  const track = new Graphics()
  // One pixel high, from y = -1 to 0: scaled to the level, it grows up from the bottom of the bar.
  const fill = new Graphics().rect(0, -1, METER.width, 1).fill({ color: colors.level, alpha: 0.9 })
  const mark = (color: string) => {
    const { markOverhang: overhang, markThickness: thickness, markBorder: border } = METER
    const length = METER.width + 2 * overhang
    return new Graphics()
      .rect(-overhang - border, -thickness / 2 - border, length + 2 * border, thickness + 2 * border)
      .fill(colors.ink)
      .rect(-overhang, -thickness / 2, length, thickness)
      .fill(color)
  }
  const alertMark = mark(colors.alert)
  const fleeMark = mark(colors.flee)
  root.addChild(track, fill, alertMark, fleeMark)

  let barHeight = 0
  return {
    root,
    resize(_width, height) {
      barHeight = Math.round(height * METER.heightShare)
      root.position.set(METER.margin, Math.round(height - METER.margin - barHeight))
      track.clear().rect(0, 0, METER.width, barHeight).fill({ color: colors.ink, alpha: 0.35 })
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
