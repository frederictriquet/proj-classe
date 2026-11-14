// Placeholder home until the menu task lands. [SPEC-3.5] « Installer » button in a Chrome tab.
import { isInstalledApp } from './pwa/display-mode'
import { canInstall, onInstallAvailabilityChange, promptInstall } from './pwa/install'
import { errorMessage } from './pwa/register'

export function renderHome(root: HTMLElement): () => void {
  const home = document.createElement('section')
  home.className = 'home'
  const icon = document.createElement('img')
  icon.src = `${import.meta.env.BASE_URL}icon.svg`
  icon.alt = ''
  const title = document.createElement('h1')
  title.textContent = 'Proj-Classe'
  const subtitle = document.createElement('p')
  subtitle.textContent = 'Les activités arrivent bientôt.'
  const install = document.createElement('button')
  install.type = 'button'
  install.className = 'install'
  install.textContent = 'Installer'
  const message = document.createElement('p')
  const link = document.createElement('a')
  link.className = 'discreet-link'
  link.href = '#diagnostic'
  link.textContent = 'Diagnostic'
  home.append(icon, title, subtitle, install, message, link)
  root.append(home)

  const show = () => {
    install.hidden = isInstalledApp() || !canInstall()
  }
  install.addEventListener('click', () => {
    promptInstall().then(
      (outcome) => {
        message.textContent = outcome === 'accepted' ? 'Installation en cours.' : 'Installation annulée.'
      },
      (error: unknown) => {
        message.textContent = `Installation impossible : ${errorMessage(error)}`
      },
    )
  })
  show()
  const off = onInstallAvailabilityChange(show)
  return () => {
    off()
    home.remove()
  }
}
