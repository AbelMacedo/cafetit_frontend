<script setup lang="ts">
import { useInventoryReport } from '~/features/reports/composables/useInventoryReport'

/**
 * Inventario y mermas, dentro de la pantalla de reportes.
 *
 * Responde la pregunta que justifica todo el módulo de caducidades:
 * **cuánto dinero se tiró este mes y por qué**. Sin ella, llevar el
 * inventario por lotes es trabajo de captura sin devolución.
 *
 * Va plegado y se carga al abrirse. La pantalla de reportes se abre cien
 * veces al día para ver cuánto se vendió; traer también el inventario
 * cada vez sería cobrarle a todos una consulta que casi nadie mira.
 *
 * **Las existencias son de hoy; las mermas, del periodo.** El valor en
 * charolas no se puede reconstruir hacia atrás —no hay histórico de
 * conteos— así que la fotografía es siempre del momento, y aquí se rotula
 * con su propia hora para que nadie la lea como el valor de aquel mes.
 */
const props = defineProps<{
  desde: string
  hasta: string
}>()

const desde = toRef(props, 'desde')
const hasta = toRef(props, 'hasta')

const {
  reporte, cargando, error, cargar, abrirPdf, descargarPdf
} = useInventoryReport(desde, hasta)

/*
 * Se carga al montarse porque ya no es un plegable: es la pestaña que
 * alguien acaba de elegir. Pedir un clic más para ver lo que ya pediste
 * es cobrarle dos veces por la misma decisión.
 *
 * La carga perezosa sigue teniendo sentido a nivel de pestaña: quien se
 * queda en Ventas no paga esta consulta nunca.
 */
onMounted(cargar)

watch([desde, hasta], () => cargar(true))

/** Lo que come la gráfica de mermas: un día por barra. */
const mermaPorDia = computed(() =>
  (reporte.value?.mermas.por_dia ?? []).map(l => ({
    etiqueta: diaCorto(l.fecha),
    valor: l.costo.cents,
    texto: l.costo.formatted
  }))
)

function diaCorto(fecha: string): string {
  // A mano y no con `new Date(fecha)`: una cadena 'YYYY-MM-DD' la lee el
  // navegador como medianoche UTC y en México saldría el día anterior.
  const [y, m, dia] = fecha.split('-').map(Number)

  return new Date(y!, m! - 1, dia!).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

/** La barra más alta marca el 100%: comparar contra el total daría barras de dos píxeles. */
const maximoMotivo = computed(() =>
  Math.max(1, ...(reporte.value?.mermas.por_motivo ?? []).map(m => m.costo.cents))
)

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
}

function cuando(iso: string | null): string {
  if (!iso) return '—'

  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <EsqueletoLista
      v-else-if="cargando"
      :filas="4"
    />

    <template v-else-if="reporte">
      <div class="flex flex-wrap items-center justify-end gap-2">
        <!--
            Del mismo tamaño que los de arriba: son la misma acción en
            otra sección, y en `sm` parecían un control de segunda.
          -->
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-eye"
          class="toque"
          @click="abrirPdf"
        >
          Ver PDF
        </UButton>

        <UButton
          icon="i-lucide-download"
          class="toque"
          @click="descargarPdf"
        >
          Descargar PDF
        </UButton>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="tarjeta p-4">
          <p class="text-xs uppercase tracking-wide text-apagado">
            En charolas hoy
          </p>
          <p class="text-2xl font-bold text-tinta mt-1">
            {{ reporte.existencias.valor.formatted }}
          </p>
          <p class="text-xs text-apagado mt-1">
            {{ reporte.existencias.piezas }} pz en
            {{ reporte.existencias.lotes }} {{ reporte.existencias.lotes === 1 ? 'lote' : 'lotes' }}
          </p>
        </div>

        <div class="tarjeta p-4">
          <p class="text-xs uppercase tracking-wide text-apagado">
            Tirado en el periodo
          </p>
          <p class="text-2xl font-bold text-tinta mt-1">
            {{ reporte.mermas.costo.formatted }}
          </p>
          <p class="text-xs text-apagado mt-1">
            {{ reporte.mermas.piezas }} pz
          </p>
        </div>

        <!--
            La distinción que hace accionable el número: una cortesía es
            una decisión comercial, que algo caduque es una falla.
          -->
        <div class="tarjeta p-4">
          <p class="text-xs uppercase tracking-wide text-apagado">
            De eso, evitable
          </p>
          <p class="text-2xl font-bold text-tinta mt-1">
            {{ reporte.mermas.costo_evitable.formatted }}
          </p>
          <p class="text-xs text-apagado mt-1">
            Caducado, dañado o mal preparado
          </p>
        </div>

        <div class="tarjeta p-4">
          <p class="text-xs uppercase tracking-wide text-apagado">
            Merma sobre compras
          </p>
          <!--
            Sin compras en el periodo, una raya.

            El cálculo devuelve 0.0 para no dividir entre cero, y eso
            pintaba «0%» al lado de $28.00 tirados: se lee como «no se
            tiró casi nada», que es lo contrario de lo que pasó.
          -->
          <p class="text-2xl font-bold text-tinta mt-1">
            <template v-if="reporte.mermas.porcentaje_comparable">
              {{ reporte.mermas.porcentaje_sobre_entradas }}%
            </template>
            <template v-else>
              —
            </template>
          </p>

          <!--
              Puede pasar del 100% cuando se tira mercancía que entró
              antes del periodo. Se explica en vez de recortarlo: un
              «160%» sin aclarar se lee como un fallo del sistema, y
              entonces deja de mirarse también cuando dice 8%.
            -->
          <p class="text-xs text-apagado mt-1">
            <template v-if="!reporte.mermas.porcentaje_comparable">
              No entró mercancía en estas fechas: no hay con qué comparar.
            </template>
            <template v-else-if="reporte.mermas.tirado_de_antes">
              Parte entró antes del periodo. Se compró
              {{ reporte.entradas.costo.formatted }} en estas fechas.
            </template>
            <template v-else>
              Se compró {{ reporte.entradas.costo.formatted }}
            </template>
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UCard v-if="reporte.mermas.por_motivo.length > 0">
          <template #header>
            <h3 class="font-medium text-tinta">
              Por qué se tiró
            </h3>
          </template>

          <div class="space-y-3">
            <div
              v-for="m in reporte.mermas.por_motivo"
              :key="m.motivo"
            >
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <span class="min-w-0 truncate">
                  {{ m.etiqueta }}
                  <span
                    v-if="!m.evitable"
                    class="text-xs text-apagado"
                  >· no evitable</span>
                </span>
                <span class="tabular-nums shrink-0">{{ m.costo.formatted }}</span>
              </div>

              <div class="h-1.5 rounded-full bg-lienzo mt-1 overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :class="m.evitable ? 'bg-naranja-400' : 'bg-cafe-300'"
                  :style="{ width: `${Math.round(m.costo.cents * 100 / maximoMotivo)}%` }"
                />
              </div>
            </div>
          </div>
        </UCard>

        <UCard v-if="mermaPorDia.length > 0">
          <template #header>
            <h3 class="font-medium text-tinta">
              Día por día
            </h3>
          </template>

          <!--
              Lo que se busca aquí no es cuánto se tiró en total —eso ya
              está arriba— sino SI SE REPITE. Una merma grande un lunes
              es un accidente; la misma cada lunes es un pedido mal
              calculado, y eso sólo se ve en una línea de tiempo.
            -->
          <GraficaBarras
            :datos="mermaPorDia"
            titulo="Costo de las mermas por día"
          />
        </UCard>

        <UCard v-if="reporte.mermas.por_producto.length > 0">
          <template #header>
            <h3 class="font-medium text-tinta">
              Qué se tiró
            </h3>
          </template>

          <div class="space-y-2">
            <div
              v-for="p in reporte.mermas.por_producto"
              :key="`${p.nombre}-${p.variante ?? ''}`"
              class="flex items-baseline gap-3 text-sm"
            >
              <span class="min-w-0 flex-1 truncate">
                {{ p.nombre }}
                <span
                  v-if="p.variante"
                  class="text-xs text-apagado"
                >· {{ p.variante }}</span>
              </span>
              <span class="w-14 text-right tabular-nums text-apagado">{{ p.piezas }} pz</span>
              <span class="w-20 text-right tabular-nums">{{ p.costo.formatted }}</span>
            </div>
          </div>
        </UCard>
      </div>

      <UCard v-if="reporte.existencias.en_riesgo.length > 0">
        <template #header>
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="font-medium text-tinta">
              Por perderse
            </h3>
            <span class="text-sm text-naranja-700 font-medium">
              {{ reporte.existencias.valor_en_riesgo.formatted }}
            </span>
          </div>
        </template>

        <div class="space-y-2">
          <div
            v-for="(l, i) in reporte.existencias.en_riesgo"
            :key="i"
            class="flex items-baseline gap-3 text-sm"
          >
            <span class="min-w-0 flex-1 truncate">
              {{ l.nombre }}
              <span
                v-if="l.variante"
                class="text-xs text-apagado"
              >· {{ l.variante }}</span>
            </span>

            <UBadge
              v-if="l.vencido"
              color="error"
              variant="subtle"
              size="sm"
            >
              Vencido
            </UBadge>
            <span
              v-else
              class="text-xs text-apagado shrink-0"
            >{{ cuando(l.caduca) }}</span>

            <span class="w-14 text-right tabular-nums text-apagado">{{ l.piezas }} pz</span>
            <span class="w-20 text-right tabular-nums">{{ l.valor.formatted }}</span>
          </div>
        </div>
      </UCard>

      <UCard v-if="reporte.existencias.por_producto.length > 0">
        <template #header>
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="font-medium text-tinta">
              Qué hay, por producto
            </h3>

            <!-- La hora va aquí: esto NO es del periodo del reporte. -->
            <span class="text-xs text-apagado">
              Al {{ fechaHora(reporte.existencias.al_momento) }}
            </span>
          </div>
        </template>

        <div class="space-y-2">
          <div
            v-for="l in reporte.existencias.por_producto"
            :key="`${l.nombre}-${l.variante ?? ''}`"
            class="flex items-baseline gap-3 text-sm"
          >
            <span class="min-w-0 flex-1 truncate">
              {{ l.nombre }}
              <span
                v-if="l.variante"
                class="text-xs text-apagado"
              >· {{ l.variante }}</span>
            </span>
            <span class="w-14 text-right tabular-nums text-apagado">{{ l.piezas }} pz</span>
            <span class="w-20 text-right tabular-nums">{{ l.valor.formatted }}</span>
          </div>
        </div>

        <!--
            Sin esta línea, ver la misma Concha aquí y en «Por perderse»
            se lee como el mismo renglón contado dos veces. No lo es: uno
            agrupa por producto y el otro va lote por lote con su fecha.
          -->
        <p class="text-xs text-apagado mt-3">
          Incluye lo que está por perderse. Arriba va lote por lote; aquí,
          sumado por producto.
        </p>
      </UCard>

      <SinResultados
        v-if="reporte.vacio"
        icono="i-lucide-package-open"
        titulo="Sin existencias ni mermas"
        descripcion="Carga mercancía desde Inventario para empezar a llevar la cuenta."
      />
    </template>
  </div>
</template>
