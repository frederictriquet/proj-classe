// [SPEC-3.5] In a Chrome tab, offer an « Installer » button driven by `beforeinstallprompt`.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferredPrompt: BeforeInstallPromptEvent | undefined
let promptReceived = false
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function listenForInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    promptReceived = true
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = undefined
    notify()
  })
}

export function canInstall(): boolean {
  return deferredPrompt !== undefined
}

/** True once Chrome has signalled that the app meets its installability criteria. */
export function installPromptReceived(): boolean {
  return promptReceived
}

export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function promptInstall(): Promise<'accepted' | 'dismissed'> {
  const event = deferredPrompt
  if (!event) throw new Error("L'installation n'est pas proposée par Chrome pour le moment.")
  deferredPrompt = undefined
  await event.prompt()
  const choice = await event.userChoice
  notify()
  return choice.outcome
}
