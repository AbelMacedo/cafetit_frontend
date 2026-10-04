import { useApi } from '~/shared/composables/useApi'
import type { ApiResource, Money, Venta } from '~/shared/types/api'

interface RespuestaPaginada {
  data: Venta[]
  meta?: {
    current_page: number
    last_page: number
    per_page: number
    total: number

    /** Lo cobrado en TODO el periodo filtrado, no en esta página. */
    cobrado?: Money
  }
}

export type FiltroEstado = 'todas' | 'paid' | 'cancelled'

/**
 * Registro de ventas.
 *
 * **Abre sin fechas puestas.** Antes llegaba con el día de hoy ya
 * escrito en los dos campos, y eso no es un filtro: es un recorte que
 * nadie pidió, con el agravante de parecer puesto por quien abre la
 * pantalla. Sin fechas se traen las más recientes, que es lo que casi
 * siempre se busca —reimprimir un ticket, cancelar una venta— y el
 * filtro queda libre para acotar de verdad.
 *
 * El servidor las ordena de la más nueva a la más vieja y se pide una
 * página: sin rango no se trae el histórico entero.
 */
export function useSalesHistory() {
  const api = useApi()

  const POR_PAGINA = 100

  const ventas = ref<Venta[]>([])
  const total = ref(0)
  const pagina = ref(1)
  const ultimaPagina = ref(1)
  const cobrado = ref(0)

  const cargando = ref(false)
  const error = ref<string | null>(null)

  const desde = ref('')
  const hasta = ref('')
  const estado = ref<FiltroEstado>('todas')
  const busqueda = ref('')

  function hoyEnISO(): string {
    const d = new Date()
    // Fecha local, no UTC: "hoy" es hoy para el cajero, no en Greenwich.
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /*
   | Lo cobrado lo manda el servidor, calculado sobre la consulta entera.
   |
   | Antes se sumaba aquí con las ventas cargadas. Como se piden 100 por
   | página, la esquina decía «Cobrado: $4,310» cuando en el periodo
   | había el doble, y nada lo advertía. Una cifra de dinero corta sin
   | avisar es peor que no ponerla.
   */
  const totalCobrado = computed(() => cobrado.value)

  const canceladas = computed(() => ventas.value.filter(v => v.estado === 'cancelled').length)

  /*
   | La lista es la que vino: el buscador va al servidor.
   |
   | Filtrarlo aquí parecía barato y escondía un agujero: sólo miraba las
   | ventas cargadas, así que buscar el folio de la semana pasada
   | contestaba «ninguna venta coincide». La venta estaba; no se había
   | traído, y quien buscaba su ticket se quedaba creyendo que no existía.
   */
  const visibles = computed(() => ventas.value)

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
        // Vacías no viajan: el filtro sin poner no debe acotar nada.
        desde: desde.value || undefined,
        hasta: hasta.value || undefined,
        status: estado.value === 'todas' ? undefined : estado.value,
        q: busqueda.value.trim() || undefined,
        per_page: POR_PAGINA,
        page: pagina.value
      })

      ventas.value = r.data
      total.value = r.meta?.total ?? r.data.length
      ultimaPagina.value = r.meta?.last_page ?? 1
      cobrado.value = r.meta?.cobrado?.cents ?? 0
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

  /**
   * Cualquier filtro devuelve a la primera página.
   *
   * Sin esto, acotar estando en la página 3 de un rango ancho dejaba la
   * lista vacía con los filtros puestos: parecía que no había ventas.
   */
  async function recargarDesdeLaPrimera(): Promise<void> {
    pagina.value = 1
    await cargar()
  }

  async function irAPagina(n: number): Promise<void> {
    pagina.value = Math.min(Math.max(1, n), ultimaPagina.value)
    await cargar()
  }

  return {
    ventas,
    visibles,
    total,
    totalCobrado,
    canceladas,
    pagina,
    ultimaPagina,
    porPagina: POR_PAGINA,
    desde,
    hasta,
    estado,
    busqueda,
    cargando,
    error,
    cargar,
    detalle,
    cancelar,
    hoy,
    recargarDesdeLaPrimera,
    irAPagina
  }
}
