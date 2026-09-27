<script setup lang="ts">
/**
 * Lo que se ve cuando no hay nada que ver.
 *
 * Va como tarjeta con su icono, no como un párrafo gris suelto: un texto
 * flotando en el vacío se lee como que la pantalla falló al cargar. Una
 * superficie con borde dice «aquí no hay nada» en lugar de «aquí se rompió
 * algo».
 *
 * Un vacío tiene dos causas muy distintas —no hay nada todavía, o el
 * filtro no encontró nada— y la salida es distinta en cada caso: dar de
 * alta algo, o quitar el filtro. Por eso acepta una acción.
 */
withDefaults(defineProps<{
  titulo: string
  descripcion?: string
  icono?: string
  /** `suelto` para dentro de una tarjeta que ya existe. */
  variante?: 'tarjeta' | 'suelto'
}>(), {
  icono: 'i-lucide-inbox',
  variante: 'tarjeta'
})
</script>

<template>
  <div
    class="text-center px-4"
    :class="variante === 'tarjeta' ? 'tarjeta py-14' : 'py-10'"
  >
    <UIcon
      :name="icono"
      class="size-10 text-beige-300 mx-auto mb-3"
    />

    <p class="font-medium text-cafe-800 dark:text-beige-200">
      {{ titulo }}
    </p>

    <p
      v-if="descripcion"
      class="text-sm text-beige-600 mt-1 max-w-sm mx-auto"
    >
      {{ descripcion }}
    </p>

    <div
      v-if="$slots.accion"
      class="mt-5"
    >
      <slot name="accion" />
    </div>
  </div>
</template>
