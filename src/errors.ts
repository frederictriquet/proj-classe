/** Human-readable text for any thrown value, shown to the adult in the interface. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name} : ${error.message}`
  return String(error)
}
