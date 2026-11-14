// [SPEC-3.9.3] Fallback screen of the bootstrap, shown when the app does not start. Plain DOM with
// inline styles: style.css comes with the app, which may be the part that failed.
import { errorMessage } from '../errors'

/** [SPEC-3.9.3] Word for word from the spec. */
export const FALLBACK_INSTRUCTION =
  "L'application a rencontré un problème. Connectez le Mac à internet puis relancez-la."

/** Id of the fallback screen, looked for by the start-up test [SPEC-3.9.1]. */
export const FALLBACK_ID = 'startup-fallback'

function paragraph(text: string, style: string): HTMLParagraphElement {
  const element = document.createElement('p')
  element.textContent = text
  element.style.cssText = `margin:0;${style}`
  return element
}

/** Replaces the page with the instruction, the version in service and the cause of the failure. */
export function showFallbackScreen(versionLabel: string, error: unknown): void {
  if (document.getElementById(FALLBACK_ID)) return
  document.getElementById('app')?.replaceChildren()
  const banner = document.getElementById('error-banner')
  if (banner) banner.hidden = true

  const screen = document.createElement('div')
  screen.id = FALLBACK_ID
  screen.setAttribute('role', 'alert')
  screen.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'box-sizing:border-box',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:1.5rem',
    'padding:2rem',
    'background:#2E6B3F',
    'color:#fff',
    'font-family:system-ui,sans-serif',
    'text-align:center',
  ].join(';')
  screen.append(
    paragraph(FALLBACK_INSTRUCTION, 'font-size:2rem;max-width:40ch'),
    paragraph(`Version : ${versionLabel}`, 'font-size:1.25rem'),
    // The cause, for whoever fixes the app (a photo of the screen is enough).
    paragraph(`Détail : ${errorMessage(error)}`, 'font-size:0.9rem;opacity:0.8;max-width:60ch;overflow-wrap:anywhere'),
  )
  document.body.append(screen)
}
