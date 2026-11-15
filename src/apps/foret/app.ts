// [SPEC-4.2] [SPEC-9] « Forêt du silence »: the clearing, its six animals and the fireflies, run by
// the shared loop of the activities of silence [SPEC-9.8].
import { startSilence } from '../../silence/app'
import type { AppFactory } from '../types'
import { FORET } from './world'

export const start: AppFactory = (context) => startSilence(context, FORET)
