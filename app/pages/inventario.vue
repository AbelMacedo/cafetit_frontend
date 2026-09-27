<script setup lang="ts">
import UrgenciaLote from '~/features/inventory/components/UrgenciaLote.vue'
import { useInventory } from '~/features/inventory/composables/useInventory'
import { ApiError } from '~/shared/composables/useApi'
import { formatearCentavos } from '~/shared/utils/dinero'
import type { Lote, MotivoMerma } from '~/shared/types/api'

definePageMeta({ middleware: 'auth' })

const toast = useToast()
const {
  lotes, porCaducar, resumen, ventanaHoras, conStock,
  cargando, error, cargar, cargarProductosConStock, recibir, mermar
} = useInventory()

onMounted(async () => {
  await Promise.all([cargar(), cargarProductosConStock()])
})

/* --- Entrada de mercancía --- */
const mostrarEntrada = ref(false)
const guardando = ref(false)
const errorEntrada = ref<string | null>(null)

const entrada = reactive({
  variant_id: undefined as number | undefined,
  quantity: 1,
  horas_de_vida: 12,
  unit_cost_pesos: 0,
  lot_code: '',
  supplier: ''
})

/**
 * La caducidad se captura como "horas de vida", no como fecha y hora.
 *
 * Es como lo piensa quien recibe la charola: "esto dura hasta la tarde".
 * Pedirle una fecha con hora exacta invita a teclear cualquier cosa.
 */
const caducaEn = computed(() => {
  const d = new Date()
  d.setHours(d.getHours() + entrada.horas_de_vida)
  return d
})

async function guardarEntrada() {
  if (entrada.variant_id === undefined) {
    errorEntrada.value = 'Elige el producto.'
    return
  }

  guardando.value = true
  errorEntrada.value = null

  try {
    await recibir({
      variant_id: entrada.variant_id,
      quantity: entrada.quantity,
      expires_at: entrada.horas_de_vida > 0 ? caducaEn.value.toISOString() : undefined,
      unit_cost_cents: Math.round(entrada.unit_cost_pesos * 100),
      lot_code: entrada.lot_code || undefined,
      supplier: entrada.supplier || undefined
    })

    toast.add({
      title: 'Entrada registrada',
      description: `${entrada.quantity} piezas en existencias.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    mostrarEntrada.value = false
    Object.assign(entrada, {
      variant_id: undefined, quantity: 1, horas_de_vida: 12,
      unit_cost_pesos: 0, lot_code: '', supplier: ''
    })
  } catch (e) {
    errorEntrada.value = e instanceof ApiError ? e.message : 'No se pudo registrar la entrada.'
  } finally {
    guardando.value = false
  }
}

/* --- Merma --- */
const loteAMermar = ref<Lote | null>(null)
const merma = reactive({ cantidad: 1, motivo: 'expired' as MotivoMerma, notas: '' })
const errorMerma = ref<string | null>(null)
const mermando = ref(false)

const motivos: Array<{ valor: MotivoMerma, etiqueta: string }> = [
  { valor: 'expired', etiqueta: 'Caducó' },
  { valor: 'damaged', etiqueta: 'Dañado' },
  { valor: 'preparation_error', etiqueta: 'Error de preparación' },
  { valor: 'courtesy', etiqueta: 'Cortesía' },
  { valor: 'other', etiqueta: 'Otro' }
]

function abrirMerma(lote: Lote) {
  loteAMermar.value = lote
  merma.cantidad = lote.restantes
  merma.motivo = lote.caducado ? 'expired' : 'damaged'
  merma.notas = ''
  errorMerma.value = null
}

async function guardarMerma() {
  if (!loteAMermar.value) return

  mermando.value = true
  errorMerma.value = null

  try {
    const piezas = merma.cantidad
    await mermar(loteAMermar.value.id, merma.cantidad, merma.motivo, merma.notas)
    loteAMermar.value = null

    toast.add({
      title: 'Merma registrada',
      description: `${piezas} ${piezas === 1 ? 'pieza dada' : 'piezas dadas'} de baja.`,
      color: 'success',
      icon: 'i-lucide-check'
    })
  } catch (e) {
    errorMerma.value = e instanceof ApiError ? e.message : 'No se pudo registrar la merma.'
  } finally {
    mermando.value = false
  }
}

function nombreDe(lote: Lote): string {
  const p = lote.producto
  if (!p) return `Lote #${lote.id}`
  return p.variante ? `${p.nombre} · ${p.variante}` : p.nombre
}

/**
 * Ventana de caducidad.
 *
 * Recarga desde el servidor: la ventana es parte de la consulta, no un
 * filtro sobre lo que ya se trajo.
 */
const ventanas = [
  { value: 12, label: 'Próximas 12 horas' },
  { value: 24, label: 'Próximas 24 horas' },
  { value: 72, label: 'Próximos 3 días' }
]

const ventanaFiltro = computed({
  get: () => ventanaHoras.value,
  set: (v: string | number) => {
    ventanaHoras.value = Number(v)
    void cargar()
  }
})
</script>

<template>
  <div class="space-y-6">
    <PaginaTitulo
      titulo="Inventario"
      descripcion="Por lotes, no por producto: dos charolas que entraron a horas distintas caducan a horas distintas."
    >
      <template #acciones>
        <UButton
          icon="i-lucide-plus"
          class="toque"
          @click="mostrarEntrada = true"
        >
          Entrada
        </UButton>
      </template>
    </PaginaTitulo>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <!-- Sacar hoy: lo primero, porque es lo que decide el día -->
    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">
            Sacar primero
          </h2>
          <p class="text-sm text-beige-600">
            En orden de urgencia. Lo de arriba se vende antes.
          </p>
        </div>

        <div class="flex items-center gap-1">
          <FiltroSelect
            v-model="ventanaFiltro"
            :opciones="ventanas"
            etiqueta="Ventana de caducidad"
            icono="i-lucide-clock"
            ancho="w-52"
          />
        </div>
      </div>

      <!-- El valor en riesgo es el argumento del módulo: sin esta cifra,
             el control de caducidades es sólo trabajo administrativo -->
      <div
        v-if="resumen && resumen.lotes > 0"
        class="rounded-lg border p-4 flex flex-wrap items-center justify-between gap-4"
        :class="resumen.ya_caducados > 0
          ? 'border-error-300 bg-error-50 dark:border-error-800 dark:bg-error-950'
          : 'border-warning-300 bg-warning-50 dark:border-warning-800 dark:bg-warning-950'"
      >
        <div>
          <p class="text-sm text-beige-700 dark:text-beige-300">
            {{ resumen.piezas }} piezas en {{ resumen.lotes }}
            {{ resumen.lotes === 1 ? 'lote' : 'lotes' }}
            <template v-if="resumen.ya_caducados > 0">
              · <strong>{{ resumen.ya_caducados }} ya caducado{{ resumen.ya_caducados === 1 ? '' : 's' }}</strong>
            </template>
          </p>
          <p class="text-xs text-beige-600 mt-0.5">
            Se pierde si no se vende en {{ resumen.ventana_horas }} horas
          </p>
        </div>
        <p class="text-3xl font-semibold tabular-nums">
          {{ resumen.valor_en_riesgo.formatted }}
        </p>
      </div>

      <SinResultados
        v-else-if="!cargando"
        icono="i-lucide-shield-check"
        :titulo="`Nada por caducar en las próximas ${ventanaHoras} horas`"
        descripcion="Nada en riesgo en esta ventana."
      />

      <EsqueletoLista
        v-if="cargando"
        :filas="3"
      />

      <div class="space-y-2">
        <div
          v-for="l in porCaducar"
          :key="l.id"
          class="tarjeta p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium leading-tight">
              {{ nombreDe(l) }}
            </p>
            <p class="text-xs text-beige-600">
              {{ l.restantes }} de {{ l.recibidas }} piezas
              <template v-if="l.lote">
                · {{ l.lote }}
              </template>
            </p>
          </div>

          <div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
            <UrgenciaLote
              :horas="l.horas_para_caducar"
              :caducado="l.caducado"
            />

            <span class="text-sm font-semibold tabular-nums text-right">
              {{ l.valor_restante.formatted }}
            </span>

            <UButton
              size="xs"
              variant="outline"
              color="neutral"
              @click="abrirMerma(l)"
            >
              Merma
            </UButton>
          </div>
        </div>
      </div>
    </section>

    <!-- Todo el inventario -->
    <section class="space-y-3">
      <h2 class="text-lg font-semibold">
        Todo el inventario
      </h2>

      <SinResultados
        v-if="!cargando && lotes.length === 0"
        icono="i-lucide-package"
        titulo="No hay lotes cargados"
        descripcion="El inventario se lleva por lotes: cada entrada de mercancía es uno."
      >
        <template #accion>
          <UButton
            icon="i-lucide-plus"
            @click="mostrarEntrada = true"
          >
            Registrar entrada
          </UButton>
        </template>
      </SinResultados>

      <div class="space-y-2">
        <div
          v-for="l in lotes"
          :key="l.id"
          class="tarjeta p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium leading-tight">
              {{ nombreDe(l) }}
            </p>
            <p class="text-xs text-beige-600">
              {{ l.restantes }} piezas
              <template v-if="l.proveedor">
                · {{ l.proveedor }}
              </template>
            </p>
          </div>

          <div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0">
            <UrgenciaLote
              :horas="l.horas_para_caducar"
              :caducado="l.caducado"
            />

            <span class="text-sm tabular-nums text-right text-beige-600">
              {{ l.valor_restante.formatted }}
            </span>

            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              @click="abrirMerma(l)"
            >
              Merma
            </UButton>
          </div>
        </div>
      </div>
    </section>

    <!--
      Se monta y desmonta con v-if, no sólo con :open.

      Con `:open` el diálogo no se desmonta si dentro quedó una capa
      anidada abierta —el popup del USelectMenu—, y su overlay se queda
      encima interceptando todos los clics de la pantalla. Pasó de verdad.
    -->
    <UModal
      v-if="mostrarEntrada"
      :open="true"
      title="Entrada de mercancía"
      @update:open="mostrarEntrada = false"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="guardarEntrada"
        >
          <UFormField
            label="Producto"
            help="Sólo aparecen los que controlan inventario por pieza."
          >
            <USelectMenu
              v-model="entrada.variant_id"
              :items="conStock"
              value-key="id"
              label-key="etiqueta"
              placeholder="Elige el producto"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Piezas">
              <UInput
                v-model.number="entrada.quantity"
                type="number"
                min="1"
                class="w-full"
                :ui="{ base: 'tabular-nums text-right' }"
              />
            </UFormField>

            <UFormField label="Costo por pieza">
              <UInput
                v-model.number="entrada.unit_cost_pesos"
                type="number"
                min="0"
                step="0.5"
                class="w-full"
                :ui="{ base: 'tabular-nums text-right' }"
              />
            </UFormField>
          </div>

          <UFormField
            label="Horas de vida"
            help="Cuánto dura desde ahora. Pon 0 si el producto no caduca."
          >
            <div class="flex flex-wrap gap-2 mb-2">
              <UButton
                v-for="h in [4, 8, 12, 24, 48, 72]"
                :key="h"
                size="xs"
                :variant="entrada.horas_de_vida === h ? 'soft' : 'outline'"
                :color="entrada.horas_de_vida === h ? 'primary' : 'neutral'"
                @click="entrada.horas_de_vida = h"
              >
                {{ h < 24 ? `${h} h` : `${h / 24} d` }}
              </UButton>
            </div>
            <UInput
              v-model.number="entrada.horas_de_vida"
              type="number"
              min="0"
              class="w-full"
              :ui="{ base: 'tabular-nums text-right' }"
            />
          </UFormField>

          <p
            v-if="entrada.horas_de_vida > 0"
            class="text-sm text-beige-600 text-right"
          >
            Caduca el {{ caducaEn.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) }}
          </p>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Lote (opcional)">
              <UInput
                v-model="entrada.lot_code"
                placeholder="Charola matutina"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Proveedor (opcional)">
              <UInput
                v-model="entrada.supplier"
                class="w-full"
              />
            </UFormField>
          </div>

          <p class="text-right text-sm text-beige-600 tabular-nums">
            Valor del lote:
            {{ formatearCentavos(Math.round(entrada.unit_cost_pesos * 100) * entrada.quantity) }}
          </p>

          <UAlert
            v-if="errorEntrada"
            color="error"
            variant="subtle"
            :title="errorEntrada"
          />
        </form>
      </template>

      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            block
            size="lg"
            variant="outline"
            color="neutral"
            :disabled="guardando"
            @click="mostrarEntrada = false"
          >
            Cancelar
          </UButton>
          <UButton
            block
            size="lg"
            class="toque"
            :loading="guardando"
            @click="guardarEntrada"
          >
            Registrar entrada
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Merma -->
    <UModal
      v-if="loteAMermar"
      :open="true"
      title="Registrar merma"
      @update:open="loteAMermar = null"
    >
      <template #body>
        <div class="space-y-4">
          <div class="rounded-lg bg-beige-100 dark:bg-beige-900 p-3">
            <p class="font-medium">
              {{ nombreDe(loteAMermar) }}
            </p>
            <p class="text-sm text-beige-600">
              Quedan {{ loteAMermar.restantes }} piezas · {{ loteAMermar.valor_restante.formatted }}
            </p>
          </div>

          <UFormField label="Piezas a dar de baja">
            <UInput
              v-model.number="merma.cantidad"
              type="number"
              min="1"
              :max="loteAMermar.restantes"
              class="w-full"
              :ui="{ base: 'tabular-nums text-right' }"
            />
          </UFormField>

          <UFormField
            label="Motivo"
            help="Separa la pérdida evitable de la decisión comercial. Por eso no hay texto libre aquí."
          >
            <div class="grid grid-cols-2 gap-2">
              <UButton
                v-for="m in motivos"
                :key="m.valor"
                block
                size="sm"
                class="toque"
                :variant="merma.motivo === m.valor ? 'soft' : 'outline'"
                :color="merma.motivo === m.valor ? 'primary' : 'neutral'"
                @click="merma.motivo = m.valor"
              >
                {{ m.etiqueta }}
              </UButton>
            </div>
          </UFormField>

          <UTextarea
            v-model="merma.notas"
            placeholder="Detalle (opcional)"
            class="w-full"
          />

          <UAlert
            v-if="errorMerma"
            color="error"
            variant="subtle"
            :title="errorMerma"
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
            :disabled="mermando"
            @click="loteAMermar = null"
          >
            Cancelar
          </UButton>
          <UButton
            block
            size="lg"
            color="error"
            class="toque"
            :loading="mermando"
            @click="guardarMerma"
          >
            Dar de baja
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
