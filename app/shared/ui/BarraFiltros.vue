<script setup lang="ts">
/**
 * Barra de filtros de una lista.
 *
 * El orden es fijo y por eso existe: **buscar, luego acotar**, y el
 * recuento debajo. Cuando cada pantalla lo resolvía por su cuenta, el
 * select de «ver retirados» acabó a la derecha del todo en Productos y el
 * contador de cuentas en ese mismo sitio en Empleados — dos cosas
 * distintas en el mismo lugar, en pantallas contiguas.
 *
 * Por eso ya no hay slot de acciones: **las acciones van en el encabezado
 * de la pantalla**, con el título. Aquí sólo se filtra. Un botón de «dar
 * de alta» entre los filtros invita a tocarlo creyendo que filtra.
 *
 * El recuento no es decoración: cuando hay filtros puestos, es la única
 * forma de saber que la lista está corta por algo y no porque falte
 * información.
 */
defineProps<{
  /** Cuántos elementos se muestran de cuántos hay. */
  visibles?: number
  total?: number
  /** Si hay algún filtro activo, se ofrece quitarlos. */
  filtrada?: boolean
}>()

const emit = defineEmits<{ limpiar: [] }>()
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-2">
      <slot name="buscar" />
      <slot name="filtros" />
    </div>

    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p
        v-if="total !== undefined && visibles !== undefined"
        class="text-xs text-beige-600 flex items-center gap-2"
      >
        <span v-if="visibles === total">
          {{ total }} {{ total === 1 ? 'resultado' : 'resultados' }}
        </span>
        <span v-else>
          {{ visibles }} de {{ total }}
        </span>

        <UButton
          v-if="filtrada"
          size="xs"
          variant="link"
          color="neutral"
          class="p-0"
          @click="emit('limpiar')"
        >
          Quitar filtros
        </UButton>
      </p>

      <!-- Un dato del conjunto: «1 cuenta activa», «$2,480 en riesgo». -->
      <p class="text-xs text-beige-600">
        <slot name="resumen" />
      </p>
    </div>
  </div>
</template>
