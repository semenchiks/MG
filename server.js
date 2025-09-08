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

// Явная отдача исходного файла code.txt (нужен для начальной инициализации редакторов)
// В production статическая раздача идет из dist, где этого файла нет
app.get('/code.txt', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    // Отдаем файл из корня проекта
    res.sendFile(path.join(__dirname, 'code.txt'));
  } catch (e) {
    log(`Ошибка при отдаче code.txt: ${e.message}`, 'error');
    res.status(404).send('code.txt not found');
  }
});

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

// Все остальные запросы также ведут на редактор (SPA fallback)
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

// --- Socket.IO логика ---
const onlineUsers = {};

io.on('connection', (socket) => {
  log(`Новое Socket.IO соединение: ${socket.id}`);

  let inactivityTimeout;

  // --- Yjs обработчики (только в продакшене) ---
  if (process.env.NODE_ENV === 'production') {
    // Хранилище Yjs документов (объявляем здесь для доступности)
    if (!global.yjsDocs) {
      global.yjsDocs = new Map();
    }
    
    // Получение или создание Yjs документа
    const getOrCreateYjsDoc = (docName) => {
      if (!global.yjsDocs.has(docName)) {
        const doc = new Y.Doc();
        global.yjsDocs.set(docName, doc);
        log(`Создан новый Yjs документ: ${docName}`);
      }
      return global.yjsDocs.get(docName);
    };

    socket.on('yjs-sync', (data) => {
      try {
        const { docName, update } = data;
        const doc = getOrCreateYjsDoc(docName);
        
        // Применяем обновление к документу
        if (update) {
          Y.applyUpdate(doc, new Uint8Array(update));
        }
        
        // Отправляем состояние документа клиенту
        const state = Y.encodeStateAsUpdate(doc);
        socket.emit('yjs-sync', {
          docName,
          state: Array.from(state)
        });
        
        // Транслируем обновления другим клиентам в той же комнате
        socket.to(docName).emit('yjs-update', {
          docName,
          update: Array.from(update || [])
        });
        
      } catch (error) {
        log(`Ошибка Yjs синхронизации: ${error.message}`, 'error');
      }
    });
    
    socket.on('yjs-join', (docName) => {
      socket.join(docName);
      log(`Socket ${socket.id} присоединился к Yjs документу: ${docName}`);
      
      // Отправляем текущее состояние документа
      const doc = getOrCreateYjsDoc(docName);
      const state = Y.encodeStateAsUpdate(doc);
      socket.emit('yjs-sync', {
        docName,
        state: Array.from(state)
      });
    });

    socket.on('yjs-awareness', (data) => {
      try {
        const { docName, states, removed } = data;
        
        // Транслируем awareness обновления другим клиентам в той же комнате
        socket.to(docName).emit('yjs-awareness', {
          docName,
          states,
          removed
        });
        
        log(`Yjs awareness обновление для документа ${docName}`);
      } catch (error) {
        log(`Ошибка Yjs awareness: ${error.message}`, 'error');
      }
    });
  }

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

// --- Единый Yjs WebSocket сервер (для dev и prod) на том же HTTP-порте ---
let yWebSocketServer = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url, `ws://${request.headers.host}`);
    // Разрешаем /yjs и /yjs/* (напр. /yjs/main)
    if (!(url.pathname === '/yjs' || url.pathname.startsWith('/yjs/'))) {
      socket.destroy();
      return;
    }

    yWebSocketServer.handleUpgrade(request, socket, head, (websocket) => {
      const pathDoc = url.pathname.split('/').filter(Boolean)[1];
      const docName = pathDoc || url.searchParams.get('doc') || 'main';
      log(`Yjs WebSocket upgrade для документа: ${docName}`);
      setupWSConnection(websocket, request, {
        docName,
        gc: true
        // Хранилище документов ведется внутри @y/websocket-server
      });
    });
  } catch (error) {
    log(`Ошибка upgrade WebSocket: ${error.message}`, 'error');
    socket.destroy();
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  log(`HTTP сервер запущен на порту ${PORT}`);
  log(`Доступен по адресу: http://localhost:${PORT}`);
  
  // Показываем локальный IP для подключения из сети
  import('os').then(({ networkInterfaces }) => {
    const addresses = [];
    for (const interfaceName in networkInterfaces()) {
      for (const iface of networkInterfaces()[interfaceName]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(iface.address);
        }
      }
    }
    
    if (addresses.length > 0) {
      log(`Доступен в локальной сети:`);
      addresses.forEach(addr => {
        log(`  http://${addr}:${PORT}`);
      });
    }
  });
  
  log(`Yjs WebSocket endpoint доступен по пути /yjs на том же порту ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('Получен сигнал SIGTERM, завершаем работу сервера...');
  httpServer.close(() => {
    log('HTTP сервер закрыт');
    try {
      yWebSocketServer.close(() => {
        log('Yjs WebSocket сервер закрыт');
        process.exit(0);
      });
    } catch {
      process.exit(0);
    }
  });
});

process.on('SIGINT', () => {
  log('Получен сигнал SIGINT, завершаем работу сервера...');
  httpServer.close(() => {
    log('HTTP сервер закрыт');
    try {
      yWebSocketServer.close(() => {
        log('Yjs WebSocket сервер закрыт');
        process.exit(0);
      });
    } catch {
      process.exit(0);
    }
  });
});