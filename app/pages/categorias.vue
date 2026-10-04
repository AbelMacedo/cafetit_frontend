<script setup lang="ts">
import CategoriaModal from '~/features/catalog/components/CategoriaModal.vue'
import { type CategoriaAGuardar, useCategories } from '~/features/catalog/composables/useCategories'
import { ApiError } from '~/shared/composables/useApi'
import type { Category } from '~/shared/types/api'

/*
 * `altoCompleto`: la tabla se queda con el alto sobrante y es lo único
 * que se desplaza.
 */
definePageMeta({ middleware: 'auth', altoCompleto: true })

const toast = useToast()

const {
  categorias, visibles, activas, busqueda, incluirInactivas,
  cargando, error, cargar, guardar, retirar, reactivar
} = useCategories()

onMounted(cargar)

const creando = ref(false)
const editando = ref<Category | null>(null)
const modalAbierto = computed(() => creando.value || editando.value !== null)

/** Fuerza un modal nuevo al cambiar de categoría: los `ref` del
 *  formulario se inicializan una sola vez, al montarse. */
const claveModal = computed(() => editando.value?.id ?? 'alta')

const guardando = ref(false)
const errorForm = ref<string | null>(null)
const erroresForm = ref<Record<string, string>>({})

function cerrar() {
  creando.value = false
  editando.value = null
  errorForm.value = null
  erroresForm.value = {}
}

async function alGuardar(datos: CategoriaAGuardar, id?: number) {
  guardando.value = true
  errorForm.value = null
  erroresForm.value = {}

  try {
    await guardar(datos, id)
    cerrar()

    toast.add({
      title: id === undefined ? 'Categoría creada' : 'Categoría actualizada',
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (e) {
    if (e instanceof ApiError) {
      errorForm.value = e.message

      for (const [campo, mensajes] of Object.entries(e.errors)) {
        if (mensajes[0]) erroresForm.value[campo] = mensajes[0]
      }
    } else {
      errorForm.value = 'No se pudo guardar.'
    }
  } finally {
    guardando.value = false
  }
}

/*
 * Retirar pide confirmación.
 *
 * Es reversible —se desactiva, no se borra— pero una categoría retirada
 * se lleva consigo la manera de encontrar sus productos en la pantalla de
 * venta, y eso se descubre con un cliente enfrente.
 */
const retirando = ref<Category | null>(null)
const trabajandoRetiro = ref(false)

async function confirmarRetiro() {
  if (retirando.value === null) return

  const nombre = retirando.value.name
  trabajandoRetiro.value = true

  try {
    await retirar(retirando.value.id)
    retirando.value = null

    toast.add({
      title: `${nombre} quedó retirada`,
      description: 'Sus productos siguen existiendo y sus ventas no cambian.',
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

async function alReactivar(c: Category) {
  try {
    await reactivar(c.id)

    toast.add({
      title: `${c.name} vuelve a estar activa`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (e) {
    toast.add({
      title: 'No se pudo reactivar',
      description: e instanceof ApiError ? e.message : undefined,
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  }
}

const estados = [
  { value: 'todas', label: 'Todas' },
  { value: 'activas', label: 'Sólo activas' }
]

/**
 * El estado cuenta como filtro.
 *
 * Abrir en «sólo activas» es cómodo, pero es un recorte: quien no
 * encuentre una categoría tiene que poder quitarlo de un toque sin
 * adivinar qué control la esconde.
 */
const filtrada = computed(() => busqueda.value !== '' || incluirInactivas.value)

function limpiarFiltros(): void {
  busqueda.value = ''
  incluirInactivas.value = false
}

const filtroEstado = computed({
  get: () => (incluirInactivas.value ? 'todas' : 'activas'),
  set: (v: string | number) => {
    incluirInactivas.value = v === 'todas'
  }
})
</script>

<template>
  <div class="space-y-3 md:h-full md:flex md:flex-col md:min-h-0">
    <PaginaTitulo
      titulo="Categorías"
      descripcion="Agrupan el catálogo y son el filtro del mostrador. Un producto pertenece a una."
    >
      <template #acciones>
        <UButton
          icon="i-lucide-plus"
          class="toque"
          @click="creando = true"
        >
          Nueva categoría
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
      :total="categorias.length"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Buscar categoría..."
          icon="i-lucide-search"
          size="lg"
          class="w-44 2xl:w-56"
        />
      </template>

      <template #filtros>
        <FiltroSelect
          v-model="filtroEstado"
          :opciones="estados"
          tamano="lg"
          etiqueta="Filtrar por estado"
          icono="i-lucide-eye"
          ancho="w-44"
        />

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

      <template #resumen>
        {{ activas }} {{ activas === 1 ? 'categoría activa' : 'categorías activas' }}
      </template>
    </BarraFiltros>

    <EsqueletoLista
      v-if="cargando"
      :filas="4"
    />

    <SinResultados
      v-else-if="visibles.length === 0"
      icono="i-lucide-tags"
      :titulo="categorias.length === 0 ? 'Todavía no hay categorías' : 'Ninguna coincide'"
      :descripcion="categorias.length === 0
        ? 'Crea la primera para poder dar de alta productos.'
        : 'Prueba con otro nombre o cambia el filtro.'"
    >
      <template #accion>
        <UButton
          v-if="categorias.length === 0"
          icon="i-lucide-plus"
          @click="creando = true"
        >
          Nueva categoría
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

    <div
      v-else
      class="tarjeta overflow-hidden md:flex-1 md:min-h-0"
    >
      <div class="overflow-auto max-h-[60vh] md:max-h-none md:h-full">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10">
            <tr class="text-center [&>th]:border-r [&>th]:border-borde [&>th:last-child]:border-r-0">
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px">
                Logo
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Categoría
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde hidden lg:table-cell">
                Descripción
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Productos
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="c in visibles"
              :key="c.id"
              class="border-b border-borde-suave last:border-0 transition
                     [&>td]:border-r [&>td]:border-borde-suave [&>td:last-child]:border-r-0"
              :class="c.is_active ? '' : 'text-apagado-2'"
            >
              <!--
                El logo en su propia columna: así los cuadritos forman una
                línea recta y se reconoce la familia recorriendo el borde,
                en lugar de buscarlos a distintas alturas del nombre.

                `w-px` con `whitespace-nowrap` es el truco de tabla para
                «lo mínimo que quepa»: la columna no roba ancho al nombre.
              -->
              <td class="px-3 lg:px-4 py-4 w-px whitespace-nowrap">
                <span
                  class="size-8 rounded-lg flex items-center justify-center mx-auto"
                  :style="c.color ? { backgroundColor: c.color } : undefined"
                  :class="c.color ? '' : 'bg-relleno'"
                  aria-hidden="true"
                >
                  <!--
                    El logo elegido, o la etiqueta genérica si no tiene.
                    El nombre completo lo arma el servidor: aquí no se
                    concatena el prefijo de la librería de iconos.
                  -->
                  <UIcon
                    :name="c.icon_componente ?? 'i-lucide-tag'"
                    class="size-4"
                    :class="c.color ? 'text-white/90' : 'text-apagado-2'"
                  />
                </span>
              </td>

              <td class="px-3 lg:px-4 py-4 w-1/3 max-w-0">
                <span class="flex items-center justify-center gap-2 min-w-0">
                  <span class="truncate font-medium">{{ c.name }}</span>

                  <UBadge
                    v-if="!c.is_active"
                    color="neutral"
                    variant="subtle"
                    size="md"
                    class="shrink-0"
                  >
                    Retirada
                  </UBadge>
                </span>

                <!-- En angosto la descripción se mete aquí: su columna se oculta. -->
                <span
                  v-if="c.description"
                  class="block truncate text-xs text-apagado lg:hidden"
                >{{ c.description }}</span>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center w-1/3 max-w-0 truncate text-apagado hidden lg:table-cell">
                {{ c.description ?? '—' }}
              </td>

              <td class="px-3 lg:px-4 py-4 text-center tabular-nums whitespace-nowrap">
                {{ c.products_count ?? 0 }}
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
                    @click="editando = c"
                  >
                    <span class="hidden lg:inline">Editar</span>
                  </UButton>

                  <UButton
                    v-if="c.is_active"
                    size="sm"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-eye-off"
                    title="Retirar del mostrador"
                    aria-label="Retirar del mostrador"
                    @click="retirando = c"
                  >
                    <span class="hidden lg:inline">Retirar</span>
                  </UButton>

                  <UButton
                    v-else
                    size="sm"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-rotate-ccw"
                    title="Reactivar"
                    aria-label="Reactivar"
                    @click="alReactivar(c)"
                  >
                    <span class="hidden lg:inline">Reactivar</span>
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
      :descripcion="(retirando.products_count ?? 0) > 0
        ? `Deja de aparecer como filtro en la pantalla de venta. Sus ${retirando.products_count} productos siguen existiendo y se pueden seguir vendiendo.`
        : 'Deja de aparecer como filtro en la pantalla de venta. No se borra nada: se puede volver a activar.'"
      confirmar="Sí, retirar"
      :trabajando="trabajandoRetiro"
      @confirmar="confirmarRetiro"
      @cancelar="retirando = null"
    />

    <CategoriaModal
      v-if="modalAbierto"
      :key="claveModal"
      :categoria="editando"
      :guardando="guardando"
      :error="errorForm"
      :errores="erroresForm"
      @guardar="alGuardar"
      @cerrar="cerrar"
    />
  </div>
</template>
