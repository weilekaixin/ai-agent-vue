/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        /* Display / message body – Copernicus → EB Garamond → Georgia */
        serif: ['"EB Garamond"', '"Cormorant Garamond"', 'Georgia', 'ui-serif', 'serif'],
        /* UI chrome – StyreneB → DM Sans → system */
        sans:  ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        /* ─── Exact Claude canvas palette ─── */
        canvas:   '#faf9f5',   /* page floor, warm cream          */
        surface:  '#f5f0e8',   /* section/sidebar bg              */
        card:     '#efe9de',   /* feature cards, elevated surface */
        strong:   '#e8e0d2',   /* tabs, emphasized bands          */

        /* ─── Claude primary coral ─── */
        coral: {
          DEFAULT: '#cc785c',
          dark:    '#a9583e',
          muted:   '#e6dfd8',
          bg:      '#fdf5f1',
        },

        /* ─── Text scale ─── */
        ink: {
          DEFAULT: '#141413',   /* headlines, primary              */
          body:    '#3d3d3a',   /* default running text            */
          muted:   '#6c6a64',   /* sub-headings, breadcrumbs       */
          soft:    '#8e8b82',   /* captions, fine print            */
          ghost:   '#aba89f',   /* placeholders                    */
        },

        /* ─── Borders ─── */
        hairline: {
          DEFAULT: '#e6dfd8',   /* 1 px on cream surfaces          */
          soft:    '#ebe6df',   /* barely-visible dividers         */
        },

        /* ─── Dark surfaces (code blocks) ─── */
        dark: {
          DEFAULT: '#181715',
          elevated:'#252320',
          soft:    '#1f1e1b',
        },
      },
      spacing: {
        /* Claude spacing token ladder */
        'xxs': '4px',
        'xs':  '8px',
        'sm':  '12px',
        'md':  '16px',
        'lg':  '24px',
        'xl':  '32px',
        'xxl': '48px',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(20,20,19,0.08)',
        card:   '0 2px 8px rgba(20,20,19,0.07), 0 1px 3px rgba(20,20,19,0.05)',
      },
      animation: {
        'fade-up': 'fadeUp 0.18s ease-out',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      maxWidth: {
        prose: '740px',
      },
    },
  },
  plugins: [],
}
