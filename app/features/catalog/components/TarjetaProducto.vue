<script setup lang="ts">
import type { Product } from '~/shared/types/api'

/**
 * Producto en la cuadrícula de venta.
 *
 * Es el elemento que más se mira en todo el sistema, así que la jerarquía
 * es la del mostrador: **nombre y precio primero**, la imagen después.
 *
 * Antes la tarjeta la encabezaba un recuadro gris de «Foto del producto»
 * que ocupaba la mitad del alto. Como las fotos del negocio todavía no
 * existen, eso era media tarjeta de nada: el cajero leía el nombre en
 * letra chica debajo de un hueco. El marcador sigue existiendo donde sí
 * sirve —el catálogo, que es donde se revisa qué falta— pero aquí estorba.
 *
 * Sin foto, la tarjeta muestra la inicial sobre un tono cálido. No es
 * decoración: da una silueta distinta a cada producto, y a distancia de
 * brazo se reconoce por forma antes que por lectura.
 */
const props = defineProps<{
  producto: Product
}>()

const activas = computed(() =>
  (props.producto.variants ?? []).filter(v => v.is_active)
)

/**
 * Qué precio enseñar.
 *
 * Con varias presentaciones se muestra «desde», no el de la variante por
 * omisión: prometer $55 y cobrar $70 porque el cliente la pidió grande es
 * la clase de sorpresa que se discute en el mostrador.
 */
const precio = computed(() => {
  if (activas.value.length === 0) return null

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
    'bg-cafe-100 text-cafe-700',
    'bg-naranja-100 text-naranja-700',
    'bg-beige-200 text-beige-700',
    'bg-cafe-200 text-cafe-800',
    'bg-naranja-50 text-naranja-600'
  ]

  let suma = 0
  for (const c of props.producto.name) suma += c.codePointAt(0) ?? 0

  return tonos[suma % tonos.length]
})
</script>

<template>
  <button
    type="button"
    class="tarjeta tarjeta-viva h-full text-left p-3.5 flex flex-col gap-3
           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
  >
    <div class="flex items-start gap-3">
      <!--
        Con foto se muestra la foto; sin ella, la inicial sobre un tono
        cálido. La inicial no es el diseño: es lo que evita que una
        cuadrícula sin fotos se vea como una lista de texto, y desaparece
        en cuanto el producto tiene la suya.
      -->
      <img
        v-if="producto.image_url"
        :src="producto.image_url"
        :alt="producto.name"
        loading="lazy"
        class="size-14 shrink-0 rounded-lg object-cover bg-beige-100"
      >
      <span
        v-else
        class="size-14 shrink-0 rounded-lg flex items-center justify-center
               text-2xl font-semibold select-none"
        :class="tono"
        aria-hidden="true"
      >{{ inicial }}</span>

      <span class="min-w-0 flex-1 font-medium leading-snug text-cafe-900 dark:text-beige-100">
        {{ producto.name }}
      </span>
    </div>

    <div class="mt-auto flex items-end justify-between gap-2">
      <span class="min-w-0">
        <span
          v-if="precio?.desde"
          class="block text-[11px] text-beige-500 leading-none"
        >desde</span>

        <span class="text-xl font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
          {{ precio?.texto ?? '—' }}
        </span>
      </span>

      <UBadge
        v-if="activas.length > 1"
        color="neutral"
        variant="subtle"
        size="sm"
        class="shrink-0"
      >
        {{ activas.length }}
      </UBadge>
    </div>
  </button>
</template>
