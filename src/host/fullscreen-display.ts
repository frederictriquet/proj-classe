// [SPEC-4.6] [SPEC-5.2] Single-screen display: the app runs in a stage that covers the window
// and goes full screen. Escape, or leaving full screen in any other way, goes back to the menu.
import { errorMessage } from '../errors'
import type { HostDisplay, OpenedDisplay } from './host'

export class FullscreenDisplay implements HostDisplay {
  private stage: HTMLElement | undefined
  private removeListeners: (() => void) | undefined

  /** @param onExit called when the adult leaves the app (Escape, end of full screen). */
  constructor(private readonly onExit: () => void) {}

  open(): Promise<OpenedDisplay> {
    this.close()
    const stage = document.createElement('div')
    stage.className = 'app-stage'
    stage.tabIndex = -1
    document.body.append(stage)
    this.stage = stage
    // Keys now go to the stage, not to the menu tile underneath.
    stage.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      this.onExit()
    }
    let entered = false
    const onFullscreenChange = () => {
      if (document.fullscreenElement === stage) entered = true
      else if (entered) this.onExit()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    this.removeListeners = () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }

    // Requested synchronously by the host: the gesture that launched the app is still active.
    return stage.requestFullscreen({ navigationUI: 'hide' }).then(
      () => ({ container: stage }),
      (error: unknown) => ({
        container: stage,
        warning: `Le plein écran a été refusé : l'activité s'est affichée dans la fenêtre.\n${errorMessage(error)}`,
      }),
    )
  }

  close(): void {
    this.removeListeners?.()
    this.removeListeners = undefined
    const stage = this.stage
    this.stage = undefined
    if (!stage) return
    if (document.fullscreenElement === stage) void document.exitFullscreen()
    stage.remove()
  }
}
