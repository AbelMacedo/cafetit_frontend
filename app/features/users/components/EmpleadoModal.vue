<script setup lang="ts">
import type { AltaEmpleado, CambioEmpleado } from '~/features/users/composables/useUsers'
import type { User } from '~/shared/types/api'

/**
 * Alta y edición de un empleado.
 *
 * Es el mismo formulario para los dos casos porque sólo cambian dos
 * cosas: al editar, la contraseña vacía significa «déjala como está», y
 * cambiar la propia exige escribir la actual.
 *
 * No guarda: arma el payload y lo emite. Quien tiene la lista es la
 * página, y es ella la que decide qué hacer con el resultado.
 */
const props = defineProps<{
  /** `null` al dar de alta. */
  empleado: User | null
  /** Para pedir la contraseña actual sólo cuando alguien cambia la suya. */
  usuarioActualId: number | null
  guardando: boolean
  error: string | null
  /** Errores de validación por campo, tal como los devuelve la API. */
  errores: Record<string, string>
}>()

const emit = defineEmits<{
  alta: [datos: AltaEmpleado]
  cambio: [id: number, datos: CambioEmpleado]
  cerrar: []
}>()

const esAlta = computed(() => props.empleado === null)
const esUnoMismo = computed(() =>
  props.empleado !== null && props.empleado.id === props.usuarioActualId
)

const nombre = ref(props.empleado?.name ?? '')
const correo = ref(props.empleado?.email ?? '')
const pin = ref('')
const contrasenaActual = ref('')
const contrasena = ref('')
const confirmacion = ref('')

/** Al editar, dejar la contraseña vacía significa no tocarla. */
const cambiaContrasena = computed(() => contrasena.value.length > 0)

const coinciden = computed(() =>
  !cambiaContrasena.value || contrasena.value === confirmacion.value
)

/**
 * Sólo se reclama cuando ya hay algo que comparar.
 *
 * Marcar «no coinciden» mientras el campo sigue vacío es regañar a
 * alguien por no haber terminado de escribir.
 */
const avisarNoCoinciden = computed(() =>
  confirmacion.value.length > 0 && !coinciden.value
)

const listo = computed(() => {
  if (nombre.value.trim().length < 3) return false
  if (!correo.value.includes('@')) return false
  if (!coinciden.value) return false
  if (esAlta.value && contrasena.value.length === 0) return false
  if (cambiaContrasena.value && esUnoMismo.value && contrasenaActual.value.length === 0) return false
  return true
})

function guardar() {
  if (!listo.value || props.guardando) return

  if (props.empleado === null) {
    const datos: AltaEmpleado = {
      name: nombre.value.trim(),
      email: correo.value.trim(),
      password: contrasena.value,
      password_confirmation: confirmacion.value
    }

    if (pin.value) datos.pin = pin.value

    emit('alta', datos)
    return
  }

  const datos: CambioEmpleado = {
    name: nombre.value.trim(),
    email: correo.value.trim()
  }

  if (cambiaContrasena.value) {
    datos.password = contrasena.value
    datos.password_confirmation = confirmacion.value

    // El backend sólo la pide para la cuenta propia; mandarla de más
    // haría fallar el restablecimiento de la de un compañero.
    if (esUnoMismo.value) datos.current_password = contrasenaActual.value
  }

  if (pin.value) datos.pin = pin.value

  emit('cambio', props.empleado.id, datos)
}
</script>

<template>
  <UModal
    :open="true"
    :title="esAlta ? 'Nuevo empleado' : `Editar a ${empleado?.name}`"
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          label="Nombre"
          :error="errores.name"
        >
          <UInput
            v-model="nombre"
            autofocus
            placeholder="Lucía Rangel"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Correo"
          help="Es con lo que inicia sesión."
          :error="errores.email"
        >
          <UInput
            v-model="correo"
            type="email"
            autocomplete="off"
            placeholder="lucia@cafetit.mx"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="PIN"
          :help="esAlta
            ? 'Entre 4 y 6 dígitos, opcional. No puede repetirse con el de otro empleado.'
            : 'Déjalo vacío para conservar el actual.'"
          :error="errores.pin"
        >
          <UInput
            v-model="pin"
            inputmode="numeric"
            maxlength="6"
            autocomplete="off"
            placeholder="····"
            class="w-40"
            :ui="{ base: 'tabular-nums tracking-widest' }"
          />
        </UFormField>

        <div class="border-t border-beige-200 dark:border-beige-800 pt-4 space-y-4">
          <UFormField
            v-if="cambiaContrasena && esUnoMismo"
            label="Tu contraseña actual"
            help="Se pide para que nadie pueda cambiarla desde una terminal que dejaste abierta."
            :error="errores.current_password"
          >
            <UInput
              v-model="contrasenaActual"
              type="password"
              autocomplete="current-password"
              class="w-full"
            />
          </UFormField>

          <UFormField
            :label="esAlta ? 'Contraseña' : 'Contraseña nueva'"
            :help="esAlta
              ? 'Mínimo 10 caracteres, con letras y números.'
              : 'Déjala vacía para no cambiarla.'"
            :error="errores.password"
          >
            <UInput
              v-model="contrasena"
              type="password"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="cambiaContrasena"
            label="Repite la contraseña"
            :error="avisarNoCoinciden ? 'Las dos contraseñas no coinciden.' : undefined"
          >
            <UInput
              v-model="confirmacion"
              type="password"
              autocomplete="new-password"
              class="w-full"
            />
          </UFormField>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full gap-2">
        <UButton
          block
          size="lg"
          variant="outline"
          color="neutral"
          :disabled="guardando"
          @click="emit('cerrar')"
        >
          Cancelar
        </UButton>
        <UButton
          block
          size="lg"
          class="toque"
          :loading="guardando"
          :disabled="!listo"
          @click="guardar"
        >
          {{ esAlta ? 'Dar de alta' : 'Guardar' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
