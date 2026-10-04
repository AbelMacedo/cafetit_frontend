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

  /**
   * Icono propio de la opción, cuando lo tiene.
   *
   * Las categorías llevan logo, y en el mostrador se reconocen antes
   * por el dibujo que por el nombre. El icono del control —el de la
   * izquierda— sigue siendo el del filtro.
   */
  icon?: string
}

const props = defineProps<{
  modelValue: string | number
  opciones: OpcionFiltro[]
  /** Se lee en voz alta y sale como `title`; no se pinta. */
  etiqueta: string
  icono?: string
  ancho?: string

  /**
   * El alto del control.
   *
   * Por omisión el de Nuxt UI, que es el que tienen hoy las pantallas
   * de gestión. En el mostrador se sube a `lg`: ahí se toca de pie,
   * con el dedo y al lado de tarjetas grandes, y el tamaño normal se
   * ve diminuto. Se pide pantalla por pantalla en vez de cambiarlo de
   * golpe, para poder mirarlas una por una.
   */
  tamano?: 'sm' | 'md' | 'lg' | 'xl'
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
    :size="tamano"
    :icon="icono ?? 'i-lucide-filter'"
    :aria-label="etiqueta"
    :title="etiqueta"
    class="shrink-0"
    :class="ancho ?? 'w-48'"
  />
</template>
