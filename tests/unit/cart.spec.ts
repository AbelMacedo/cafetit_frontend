import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore } from '~/features/sales/stores/cart'
import type { Product, ProductVariant } from '~/shared/types/api'

/**
 * Aritmética del carrito.
 *
 * Los totales que calcula el carrito son SÓLO PARA MOSTRAR: el que se
 * cobra lo calcula el servidor. Pero tienen que coincidir al centavo, y
 * por la misma razón que existe el store — si divergieran, el cajero
 * vería un número y cobraría otro, que es de los errores que más caro
 * salen en un mostrador porque nadie los reporta: se cobra y ya.
 *
 * Por eso lo que se prueba aquí no es «suma bien», sino que replique el
 * ORDEN del backend: descuento de línea primero, descuento de venta
 * después, y el redondeo mitad-hacia-arriba con enteros.
 */

function variante(id: number, centavos: number): ProductVariant {
  return {
    id,
    sku: `SKU-${id}`,
    price: { cents: centavos, formatted: '' },
    is_default: true,
    is_active: true,
    variant_name: null,
    options: []
  } as unknown as ProductVariant
}

function producto(nombre: string): Product {
  return { id: 1, name: nombre } as unknown as Product
}

describe('carrito', () => {
  let carrito: ReturnType<typeof useCartStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    carrito = useCartStore()
  })

  describe('composición de líneas', () => {
    it('empieza vacío', () => {
      expect(carrito.vacio).toBe(true)
      expect(carrito.total).toBe(0)
      expect(carrito.piezas).toBe(0)
    })

    it('agrupa la misma variante en lugar de duplicar la línea', () => {
      const v = variante(1, 5500)

      carrito.agregar(producto('Latte'), v)
      carrito.agregar(producto('Latte'), v)
      carrito.agregar(producto('Latte'), v)

      expect(carrito.lineas).toHaveLength(1)
      expect(carrito.lineas[0]!.cantidad).toBe(3)
      expect(carrito.piezas).toBe(3)
      expect(carrito.total).toBe(16500)
    })

    it('mantiene aparte una línea con descuento propio', () => {
      const v = variante(1, 5500)

      carrito.agregar(producto('Latte'), v)
      carrito.aplicarDescuentoLinea(carrito.lineas[0]!.uid, 'percent', 1000)
      carrito.agregar(producto('Latte'), v)

      // Son condiciones distintas: agruparlas aplicaría el descuento a las dos.
      expect(carrito.lineas).toHaveLength(2)
      expect(carrito.lineas[1]!.descuentoTipo).toBe('none')
    })

    it('quita la línea al bajar la cantidad a cero', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))
      const uid = carrito.lineas[0]!.uid

      carrito.cambiarCantidad(uid, -1)

      expect(carrito.vacio).toBe(true)
    })

    it('no deja cantidades negativas', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))
      carrito.cambiarCantidad(carrito.lineas[0]!.uid, -5)

      expect(carrito.vacio).toBe(true)
    })

    it('ignora una cantidad sobre una línea que ya no existe', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))

      expect(() => carrito.cambiarCantidad('uid-inventado', 1)).not.toThrow()
      expect(carrito.piezas).toBe(1)
    })
  })

  describe('descuentos', () => {
    it('aplica un porcentaje de línea en puntos base', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))
      carrito.aplicarDescuentoLinea(carrito.lineas[0]!.uid, 'percent', 1000) // 10%

      expect(carrito.descuentoLinea(carrito.lineas[0]!)).toBe(550)
      expect(carrito.total).toBe(4950)
    })

    it('redondea mitad hacia arriba, igual que Money::percentBp', () => {
      // 333 × 15% = 49.95 centavos → 50, no 49.
      carrito.agregar(producto('Raro'), variante(1, 333))
      carrito.aplicarDescuentoLinea(carrito.lineas[0]!.uid, 'percent', 1500)

      expect(carrito.descuentoLinea(carrito.lineas[0]!)).toBe(50)
    })

    it('nunca descuenta más que la base', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))
      carrito.aplicarDescuentoLinea(carrito.lineas[0]!.uid, 'amount', 999999)

      expect(carrito.totalLinea(carrito.lineas[0]!)).toBe(0)
      expect(carrito.total).toBe(0)
    })

    it('un descuento de cero o negativo no hace nada', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))
      carrito.aplicarDescuentoLinea(carrito.lineas[0]!.uid, 'percent', 0)
      expect(carrito.total).toBe(5500)

      carrito.aplicarDescuentoLinea(carrito.lineas[0]!.uid, 'amount', -500)
      expect(carrito.total).toBe(5500)
    })

    it('aplica el descuento de venta SOBRE el subtotal ya descontado', () => {
      /*
       * Éste es el orden del backend y el que más fácil se equivoca.
       *
       *   línea:    5500 − 10% = 4950
       *   venta:    4950 − 10% = 4455
       *
       * Sumar los dos porcentajes y aplicarlos juntos daría 4400: 55
       * centavos de diferencia entre lo que se ve y lo que se cobra.
       */
      carrito.agregar(producto('Latte'), variante(1, 5500))
      carrito.aplicarDescuentoLinea(carrito.lineas[0]!.uid, 'percent', 1000)

      carrito.descuentoTipo = 'percent'
      carrito.descuentoValor = 1000

      expect(carrito.subtotal).toBe(4950)
      expect(carrito.descuentoVenta).toBe(495)
      expect(carrito.total).toBe(4455)
    })

    it('el descuento de venta tampoco pasa del subtotal', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))

      carrito.descuentoTipo = 'amount'
      carrito.descuentoValor = 999999

      expect(carrito.total).toBe(0)
    })
  })

  describe('petición de cobro', () => {
    it('no manda precios: el servidor los pone', () => {
      carrito.agregar(producto('Latte'), variante(7, 5500))

      const cuerpo = carrito.aPeticion([{ method: 'cash', amount_cents: 5500 }])
      const crudo = JSON.stringify(cuerpo)

      expect(cuerpo.items[0]).toMatchObject({ variant_id: 7, quantity: 1 })
      expect(crudo).not.toContain('price')
      expect(crudo).not.toContain('5500,') // ningún precio suelto en las líneas
    })

    it('manda la llave de idempotencia del carrito', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))

      const primera = carrito.aPeticion([])
      const segunda = carrito.aPeticion([])

      // Dos intentos de cobrar el MISMO carrito llevan la misma llave: es
      // lo que impide que un doble clic produzca dos ventas.
      expect(primera.idempotency_key).toBe(segunda.idempotency_key)
    })

    it('omite los campos vacíos en lugar de mandarlos en blanco', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))

      const cuerpo = carrito.aPeticion([])

      expect(cuerpo.customer_name).toBeUndefined()
      expect(cuerpo.discount_reason).toBeUndefined()
      expect(cuerpo.items[0]!.note).toBeUndefined()
    })
  })

  describe('limpiar', () => {
    it('estrena llave de idempotencia', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))
      const anterior = carrito.idempotencyKey

      carrito.limpiar()

      // Si conservara la llave, la venta siguiente se tomaría por un
      // reintento de la anterior y el servidor devolvería aquélla.
      expect(carrito.idempotencyKey).not.toBe(anterior)
    })

    it('borra líneas, cliente y descuento de venta', () => {
      carrito.agregar(producto('Latte'), variante(1, 5500))
      carrito.cliente = 'Ana'
      carrito.descuentoTipo = 'percent'
      carrito.descuentoValor = 1000
      carrito.descuentoMotivo = 'Cortesía'

      carrito.limpiar()

      expect(carrito.vacio).toBe(true)
      expect(carrito.cliente).toBe('')
      expect(carrito.descuentoTipo).toBe('none')
      expect(carrito.descuentoValor).toBe(0)
      expect(carrito.descuentoMotivo).toBe('')
      expect(carrito.total).toBe(0)
    })
  })
})
