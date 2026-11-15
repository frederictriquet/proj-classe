// [SPEC-4.2] [SPEC-6] [SPEC-7] [SPEC-9] [SPEC-13] [SPEC-14] « Couvain du silence »: the incubator,
// its twenty eggs and chicks, and the mother-hen reward, run by the shared loop of the activities
// of silence [SPEC-9.8]. Every frame the difference to the ambient noise [SPEC-6.4] feeds the
// shared calm logic [SPEC-9.4], whose outputs drive each chick and its egg [SPEC-14.2.1]
// [SPEC-14.2.2], the reward [SPEC-9.5] [SPEC-14.4] and the mini sound meter [SPEC-9.7]. `stop()`
// releases the animation loop, the textures and, through the host, the microphone [SPEC-4.2]
// [SPEC-6.7].
import { startSilence } from '../../silence/app'
import type { AppFactory } from '../types'
import { COUVAIN } from './world'

export const start: AppFactory = (context) => startSilence(context, COUVAIN)
