import type { ApiCollection, ValidationError } from '~/shared/types/api'

/**
 * Cliente único de la API.
 *
 * Todo el tráfico pasa por aquí. Nada de `$fetch` suelto en componentes:
 * un solo lugar donde vivan las credenciales de sesión, el token CSRF, el
 * manejo de errores y el cierre de sesión por expiración.
 */

let csrfListo = false

/**
 * Pide la cookie CSRF antes de la primera petición que modifique algo.
 *
 * Sanctum la entrega como cookie XSRF-TOKEN legible por JavaScript; la
 * cookie de SESIÓN, en cambio, es HttpOnly y nunca la vemos. Ése es el
 * punto: la credencial real no está al alcance de ningún script.
 */
async function asegurarCsrf(base: string): Promise<void> {
  if (csrfListo) return

  await $fetch('/sanctum/csrf-cookie', {
    baseURL: base,
    credentials: 'include'
  })

  csrfListo = true
}

function leerCookie(nombre: string): string | null {
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${nombre}=([^;]*)`))
  return match?.[2] ? decodeURIComponent(match[2]) : null
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: Record<string, string[]> = {}
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Primer mensaje de error de un campo, para mostrarlo junto al input. */
  campo(nombre: string): string | undefined {
    return this.errors[nombre]?.[0]
  }

  get esValidacion(): boolean {
    return this.status === 422
  }

  get esNoAutenticado(): boolean {
    return this.status === 401 || this.status === 419
  }

  get esDemasiadosIntentos(): boolean {
    return this.status === 429
  }
}

export function useApi() {
  const base = useRuntimeConfig().public.apiBase

  async function request<T>(
    ruta: string,
    opciones: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: unknown
      query?: Record<string, string | number | boolean | undefined>
    } = {}
  ): Promise<T> {
    const method = opciones.method ?? 'GET'

    if (method !== 'GET') {
      await asegurarCsrf(base)
    }

    const headers: Record<string, string> = {
      Accept: 'application/json'
    }

    const xsrf = import.meta.client ? leerCookie('XSRF-TOKEN') : null
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf

    try {
      return await $fetch<T>(`/api/v1${ruta}`, {
        baseURL: base,
        method,
        headers,
        // `FormData` pasa tal cual: ofetch lo reconoce y deja que el
        // navegador ponga el Content-Type con su separador.
        body: opciones.body as Record<string, unknown> | FormData | undefined,
        query: opciones.query,

        // Manda la cookie de sesión en peticiones a otro origen.
        // Sin esto, la autenticación por cookie simplemente no funciona.
        credentials: 'include'
      })
    } catch (error: unknown) {
      throw normalizar(error)
    }
  }

  function normalizar(error: unknown): ApiError {
    const e = error as { status?: number, statusCode?: number, data?: ValidationError }
    const status = e.status ?? e.statusCode ?? 0

    // Una sesión caducada no es un error que cada pantalla deba resolver:
    // se limpia el estado una vez, aquí.
    if (status === 401 || status === 419) {
      csrfListo = false
    }

    return new ApiError(
      status,
      e.data?.message ?? 'No se pudo conectar con el servidor.',
      e.data?.errors ?? {}
    )
  }

  /**
   * Un listado entero, página por página.
   *
   * Para los catálogos que la pantalla necesita **completos**. Antes se
   * pedía `per_page: 200` y se daba por hecho que cabrían: con 201
   * productos, el 201 no aparecía en el mostrador y **no se podía
   * vender**, sin un aviso ni un hueco visible. Un fallo callado.
   *
   * El tope de páginas existe para que un `meta` equivocado no deje al
   * navegador pidiendo páginas para siempre. Son 5.000 productos; si una
   * cafetería llega ahí, el problema es otro.
   */
  async function todas<T>(
    ruta: string,
    query: Record<string, string | number | boolean | undefined> = {},
    porPagina = 200
  ): Promise<T[]> {
    const PAGINAS_MAXIMAS = 25

    const items: T[] = []
    let pagina = 1
    let ultima = 1

    while (pagina <= ultima && pagina <= PAGINAS_MAXIMAS) {
      const r = await request<ApiCollection<T>>(ruta, {
        method: 'GET',
        query: { ...query, per_page: porPagina, page: pagina }
      })

      items.push(...r.data)

      // Sin `meta` el endpoint no pagina: lo que vino es todo.
      ultima = r.meta?.last_page ?? 1
      pagina++
    }

    return items
  }

  return {
    get: <T>(ruta: string, query?: Record<string, string | number | boolean | undefined>) =>
      request<T>(ruta, { method: 'GET', query }),

    todas,

    post: <T>(ruta: string, body?: unknown) => request<T>(ruta, { method: 'POST', body }),

    /**
     * Subida de archivos.
     *
     * Existe aparte de `post` porque un `FormData` no se serializa como
     * JSON: el navegador tiene que poner él mismo el `Content-Type` con
     * el separador del multipart, y para eso hay que no tocarlo. Tenerlo
     * como método propio evita que alguien le pase un FormData a `post`
     * y se pregunte por qué el servidor recibe un objeto vacío.
     */
    subir: <T>(ruta: string, datos: FormData) =>
      request<T>(ruta, { method: 'POST', body: datos }),

    put: <T>(ruta: string, body?: unknown) => request<T>(ruta, { method: 'PUT', body }),
    patch: <T>(ruta: string, body?: unknown) => request<T>(ruta, { method: 'PATCH', body }),
    del: <T>(ruta: string) => request<T>(ruta, { method: 'DELETE' })
  }
}
