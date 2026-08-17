import { isPackListField } from '../types'
import type { MemoryUpdate, ProjectPack } from '../types'

/**
 * Aplica una propuesta de memoria sobre el Pack. Devuelve un Pack nuevo.
 * Solo se llama tras confirmación explícita en la UI.
 */
export function applyMemoryUpdate(pack: ProjectPack, update: MemoryUpdate): ProjectPack {
  if (isPackListField(update.field)) {
    const current = pack[update.field]
    let next: string[]
    if (update.action === 'remove') {
      next = current.filter((item) => item !== update.value)
    } else if (update.action === 'replace') {
      next = [update.value]
    } else {
      next = current.includes(update.value) ? current : [...current, update.value]
    }
    return { ...pack, [update.field]: next }
  }

  if (update.action === 'remove') {
    return { ...pack, [update.field]: '' }
  }
  return { ...pack, [update.field]: update.value }
}
