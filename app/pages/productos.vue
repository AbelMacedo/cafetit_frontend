<script setup lang="ts">
import SelectorCategoria from '~/features/catalog/components/SelectorCategoria.vue'
import ProductoModal from '~/features/catalog/components/ProductoModal.vue'
import { useProductAdmin } from '~/features/catalog/composables/useProductAdmin'
import { ApiError } from '~/shared/composables/useApi'
import type { Product, ProductoAGuardar } from '~/shared/types/api'

/*
 * `altoCompleto`: la tabla se queda con el alto sobrante y es lo único
 * que se desplaza. En la tableta, con la página moviéndose por fuera y
 * la lista por dentro, el dedo arrastra lo que no era.
 */
definePageMeta({ middleware: 'auth', altoCompleto: true })

const toast = useToast()
const {
  productos, categorias, atributos, visibles, busqueda, categoriaActiva, incluirInactivos,
  cargando, error, cargar, guardar, retirar
} = useProductAdmin()

onMounted(cargar)

const retirados = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Sólo a la venta' }
]

const filtroRetirados = computed({
  get: () => (incluirInactivos.value ? 'todos' : 'activos'),
  set: (v: string | number) => {
    incluirInactivos.value = v === 'todos'
  }
})

/**
 * El estado de los retirados cuenta como filtro.
 *
 * Abrir en «sólo a la venta» es cómodo, pero es un recorte: quien no
 * encuentre un producto tiene que poder quitarlo de un toque sin
 * adivinar qué control lo está escondiendo.
 */
const filtrada = computed(() =>
  busqueda.value !== '' || categoriaActiva.value !== null || incluirInactivos.value
)

function limpiarFiltros(): void {
  busqueda.value = ''
  categoriaActiva.value = null
  incluirInactivos.value = false
}

const editando = ref<Product | null>(null)
const creando = ref(false)
const guardando = ref(false)
const errorForm = ref<string | null>(null)

const modalAbierto = computed(() => creando.value || editando.value !== null)

function nuevo() {
  editando.value = null
  errorForm.value = null
  creando.value = true
}

function editar(p: Product) {
  creando.value = false
  errorForm.value = null
  editando.value = p
}

function cerrar() {
  creando.value = false
  editando.value = null
}

async function alGuardar(datos: ProductoAGuardar, foto: File | null, quitarFoto: boolean) {
  guardando.value = true
  errorForm.value = null

  const esNuevo = editando.value === null

  try {
    await guardar(datos, editando.value?.id, foto, quitarFoto)
    cerrar()

    toast.add({
      title: esNuevo ? 'Producto dado de alta' : 'Producto actualizado',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (e) {
    errorForm.value = e instanceof ApiError ? e.message : 'No se pudo guardar.'
  } finally {
    guardando.value = false
  }
}

/*
 * Retirar pide confirmación.
 *
 * Es reversible —nada se borra, el producto se desactiva— pero eso no lo
 * hace gratis: un producto retirado desaparece de la pantalla de venta, y
 * en un mostrador eso se descubre con un cliente enfrente. Reversible no
 * es lo mismo que inofensivo.
 */
const retirando = ref<Product | null>(null)
const trabajandoRetiro = ref(false)

async function confirmarRetiro() {
  if (retirando.value === null) return

  const nombre = retirando.value.name
  trabajandoRetiro.value = true

  try {
    await retirar(retirando.value.id)
    retirando.value = null

    toast.add({
      title: `${nombre} quedó retirado`,
      description: 'Deja de aparecer en la pantalla de venta. Sus ventas anteriores no cambian.',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (e) {
    toast.add({
      title: 'No se pudo retirar',
      description: e instanceof ApiError ? e.message : undefined,
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    trabajandoRetiro.value = false
  }
}

/** Rango de precios: lo que el mostrador necesita ver de un vistazo. */
function rangoDePrecios(p: Product): string {
  const precios = (p.variants ?? []).map(v => v.price)
  if (precios.length === 0) return '—'

  const min = precios.reduce((a, b) => (a.cents < b.cents ? a : b))
  const max = precios.reduce((a, b) => (a.cents > b.cents ? a : b))

  return min.cents === max.cents ? min.formatted : `${min.formatted} – ${max.formatted}`
}
</script>

<template>
  <div class="space-y-3 md:h-full md:flex md:flex-col md:min-h-0">
    <PaginaTitulo
      titulo="Productos"
      descripcion="El catálogo que ve el mostrador. Cada producto puede tener varias presentaciones."
    >
      <template #acciones>
        <UButton
          icon="i-lucide-plus"
          class="toque"
          @click="nuevo"
        >
          Nuevo producto
        </UButton>
      </template>
    </PaginaTitulo>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <BarraFiltros
      :visibles="visibles.length"
      :total="productos.length"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Buscar producto..."
          icon="i-lucide-search"
          size="lg"
          class="w-44 2xl:w-56"
        />
      </template>

      <template #filtros>
        <SelectorCategoria
          v-model="categoriaActiva"
          :categorias="categorias"
          tamano="lg"
          ancho="w-44 2xl:w-52"
        />

        <FiltroSelect
          v-model="filtroRetirados"
          :opciones="retirados"
          tamano="lg"
          etiqueta="Filtrar por estado del producto"
          icono="i-lucide-eye"
          ancho="w-44 2xl:w-48"
        />

        <!--
          Limpiar pierde el rótulo antes de que la fila se parta: el icono
          dice lo mismo en la mitad de sitio y el nombre sigue en el
          `title` y para el lector de pantalla.
        -->
        <UButton
          size="lg"
          variant="ghost"
          color="neutral"
          icon="i-lucide-filter-x"
          title="Quitar los filtros"
          aria-label="Quitar los filtros"
          :disabled="!filtrada"
          @click="limpiarFiltros"
        >
          <span class="hidden 2xl:inline">Limpiar</span>
        </UButton>
      </template>
    </BarraFiltros>

    <EsqueletoLista
      v-if="cargando"
      :filas="5"
    />

    <SinResultados
      v-else-if="visibles.length === 0"
      icono="i-lucide-coffee"
      :titulo="productos.length === 0 ? 'Todavía no hay productos' : 'Ninguno coincide'"
      :descripcion="productos.length === 0
        ? 'Da de alta el primero para poder vender.'
        : 'Prueba con otro nombre o quita el filtro de categoría.'"
    >
      <template #accion>
        <UButton
          v-if="productos.length === 0"
          icon="i-lucide-plus"
          @click="nuevo"
        >
          Nuevo producto
        </UButton>
        <UButton
          v-else
          variant="outline"
          color="neutral"
          icon="i-lucide-filter-x"
          @click="limpiarFiltros"
        >
          Quitar filtros
        </UButton>
      </template>
    </SinResultados>

    <!--
      Tabla, no tarjetas: aquí se recorre comparando —qué cuesta cada
      cosa, cuál controla inventario, cuál salió de la venta— y eso se
      hace con la vista en columnas alineadas.
    -->
    <div
      v-else
      class="tarjeta overflow-hidden md:flex-1 md:min-h-0"
    >
      <div class="overflow-auto max-h-[60vh] md:max-h-none md:h-full">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10">
            <tr class="text-center [&>th]:border-r [&>th]:border-borde [&>th:last-child]:border-r-0">
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Producto
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde hidden lg:table-cell">
                Categoría
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde hidden lg:table-cell">
                Presentaciones
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Precio
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="p in visibles"
              :key="p.id"
              class="border-b border-borde-suave last:border-0 transition
                     [&>td]:border-r [&>td]:border-borde-suave [&>td:last-child]:border-r-0"
              :class="p.is_active ? '' : 'text-apagado-2'"
            >
              <td class="px-3 lg:px-4 py-4 text-center w-1/3 max-w-0">
                <span class="block truncate">
                  <span class="font-medium">{{ p.name }}</span>

                  <!--
                    Las dos insignias dicen cosas distintas: «Retirado» es
                    un estado del producto y «Web» es dónde se muestra. Van
                    junto al nombre porque califican al nombre.
                  -->
                  <UBadge
                    v-if="!p.is_active"
                    color="neutral"
                    variant="subtle"
                    size="md"
                    class="ml-2 align-middle"
                  >
                    Retirado
                  </UBadge>
                  <UBadge
                    v-if="p.show_on_landing"
                    color="primary"
                    variant="subtle"
                    size="md"
                    class="ml-2 align-middle"
                  >
                    Web
                  </UBadge>
                </span>

                <!-- En angosto la categoría se mete aquí: su columna se oculta. -->
                <span class="block truncate text-xs text-apagado lg:hidden">
                  {{ p.category?.name }}
                </span>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center w-1/5 max-w-0 truncate text-apagado hidden lg:table-cell">
                {{ p.category?.name }}
              </td>

              <!--
                «Controla inventario» va aquí y no suelto al final: es una
                propiedad de las presentaciones —son ellas las que llevan
                existencias— y leerlo al lado del número lo explica.
              -->
              <td class="px-3 lg:px-4 py-4 text-center tabular-nums whitespace-nowrap hidden lg:table-cell">
                {{ p.variants?.length ?? 0 }}
                <span
                  v-if="p.variants?.[0]?.tracks_stock"
                  class="block text-xs text-apagado"
                >con inventario</span>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center tabular-nums font-medium whitespace-nowrap">
                {{ rangoDePrecios(p) }}
              </td>

              <td class="px-3 lg:px-4 py-4 text-center whitespace-nowrap">
                <span class="inline-flex items-center gap-1">
                  <UButton
                    size="sm"
                    variant="outline"
                    color="neutral"
                    icon="i-lucide-pencil"
                    title="Editar"
                    aria-label="Editar"
                    @click="editar(p)"
                  >
                    <span class="hidden lg:inline">Editar</span>
                  </UButton>

                  <UButton
                    v-if="p.is_active"
                    size="sm"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-eye-off"
                    title="Retirar de la venta"
                    aria-label="Retirar de la venta"
                    @click="retirando = p"
                  >
                    <span class="hidden lg:inline">Retirar</span>
                  </UButton>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <DialogoConfirmar
      v-if="retirando"
      :titulo="`¿Retirar ${retirando.name}?`"
      descripcion="Deja de aparecer en la pantalla de venta. No se borra nada: sus ventas anteriores siguen igual y se puede volver a activar."
      confirmar="Sí, retirar"
      :trabajando="trabajandoRetiro"
      @confirmar="confirmarRetiro"
      @cancelar="retirando = null"
    />

    <!--
      Montado con v-if: el modal contiene selectores con capas anidadas, y
      con `:open` solo el diálogo no se desmonta si alguna quedó abierta.
      Su overlay se quedaría encima bloqueando la pantalla — pasó de verdad.
    -->
    <ProductoModal
      v-if="modalAbierto"
      :producto="editando"
      :categorias="categorias"
      :atributos="atributos"
      :guardando="guardando"
      :error="errorForm"
      @guardar="alGuardar"
      @cerrar="cerrar"
    />
  </div>
</template>
