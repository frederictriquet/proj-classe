// [SPEC-6.6] [SPEC-4.7] French explanation of a microphone failure, with what to do.
import { errorMessage } from '../errors'

const MACOS_PRIVACY = 'Réglages Système > Confidentialité et sécurité > Micro > Google Chrome'

export function micErrorText(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  const detail = errorMessage(error)
  switch (name) {
    case 'NotAllowedError':
      // Chrome says "Permission denied by system" when macOS, not the site setting, refuses.
      if (/system/i.test(error instanceof DOMException ? error.message : '')) {
        return `macOS refuse le micro à Chrome. Ouvrez ${MACOS_PRIVACY}, cochez Google Chrome, relancez Chrome puis l'activité.\n${detail}`
      }
      return `Autorisation refusée. Cliquez sur l'icône à gauche de l'adresse (ou dans la barre de l'application), autorisez le micro, puis réessayez.\n${detail}`
    case 'NotFoundError':
      return `Aucun micro trouvé. Vérifiez Réglages Système > Son > Entrée.\n${detail}`
    case 'NotReadableError':
      return `Le micro est inaccessible (utilisé par une autre application ou bloqué par macOS : ${MACOS_PRIVACY}).\n${detail}`
    default:
      return detail
  }
}

/** [SPEC-6.6] The microphone track ended by itself while in use. */
export const MIC_LOST_TEXT =
  "Micro perdu en cours de route (débranché, coupé par macOS ou autorisation retirée). Vérifiez Réglages Système > Son > Entrée et l'autorisation du micro, puis relancez l'activité."

export const NO_MIC_API_TEXT =
  "Ce navigateur ne donne pas accès au micro. Ouvrez l'application dans Chrome, puis relancez l'activité."
