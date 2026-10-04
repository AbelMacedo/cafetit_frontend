<script setup lang="ts">
import { formatearCentavos } from '~/shared/utils/dinero'

/**
 * Una cifra de dinero.
 *
 * Todo importe del sistema pasa por aquí para que siempre se vea igual:
 * `tabular-nums` —sin él, las cifras de una columna bailan de ancho al
 * cambiar de dígito— y sin partirse en dos renglones.
 *
 * Acepta centavos o el objeto `{cents, formatted}` que devuelve la API.
 * Cuando viene de la API se usa SU texto, no se reformatea: el servidor
 * es la fuente de verdad del dinero, también de cómo se escribe.
 */
const props = withDefaults(defineProps<{
  valor: number | { cents: number, formatted: string } | null | undefined
  /** `grande` para el total que el cajero le dice al cliente. */
  tamano?: 'normal' | 'grande' | 'chico'
  /** Antepone el signo, para descuentos y salidas de caja. */
  signo?: 'ninguno' | 'mas' | 'menos'
}>(), {
  tamano: 'normal',
  signo: 'ninguno'
})

const texto = computed(() => {
  if (props.valor === null || props.valor === undefined) return '—'
  if (typeof props.valor === 'number') return formatearCentavos(props.valor)

  return props.valor.formatted
})

const prefijo = computed(() => ({
  ninguno: '',
  mas: '+ ',
  menos: '− '
}[props.signo]))

const clases = computed(() => ({
  chico: 'text-sm',
  normal: 'font-medium',
  grande: 'text-3xl font-semibold text-tinta'
}[props.tamano]))
</script>

<template>
  <span
    class="tabular-nums whitespace-nowrap"
    :class="clases"
  >{{ prefijo }}{{ texto }}</span>
</template>
