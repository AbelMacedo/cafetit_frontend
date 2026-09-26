<script setup lang="ts">
/**
 * Marca un hueco donde irá una imagen que todavía no existe.
 *
 * Es deliberado que se vea: un espacio en blanco se olvida, un recuadro
 * rotulado no. Cuando lleguen las fotos del negocio se sustituyen estos
 * componentes, y mientras tanto el propio diseño dice cuáles faltan.
 *
 * El inventario de imágenes pendientes está en DESIGN.md.
 */
withDefaults(defineProps<{
  /** Qué imagen va aquí: "Foto del producto", "Logo del negocio"... */
  descripcion: string
  /** Proporción sugerida, para que el hueco ocupe el espacio real. */
  ratio?: string
  redondeado?: boolean
}>(), {
  ratio: '4/3',
  redondeado: true
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-1 border border-dashed border-beige-300 bg-beige-100 text-beige-600 dark:border-beige-700 dark:bg-beige-900 dark:text-beige-400"
    :class="redondeado ? 'rounded-lg' : ''"
    :style="{ aspectRatio: ratio }"
  >
    <UIcon
      name="i-lucide-image"
      class="size-5 opacity-60"
    />
    <span class="px-2 text-center text-[11px] leading-tight">{{ descripcion }}</span>
  </div>
</template>
