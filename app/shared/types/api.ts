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
  /** Si la cuenta puede relevar en el mostrador. Nunca cuál es el PIN. */
  tiene_pin: boolean
  last_login_at: string | null
  store?: Store
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  color: string | null

  /** Nombre corto del icono: `croissant`. El prefijo lo pone el servidor. */
  icon: string | null
  /** Listo para usar: `i-lucide-croissant`. Nulo si no tiene logo. */
  icon_componente: string | null

  sort_order: number
  is_active: boolean
  products_count?: number
}

/** Un logo del catálogo que manda el servidor. */
export interface LogoCategoria {
  valor: string
  texto: string
  componente: string
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

  /**
   * Piezas, para las variantes que controlan inventario.
   *
   * `vendibles` ya excluye lo caducado, igual que el cobro. Viene sólo
   * en los listados que la piden; ausente quiere decir «no se preguntó»,
   * que no es lo mismo que cero.
   */
  existencias?: {
    vendibles: number
    caducadas: number
  }
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

/* ---------------------------------------------------------------------
 * Administración del catálogo
 * ------------------------------------------------------------------ */

export interface ValorAtributo {
  id: number
  valor: string
  codigo: string
}

export interface AtributoProducto {
  id: number
  nombre: string
  codigo: string
  valores: ValorAtributo[]
}

/** Lo que el formulario manda al guardar. Nunca incluye el slug generado. */
export interface VarianteAGuardar {
  id?: number
  price_cents: number
  attribute_value_ids: number[]
  tracks_stock: boolean
  min_stock?: number | null
  is_active: boolean
}

export interface ProductoAGuardar {
  name: string
  category_id: number
  description?: string | null
  is_active: boolean
  show_on_landing: boolean
  variants: VarianteAGuardar[]
}

/* ---------------------------------------------------------------------
 * Inventario
 * ------------------------------------------------------------------ */

export type EstatusLote = 'active' | 'depleted' | 'expired' | 'discarded'

export type MotivoMerma = 'expired' | 'damaged' | 'preparation_error' | 'courtesy' | 'other'

export interface Lote {
  id: number
  lote: string | null
  proveedor: string | null
  producto?: {
    variante_id: number
    nombre: string
    variante: string | null
  }
  recibidas: number
  restantes: number
  costo_unitario: Money
  valor_restante: Money
  ingreso: string
  caducidad: string | null
  /** Negativo = ya caducó. Nulo = no caduca. Trunca hacia abajo. */
  horas_para_caducar: number | null
  caducado: boolean
  estatus: EstatusLote
  estatus_texto: string
  notas: string | null
}

export interface ResumenCaducidades {
  ventana_horas: number
  lotes: number
  piezas: number
  ya_caducados: number
  /** Lo que se pierde si no se vende: el argumento del módulo. */
  valor_en_riesgo: Money
}

/*
 * Reportes
 */

export interface LineaDia {
  /** 'YYYY-MM-DD' del calendario del negocio, no de UTC. */
  fecha: string
  cantidad: number
  total: Money
}

export interface LineaMetodo {
  metodo: 'cash' | 'card' | 'transfer'
  etiqueta: string
  /** Cuenta pagos, no ventas: una venta mixta aparece en dos renglones. */
  cantidad: number
  total: Money
}

export interface LineaProducto {
  nombre: string
  variante: string | null
  cantidad: number
  total: Money
}

export interface LineaCajero {
  cajero: string
  cantidad: number
  total: Money
}

export interface VentaCancelada {
  folio: number
  fecha: string
  cajero: string
  motivo: string | null
  total: Money
}

export interface ReporteVentas {
  periodo: {
    desde: string
    hasta: string
    zona: string
    dias_con_ventas: number
  }
  generado_en: string
  vacio: boolean
  resumen: {
    cantidad: number
    total: Money
    /** Lo que habrían costado las líneas a precio de lista. */
    subtotal_lista: Money
    /** Neto de descuentos de renglón, antes del descuento a la venta. */
    subtotal: Money
    descuentos_linea: Money
    descuentos_todos: Money
    /** Ajuste al peso, con su signo. */
    redondeo: Money
    descuentos: Money
    impuesto: Money
    /** Si el negocio cobra IVA. Las ventas viejas guardaron el suyo aunque hoy no. */
    impuesto_aplica: boolean
    ticket_promedio: Money
    promedio_diario: Money
  }
  por_dia: LineaDia[]
  por_metodo: LineaMetodo[]
  mas_vendidos: LineaProducto[]
  por_cajero: LineaCajero[]
  canceladas: {
    cantidad: number
    total: Money
    detalle: VentaCancelada[]
  }
}

/*
 * Inventario y mermas
 *
 * Las dos partes van separadas porque son de naturaleza distinta:
 * `existencias` es una fotografía del momento y no depende del rango;
 * `mermas` sí es del periodo. Mezclarlas haría parecer que el valor del
 * inventario es el que había aquel mes.
 */

export interface LineaExistencia {
  nombre: string
  variante: string | null
  lotes: number
  piezas: number
  valor: Money
}

export interface LineaEnRiesgo {
  nombre: string
  variante: string | null
  piezas: number
  valor: Money
  caduca: string | null
  vencido: boolean
}

export interface LineaMotivoMerma {
  motivo: string
  etiqueta: string
  /** Una cortesía es una decisión comercial; que caduque es una falla. */
  evitable: boolean
  piezas: number
  costo: Money
}

export interface LineaMermaProducto {
  nombre: string
  variante: string | null
  piezas: number
  costo: Money
}

export interface LineaMermaDia {
  fecha: string
  piezas: number
  costo: Money
}

export interface ReporteInventario {
  periodo: { desde: string, hasta: string, zona: string }
  generado_en: string
  vacio: boolean

  existencias: {
    /** De cuándo es la fotografía. No es el periodo. */
    al_momento: string
    lotes: number
    piezas: number
    valor: Money
    valor_en_riesgo: Money
    /** La lista va acotada; la cifra de arriba cuenta todos los lotes. */
    en_riesgo_recortado: boolean
    en_riesgo_lotes: number
    por_producto: LineaExistencia[]
    en_riesgo: LineaEnRiesgo[]
  }

  mermas: {
    piezas: number
    costo: Money
    costo_evitable: Money
    /** Qué proporción de lo que entró acabó en la basura. */
    porcentaje_sobre_entradas: number

    /** Falso cuando no hubo compras: entonces el porcentaje no dice nada. */
    porcentaje_comparable: boolean
    /** Pasa del 100%: se tiró mercancía que entró antes del periodo. */
    tirado_de_antes: boolean
    por_motivo: LineaMotivoMerma[]
    por_producto: LineaMermaProducto[]
    por_dia: LineaMermaDia[]
  }

  entradas: { piezas: number, costo: Money }
}

/*
 * Avisos del mostrador
 */

export type SeveridadAviso = 'info' | 'warning' | 'critical'

export interface Aviso {
  id: string
  evento: string
  evento_texto: string
  severidad: SeveridadAviso
  severidad_texto: string
  titulo: string
  cuerpo: string | null
  /** Pantalla a la que lleva al tocarlo. */
  enlace: string | null
  /** Datos propios del evento: para caducidades, el lote y lo que arriesga. */
  contexto: Record<string, unknown>
  leida: boolean
  creada_en: string | null
  leida_en: string | null
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

/**
 * Qué entorno contesta, según la propia API.
 *
 * Lo declara el servidor y no el POS: el riesgo no es equivocarse de
 * color, es cobrar de verdad creyendo que se practica. Quien sabe a qué
 * base se escribe es quien escribe.
 */
export interface Entorno {
  nombre: string
  es_produccion: boolean
}

/** Error de validación de Laravel (422). */
export interface ValidationError {
  message: string
  errors: Record<string, string[]>
}

/*
| Bitácora
|
| Es el único contrapeso del sistema: no hay roles, así que cualquiera
| puede cancelar una venta o mover un precio. Lo que queda es el registro.
*/

export interface RegistroBitacora {
  id: number
  /** Código estable, el que se manda al filtrar. */
  accion: string
  /** Rótulo ya traducido por el servidor. */
  accion_texto: string
  grupo: string
  /** Si es de las que se revisan cuando algo no cuadra. */
  delicada: boolean
  descripcion: string | null
  ocurrio_en: string
  usuario: string | null
  usuario_id: number | null
  /** Nulo cuando el hecho vino de un comando y no de un navegador. */
  ip: string | null
  antes: Record<string, unknown> | null
  despues: Record<string, unknown> | null
}

export interface AccionBitacora {
  valor: string
  texto: string
  grupo: string
  delicada: boolean
}
