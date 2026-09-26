import { defineStore } from 'pinia'
import type { Product, ProductVariant } from '~/shared/types/api'

export type TipoDescuento = 'none' | 'percent' | 'amount'

export interface LineaCarrito {
  /** Identificador local de la línea, no el de la venta. */
  uid: string
  variante: ProductVariant
  productoNombre: string
  cantidad: number
  descuentoTipo: TipoDescuento
  /** Puntos base si es porcentaje (1000 = 10%), centavos si es monto. */
  descuentoValor: number
  descuentoMotivo?: string
  nota?: string
}

/**
 * Carrito de venta.
 *
 * IMPORTANTE: los totales que calcula este store son SÓLO PARA MOSTRAR.
 * El total que se cobra lo calcula el servidor al recibir la venta, y es
 * el único válido. Esta aritmética existe para que el cajero vea la cifra
 * mientras captura, no para decidir cuánto se paga.
 *
 * Por eso replica exactamente el orden del backend (línea primero, venta
 * después): si divergieran, el cajero vería un número y cobraría otro.
 */
export const useCartStore = defineStore('cart', () => {
  const lineas = ref<LineaCarrito[]>([])
  const cliente = ref('')
  const descuentoTipo = ref<TipoDescuento>('none')
  const descuentoValor = ref(0)
  const descuentoMotivo = ref('')

  /**
   * Llave de idempotencia del carrito.
   *
   * Se genera al abrir el carrito, NO al cobrar: si se generara al cobrar,
   * un doble clic produciría dos llaves distintas y dos ventas.
   */
  const idempotencyKey = ref(crypto.randomUUID())

  const vacio = computed(() => lineas.value.length === 0)
  const piezas = computed(() => lineas.value.reduce((n, l) => n + l.cantidad, 0))

  /** Redondeo mitad-hacia-arriba con enteros, igual que Money::percentBp. */
  function porcentaje(centavos: number, puntosBase: number): number {
    const producto = centavos * puntosBase
    return Math.floor((producto + 5000) / 10000)
  }

  function resolverDescuento(base: number, tipo: TipoDescuento, valor: number): number {
    if (tipo === 'none' || valor <= 0) return 0
    const bruto = tipo === 'percent' ? porcentaje(base, valor) : valor
    return Math.min(bruto, base)
  }

  function subtotalLinea(l: LineaCarrito): number {
    return l.variante.price.cents * l.cantidad
  }

  function descuentoLinea(l: LineaCarrito): number {
    return resolverDescuento(subtotalLinea(l), l.descuentoTipo, l.descuentoValor)
  }

  function totalLinea(l: LineaCarrito): number {
    return subtotalLinea(l) - descuentoLinea(l)
  }

  const subtotal = computed(() => lineas.value.reduce((n, l) => n + totalLinea(l), 0))

  const descuentoVenta = computed(() =>
    resolverDescuento(subtotal.value, descuentoTipo.value, descuentoValor.value)
  )

  const total = computed(() => subtotal.value - descuentoVenta.value)

  function agregar(producto: Product, variante: ProductVariant) {
    // Misma variante sin descuento propio: sube la cantidad en lugar de
    // duplicar la línea. Con descuento se mantiene aparte, porque son
    // condiciones distintas.
    const existente = lineas.value.find(
      l => l.variante.id === variante.id && l.descuentoTipo === 'none' && !l.nota
    )

    if (existente) {
      existente.cantidad++
      return
    }

    lineas.value.push({
      uid: crypto.randomUUID(),
      variante,
      productoNombre: producto.name,
      cantidad: 1,
      descuentoTipo: 'none',
      descuentoValor: 0
    })
  }

  function cambiarCantidad(uid: string, delta: number) {
    const linea = lineas.value.find(l => l.uid === uid)
    if (!linea) return

    linea.cantidad += delta
    if (linea.cantidad <= 0) quitar(uid)
  }

  function quitar(uid: string) {
    lineas.value = lineas.value.filter(l => l.uid !== uid)
  }

  function aplicarDescuentoLinea(uid: string, tipo: TipoDescuento, valor: number, motivo?: string) {
    const linea = lineas.value.find(l => l.uid === uid)
    if (!linea) return

    linea.descuentoTipo = tipo
    linea.descuentoValor = valor
    linea.descuentoMotivo = motivo
  }

  function limpiar() {
    lineas.value = []
    cliente.value = ''
    descuentoTipo.value = 'none'
    descuentoValor.value = 0
    descuentoMotivo.value = ''
    idempotencyKey.value = crypto.randomUUID()
  }

  /** Cuerpo de la petición de cobro. Nunca incluye precios. */
  function aPeticion(pagos: unknown[]) {
    return {
      items: lineas.value.map(l => ({
        variant_id: l.variante.id,
        quantity: l.cantidad,
        discount_type: l.descuentoTipo,
        discount_value: l.descuentoValor,
        discount_reason: l.descuentoMotivo || undefined,
        note: l.nota || undefined
      })),
      discount_type: descuentoTipo.value,
      discount_value: descuentoValor.value,
      discount_reason: descuentoMotivo.value || undefined,
      customer_name: cliente.value || undefined,
      payments: pagos,
      idempotency_key: idempotencyKey.value
    }
  }

  return {
    lineas,
    cliente,
    descuentoTipo,
    descuentoValor,
    descuentoMotivo,
    idempotencyKey,
    vacio,
    piezas,
    subtotal,
    descuentoVenta,
    total,
    subtotalLinea,
    descuentoLinea,
    totalLinea,
    agregar,
    cambiarCantidad,
    quitar,
    aplicarDescuentoLinea,
    limpiar,
    aPeticion
  }
})
