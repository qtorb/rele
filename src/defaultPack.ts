import type { ProjectPack } from './types'

/**
 * Semilla UXM. No es dato canónico: es un punto de partida editable
 * para que la primera sesión no arranque contra una pantalla vacía.
 */
export const defaultPack: ProjectPack = {
  project: 'UXM v3',
  destination: 'Beta externa con informe usable, sin perder control operativo antes del hito.',
  currentWaypoint:
    'Cerrar un frente ejecutable cada vez, con READ ONLY antes de WRITE y sin despliegue si el gate no está explícito.',
  nextSeat: 'Builder',
  blockingGates: [
    'No desplegar sin árbol limpio y turno de despliegue explícito.',
    'No abrir frente nuevo si el frente vivo no tiene veredicto.',
  ],
  liveRules: [
    'READ ONLY diagnostica; WRITE ejecuta solo lo autorizado.',
    'Un relevo no crea decisión canónica por sí solo.',
    'El gate prueba el fin, no el medio.',
  ],
  liveRisks: [
    'Convertir un bloqueo del builder en permiso para improvisar.',
    'Aceptar una revisión como contrato sin aceptación explícita.',
  ],
  parked: ['Motor de captura / admisión / carril externo: fuera de alcance hasta el hito.'],
  updatedAt: '',
}

export const emptyPack: ProjectPack = {
  project: '',
  destination: '',
  currentWaypoint: '',
  nextSeat: '',
  blockingGates: [],
  liveRules: [],
  liveRisks: [],
  parked: [],
  updatedAt: '',
}
