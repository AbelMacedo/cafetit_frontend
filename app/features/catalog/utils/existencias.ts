import type { ProductVariant } from '~/shared/types/api'

/**
 * Por qué una presentación no se puede cobrar, si es que no se puede.
 *
 * Existe porque el mostrador se enteraba demasiado tarde: el cajero
 * agregaba la concha, llegaba a cobrar y ahí saltaba el error, con el
 * cliente delante. Las piezas vendibles ya vienen en el catálogo; esto
 * sólo traduce el número a lo que hay que hacer.
 *
 * Distinguir los dos casos no es un matiz: «agotado» manda a la cocina
 * por más, «caducado» manda a Inventario a darlo de baja.
 */
export type MotivoSinVenta = 'agotado' | 'caducado'

export function motivoSinVenta(v: ProductVariant): MotivoSinVenta | null {
  // Sin inventario que llevar, siempre se puede cobrar.
  if (!v.tracks_stock || v.existencias === undefined) return null
  if (v.existencias.vendibles > 0) return null

  return v.existencias.caducadas > 0 ? 'caducado' : 'agotado'
}

export function etiquetaSinVenta(motivo: MotivoSinVenta): string {
  return motivo === 'caducado' ? 'Caducado' : 'Agotado'
}

/** Lo que se dice cuando se intenta agregar de todas formas. */
export function explicacionSinVenta(v: ProductVariant, motivo: MotivoSinVenta): string {
  if (motivo === 'agotado') return 'No quedan piezas.'

  const piezas = v.existencias?.caducadas ?? 0

  return piezas === 1
    ? 'La pieza que queda está caducada: hay que darla de baja en Inventario.'
    : `Las ${piezas} piezas que quedan están caducadas: hay que darlas de baja en Inventario.`
}
