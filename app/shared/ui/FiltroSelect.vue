<script setup lang="ts">
/**
 * Filtro de una lista.
 *
 * Todos los filtros del sistema pasan por aquí. Antes cada pantalla
 * resolvía el suyo con una fila de botones —el estado en Ventas, la
 * ventana de horas en Inventario, el periodo en Reportes— y ninguna se
 * parecía a las demás: distinto tamaño, distinto orden, distinta forma de
 * marcar cuál estaba puesto.
 *
 * Un selector dice el valor aplicado leyendo una línea, en lugar de
 * obligar a recorrer los botones buscando cuál está encendido, y ocupa lo
 * mismo con dos opciones que con veinte.
 *
 * **Esto es para filtrar, no para capturar.** Elegir el turno al abrir
 * caja, el método de pago o el motivo de una merma siguen siendo botones
 * grandes: son decisiones de captura, se toman con el dedo y con prisa, y
 * ahí un menú desplegable cuesta dos toques en lugar de uno.
 */
export interface OpcionFiltro {
  label: string
  value: string | number
}

const props = defineProps<{
  modelValue: string | number
  opciones: OpcionFiltro[]
  /** Se lee en voz alta y sale como `title`; no se pinta. */
  etiqueta: string
  icono?: string
  ancho?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [valor: string | number] }>()

const seleccion = computed({
  get: () => props.modelValue,
  set: (v: string | number) => emit('update:modelValue', v)
})
</script>

<template>
  <USelect
    v-model="seleccion"
    :items="opciones"
    :icon="icono ?? 'i-lucide-filter'"
    :aria-label="etiqueta"
    :title="etiqueta"
    class="shrink-0"
    :class="ancho ?? 'w-48'"
  />
</template>
