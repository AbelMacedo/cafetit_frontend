import { useApi } from '~/shared/composables/useApi'
import type { AccionBitacora, ApiCollection, RegistroBitacora } from '~/shared/types/api'

/**
 * Lectura de la bitácora.
 *
 * Por omisión abre en **los últimos siete días y sólo lo delicado**. Quien
 * entra aquí no viene a pasear: viene porque un corte no cuadró, faltó
 * mercancía o un precio se ve raro. Abrir con todo el histórico y todas
 * las acciones —incluidas las decenas de aperturas y cierres de turno—
 * entierra justo lo que se busca.
 *
 * Los rótulos vienen del servidor. Traducirlos aquí obligaría a mantener
 * dos listas iguales y a que una acción nueva saliera como código suelto.
 */
export function useAuditLog() {
  const api = useApi()

  const registros = ref<RegistroBitacora[]>([])
  const acciones = ref<AccionBitacora[]>([])
  const total = ref(0)
  const pagina = ref(1)
  const ultimaPagina = ref(1)

  const cargando = ref(false)
  const error = ref<string | null>(null)

  /*
   | Cien por página.
   |
   | Durante un tiempo esto fue un tope sin salida: se pedían las 100 más
   | recientes y las demás no se alcanzaban, mientras el contador leía el
   | total del servidor y decía «350 resultados» sobre 100 filas. En una
   | bitácora, una línea que no se ve es una línea que no existe para
   | quien vino a buscarla.
   */
  const POR_PAGINA = 100

  /** Cómo abre la pantalla; a esto vuelve «Limpiar». */
  const DIAS_INICIALES = 7

  const desde = ref(haceDias(DIAS_INICIALES))
  const hasta = ref(haceDias(0))
  /*
   * El «todas» es un valor, no la cadena vacía.
   *
   * El selector de Nuxt UI rechaza una opción con valor vacío —lo
   * reserva para «sin elegir»— y la pantalla reventaba con un 500 al
   * recargarla. El centinela va aquí y no en la plantilla para que la
   * consulta y el filtro lean el mismo estado.
   */
  const accion = ref('todas')
  const soloDelicadas = ref(true)

  function haceDias(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() - n)

    // Fecha local: «hoy» es hoy en el mostrador, no en Greenwich.
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  /*
   | Filtrada es «no está como abre», y las fechas cuentan: dejarlas fuera
   | hacía que «Limpiar» se viera apagado con un periodo puesto a mano, sin
   | forma de volver.
   */
  const filtrada = computed(() =>
    accion.value !== 'todas'
    || !soloDelicadas.value
    || desde.value !== haceDias(DIAS_INICIALES)
    || hasta.value !== haceDias(0)
  )

  /**
   * Los registros agrupados por día, que es como se leen.
   *
   * Una lista plana de cien líneas con la fecha repetida en cada una
   * obliga a comparar renglón con renglón para saber cuándo pasó algo.
   */
  const porDia = computed(() => {
    const grupos = new Map<string, RegistroBitacora[]>()

    for (const r of registros.value) {
      const dia = new Date(r.ocurrio_en).toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long'
      })

      const lista = grupos.get(dia)
      if (lista) lista.push(r)
      else grupos.set(dia, [r])
    }

    return [...grupos.entries()].map(([dia, items]) => ({ dia, items }))
  })

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      const r = await api.get<ApiCollection<RegistroBitacora>>('/audit-logs', {
        // Días de calendario, sin hora: el servidor los delimita.
        desde: desde.value,
        hasta: hasta.value,
        accion: accion.value === 'todas' ? undefined : accion.value,
        solo_delicadas: soloDelicadas.value ? 1 : undefined,
        per_page: POR_PAGINA,
        page: pagina.value
      })

      registros.value = r.data
      total.value = r.meta?.total ?? r.data.length
      ultimaPagina.value = r.meta?.last_page ?? 1
    } catch {
      error.value = 'No se pudo cargar la bitácora.'
    } finally {
      cargando.value = false
    }
  }

  /** El catálogo de acciones se pide una vez: no cambia durante la sesión. */
  async function cargarAcciones(): Promise<void> {
    if (acciones.value.length > 0) return

    try {
      const r = await api.get<{ data: AccionBitacora[] }>('/audit-logs/actions')
      acciones.value = r.data
    } catch {
      // Sin catálogo el filtro se queda en «todas», que es utilizable.
      acciones.value = []
    }
  }

  /** Deja la pantalla como abre: últimos siete días y sólo lo delicado. */
  function limpiar(): void {
    accion.value = 'todas'
    soloDelicadas.value = true
    desde.value = haceDias(DIAS_INICIALES)
    hasta.value = haceDias(0)
  }

  /**
   * Lo de hoy.
   *
   * Aquí se entra casi siempre por algo que acaba de pasar —un corte que
   * no cuadró, un precio raro— y poner dos fechas a mano para eso son
   * cuatro toques en una tableta.
   */
  function irAHoy(): void {
    desde.value = haceDias(0)
    hasta.value = haceDias(0)
  }

  /**
   * Cualquier filtro devuelve a la primera página.
   *
   * Acotar estando en la página 3 dejaba la lista vacía con los filtros
   * puestos: parecía que no había pasado nada en ese periodo.
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
    registros, acciones, total, porDia,
    pagina, ultimaPagina, porPagina: POR_PAGINA,
    desde, hasta, accion, soloDelicadas,
    filtrada, cargando, error,
    cargar, cargarAcciones, limpiar, irAHoy,
    recargarDesdeLaPrimera, irAPagina
  }
}
