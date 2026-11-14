// [SPEC-4.7] Checks the needs declared by an app before it starts. Each need has its own check:
// a need without one is a type error, so no need is ever considered met by default.
import { micErrorText } from '../audio/mic-errors'
import type { AppNeed } from '../apps/types'

/** Resolves with a French message saying what to do, or undefined when the need is met. */
type NeedCheck = () => Promise<string | undefined>

/** Minimal microphone check: open it, release it at once. The sound-level service task
 *  (SPEC-6) will keep the stream instead of opening the microphone twice. */
async function checkMicrophone(): Promise<string | undefined> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Ce navigateur ne donne pas accès au micro. Ouvrez l'application dans Chrome, puis relancez l'activité."
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    for (const track of stream.getTracks()) track.stop()
    return undefined
  } catch (error) {
    return `L'activité a besoin du micro et ne peut pas démarrer.\n${micErrorText(error)}`
  }
}

const NEED_CHECKS: Record<AppNeed, NeedCheck> = {
  microphone: checkMicrophone,
}

export async function checkNeeds(needs: readonly AppNeed[]): Promise<string | undefined> {
  for (const need of needs) {
    const message = await NEED_CHECKS[need]()
    if (message !== undefined) return message
  }
  return undefined
}
