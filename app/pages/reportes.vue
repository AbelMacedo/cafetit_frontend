<script setup lang="ts">
import InventarioYMermas from '~/features/reports/components/InventarioYMermas.vue'
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

  /*
   * «Escoger fechas» es lo que DESBLOQUEA el rango.
   *
   * Antes no hacía nada al tocarla: los campos de fecha estaban
   * siempre abiertos, así que elegirla sólo recargaba lo mismo. Y si
   * se pueden tocar siempre, decir «este mes» era una etiqueta que
   * mentía en cuanto alguien movía un día.
   *
   * Ahora manda: con un atajo puesto, las fechas enseñan el rango
   * pero no se editan; aquí se abren.
   */
  { value: 'personalizado', label: 'Escoger fechas' }
]

/**
 * Periodo.
 *
 * «Personalizado» existe para que el selector no mienta: en cuanto
 * alguien toca las fechas a mano, el periodo deja de ser «este mes» y el
 * control tiene que decirlo. Elegirlo no cambia nada — las fechas ya
 * están puestas— así que sólo vuelve a cargar.
 */
/*
 * Dos reportes, no uno con un apartado colgando.
 *
 * Ventas y mermas responden preguntas distintas —cuánto entró y cuánto
 * se perdió— y se miran en momentos distintos. Apilados en la misma
 * vista, con el segundo plegado al fondo, el de mermas no existía para
 * quien no bajara hasta abajo. Como pestañas, los dos pesan lo mismo y
 * el periodo de arriba manda sobre ambos.
 */
type Vista = 'ventas' | 'mermas'

const vista = ref<Vista>('ventas')

const pestanas: Array<{ valor: Vista, etiqueta: string, icono: string }> = [
  { valor: 'ventas', etiqueta: 'Ventas', icono: 'i-lucide-receipt' },
  { valor: 'mermas', etiqueta: 'Inventario y mermas', icono: 'i-lucide-package' }
]

const periodo = ref<Atajo | 'personalizado'>('mes')

/** Con un atajo puesto el rango se enseña, no se edita. */
const fechasBloqueadas = computed(() => periodo.value !== 'personalizado')

const periodoFiltro = computed({
  get: () => periodo.value as string,
  set: (v: string | number) => {
    const elegido = String(v) as Atajo | 'personalizado'
    periodo.value = elegido

    /*
     * «Escoger fechas» no recarga: sólo abre los campos.
     *
     * El rango sigue donde estaba —sirve de punto de partida— y
     * recargar algo que no ha cambiado haría parpadear el reporte
     * entero para nada.
     */
    if (elegido === 'personalizado') return

    aplicar(elegido)
    void cargar()
  }
})

async function alCambiarFecha() {
  await cargar()
}

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

/** Lo que come la gráfica: día en el eje, importe encima de la barra. */
const ventasPorDia = computed(() =>
  (reporte.value?.por_dia ?? []).map(d => ({
    etiqueta: diaCorto(d.fecha),
    valor: d.total.cents,
    texto: d.total.formatted
  }))
)

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="space-y-3">
    <!--
      `space-y-3` y no 6: son bloques encadenados —el periodo manda sobre
      todo lo de abajo— y tanto hueco los hacía parecer independientes.
    -->
    <PaginaTitulo
      titulo="Reportes"
      descripcion="Cómo fue el periodo. El corte de caja responde otra pregunta: si cuadra el turno de alguien."
    />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <!--
      El periodo va suelto sobre el fondo, como la barra de filtros de
      Ventas e Inventario: es lo mismo —lo que acota lo de abajo— y en
      tarjeta propia parecía un apartado aparte.

      Los rótulos se quedan, a diferencia de las otras pantallas: ahí dos
      fechas con una «a» en medio se leen solas, pero aquí el atajo de
      periodo y el rango son dos controles distintos que se pisan si no
      se nombran.
    -->
    <div class="flex flex-wrap items-end gap-2">
      <UFormField label="Periodo">
        <FiltroSelect
          v-model="periodoFiltro"
          :opciones="periodos"
          tamano="lg"
          etiqueta="Periodo del reporte"
          icono="i-lucide-calendar-range"
          ancho="w-48"
        />
      </UFormField>

      <UFormField label="Desde">
        <UInput
          v-model="desde"
          type="date"
          size="lg"
          :disabled="fechasBloqueadas"
          @change="alCambiarFecha"
        />
      </UFormField>

      <UFormField label="Hasta">
        <UInput
          v-model="hasta"
          type="date"
          size="lg"
          :disabled="fechasBloqueadas"
          @change="alCambiarFecha"
        />
      </UFormField>
    </div>

    <!--
      Las pestañas van DEBAJO del periodo, no encima.

      El periodo manda sobre las dos: cambiarlo recalcula la que estés
      viendo. Ponerlas arriba sugeriría lo contrario —dos pantallas
      separadas, cada una con su rango— y al cambiar de pestaña se
      esperaría perder el filtro.
    -->
    <div
      class="flex gap-1 border-b border-borde"
      role="tablist"
    >
      <button
        v-for="p in pestanas"
        :key="p.valor"
        type="button"
        role="tab"
        :aria-selected="vista === p.valor"
        class="toque px-4 py-2 -mb-px border-b-2 flex items-center gap-2 text-sm font-medium transition
               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-naranja-500"
        :class="vista === p.valor
          ? 'border-naranja-500 text-tinta'
          : 'border-transparent text-apagado hover:text-tinta hover:border-borde-marcado'"
        @click="vista = p.valor"
      >
        <UIcon
          :name="p.icono"
          class="size-4 shrink-0"
        />
        {{ p.etiqueta }}
      </button>
    </div>

    <template v-if="vista === 'ventas'">
      <!--
        Los botones de PDF, dentro de la vista a la que pertenecen.

        En el encabezado descargaban siempre el de ventas, estuvieras
        mirando lo que estuvieras mirando. Un botón que hace algo distinto
        de lo que tienes delante es una trampa, y en un documento que se
        le manda al contador, una cara.
      -->
      <div class="flex flex-wrap items-center justify-end gap-2">
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-eye"
          class="toque"
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
              class="rounded-lg border border-borde bg-superficie p-4"
            >
              <p class="text-xs uppercase tracking-wide text-apagado">
                {{ k.etiqueta }}
              </p>
              <p class="text-2xl font-semibold tabular-nums text-tinta mt-1">
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

            <!--
            El resumen tiene que CUADRAR leyéndolo de arriba abajo.

            Enseñaba «subtotal menos descuentos» y debajo un total que no
            era esa resta: faltaban las rebajas de renglón y el redondeo.
            Unas cifras que no suman hacen desconfiar también de las que
            sí estaban bien.
          -->
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-apagado">
                  Precio de lista
                </dt>
                <dd class="tabular-nums">
                  {{ reporte.resumen.subtotal_lista.formatted }}
                </dd>
              </div>

              <div
                v-if="reporte.resumen.descuentos_linea.cents > 0"
                class="flex justify-between"
              >
                <dt class="text-apagado">
                  Descuentos por renglón
                </dt>
                <dd class="tabular-nums">
                  − {{ reporte.resumen.descuentos_linea.formatted }}
                </dd>
              </div>

              <div
                v-if="reporte.resumen.descuentos.cents > 0"
                class="flex justify-between"
              >
                <dt class="text-apagado">
                  Descuentos a la venta
                </dt>
                <dd class="tabular-nums">
                  − {{ reporte.resumen.descuentos.formatted }}
                </dd>
              </div>

              <div
                v-if="reporte.resumen.redondeo.cents !== 0"
                class="flex justify-between"
              >
                <dt class="text-apagado">
                  Redondeo al peso
                </dt>
                <dd class="tabular-nums">
                  {{ reporte.resumen.redondeo.cents < 0 ? '−' : '+' }}
                  {{ reporte.resumen.redondeo.formatted.replace('-', '') }}
                </dd>
              </div>

              <div
                v-if="reporte.resumen.impuesto_aplica"
                class="flex justify-between"
              >
                <dt class="text-apagado">
                  IVA contenido
                </dt>
                <dd class="tabular-nums">
                  {{ reporte.resumen.impuesto.formatted }}
                </dd>
              </div>

              <div class="flex justify-between border-t border-borde pt-2">
                <dt class="font-medium">
                  Total cobrado
                </dt>
                <dd class="text-xl font-semibold tabular-nums text-tinta">
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
                <span class="text-sm text-apagado">
                  {{ reporte.periodo.dias_con_ventas }}
                  {{ reporte.periodo.dias_con_ventas === 1 ? 'día con ventas' : 'días con ventas' }}
                </span>
              </div>
            </template>

            <!--
            Barras verticales y no una lista de barras horizontales: lo
            que se busca aquí es la FORMA del periodo —qué días levantan,
            cuáles se caen— y eso se ve de un vistazo en una línea de
            tiempo, no recorriendo renglones de arriba abajo.
          -->
            <GraficaBarras
              :datos="ventasPorDia"
              titulo="Ventas por día del periodo"
            />
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
                    <span class="text-xs text-apagado">
                      · {{ m.cantidad }} {{ m.cantidad === 1 ? 'pago' : 'pagos' }}
                    </span>
                  </span>
                  <span class="tabular-nums font-medium">{{ m.total.formatted }}</span>
                </div>
              </div>

              <p class="text-xs text-apagado mt-3">
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
                    <span class="text-xs text-apagado">· {{ c.cantidad }}</span>
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
                <span class="w-5 shrink-0 text-right tabular-nums text-apagado-2">{{ i + 1 }}</span>
                <span class="min-w-0 flex-1">
                  {{ p.nombre }}
                  <span
                    v-if="p.variante"
                    class="text-xs text-apagado"
                  >· {{ p.variante }}</span>
                </span>
                <span class="w-16 text-right tabular-nums text-apagado">{{ p.cantidad }} pz</span>
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
                <span class="text-sm tabular-nums text-apagado">
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
                <span class="w-32 shrink-0 tabular-nums text-apagado">{{ fechaHora(c.fecha) }}</span>
                <span class="min-w-0 flex-1">
                  {{ c.motivo ?? 'Sin motivo' }}
                  <span class="text-xs text-apagado">· {{ c.cajero }}</span>
                </span>
                <span class="w-24 text-right tabular-nums">{{ c.total.formatted }}</span>
              </div>
            </div>

            <p class="text-xs text-apagado mt-3">
              Las canceladas no cuentan en ninguna de las cifras de arriba.
            </p>
          </UCard>

          <p class="text-xs text-apagado text-center pt-2">
            Generado el {{ fechaHora(reporte.generado_en) }} · hora de {{ reporte.periodo.zona }}
          </p>
        </template>
      </template>
    </template>

    <InventarioYMermas
      v-else
      :desde="desde"
      :hasta="hasta"
    />
  </div>
</template>
