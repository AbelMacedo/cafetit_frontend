import { useApi } from '~/shared/composables/useApi'
import type { Lote, MotivoMerma, Product, ResumenCaducidades } from '~/shared/types/api'

interface RespuestaCaducidades {
  data: Lote[]
  resumen: ResumenCaducidades
}

/**
 * Inventario por lotes.
 *
 * La pantalla gira alrededor de "sacar hoy", no del listado completo: lo
 * que el mostrador necesita a las siete de la mañana es saber qué se va a
 * echar a perder, no cuántas piezas hay en total.
 */
export function useInventory() {
  const api = useApi()

  const lotes = ref<Lote[]>([])
  const porCaducar = ref<Lote[]>([])
  const resumen = ref<ResumenCaducidades | null>(null)
  const ventanaHoras = ref(24)

  const cargando = ref(false)
  const error = ref<string | null>(null)

  /** Productos que controlan stock: los únicos que admiten lotes. */
  const conStock = ref<Array<{ id: number, etiqueta: string }>>([])

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      const [todos, urgentes] = await Promise.all([
        api.get<{ data: Lote[] }>('/stock-lots'),
        api.get<RespuestaCaducidades>('/stock-lots/expiring', { horas: ventanaHoras.value })
      ])

      lotes.value = todos.data
      porCaducar.value = urgentes.data
      resumen.value = urgentes.resumen
    } catch {
      error.value = 'No se pudo cargar el inventario.'
    } finally {
      cargando.value = false
    }
  }

  async function cargarProductosConStock(): Promise<void> {
    try {
      const r = await api.get<{ data: Product[] }>('/products', { only_active: true, per_page: 200 })

      conStock.value = r.data.flatMap(p =>
        (p.variants ?? [])
          .filter(v => v.tracks_stock && v.is_active)
          .map(v => ({
            id: v.id,
            etiqueta: v.name ? `${p.name} · ${v.name}` : p.name
          }))
      )
    } catch {
      conStock.value = []
    }
  }

  async function recibir(datos: {
    variant_id: number
    quantity: number
    expires_at?: string
    unit_cost_cents?: number
    lot_code?: string
    supplier?: string
  }): Promise<void> {
    await api.post('/stock-lots', datos)
    await cargar()
  }

  async function mermar(loteId: number, cantidad: number, motivo: MotivoMerma, notas?: string): Promise<void> {
    await api.post(`/stock-lots/${loteId}/waste`, {
      quantity: cantidad,
      reason: motivo,
      notes: notas || undefined
    })
    await cargar()
  }

  return {
    lotes,
    porCaducar,
    resumen,
    ventanaHoras,
    conStock,
    cargando,
    error,
    cargar,
    cargarProductosConStock,
    recibir,
    mermar
  }
}
