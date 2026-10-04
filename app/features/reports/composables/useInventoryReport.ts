import type { Ref } from 'vue'
import { ApiError, useApi } from '~/shared/composables/useApi'
import type { ReporteInventario } from '~/shared/types/api'

/**
 * Inventario y mermas.
 *
 * **Recibe el rango, no lo construye.** Vive en la misma pantalla que el
 * reporte de ventas y los dos miran el mismo periodo: si cada uno llevara
 * sus fechas, el control de arriba cambiaría una mitad de la pantalla y no
 * la otra.
 *
 * Es de carga perezosa: sólo pide los datos cuando alguien abre la
 * sección. La pantalla se abre cien veces al día para ver cuánto se
 * vendió, y traer también el inventario cada vez sería cobrarle a todos
 * una consulta que casi nadie mira.
 */
export function useInventoryReport(desde: Ref<string>, hasta: Ref<string>) {
  const api = useApi()
  const base = useRuntimeConfig().public.apiBase

  const reporte = ref<ReporteInventario | null>(null)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  /** Qué rango trajo lo que hay cargado, para no repetir la consulta. */
  const cargadoPara = ref<string | null>(null)

  const clave = computed(() => `${desde.value}|${hasta.value}`)

  async function cargar(forzar = false): Promise<void> {
    if (!forzar && cargadoPara.value === clave.value) return

    cargando.value = true
    error.value = null

    try {
      const r = await api.get<{ data: ReporteInventario }>('/reports/inventory', {
        from: desde.value,
        to: hasta.value
      })

      reporte.value = r.data
      cargadoPara.value = clave.value
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'No se pudo cargar el inventario.'
      reporte.value = null
      cargadoPara.value = null
    } finally {
      cargando.value = false
    }
  }

  /** Marca lo cargado como viejo sin volver a pedirlo todavía. */
  function invalidar(): void {
    cargadoPara.value = null
  }

  /**
   * El PDF no pasa por `useApi`: no es JSON, es un documento que abre el
   * navegador por navegación directa. Vive en el grupo `web` del backend
   * y la cookie viaja sola por ser el mismo sitio.
   */
  function urlPdf(enLinea = true): string {
    const params = new URLSearchParams({ from: desde.value, to: hasta.value })

    if (enLinea) params.set('inline', '1')

    return `${base}/reportes/inventario.pdf?${params.toString()}`
  }

  function abrirPdf(): void {
    window.open(urlPdf(true), '_blank', 'noopener')
  }

  function descargarPdf(): void {
    window.location.href = urlPdf(false)
  }

  return { reporte, cargando, error, cargar, invalidar, urlPdf, abrirPdf, descargarPdf }
}
