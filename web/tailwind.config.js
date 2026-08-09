/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 베이스 (아이보리 / 크림)
        cream: {
          50: '#FDFAF4',
          100: '#FAF5EB',
          200: '#F4ECDA',
          300: '#ECE0C4',
          400: '#E0CFA8',
          500: '#D2BB85',
        },
        // 브라운 (기본 브랜드 컬러)
        clay: {
          50: '#F9F4EC',
          100: '#EFE4D0',
          200: '#DBC29B',
          300: '#C29E6C',
          400: '#A98046',
          500: '#8B6844',
          600: '#6E5233',
          700: '#5A4128',
          800: '#40301F',
          900: '#2A2018',
        },
        // 액센트 오렌지
        amber: {
          50: '#FDF4E6',
          100: '#F9E5C3',
          200: '#EFC383',
          300: '#E4A250',
          400: '#D9863A',
          500: '#B76A2A',
        },
        ink: '#2A2018',
        subtle: '#8A7761',
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
        card: '0 1px 2px rgba(60, 45, 30, 0.04), 0 8px 24px -12px rgba(60, 45, 30, 0.10)',
        pop: '0 4px 16px rgba(139, 104, 68, 0.20)',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};
