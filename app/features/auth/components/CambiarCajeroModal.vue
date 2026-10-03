<script setup lang="ts">
import { useAuthStore } from '~/features/auth/stores/auth'

/**
 * Cambio de cajero por PIN.
 *
 * Es el flujo del mostrador: la caja se abre una vez en la mañana y
 * después se turnan varias personas. Obligarlas a teclear correo y
 * contraseña entre un cliente y el siguiente termina siempre igual —una
 * sola cuenta compartida— y con eso la bitácora deja de decir quién hizo
 * qué, que es lo único que este sistema tiene en lugar de roles.
 *
 * **Teclado en pantalla, no un campo de texto.** Se usa de pie, con el
 * pulgar y con prisa, muchas veces con una tableta sin teclado físico.
 * El campo se llena solo al llegar a los cuatro dígitos: pedir además un
 * «Entrar» sería un toque de más cien veces al día.
 *
 * El teclado físico sigue funcionando para quien tenga uno.
 */
const emit = defineEmits<{ cerrar: [] }>()

const auth = useAuthStore()

const LARGO = 4

const pin = ref('')
const error = ref<string | null>(null)
const trabajando = ref(false)

const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

function teclear(digito: string): void {
  if (trabajando.value || pin.value.length >= LARGO) return

  error.value = null
  pin.value += digito

  if (pin.value.length === LARGO) {
    void entrar()
  }
}

function borrar(): void {
  if (trabajando.value) return

  error.value = null
  pin.value = pin.value.slice(0, -1)
}

async function entrar(): Promise<void> {
  trabajando.value = true

  try {
    const nombre = await auth.cambiarCajero(pin.value)
    emit('cerrar')

    useToast().add({
      title: `Ahora atiende ${nombre}`,
      color: 'success',
      icon: 'i-lucide-user-check'
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cambiar de cajero.'

    // Se vacía siempre: dejar los dígitos obligaría a borrarlos uno por
    // uno para reintentar, y el error más común es teclear mal.
    pin.value = ''
  } finally {
    trabajando.value = false
  }
}

function alTeclado(e: KeyboardEvent): void {
  if (e.key >= '0' && e.key <= '9') {
    teclear(e.key)
  } else if (e.key === 'Backspace') {
    borrar()
  }
}

onMounted(() => window.addEventListener('keydown', alTeclado))
onBeforeUnmount(() => window.removeEventListener('keydown', alTeclado))
</script>

<template>
  <UModal
    :open="true"
    title="Cambiar de cajero"
    description="Teclea tu PIN. La caja sigue abierta y el turno no se cierra."
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-5">
        <!--
          Los puntos, no los dígitos: la pantalla del POS mira al cliente
          tanto como al cajero.
        -->
        <div
          class="flex justify-center gap-3"
          role="status"
          :aria-label="`${pin.length} de ${LARGO} dígitos`"
        >
          <span
            v-for="i in LARGO"
            :key="i"
            class="size-4 rounded-full transition"
            :class="i <= pin.length ? 'bg-naranja-500' : 'bg-beige-200'"
          />
        </div>

        <p
          v-if="error"
          class="text-center text-sm text-red-600"
          role="alert"
        >
          {{ error }}
        </p>

        <div class="grid grid-cols-3 gap-2">
          <UButton
            v-for="t in teclas"
            :key="t"
            block
            size="xl"
            variant="outline"
            color="neutral"
            class="toque text-xl font-semibold justify-center"
            :disabled="trabajando"
            @click="teclear(t)"
          >
            {{ t }}
          </UButton>

          <UButton
            block
            size="xl"
            variant="ghost"
            color="neutral"
            class="toque justify-center"
            :disabled="trabajando"
            aria-label="Cancelar"
            @click="emit('cerrar')"
          >
            Cancelar
          </UButton>

          <UButton
            block
            size="xl"
            variant="outline"
            color="neutral"
            class="toque text-xl font-semibold justify-center"
            :disabled="trabajando"
            @click="teclear('0')"
          >
            0
          </UButton>

          <UButton
            block
            size="xl"
            variant="ghost"
            color="neutral"
            icon="i-lucide-delete"
            class="toque justify-center"
            :disabled="trabajando"
            aria-label="Borrar"
            @click="borrar"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
