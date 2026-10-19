<script setup lang="ts">
import { ApiError } from '~/shared/composables/useApi'
import { soloDigitos, telefonoValido, useLoyalty } from '~/features/loyalty/composables/useLoyalty'
import TarjetaSellos from '~/features/loyalty/components/TarjetaSellos.vue'
import type { Cliente } from '~/shared/types/api'

/**
 * Identificar al cliente en el mostrador.
 *
 * El flujo entero en una ventana, porque es el de verdad: el cajero
 * teclea diez dígitos con alguien enfrente y pasa una de dos cosas.
 *
 *  - **Está** → se ve su tarjeta y se le asigna la venta.
 *  - **No está** → se le ofrece el alta ahí mismo, con su nombre, o se
 *    sigue sin más. Registrarse es opcional y nadie debería tener que
 *    salirse de la venta para hacerlo.
 *
 * El aviso de privacidad no es un adorno legal: está para que el cajero
 * tenga algo que leer en voz alta. Quien da su teléfono en un mostrador
 * merece saber qué se hace con él, y pedirle a una persona con prisa que
 * se lo invente cada vez es cómo se acaba no diciendo nada.
 */
const emit = defineEmits<{
  elegido: [cliente: Cliente]
  cerrar: []
}>()

const lealtad = useLoyalty()

const telefono = ref('')
const nombre = ref('')
const registrando = ref(false)
const guardando = ref(false)
const errorAlta = ref<string | null>(null)
const errorNombre = ref<string | undefined>(undefined)

const meta = computed(() => lealtad.programa.value?.sellos_para_premio ?? 10)

/** Los diez dígitos, se teclee como se teclee. */
const digitos = computed(() => soloDigitos(telefono.value))
const valido = computed(() => telefonoValido(telefono.value))

/**
 * Buscar de nuevo al cambiar el número.
 *
 * Sin esto, el resultado del número anterior se queda en pantalla
 * mientras se teclea el siguiente: el cajero vería la tarjeta de Mariana
 * con el teléfono de Beto a medio escribir.
 */
watch(telefono, () => {
  lealtad.limpiar()
  registrando.value = false
  errorAlta.value = null
  errorNombre.value = undefined
})

async function buscar(): Promise<void> {
  if (!valido.value) return

  await lealtad.buscar(telefono.value)
}

function asignar(): void {
  if (lealtad.encontrado.value) emit('elegido', lealtad.encontrado.value)
}

async function registrar(): Promise<void> {
  if (nombre.value.trim().length < 2 || guardando.value) return

  guardando.value = true
  errorAlta.value = null
  errorNombre.value = undefined

  try {
    const cliente = await lealtad.registrar(nombre.value.trim(), telefono.value)
    emit('elegido', cliente)
  } catch (e) {
    if (e instanceof ApiError) {
      errorAlta.value = e.message
      errorNombre.value = e.campo('nombre')
    } else {
      errorAlta.value = 'No se pudo dar de alta al cliente.'
    }
  } finally {
    guardando.value = false
  }
}

/*
 | El teléfono se formatea mientras se escribe: 477 123 4567.
 |
 | Diez dígitos seguidos se leen mal y se comprueban peor. Agrupados, el
 | cajero puede repetirlos en voz alta y el cliente corregirle.
 */
const formateado = computed(() => {
  const d = digitos.value

  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`

  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`
})

function alEscribir(valor: string | number): void {
  telefono.value = soloDigitos(String(valor)).slice(0, 10)
}

onMounted(() => {
  void lealtad.cargarPrograma()
})
</script>

<template>
  <UModal
    :open="true"
    title="Cliente del programa"
    description="Se busca por teléfono. Diez dígitos."
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-4">
        <!--
          El programa apagado se dice y punto. Dejar la búsqueda viva
          cuando nada va a sellar es prometer algo que no ocurre.
        -->
        <UAlert
          v-if="lealtad.programa.value && !lealtad.activo.value"
          color="warning"
          variant="subtle"
          icon="i-lucide-power-off"
          title="El programa está apagado"
          description="Se puede identificar al cliente, pero esta venta no le dará sello."
        />

        <UFormField
          label="Teléfono"
          help="Sólo sirve para encontrarlo. No se guarda completo."
        >
          <div class="flex gap-2">
            <UInput
              :model-value="formateado"
              autofocus
              inputmode="numeric"
              placeholder="477 123 4567"
              size="xl"
              class="flex-1"
              :ui="{ base: 'tabular-nums tracking-wide text-lg' }"
              @update:model-value="alEscribir"
              @keyup.enter="buscar"
            />

            <UButton
              size="xl"
              icon="i-lucide-search"
              :loading="lealtad.buscando.value"
              :disabled="!valido"
              @click="buscar"
            >
              Buscar
            </UButton>
          </div>
        </UFormField>

        <UAlert
          v-if="lealtad.error.value"
          color="error"
          variant="subtle"
          :title="lealtad.error.value"
        />

        <!-- Está: su tarjeta -->
        <template v-if="lealtad.buscado.value && lealtad.encontrado.value">
          <TarjetaSellos
            :cliente="lealtad.encontrado.value"
            :meta="meta"
          />
        </template>

        <!-- No está: el alta, si quiere -->
        <template v-else-if="lealtad.buscado.value">
          <div
            v-if="!registrando"
            class="rounded-xl border border-borde bg-hundido px-4 py-5 text-center space-y-3"
          >
            <UIcon
              name="i-lucide-user-round-search"
              class="size-8 text-apagado-2"
            />
            <p class="text-sm text-tinta-2">
              Ese número no está registrado.
            </p>

            <!--
              «¿Quiere registrarse?», no «regístrelo».
              Decir que no tiene que ser igual de fácil, o el cajero
              acabará dando de alta a quien dijo que no.

              «Ahora no» y no «seguir sin registrar» porque esta ventana
              se abre desde dos sitios: en una venta se sigue cobrando,
              y desde Clientes no hay nada que seguir.
            -->
            <div class="flex flex-col sm:flex-row gap-2 justify-center pt-1">
              <UButton
                variant="outline"
                color="neutral"
                @click="emit('cerrar')"
              >
                Ahora no
              </UButton>
              <UButton
                icon="i-lucide-user-round-plus"
                @click="registrando = true"
              >
                Registrarlo
              </UButton>
            </div>
          </div>

          <div
            v-else
            class="space-y-4"
          >
            <!--
              EL AVISO.

              Va arriba del campo, no debajo en letra chica: tiene que
              leerse antes de teclear el nombre, que es el momento en que
              el cajero está hablando con la persona.
            -->
            <div
              class="rounded-xl border border-cafe-200 dark:border-cafe-800
                     bg-cafe-50 dark:bg-cafe-950/50 px-4 py-3"
            >
              <p class="flex items-center gap-2 text-sm font-semibold text-tinta mb-1.5">
                <UIcon
                  name="i-lucide-megaphone"
                  class="size-4 shrink-0"
                />
                Dile esto antes de darlo de alta
              </p>
              <p class="text-sm text-tinta-2 leading-relaxed">
                «Su número sólo se usa para encontrar sus sellos aquí: no se
                guarda completo, no se le va a llamar ni a mandar mensajes, y
                no se comparte con nadie. Lo único que aparece en pantalla es
                su nombre y los últimos cuatro dígitos.»
              </p>
            </div>

            <UFormField
              label="Nombre"
              help="Es lo único que se verá en pantalla."
              :error="errorNombre"
            >
              <UInput
                v-model="nombre"
                autofocus
                size="xl"
                placeholder="Mariana"
                class="w-full"
                @keyup.enter="registrar"
              />
            </UFormField>

            <UAlert
              v-if="errorAlta"
              color="error"
              variant="subtle"
              :title="errorAlta"
            />
          </div>
        </template>
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
          v-if="lealtad.encontrado.value"
          block
          size="lg"
          class="toque"
          icon="i-lucide-check"
          @click="asignar"
        >
          Es este
        </UButton>

        <UButton
          v-else-if="registrando"
          block
          size="lg"
          class="toque"
          :loading="guardando"
          :disabled="nombre.trim().length < 2"
          @click="registrar"
        >
          Dar de alta
        </UButton>
      </div>
    </template>
  </UModal>
</template>
