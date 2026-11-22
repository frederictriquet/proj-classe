// [SPEC-4.2] [SPEC-16] « Hiver du silence »: the winter landscape, its eleven characters and the lit
// Christmas tree, run by the shared loop of the activities of silence [SPEC-9.8].
import { startSilence } from '../../silence/app'
import type { AppFactory } from '../types'
import { HIVER } from './world'

export const start: AppFactory = (context) => startSilence(context, HIVER)
