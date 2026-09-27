import { useApi } from '~/shared/composables/useApi'
import type { Aviso } from '~/shared/types/api'

/** Cada cuánto se vuelve a preguntar mientras la pestaña está a la vista. */
const INTERVALO_MS = 60_000

interface Respuesta {
  data: Aviso[]
  resumen: { sin_leer: number, urgentes: number }
}

/**
 * Avisos del mostrador.
 *
 * Se consultan por sondeo, no por websocket. Un aviso de caducidad se
 * levanta cada media hora en el servidor: enterarse un minuto después es
 * indistinguible de enterarse al instante, y un canal en tiempo real
 * traería Redis, un servidor de sockets y una pieza más que puede caerse
 * a media venta. Si algún día hay avisos que de verdad no pueden esperar,
 * se cambia aquí dentro sin tocar la campanita.
 *
 * El sondeo se detiene cuando la pestaña no está a la vista: una terminal
 * olvidada abierta toda la noche no tiene por qué preguntar mil veces.
 */
export function useNotifications() {
  const api = useApi()

  const avisos = ref<Aviso[]>([])
  const sinLeer = ref(0)
  const urgentes = ref(0)
  const cargando = ref(false)

  let temporizador: ReturnType<typeof setInterval> | null = null

  async function cargar(): Promise<void> {
    if (cargando.value) return

    cargando.value = true

    try {
      const r = await api.get<Respuesta>('/notifications')
      avisos.value = r.data
      sinLeer.value = r.resumen.sin_leer
      urgentes.value = r.resumen.urgentes
    } catch {
      // Un aviso que no cargó no es motivo de alarma en pantalla: la
      // campanita se queda como estaba y se reintenta al siguiente ciclo.
    } finally {
      cargando.value = false
    }
  }

  async function atender(id: string): Promise<void> {
    // Se quita de inmediato y luego se confirma: esperar al servidor para
    // que desaparezca un renglón que ya se leyó se siente roto.
    avisos.value = avisos.value.filter(a => a.id !== id)
    sinLeer.value = Math.max(0, sinLeer.value - 1)

    try {
      await api.post(`/notifications/${id}/read`)
    } catch {
      await cargar()
    }
  }

  async function atenderTodo(): Promise<void> {
    avisos.value = []
    sinLeer.value = 0
    urgentes.value = 0

    try {
      await api.post('/notifications/read-all')
    } catch {
      await cargar()
    }
  }

  /** Fuerza una revisión en el servidor y recarga. */
  async function revisarAhora(): Promise<void> {
    try {
      await api.post('/notifications/scan')
    } finally {
      await cargar()
    }
  }

  function alCambiarVisibilidad(): void {
    if (document.visibilityState === 'visible') void cargar()
  }

  onMounted(() => {
    void cargar()
    temporizador = setInterval(() => {
      if (document.visibilityState === 'visible') void cargar()
    }, INTERVALO_MS)

    document.addEventListener('visibilitychange', alCambiarVisibilidad)
  })

  onUnmounted(() => {
    if (temporizador !== null) clearInterval(temporizador)
    document.removeEventListener('visibilitychange', alCambiarVisibilidad)
  })

  return { avisos, sinLeer, urgentes, cargando, cargar, atender, atenderTodo, revisarAhora }
}
