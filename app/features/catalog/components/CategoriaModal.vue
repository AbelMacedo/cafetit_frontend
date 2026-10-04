<script setup lang="ts">
import type { CategoriaAGuardar } from '~/features/catalog/composables/useCategories'
import { useApi } from '~/shared/composables/useApi'
import type { Category, LogoCategoria } from '~/shared/types/api'

/**
 * Alta y edición de una categoría.
 *
 * Son cuatro campos y sólo uno obligatorio. El color no es decoración:
 * es lo que permite distinguir de un vistazo a qué familia pertenece un
 * producto en la cuadrícula de venta, sin leer.
 *
 * No guarda: arma el payload y lo emite. La lista la tiene la pantalla.
 */
const props = defineProps<{
  /** `null` al dar de alta. */
  categoria: Category | null
  guardando: boolean
  error: string | null
  errores: Record<string, string>
}>()

const emit = defineEmits<{
  guardar: [datos: CategoriaAGuardar, id?: number]
  cerrar: []
}>()

const esAlta = computed(() => props.categoria === null)

const nombre = ref(props.categoria?.name ?? '')
const descripcion = ref(props.categoria?.description ?? '')
const color = ref(props.categoria?.color ?? null)
const orden = ref(props.categoria?.sort_order ?? 0)
const logo = ref(props.categoria?.icon ?? null)

/**
 * El catálogo de logos lo manda el servidor.
 *
 * Mantener la lista aquí significaría dos copias que se editan por
 * separado, y la que se queda atrás es siempre la del frontend. Si la
 * petición falla, el selector queda vacío y la categoría se guarda sin
 * logo: es un campo opcional, no vale la pena bloquear el alta por él.
 */
const logos = ref<LogoCategoria[]>([])

onMounted(async () => {
  try {
    const r = await useApi().get<{ data: LogoCategoria[] }>('/categories/icons')
    logos.value = r.data
  } catch {
    logos.value = []
  }
})

/**
 * Paleta acotada a propósito.
 *
 * Un selector de color libre produce categorías en fucsia y verde neón
 * sobre una pantalla beige y café. Estos tonos salen de la paleta del
 * negocio, así que cualquier combinación se ve como parte del sistema.
 */
const colores = [
  { valor: '#AC744C', nombre: 'Café' },
  { valor: '#F56516', nombre: 'Naranja' },
  { valor: '#9A8B78', nombre: 'Beige' },
  { valor: '#6B4032', nombre: 'Café oscuro' },
  { valor: '#B98A5E', nombre: 'Canela' },
  { valor: '#7A9A78', nombre: 'Verde' },
  { valor: '#7889A6', nombre: 'Azul' },
  { valor: '#A6788F', nombre: 'Vino' }
]

const listo = computed(() => nombre.value.trim().length >= 2)

function guardar() {
  if (!listo.value || props.guardando) return

  emit('guardar', {
    name: nombre.value.trim(),
    description: descripcion.value.trim() || null,
    color: color.value,
    icon: logo.value,
    sort_order: orden.value
  }, props.categoria?.id)
}
</script>

<template>
  <UModal
    :open="true"
    :title="esAlta ? 'Nueva categoría' : `Editar ${categoria?.name}`"
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-5">
        <UFormField
          label="Nombre"
          :error="errores.name"
        >
          <UInput
            v-model="nombre"
            autofocus
            placeholder="Panadería"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Descripción (opcional)"
          :error="errores.description"
        >
          <UInput
            v-model="descripcion"
            placeholder="Pan dulce y salado del día"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Color"
          help="Sirve para reconocer la familia de un producto sin leer su nombre."
          :error="errores.color"
        >
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="c in colores"
              :key="c.valor"
              type="button"
              class="size-9 rounded-full border-2 transition"
              :class="color === c.valor
                ? 'border-tinta scale-110'
                : 'border-transparent hover:scale-105'"
              :style="{ backgroundColor: c.valor }"
              :aria-label="c.nombre"
              :title="c.nombre"
              @click="color = c.valor"
            />

            <UButton
              v-if="color !== null"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="color = null"
            >
              Sin color
            </UButton>
          </div>
        </UFormField>

        <UFormField
          v-if="logos.length > 0"
          label="Logo"
          help="Aparece junto al nombre y en el filtro del mostrador."
          :error="errores.icon"
        >
          <!--
            Los logos se eligen viéndolos, no por nombre: un desplegable
            con «croissant» obliga a imaginarse el dibujo. Son quince,
            así que caben todos a la vista.
          -->
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="l in logos"
              :key="l.valor"
              type="button"
              class="size-10 rounded-xl border-2 flex items-center justify-center transition toque"
              :class="logo === l.valor
                ? 'border-naranja-500 bg-naranja-50 dark:bg-naranja-950 text-tinta'
                : 'border-borde text-tinta-2 hover:border-borde-marcado'"
              :aria-label="l.texto"
              :aria-pressed="logo === l.valor"
              :title="l.texto"
              @click="logo = l.valor"
            >
              <UIcon
                :name="l.componente"
                class="size-5"
              />
            </button>

            <UButton
              v-if="logo !== null"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="logo = null"
            >
              Sin logo
            </UButton>
          </div>
        </UFormField>

        <UFormField
          label="Orden"
          help="Menor primero. Con el mismo número, se ordenan por nombre."
          :error="errores.sort_order"
        >
          <UInput
            v-model.number="orden"
            type="number"
            min="0"
            class="w-28"
            :ui="{ base: 'tabular-nums text-right' }"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full gap-2">
        <UButton
          block
          size="lg"
          variant="outline"
          color="neutral"
          :disabled="guardando"
          @click="emit('cerrar')"
        >
          Cancelar
        </UButton>
        <UButton
          block
          size="lg"
          class="toque"
          :loading="guardando"
          :disabled="!listo"
          @click="guardar"
        >
          {{ esAlta ? 'Crear categoría' : 'Guardar' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
