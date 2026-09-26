import { defineStore } from 'pinia'
import type { ApiResource, User } from '~/shared/types/api'
import { useApi } from '~/shared/composables/useApi'

/**
 * Sesión del cajero.
 *
 * No guarda tokens ni credenciales: la sesión vive en una cookie HttpOnly
 * que este código no puede leer. Aquí sólo se refleja *quién* está dentro,
 * para pintar la interfaz.
 */
export const useAuthStore = defineStore('auth', () => {
  const api = useApi()

  const user = ref<User | null>(null)
  const cargando = ref(false)
  const verificado = ref(false)

  const autenticado = computed(() => user.value !== null)
  const sucursal = computed(() => user.value?.store ?? null)

  async function login(email: string, password: string): Promise<void> {
    cargando.value = true
    try {
      const respuesta = await api.post<ApiResource<User>>('/login', { email, password })
      user.value = respuesta.data
      verificado.value = true
    } finally {
      cargando.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/logout')
    } finally {
      // Se limpia pase lo que pase: si la petición falló porque la sesión
      // ya había caducado, el resultado deseado es el mismo.
      user.value = null
      verificado.value = true
      await navigateTo('/login')
    }
  }

  /**
   * Comprueba contra el servidor si la cookie sigue siendo válida.
   *
   * Se llama al arrancar la aplicación. Es la única forma de saberlo:
   * el frontend no puede inspeccionar una cookie HttpOnly.
   */
  async function recuperarSesion(): Promise<void> {
    if (verificado.value) return

    try {
      const respuesta = await api.get<ApiResource<User>>('/me')
      user.value = respuesta.data
    } catch {
      user.value = null
    } finally {
      verificado.value = true
    }
  }

  return { user, cargando, verificado, autenticado, sucursal, login, logout, recuperarSesion }
})
