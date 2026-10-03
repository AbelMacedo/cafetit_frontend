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

  const cargando = ref(false)
  const error = ref<string | null>(null)

  const desde = ref(haceDias(7))
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

  const filtrada = computed(() => accion.value !== 'todas' || soloDelicadas.value)

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
        per_page: 100
      })

      registros.value = r.data
      total.value = r.meta?.total ?? r.data.length
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

  function limpiar(): void {
    accion.value = 'todas'
    soloDelicadas.value = false
  }

  return {
    registros, acciones, total, porDia,
    desde, hasta, accion, soloDelicadas,
    filtrada, cargando, error,
    cargar, cargarAcciones, limpiar
  }
}
