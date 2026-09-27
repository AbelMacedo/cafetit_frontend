<script setup lang="ts">
import CierreCajaModal from '~/features/cash/components/CierreCajaModal.vue'
import MovimientoModal from '~/features/cash/components/MovimientoModal.vue'
import { useCashSessionStore } from '~/features/cash/stores/cashSession'
import { useTicketPrinter } from '~/features/tickets/composables/useTicketPrinter'
import { ApiError, useApi } from '~/shared/composables/useApi'
import { formatearCentavos } from '~/shared/utils/dinero'

definePageMeta({ middleware: 'auth' })

const api = useApi()
const toast = useToast()
const caja = useCashSessionStore()

const fondo = ref(0)
const etiqueta = ref<'matutino' | 'vespertino'>('matutino')
const error = ref<string | null>(null)
const trabajando = ref(false)
const mostrarCierre = ref(false)
const mostrarMovimiento = ref(false)

const { imprimir, imprimiendo } = useTicketPrinter()

async function alCerrarTurno() {
  mostrarCierre.value = false
  await caja.cargar()

  toast.add({
    title: 'Turno cerrado',
    description: 'El corte quedó registrado.',
    color: 'success',
    icon: 'i-lucide-check'
  })
}

async function alRegistrarMovimiento() {
  mostrarMovimiento.value = false
  await caja.cargar()

  toast.add({
    title: 'Movimiento registrado',
    description: 'Ya se refleja en el efectivo esperado.',
    color: 'success',
    icon: 'i-lucide-check'
  })
}

/** Corte X: vista previa imprimible, sin cerrar nada. */
async function imprimirCorteParcial() {
  if (caja.turnoId === null) return

  try {
    await imprimir('corte', caja.turnoId)
  } catch {
    toast.add({
      title: 'No se pudo abrir el corte',
      description: 'Es una vista previa: no hay nada que deshacer.',
      color: 'error',
      icon: 'i-lucide-printer'
    })
  }
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

interface Caja { id: number, name: string }
const cajas = ref<Caja[]>([])
const cajaId = ref<number | null>(null)

onMounted(async () => {
  await caja.cargar()

  // Hoy hay una sola caja; el selector existe porque el modelo ya soporta
  // varias y agregar una segunda no debe requerir tocar esta pantalla.
  try {
    const r = await api.get<{ data: Caja[] }>('/registers')
    cajas.value = r.data
    cajaId.value = r.data[0]?.id ?? null
  } catch {
    cajas.value = []
  }
})

async function abrirCaja() {
  if (cajaId.value === null) {
    error.value = 'No hay una caja configurada.'
    return
  }

  trabajando.value = true
  error.value = null

  try {
    await caja.abrir(cajaId.value, fondo.value, etiqueta.value)

    toast.add({
      title: 'Caja abierta',
      description: `Fondo de ${formatearCentavos(fondo.value)}.`,
      color: 'success',
      icon: 'i-lucide-check'
    })

    await navigateTo('/venta')
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'No se pudo abrir la caja.'
  } finally {
    trabajando.value = false
  }
}

const movimientos = computed(() => {
  const t = caja.turno
  if (t === null) return []

  return [
    ...t.movimientos.entradas.map(m => ({ ...m, entra: true })),
    ...t.movimientos.salidas.map(m => ({ ...m, entra: false }))
  ]
})
</script>

<template>
  <div class="flex justify-center">
    <div class="w-full max-w-lg space-y-4">
      <EsqueletoLista
        v-if="caja.cargando && !caja.consultado"
        :filas="2"
        alto="h-32"
      />

      <!-- Turno abierto: resumen en vivo (corte X) -->
      <template v-else-if="caja.hayTurnoAbierto && caja.turno">
        <PaginaTitulo
          :titulo="`Turno #${caja.turno.turno.folio}`"
          :descripcion="`${caja.turno.turno.etiqueta} · ${caja.turno.turno.cajero}`"
        />

        <UCard>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-beige-600">
                Fondo de caja
              </dt>
              <dd><MontoDinero :valor="caja.turno.dinero_en_caja.fondo" /></dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-beige-600">
                Ventas en efectivo
              </dt>
              <dd><MontoDinero :valor="caja.turno.dinero_en_caja.ventas_en_efectivo" /></dd>
            </div>
            <div class="flex justify-between items-baseline border-t border-beige-200 dark:border-beige-800 pt-2">
              <dt class="font-medium">
                Efectivo esperado
              </dt>
              <dd>
                <MontoDinero
                  :valor="caja.turno.dinero_en_caja.efectivo_esperado"
                  tamano="grande"
                />
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-beige-600">
                Ventas del turno
              </dt>
              <dd class="tabular-nums">
                {{ caja.turno.ventas.cantidad }} ·
                <MontoDinero :valor="caja.turno.ventas.total" />
              </dd>
            </div>
          </dl>

          <template #footer>
            <div class="flex flex-wrap gap-2">
              <UButton
                to="/venta"
                size="lg"
                class="toque flex-1"
                icon="i-lucide-shopping-cart"
              >
                Ir a vender
              </UButton>
              <UButton
                size="lg"
                variant="outline"
                color="neutral"
                class="toque flex-1"
                icon="i-lucide-arrow-left-right"
                @click="mostrarMovimiento = true"
              >
                Efectivo
              </UButton>
              <UButton
                size="lg"
                variant="outline"
                color="neutral"
                class="toque"
                icon="i-lucide-printer"
                :loading="imprimiendo"
                @click="imprimirCorteParcial"
              >
                Corte X
              </UButton>
              <UButton
                size="lg"
                variant="outline"
                color="neutral"
                class="toque"
                icon="i-lucide-lock"
                @click="mostrarCierre = true"
              >
                Cerrar
              </UButton>
            </div>
          </template>
        </UCard>

        <!--
          Movimientos del turno.

          Se muestran aquí y no en otra pantalla porque son parte del
          estado de la caja: quien mira el efectivo esperado necesita ver
          de dónde salió la diferencia con el fondo.
        -->
        <UCard>
          <template #header>
            <div class="flex items-baseline justify-between">
              <h2 class="font-semibold">
                Movimientos del turno
              </h2>
              <span class="text-sm text-beige-600">
                {{ movimientos.length }} en total
              </span>
            </div>
          </template>

          <SinResultados
            v-if="movimientos.length === 0"
            icono="i-lucide-arrow-left-right"
            titulo="Sin entradas ni salidas"
            descripcion="Los retiros a bóveda, las propinas entregadas y las compras de insumos aparecen aquí."
          />

          <div
            v-else
            class="space-y-1"
          >
            <div
              v-for="(m, i) in movimientos"
              :key="`${m.entra ? 'in' : 'out'}-${i}`"
              class="flex items-baseline justify-between gap-3 text-sm py-1"
            >
              <span class="min-w-0">
                <UIcon
                  :name="m.entra ? 'i-lucide-arrow-down-to-line' : 'i-lucide-arrow-up-from-line'"
                  class="size-3"
                  :class="m.entra ? 'text-success-600' : 'text-beige-500'"
                />
                {{ m.concepto }}
                <span class="text-xs text-beige-600">· {{ m.categoria }} · {{ horaDe(m.hora) }}</span>
              </span>

              <MontoDinero
                :valor="m.monto"
                :signo="m.entra ? 'mas' : 'menos'"
                :class="m.entra ? 'text-success-700 dark:text-success-400' : ''"
              />
            </div>
          </div>
        </UCard>
      </template>

      <!-- Sin turno: abrir -->
      <template v-else>
        <PaginaTitulo
          titulo="Abrir caja"
          descripcion="Sin turno abierto no se puede cobrar."
        />

        <UCard>
          <form
            class="space-y-4"
            @submit.prevent="abrirCaja"
          >
            <UFormField
              label="Turno"
              help="Es sólo una etiqueta para el reporte: las ventas pertenecen al turno que esté abierto, no al horario."
            >
              <div class="grid grid-cols-2 gap-2">
                <UButton
                  v-for="t in (['matutino', 'vespertino'] as const)"
                  :key="t"
                  block
                  size="lg"
                  class="toque capitalize"
                  :variant="etiqueta === t ? 'soft' : 'outline'"
                  :color="etiqueta === t ? 'primary' : 'neutral'"
                  @click="etiqueta = t"
                >
                  {{ t }}
                </UButton>
              </div>
            </UFormField>

            <UFormField
              label="Fondo de caja"
              help="Con cuánto efectivo empieza el turno."
            >
              <CampoPesos
                v-model="fondo"
                size="xl"
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
              size="xl"
              class="toque"
              :loading="trabajando"
            >
              Abrir caja
            </UButton>
          </form>
        </UCard>
      </template>
    </div>

    <CierreCajaModal
      v-if="mostrarCierre && caja.turnoId !== null"
      :turno-id="caja.turnoId"
      @cerrado="alCerrarTurno"
      @cancelar="mostrarCierre = false"
    />

    <MovimientoModal
      v-if="mostrarMovimiento && caja.turnoId !== null && caja.turno"
      :turno-id="caja.turnoId"
      :efectivo-en-caja="caja.turno.dinero_en_caja.efectivo_esperado.cents"
      @registrado="alRegistrarMovimiento"
      @cerrar="mostrarMovimiento = false"
    />
  </div>
</template>
