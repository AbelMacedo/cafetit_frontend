import { useApi } from '~/shared/composables/useApi'
import type { ApiResource, Category } from '~/shared/types/api'

/** Lo que el formulario manda. El slug lo deriva el servidor si no viene. */
export interface CategoriaAGuardar {
  name: string
  description?: string | null
  color?: string | null
  sort_order?: number | null
  is_active?: boolean
}

/**
 * Administración de categorías.
 *
 * Es la pieza que faltaba para que el sistema fuera autónomo de verdad:
 * hasta ahora un producto sólo podía colgarse de las categorías que trajo
 * el seeder, así que dar de alta una línea nueva —tortas, jugos— pedía
 * entrar a la base de datos.
 */
export function useCategories() {
  const api = useApi()

  const categorias = ref<Category[]>([])
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const busqueda = ref('')
  const incluirInactivas = ref(true)

  const visibles = computed(() => {
    const texto = busqueda.value.trim().toLowerCase()

    return categorias.value.filter((c) => {
      if (!incluirInactivas.value && !c.is_active) return false
      if (texto && !c.name.toLowerCase().includes(texto)) return false
      return true
    })
  })

  const activas = computed(() => categorias.value.filter(c => c.is_active).length)

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      const r = await api.get<{ data: Category[] }>('/categories')
      categorias.value = r.data
    } catch {
      error.value = 'No se pudo cargar las categorías.'
    } finally {
      cargando.value = false
    }
  }

  async function guardar(datos: CategoriaAGuardar, id?: number): Promise<void> {
    if (id === undefined) {
      await api.post<ApiResource<Category>>('/categories', datos)
    } else {
      await api.put<ApiResource<Category>>(`/categories/${id}`, datos)
    }

    await cargar()
  }

  /**
   * No borra: desactiva.
   *
   * Una categoría eliminada dejaría huérfanos sus productos y rompería los
   * reportes históricos, que siguen agrupando por ella.
   */
  async function retirar(id: number): Promise<void> {
    await api.del(`/categories/${id}`)
    await cargar()
  }

  async function reactivar(id: number): Promise<void> {
    await api.put<ApiResource<Category>>(`/categories/${id}`, { is_active: true })
    await cargar()
  }

  return {
    categorias,
    visibles,
    activas,
    busqueda,
    incluirInactivas,
    cargando,
    error,
    cargar,
    guardar,
    retirar,
    reactivar
  }
}
