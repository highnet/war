export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001/graphql',
      wsUrl: process.env.NUXT_PUBLIC_WS_URL || 'ws://localhost:3001/graphql',
    },
  },
  ssr: true,
});
