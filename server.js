// В начале файла добавляем обработчики необработанных ошибок
process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
});

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';

// --- Yjs ---
import ws from 'ws';
const WebSocketServer = ws.Server;
import * as Y from 'yjs';
import { setupWSConnection } from '@y/websocket-server/utils';

const __dirname = path.resolve();

// Функция для логирования с временными метками
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  switch(level) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    default:
      console.log(formattedMessage);
  }
}

const app = express();
const httpServer = createServer(app);

// --- Настройка Socket.IO сервера ---
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL || "*"
      : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6
});

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || "*"
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));

// Раздаем статические файлы
const staticPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'dist')
  : __dirname;

// Middleware для установки MIME-типов
app.use((req, res, next) => {
  if (req.path.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
  } else if (req.path.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
  next();
});

// Настройка статических файлов
app.use(express.static(staticPath, {
  etag: true,
  lastModified: true,
  maxAge: process.env.NODE_ENV === 'production' ? 86400000 : 30000,
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    
    // В разработке отключаем кэш для быстрого обновления
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Главная страница - редактор кода
app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Все остальные запросы также ведут на редактор
app.get('*', (req, res) => {
  // Проверяем, является ли запрос статическим файлом
  const isStaticFile = req.path.includes('.') && 
    (req.path.endsWith('.css') || 
     req.path.endsWith('.js') || 
     req.path.endsWith('.png') || 
     req.path.endsWith('.jpg') || 
     req.path.endsWith('.ico'));
  
  if (!isStaticFile) {
    res.sendFile(path.join(staticPath, 'index.html'));
  } else {
    res.status(404).send('File not found');
  }
});

// --- API для сброса кодов ---
app.post('/api/reset', async (req, res) => {
  try {
    io.emit('code_reset_notification');
    log('Уведомление о сбросе состояния отправлено клиентам.');
    res.json({ success: true, message: 'Уведомление о сбросе состояния отправлено' });
  } catch (error) {
    log(`Ошибка при отправке уведомления о сбросе: ${error.message}`, 'error');
    res.status(500).json({ success: false, message: 'Ошибка при отправке уведомления о сбросе' });
  }
});

// --- API для проверки WebSocket соединения ---
app.get('/api/websocket-info', (req, res) => {
  const protocol = req.secure ? 'wss:' : 'ws:';
  const host = req.get('host');
  
  let websocketUrl;
  if (process.env.NODE_ENV !== 'production') {
    const wsHost = host.split(':')[0];
    websocketUrl = `${protocol}//${wsHost}:${process.env.YJS_PORT || 3001}`;
  } else {
    websocketUrl = `${protocol}//${host}/yjs`;
  }
  
  res.json({
    websocketUrl,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// --- Socket.IO логика ---
const onlineUsers = {};

io.on('connection', (socket) => {
  log(`Новое Socket.IO соединение: ${socket.id}`);

  let inactivityTimeout;

  // Функция для сброса таймера неактивности
  const resetInactivityTimeout = () => {
    if (inactivityTimeout) {
      clearTimeout(inactivityTimeout);
    }
    // Устанавливаем таймер на 30 минут (1800000 мс)
    inactivityTimeout = setTimeout(() => {
      log(`Пользователь ${socket.id} отключен по неактивности`);
      socket.disconnect(true);
    }, 1800000);
  };

  // Сброс таймера при любой активности
  socket.on('user_activity', resetInactivityTimeout);
  socket.on('cursor_moved', resetInactivityTimeout);
  
  // Инициализируем таймер при подключении
  resetInactivityTimeout();

  // Обработка авторизации пользователя в общей комнате
  socket.on('auth', (data, callback) => {
    try {
      const { userName } = data;
      
      if (!userName || userName.trim() === '') {
        return callback({ 
          success: false, 
          message: 'Имя пользователя не может быть пустым.' 
        });
      }

      // Сохраняем данные пользователя
      socket.userName = userName.trim();
      socket.roomName = 'main'; // Все пользователи в одной комнате
      
      // Присоединяем к общей комнате
      socket.join(socket.roomName);
      
      // Добавляем в список онлайн пользователей
      onlineUsers[socket.id] = {
        socketId: socket.id,
        userName: socket.userName,
        roomName: socket.roomName,
        joinedAt: new Date().toISOString()
      };

      log(`Пользователь ${socket.userName} авторизован в комнате ${socket.roomName}`);

      // Уведомляем всех пользователей в комнате о новом подключении
      const usersInRoom = Object.values(onlineUsers).filter(user => user.roomName === socket.roomName);
      io.to(socket.roomName).emit('online_users_count_updated', usersInRoom.length);

      // Отправляем подтверждение клиенту
      callback({ 
        success: true, 
        message: 'Авторизация успешна',
        roomName: socket.roomName,
        userName: socket.userName
      });

      resetInactivityTimeout();
    } catch (error) {
      log(`Ошибка при авторизации пользователя: ${error.message}`, 'error');
      callback({ success: false, message: 'Ошибка при авторизации' });
    }
  });

  // Обработка отключения пользователя
  socket.on('disconnect', (reason) => {
    log(`Пользователь отключился: ${socket.id}, причина: ${reason}`);
    
    if (inactivityTimeout) {
      clearTimeout(inactivityTimeout);
    }

    if (onlineUsers[socket.id]) {
      const userData = onlineUsers[socket.id];
      delete onlineUsers[socket.id];

      // Уведомляем остальных пользователей в комнате
      if (userData.roomName) {
        const usersInRoom = Object.values(onlineUsers).filter(user => user.roomName === userData.roomName);
        io.to(userData.roomName).emit('online_users_count_updated', usersInRoom.length);
        io.to(userData.roomName).emit('user_disconnected', {
          socketId: socket.id,
          userName: userData.userName,
          roomName: userData.roomName
        });
      }
    }
  });

  // Обработка активности пользователя
  socket.on('cursor_moved', (data) => {
    if (socket.roomName) {
      socket.to(socket.roomName).emit('cursor_moved', {
        ...data,
        socketId: socket.id,
        userName: socket.userName
      });
    }
    resetInactivityTimeout();
  });
});

// --- Настройка Yjs WebSocket сервера ---
let yWebSocketServer;

if (process.env.NODE_ENV !== 'production') {
  // В разработке создаем отдельный WebSocket сервер на порту 3001
  yWebSocketServer = new WebSocketServer({ port: process.env.YJS_PORT || 3001 });
  log('Режим разработки: Yjs WebSocket сервер на отдельном порту 3001');
} else {
  // В продакшене используем тот же HTTP сервер с путем /yjs
  yWebSocketServer = new WebSocketServer({ 
    server: httpServer,  // Используем тот же сервер
    path: '/yjs'         // Путь для Yjs WebSocket соединений
  });
  log('Режим продакшена: Yjs WebSocket сервер на том же порту с путем /yjs');
}

// Функция для получения или создания Yjs документа (используется в Yjs)
const getOrCreateDoc = (docName) => {
  // Возвращаем новый документ для каждого запроса
  // В продакшене здесь может быть логика персистентности
  return new Y.Doc();
};

yWebSocketServer.on('connection', (websocket, request) => {
  const url = new URL(request.url, `ws://${request.headers.host}`);
  const docName = url.searchParams.get('doc') || 'main';
  
  log(`Новое Yjs WebSocket соединение для документа: ${docName}`);
  
  setupWSConnection(websocket, request, {
    docName,
    gc: true, // Включаем сборку мусора
    getDoc: getOrCreateDoc
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  log(`HTTP сервер запущен на порту ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    log(`Yjs WebSocket сервер запущен на отдельном порту ${process.env.YJS_PORT || 3001}`);
  } else {
    log(`Yjs WebSocket сервер запущен на том же порту с путем /yjs`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('Получен сигнал SIGTERM, завершаем работу сервера...');
  httpServer.close(() => {
    log('HTTP сервер закрыт');
    yWebSocketServer.close(() => {
      log('Yjs WebSocket сервер закрыт');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  log('Получен сигнал SIGINT, завершаем работу сервера...');
  httpServer.close(() => {
    log('HTTP сервер закрыт');
    yWebSocketServer.close(() => {
      log('Yjs WebSocket сервер закрыт');
      process.exit(0);
    });
  });
});