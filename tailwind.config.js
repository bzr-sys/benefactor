/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Schibsted Grotesk"', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#F6F6F3',
        ink: '#16161A',
        body: '#3A3A44',
        muted: '#5B5B66',
        line: '#E4E4DF',
        edge: '#CFCFC8',
        well: '#DCDCD5',
        accent: 'var(--accent)',
      },
    },
  },
}
