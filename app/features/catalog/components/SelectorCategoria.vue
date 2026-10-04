<script setup lang="ts">
import type { Category } from '~/shared/types/api'

/**
 * Filtro de categoría.
 *
 * Envuelve a `FiltroSelect` sólo para traducir entre lo que espera un
 * selector y lo que usa el catálogo: el filtro «sin categoría» es `null`
 * en el estado, pero `null` no sirve como valor de una opción. Ese
 * pequeño desajuste vive aquí y no repetido en cada pantalla.
 */
const props = defineProps<{
  categorias: Category[]
  modelValue: number | null
  /** Se pasan tal cual a `FiltroSelect`. */
  tamano?: 'sm' | 'md' | 'lg' | 'xl'
  ancho?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [valor: number | null] }>()

const TODO = 0

const opciones = computed(() => [
  { label: 'Todas', value: TODO },

  // El logo de cada categoría: en el mostrador se reconoce antes el
  // dibujo que el nombre, y es para lo que se eligió.
  ...props.categorias.map(c => ({
    label: c.name,
    value: c.id,
    icon: c.icon_componente ?? undefined
  }))
])

const seleccion = computed({
  get: () => props.modelValue ?? TODO,
  set: (v: string | number) => emit('update:modelValue', Number(v) === TODO ? null : Number(v))
})
</script>

<template>
  <FiltroSelect
    v-model="seleccion"
    :opciones="opciones"
    :tamano="tamano"
    icono="i-lucide-tags"
    etiqueta="Filtrar por categoría"
    :ancho="ancho ?? 'w-52'"
  />
</template>
