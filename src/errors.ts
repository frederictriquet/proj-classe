/** Error whose message is already a French explanation for the adult (what happened, what to
 *  do): it is shown as is, without the technical error name. */
export class ExplainedError extends Error {
  override name = 'ExplainedError'
}

/** Human-readable text for any thrown value, shown to the adult in the interface. */
export function errorMessage(error: unknown): string {
  if (error instanceof ExplainedError) return error.message
  if (error instanceof Error) return `${error.name} : ${error.message}`
  return String(error)
}
