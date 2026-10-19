<script setup lang="ts">
import RecompensaModal from '~/features/loyalty/components/RecompensaModal.vue'
import { type DatosRecompensa, useRewards } from '~/features/loyalty/composables/useLoyalty'
import { ApiError } from '~/shared/composables/useApi'
import type { Recompensa } from '~/shared/types/api'

definePageMeta({ middleware: 'auth' })

const {
  recompensas, vigentes, ajustes, cargando, error,
  cargar, crear, editar, desactivar, guardarAjustes
} = useRewards()

onMounted(cargar)

/*
 * La configuración se edita sobre una copia.
 *
 * Escribiendo directo sobre `ajustes` el encabezado de la pantalla
 * cambiaría mientras se teclea: subir el mínimo a $45 haría que la lista
 * dijera «mínimo $4» a mitad de camino. Se copia, se edita y se guarda.
 */
const forma = reactive({
  activo: false,
  compra_minima_cents: 0,
  sellos_para_premio: 10
})

watch(ajustes, (v) => {
  forma.activo = v.activo
  forma.compra_minima_cents = v.compra_minima_cents
  forma.sellos_para_premio = v.sellos_para_premio
}, { immediate: true, deep: true })

const sucio = computed(() =>
  forma.activo !== ajustes.value.activo
  || forma.compra_minima_cents !== ajustes.value.compra_minima_cents
  || forma.sellos_para_premio !== ajustes.value.sellos_para_premio
)

const guardandoAjustes = ref(false)
const errorAjustes = ref<string | null>(null)
const avisoAjustes = ref<string | null>(null)

async function guardarConfig(): Promise<void> {
  guardandoAjustes.value = true
  errorAjustes.value = null
  avisoAjustes.value = null

  try {
    await guardarAjustes({ ...forma })
    avisoAjustes.value = 'Configuración guardada.'
  } catch (e) {
    errorAjustes.value = e instanceof ApiError ? e.message : 'No se pudo guardar.'
  } finally {
    guardandoAjustes.value = false
  }
}

/*
 * Recompensas
 */

const creando = ref(false)
const editando = ref<Recompensa | null>(null)
const modalAbierto = computed(() => creando.value || editando.value !== null)
const claveModal = computed(() => editando.value?.id ?? 'alta')

const guardando = ref(false)
const errorForm = ref<string | null>(null)
const erroresForm = ref<Record<string, string>>({})

function cerrar(): void {
  creando.value = false
  editando.value = null
  errorForm.value = null
  erroresForm.value = {}
}

async function alGuardar(datos: DatosRecompensa): Promise<void> {
  guardando.value = true
  errorForm.value = null
  erroresForm.value = {}

  try {
    if (editando.value) {
      await editar(editando.value.id, datos)
    } else {
      await crear(datos)
    }

    cerrar()
  } catch (e) {
    if (e instanceof ApiError) {
      errorForm.value = e.message

      for (const [campo, mensajes] of Object.entries(e.errors)) {
        if (mensajes[0]) erroresForm.value[campo] = mensajes[0]
      }
    } else {
      errorForm.value = 'No se pudo guardar.'
    }
  } finally {
    guardando.value = false
  }
}

const errorBaja = ref<string | null>(null)

async function alDesactivar(r: Recompensa): Promise<void> {
  errorBaja.value = null

  try {
    await desactivar(r.id)
  } catch (e) {
    errorBaja.value = e instanceof ApiError ? e.message : 'No se pudo desactivar.'
  }
}

async function alReactivar(r: Recompensa): Promise<void> {
  errorBaja.value = null

  try {
    await editar(r.id, { activa: true })
  } catch (e) {
    errorBaja.value = e instanceof ApiError ? e.message : 'No se pudo reactivar.'
  }
}

const hoy = new Date().toISOString().slice(0, 10)

function fecha(iso: string): string {
  // Día del negocio: se parte a mano para que no lo corra un día `new Date`.
  const [a, m, d] = iso.slice(0, 10).split('-')

  return `${d}/${m}/${a}`
}

function estado(r: Recompensa): { texto: string, color: 'primary' | 'neutral' | 'warning' } {
  if (!r.activa) return { texto: 'Desactivada', color: 'neutral' }
  if (r.hasta < hoy) return { texto: 'Caducada', color: 'neutral' }
  if (r.desde > hoy) return { texto: 'Programada', color: 'warning' }

  return { texto: 'Vigente', color: 'primary' }
}
</script>

<template>
  <div class="space-y-6">
    <PaginaTitulo
      titulo="Recompensas"
      descripcion="Lo que se puede pedir al llenar la tarjeta, y cómo funciona el programa."
    >
      <template #acciones>
        <UButton
          icon="i-lucide-gift"
          class="toque"
          @click="creando = true"
        >
          Nueva recompensa
        </UButton>
      </template>

      <template #resumen>
        {{ vigentes.length }} {{ vigentes.length === 1 ? 'vigente hoy' : 'vigentes hoy' }}
      </template>
    </PaginaTitulo>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <!--
      =================================================================
      La configuración
      =================================================================
      Va arriba porque el interruptor manda sobre todo lo demás: con el
      programa apagado, una lista de recompensas preciosa no sella nada.
    -->
    <section class="tarjeta p-4 sm:p-5 space-y-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="font-semibold text-tinta">
            Cómo funciona el programa
          </h2>
          <p class="text-sm text-apagado mt-0.5">
            Cambiarlo no le quita sellos a nadie: los canjes hechos siguen
            contando lo que costaron entonces.
          </p>
        </div>

        <USwitch
          v-model="forma.activo"
          :label="forma.activo ? 'Encendido' : 'Apagado'"
          class="shrink-0"
        />
      </div>

      <div class="grid sm:grid-cols-2 gap-4">
        <UFormField
          label="Consumo mínimo por visita"
          help="Para que un chicle no cuente como visita. En cero, cualquier compra cuenta."
        >
          <CampoPesos
            v-model="forma.compra_minima_cents"
            size="lg"
          />
        </UFormField>

        <UFormField
          label="Sellos para un premio"
          help="Cuántas visitas distintas hacen falta. Un sello por día, como máximo."
        >
          <UInputNumber
            v-model="forma.sellos_para_premio"
            :min="1"
            :max="100"
            size="lg"
            class="w-full"
          />
        </UFormField>
      </div>

      <!--
        El aviso de lo que esto significa de verdad.

        No es paja legal: encender el programa pone al cajero a teclear
        teléfonos de clientes, y quien lo enciende debería saber qué se
        guarda y qué no antes de hacerlo, no después.
      -->
      <div class="rounded-xl bg-hundido border border-borde-suave px-4 py-3">
        <p class="text-xs text-apagado leading-relaxed">
          <UIcon
            name="i-lucide-shield-check"
            class="size-3.5 inline-block align-[-2px] mr-1"
          />
          El teléfono del cliente <strong class="text-tinta-2">no se guarda</strong>:
          la base tiene una huella irreversible y los últimos cuatro dígitos.
          Nadie puede leer un número desde aquí, ni exportarlo. A cambio,
          sólo se encuentra a quien dice su número completo.
        </p>
      </div>

      <UAlert
        v-if="errorAjustes"
        color="error"
        variant="subtle"
        :title="errorAjustes"
      />

      <UAlert
        v-if="avisoAjustes"
        color="success"
        variant="subtle"
        :title="avisoAjustes"
        close
        @update:open="avisoAjustes = null"
      />

      <!--
        El botón se apaga cuando no hay nada que guardar, y se DICE.

        Apagado a secas se lee como roto: se llega a la pantalla, el
        botón sale con el cursor de prohibido y nada explica por qué.
        La frase de al lado convierte «no funciona» en «no hace falta»,
        y de paso avisa cuando sí quedan cambios sin guardar.
      -->
      <div class="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p
          class="text-sm"
          :class="sucio ? 'text-naranja-700 dark:text-naranja-300 font-medium' : 'text-apagado'"
        >
          <template v-if="sucio">
            <UIcon
              name="i-lucide-circle-alert"
              class="size-4 inline-block align-[-3px] mr-1"
            />
            Hay cambios sin guardar.
          </template>
          <template v-else>
            <UIcon
              name="i-lucide-check"
              class="size-4 inline-block align-[-3px] mr-1"
            />
            Todo guardado.
          </template>
        </p>

        <UButton
          size="lg"
          class="toque"
          :loading="guardandoAjustes"
          :disabled="!sucio"
          @click="guardarConfig"
        >
          Guardar configuración
        </UButton>
      </div>
    </section>

    <!--
      =================================================================
      La lista
      =================================================================
    -->
    <section class="space-y-3">
      <UAlert
        v-if="errorBaja"
        color="error"
        variant="subtle"
        :title="errorBaja"
        close
        @update:open="errorBaja = null"
      />

      <EsqueletoLista
        v-if="cargando"
        :filas="3"
      />

      <SinResultados
        v-else-if="recompensas.length === 0"
        icono="i-lucide-gift"
        titulo="Todavía no hay recompensas"
        descripcion="Sin al menos una vigente, nadie puede canjear aunque tenga la tarjeta llena."
      />

      <div
        v-else
        class="tarjeta overflow-hidden"
      >
        <div class="overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10">
              <tr class="text-center [&>th]:border-r [&>th]:border-borde [&>th:last-child]:border-r-0">
                <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                  Recompensa
                </th>
                <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde hidden lg:table-cell">
                  Artículo
                </th>
                <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap hidden sm:table-cell">
                  Vigencia
                </th>
                <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap">
                  Estado
                </th>
                <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="r in recompensas"
                :key="r.id"
                class="border-b border-borde-suave last:border-0
                       [&>td]:border-r [&>td]:border-borde-suave [&>td:last-child]:border-r-0"
                :class="r.activa ? '' : 'text-apagado-2'"
              >
                <td class="px-3 lg:px-4 py-4 text-center max-w-0">
                  <span class="block font-medium truncate">{{ r.nombre }}</span>

                  <!-- En angosto, el artículo y las fechas se meten aquí. -->
                  <span class="block text-xs text-apagado truncate lg:hidden">
                    {{ r.articulo ?? 'Premio libre' }}
                  </span>
                  <span class="block text-xs text-apagado sm:hidden tabular-nums">
                    {{ fecha(r.desde) }} – {{ fecha(r.hasta) }}
                  </span>
                </td>

                <td class="px-3 lg:px-4 py-4 text-center max-w-0 hidden lg:table-cell">
                  <span
                    v-if="r.articulo"
                    class="block truncate"
                  >{{ r.articulo }}</span>
                  <span
                    v-else
                    class="text-apagado-2 italic"
                  >Premio libre</span>

                  <!--
                    Lo que vale el premio, para poder contestar «¿cuánto
                    me costó el programa?» sin abrir el catálogo.
                  -->
                  <span
                    v-if="r.precio_lista"
                    class="block text-xs text-apagado tabular-nums"
                  >{{ r.precio_lista }}</span>
                </td>

                <td class="px-3 lg:px-4 py-4 text-center text-apagado whitespace-nowrap tabular-nums hidden sm:table-cell">
                  {{ fecha(r.desde) }} – {{ fecha(r.hasta) }}
                </td>

                <td class="px-3 lg:px-4 py-4 text-center">
                  <UBadge
                    :color="estado(r).color"
                    variant="subtle"
                    size="md"
                  >
                    {{ estado(r).texto }}
                  </UBadge>
                </td>

                <td class="px-3 lg:px-4 py-4">
                  <span class="flex items-center justify-center gap-1">
                    <UButton
                      size="sm"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-pencil"
                      :aria-label="`Editar ${r.nombre}`"
                      @click="editando = r"
                    />

                    <UButton
                      v-if="r.activa"
                      size="sm"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-power-off"
                      :aria-label="`Desactivar ${r.nombre}`"
                      title="Desactivar"
                      @click="alDesactivar(r)"
                    />
                    <UButton
                      v-else
                      size="sm"
                      variant="ghost"
                      color="primary"
                      icon="i-lucide-power"
                      :aria-label="`Reactivar ${r.nombre}`"
                      title="Reactivar"
                      @click="alReactivar(r)"
                    />
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <RecompensaModal
      v-if="modalAbierto"
      :key="claveModal"
      :recompensa="editando"
      :guardando="guardando"
      :error="errorForm"
      :errores="erroresForm"
      @guardar="alGuardar"
      @cerrar="cerrar"
    />
  </div>
</template>
