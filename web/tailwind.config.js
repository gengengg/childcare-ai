/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // CSS 변수 기반 팔레트 (다크모드에서 값만 스왑)
        cream: {
          50: 'rgb(var(--cream-50) / <alpha-value>)',
          100: 'rgb(var(--cream-100) / <alpha-value>)',
          200: 'rgb(var(--cream-200) / <alpha-value>)',
          300: 'rgb(var(--cream-300) / <alpha-value>)',
          400: 'rgb(var(--cream-400) / <alpha-value>)',
          500: 'rgb(var(--cream-500) / <alpha-value>)',
        },
        clay: {
          50: 'rgb(var(--clay-50) / <alpha-value>)',
          100: 'rgb(var(--clay-100) / <alpha-value>)',
          200: 'rgb(var(--clay-200) / <alpha-value>)',
          300: 'rgb(var(--clay-300) / <alpha-value>)',
          400: 'rgb(var(--clay-400) / <alpha-value>)',
          500: 'rgb(var(--clay-500) / <alpha-value>)',
          600: 'rgb(var(--clay-600) / <alpha-value>)',
          700: 'rgb(var(--clay-700) / <alpha-value>)',
          800: 'rgb(var(--clay-800) / <alpha-value>)',
          900: 'rgb(var(--clay-900) / <alpha-value>)',
        },
        amber: {
          50: '#FDF4E6',
          100: '#F9E5C3',
          200: '#EFC383',
          300: '#E4A250',
          400: '#D9863A',
          500: '#B76A2A',
        },
        // 시맨틱 컬러
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Pretendard',
          'Pretendard Variable',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Apple SD Gothic Neo"',
          '"Malgun Gothic"',
          'system-ui',
          'sans-serif',
        ],
        serif: ['"Noto Serif KR"', 'serif'],
      },
      borderRadius: {
        card: '20px',
        pill: '999px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};
