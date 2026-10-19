<script setup lang="ts">
import { useCatalog } from '~/features/catalog/composables/useCatalog'
import type { DatosRecompensa } from '~/features/loyalty/composables/useLoyalty'
import type { Recompensa } from '~/shared/types/api'

/**
 * Alta y edición de una recompensa.
 *
 * El premio puede ser **un artículo del catálogo o texto libre**. Cuando
 * es del catálogo, canjearlo baja inventario como cualquier venta
 * —porque el pan sale igual— y el reporte sigue sabiendo lo que valía.
 * Cuando no lo es, el canje sólo gasta sellos y no toca existencias.
 */
const props = defineProps<{
  /** `null` al dar de alta. */
  recompensa: Recompensa | null
  guardando: boolean
  error: string | null
  errores: Record<string, string>
}>()

const emit = defineEmits<{
  guardar: [datos: DatosRecompensa]
  cerrar: []
}>()

const esAlta = computed(() => props.recompensa === null)

const { productos, cargar: cargarCatalogo } = useCatalog()

onMounted(() => void cargarCatalogo())

/*
 | Mes en curso por omisión.
 |
 | Es lo que se hace el 99% de las veces —«la recompensa de octubre»— y
 | teclear dos fechas completas cada mes para eso es trabajo inventado.
 */
function primerDia(): string {
  const h = new Date()

  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-01`
}

function ultimoDia(): string {
  const h = new Date()
  const fin = new Date(h.getFullYear(), h.getMonth() + 1, 0)

  return `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`
}

const nombre = ref(props.recompensa?.nombre ?? '')
/*
 | «Ninguno» es `undefined`, no `null`.
 |
 | El selector no distingue entre las dos ausencias y escribe
 | `undefined` al vaciarse; el API sí distingue, y quiere `null` para
 | «quítale el artículo». La traducción se hace al emitir, una vez.
 */
const varianteId = ref<number | undefined>(props.recompensa?.product_variant_id ?? undefined)
const desde = ref(props.recompensa?.desde ?? primerDia())
const hasta = ref(props.recompensa?.hasta ?? ultimoDia())
const activa = ref(props.recompensa?.activa ?? true)

/**
 * Todas las presentaciones vendibles, aplanadas.
 *
 * El premio es una variante concreta, no un producto: «café» no se
 * puede regalar, «café grande» sí.
 */
const opciones = computed(() => {
  const lista: Array<{ label: string, value: number }> = []

  for (const p of productos.value) {
    for (const v of p.variants ?? []) {
      if (!v.is_active) continue

      lista.push({
        label: v.name ? `${p.name} · ${v.name}` : p.name,
        value: v.id
      })
    }
  }

  return lista.sort((a, b) => a.label.localeCompare(b.label))
})

/**
 * Al elegir un artículo, se propone su nombre.
 *
 * Sólo si el campo está vacío: si alguien ya escribió «Pan de muerto
 * gratis», pisárselo sería castigar el haber escrito primero.
 */
watch(varianteId, (id) => {
  if (id === undefined || nombre.value.trim() !== '') return

  const opcion = opciones.value.find(o => o.value === id)
  if (opcion) nombre.value = opcion.label
})

const rangoSano = computed(() => hasta.value >= desde.value)

const listo = computed(() =>
  nombre.value.trim().length >= 2 && desde.value !== '' && hasta.value !== '' && rangoSano.value
)

function guardar(): void {
  if (!listo.value || props.guardando) return

  emit('guardar', {
    nombre: nombre.value.trim(),
    product_variant_id: varianteId.value ?? null,
    desde: desde.value,
    hasta: hasta.value,
    activa: activa.value
  })
}
</script>

<template>
  <UModal
    :open="true"
    :title="esAlta ? 'Nueva recompensa' : `Editar «${recompensa?.nombre}»`"
    description="Lo que se puede pedir al llenar la tarjeta."
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          label="Artículo del catálogo"
          help="Si lo eliges, canjearlo descuenta inventario igual que una venta. Déjalo vacío para un premio que no esté en el catálogo."
          :error="errores.product_variant_id"
        >
          <USelectMenu
            v-model="varianteId"
            :items="opciones"
            value-key="value"
            placeholder="Ninguno · premio libre"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Nombre"
          help="Es lo que verá el cajero al canjear."
          :error="errores.nombre"
        >
          <UInput
            v-model="nombre"
            autofocus
            placeholder="Pan de muerto"
            class="w-full"
          />
        </UFormField>

        <!--
          La vigencia es un rango de fechas y no un interruptor porque
          el negocio cambia el premio cada mes: en octubre pan de
          muerto, en enero rosca. Con un interruptor habría que acordarse
          de apagarlo el día 1.
        -->
        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="Desde"
            :error="errores.desde"
          >
            <UInput
              v-model="desde"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Hasta"
            :error="errores.hasta ?? (rangoSano ? undefined : 'No puede terminar antes de empezar.')"
          >
            <UInput
              v-model="hasta"
              type="date"
              class="w-full"
            />
          </UFormField>
        </div>

        <USwitch
          v-model="activa"
          label="Disponible"
          description="Apagada no se puede canjear, aunque esté dentro de fechas."
        />

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
          block
          size="lg"
          class="toque"
          :loading="guardando"
          :disabled="!listo"
          @click="guardar"
        >
          {{ esAlta ? 'Crear' : 'Guardar' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
