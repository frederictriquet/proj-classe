import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Icons are generated once from public/icon.svg and committed (`npm run generate-icons`).
// The source is full-bleed, so no padding; maskable and Apple icons get the same green background.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background: '#2E6B3F' } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#2E6B3F' } },
  },
  images: ['public/icon.svg'],
})
