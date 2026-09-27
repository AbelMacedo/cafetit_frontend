<script setup lang="ts">
/**
 * Confirmación antes de algo que cuesta deshacer.
 *
 * Hasta ahora no existía: «Retirar» un producto lo desactivaba de
 * inmediato y sin preguntar. Nada se borra en este sistema, así que casi
 * todo es reversible — pero reversible no es lo mismo que gratis, y un
 * dedazo en una pantalla táctil de mostrador es cuestión de tiempo.
 *
 * El botón de confirmar dice lo que va a pasar («Sí, dar de baja»), no
 * «Aceptar»: quien lee sólo el botón tiene que entender qué eligió.
 */
withDefaults(defineProps<{
  titulo: string
  descripcion?: string
  /** Lo que dice el botón que ejecuta. Un verbo, no «Aceptar». */
  confirmar: string
  cancelar?: string
  /** `error` para lo destructivo; `primary` para lo que sólo es importante. */
  tono?: 'error' | 'primary'
  trabajando?: boolean
}>(), {
  cancelar: 'Mejor no',
  tono: 'error',
  trabajando: false
})

const emit = defineEmits<{ confirmar: [], cancelar: [] }>()
</script>

<template>
  <UModal
    :open="true"
    :title="titulo"
    :description="descripcion"
    :ui="{ content: 'max-w-md' }"
    @update:open="emit('cancelar')"
  >
    <!--
      La explicación la pinta UModal a partir de `description`, debajo del
      título. Repetirla aquí la mostraba dos veces.
    -->
    <template
      v-if="$slots.default"
      #body
    >
      <slot />
    </template>

    <template #footer>
      <div class="flex w-full gap-2">
        <UButton
          block
          size="lg"
          variant="outline"
          color="neutral"
          class="toque"
          :disabled="trabajando"
          @click="emit('cancelar')"
        >
          {{ cancelar }}
        </UButton>

        <UButton
          block
          size="lg"
          :color="tono"
          class="toque"
          :loading="trabajando"
          @click="emit('confirmar')"
        >
          {{ confirmar }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
