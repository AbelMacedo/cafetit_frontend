export default defineAppConfig({
  ui: {
    colors: {
      // Naranja para todo lo accionable; beige como neutral cálido.
      // El café se usa de forma explícita donde toca marca, no como base.
      primary: 'naranja',
      neutral: 'beige',

      success: 'emerald',
      warning: 'amber',
      error: 'red',
      info: 'sky'
    },

    /*
     * Ajustes al tema de Nuxt UI.
     *
     * Sin esto, cada componente nace con el aspecto por omisión de la
     * librería —esquinas de 6 px, sombras grises, alturas de sitio web— y
     * el resultado se ve como una plantilla con otros colores encima, por
     * más cuidada que esté la paleta. Aquí se corrigen las tres cosas que
     * más lo delatan: el radio, la altura y el anillo de foco.
     */
    button: {
      slots: {
        base: 'rounded-xl font-medium transition'
      },
      defaultVariants: {
        size: 'md'
      }
    },

    input: {
      slots: {
        base: 'rounded-xl'
      }
    },

    textarea: {
      slots: {
        base: 'rounded-xl'
      }
    },

    selectMenu: {
      slots: {
        base: 'rounded-xl'
      }
    },

    card: {
      slots: {
        root: 'rounded-2xl shadow-suave ring-borde/75',
        header: 'p-4 sm:px-5',
        body: 'p-4 sm:p-5',
        footer: 'p-4 sm:px-5'
      }
    },

    modal: {
      slots: {
        content: 'rounded-2xl'
      }
    },

    badge: {
      slots: {
        base: 'rounded-full font-medium'
      }
    },

    popover: {
      slots: {
        content: 'rounded-2xl shadow-alzada ring-borde/75'
      }
    }
  }
})
