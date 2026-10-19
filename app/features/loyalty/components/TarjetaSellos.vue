<script setup lang="ts">
import type { Cliente } from '~/shared/types/api'

/**
 * La tarjeta de sellos.
 *
 * Es la tarjetita de cartón de toda la vida, dibujada. No es adorno: el
 * cliente la ve desde el otro lado del mostrador y entiende de un
 * vistazo cuánto le falta, sin que nadie tenga que decírselo. Un «7 de
 * 10» en texto plano no hace eso.
 *
 * Los huecos se dibujan todos —los dados y los que faltan— porque el
 * valor está en ver el espacio vacío. Una fila que crece sólo con lo
 * ganado no dice cuánto queda.
 */
const props = withDefaults(defineProps<{
  cliente: Cliente
  /** Cuántos sellos pide un premio. Lo decide el negocio, no esta pantalla. */
  meta: number
  /** Compacta: para el carrito, donde el ancho es del cobro. */
  compacta?: boolean
}>(), {
  compacta: false
})

const sellos = computed(() => props.cliente.sellos ?? 0)

/**
 * Los sellos se acumulan por encima de diez.
 *
 * Quien lleva trece no pierde tres al canjear: se le descuentan diez y
 * se queda con los tres. Por eso la tarjeta dibuja el ciclo en curso y
 * dice aparte cuántos premios tiene guardados.
 */
const premiosGuardados = computed(() => Math.floor(sellos.value / props.meta))
const enCiclo = computed(() => sellos.value % props.meta)

/** La tarjeta llena se dibuja llena, no vacía con un «1 premio» al lado. */
const marcados = computed(() =>
  premiosGuardados.value > 0 && enCiclo.value === 0 ? props.meta : enCiclo.value
)

const completa = computed(() => premiosGuardados.value > 0)
const faltan = computed(() => props.meta - marcados.value)

const huecos = computed(() =>
  Array.from({ length: props.meta }, (_, i) => ({
    n: i + 1,
    dado: i < marcados.value
  }))
)
</script>

<template>
  <div
    class="rounded-2xl border overflow-hidden transition"
    :class="completa
      ? 'border-naranja-300 dark:border-naranja-800 bg-naranja-50 dark:bg-naranja-950/40'
      : 'border-borde bg-superficie'"
  >
    <!-- Cabecera: de quién es la tarjeta -->
    <div
      class="flex items-center gap-3 px-4 border-b"
      :class="[
        compacta ? 'py-2.5' : 'py-3.5',
        completa ? 'border-naranja-200 dark:border-naranja-900' : 'border-borde-suave'
      ]"
    >
      <span
        class="rounded-full bg-cafe-500 text-white flex items-center justify-center
               font-semibold shrink-0"
        :class="compacta ? 'size-8 text-xs' : 'size-10 text-sm'"
      >
        {{ cliente.nombre.trim().charAt(0).toUpperCase() || '?' }}
      </span>

      <div class="min-w-0 flex-1">
        <p
          class="font-semibold text-tinta truncate"
          :class="compacta ? 'text-sm' : 'text-base'"
        >
          {{ cliente.nombre }}
        </p>

        <!--
          Los últimos cuatro dígitos, que son los que el cajero confirma
          en voz alta: «¿el que termina en 4417?». El número completo no
          existe en ninguna parte — ni aquí ni en la base.
        -->
        <p class="text-xs text-apagado">
          Termina en {{ cliente.telefono_termina_en }}
        </p>
      </div>

      <span
        class="text-right shrink-0 tabular-nums"
        :class="compacta ? 'text-sm' : 'text-lg'"
      >
        <span class="font-bold text-tinta">{{ marcados }}</span>
        <span class="text-apagado-2">/{{ meta }}</span>
      </span>
    </div>

    <!-- Los huecos -->
    <div
      class="px-4"
      :class="compacta ? 'py-3' : 'py-4'"
    >
      <!--
        Se envuelve en varias filas en lugar de encogerse.

        Con `grid-cols-10` fijo y un premio de quince sellos, cada hueco
        quedaba en nueve píxeles: una hilera de puntos ilegible. Así
        cabe cualquier número que el negocio configure.
      -->
      <div
        class="flex flex-wrap"
        :class="compacta ? 'gap-1' : 'gap-1.5'"
      >
        <span
          v-for="h in huecos"
          :key="h.n"
          class="flex items-center justify-center rounded-full border-2 transition-all"
          :class="[
            compacta ? 'size-6' : 'size-9',
            h.dado
              ? 'bg-naranja-500 border-naranja-500 text-white shadow-sm'
              : 'border-dashed border-borde-marcado text-apagado-2'
          ]"
          :title="h.dado ? `Sello ${h.n}` : `Falta el sello ${h.n}`"
        >
          <UIcon
            v-if="h.dado"
            name="i-lucide-coffee"
            :class="compacta ? 'size-3' : 'size-4'"
          />
          <span
            v-else
            class="text-[10px] font-medium tabular-nums"
          >{{ h.n }}</span>
        </span>
      </div>
    </div>

    <!-- Pie: qué significa lo de arriba, en una frase -->
    <div
      class="px-4 py-2.5 border-t text-sm"
      :class="completa
        ? 'border-naranja-200 dark:border-naranja-900 bg-naranja-100/60 dark:bg-naranja-900/30'
        : 'border-borde-suave bg-hundido'"
    >
      <p
        v-if="completa"
        class="font-semibold text-naranja-900 dark:text-naranja-200 flex items-center gap-1.5"
      >
        <UIcon
          name="i-lucide-gift"
          class="size-4 shrink-0"
        />
        <span v-if="premiosGuardados === 1">Tarjeta llena: puede canjear.</span>
        <span v-else>{{ premiosGuardados }} premios por canjear.</span>
      </p>

      <p
        v-else-if="sellos === 0"
        class="text-apagado"
      >
        Todavía sin sellos. El primero se pone al cobrar.
      </p>

      <p
        v-else
        class="text-tinta-2"
      >
        <span v-if="faltan === 1">Le falta <strong class="text-tinta">un sello</strong>.</span>
        <span v-else>Le faltan <strong class="text-tinta">{{ faltan }} sellos</strong>.</span>
        <span class="text-apagado"> Uno por visita, máximo uno al día.</span>
      </p>
    </div>
  </div>
</template>
