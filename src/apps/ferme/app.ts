// [SPEC-4.2] [SPEC-12] « Ferme du silence »: the farmyard, its eight animals and the rainbow, run
// by the shared loop of the activities of silence [SPEC-9.8].
import { startSilence } from '../../silence/app'
import type { AppFactory } from '../types'
import { FERME } from './world'

export const start: AppFactory = (context) => startSilence(context, FERME)
