// socket-service.js
// Модуль для работы с Socket.io

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as awarenessProtocol from 'y-protocols/awareness.js';

import {
    throttle,
    debounce,
    showNotification,
    retryOperation,
    safeJSONParse
} from './utils.js';

/**
 * Оптимизированная функция логирования
 * @param {string} message - Сообщение для логирования
 * @param {string} level - Уровень логирования (info, warn, error)
 */
function log(message, level = 'info') {
    const isProd = window.location.hostname !== 'localhost';
    if (isProd && level !== 'error' && level !== 'warn') return;

    switch (level) {
        case 'error':
            console.error(`[SocketService] ${message}`);
            break;
        case 'warn':
            console.warn(`[SocketService] ${message}`);
            break;
        default:
            console.log(`[SocketService] ${message}`);
    }
}

/**
 * Генерирует случайный HEX-цвет на основе строки (например, имени пользователя)
 * @param {string} str - Входная строка
 * @returns {string} - HEX-цвет
 */
function getRandomColorFromString(str) {
    if (!str) str = 'default';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - color.length) + color;
}

/**
 * Класс для работы с сокетами и Yjs
 */
export class SocketService {
    /**
     * Конструктор класса SocketService
     */
    constructor() {
        this.socket = null;
        this.roomName = 'main'; // Всегда одна общая комната
        this.userName = '';

        this.reconnectionAttempts = 0;
        this.maxReconnectionAttempts = 5;
        this.reconnectionDelay = 1000;
        this.isReconnecting = false;

        this.authListeners = [];
        this.onlineUsersCountListeners = [];
        this.codeInitializedListeners = [];
        this.codeResetListeners = [];
        this.htmlUpdatedListeners = [];
        this.cssUpdatedListeners = [];
        this.cursorMovedListeners = [];
        this.userDisconnectedListeners = [];
        this.yjsSyncedListeners = [];

        // --- Yjs Свойства ---
        this.yDoc = null;
        this.yTextHtml = null;
        this.yTextCss = null;
        this.yWebsocketProvider = null;
        this.yAwareness = null;

        // Флаги для отслеживания программных обновлений
        this.isProgrammaticallyUpdatingHtml = false;
        this.isProgrammaticallyUpdatingCss = false;

        this.pendingAuthorizationData = null;

        this.init();
    }

    /**
     * Инициализация Socket.IO клиента
     */
    init() {
        try {
            if (typeof io === 'undefined') {
                log('Socket.io (клиент) не загружен.', 'error');
                this.handleConnectionError();
                return;
            }

            // Определяем URL сервера в зависимости от окружения
            const serverUrl = this._getServerUrl();
            log(`Socket.IO: Подключение к серверу: ${serverUrl}`);
            
            this.socket = io(serverUrl, {
                reconnectionAttempts: this.maxReconnectionAttempts,
                reconnectionDelay: this.reconnectionDelay,
            });

            this._initSocketEventListeners();
            log('Socket.IO клиент инициализирован');
        } catch (error) {
            log(`Ошибка при инициализации Socket.IO клиента: ${error.message}`, 'error');
            this.handleConnectionError();
        }
    }

    /**
     * Настраивает обработчики событий Socket.IO
     * @private
     */
    _initSocketEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            log('Socket.IO соединение установлено.');
            this.isReconnecting = false;
            this.reconnectionAttempts = 0;
            this._sendPendingAuthRequest();
        });

        this.socket.on('disconnect', (reason) => {
            log(`Socket.IO соединение потеряно: ${reason}.`, 'warn');
            this._handleSocketIODisconnect(reason);
        });

        this.socket.on('connect_error', (error) => {
            log(`Ошибка соединения Socket.IO: ${error.message}`, 'error');
            this.handleConnectionError();
        });

        this.socket.on('online_users_count_updated', (count) => {
            log(`Socket.IO: Количество онлайн пользователей обновлено: ${count}`);
            this.onlineUsersCountListeners.forEach(listener => listener(count));
        });

        this.socket.on('user_disconnected', (data) => {
            log(`Socket.IO: Пользователь ${data.userName} отключился.`);
            this.userDisconnectedListeners.forEach(listener => listener(data));
        });

        this.socket.on('code_reset_notification', () => {
            log('Получено уведомление о сбросе кода с сервера (Socket.IO).');
            showNotification('Внимание! Код был сброшен к начальному состоянию другим пользователем.', 'warning', 10000);
            this.codeResetListeners.forEach(listener => listener());
            if (this.yWebsocketProvider) {
                log('Переподключаемся к Yjs документу после сброса...');
                this.yWebsocketProvider.disconnect();
                setTimeout(() => {
                    this._initYjsConnection(this.roomName, true);
                }, 500);
            }
        });
    }

    /**
     * Обработка отключения Socket.IO
     * @private
     */
    _handleSocketIODisconnect(reason) {
        if (this.yWebsocketProvider && this.yWebsocketProvider.wsconnected) {
            this.yWebsocketProvider.disconnect();
            log('Yjs WebsocketProvider отключен из-за разрыва основного Socket.IO соединения.', 'warn');
        }
        
        if (reason === 'io server disconnect') {
             log('Socket.IO соединение разорвано сервером.', 'warn');
        } else {
             log('Socket.IO пытается переподключиться...', 'info');
        }
    }

    /**
     * Получить URL сервера
     * @private
     */
    _getServerUrl() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `http://localhost:${window.location.port || 3000}`;
        } else {
            return window.location.origin;
        }
    }

    /**
     * Получить WebSocket URL для Yjs
     * @private
     */
    _getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `${protocol}//${window.location.hostname}:3001`;
        } else {
            // В продакшене Render использует один домен для всех портов
            // Но нужно использовать порт 10001 для WebSocket
            const host = window.location.hostname;
            const port = window.location.port ? ':10001' : ':10001';
            return `${protocol}//${host}${port}`;
        }
    }

    /**
     * Обработка ошибки соединения
     */
    handleConnectionError() {
        if (this.isReconnecting) return;
        
        this.isReconnecting = true;
        this.reconnectionAttempts++;
        
        if (this.reconnectionAttempts <= this.maxReconnectionAttempts) {
            const delay = this.reconnectionDelay * Math.pow(2, this.reconnectionAttempts - 1);
            log(`Попытка переподключения ${this.reconnectionAttempts}/${this.maxReconnectionAttempts} через ${delay}ms`, 'warn');
            
            setTimeout(() => {
                this.init();
            }, delay);
        } else {
            log('Превышено максимальное количество попыток переподключения', 'error');
            showNotification('Ошибка соединения. Пожалуйста, перезагрузите страницу.', 'error', 10000);
            this.isReconnecting = false;
        }
    }

    /**
     * Инициализация Yjs соединения
     * @private
     */
    _initYjsConnection(roomName, isReset = false) {
        try {
            if (this.yWebsocketProvider) {
                this.yWebsocketProvider.destroy();
            }

            this.yDoc = new Y.Doc();
            this.yTextHtml = this.yDoc.getText('html');
            this.yTextCss = this.yDoc.getText('css');

            const wsUrl = this._getWebSocketUrl();
            log(`Yjs: Подключение к WebSocket серверу: ${wsUrl} для документа: ${roomName}`);

            this.yWebsocketProvider = new WebsocketProvider(wsUrl, roomName, this.yDoc, {
                connect: true,
                awareness: new awarenessProtocol.Awareness(this.yDoc),
                maxBackoffTime: 5000,
                params: { doc: roomName }
            });

            this.yAwareness = this.yWebsocketProvider.awareness;

            // Обработчики событий Yjs
            this.yTextHtml.observe((event, transaction) => {
                if (!this.isProgrammaticallyUpdatingHtml) {
                    const content = this.yTextHtml.toString();
                    this.htmlUpdatedListeners.forEach(listener => listener(content, 'yjs'));
                }
            });

            this.yTextCss.observe((event, transaction) => {
                if (!this.isProgrammaticallyUpdatingCss) {
                    const content = this.yTextCss.toString();
                    this.cssUpdatedListeners.forEach(listener => listener(content, 'yjs'));
                }
            });

            this._initYAwareness();

            // Обработчик синхронизации
            this.yWebsocketProvider.on('sync', (isSynced) => {
                if (isSynced) {
                    log('Yjs: Документ синхронизирован');
                    const syncData = {
                        htmlLength: this.yTextHtml.length,
                        cssLength: this.yTextCss.length,
                        isReset
                    };
                    this.yjsSyncedListeners.forEach(listener => listener(syncData));
                    this.codeInitializedListeners.forEach(listener => listener());
                }
            });

            log('Yjs соединение инициализировано');
        } catch (error) {
            log(`Ошибка при инициализации Yjs: ${error.message}`, 'error');
        }
    }

    /**
     * Инициализация Yjs Awareness
     * @private
     */
    _initYAwareness() {
        if (!this.yAwareness) return;

        const localClientID = this.yDoc.clientID;

        // Устанавливаем данные текущего пользователя
        this.yAwareness.setLocalStateField('user', {
            name: this.userName || 'Пользователь',
            color: getRandomColorFromString(this.userName || 'default'),
            colorLight: getRandomColorFromString(this.userName || 'default') + '40'
        });

        // Отслеживаем изменения в awareness
        this.yAwareness.on('change', (changes) => {
            const states = Array.from(this.yAwareness.getStates().entries());
            const onlineCount = states.length;
            
            // Обновляем счетчик пользователей
            this.onlineUsersCountListeners.forEach(listener => listener(onlineCount));

            // Обрабатываем курсоры - исправляем логику
            changes.added.forEach(clientID => {
                if (clientID !== localClientID) {
                    const state = this.yAwareness.getStates().get(clientID);
                    if (state && state.cursor) {
                        this.cursorMovedListeners.forEach(listener => listener({
                            clientID,
                            cursor: state.cursor,
                            user: state.user
                        }));
                    }
                }
            });

            changes.updated.forEach(clientID => {
                if (clientID !== localClientID) {
                    const state = this.yAwareness.getStates().get(clientID);
                    if (state && state.cursor) {
                        this.cursorMovedListeners.forEach(listener => listener({
                            clientID,
                            cursor: state.cursor,
                            user: state.user
                        }));
                    }
                }
            });
        });

        log('Yjs Awareness инициализирован');
    }

    /**
     * Обновление позиции курсора
     */
    updateCursorAndSelection(cursorData) {
        if (this.yAwareness) {
            this.yAwareness.setLocalStateField('cursor', cursorData);
        }
    }

    /**
     * Отправка отложенного запроса авторизации
     * @private
     */
    _sendPendingAuthRequest() {
        if (this.pendingAuthorizationData) {
            log('Отправка отложенного запроса авторизации...');
            const { userName, callback } = this.pendingAuthorizationData;
            this.pendingAuthorizationData = null;
            this._performAuthorization(userName, callback);
        }
    }

    /**
     * Авторизация пользователя
     * @param {string} userName - Имя пользователя
     * @param {Function} callback - Функция обратного вызова
     */
    authorize(userName, callback) {
        log(`Попытка авторизации: пользователь "${userName}"`);

        if (!this.socket || !this.socket.connected) {
            log('Socket.IO не подключен, сохраняем запрос авторизации...');
            this.pendingAuthorizationData = { userName, callback };
            return;
        }

        this._performAuthorization(userName, callback);
    }

    /**
     * Выполнение авторизации
     * @private
     */
    _performAuthorization(userName, callback) {
        const authCallback = (response) => {
            if (response.success) {
                log(`Авторизация успешна: ${response.userName} в комнате ${response.roomName}`);
                
                this.userName = response.userName;
                this.roomName = response.roomName;

                // Инициализируем Yjs соединение
                this._initYjsConnection(this.roomName);

                // Уведомляем слушателей о успешной авторизации
                this.authListeners.forEach(listener => listener({
                    success: true,
                    userName: this.userName,
                    roomName: this.roomName
                }));
            } else {
                log(`Ошибка авторизации: ${response.message}`, 'error');
            }

            if (callback) {
                callback(response);
            }
        };

        // Отправляем запрос авторизации
        this.socket.emit('auth', { userName }, authCallback);
    }

    /**
     * Инициализация кода (уведомление слушателей)
     */
    initializeCode() {
        this.codeInitializedListeners.forEach(listener => listener());
    }

    /**
     * Получить имя комнаты
     */
    getTeamName() {
        return this.roomName;
    }

    /**
     * Получить имя пользователя
     */
    getUserName() {
        return this.userName;
    }

    // Методы для подписки на события
    onCodeInitialized(listener) { this.codeInitializedListeners.push(listener); }
    onCodeReset(listener) { this.codeResetListeners.push(listener); }
    onAuth(listener) { this.authListeners.push(listener); }
    onOnlineUsersCount(listener) { this.onlineUsersCountListeners.push(listener); }
    onUserDisconnected(listener) { this.userDisconnectedListeners.push(listener); }
    onHtmlUpdated(listener) { this.htmlUpdatedListeners.push(listener); }
    onCssUpdated(listener) { this.cssUpdatedListeners.push(listener); }
    onCursorMoved(listener) { this.cursorMovedListeners.push(listener); }
    onYjsSynced(listener) { this.yjsSyncedListeners.push(listener); }

    // Методы для получения Yjs объектов
    getYDoc() { return this.yDoc; }
    getYTextHtml() { return this.yTextHtml; }
    getYTextCss() { return this.yTextCss; }
    getYAwareness() { return this.yAwareness; }

    /**
     * Проверка авторизации
     */
    isAuthorized() {
        return !!(this.socket && this.socket.connected && this.userName && this.roomName);
    }
}

export default SocketService;