<script setup lang="ts">
import { type Atajo, useSalesReport } from '~/features/reports/composables/useSalesReport'

definePageMeta({ middleware: 'auth' })

const {
  desde, hasta, reporte, cargando, error, cargar, aplicar, abrirPdf, descargarPdf
} = useSalesReport()

onMounted(cargar)

const periodos = [
  { value: 'mes', label: 'Este mes' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'ayer', label: 'Ayer' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes_pasado', label: 'Mes pasado' },
  { value: 'personalizado', label: 'Personalizado' }
]

/**
 * Periodo.
 *
 * «Personalizado» existe para que el selector no mienta: en cuanto
 * alguien toca las fechas a mano, el periodo deja de ser «este mes» y el
 * control tiene que decirlo. Elegirlo no cambia nada — las fechas ya
 * están puestas— así que sólo vuelve a cargar.
 */
const periodo = ref<Atajo | 'personalizado'>('mes')

const periodoFiltro = computed({
  get: () => periodo.value as string,
  set: (v: string | number) => {
    const elegido = String(v) as Atajo | 'personalizado'
    periodo.value = elegido

    if (elegido !== 'personalizado') aplicar(elegido)

    void cargar()
  }
})

/** Tocar una fecha a mano rompe el atajo: el selector deja de mentir. */
async function alCambiarFecha() {
  periodo.value = 'personalizado'
  await cargar()
}

/**
 * La barra del día más fuerte marca el 100%. Comparar contra el total del
 * periodo daría barras de dos píxeles en un reporte de un mes.
 */
const maximoDiario = computed(() =>
  Math.max(1, ...(reporte.value?.por_dia ?? []).map(d => d.total.cents))
)

function diaCorto(fecha: string): string {
  // Se parte a mano en lugar de `new Date(fecha)`: una cadena 'YYYY-MM-DD'
  // la interpreta el navegador como medianoche UTC y en México se vería
  // el día anterior.
  const [y, m, d] = fecha.split('-').map(Number)

  return new Date(y!, m! - 1, d!).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="space-y-6">
    <PaginaTitulo
      titulo="Reportes"
      descripcion="Cómo fue el periodo. El corte de caja responde otra pregunta: si cuadra el turno de alguien."
    >
      <template #acciones>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-eye"
          :disabled="cargando"
          @click="abrirPdf"
        >
          Ver PDF
        </UButton>

        <UButton
          icon="i-lucide-download"
          class="toque"
          :disabled="cargando"
          @click="descargarPdf"
        >
          Descargar PDF
        </UButton>
      </template>
    </PaginaTitulo>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <!-- Periodo -->
    <div class="tarjeta p-4">
      <div class="flex flex-wrap items-end gap-3">
        <UFormField
          label="Periodo"
          size="sm"
        >
          <FiltroSelect
            v-model="periodoFiltro"
            :opciones="periodos"
            etiqueta="Periodo del reporte"
            icono="i-lucide-calendar-range"
            ancho="w-44"
          />
        </UFormField>

        <UFormField
          label="Desde"
          size="sm"
        >
          <UInput
            v-model="desde"
            type="date"
            @change="alCambiarFecha"
          />
        </UFormField>

        <UFormField
          label="Hasta"
          size="sm"
        >
          <UInput
            v-model="hasta"
            type="date"
            @change="alCambiarFecha"
          />
        </UFormField>
      </div>
    </div>

    <EsqueletoLista
      v-if="cargando"
      :filas="3"
      alto="h-24"
    />

    <template v-else-if="reporte">
      <SinResultados
        v-if="reporte.vacio"
        icono="i-lucide-chart-column"
        titulo="No hubo movimiento en este periodo"
        descripcion="Prueba con otro rango, o revisa que las fechas sean las que querías."
      />

      <template v-else>
        <!--
            Ceros con cancelaciones necesitan explicación: si no, parece
            que el reporte falló.
          -->
        <UAlert
          v-if="reporte.resumen.cantidad === 0"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          title="No hubo ventas cobradas en este periodo."
          description="Lo único que se registró fueron cancelaciones, que aparecen al final."
        />

        <!-- Indicadores -->
        <div
          class="grid gap-3"
          style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))"
        >
          <div
            v-for="k in [
              { etiqueta: 'Vendido', valor: reporte.resumen.total.formatted },
              { etiqueta: 'Ventas', valor: String(reporte.resumen.cantidad) },
              { etiqueta: 'Ticket promedio', valor: reporte.resumen.ticket_promedio.formatted },
              { etiqueta: 'Promedio diario', valor: reporte.resumen.promedio_diario.formatted }
            ]"
            :key="k.etiqueta"
            class="rounded-lg border border-beige-200 dark:border-beige-800 bg-white dark:bg-beige-900 p-4"
          >
            <p class="text-xs uppercase tracking-wide text-beige-600">
              {{ k.etiqueta }}
            </p>
            <p class="text-2xl font-semibold tabular-nums text-cafe-800 dark:text-beige-100 mt-1">
              {{ k.valor }}
            </p>
          </div>
        </div>

        <!-- Resumen del dinero -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Resumen
            </h2>
          </template>

          <dl class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-beige-600">
                Subtotal antes de descuentos
              </dt>
              <dd class="tabular-nums">
                {{ reporte.resumen.subtotal.formatted }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-beige-600">
                Descuentos otorgados
              </dt>
              <dd class="tabular-nums">
                − {{ reporte.resumen.descuentos.formatted }}
              </dd>
            </div>
            <div
              v-if="reporte.resumen.impuesto.cents > 0"
              class="flex justify-between"
            >
              <dt class="text-beige-600">
                IVA contenido
              </dt>
              <dd class="tabular-nums">
                {{ reporte.resumen.impuesto.formatted }}
              </dd>
            </div>
            <div class="flex justify-between border-t border-beige-200 dark:border-beige-800 pt-2">
              <dt class="font-medium">
                Total cobrado
              </dt>
              <dd class="text-xl font-semibold tabular-nums text-cafe-800 dark:text-beige-100">
                {{ reporte.resumen.total.formatted }}
              </dd>
            </div>
          </dl>
        </UCard>

        <!--
            Las secciones sin renglones se ocultan.

            Un día con una sola venta cancelada tiene cero ventas cobradas
            pero no está «vacío»: mostrar cuatro tarjetas huecas con sus
            encabezados haría pensar que algo no cargó.
          -->
        <UCard v-if="reporte.por_dia.length > 0">
          <template #header>
            <div class="flex items-baseline justify-between">
              <h2 class="font-semibold">
                Día por día
              </h2>
              <span class="text-sm text-beige-600">
                {{ reporte.periodo.dias_con_ventas }}
                {{ reporte.periodo.dias_con_ventas === 1 ? 'día con ventas' : 'días con ventas' }}
              </span>
            </div>
          </template>

          <div class="space-y-1">
            <div
              v-for="d in reporte.por_dia"
              :key="d.fecha"
              class="flex items-center gap-3 text-sm"
            >
              <span class="w-28 shrink-0 text-beige-600">{{ diaCorto(d.fecha) }}</span>

              <span class="flex-1 h-4 rounded bg-beige-100 dark:bg-beige-800 overflow-hidden">
                <span
                  class="block h-full rounded bg-primary-500"
                  :style="{ width: `${Math.round((d.total.cents / maximoDiario) * 100)}%` }"
                />
              </span>

              <span class="w-10 text-right tabular-nums text-beige-600">{{ d.cantidad }}</span>
              <span class="w-24 text-right tabular-nums font-medium">{{ d.total.formatted }}</span>
            </div>
          </div>
        </UCard>

        <div
          v-if="reporte.por_metodo.length > 0"
          class="grid gap-4 md:grid-cols-2"
        >
          <!-- Formas de pago -->
          <UCard>
            <template #header>
              <h2 class="font-semibold">
                Formas de pago
              </h2>
            </template>

            <div class="space-y-2 text-sm">
              <div
                v-for="m in reporte.por_metodo"
                :key="m.metodo"
                class="flex items-baseline justify-between"
              >
                <span>
                  {{ m.etiqueta }}
                  <span class="text-xs text-beige-600">
                    · {{ m.cantidad }} {{ m.cantidad === 1 ? 'pago' : 'pagos' }}
                  </span>
                </span>
                <span class="tabular-nums font-medium">{{ m.total.formatted }}</span>
              </div>
            </div>

            <p class="text-xs text-beige-600 mt-3">
              Una venta mixta aparece en dos renglones: se suman los pagos, no las ventas.
            </p>
          </UCard>

          <!-- Cajeros -->
          <UCard>
            <template #header>
              <h2 class="font-semibold">
                Por cajero
              </h2>
            </template>

            <div class="space-y-2 text-sm">
              <div
                v-for="c in reporte.por_cajero"
                :key="c.cajero"
                class="flex items-baseline justify-between"
              >
                <span>
                  {{ c.cajero }}
                  <span class="text-xs text-beige-600">· {{ c.cantidad }}</span>
                </span>
                <span class="tabular-nums font-medium">{{ c.total.formatted }}</span>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Más vendidos -->
        <UCard v-if="reporte.mas_vendidos.length > 0">
          <template #header>
            <h2 class="font-semibold">
              Más vendidos
            </h2>
          </template>

          <div class="space-y-1">
            <div
              v-for="(p, i) in reporte.mas_vendidos"
              :key="`${p.nombre}-${p.variante ?? ''}`"
              class="flex items-baseline gap-3 text-sm py-1"
            >
              <span class="w-5 shrink-0 text-right tabular-nums text-beige-500">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1">
                {{ p.nombre }}
                <span
                  v-if="p.variante"
                  class="text-xs text-beige-600"
                >· {{ p.variante }}</span>
              </span>
              <span class="w-16 text-right tabular-nums text-beige-600">{{ p.cantidad }} pz</span>
              <span class="w-24 text-right tabular-nums font-medium">{{ p.total.formatted }}</span>
            </div>
          </div>
        </UCard>

        <!-- Canceladas -->
        <UCard v-if="reporte.canceladas.cantidad > 0">
          <template #header>
            <div class="flex items-baseline justify-between">
              <h2 class="font-semibold">
                Canceladas
              </h2>
              <span class="text-sm tabular-nums text-beige-600">
                {{ reporte.canceladas.cantidad }} · {{ reporte.canceladas.total.formatted }}
              </span>
            </div>
          </template>

          <div class="space-y-1">
            <div
              v-for="c in reporte.canceladas.detalle"
              :key="c.folio"
              class="flex items-baseline gap-3 text-sm py-1"
            >
              <span class="w-14 shrink-0 tabular-nums font-medium">#{{ c.folio }}</span>
              <span class="w-32 shrink-0 tabular-nums text-beige-600">{{ fechaHora(c.fecha) }}</span>
              <span class="min-w-0 flex-1">
                {{ c.motivo ?? 'Sin motivo' }}
                <span class="text-xs text-beige-600">· {{ c.cajero }}</span>
              </span>
              <span class="w-24 text-right tabular-nums">{{ c.total.formatted }}</span>
            </div>
          </div>

          <p class="text-xs text-beige-600 mt-3">
            Las canceladas no cuentan en ninguna de las cifras de arriba.
          </p>
        </UCard>

        <p class="text-xs text-beige-600 text-center pt-2">
          Generado el {{ fechaHora(reporte.generado_en) }} · hora de {{ reporte.periodo.zona }}
        </p>
      </template>
    </template>
  </div>
</template>
