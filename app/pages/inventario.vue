<script setup lang="ts">
import UrgenciaLote from '~/features/inventory/components/UrgenciaLote.vue'
import { useInventory } from '~/features/inventory/composables/useInventory'
import { ApiError } from '~/shared/composables/useApi'
import { formatearCentavos } from '~/shared/utils/dinero'
import type { Lote, MotivoMerma } from '~/shared/types/api'

/*
 * `altoCompleto`: la tabla se queda con el alto sobrante y es lo único
 * que se desplaza. En la tableta del mostrador, con la página moviéndose
 * por fuera y la lista por dentro, el dedo arrastra lo que no era.
 */
definePageMeta({ middleware: 'auth', altoCompleto: true })

const toast = useToast()
const {
  lotes, porCaducar, ventanaHoras, conStock,
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
  unit_cost_cents: 0,
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
      unit_cost_cents: entrada.unit_cost_cents,
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
      unit_cost_cents: 0, lot_code: '', supplier: ''
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
/*
 * «Sacar primero» dejó de ser una lista aparte: es un filtro.
 *
 * Eran dos listas con el mismo aspecto, y un lote por caducar aparecía
 * en las dos — la misma charola dos veces, que se lee como un error del
 * sistema. Es el mismo inventario mirado con distinto alcance, así que
 * va en el mismo sitio y se acota desde arriba.
 */
const alcances = [
  { value: 'todo', label: 'Todo el inventario' },
  { value: '12', label: 'Caducan en 12 h' },
  { value: '24', label: 'Caducan en 24 h' },
  { value: '72', label: 'Caducan en 3 días' }
]

const alcance = ref('24')

const esUrgente = computed(() => alcance.value !== 'todo')

const alcanceFiltro = computed({
  get: () => alcance.value,
  set: (v: string | number) => {
    alcance.value = String(v)

    // «Todo» no recarga: `cargar()` ya trae las dos listas de una vez.
    if (alcance.value !== 'todo') {
      ventanaHoras.value = Number(alcance.value)
      void cargar()
    }
  }
})

const busqueda = ref('')

/**
 * Hay filtro puesto si el texto dice algo o si el alcance no es «todo».
 *
 * El alcance cuenta: abrir en «por caducar 24 h» es cómodo —es la
 * pregunta de la mañana— pero es un recorte, y quien no vea su lote
 * tiene que poder quitarlo de un toque sin adivinar cuál de los
 * controles lo está escondiendo.
 */
const hayBusqueda = computed(() => busqueda.value.trim() !== '')

const filtrada = computed(() => hayBusqueda.value || alcance.value !== 'todo')

function limpiarFiltros(): void {
  busqueda.value = ''
  alcance.value = 'todo'
}

/** Lo que se pinta: el alcance elegido, filtrado por texto en memoria. */
const visibles = computed(() => {
  const base = esUrgente.value ? porCaducar.value : lotes.value
  const texto = busqueda.value.trim().toLowerCase()

  if (!texto) return base

  return base.filter(l =>
    nombreDe(l).toLowerCase().includes(texto)
    || (l.proveedor ?? '').toLowerCase().includes(texto)
    || (l.lote ?? '').toLowerCase().includes(texto)
  )
})

/**
 * Dos cifras, no una, porque piden cosas distintas.
 *
 * «En riesgo» quiere decir *se va a perder si nadie lo vende*. Un lote
 * que caducó hace seis días no está en riesgo: **ya se perdió**, y lo
 * único que queda es darlo de baja. Juntarlos en un solo número hacía
 * que el dinero perdido pareciera dinero que todavía se puede salvar,
 * que es justo la confusión que este módulo existe para evitar.
 *
 * Salen de lo que está en pantalla, no de la consulta: el buscador
 * filtra en memoria y una cifra que no describe su propia lista es peor
 * que no ponerla.
 */
const cifras = computed(() => {
  const suma = (f: (l: Lote) => boolean) =>
    visibles.value.filter(f).reduce((n, l) => n + l.valor_restante.cents, 0)

  const perdido = suma(l => l.caducado)
  const vigente = suma(l => !l.caducado)

  return {
    // Ya no se vende: hay que darlo de baja como merma.
    perdido,
    // Todavía se puede vender; en la ventana elegida, con prisa.
    vigente,
    rotuloVigente: esUrgente.value ? 'Por caducar' : 'En charolas'
  }
})
</script>

<template>
  <div class="space-y-3 md:h-full md:flex md:flex-col md:min-h-0">
    <!--
      `space-y-3` y no 6: son bloques encadenados —esto filtra aquello—
      y tanto hueco los hacía parecer independientes.
    -->
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
          Nueva entrada
        </UButton>
      </template>
    </PaginaTitulo>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <BarraFiltros
      :visibles="visibles.length"
      :total="esUrgente ? porCaducar.length : lotes.length"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Producto, lote o proveedor"
          icon="i-lucide-search"
          size="lg"
          class="w-48 2xl:w-64"
        />
      </template>

      <template #filtros>
        <FiltroSelect
          v-model="alcanceFiltro"
          :opciones="alcances"
          tamano="lg"
          etiqueta="Qué mostrar"
          icono="i-lucide-clock"
          ancho="w-52 2xl:w-56"
        />

        <!--
          Limpiar vive con los filtros. Pierde el rótulo antes de que la
          fila se parta: el icono dice lo mismo en la mitad de sitio y el
          nombre sigue en el `title` y para el lector de pantalla.
        -->
        <UButton
          size="lg"
          variant="ghost"
          color="neutral"
          icon="i-lucide-filter-x"
          title="Quitar los filtros"
          aria-label="Quitar los filtros"
          :disabled="!filtrada"
          @click="limpiarFiltros"
        >
          <span class="hidden 2xl:inline">Limpiar</span>
        </UButton>

        <!--
          La cifra al otro extremo de la fila: a un lado lo que acota la
          lista, al otro lo que esa lista suma. Mide lo mismo que los
          controles —una caja más alta que su fila se lee como algo que
          se coló— y el rótulo evita que una cifra suelta entre controles
          parezca un filtro más.
        -->
        <div class="ms-auto flex items-center gap-2">
          <!--
            Lo caducado va aparte y en rojo: no es una cifra que mirar,
            es trabajo pendiente. Sólo aparece si lo hay.
          -->
          <div
            v-if="cifras.perdido > 0"
            class="tarjeta h-9 px-3 flex items-center gap-2 border-error-200"
          >
            <span class="text-sm text-apagado">Caducado:</span>
            <span class="font-medium tabular-nums whitespace-nowrap text-error-600">
              {{ formatearCentavos(cifras.perdido) }}
            </span>
          </div>

          <div class="tarjeta h-9 px-3 flex items-center gap-2">
            <span class="text-sm text-apagado">{{ cifras.rotuloVigente }}:</span>
            <span class="font-medium tabular-nums whitespace-nowrap text-tinta">
              {{ formatearCentavos(cifras.vigente) }}
            </span>
          </div>
        </div>
      </template>

      <template #resumen>
        <template v-if="esUrgente">
          En orden de urgencia: lo de arriba se vende antes.
        </template>
      </template>
    </BarraFiltros>

    <EsqueletoLista
      v-if="cargando"
      :filas="5"
    />

    <SinResultados
      v-else-if="visibles.length === 0"
      :icono="hayBusqueda
        ? 'i-lucide-search-x'
        : (esUrgente ? 'i-lucide-shield-check' : 'i-lucide-package')"
      :titulo="hayBusqueda
        ? 'Ningún lote coincide'
        : (esUrgente
          ? `Nada por caducar en las próximas ${ventanaHoras} horas`
          : 'No hay lotes cargados')"
      :descripcion="hayBusqueda
        ? 'Prueba con otro texto, o mira todo el inventario.'
        : (esUrgente
          ? 'Nada en riesgo en esta ventana.'
          : 'El inventario se lleva por lotes: cada entrada de mercancía es uno.')"
    >
      <template #accion>
        <UButton
          v-if="hayBusqueda || esUrgente"
          variant="outline"
          color="neutral"
          icon="i-lucide-filter-x"
          @click="limpiarFiltros"
        >
          Quitar filtros
        </UButton>
        <UButton
          v-else
          icon="i-lucide-plus"
          @click="mostrarEntrada = true"
        >
          Registrar entrada
        </UButton>
      </template>
    </SinResultados>

    <div
      v-else
      class="tarjeta overflow-hidden md:flex-1 md:min-h-0"
    >
      <div class="overflow-auto max-h-[60vh] md:max-h-none md:h-full">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10">
            <tr class="text-center [&>th]:border-r [&>th]:border-borde [&>th:last-child]:border-r-0">
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Producto
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde hidden lg:table-cell">
                Lote
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Piezas
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Caduca
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Valor
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="l in visibles"
              :key="l.id"
              class="border-b border-borde-suave last:border-0 transition
                     [&>td]:border-r [&>td]:border-borde-suave [&>td:last-child]:border-r-0"
              :class="l.caducado ? 'bg-error-50/40 dark:bg-error-950/30' : ''"
            >
              <td class="px-3 lg:px-4 py-4 text-center w-2/5 max-w-0 truncate font-medium">
                {{ nombreDe(l) }}
              </td>

              <td class="px-3 lg:px-4 py-4 text-center w-1/5 max-w-0 truncate text-apagado hidden lg:table-cell">
                {{ l.lote ?? l.proveedor ?? '—' }}
              </td>

              <!--
                «6 de 8» y no sólo «6»: dice cuánto se ha ido de la charola,
                que es lo que distingue un lote que no se está vendiendo de
                uno que acaba de entrar.
              -->
              <td class="px-3 lg:px-4 py-4 text-center tabular-nums whitespace-nowrap">
                {{ l.restantes }}
                <span class="text-apagado-2 text-xs">de {{ l.recibidas }}</span>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center whitespace-nowrap">
                <UrgenciaLote
                  :horas="l.horas_para_caducar"
                  :caducado="l.caducado"
                />
              </td>

              <td class="px-3 lg:px-4 py-4 text-center tabular-nums font-medium whitespace-nowrap">
                {{ l.valor_restante.formatted }}
              </td>

              <td class="px-3 lg:px-4 py-4 text-center whitespace-nowrap">
                <UButton
                  size="sm"
                  variant="outline"
                  color="neutral"
                  @click="abrirMerma(l)"
                >
                  Merma
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

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
              <CampoPesos
                v-model="entrada.unit_cost_cents"
                class="w-full"
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
            class="text-sm text-apagado text-right"
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

          <p class="text-right text-sm text-apagado tabular-nums">
            Valor del lote:
            {{ formatearCentavos(entrada.unit_cost_cents * entrada.quantity) }}
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
          <div class="rounded-lg bg-hundido p-3">
            <p class="font-medium">
              {{ nombreDe(loteAMermar) }}
            </p>
            <p class="text-sm text-apagado">
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
