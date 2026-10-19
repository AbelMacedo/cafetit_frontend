<script setup lang="ts">
import TarjetaSellos from '~/features/loyalty/components/TarjetaSellos.vue'
import { useCustomers } from '~/features/loyalty/composables/useLoyalty'
import type { Cliente, MovimientoLealtad } from '~/shared/types/api'

/**
 * La ficha de un cliente: su tarjeta y de dónde salió cada sello.
 *
 * El historial dice **quién puso cada sello**, y no es burocracia. El
 * sello lo pone el cajero y nada demuestra que el cliente estuviera
 * ahí; lo único que queda contra eso es que ningún sello sea anónimo —y
 * eso sólo sirve si se ve donde alguien lo va a mirar. Si un mismo
 * nombre aparece en los diez, salta a la vista aquí.
 */
const props = defineProps<{
  cliente: Cliente
}>()

const emit = defineEmits<{
  borrado: [mensaje: string]
  cerrar: []
}>()

const { ficha, borrar } = useCustomers()

const cargando = ref(true)
const error = ref<string | null>(null)
const datos = ref<Cliente>(props.cliente)
const movimientos = ref<MovimientoLealtad[]>([])
const meta = ref(10)

const confirmandoBaja = ref(false)
const borrando = ref(false)

onMounted(async () => {
  try {
    const r = await ficha(props.cliente.id)

    datos.value = r.cliente
    movimientos.value = r.movimientos
    meta.value = r.programa.sellos_para_premio
  } catch {
    error.value = 'No se pudo cargar la ficha.'
  } finally {
    cargando.value = false
  }
})

function fecha(iso: string | null): string {
  if (iso === null) return '—'

  /*
   | Se parte a mano en lugar de pasar por `new Date`.
   |
   | El servidor manda un día del negocio («2026-10-18»), no un
   | instante. Convertirlo a Date lo interpreta como medianoche UTC y en
   | México lo pinta un día antes: el sello del jueves aparecería como
   | del miércoles.
   */
  const [a, m, d] = iso.slice(0, 10).split('-')

  return `${d}/${m}/${a}`
}

async function darDeBaja(): Promise<void> {
  borrando.value = true

  try {
    const mensaje = await borrar(props.cliente.id)
    emit('borrado', mensaje)
  } catch {
    error.value = 'No se pudo dar de baja al cliente.'
    borrando.value = false
  }
}
</script>

<template>
  <UModal
    :open="true"
    :title="datos.nombre"
    :description="`Cliente desde ${fecha(datos.desde)}`"
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
        />

        <TarjetaSellos
          :cliente="datos"
          :meta="meta"
        />

        <div>
          <div class="flex items-baseline justify-between gap-2 mb-2">
            <h3 class="text-sm font-semibold text-tinta">
              Historial
            </h3>
            <span
              v-if="movimientos.length > 0"
              class="text-xs text-apagado tabular-nums"
            >{{ movimientos.length }}
              {{ movimientos.length === 1 ? 'movimiento' : 'movimientos' }}</span>
          </div>

          <EsqueletoLista
            v-if="cargando"
            :filas="3"
          />

          <SinResultados
            v-else-if="movimientos.length === 0"
            variante="suelto"
            icono="i-lucide-history"
            titulo="Sin movimientos"
            descripcion="Todavía no ha ganado ni canjeado nada."
          />

          <!--
            El que se desplaza es el historial, no la ventana.

            Con la lista creciendo libremente, un cliente de treinta
            sellos empujaba «Dar de baja» tan abajo que había que
            recorrer media pantalla para llegar. Acotando el alto aquí,
            la tarjeta se queda arriba y el botón abajo, siempre en el
            mismo sitio, y lo único que se mueve es lo que es largo.
          -->
          <ul
            v-else
            class="rounded-xl border border-borde divide-y divide-borde-suave
                   overflow-y-auto max-h-56"
          >
            <li
              v-for="(m, i) in movimientos"
              :key="`${m.tipo}-${i}`"
              class="flex items-center gap-3 px-3 py-2.5 text-sm"
              :class="m.tipo === 'canje' ? 'bg-naranja-50 dark:bg-naranja-950/30' : 'bg-superficie'"
            >
              <UIcon
                :name="m.tipo === 'canje' ? 'i-lucide-gift' : 'i-lucide-stamp'"
                class="size-4 shrink-0"
                :class="m.tipo === 'canje' ? 'text-naranja-600 dark:text-naranja-400' : 'text-apagado'"
              />

              <span class="min-w-0 flex-1">
                <span
                  v-if="m.tipo === 'canje'"
                  class="font-medium text-tinta"
                >
                  Canjeó «{{ m.recompensa ?? 'una recompensa' }}»
                  <span class="text-apagado font-normal">· −{{ m.sellos }} sellos</span>
                </span>
                <span
                  v-else
                  class="text-tinta"
                >
                  Sello
                  <span
                    v-if="m.venta_id"
                    class="text-apagado"
                  >· venta #{{ m.venta_id }}</span>
                </span>

                <!--
                  Quién lo puso, en su propio renglón y siempre visible.
                  Es la mitad de para qué existe esta lista.
                -->
                <span class="block text-xs text-apagado-2 truncate">
                  {{ m.quien ?? 'Sin registrar' }}
                </span>
              </span>

              <span class="text-xs text-apagado tabular-nums shrink-0">
                {{ fecha(m.cuando) }}
              </span>
            </li>
          </ul>
        </div>

        <!--
          La baja borra de verdad, al revés que todo lo demás del
          sistema. Por eso se confirma aquí mismo y se dice en el botón
          cuántos sellos se lleva por delante: el número es la razón por
          la que alguien podría arrepentirse.
        -->
        <div class="border-t border-borde pt-4">
          <div
            v-if="!confirmandoBaja"
            class="flex items-center justify-between gap-3"
          >
            <p class="text-xs text-apagado">
              Si pide que borres sus datos, esto los elimina. No se puede deshacer.
            </p>
            <UButton
              size="sm"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              class="shrink-0"
              @click="confirmandoBaja = true"
            >
              Dar de baja
            </UButton>
          </div>

          <div
            v-else
            class="rounded-xl border border-red-200 dark:border-red-900
                   bg-red-50 dark:bg-red-950/40 px-4 py-3 space-y-3"
          >
            <p class="text-sm text-red-900 dark:text-red-200">
              Se borrarán sus datos y sus
              <strong>{{ datos.sellos ?? 0 }} sellos</strong>.
              Sus ventas se quedan, sólo dejan de tener cliente.
            </p>

            <div class="flex gap-2 justify-end">
              <UButton
                size="sm"
                variant="outline"
                color="neutral"
                :disabled="borrando"
                @click="confirmandoBaja = false"
              >
                Mejor no
              </UButton>
              <UButton
                size="sm"
                color="error"
                :loading="borrando"
                @click="darDeBaja"
              >
                Sí, borrar
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton
        block
        size="lg"
        variant="outline"
        color="neutral"
        @click="emit('cerrar')"
      >
        Cerrar
      </UButton>
    </template>
  </UModal>
</template>
