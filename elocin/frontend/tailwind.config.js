/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#F7F5F0',
        surface: '#FFFFFF',
        surface2: '#F0EDE6',
        surface0: '#EAE6DE',
        border: '#E2DDD5',
        ink: '#1C2B3A',
        ink2: '#4A5568',
        ink3: '#8896A5',
        ink4: '#B8C0CA',
        sage: '#4A7C59',
        sageLight: '#EBF3EE',
        sageMid: '#C5DEC9',
        amber: '#E8960A',
        amberLight: '#FEF6E4',
        amberMid: '#FADA8B',
        danger: '#C0392B',
        dangerLight: '#FDECEA',
        info: '#2C6FAC',
        infoLight: '#EBF2FA',
        purple: '#5C4AB5',
        purpleLight: '#EEEDFE',
        // Dark-mode surfaces — used only by the marketing site's dark theme.
        // The authenticated app defines no dark: variants and stays light.
        night: '#0E141B',
        night2: '#161F29',
        night3: '#1F2A36',
        nightBorder: '#2A3743'
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif']
      },
      borderRadius: {
        card: '10px',
        sm: '6px'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out both',
        float: 'float 6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
