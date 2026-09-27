<script setup lang="ts">
/**
 * Silueta de una lista mientras carga.
 *
 * Sustituye a los «Cargando...» en gris. La diferencia no es estética:
 * un esqueleto del tamaño correcto evita que la pantalla dé un salto
 * cuando llegan los datos, y en un mostrador ese salto hace que el dedo
 * toque el renglón equivocado.
 */
withDefaults(defineProps<{
  filas?: number
  /** Alto de cada silueta, en clases de Tailwind. */
  alto?: string
}>(), {
  filas: 4,
  alto: 'h-16'
})
</script>

<template>
  <div
    class="space-y-2.5"
    aria-hidden="true"
  >
    <div
      v-for="n in filas"
      :key="n"
      class="tarjeta animate-pulse bg-beige-100/70"
      :class="alto"
    />
  </div>
</template>
