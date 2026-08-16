/** @type {import('tailwindcss').Config} */

/** Reads a channel triplet from `global.css` and keeps Tailwind's opacity modifiers working. */
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // `class` rather than `media`: the theme is a user preference stored in the app, and
  // NativeWind's runtime throws if you set the scheme manually while it is on `media`.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          100: token('bg-100'),
          200: token('bg-200'),
          300: token('bg-300'),
        },
        surface: {
          DEFAULT: token('surface'),
          raised: token('surface-raised'),
        },
        primary: {
          100: token('primary-100'),
          200: token('primary-200'),
          300: token('primary-300'),
        },
        accent: {
          100: token('accent-100'),
          200: token('accent-200'),
        },
        text: {
          100: token('text-100'),
          200: token('text-200'),
          300: token('text-300'),
        },
        state: {
          success: token('success'),
          successBg: token('success-bg'),
          warning: token('warning'),
          warningBg: token('warning-bg'),
          danger: token('danger'),
          dangerBg: token('danger-bg'),
        },
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '26px',
      },
      fontSize: {
        // Georgian script has a large x-height and no capitals, so it reads better
        // with slightly more line-height than the Tailwind defaults.
        xs: ['12px', '18px'],
        sm: ['13px', '20px'],
        base: ['15px', '24px'],
        lg: ['17px', '26px'],
        xl: ['20px', '29px'],
        '2xl': ['24px', '33px'],
        '3xl': ['29px', '38px'],
      },
    },
  },
  plugins: [],
};
