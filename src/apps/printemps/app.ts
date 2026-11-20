// [SPEC-4.2] [SPEC-17] « Printemps du silence »: the spring meadow, its ten characters and the cherry
// tree in blossom, run by the shared loop of the activities of silence [SPEC-9.8].
import { startSilence } from '../../silence/app'
import type { AppFactory } from '../types'
import { PRINTEMPS } from './world'

export const start: AppFactory = (context) => startSilence(context, PRINTEMPS)
