import { useApi } from '~/shared/composables/useApi'
import type { CorteCaja } from '~/shared/types/api'

interface RespuestaTurno {
  data: CorteCaja | null
  cash_session_id?: number
}

/**
 * Turno de caja abierto.
 *
 * El POS lo consulta al entrar a la pantalla de venta: sin turno abierto
 * no se puede cobrar, y la pantalla debe decirlo de entrada en lugar de
 * dejar que el cajero capture un carrito completo para fallar al final.
 */
export function useCashSession() {
  const api = useApi()

  const turno = ref<CorteCaja | null>(null)
  const turnoId = ref<number | null>(null)
  const cargando = ref(false)

  const hayTurnoAbierto = computed(() => turno.value !== null)

  async function cargar(): Promise<void> {
    cargando.value = true
    try {
      const r = await api.get<RespuestaTurno>('/cash-sessions/current')
      turno.value = r.data
      turnoId.value = r.cash_session_id ?? null
    } catch {
      turno.value = null
      turnoId.value = null
    } finally {
      cargando.value = false
    }
  }

  async function abrir(registerId: number, fondoCentavos: number, etiqueta: string): Promise<void> {
    await api.post('/cash-sessions', {
      register_id: registerId,
      opening_amount_cents: fondoCentavos,
      shift_label: etiqueta
    })
    await cargar()
  }

  return { turno, turnoId, cargando, hayTurnoAbierto, cargar, abrir }
}
