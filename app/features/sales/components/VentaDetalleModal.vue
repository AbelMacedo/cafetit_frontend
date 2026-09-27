<script setup lang="ts">
import { useTicketPrinter } from '~/features/tickets/composables/useTicketPrinter'
import type { Venta } from '~/shared/types/api'

/**
 * Detalle de una venta: lo que se vendió, cómo se pagó, y las dos acciones
 * que la gente viene a hacer aquí — reimprimir el ticket o cancelarla.
 */
const props = defineProps<{
  venta: Venta
  cancelando: boolean
  errorCancelacion: string | null
}>()

const emit = defineEmits<{
  /** El padre decide qué hacer: aquí sólo se pide el motivo. */
  cancelar: [motivo: string]
  cerrar: []
}>()

const { imprimir, ver, imprimiendo } = useTicketPrinter()

const pidiendoMotivo = ref(false)
const motivo = ref('')
const errorImpresion = ref<string | null>(null)

const cancelable = computed(() => props.venta.estado === 'paid')

const error = computed(() => errorImpresion.value ?? props.errorCancelacion)

/*
 * El motivo obligatorio no es burocracia: como no hay roles, cualquiera
 * puede cancelar una venta, y lo único que lo hace rastreable es que quede
 * explicado y atribuido. El backend exige mínimo 4 caracteres.
 */
const motivoValido = computed(() => motivo.value.trim().length >= 4)

async function reimprimir() {
  errorImpresion.value = null

  try {
    await imprimir('venta', props.venta.id, { reimpresion: true })
  } catch {
    errorImpresion.value = 'No se pudo abrir el ticket.'
  }
}

function confirmarCancelacion() {
  if (!motivoValido.value || props.cancelando) return

  emit('cancelar', motivo.value.trim())
}
</script>

<template>
  <UModal
    :open="true"
    :title="`Venta #${venta.folio}`"
    :ui="{ content: 'max-w-lg' }"
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-4">
        <div
          v-if="venta.estado !== 'paid'"
          class="rounded-lg bg-error-50 dark:bg-error-950 p-3 text-center"
        >
          <p class="font-semibold">
            {{ venta.estado_texto }}
          </p>
          <p
            v-if="venta.cancelacion"
            class="text-sm text-beige-700 dark:text-beige-300"
          >
            {{ venta.cancelacion.motivo }}
          </p>
        </div>

        <dl class="grid grid-cols-2 gap-y-1 text-sm">
          <dt class="text-beige-600">
            Cobrada
          </dt>
          <dd class="text-right">
            {{ new Date(venta.cobrado_en).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) }}
          </dd>

          <dt class="text-beige-600">
            Cajero
          </dt>
          <dd class="text-right">
            {{ venta.cajero ?? '—' }}
          </dd>

          <template v-if="venta.cliente">
            <dt class="text-beige-600">
              Cliente
            </dt>
            <dd class="text-right">
              {{ venta.cliente }}
            </dd>
          </template>
        </dl>

        <div class="border-t border-beige-200 dark:border-beige-800 pt-3 space-y-1">
          <div
            v-for="l in venta.lineas ?? []"
            :key="l.id"
            class="flex items-baseline justify-between gap-3 text-sm"
          >
            <span class="min-w-0">
              <span class="tabular-nums text-beige-600">{{ l.cantidad }}×</span>
              {{ l.nombre }}
              <span
                v-if="l.nota"
                class="text-xs text-beige-600"
              >· {{ l.nota }}</span>
            </span>
            <span class="tabular-nums whitespace-nowrap">{{ l.total.formatted }}</span>
          </div>
        </div>

        <div class="border-t border-beige-200 dark:border-beige-800 pt-3 space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-beige-600">Subtotal</span>
            <span class="tabular-nums">{{ venta.subtotal.formatted }}</span>
          </div>
          <div
            v-if="venta.descuento.monto.cents > 0"
            class="flex justify-between"
          >
            <span class="text-beige-600">
              Descuento
              <span
                v-if="venta.descuento.motivo"
                class="text-xs"
              >· {{ venta.descuento.motivo }}</span>
            </span>
            <span class="tabular-nums">− {{ venta.descuento.monto.formatted }}</span>
          </div>
          <div class="flex justify-between items-baseline pt-1">
            <span class="font-medium">Total</span>
            <span class="text-2xl font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
              {{ venta.total.formatted }}
            </span>
          </div>
        </div>

        <div class="border-t border-beige-200 dark:border-beige-800 pt-3 space-y-1 text-sm">
          <div
            v-for="(p, i) in venta.pagos ?? []"
            :key="i"
            class="flex justify-between"
          >
            <span class="text-beige-600">
              {{ p.metodo_texto }}
              <span
                v-if="p.referencia"
                class="text-xs"
              >· {{ p.referencia }}</span>
            </span>
            <span class="tabular-nums">{{ p.monto.formatted }}</span>
          </div>
          <div
            v-for="(p, i) in (venta.pagos ?? []).filter(x => x.cambio)"
            :key="`cambio-${i}`"
            class="flex justify-between"
          >
            <span class="text-beige-600">Cambio</span>
            <span class="tabular-nums">{{ p.cambio?.formatted }}</span>
          </div>
        </div>

        <!-- Cancelar pide motivo en el mismo lugar, sin otro diálogo -->
        <div
          v-if="pidiendoMotivo"
          class="border-t border-beige-200 dark:border-beige-800 pt-3 space-y-2"
        >
          <UFormField
            label="¿Por qué se cancela?"
            help="Queda registrado con tu nombre y aparece en el corte del turno."
          >
            <UTextarea
              v-model="motivo"
              :rows="2"
              autofocus
              placeholder="El cliente cambió de opinión"
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
        <template v-if="!pidiendoMotivo">
          <UButton
            variant="outline"
            color="neutral"
            class="toque"
            icon="i-lucide-eye"
            @click="ver('venta', venta.id)"
          >
            Ver
          </UButton>
          <UButton
            variant="outline"
            color="neutral"
            class="toque"
            icon="i-lucide-printer"
            :loading="imprimiendo"
            @click="reimprimir"
          >
            Reimprimir
          </UButton>

          <div class="flex-1" />

          <UButton
            v-if="cancelable"
            variant="ghost"
            color="error"
            class="toque"
            @click="pidiendoMotivo = true"
          >
            Cancelar venta
          </UButton>
        </template>

        <template v-else>
          <UButton
            block
            variant="outline"
            color="neutral"
            class="toque"
            :disabled="cancelando"
            @click="pidiendoMotivo = false"
          >
            Mejor no
          </UButton>
          <UButton
            block
            color="error"
            class="toque"
            :loading="cancelando"
            :disabled="!motivoValido"
            @click="confirmarCancelacion"
          >
            Confirmar cancelación
          </UButton>
        </template>
      </div>
    </template>
  </UModal>
</template>
