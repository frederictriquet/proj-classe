// [SPEC-6.6] [SPEC-4.7] French explanation of a getUserMedia failure, with what to do.
import { errorMessage } from '../errors'

export function micErrorText(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  const detail = errorMessage(error)
  switch (name) {
    case 'NotAllowedError':
      return `Autorisation refusée. Cliquez sur l'icône à gauche de l'adresse (ou dans la barre de l'application), autorisez le micro, puis réessayez.\n${detail}`
    case 'NotFoundError':
      return `Aucun micro trouvé. Vérifiez Réglages Système > Son > Entrée.\n${detail}`
    case 'NotReadableError':
      return `Le micro est inaccessible (utilisé par une autre application ou bloqué par macOS : Réglages Système > Confidentialité et sécurité > Micro > Google Chrome).\n${detail}`
    default:
      return detail
  }
}
