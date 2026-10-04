import { defineStore } from 'pinia'
import type { ApiResource, Entorno, User } from '~/shared/types/api'
import { useApi } from '~/shared/composables/useApi'

/**
 * Sesión del cajero.
 *
 * No guarda tokens ni credenciales: la sesión vive en una cookie HttpOnly
 * que este código no puede leer. Aquí sólo se refleja *quién* está dentro,
 * para pintar la interfaz.
 */
/**
 * Toda respuesta que establece sesión dice también en qué entorno estamos.
 *
 * El `?` no sobra: una API anterior a esto no lo manda, y entonces vale
 * más no pintar nada que pintar una suposición.
 */
type RespuestaDeSesion = ApiResource<User> & { entorno?: Entorno }

export const useAuthStore = defineStore('auth', () => {
  const api = useApi()

  const user = ref<User | null>(null)
  const cargando = ref(false)
  const verificado = ref(false)

  /*
   * El entorno lo dice la API al recuperar la sesión.
   *
   * Arranca en null —«todavía no se sabe»— y no en «producción»: pintar
   * una suposición sería exactamente lo que este dato viene a evitar.
   */
  const entorno = ref<Entorno | null>(null)

  const esPruebas = computed(() => entorno.value?.es_produccion === false)

  const autenticado = computed(() => user.value !== null)
  const sucursal = computed(() => user.value?.store ?? null)

  async function login(email: string, password: string): Promise<void> {
    cargando.value = true
    try {
      const respuesta = await api.post<RespuestaDeSesion>('/login', { email, password })
      user.value = respuesta.data
      entorno.value = respuesta.entorno ?? null
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
   * Cambia de cajero con el PIN, sin cerrar la sesión de la terminal.
   *
   * La cookie es la misma: el servidor cambia a quién pertenece. Por
   * eso aquí sólo se refresca el usuario en pantalla — no hay nada que
   * limpiar ni a dónde navegar, y el turno de caja abierto sigue
   * abierto.
   *
   * Devuelve el nombre de quien entra, para el aviso.
   */
  async function cambiarCajero(pin: string): Promise<string> {
    const respuesta = await api.post<RespuestaDeSesion>('/pin-unlock', { pin })

    user.value = respuesta.data
    entorno.value = respuesta.entorno ?? null

    return respuesta.data.name
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
      const respuesta = await api.get<RespuestaDeSesion>('/me')
      user.value = respuesta.data
      entorno.value = respuesta.entorno ?? null
    } catch {
      user.value = null
    } finally {
      verificado.value = true
    }
  }

  return {
    user, cargando, verificado, autenticado, sucursal,
    entorno, esPruebas,
    login, logout, cambiarCajero, recuperarSesion
  }
})
