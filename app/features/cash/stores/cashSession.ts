import { defineStore } from 'pinia'
import { useApi } from '~/shared/composables/useApi'
import type { CorteCaja } from '~/shared/types/api'

interface RespuestaTurno {
  data: CorteCaja | null
  cash_session_id?: number
}

/**
 * Turno de caja abierto.
 *
 * Es un store y no un composable porque **el estado tiene que ser uno
 * solo**. El encabezado muestra el turno en todas las pantallas y la
 * pantalla de caja lo abre y lo cierra; con una instancia por llamada,
 * cerrar la caja dejaría el encabezado diciendo que sigue abierta hasta
 * que alguien navegara. Un POS que miente sobre el estado de la caja es
 * peor que uno que no lo muestra.
 *
 * Sin turno abierto no se puede cobrar, y eso debe verse de entrada en
 * lugar de dejar que el cajero capture un carrito completo para fallar
 * al final.
 */
export const useCashSessionStore = defineStore('cashSession', () => {
  const api = useApi()

  const turno = ref<CorteCaja | null>(null)
  const turnoId = ref<number | null>(null)
  const cargando = ref(false)
  const consultado = ref(false)

  const hayTurnoAbierto = computed(() => turno.value !== null)

  /** Lo que el encabezado necesita saber, sin cargar el corte entero. */
  const etiqueta = computed(() => {
    if (turno.value === null) return null

    return `Turno #${turno.value.turno.folio} · ${turno.value.turno.etiqueta}`
  })

  const efectivoEsperado = computed(() =>
    turno.value?.dinero_en_caja.efectivo_esperado ?? null
  )

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
      consultado.value = true
    }
  }

  /**
   * Carga sólo si todavía no se ha consultado.
   *
   * La usa el encabezado, que se monta en cada navegación: sin esto,
   * moverse entre pantallas dispararía una consulta cada vez para saber
   * algo que ya sabemos.
   */
  async function cargarSiHaceFalta(): Promise<void> {
    if (consultado.value || cargando.value) return

    await cargar()
  }

  async function abrir(registerId: number, fondoCentavos: number, etiquetaTurno: string): Promise<void> {
    await api.post('/cash-sessions', {
      register_id: registerId,
      opening_amount_cents: fondoCentavos,
      shift_label: etiquetaTurno
    })

    await cargar()
  }

  return {
    turno,
    turnoId,
    cargando,
    consultado,
    hayTurnoAbierto,
    etiqueta,
    efectivoEsperado,
    cargar,
    cargarSiHaceFalta,
    abrir
  }
})
