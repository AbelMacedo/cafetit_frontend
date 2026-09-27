/**
 * Impresión de tickets.
 *
 * El ticket lo renderiza el backend (es un documento financiero y debe
 * salir de la misma fuente que lo registró). Aquí sólo se carga en un
 * iframe oculto y se deja que la propia página dispare `print()` — por eso
 * la plantilla acepta `?imprimir=1`.
 *
 * El iframe evita abrir una pestaña que el cajero tendría que cerrar entre
 * venta y venta. Como el ticket se imprime a sí mismo, no hace falta que
 * este código toque su contenido, cosa que el navegador impediría por ser
 * otro origen.
 *
 * El transporte hacia la impresora física es un detalle intercambiable
 * (ver docs/PLAN.md §8): hoy pasa por el diálogo del sistema; mañana puede
 * ser un agente local con ESC/POS sin tocar nada de aquí.
 */

type TipoDeTicket = 'venta' | 'corte'

export function useTicketPrinter() {
  const base = useRuntimeConfig().public.apiBase
  const imprimiendo = ref(false)

  function url(tipo: TipoDeTicket, id: number, opciones: { imprimir?: boolean, reimpresion?: boolean } = {}): string {
    const ruta = tipo === 'venta' ? 'ventas' : 'cortes'
    const params = new URLSearchParams()

    if (opciones.imprimir) params.set('imprimir', '1')
    if (opciones.reimpresion) params.set('reimpresion', '1')

    const query = params.toString()

    return `${base}/tickets/${ruta}/${id}${query ? `?${query}` : ''}`
  }

  /**
   * Manda el ticket a la impresora.
   *
   * Devuelve una promesa que se resuelve cuando el documento cargó, no
   * cuando terminó de imprimirse: el diálogo del sistema es del navegador
   * y no avisa de vuelta.
   */
  function imprimir(tipo: TipoDeTicket, id: number, opciones: { reimpresion?: boolean } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (import.meta.server) {
        resolve()
        return
      }

      imprimiendo.value = true

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'

      // El ticket vive detrás de la sesión: la cookie viaja porque es el
      // mismo sitio (localhost / .cafetit.com).
      iframe.src = url(tipo, id, { imprimir: true, ...opciones })

      const limpiar = () => {
        imprimiendo.value = false
        // Se retira con retraso: quitarlo de inmediato cancelaría el
        // diálogo de impresión que acaba de abrir.
        setTimeout(() => iframe.remove(), 60_000)
      }

      iframe.onload = () => {
        limpiar()
        resolve()
      }

      iframe.onerror = () => {
        limpiar()
        reject(new Error('No se pudo cargar el ticket.'))
      }

      document.body.appendChild(iframe)
    })
  }

  /** Abre el ticket en otra pestaña, para revisarlo sin imprimirlo. */
  function ver(tipo: TipoDeTicket, id: number): void {
    window.open(url(tipo, id), '_blank', 'noopener')
  }

  return { imprimir, ver, url, imprimiendo }
}
