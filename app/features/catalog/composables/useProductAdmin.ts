import { useApi } from '~/shared/composables/useApi'
import type {
  ApiResource, AtributoProducto, Category, Product, ProductoAGuardar
} from '~/shared/types/api'

/**
 * Administración del catálogo.
 *
 * Es la pieza que vuelve autónomo al sistema: sin ella no se puede dar de
 * alta un producto sin tocar la API a mano.
 */
export function useProductAdmin() {
  const api = useApi()

  const productos = ref<Product[]>([])
  const categorias = ref<Category[]>([])
  const atributos = ref<AtributoProducto[]>([])

  const cargando = ref(false)
  const error = ref<string | null>(null)

  const busqueda = ref('')
  const categoriaActiva = ref<number | null>(null)
  const incluirInactivos = ref(true)

  const visibles = computed(() => {
    const texto = busqueda.value.trim().toLowerCase()

    return productos.value.filter((p) => {
      if (!incluirInactivos.value && !p.is_active) return false
      if (categoriaActiva.value !== null && p.category?.id !== categoriaActiva.value) return false
      if (texto && !p.name.toLowerCase().includes(texto)) return false
      return true
    })
  })

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      const [prods, cats, attrs] = await Promise.all([
        api.todas<Product>('/products'),
        api.get<{ data: Category[] }>('/categories'),
        api.get<{ data: AtributoProducto[] }>('/product-attributes')
      ])

      productos.value = prods
      categorias.value = cats.data
      atributos.value = attrs.data
    } catch {
      error.value = 'No se pudo cargar el catálogo.'
    } finally {
      cargando.value = false
    }
  }

  /**
   * Guarda el producto y, si hace falta, su foto.
   *
   * La foto va en una segunda llamada y no en la misma porque es
   * `multipart/form-data`, no JSON. Y va **después** de guardar, porque
   * un producto nuevo no tiene id contra el cual subirla hasta que el
   * servidor lo crea.
   */
  async function guardar(
    datos: ProductoAGuardar,
    id?: number,
    foto?: File | null,
    quitarFoto = false
  ): Promise<void> {
    const r = id === undefined
      ? await api.post<ApiResource<Product>>('/products', datos)
      : await api.put<ApiResource<Product>>(`/products/${id}`, datos)

    const productoId = r.data.id

    if (foto) {
      const cuerpo = new FormData()
      cuerpo.append('imagen', foto)

      await api.subir<ApiResource<Product>>(`/products/${productoId}/image`, cuerpo)
    } else if (quitarFoto) {
      await api.del(`/products/${productoId}/image`)
    }

    await cargar()
  }

  /** No borra: desactiva. Los tickets históricos siguen referenciándolo. */
  async function retirar(id: number): Promise<void> {
    await api.del(`/products/${id}`)
    await cargar()
  }

  return {
    productos,
    categorias,
    atributos,
    visibles,
    busqueda,
    categoriaActiva,
    incluirInactivos,
    cargando,
    error,
    cargar,
    guardar,
    retirar
  }
}
