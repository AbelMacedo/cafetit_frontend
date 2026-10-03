<script setup lang="ts">
import type { Product, ProductVariant } from '~/shared/types/api'

/**
 * Producto en la cuadrícula de venta.
 *
 * Foto arriba, nombre y precio en la misma línea, presentaciones como
 * píldoras y el botón de agregar en la propia tarjeta.
 *
 * **Las presentaciones van aquí y no en un diálogo aparte** cuando son
 * pocas. Elegir «Grande» y luego confirmar eran dos toques y una capa
 * encima de la pantalla; así es un toque y la elección se ve sin abrir
 * nada. Con muchas variantes —el Americano tiene cinco— no caben sin
 * apretar el resto, y ahí sí se abre el selector: una fila de píldoras
 * ilegible es peor que un diálogo.
 *
 * Sin foto se muestra la inicial sobre un tono cálido. No es el diseño:
 * es lo que evita que una cuadrícula sin fotos se lea como una lista de
 * texto, y desaparece en cuanto el producto tiene la suya.
 */
const props = defineProps<{
  producto: Product
}>()

const emit = defineEmits<{
  /** Se eligió una presentación concreta: va directo al carrito. */
  agregar: [variante: ProductVariant]
  /** Hay demasiadas presentaciones: que la pantalla abra el selector. */
  elegir: []
}>()

/** Más de esto no cabe en la tarjeta sin volverse ilegible. */
const MAXIMO_EN_TARJETA = 3

const activas = computed(() =>
  (props.producto.variants ?? []).filter(v => v.is_active)
)

const enTarjeta = computed(() =>
  activas.value.length > 1 && activas.value.length <= MAXIMO_EN_TARJETA
)

const unica = computed(() => activas.value.length === 1 ? activas.value[0]! : null)

/** La presentación marcada. Arranca en la de por omisión. */
const elegida = ref<ProductVariant | null>(null)

const seleccion = computed(() =>
  elegida.value
  ?? unica.value
  ?? activas.value.find(v => v.is_default)
  ?? activas.value[0]
  ?? null
)

/**
 * Qué precio enseñar.
 *
 * Si hay presentación marcada, la suya: el precio tiene que corresponder
 * a lo que se va a agregar. Si no, «desde» el menor — prometer $55 y
 * cobrar $70 porque el cliente la pidió grande es la clase de sorpresa
 * que se discute en el mostrador.
 */
const precio = computed(() => {
  if (activas.value.length === 0) return null

  if (enTarjeta.value || unica.value !== null) {
    return { texto: seleccion.value?.price.formatted ?? '—', desde: false }
  }

  const menor = activas.value.reduce(
    (min, v) => (v.price.cents < min.price.cents ? v : min),
    activas.value[0]!
  )

  const todosIguales = activas.value.every(v => v.price.cents === menor.price.cents)

  return { texto: menor.price.formatted, desde: !todosIguales }
})

const inicial = computed(() => props.producto.name.trim().charAt(0).toUpperCase())

/**
 * Tono estable por producto.
 *
 * Sale del nombre, no de un aleatorio: el mismo café tiene siempre el
 * mismo color, que es lo que permite reconocerlo sin leerlo.
 */
const tono = computed(() => {
  const tonos = [
    'bg-cafe-100 text-cafe-600',
    'bg-naranja-100 text-naranja-600',
    'bg-beige-200 text-beige-600',
    'bg-cafe-200 text-cafe-700',
    'bg-naranja-50 text-naranja-500'
  ]

  let suma = 0
  for (const c of props.producto.name) suma += c.codePointAt(0) ?? 0

  return tonos[suma % tonos.length]
})

function agregar() {
  if (activas.value.length === 0) return

  // Muchas presentaciones y ninguna marcada: que elija en el selector.
  if (!enTarjeta.value && unica.value === null && elegida.value === null) {
    emit('elegir')
    return
  }

  if (seleccion.value) emit('agregar', seleccion.value)
}
</script>

<template>
  <div
    class="tarjeta h-full p-3 flex flex-col gap-3 transition
           hover:shadow-alzada hover:border-naranja-200"
  >
    <!-- Foto -->
    <div class="rounded-xl overflow-hidden aspect-[4/3] shrink-0">
      <img
        v-if="producto.image_url"
        :src="producto.image_url"
        :alt="producto.name"
        loading="lazy"
        class="size-full object-cover"
      >
      <span
        v-else
        class="size-full flex items-center justify-center text-4xl font-semibold select-none"
        :class="tono"
        aria-hidden="true"
      >{{ inicial }}</span>
    </div>

    <!-- Nombre y precio, en la misma línea -->
    <div class="flex items-baseline justify-between gap-2">
      <p class="font-semibold leading-snug text-cafe-900 dark:text-beige-100 min-w-0">
        {{ producto.name }}
      </p>

      <span class="shrink-0 text-right">
        <span
          v-if="precio?.desde"
          class="block text-[10px] text-beige-500 leading-none"
        >desde</span>
        <span class="font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
          {{ precio?.texto ?? '—' }}
        </span>
      </span>
    </div>

    <p
      v-if="producto.description"
      class="text-xs text-beige-600 leading-snug line-clamp-2"
    >
      {{ producto.description }}
    </p>

    <!-- Presentaciones, cuando son pocas -->
    <div
      v-if="enTarjeta"
      class="flex flex-wrap gap-1.5"
    >
      <button
        v-for="v in activas"
        :key="v.id"
        type="button"
        class="rounded-full px-2.5 py-1 text-xs font-medium border transition"
        :class="seleccion?.id === v.id
          ? 'bg-naranja-100 border-naranja-300 text-naranja-700'
          : 'bg-white border-beige-200 text-beige-600 hover:border-beige-300'"
        @click="elegida = v"
      >
        {{ v.name ?? 'Único' }}
      </button>
    </div>

    <p
      v-else-if="activas.length > MAXIMO_EN_TARJETA"
      class="text-xs text-beige-500"
    >
      {{ activas.length }} presentaciones
    </p>

    <!--
      El botón va en café, no en naranja.

      Con una cuadrícula de doce productos, doce botones naranjas son un
      muro: el color de acción deja de señalar nada porque está en todas
      partes. El naranja se guarda para lo que de verdad manda —cobrar, el
      filtro activo, la sección abierta— y agregar al carrito, que es el
      gesto repetido y de bajo riesgo, se queda en el color de marca.
    -->
    <button
      type="button"
      class="toque mt-auto w-full rounded-xl bg-cafe-500 text-white font-medium
             py-2.5 transition hover:bg-cafe-600
             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cafe-500
             disabled:opacity-40 disabled:hover:bg-cafe-500"
      :disabled="activas.length === 0"
      @click="agregar"
    >
      Agregar
    </button>
  </div>
</template>
