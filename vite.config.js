import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Корневая папка
  root: '.',
  
  // Папка для сборки
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    
    // Входные точки - только главная страница
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  
  // Настройки сервера для разработки
  server: {
    port: 5173,
    proxy: {
      // Проксируем API запросы к Node.js серверу
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  },
  
  // Базовый путь для продакшена
  base: './'
});