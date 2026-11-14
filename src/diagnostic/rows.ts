import { errorMessage } from '../errors'

export type Status = 'ok' | 'warn' | 'error' | 'neutral'

export interface Row {
  readonly label: string
  set(text: string, status?: Status): void
  /** Adds an action button; a thrown error or rejected promise is shown in the row. */
  addButton(label: string, onClick: () => unknown, primary?: boolean): HTMLButtonElement
  text(): string
}

/** Tables of « label | value | actions » rows; every row can be exported as plain text. */
export class DiagnosticReport {
  private readonly rows: { section: string; row: Row }[] = []

  constructor(private readonly root: HTMLElement) {}

  section(title: string): (label: string) => Row {
    const heading = document.createElement('h2')
    heading.textContent = title
    const table = document.createElement('table')
    table.className = 'diag-table'
    const body = table.createTBody()
    this.root.append(heading, table)
    return (label: string) => {
      const row = createRow(body, label)
      this.rows.push({ section: title, row })
      return row
    }
  }

  asText(header: string): string {
    const lines = [header]
    let current = ''
    for (const { section, row } of this.rows) {
      if (section !== current) {
        lines.push('', `## ${section}`)
        current = section
      }
      lines.push(`- ${row.label} : ${row.text().replace(/\n/g, ' / ')}`)
    }
    return lines.join('\n')
  }
}

function createRow(body: HTMLTableSectionElement, label: string): Row {
  const tr = body.insertRow()
  const th = document.createElement('th')
  th.scope = 'row'
  th.textContent = label
  const value = tr.insertCell()
  value.className = 'value'
  const actions = tr.insertCell()
  actions.className = 'actions'
  tr.prepend(th)

  const row: Row = {
    label,
    set(text, status = 'neutral') {
      value.textContent = text
      value.className = `value status-${status}`
    },
    addButton(buttonLabel, onClick, primary = false) {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = buttonLabel
      if (primary) button.className = 'primary'
      button.addEventListener('click', () => {
        try {
          const result = onClick()
          if (result instanceof Promise) result.catch((error: unknown) => row.set(`Erreur : ${errorMessage(error)}`, 'error'))
        } catch (error) {
          row.set(`Erreur : ${errorMessage(error)}`, 'error')
        }
      })
      actions.append(button)
      return button
    },
    text() {
      return value.textContent ?? ''
    },
  }
  row.set('…')
  return row
}
