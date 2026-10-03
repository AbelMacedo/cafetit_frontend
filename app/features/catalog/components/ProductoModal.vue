<script setup lang="ts">
import CampoFoto from '~/features/catalog/components/CampoFoto.vue'
import type {
  AtributoProducto, Category, Product, ProductoAGuardar, VarianteAGuardar
} from '~/shared/types/api'

/**
 * Alta y edición de un producto con sus variantes.
 *
 * El corazón es el generador de combinaciones: el usuario elige qué
 * tamaños y temperaturas aplican, y la pantalla arma el producto cartesiano
 * con un precio por combinación. Capturar las combinaciones a mano sería
 * pedirle que haga la multiplicación él.
 */
const props = defineProps<{
  producto: Product | null
  categorias: Category[]
  atributos: AtributoProducto[]
  guardando: boolean
  error: string | null
}>()

const emit = defineEmits<{
  guardar: [datos: ProductoAGuardar, foto: File | null, quitarFoto: boolean]
  cerrar: []
}>()

const esEdicion = computed(() => props.producto !== null)

/*
 * Foto.
 *
 * Se elige aquí y se sube después de guardar: un producto nuevo todavía
 * no tiene id contra el cual subir. La pantalla se encarga de esa segunda
 * llamada, así que este diálogo sólo carga con el archivo elegido.
 */
const fotoNueva = ref<File | null>(null)
const quitarFoto = ref(false)

/**
 * El selector sólo necesita id y nombre.
 *
 * Pasarle la categoría entera choca con su tipo: `description` es
 * `string | null` y el componente espera `string | undefined`.
 */
const opcionesDeCategoria = computed(() =>
  props.categorias.map(c => ({ id: c.id, name: c.name }))
)

const form = reactive({
  name: '',
  category_id: undefined as number | undefined,
  description: '',
  is_active: true,
  show_on_landing: false,
  tracks_stock: false,
  min_stock: null as number | null
})

/** Con variaciones o sin ellas: decide todo el resto del formulario. */
const tieneVariaciones = ref(false)

/** Precio único cuando no hay variaciones. */
const precioUnico = ref(0)

/** Valores de atributo seleccionados, por id de atributo. */
const seleccion = reactive<Record<number, number[]>>({})

/** Precio por combinación, indexado por la huella de la combinación. */
const precios = reactive<Record<string, number>>({})

/** Ids de variante existentes, para no perderlos al editar. */
const idsExistentes = reactive<Record<string, number>>({})

function huella(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join('-')
}

/**
 * Producto cartesiano de lo seleccionado.
 *
 * Si se eligen 3 tamaños y 2 temperaturas salen 6 combinaciones. El usuario
 * marca 5 casillas y obtiene 6 renglones de precio.
 */
const combinaciones = computed<Array<{ ids: number[], etiqueta: string, clave: string }>>(() => {
  const grupos = props.atributos
    .map(a => (seleccion[a.id] ?? []).map(id => ({ id, valor: a.valores.find(v => v.id === id)?.valor ?? '' })))
    .filter(g => g.length > 0)

  if (grupos.length === 0) return []

  let acumulado: Array<Array<{ id: number, valor: string }>> = [[]]

  for (const grupo of grupos) {
    const siguiente: Array<Array<{ id: number, valor: string }>> = []
    for (const parcial of acumulado) {
      for (const opcion of grupo) siguiente.push([...parcial, opcion])
    }
    acumulado = siguiente
  }

  return acumulado.map((combo) => {
    const ids = combo.map(c => c.id)
    return {
      ids,
      etiqueta: combo.map(c => c.valor).join(' · '),
      clave: huella(ids)
    }
  })
})

const listo = computed(() => {
  if (!form.name.trim() || form.category_id === undefined) return false
  if (!tieneVariaciones.value) return precioUnico.value > 0
  return combinaciones.value.length > 0
    && combinaciones.value.every(c => (precios[c.clave] ?? 0) > 0)
})

function alternarValor(atributoId: number, valorId: number) {
  const actuales = seleccion[atributoId] ?? []
  seleccion[atributoId] = actuales.includes(valorId)
    ? actuales.filter(v => v !== valorId)
    : [...actuales, valorId]
}

function estaSeleccionado(atributoId: number, valorId: number): boolean {
  return (seleccion[atributoId] ?? []).includes(valorId)
}

/** Aplica un precio a todas las combinaciones de golpe. */
const precioMasivo = ref(0)
function aplicarATodas() {
  if (precioMasivo.value <= 0) return
  for (const c of combinaciones.value) precios[c.clave] = precioMasivo.value
}

function enviar() {
  if (!listo.value || props.guardando || form.category_id === undefined) return

  const variants: VarianteAGuardar[] = tieneVariaciones.value
    ? combinaciones.value.map(c => ({
        id: idsExistentes[c.clave],
        price_cents: Math.round(precios[c.clave] ?? 0),
        attribute_value_ids: c.ids,
        tracks_stock: form.tracks_stock,
        min_stock: form.min_stock,
        is_active: true
      }))
    : [{
        id: idsExistentes.default,
        price_cents: Math.round(precioUnico.value),
        attribute_value_ids: [],
        tracks_stock: form.tracks_stock,
        min_stock: form.min_stock,
        is_active: true
      }]

  emit('guardar', {
    name: form.name.trim(),
    category_id: form.category_id,
    description: form.description || null,
    is_active: form.is_active,
    show_on_landing: form.show_on_landing,
    variants
  }, fotoNueva.value, quitarFoto.value)
}

/** Precarga el formulario al editar. */
onMounted(() => {
  const p = props.producto
  if (!p) return

  form.name = p.name
  form.category_id = p.category?.id
  form.description = p.description ?? ''
  form.is_active = p.is_active
  form.show_on_landing = p.show_on_landing

  const variantes = p.variants ?? []
  const primera = variantes[0]

  form.tracks_stock = primera?.tracks_stock ?? false
  form.min_stock = primera?.min_stock ?? null

  const conOpciones = variantes.filter(v => (v.options?.length ?? 0) > 0)
  tieneVariaciones.value = conOpciones.length > 0

  if (!tieneVariaciones.value) {
    precioUnico.value = primera?.price.cents ?? 0
    if (primera) idsExistentes.default = primera.id
    return
  }

  for (const v of conOpciones) {
    const ids = (v.options ?? [])
      .map(o => props.atributos.flatMap(a => a.valores).find(val => val.codigo === o.code)?.id)
      .filter((id): id is number => id !== undefined)

    const clave = huella(ids)
    precios[clave] = v.price.cents
    idsExistentes[clave] = v.id

    // Marcar como seleccionados los valores que esta variante usa.
    for (const atributo of props.atributos) {
      for (const valor of atributo.valores) {
        if (ids.includes(valor.id) && !estaSeleccionado(atributo.id, valor.id)) {
          seleccion[atributo.id] = [...(seleccion[atributo.id] ?? []), valor.id]
        }
      }
    }
  }
})
</script>

<template>
  <UModal
    :open="true"
    :title="esEdicion ? 'Editar producto' : 'Nuevo producto'"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="emit('cerrar')"
  >
    <template #body>
      <div class="space-y-5">
        <CampoFoto
          v-model:archivo="fotoNueva"
          v-model:quitar="quitarFoto"
          :url-actual="producto?.image_url ?? null"
          :nombre="form.name"
        />

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Nombre">
            <UInput
              v-model="form.name"
              placeholder="Capuchino"
              autofocus
              class="w-full"
            />
          </UFormField>

          <UFormField label="Categoría">
            <USelectMenu
              v-model="form.category_id"
              :items="opcionesDeCategoria"
              value-key="id"
              label-key="name"
              placeholder="Elige una"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Descripción (opcional)">
          <UTextarea
            v-model="form.description"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <div class="flex flex-wrap gap-4">
          <UCheckbox
            v-model="form.is_active"
            label="Se vende"
          />
          <UCheckbox
            v-model="form.show_on_landing"
            label="Se muestra en la web"
          />
          <UCheckbox
            v-model="form.tracks_stock"
            label="Controla inventario por pieza"
          />
        </div>

        <UFormField
          v-if="form.tracks_stock"
          label="Existencias mínimas"
          help="Debajo de esta cantidad se avisa. Déjalo vacío si no aplica."
        >
          <UInput
            v-model.number="form.min_stock"
            type="number"
            min="0"
            class="w-48"
            :ui="{ base: 'tabular-nums text-right' }"
          />
        </UFormField>

        <div class="border-t border-beige-200 dark:border-beige-800 pt-4 space-y-4">
          <UCheckbox
            v-model="tieneVariaciones"
            label="Tiene variaciones (tamaño, temperatura...)"
          />

          <!-- Sin variaciones: un solo precio -->
          <UFormField
            v-if="!tieneVariaciones"
            label="Precio"
          >
            <CampoPesos
              v-model="precioUnico"
              size="lg"
              class="w-48"
            />
          </UFormField>

          <!-- Con variaciones: elegir opciones y poner precio a cada combinación -->
          <template v-else>
            <div
              v-for="a in atributos"
              :key="a.id"
              class="space-y-2"
            >
              <p class="text-sm font-medium">
                {{ a.nombre }}
              </p>
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="v in a.valores"
                  :key="v.id"
                  size="sm"
                  :variant="estaSeleccionado(a.id, v.id) ? 'soft' : 'outline'"
                  :color="estaSeleccionado(a.id, v.id) ? 'primary' : 'neutral'"
                  @click="alternarValor(a.id, v.id)"
                >
                  {{ v.valor }}
                </UButton>
              </div>
            </div>

            <div
              v-if="combinaciones.length > 0"
              class="space-y-2"
            >
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-medium">
                  {{ combinaciones.length }}
                  {{ combinaciones.length === 1 ? 'combinación' : 'combinaciones' }}
                </p>

                <div class="flex items-center gap-2">
                  <CampoPesos
                    v-model="precioMasivo"
                    size="sm"
                    class="w-28"
                  />
                  <UButton
                    size="sm"
                    variant="outline"
                    color="neutral"
                    @click="aplicarATodas"
                  >
                    Aplicar a todas
                  </UButton>
                </div>
              </div>

              <div
                v-for="c in combinaciones"
                :key="c.clave"
                class="flex items-center gap-3"
              >
                <span class="flex-1 text-sm">{{ c.etiqueta }}</span>
                <CampoPesos
                  :model-value="precios[c.clave] ?? 0"
                  size="sm"
                  class="w-36"
                  @update:model-value="v => precios[c.clave] = v"
                />
              </div>
            </div>

            <p
              v-else
              class="text-sm text-beige-600"
            >
              Elige al menos una opción para generar las combinaciones.
            </p>
          </template>
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
          @click="enviar"
        >
          {{ esEdicion ? 'Guardar cambios' : 'Crear producto' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
