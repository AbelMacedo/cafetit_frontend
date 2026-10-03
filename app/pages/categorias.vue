<script setup lang="ts">
import CategoriaModal from '~/features/catalog/components/CategoriaModal.vue'
import { type CategoriaAGuardar, useCategories } from '~/features/catalog/composables/useCategories'
import { ApiError } from '~/shared/composables/useApi'
import type { Category } from '~/shared/types/api'

definePageMeta({ middleware: 'auth' })

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

const filtroEstado = computed({
  get: () => (incluirInactivas.value ? 'todas' : 'activas'),
  set: (v: string | number) => {
    incluirInactivas.value = v === 'todas'
  }
})
</script>

<template>
  <div class="space-y-6">
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
      :filtrada="busqueda !== ''"
      @limpiar="busqueda = ''"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Buscar categoría..."
          icon="i-lucide-search"
          class="w-56"
        />
      </template>

      <template #filtros>
        <FiltroSelect
          v-model="filtroEstado"
          :opciones="estados"
          etiqueta="Filtrar por estado"
          icono="i-lucide-eye"
          ancho="w-44"
        />
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
          @click="busqueda = ''"
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
        v-for="c in visibles"
        :key="c.id"
        class="tarjeta p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
        :class="c.is_active ? '' : 'opacity-60'"
      >
        <!-- El color a la izquierda: es como se reconoce la familia -->
        <span
          class="size-9 shrink-0 rounded-lg flex items-center justify-center"
          :style="c.color ? { backgroundColor: c.color } : undefined"
          :class="c.color ? '' : 'bg-beige-200'"
          aria-hidden="true"
        >
          <UIcon
            name="i-lucide-tag"
            class="size-4"
            :class="c.color ? 'text-white/90' : 'text-beige-500'"
          />
        </span>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium leading-tight">
              {{ c.name }}
            </p>
            <UBadge
              v-if="!c.is_active"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              Retirada
            </UBadge>
          </div>
          <p class="text-xs text-beige-600">
            <template v-if="c.description">
              {{ c.description }} ·
            </template>
            {{ c.products_count ?? 0 }}
            {{ (c.products_count ?? 0) === 1 ? 'producto' : 'productos' }}
          </p>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <UButton
            size="xs"
            variant="outline"
            color="neutral"
            icon="i-lucide-pencil"
            @click="editando = c"
          >
            Editar
          </UButton>

          <UButton
            v-if="c.is_active"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="retirando = c"
          >
            Retirar
          </UButton>

          <UButton
            v-else
            size="xs"
            variant="ghost"
            color="neutral"
            @click="alReactivar(c)"
          >
            Reactivar
          </UButton>
        </div>
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
