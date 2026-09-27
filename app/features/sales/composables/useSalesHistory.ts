import { useApi } from '~/shared/composables/useApi'
import type { ApiResource, Venta } from '~/shared/types/api'

interface RespuestaPaginada {
  data: Venta[]
  meta?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export type FiltroEstado = 'todas' | 'paid' | 'cancelled'

/**
 * Registro de ventas.
 *
 * Por omisión muestra **el día de hoy**, no todo el histórico: quien abre
 * esta pantalla casi siempre busca una venta reciente — para reimprimir su
 * ticket o para cancelarla. El histórico completo es el caso raro, y para
 * eso están los filtros.
 */
export function useSalesHistory() {
  const api = useApi()

  const ventas = ref<Venta[]>([])
  const total = ref(0)
  const pagina = ref(1)
  const ultimaPagina = ref(1)

  const cargando = ref(false)
  const error = ref<string | null>(null)

  const desde = ref(hoyEnISO())
  const hasta = ref(hoyEnISO())
  const estado = ref<FiltroEstado>('todas')
  const busqueda = ref('')

  function hoyEnISO(): string {
    const d = new Date()
    // Fecha local, no UTC: "hoy" es hoy para el cajero, no en Greenwich.
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /** Las cobradas del periodo: lo que de verdad entró. */
  const totalCobrado = computed(() =>
    ventas.value
      .filter(v => v.estado === 'paid')
      .reduce((n, v) => n + v.total.cents, 0)
  )

  const canceladas = computed(() => ventas.value.filter(v => v.estado === 'cancelled').length)

  /** El filtro por texto se aplica en memoria: la lista de un día es corta. */
  const visibles = computed(() => {
    const texto = busqueda.value.trim().toLowerCase()
    if (!texto) return ventas.value

    return ventas.value.filter(v =>
      String(v.folio).includes(texto)
      || (v.cliente ?? '').toLowerCase().includes(texto)
      || (v.cajero ?? '').toLowerCase().includes(texto)
    )
  })

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      const r = await api.get<RespuestaPaginada>('/sales', {
        /*
         * Días de calendario, sin hora.
         *
         * Antes se mandaba `T00:00:00` y `T23:59:59` para no perder las
         * ventas de la tarde, pero esa hora no significaba nada: no
         * llevaba zona, y el servidor la leía en UTC. El día lo delimita
         * el backend, que es el único que sabe en qué zona vive el
         * negocio.
         */
        desde: desde.value,
        hasta: hasta.value,
        status: estado.value === 'todas' ? undefined : estado.value,
        per_page: 100,
        page: pagina.value
      })

      ventas.value = r.data
      total.value = r.meta?.total ?? r.data.length
      ultimaPagina.value = r.meta?.last_page ?? 1
    } catch {
      error.value = 'No se pudo cargar el registro de ventas.'
    } finally {
      cargando.value = false
    }
  }

  /** Detalle con líneas y pagos: el listado no los trae. */
  async function detalle(id: number): Promise<Venta> {
    const r = await api.get<ApiResource<Venta>>(`/sales/${id}`)
    return r.data
  }

  async function cancelar(id: number, motivo: string): Promise<void> {
    await api.post(`/sales/${id}/cancel`, { reason: motivo })
    await cargar()
  }

  function hoy(): void {
    desde.value = hoyEnISO()
    hasta.value = hoyEnISO()
  }

  return {
    ventas,
    visibles,
    total,
    totalCobrado,
    canceladas,
    pagina,
    ultimaPagina,
    desde,
    hasta,
    estado,
    busqueda,
    cargando,
    error,
    cargar,
    detalle,
    cancelar,
    hoy
  }
}
