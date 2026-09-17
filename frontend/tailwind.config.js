/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#060f0c',
          900: '#0a1713',
          850: '#0e1f1a',
          800: '#132822',
          750: '#18332b',
          700: '#1f4036',
          600: '#2a5549',
        },
        aura: {
          green: '#00e599',
          mint: '#34d399',
          darkmint: '#059669',
          light: '#6ee7b7',
          glow: 'rgba(0, 229, 153, 0.25)',
          danger: '#ef4444',
          warning: '#f59e0b',
        }
      },
      backgroundImage: {
        'hero-radial': 'radial-gradient(ellipse at top left, #1f4f41 0%, #0d2820 60%, #0a1713 100%)',
        'card-glow': 'radial-gradient(circle at 50% 0%, rgba(0, 229, 153, 0.08) 0%, rgba(10, 23, 19, 0) 70%)',
        'emerald-gradient': 'linear-gradient(135deg, #134e40 0%, #0a251e 100%)',
        'pill-gradient': 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
      },
      boxShadow: {
        'aura-glow': '0 0 25px -5px rgba(0, 229, 153, 0.25)',
        'aura-subtle': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        'card-deep': '0 10px 30px -10px rgba(0, 0, 0, 0.7)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
