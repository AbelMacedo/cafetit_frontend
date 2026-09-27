/**
 * Atajos de teclado de la pantalla de venta.
 *
 * La velocidad de captura es una funcionalidad (DESIGN.md §2), y con
 * puros clics hay un techo: cada producto son dos movimientos de mano —
 * mirar dónde está, apuntar, tocar— contra tres letras y Enter.
 *
 * Viven en un composable y no sueltos en la pantalla porque son reglas
 * con excepciones: un atajo que se dispara mientras alguien escribe el
 * nombre del cliente no es un atajo, es un estorbo. Toda esa lógica es
 * ésta, y conviene poder leerla de corrido.
 */

export interface AccionesVenta {
  /** Un carácter imprimible que no iba dirigido a ningún campo. */
  alEscribir: () => void
  /** Enter fuera de un campo, o en el buscador. */
  alConfirmar: () => void
  /** F2, o Enter con el buscador vacío. */
  alCobrar: () => void
  alCancelar: () => void
  /** Dígito 1-9 sin modificadores. */
  alElegirNumero: (n: number) => void
}

/**
 * ¿El evento venía de un campo de texto?
 *
 * Si el cajero está escribiendo el nombre del cliente, la tecla es suya,
 * no del atajo. Se comprueba el elemento con foco y no una bandera
 * propia porque el foco es la verdad: cualquier campo nuevo queda
 * cubierto sin tocar esto.
 */
function enCampoDeTexto(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false

  const etiqueta = destino.tagName.toLowerCase()

  return etiqueta === 'input'
    || etiqueta === 'textarea'
    || etiqueta === 'select'
    || destino.isContentEditable
}

export function useAtajosVenta(acciones: AccionesVenta, activo: Ref<boolean>) {
  function manejar(e: KeyboardEvent): void {
    if (!activo.value) return

    // Los atajos del navegador y del sistema siguen siendo del navegador.
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'Escape') {
      acciones.alCancelar()
      return
    }

    if (e.key === 'F2') {
      e.preventDefault()
      acciones.alCobrar()
      return
    }

    const enCampo = enCampoDeTexto(e.target)

    if (e.key === 'Enter') {
      // En un campo, Enter lo resuelve la pantalla según qué campo sea.
      if (!enCampo) {
        e.preventDefault()
        acciones.alConfirmar()
      }

      return
    }

    if (enCampo) return

    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault()
      acciones.alElegirNumero(Number(e.key))
      return
    }

    /*
     * Cualquier letra o número empieza una búsqueda.
     *
     * Es el atajo que más ahorra y el único que no hay que aprender: se
     * descubre solo la primera vez que alguien teclea sin darse cuenta de
     * que no tenía el cursor en el buscador.
     */
    if (e.key.length === 1 && /[\p{L}\p{N}]/u.test(e.key)) {
      acciones.alEscribir()
    }
  }

  onMounted(() => window.addEventListener('keydown', manejar))
  onUnmounted(() => window.removeEventListener('keydown', manejar))
}
