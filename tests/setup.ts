import * as vue from 'vue'

/**
 * Auto-imports de Nuxt, para las pruebas.
 *
 * En la aplicación, `ref` y `computed` los inyecta Nuxt en tiempo de
 * compilación: por eso los stores y composables no los importan. Fuera de
 * Nuxt esos nombres no existen, así que aquí se ponen como globales — que
 * es el mismo efecto, por otro camino.
 *
 * **Por qué no el entorno `nuxt` de @nuxt/test-utils**, que sería lo
 * natural: con Nuxt 4.5 no arranca —falla al resolver `h3-next/generic`—
 * y no vale la pena cargar con una dependencia rota. La contrapartida es
 * real y conviene tenerla clara: si algún día un store empieza a usar un
 * auto-import que no esté en esta lista, la prueba fallará con un
 * «is not defined» que no dice de dónde sale. La solución entonces es
 * agregarlo aquí, o reintentar el entorno de Nuxt si ya quedó arreglado.
 *
 * Lo que se prueba así es lógica pura —aritmética de dinero, composición
 * del carrito—, no componentes. Para eso el DOM no hace falta y la suite
 * arranca en milisegundos, que es la diferencia entre correrla siempre y
 * dejar de correrla.
 */
const autoimports = {
  ref: vue.ref,
  computed: vue.computed,
  reactive: vue.reactive,
  readonly: vue.readonly,
  watch: vue.watch,
  watchEffect: vue.watchEffect,
  toRef: vue.toRef,
  toRefs: vue.toRefs,
  unref: vue.unref,
  isRef: vue.isRef,
  shallowRef: vue.shallowRef,
  nextTick: vue.nextTick,
  onMounted: vue.onMounted,
  onUnmounted: vue.onUnmounted,
  onBeforeUnmount: vue.onBeforeUnmount
}

Object.assign(globalThis, autoimports)
