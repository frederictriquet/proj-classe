// [SPEC-4.2] [SPEC-13] « Ruche du silence »: the apiary, its fifteen bees, its two butterflies and
// the honey of the reward, run by the shared loop of the activities of silence [SPEC-9.8]. Every
// frame the difference to the ambient noise [SPEC-6.4] feeds the shared calm logic [SPEC-9.4],
// whose outputs set what each animal does, the reward [SPEC-13.4] and the mini sound meter
// [SPEC-9.7]. `stop()` releases the loop, the textures and, through the host, the microphone
// [SPEC-6.7].
import { startSilence } from '../../silence/app'
import type { AppFactory } from '../types'
import { RUCHE } from './world'

export const start: AppFactory = (context) => startSilence(context, RUCHE)
