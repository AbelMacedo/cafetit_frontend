import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Cliente de API.
 *
 * Todo el tráfico del POS pasa por aquí, así que lo que se prueba es lo
 * que se rompe en silencio: que la cookie CSRF se pida antes de la
 * primera escritura y no en cada una, que un 422 llegue a la pantalla
 * como errores por campo y no como un mensaje suelto, y que una sesión
 * caducada deje el cliente listo para volver a empezar.
 */

interface Llamada {
  ruta: string
  opciones: Record<string, unknown>
}

let llamadas: Llamada[] = []
let respuesta: unknown = { data: [] }
let error: unknown = null

/**
 * `useApi` se importa dentro de cada prueba, no arriba.
 *
 * El módulo guarda en una variable suya si ya pidió la cookie CSRF.
 * Importándolo de nuevo tras `resetModules`, cada prueba empieza con esa
 * bandera en blanco — si no, la segunda prueba heredaría el estado de la
 * primera y pasaría por el motivo equivocado.
 */
async function cargarCliente() {
  vi.resetModules()

  return import('~/shared/composables/useApi')
}

beforeEach(() => {
  llamadas = []
  respuesta = { data: [] }
  error = null

  Object.assign(globalThis, {
    useRuntimeConfig: () => ({ public: { apiBase: 'http://api.test' } }),

    $fetch: (ruta: string, opciones: Record<string, unknown> = {}) => {
      llamadas.push({ ruta, opciones })

      if (error !== null && ruta !== '/sanctum/csrf-cookie') {
        return Promise.reject(error)
      }

      return Promise.resolve(respuesta)
    }
  })
})

describe('useApi', () => {
  it('antepone la versión de la API y manda la cookie de sesión', async () => {
    const { useApi } = await cargarCliente()

    await useApi().get('/products')

    expect(llamadas[0]!.ruta).toBe('/api/v1/products')
    expect(llamadas[0]!.opciones.baseURL).toBe('http://api.test')
    expect(llamadas[0]!.opciones.credentials).toBe('include')
  })

  it('no pide la cookie CSRF para leer', async () => {
    const { useApi } = await cargarCliente()

    await useApi().get('/products')

    expect(llamadas.map(l => l.ruta)).not.toContain('/sanctum/csrf-cookie')
  })

  it('pide la cookie CSRF antes de la primera escritura, una sola vez', async () => {
    const { useApi } = await cargarCliente()
    const api = useApi()

    await api.post('/sales', {})
    await api.post('/sales', {})

    const csrf = llamadas.filter(l => l.ruta === '/sanctum/csrf-cookie')

    expect(csrf).toHaveLength(1)
    expect(llamadas[0]!.ruta).toBe('/sanctum/csrf-cookie')
  })

  it('convierte un 422 en errores por campo', async () => {
    const { ApiError, useApi } = await cargarCliente()

    error = {
      status: 422,
      data: {
        message: 'Los datos no son válidos.',
        errors: { email: ['Ya hay una cuenta con ese correo.'] }
      }
    }

    await expect(useApi().post('/users', {})).rejects.toThrow(ApiError)

    try {
      await useApi().post('/users', {})
    } catch (e) {
      const fallo = e as InstanceType<typeof ApiError>

      expect(fallo.esValidacion).toBe(true)
      expect(fallo.message).toBe('Los datos no son válidos.')
      expect(fallo.campo('email')).toBe('Ya hay una cuenta con ese correo.')
      expect(fallo.campo('nombre')).toBeUndefined()
    }
  })

  it('reconoce la sesión caducada y el exceso de intentos', async () => {
    const { useApi } = await cargarCliente()
    const api = useApi()

    for (const [status, propiedad] of [
      [401, 'esNoAutenticado'],
      [419, 'esNoAutenticado'],
      [429, 'esDemasiadosIntentos']
    ] as const) {
      error = { status, data: { message: 'x' } }

      await api.get('/me').catch((e) => {
        expect(e[propiedad]).toBe(true)
      })
    }
  })

  it('tras una sesión caducada vuelve a pedir la cookie CSRF', async () => {
    /*
     * La cookie CSRF va atada a la sesión. Si la sesión murió, la que
     * tenemos ya no sirve: seguir usándola haría fallar cada escritura
     * posterior con un 419 que parecería un problema distinto.
     */
    const { useApi } = await cargarCliente()
    const api = useApi()

    await api.post('/sales', {})
    expect(llamadas.filter(l => l.ruta === '/sanctum/csrf-cookie')).toHaveLength(1)

    error = { status: 401, data: { message: 'No autenticado.' } }
    await api.get('/me').catch(() => {})

    error = null
    await api.post('/sales', {})

    expect(llamadas.filter(l => l.ruta === '/sanctum/csrf-cookie')).toHaveLength(2)
  })

  it('da un mensaje legible cuando el servidor no contesta', async () => {
    const { useApi } = await cargarCliente()

    // Sin `data`: es lo que llega cuando no hay red o el servidor está caído.
    error = { status: 0 }

    await expect(useApi().get('/products')).rejects.toThrow(
      'No se pudo conectar con el servidor.'
    )
  })

  it('acepta el statusCode de Nitro además del status de fetch', async () => {
    const { useApi } = await cargarCliente()

    error = { statusCode: 422, data: { message: 'Inválido', errors: {} } }

    await useApi().post('/sales', {}).catch((e) => {
      expect(e.status).toBe(422)
      expect(e.esValidacion).toBe(true)
    })
  })
})
