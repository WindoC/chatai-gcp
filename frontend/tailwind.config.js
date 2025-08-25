/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'chat-bg': '#f7f7f8',
        'sidebar-bg': '#171717',
        'message-user': '#10a37f',
        'message-ai': '#ffffff',
        'text-primary': '#212121',
        'text-secondary': '#6b7280',
      },
      maxWidth: {
        'chat': '48rem',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('daisyui'),
  ],
  daisyui: {
    themes: ["light", "dark"],
  },
}