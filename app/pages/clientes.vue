<script setup lang="ts">
import ClienteModal from '~/features/loyalty/components/ClienteModal.vue'
import FichaClienteModal from '~/features/loyalty/components/FichaClienteModal.vue'
import { useCustomers, useRewards } from '~/features/loyalty/composables/useLoyalty'
import type { Cliente } from '~/shared/types/api'

/*
 * `altoCompleto`: la tabla se queda con el alto sobrante y es lo único
 * que se desplaza.
 */
definePageMeta({ middleware: 'auth', altoCompleto: true })

const {
  clientes, cargando, error, busqueda,
  conSellos, listosParaPremio, cargar
} = useCustomers()

/*
 * La configuración se pide aparte porque es la que dice si el programa
 * está encendido y cuántos sellos cuesta un premio. Sin ella, «3 listos
 * para premio» sería un número inventado por la pantalla.
 */
const premios = useRewards()

const meta = computed(() => premios.ajustes.value.sellos_para_premio)

onMounted(async () => {
  await Promise.all([cargar(), premios.cargar()])
})

/*
 | La búsqueda es por NOMBRE, y va al servidor.
 |
 | Por teléfono no se puede: el número no se guarda, así que no hay
 | nada contra lo que comparar parcialmente. Para encontrar a alguien
 | por su número está la búsqueda del mostrador, que exige los diez
 | dígitos exactos.
 */
let temporizador: ReturnType<typeof setTimeout> | undefined

watch(busqueda, () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => void cargar(), 300)
})

onBeforeUnmount(() => clearTimeout(temporizador))

const ordenados = computed(() => {
  const lista = [...clientes.value]

  /*
   | Quien está listo para su premio, primero.
   |
   | Es lo único accionable de esta lista: alguien tiene diez sellos y
   | no ha vuelto a pasar. Lo demás es consulta.
   */
  return lista.sort((a, b) => {
    const listoA = (a.sellos ?? 0) >= meta.value ? 1 : 0
    const listoB = (b.sellos ?? 0) >= meta.value ? 1 : 0

    if (listoA !== listoB) return listoB - listoA

    return (b.ultima_visita ?? '').localeCompare(a.ultima_visita ?? '')
  })
})

const abierto = ref<Cliente | null>(null)
const registrando = ref(false)
const aviso = ref<string | null>(null)

/**
 * Al salir de la ventana de alta, se abre su ficha.
 *
 * Vale tanto si se registró ahora como si ya existía: en los dos casos
 * lo que sigue es ver su tarjeta, y buscar a mano en la lista a quien
 * se acaba de teclear sería trabajo repetido.
 */
async function alElegir(cliente: Cliente): Promise<void> {
  registrando.value = false
  await cargar()
  abierto.value = cliente
}

function alBorrar(mensaje: string): void {
  aviso.value = mensaje
  abierto.value = null
  void cargar()
}

function fecha(iso: string | null | undefined): string {
  if (!iso) return 'Nunca ha vuelto'

  // Día del negocio, no instante: partirlo a mano evita que `new Date`
  // lo lea como medianoche UTC y lo pinte un día antes.
  const [a, m, d] = iso.slice(0, 10).split('-')

  return `${d}/${m}/${a}`
}

function listo(c: Cliente): boolean {
  return (c.sellos ?? 0) >= meta.value
}
</script>

<template>
  <div class="space-y-3 md:h-full md:flex md:flex-col md:min-h-0">
    <PaginaTitulo
      titulo="Clientes"
      descripcion="Los del programa de sellos. El teléfono no se guarda: la base tiene una huella y los últimos cuatro dígitos, que son los que se confirman en voz alta."
    >
      <!--
        El alta también vive aquí, no sólo en el mostrador.

        Lo normal es que alguien se registre al cobrar, y ésa sigue
        siendo la vía principal. Pero una pantalla llamada «Clientes»
        sin forma de añadir uno se lee como incompleta, y hay casos
        reales —dar de alta a quien preguntó por el programa sin
        comprar— que no pasan por una venta.

        Es la misma ventana que en Vender: primero busca el teléfono,
        porque dar de alta a alguien que ya estaba es cómo se parte una
        tarjeta de sellos en dos.
      -->
      <template #acciones>
        <UButton
          icon="i-lucide-user-round-plus"
          class="toque"
          @click="registrando = true"
        >
          Nuevo cliente
        </UButton>
      </template>

      <template #resumen>
        {{ conSellos }} con sellos
      </template>
    </PaginaTitulo>

    <!--
      El programa apagado se dice arriba del todo. Una lista de clientes
      que nadie está sellando es una lista que no se entiende sin esto.
    -->
    <UAlert
      v-if="!premios.cargando.value && !premios.ajustes.value.activo"
      color="warning"
      variant="subtle"
      icon="i-lucide-power-off"
      title="El programa está apagado"
      description="Nadie está ganando sellos. Se enciende en Recompensas."
    >
      <template #actions>
        <UButton
          to="/recompensas"
          size="xs"
          variant="outline"
          color="neutral"
        >
          Ir a Recompensas
        </UButton>
      </template>
    </UAlert>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
    />

    <UAlert
      v-if="aviso"
      color="success"
      variant="subtle"
      :title="aviso"
      close
      @update:open="aviso = null"
    />

    <BarraFiltros
      :visibles="ordenados.length"
      :total="clientes.length"
      :filtrada="busqueda !== ''"
      @limpiar="busqueda = ''"
    >
      <template #buscar>
        <UInput
          v-model="busqueda"
          placeholder="Nombre del cliente"
          icon="i-lucide-search"
          size="lg"
          class="w-44 2xl:w-56"
        />
      </template>

      <template #resumen>
        {{ listosParaPremio }}
        {{ listosParaPremio === 1 ? 'listo para premio' : 'listos para premio' }}
      </template>
    </BarraFiltros>

    <EsqueletoLista
      v-if="cargando"
      :filas="4"
    />

    <SinResultados
      v-else-if="ordenados.length === 0"
      icono="i-lucide-users-round"
      :titulo="busqueda ? 'Ningún cliente coincide' : 'Todavía no hay clientes'"
      :descripcion="busqueda
        ? 'Prueba con otro nombre. Por teléfono se busca desde la pantalla de venta.'
        : 'Se dan de alta en el mostrador, al cobrar, si el cliente quiere.'"
    />

    <div
      v-else
      class="tarjeta overflow-hidden md:flex-1 md:min-h-0"
    >
      <div class="overflow-auto max-h-[60vh] md:max-h-none md:h-full">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10">
            <tr class="text-center [&>th]:border-r [&>th]:border-borde [&>th:last-child]:border-r-0">
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde">
                Cliente
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap hidden sm:table-cell">
                Teléfono
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap">
                Sellos
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap hidden lg:table-cell">
                Última visita
              </th>
              <th class="px-3 lg:px-4 py-3 font-medium text-xs uppercase tracking-wide text-apagado bg-superficie border-b border-borde w-px whitespace-nowrap">
                Ficha
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="c in ordenados"
              :key="c.id"
              class="border-b border-borde-suave last:border-0 transition
                     [&>td]:border-r [&>td]:border-borde-suave [&>td:last-child]:border-r-0"
            >
              <td class="px-3 lg:px-4 py-4 text-center w-1/2 lg:w-1/3 max-w-0">
                <span class="flex items-center justify-center gap-2 min-w-0">
                  <span class="font-medium truncate">{{ c.nombre }}</span>

                  <UBadge
                    v-if="listo(c)"
                    color="primary"
                    variant="subtle"
                    size="md"
                    class="shrink-0"
                  >
                    Premio listo
                  </UBadge>
                </span>

                <!-- En angosto el teléfono se mete aquí: su columna se oculta. -->
                <span class="block text-xs text-apagado sm:hidden tabular-nums">
                  ···{{ c.telefono_termina_en }}
                </span>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center text-apagado tabular-nums hidden sm:table-cell">
                ···{{ c.telefono_termina_en }}
              </td>

              <!--
                El saldo lo manda el servidor ya calculado. La pantalla
                no suma sellos menos canjes por su cuenta: dos sitios
                calculando lo mismo acaban dando dos cifras distintas.
              -->
              <td class="px-3 lg:px-4 py-4 text-center tabular-nums">
                <span
                  class="font-semibold"
                  :class="listo(c) ? 'text-naranja-600 dark:text-naranja-400' : 'text-tinta'"
                >{{ c.sellos ?? 0 }}</span>
                <span class="text-apagado-2">/{{ meta }}</span>
              </td>

              <td class="px-3 lg:px-4 py-4 text-center text-apagado whitespace-nowrap hidden lg:table-cell">
                {{ fecha(c.ultima_visita) }}
              </td>

              <td class="px-3 lg:px-4 py-4 text-center">
                <UButton
                  size="sm"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-id-card"
                  :aria-label="`Ver la tarjeta de ${c.nombre}`"
                  @click="abierto = c"
                >
                  <span class="hidden xl:inline">Ver tarjeta</span>
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ClienteModal
      v-if="registrando"
      @elegido="alElegir"
      @cerrar="registrando = false"
    />

    <FichaClienteModal
      v-if="abierto"
      :key="abierto.id"
      :cliente="abierto"
      @borrado="alBorrar"
      @cerrar="abierto = null"
    />
  </div>
</template>
