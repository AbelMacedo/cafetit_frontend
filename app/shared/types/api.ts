/*
 * Contratos de la API.
 *
 * Son el espejo de los Resources del backend. Si allá cambia la forma,
 * aquí debe cambiar el tipo — y TypeScript señalará cada lugar afectado
 * en lugar de dejar que se descubra en producción.
 */

/**
 * Dinero tal como viaja desde el servidor.
 *
 * `cents` sirve para comparar y agrupar; `formatted` es lo que se muestra.
 * El frontend NUNCA recalcula un total a partir de los centavos: el
 * servidor ya decidió, y dos implementaciones del redondeo son, tarde o
 * temprano, dos redondeos distintos.
 */
export interface Money {
  cents: number
  formatted: string
}

export interface Store {
  id: number
  name: string
  currency: string
  timezone: string
  tax_rate_bp: number
  prices_include_tax: boolean
}

export interface User {
  id: number
  name: string
  email: string
  is_active: boolean
  last_login_at: string | null
  store?: Store
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  products_count?: number
}

export interface VariantOption {
  attribute: string | null
  code: string
  value: string
}

export interface ProductVariant {
  id: number
  variant_key: string
  name?: string | null
  sku: string | null
  price: Money
  is_default: boolean
  is_active: boolean
  tracks_stock: boolean
  min_stock: number | null
  options?: VariantOption[]
}

export interface Product {
  id: number
  name: string
  slug: string
  description: string | null
  image_url: string | null
  is_active: boolean
  show_on_landing: boolean
  sort_order: number
  category?: Category
  variants?: ProductVariant[]
}

/* ---------------------------------------------------------------------
 * Caja
 * ------------------------------------------------------------------ */

export interface CorteCaja {
  turno: {
    folio: number
    cajero: string
    etiqueta: string | null
    abierto_en: string
    cerrado_en: string | null
    generado_en: string
    duracion_minutos: number
    es_vista_previa: boolean
  }
  ventas: {
    total: Money
    cantidad: number
    por_metodo: Record<string, Money>
    por_categoria: Array<{ categoria: string, cantidad: number, total: Money }>
  }
  dinero_en_caja: {
    fondo: Money
    ventas_en_efectivo: Money
    entradas: Money
    salidas: Money
    efectivo_esperado: Money
  }
  movimientos: {
    entradas: MovimientoCaja[]
    salidas: MovimientoCaja[]
  }
  control: {
    descuentos: Money
    canceladas_cantidad: number
    canceladas_total: Money
  }
  /** Nulo mientras el turno sigue abierto: el arqueo sólo existe al cerrar. */
  arqueo: {
    contado: Money
    diferencia: Money
    hay_faltante: boolean
  } | null
}

export interface MovimientoCaja {
  concepto: string
  categoria: string
  monto: Money
  referencia: string | null
  hora: string
}

/* ---------------------------------------------------------------------
 * Ventas
 * ------------------------------------------------------------------ */

export type MetodoPago = 'cash' | 'card' | 'transfer'

export interface PagoVenta {
  metodo: MetodoPago
  metodo_texto: string
  monto: Money
  recibido: Money | null
  cambio: Money | null
  referencia: string | null
}

export interface LineaVenta {
  id: number
  nombre: string
  cantidad: number
  precio_unitario: Money
  descuento: Money
  total: Money
  nota: string | null
}

export interface Venta {
  id: number
  folio: number
  estado: 'paid' | 'cancelled' | 'refunded'
  estado_texto: string
  cliente: string | null
  cobrado_en: string
  cajero?: string
  subtotal: Money
  descuento: { tipo: string, valor: number, monto: Money, motivo: string | null }
  total: Money
  iva_incluido: Money
  lineas?: LineaVenta[]
  pagos?: PagoVenta[]
  cancelacion: { fecha: string, motivo: string } | null
}

/** Respuesta de un recurso individual. */
export interface ApiResource<T> {
  data: T
}

/** Respuesta de una colección paginada. */
export interface ApiCollection<T> {
  data: T[]
  meta?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/** Error de validación de Laravel (422). */
export interface ValidationError {
  message: string
  errors: Record<string, string[]>
}
