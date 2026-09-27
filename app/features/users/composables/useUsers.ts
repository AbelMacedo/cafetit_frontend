import { useApi } from '~/shared/composables/useApi'
import type { ApiResource, User } from '~/shared/types/api'

/** Lo que el formulario manda al dar de alta a alguien. */
export interface AltaEmpleado {
  name: string
  email: string
  password: string
  password_confirmation: string
  pin?: string
}

/**
 * Edición parcial: lo que no se manda, no se toca.
 *
 * `current_password` sólo viaja cuando alguien cambia su propia
 * contraseña; para la de un compañero el backend no la pide.
 */
export interface CambioEmpleado {
  name?: string
  email?: string
  password?: string
  password_confirmation?: string
  current_password?: string
  pin?: string
  is_active?: boolean
}

/**
 * Empleados.
 *
 * No hay roles: todos pueden todo. Lo que hay es baja lógica y bitácora,
 * así que esta pantalla nunca borra — desactiva y reactiva.
 */
export function useUsers() {
  const api = useApi()

  const empleados = ref<User[]>([])
  const cargando = ref(false)
  const error = ref<string | null>(null)

  const busqueda = ref('')
  const incluirInactivos = ref(true)

  const visibles = computed(() => {
    const texto = busqueda.value.trim().toLowerCase()

    return empleados.value.filter((u) => {
      if (!incluirInactivos.value && !u.is_active) return false
      if (texto && !`${u.name} ${u.email}`.toLowerCase().includes(texto)) return false
      return true
    })
  })

  const activos = computed(() => empleados.value.filter(u => u.is_active).length)

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      const r = await api.get<{ data: User[] }>('/users')
      empleados.value = r.data
    } catch {
      error.value = 'No se pudo cargar la lista de empleados.'
    } finally {
      cargando.value = false
    }
  }

  async function crear(datos: AltaEmpleado): Promise<void> {
    await api.post<ApiResource<User>>('/users', datos)
    await cargar()
  }

  async function editar(id: number, datos: CambioEmpleado): Promise<void> {
    await api.put<ApiResource<User>>(`/users/${id}`, datos)
    await cargar()
  }

  /** No borra: da de baja. Sus ventas y cortes siguen teniendo nombre. */
  async function darDeBaja(id: number): Promise<void> {
    await api.del(`/users/${id}`)
    await cargar()
  }

  async function reactivar(id: number): Promise<void> {
    await editar(id, { is_active: true })
  }

  return {
    empleados,
    visibles,
    activos,
    busqueda,
    incluirInactivos,
    cargando,
    error,
    cargar,
    crear,
    editar,
    darDeBaja,
    reactivar
  }
}
