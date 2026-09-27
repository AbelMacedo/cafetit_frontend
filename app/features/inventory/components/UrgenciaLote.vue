<script setup lang="ts">
/**
 * Urgencia de un lote, expresada como se lee de un vistazo.
 *
 * La fecha de caducidad es un dato; la urgencia es la decisión. "Caduca
 * el jueves" no dice nada si hoy es jueves — "quedan 3 horas" sí.
 */
const props = defineProps<{
  horas: number | null
  caducado: boolean
}>()

const texto = computed(() => {
  if (props.horas === null) return 'No caduca'
  if (props.caducado) {
    const vencidas = Math.abs(props.horas)
    return vencidas < 24
      ? `Caducó hace ${vencidas} h`
      : `Caducó hace ${Math.floor(vencidas / 24)} d`
  }
  if (props.horas < 1) return 'Caduca en menos de 1 h'
  if (props.horas < 24) return `Quedan ${props.horas} h`
  return `Quedan ${Math.floor(props.horas / 24)} d`
})

const color = computed(() => {
  if (props.horas === null) return 'neutral'
  if (props.caducado) return 'error'
  if (props.horas < 4) return 'error'
  if (props.horas < 24) return 'warning'
  return 'success'
})
</script>

<template>
  <UBadge
    :color="color"
    variant="subtle"
    class="tabular-nums whitespace-nowrap"
  >
    {{ texto }}
  </UBadge>
</template>
