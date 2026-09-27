<script setup lang="ts">
/**
 * Encabezado del cuerpo de una pantalla.
 *
 * La acción va **siempre** arriba a la derecha, en la línea del título.
 * Antes el título y las acciones compartían una fila que podía envolver,
 * así que en Empleados —descripción larga, contenedor angosto— el botón
 * «Nuevo empleado» se caía debajo y a la izquierda, mientras que en
 * Productos quedaba arriba a la derecha. La misma pantalla, dos sitios
 * distintos para lo mismo.
 *
 * Aquí la descripción va en su propio renglón, debajo de todo. Así no
 * empuja nada y el botón no depende de cuánto texto tenga la pantalla.
 *
 * El acento de dos rayas bajo el título es lo único decorativo del
 * sistema, y está a propósito: sin él el título es una línea de texto
 * más y nada dice dónde empieza la pantalla.
 */
defineProps<{
  titulo: string
  /** Una línea de contexto, cuando el título no basta. */
  descripcion?: string
}>()
</script>

<template>
  <div>
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-cafe-900 dark:text-beige-100 truncate">
          {{ titulo }}
        </h1>

        <div
          class="mt-2 space-y-1"
          aria-hidden="true"
        >
          <div class="h-1 w-24 rounded-full bg-naranja-400" />
          <div class="h-1 w-12 rounded-full bg-cafe-200" />
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <slot name="acciones" />
      </div>
    </div>

    <p
      v-if="descripcion"
      class="text-beige-600 mt-3 max-w-2xl"
    >
      {{ descripcion }}
    </p>
  </div>
</template>
