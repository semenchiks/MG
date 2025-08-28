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
    host: '0.0.0.0', // Слушаем все интерфейсы
    port: 5173,
    proxy: {
      // Проксируем API запросы к Node.js серверу
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  
  // Базовый путь для продакшена
  base: './'
});