<script setup lang="ts">
import type { Product, ProductVariant } from '~/shared/types/api'
import { type MotivoSinVenta, etiquetaSinVenta, motivoSinVenta } from '~/features/catalog/utils/existencias'

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

/*
 | Qué se puede cobrar, antes de intentarlo.
 |
 | El mostrador se enteraba demasiado tarde: se agregaba al carrito, se
 | llegaba a cobrar y ahí saltaba el error, con el cliente delante. Con
 | las piezas vendibles en el catálogo, la tarjeta puede decirlo de
 | entrada.
 */
const vendibles = computed(() => activas.value.filter(v => motivoSinVenta(v) === null))

/** Null mientras haya ALGO que cobrar: una de tres sirve. */
const sinVenta = computed<MotivoSinVenta | null>(() => {
  if (activas.value.length === 0 || vendibles.value.length > 0) return null

  // Todas fuera: manda el motivo de la primera, que es el que se explica.
  return motivoSinVenta(activas.value[0]!)
})

const enTarjeta = computed(() =>
  activas.value.length > 1 && activas.value.length <= MAXIMO_EN_TARJETA
)

const unica = computed(() => activas.value.length === 1 ? activas.value[0]! : null)

/** Las presentaciones que se ofrecen: las que no se pueden cobrar, fuera. */
const elegibles = computed(() => vendibles.value.length > 0 ? vendibles.value : activas.value)

/** La presentación marcada. Arranca en la de por omisión. */
const elegida = ref<ProductVariant | null>(null)

const seleccion = computed(() =>
  elegida.value
  ?? unica.value

  /*
   | La marcada por omisión puede ser justo la que no se puede cobrar.
   | Se prefiere una vendible antes que respetarla: enseñar el precio de
   | algo que no se va a poder agregar es la misma trampa, más temprano.
   */
  ?? elegibles.value.find(v => v.is_default)
  ?? elegibles.value[0]
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
  /*
   | En oscuro el tono se apaga en vez de invertirse: el mismo café sigue
   | siendo el café. Sin la pareja oscura, la cuadrícula era una pared de
   | rectángulos color crema encendidos sobre un fondo casi negro.
   */
  const tonos = [
    'bg-cafe-100 text-tinta-2 dark:bg-cafe-900 dark:text-cafe-200',
    'bg-naranja-100 text-naranja-600 dark:bg-naranja-950 dark:text-naranja-300',
    'bg-relleno text-apagado',
    'bg-cafe-200 text-tinta-2 dark:bg-cafe-800 dark:text-cafe-100',
    'bg-naranja-50 text-naranja-500 dark:bg-naranja-900/60 dark:text-naranja-300'
  ]

  let suma = 0
  for (const c of props.producto.name) suma += c.codePointAt(0) ?? 0

  return tonos[suma % tonos.length]
})

function agregar() {
  if (activas.value.length === 0 || sinVenta.value !== null) return

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
    <div class="rounded-xl overflow-hidden aspect-[4/3] shrink-0 relative">
      <!--
        El aviso va ENCIMA de la foto, no debajo del nombre: en una
        cuadrícula que se recorre con el dedo, un renglón más de letra
        chica se pasa por alto.
      -->
      <span
        v-if="sinVenta"
        class="absolute inset-x-0 top-0 z-10 py-1 text-center text-xs font-medium
               text-white bg-cafe-900/80"
      >{{ etiquetaSinVenta(sinVenta) }}</span>
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
      <p class="font-semibold leading-snug text-tinta min-w-0">
        {{ producto.name }}
      </p>

      <span class="shrink-0 text-right">
        <span
          v-if="precio?.desde"
          class="block text-[10px] text-apagado-2 leading-none"
        >desde</span>
        <span class="font-semibold tabular-nums text-tinta">
          {{ precio?.texto ?? '—' }}
        </span>
      </span>
    </div>

    <p
      v-if="producto.description"
      class="text-xs text-apagado leading-snug line-clamp-2"
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
          : 'bg-superficie border-borde text-apagado hover:border-borde-marcado'"
        @click="elegida = v"
      >
        {{ v.name ?? 'Único' }}
      </button>
    </div>

    <p
      v-else-if="activas.length > MAXIMO_EN_TARJETA"
      class="text-xs text-apagado-2"
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
      :disabled="activas.length === 0 || sinVenta !== null"
      @click="agregar"
    >
      {{ sinVenta ? etiquetaSinVenta(sinVenta) : 'Agregar' }}
    </button>
  </div>
</template>
