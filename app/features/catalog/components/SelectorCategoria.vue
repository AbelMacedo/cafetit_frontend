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
}>()

const emit = defineEmits<{ 'update:modelValue': [valor: number | null] }>()

const TODO = 0

const opciones = computed(() => [
  { label: 'Todas las categorías', value: TODO },
  ...props.categorias.map(c => ({ label: c.name, value: c.id }))
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
    etiqueta="Filtrar por categoría"
    ancho="w-52"
  />
</template>
