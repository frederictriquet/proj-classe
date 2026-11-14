// [SPEC-5.3] [SPEC-5.4] [SPEC-10 V4] [SPEC-10 V9] Test window opened on the other screen:
// full-screen animation, frame rate reported back to the diagnostic page.
import { errorMessage } from '../errors'
import { DIAGNOSTIC_CHANNEL, type SceneTestMessage } from './channel'
import type { FpsStats } from './fps-meter'
import { formatFps, startTestAnimation, type TestAnimation } from './test-animation'

export function renderSceneTest(root: HTMLElement): () => void {
  document.title = 'Proj-Classe : fenêtre d’essai'
  const scene = document.createElement('div')
  scene.className = 'scene-test'
  const stage = document.createElement('div')
  stage.className = 'anim-stage'
  const prompt = document.createElement('button')
  prompt.type = 'button'
  prompt.className = 'fullscreen-prompt primary'
  prompt.textContent = 'Cliquer ici pour passer en plein écran'
  scene.append(stage, prompt)
  root.append(scene)

  const channel = new BroadcastChannel(DIAGNOSTIC_CHANNEL)
  let stats: FpsStats = { current: undefined, min: undefined, windows: 0 }
  let failure: string | undefined
  let animation: TestAnimation | undefined

  const isFullscreen = () => document.fullscreenElement !== null
  const send = () => {
    const message: SceneTestMessage = {
      type: 'scene-test-status',
      fullscreen: isFullscreen(),
      fps: failure ?? formatFps(stats),
      minFps: stats.min,
      width: window.innerWidth,
      height: window.innerHeight,
    }
    channel.postMessage(message)
  }
  const showPrompt = () => {
    prompt.hidden = isFullscreen()
    send()
  }

  prompt.addEventListener('click', () => {
    // [SPEC-5.4] Fallback when Chrome did not open the window full screen.
    document.documentElement.requestFullscreen().catch((error: unknown) => {
      prompt.textContent = `Plein écran impossible : ${errorMessage(error)}`
    })
  })
  document.addEventListener('fullscreenchange', showPrompt)
  const timer = window.setInterval(send, 1000)
  const onHide = () => channel.postMessage({ type: 'scene-test-closed' } satisfies SceneTestMessage)
  window.addEventListener('pagehide', onHide)

  startTestAnimation(stage, (next) => {
    stats = next
    send()
  }).then(
    (started) => {
      animation = started
    },
    (error: unknown) => {
      failure = `Animation impossible : ${errorMessage(error)}`
      prompt.textContent = failure
      send()
    },
  )
  showPrompt()

  return () => {
    clearInterval(timer)
    document.removeEventListener('fullscreenchange', showPrompt)
    window.removeEventListener('pagehide', onHide)
    animation?.stop()
    channel.close()
    scene.remove()
  }
}
