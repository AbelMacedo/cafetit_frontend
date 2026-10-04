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
/**
 * El slot `resumen` acompaña a la DESCRIPCIÓN, no al título.
 *
 * Una cifra al lado del título compite con él: son dos cosas grandes
 * peleando por el mismo renglón. Un renglón más abajo, junto a la
 * línea que explica la pantalla, el título se queda solo —que es como
 * se lee un encabezado— y la cifra sigue arriba del todo.
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
        <h1 class="text-2xl font-bold text-tinta truncate">
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

    <div class="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <p
        v-if="descripcion"
        class="text-apagado max-w-2xl"
      >
        {{ descripcion }}
      </p>

      <div class="shrink-0 ms-auto">
        <slot name="resumen" />
      </div>
    </div>
  </div>
</template>
