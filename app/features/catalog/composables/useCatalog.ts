import type { ApiCollection, Category, Product } from '~/shared/types/api'
import { useApi } from '~/shared/composables/useApi'

/**
 * Catálogo para la pantalla de venta.
 *
 * La lógica vive aquí y no en el componente: un componente con trescientas
 * líneas de lógica es un composable sin extraer.
 */
export function useCatalog() {
  const api = useApi()

  const categorias = ref<Category[]>([])
  const productos = ref<Product[]>([])
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const categoriaActiva = ref<number | null>(null)
  const busqueda = ref('')

  const productosVisibles = computed(() => {
    const texto = busqueda.value.trim().toLowerCase()

    return productos.value.filter((p) => {
      if (categoriaActiva.value !== null && p.category?.id !== categoriaActiva.value) return false
      if (texto && !p.name.toLowerCase().includes(texto)) return false
      return true
    })
  })

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      // En paralelo: son independientes y la pantalla necesita ambas.
      const [cats, prods] = await Promise.all([
        api.get<ApiCollection<Category>>('/categories', { only_active: true }),

        /*
         | El catálogo del mostrador va COMPLETO. Lo que no esté aquí no
         | se puede cobrar, y una página suelta no avisa de lo que dejó
         | fuera: simplemente faltaría mercancía en la cuadrícula.
         */
        api.todas<Product>('/products', { only_active: true })
      ])

      categorias.value = cats.data
      productos.value = prods
    } catch {
      error.value = 'No se pudo cargar el catálogo.'
    } finally {
      cargando.value = false
    }
  }

  return {
    categorias,
    productos,
    productosVisibles,
    categoriaActiva,
    busqueda,
    cargando,
    error,
    cargar
  }
}
