import { useApi } from '~/shared/composables/useApi'
import type {
  ApiCollection,
  ApiResource,
  AjustesLealtad,
  BusquedaCliente,
  Cliente,
  MovimientoLealtad,
  ProgramaLealtad,
  Recompensa,
  RecompensaVigente
} from '~/shared/types/api'

/** Los diez dígitos, sin lo que el cajero haya tecleado de adorno. */
export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

export function telefonoValido(texto: string): boolean {
  return soloDigitos(texto).length === 10
}

/**
 * El programa de lealtad, desde el mostrador.
 *
 * La búsqueda por teléfono es LA llamada de esta pantalla: el cajero
 * teclea diez dígitos con alguien enfrente. Responde 200 con `data: null`
 * cuando no existe, no 404 — «no está registrado» es el día a día, no un
 * error, y hay que poder ofrecer el alta sin tratarlo como una falla.
 */
export function useLoyalty() {
  const api = useApi()

  const buscando = ref(false)
  const encontrado = ref<Cliente | null>(null)
  const buscado = ref(false)
  const programa = ref<ProgramaLealtad | null>(null)

  /** Las que hoy se pueden entregar. Las decide el servidor, no la fecha local. */
  const vigentes = ref<RecompensaVigente[]>([])

  const error = ref<string | null>(null)

  const activo = computed(() => programa.value?.activo === true)

  const puedeCanjear = computed(() => {
    const c = encontrado.value
    const p = programa.value

    if (!c || !p || c.sellos === undefined) return false

    return c.sellos >= p.sellos_para_premio
  })

  async function buscar(telefono: string): Promise<Cliente | null> {
    if (!telefonoValido(telefono)) {
      error.value = 'El teléfono debe tener diez dígitos.'
      return null
    }

    buscando.value = true
    error.value = null

    try {
      const r = await api.get<BusquedaCliente>('/customers/search', {
        telefono: soloDigitos(telefono)
      })

      encontrado.value = r.data
      programa.value = r.programa
      buscado.value = true

      return r.data
    } catch {
      error.value = 'No se pudo buscar al cliente.'
      return null
    } finally {
      buscando.value = false
    }
  }

  /**
   * Da de alta a quien dijo que sí.
   *
   * El aviso que el cajero tiene que leerle —que su número no se usa para
   * nada más y que su nombre es el único dato visible— vive en el
   * formulario, no aquí.
   */
  async function registrar(nombre: string, telefono: string): Promise<Cliente> {
    const r = await api.post<ApiResource<Cliente>>('/customers', {
      nombre,
      telefono: soloDigitos(telefono)
    })

    encontrado.value = r.data
    buscado.value = true

    return r.data
  }

  function limpiar(): void {
    encontrado.value = null
    buscado.value = false
    error.value = null
  }

  async function cargarPrograma(): Promise<void> {
    const r = await api.get<{ data: RecompensaVigente[], programa: ProgramaLealtad }>('/loyalty/rewards')

    programa.value = r.programa
    vigentes.value = r.data
  }

  return {
    buscando,
    encontrado,
    buscado,
    programa,
    vigentes,
    activo,
    puedeCanjear,
    error,
    buscar,
    registrar,
    limpiar,
    cargarPrograma
  }
}

/**
 * La lista de clientes y la ficha de cada uno.
 *
 * Se busca por NOMBRE, no por teléfono: el número no se guarda, así que
 * no hay nada contra lo que comparar parcialmente. Para encontrar a
 * alguien por su número está la búsqueda del mostrador, que exige los
 * diez dígitos exactos.
 */
export function useCustomers() {
  const api = useApi()

  const clientes = ref<Cliente[]>([])
  const programa = ref<ProgramaLealtad | null>(null)
  const cargando = ref(false)
  const error = ref<string | null>(null)
  const busqueda = ref('')

  const conSellos = computed(() =>
    clientes.value.filter(c => (c.sellos ?? 0) > 0).length
  )

  const listosParaPremio = computed(() => {
    const meta = programa.value?.sellos_para_premio ?? 10

    return clientes.value.filter(c => (c.sellos ?? 0) >= meta).length
  })

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      /*
       | Página por página hasta el final.
       |
       | Pedir `per_page: 200` y confiar en que quepan es cómo una lista
       | se queda sin su cliente 201 sin avisar a nadie.
       */
      clientes.value = await api.todas<Cliente>('/customers', {
        q: busqueda.value.trim() || undefined
      })
    } catch {
      error.value = 'No se pudo cargar la lista de clientes.'
    } finally {
      cargando.value = false
    }
  }

  async function ficha(id: number): Promise<{
    cliente: Cliente
    movimientos: MovimientoLealtad[]
    programa: ProgramaLealtad
  }> {
    const r = await api.get<{
      data: Cliente
      movimientos: MovimientoLealtad[]
      programa: ProgramaLealtad
    }>(`/customers/${id}`)

    programa.value = r.programa

    return { cliente: r.data, movimientos: r.movimientos, programa: r.programa }
  }

  /**
   * Da de baja a un cliente, de verdad.
   *
   * Esto SÍ borra, al revés que todo lo demás del sistema. Lo que hay
   * guardado son datos de una persona que pidió estar; si pide salir, no
   * puede quedarse una versión desactivada de ella.
   */
  async function borrar(id: number): Promise<string> {
    const r = await api.del<{ message: string }>(`/customers/${id}`)
    await cargar()

    return r.message
  }

  return {
    clientes,
    programa,
    cargando,
    error,
    busqueda,
    conSellos,
    listosParaPremio,
    cargar,
    ficha,
    borrar
  }
}

/** Lo que el formulario manda al crear o cambiar una recompensa. */
export interface DatosRecompensa {
  nombre: string
  product_variant_id: number | null
  desde: string
  hasta: string
  activa: boolean
}

/**
 * Las recompensas del mes y la configuración del programa.
 *
 * El negocio decide cada mes lo que entrega —en octubre un pan de
 * muerto, en enero rosca— sin tocar código. Por eso la vigencia es un
 * rango de fechas y no un interruptor.
 */
export function useRewards() {
  const api = useApi()

  const recompensas = ref<Recompensa[]>([])
  const ajustes = ref<AjustesLealtad>({
    activo: false,
    compra_minima_cents: 0,
    sellos_para_premio: 10
  })

  const cargando = ref(false)
  const error = ref<string | null>(null)

  const hoy = new Date().toISOString().slice(0, 10)

  const vigentes = computed(() =>
    recompensas.value.filter(r => r.activa && r.desde <= hoy && r.hasta >= hoy)
  )

  async function cargar(): Promise<void> {
    cargando.value = true
    error.value = null

    try {
      const [lista, config] = await Promise.all([
        api.get<ApiCollection<Recompensa>>('/loyalty/rewards/all'),
        api.get<ApiResource<AjustesLealtad>>('/loyalty/settings')
      ])

      recompensas.value = lista.data
      ajustes.value = config.data
    } catch {
      error.value = 'No se pudieron cargar las recompensas.'
    } finally {
      cargando.value = false
    }
  }

  async function crear(datos: DatosRecompensa): Promise<void> {
    await api.post<ApiResource<Recompensa>>('/loyalty/rewards', datos)
    await cargar()
  }

  async function editar(id: number, datos: Partial<DatosRecompensa>): Promise<void> {
    await api.patch<ApiResource<Recompensa>>(`/loyalty/rewards/${id}`, datos)
    await cargar()
  }

  /** No borra: desactiva. Los canjes hechos siguen apuntando a su premio. */
  async function desactivar(id: number): Promise<void> {
    await api.del(`/loyalty/rewards/${id}`)
    await cargar()
  }

  async function guardarAjustes(datos: AjustesLealtad): Promise<void> {
    const r = await api.put<ApiResource<AjustesLealtad>>('/loyalty/settings', datos)
    ajustes.value = r.data
  }

  return {
    recompensas,
    vigentes,
    ajustes,
    cargando,
    error,
    cargar,
    crear,
    editar,
    desactivar,
    guardarAjustes
  }
}
