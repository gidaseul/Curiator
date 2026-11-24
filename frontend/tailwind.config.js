/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cu: {
          bg:           '#F4F7FB',
          surface:      '#FFFFFF',
          elevated:     '#EEF3FB',
          border:       '#E5ECF5',
          'border-bright': '#D7E2F0',
          cyan:         '#3182F6',
          'cyan-muted': '#1B64DA',
          'cyan-dim':   '#EAF2FF',
          text:         '#191F28',
          muted:        '#5F6B7A',
          dim:          '#8B95A1',
          error:        '#E5484D',
          success:      '#00A87E',
        },
      },
      fontFamily: {
        sans:    ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Manrope"', '"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card':        '0 14px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.04)',
        'card-hover':  '0 20px 48px rgba(15, 23, 42, 0.08), 0 6px 14px rgba(15, 23, 42, 0.05)',
        'cyan':        '0 20px 50px rgba(49, 130, 246, 0.16)',
        'cyan-sm':     '0 10px 24px rgba(49, 130, 246, 0.18)',
        'btn':         '0 8px 24px rgba(15, 23, 42, 0.08)',
        'btn-cyan':    '0 16px 32px rgba(49, 130, 246, 0.22)',
        'inset-t':     'inset 0 1px 0 rgba(255,255,255,0.65)',
      },
      letterSpacing: {
        'display': '-0.02em',
        'label':   '0.08em',
        'wide2':   '0.12em',
      },
      backgroundImage: {
        'grid-dark': `linear-gradient(rgba(205, 217, 232, 0.5) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(205, 217, 232, 0.5) 1px, transparent 1px)`,
        'noise':     "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
