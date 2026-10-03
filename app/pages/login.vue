<script setup lang="ts">
import { useAuthStore } from '~/features/auth/stores/auth'
import { ApiError } from '~/shared/composables/useApi'

definePageMeta({ layout: false })

const auth = useAuthStore()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const erroresCampo = ref<Record<string, string | undefined>>({})

async function enviar() {
  error.value = null
  erroresCampo.value = {}

  try {
    await auth.login(email.value, password.value)
    const destino = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await navigateTo(destino)
  } catch (e) {
    if (e instanceof ApiError) {
      error.value = e.esDemasiadosIntentos
        ? 'Demasiados intentos. Espera un momento antes de volver a probar.'
        : e.campo('email') ?? e.message
      erroresCampo.value = { email: e.campo('email'), password: e.campo('password') }
    } else {
      error.value = 'No se pudo conectar con el servidor.'
    }
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-beige-50 dark:bg-beige-950 p-4">
    <div class="w-full max-w-sm">
      <div class="flex flex-col items-center mb-8">
        <ImagenPendiente
          descripcion="Logo del negocio"
          ratio="1/1"
          class="w-20 mb-4"
        />
        <h1 class="text-3xl font-semibold tracking-tight text-cafe-900 dark:text-beige-100">
          La Cafetit
        </h1>
        <p class="text-sm text-beige-600 mt-1">
          Punto de venta
        </p>
      </div>

      <UCard>
        <form
          class="space-y-4"
          @submit.prevent="enviar"
        >
          <UFormField
            label="Correo"
            :error="erroresCampo.email"
          >
            <UInput
              v-model="email"
              type="email"
              autocomplete="username"
              autofocus
              placeholder="admin@cafetit.mx"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Contraseña"
            :error="erroresCampo.password"
          >
            <UInput
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            :title="error"
          />

          <UButton
            type="submit"
            block
            size="lg"
            :loading="auth.cargando"
            :disabled="!email || !password"
          >
            Entrar
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>
