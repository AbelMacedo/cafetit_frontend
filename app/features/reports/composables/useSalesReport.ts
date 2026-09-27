import { ApiError, useApi } from '~/shared/composables/useApi'
import type { ReporteVentas } from '~/shared/types/api'

/** Atajos de periodo. Son los que de verdad se piden. */
export type Atajo = 'hoy' | 'ayer' | 'semana' | 'mes' | 'mes_pasado'

/** 'YYYY-MM-DD' en hora local, que es la del negocio. */
function iso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')

  return `${y}-${m}-${dia}`
}

/**
 * Reporte de ventas de un periodo.
 *
 * Las fechas viajan como texto 'YYYY-MM-DD' a propósito: el backend las
 * interpreta en la zona del negocio, que es la única que sabe dónde
 * empieza «el lunes». Mandar un instante ISO desde aquí volvería a meter
 * la zona del navegador en una cuenta que no es suya.
 */
export function useSalesReport() {
  const api = useApi()
  const base = useRuntimeConfig().public.apiBase

  const hoy = new Date()

  const desde = ref(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)))
  const hasta = ref(iso(hoy))

  const reporte = ref<ReporteVentas | null>(null)
  const cargando = ref(false)
  const error = ref<string | null>(null)

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      const r = await api.get<{ data: ReporteVentas }>('/reports/sales', {
        from: desde.value,
        to: hasta.value
      })

      reporte.value = r.data
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'No se pudo cargar el reporte.'
      reporte.value = null
    } finally {
      cargando.value = false
    }
  }

  function aplicar(atajo: Atajo): void {
    const n = new Date()

    switch (atajo) {
      case 'hoy':
        desde.value = iso(n)
        hasta.value = iso(n)
        break

      case 'ayer': {
        const ayer = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1)
        desde.value = iso(ayer)
        hasta.value = iso(ayer)
        break
      }

      case 'semana': {
        // Semana que empieza en lunes: getDay() da 0 para domingo.
        const diaSemana = (n.getDay() + 6) % 7
        desde.value = iso(new Date(n.getFullYear(), n.getMonth(), n.getDate() - diaSemana))
        hasta.value = iso(n)
        break
      }

      case 'mes':
        desde.value = iso(new Date(n.getFullYear(), n.getMonth(), 1))
        hasta.value = iso(n)
        break

      case 'mes_pasado':
        desde.value = iso(new Date(n.getFullYear(), n.getMonth() - 1, 1))
        // Día 0 del mes actual = último día del anterior.
        hasta.value = iso(new Date(n.getFullYear(), n.getMonth(), 0))
        break
    }
  }

  /**
   * El PDF no pasa por `useApi`: no es JSON, es un documento que abre el
   * navegador por navegación directa. Vive en el grupo `web` del backend
   * y la cookie de sesión viaja sola por ser el mismo sitio.
   */
  function urlPdf(enLinea = true): string {
    const params = new URLSearchParams({ from: desde.value, to: hasta.value })

    if (enLinea) params.set('inline', '1')

    return `${base}/reportes/ventas.pdf?${params.toString()}`
  }

  function abrirPdf(): void {
    window.open(urlPdf(true), '_blank', 'noopener')
  }

  function descargarPdf(): void {
    window.location.href = urlPdf(false)
  }

  return {
    desde,
    hasta,
    reporte,
    cargando,
    error,
    cargar,
    aplicar,
    urlPdf,
    abrirPdf,
    descargarPdf
  }
}
