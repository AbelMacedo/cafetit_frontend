<script setup lang="ts">
/**
 * Foto del producto, dentro del formulario.
 *
 * No sube nada: elige el archivo y enseña cómo va a quedar. La subida la
 * hace la pantalla **después de guardar**, y por una razón concreta: un
 * producto nuevo todavía no tiene id, así que no hay contra qué subir.
 * Si el componente subiera solo, dar de alta un producto con foto
 * necesitaría dos pasos y el usuario tendría que entender por qué.
 *
 * La vista previa sale de `URL.createObjectURL`, que no toca la red: se
 * ve al instante, antes de que el archivo salga de la computadora.
 */
const props = defineProps<{
  /** La que ya está guardada, si hay. */
  urlActual: string | null
  /** Para la inicial mientras no haya foto. */
  nombre: string
}>()

const archivo = defineModel<File | null>('archivo', { required: true })
const quitar = defineModel<boolean>('quitar', { required: true })

const entrada = ref<HTMLInputElement | null>(null)
const previa = ref<string | null>(null)

const mostrada = computed(() => {
  if (previa.value !== null) return previa.value
  if (quitar.value) return null

  return props.urlActual
})

const inicial = computed(() => props.nombre.trim().charAt(0).toUpperCase() || '?')

function elegir() {
  entrada.value?.click()
}

function alElegirArchivo(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  if (f === null) return

  liberar()

  archivo.value = f
  quitar.value = false
  previa.value = URL.createObjectURL(f)
}

function quitarFoto() {
  liberar()

  archivo.value = null
  previa.value = null

  // Sólo hay algo que borrar en el servidor si ya había foto guardada.
  quitar.value = props.urlActual !== null

  if (entrada.value) entrada.value.value = ''
}

/** La URL del objeto ocupa memoria hasta que se revoca. */
function liberar() {
  if (previa.value !== null) {
    URL.revokeObjectURL(previa.value)
    previa.value = null
  }
}

onUnmounted(liberar)
</script>

<template>
  <div class="flex items-center gap-4">
    <button
      type="button"
      class="size-20 shrink-0 rounded-xl overflow-hidden border border-borde flex items-center justify-center
             hover:border-naranja-400 focus-visible:outline-2 focus-visible:outline-offset-2
             focus-visible:outline-naranja-500 transition"
      :class="mostrada === null ? 'bg-hundido' : ''"
      :aria-label="mostrada === null ? 'Agregar foto' : 'Cambiar foto'"
      @click="elegir"
    >
      <img
        v-if="mostrada"
        :src="mostrada"
        alt=""
        class="size-full object-cover"
      >
      <span
        v-else
        class="text-2xl font-semibold text-apagado-2"
      >{{ inicial }}</span>
    </button>

    <div class="min-w-0 space-y-1.5">
      <div class="flex flex-wrap gap-2">
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-lucide-image-up"
          @click="elegir"
        >
          {{ mostrada === null ? 'Agregar foto' : 'Cambiar' }}
        </UButton>

        <UButton
          v-if="mostrada !== null"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="quitarFoto"
        >
          Quitar
        </UButton>
      </div>

      <p class="text-xs text-apagado">
        JPG, PNG o WebP, hasta 4 MB. Sin foto, la pantalla de venta muestra
        la inicial del producto.
      </p>
    </div>

    <input
      ref="entrada"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="alElegirArchivo"
    >
  </div>
</template>
