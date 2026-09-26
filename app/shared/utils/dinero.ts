/**
 * Formato de dinero para lo que el frontend calcula en pantalla.
 *
 * Todo monto que viene del servidor llega ya formateado (`{cents,
 * formatted}`) y se muestra tal cual. Esta función existe sólo para las
 * cifras que el carrito calcula EN VIVO mientras el cajero captura, antes
 * de que exista una venta.
 *
 * Replica el formato de `Money::format()` del backend para que el número
 * no cambie de aspecto al cobrar.
 */
export function formatearCentavos(centavos: number): string {
  const signo = centavos < 0 ? '-' : ''
  const absoluto = Math.abs(centavos)

  const enteros = Math.floor(absoluto / 100).toLocaleString('en-US')
  const decimales = String(absoluto % 100).padStart(2, '0')

  return `${signo}$${enteros}.${decimales}`
}
