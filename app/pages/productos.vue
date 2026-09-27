<script setup lang="ts">
import SelectorCategoria from '~/features/catalog/components/SelectorCategoria.vue'
import ProductoModal from '~/features/catalog/components/ProductoModal.vue'
import { useProductAdmin } from '~/features/catalog/composables/useProductAdmin'
import { ApiError } from '~/shared/composables/useApi'
import type { Product, ProductoAGuardar } from '~/shared/types/api'

definePageMeta({ middleware: 'auth' })

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
  <div class="space-y-6">
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
      :filtrada="busqueda !== '' || categoriaActiva !== null"
      @limpiar="busqueda = ''; categoriaActiva = null"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Buscar producto..."
          icon="i-lucide-search"
          class="w-56"
        />
      </template>

      <template #filtros>
        <SelectorCategoria
          v-model="categoriaActiva"
          :categorias="categorias"
        />

        <FiltroSelect
          v-model="filtroRetirados"
          :opciones="retirados"
          etiqueta="Filtrar por estado del producto"
          icono="i-lucide-eye"
          ancho="w-48"
        />
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
          @click="busqueda = ''; categoriaActiva = null"
        >
          Quitar filtros
        </UButton>
      </template>
    </SinResultados>

    <div
      v-else
      class="space-y-2"
    >
      <div
        v-for="p in visibles"
        :key="p.id"
        class="tarjeta p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
        :class="p.is_active ? '' : 'opacity-60'"
      >
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium leading-tight">
              {{ p.name }}
            </p>
            <UBadge
              v-if="!p.is_active"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              Retirado
            </UBadge>
            <UBadge
              v-if="p.show_on_landing"
              color="primary"
              variant="subtle"
              size="sm"
            >
              Web
            </UBadge>
          </div>
          <p class="text-xs text-beige-600">
            {{ p.category?.name }}
            <template v-if="(p.variants?.length ?? 0) > 1">
              · {{ p.variants?.length }} variantes
            </template>
            <template v-if="p.variants?.[0]?.tracks_stock">
              · controla inventario
            </template>
          </p>
        </div>

        <!--
          Precio y acciones viajan juntos en su propio bloque.

          En un teléfono, con todo en la misma fila, el nombre se queda
          con un tercio del ancho y «Frappé de café» se parte en tres
          renglones. Así el nombre ocupa su línea completa y esto baja
          debajo, repartido de extremo a extremo.
        -->
        <div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
          <span class="text-sm font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
            {{ rangoDePrecios(p) }}
          </span>

          <span class="flex items-center gap-1">
            <UButton
              size="xs"
              variant="outline"
              color="neutral"
              icon="i-lucide-pencil"
              @click="editar(p)"
            >
              Editar
            </UButton>

            <UButton
              v-if="p.is_active"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="retirando = p"
            >
              Retirar
            </UButton>
          </span>
        </div>
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
