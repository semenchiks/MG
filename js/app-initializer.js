import { SocketService } from './socket-service.js';
import CodeEditorManager from './code-editor-manager.js';
import { AuthModal } from './auth-modal.js';
import { EditorUI } from './editor-ui.js';
import { setupGlobalCursors } from './cursor-overlay.js';

/**
 * Класс для инициализации всех компонентов приложения
 */
export class AppInitializer {
    /**
     * Конструктор класса AppInitializer
     */
    constructor() {
        this.socketService = null;
        this.codeEditorManager = null;
        this.authModal = null;
        this.editorUI = null;
        this.previewFrame = null;
        this.lastHtml = '';
        this.lastCss = '';
        this.previewUpdateTimeout = null;
    }

    /**
     * Инициализация всех компонентов приложения
     */
    init() {
        console.log('[AppInitializer] Начало инициализации приложения...');

        try {
            // Инициализируем сервисы в правильном порядке
            this._initSocketService();
            this._initAuthModal();
            this._initEditorUI();
            this._initPreviewFrame();
            this._subscribeToSocketEvents();
            
            console.log('[AppInitializer] Приложение успешно инициализировано (CodeEditorManager будет инициализирован после Yjs)');
        } catch (error) {
            console.error('[AppInitializer] Ошибка при инициализации приложения:', error);
            this._showError('Ошибка инициализации приложения. Попробуйте перезагрузить страницу.');
        }
    }

    /**
     * Инициализация сокет сервиса
     * @private
     */
    _initSocketService() {
        console.log('[AppInitializer] Инициализация SocketService...');
        this.socketService = new SocketService();
        
        // Делаем сервис глобально доступным для других компонентов
        window.socketService = this.socketService;
        
        // Настраиваем счетчик пользователей
        if (window.setupOnlineUsersCounter) {
            window.setupOnlineUsersCounter();
            console.log('[AppInitializer] Счетчик пользователей настроен');
        }
        
        console.log('[AppInitializer] SocketService инициализирован');
    }

    /**
     * Инициализация менеджера редакторов кода
     * @private
     */
    _initCodeEditorManager() {
        console.log('[AppInitializer] Инициализация CodeEditorManager...');
        
        this.codeEditorManager = new CodeEditorManager(this.socketService);
        const success = this.codeEditorManager.initCodeEditors();
        
        if (success) {
            // Обновляем ссылки в уже созданных объектах
            if (this.editorUI) {
                this.editorUI.codeEditorManager = this.codeEditorManager;
            }
            if (this.authModal) {
                this.authModal.codeEditorManager = this.codeEditorManager;
            }
            
            console.log('[AppInitializer] CodeEditorManager инициализирован и ссылки обновлены');
        } else {
            console.error('[AppInitializer] Ошибка инициализации CodeEditorManager');
        }
    }

    /**
     * Инициализация модального окна авторизации
     * @private
     */
    _initAuthModal() {
        console.log('[AppInitializer] Инициализация AuthModal...');
        
        this.authModal = new AuthModal(this.socketService, null);
        
        console.log('[AppInitializer] AuthModal инициализирован');
    }

    /**
     * Инициализация UI редактора
     * @private
     */
    _initEditorUI() {
        console.log('[AppInitializer] Инициализация EditorUI...');
        
        this.editorUI = new EditorUI(null, this);
        this.editorUI.init();
        
        console.log('[AppInitializer] EditorUI инициализирован');
    }

    /**
     * Инициализация фрейма предварительного просмотра
     * @private
     */
    _initPreviewFrame() {
        console.log('[AppInitializer] Инициализация preview frame...');
        
        this.previewFrame = document.getElementById('output');
        if (!this.previewFrame) {
            console.warn('[AppInitializer] Preview frame не найден');
            return;
        }

        this._checkAndUpdatePreview();
        console.log('[AppInitializer] Preview frame инициализирован');
    }

    /**
     * Проверка и обновление предварительного просмотра
     * @private
     */
    _checkAndUpdatePreview() {
        if (!this.codeEditorManager) return;

        const currentHtml = this.codeEditorManager.htmlEditor?.getValue() || '';
        const currentCss = this.codeEditorManager.cssEditor?.getValue() || '';

        if (currentHtml !== this.lastHtml || currentCss !== this.lastCss) {
            this.lastHtml = currentHtml;
            this.lastCss = currentCss;
            this._updatePreview();
        }
    }

    /**
     * Подписка на события сокет сервиса
     * @private
     */
    _subscribeToSocketEvents() {
        console.log('[AppInitializer] Подписка на события SocketService...');

        // Инициализация CodeEditorManager после готовности Yjs
        this.socketService.onCodeInitialized(() => {
            console.log('[AppInitializer] Yjs готов, инициализируем CodeEditorManager...');
            this._initCodeEditorManager();
            // Инициализируем глобальные курсоры после готовности Yjs
            this._initGlobalCursors();
        });

        // Обновление HTML и CSS теперь обрабатывается в CodeEditorManager
        this.socketService.onHtmlUpdated((content, source) => {
            console.log('[AppInitializer] HTML обновлен от', source);
        });

        this.socketService.onCssUpdated((content, source) => {
            console.log('[AppInitializer] CSS обновлен от', source);
        });

        // Показ основного контейнера после авторизации
        this.socketService.onAuth((data) => {
            if (data.success) {
                console.log('[AppInitializer] Успешная авторизация, показываем редактор');
                this._showMainContainerAfterAuth();
                
                // Временно инициализируем курсоры сразу после авторизации
                setTimeout(() => {
                    console.log('[AppInitializer] Пробуем инициализировать курсоры после авторизации...');
                    this._initGlobalCursors();
                }, 1000);
            }
        });

        // Обработка сброса кода
        this.socketService.onCodeReset(() => {
            console.log('[AppInitializer] Получено уведомление о сбросе кода');
            if (this.codeEditorManager) {
                this.codeEditorManager.htmlEditor?.setValue('');
                this.codeEditorManager.cssEditor?.setValue('');
                // Предпросмотр обновится автоматически через обработчики изменений редактора
            }
        });

        console.log('[AppInitializer] Подписка на события завершена');
    }

    /**
     * Показ основного контейнера после авторизации
     * @private
     */
    _showMainContainerAfterAuth() {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = 'flex';
        }

        // Скрываем модальное окно авторизации
        const loginModal = document.getElementById('login-form-modal');
        if (loginModal) {
            loginModal.style.display = 'none';
        }

        // Предпросмотр будет обновлен автоматически когда CodeEditorManager инициализируется
    }

    /**
     * Обновление предварительного просмотра
     * @param {boolean} force - Принудительное обновление
     * @param {boolean} isLocalChange - Изменение сделано локально
     * @private
     */
    _updatePreview(force = false, isLocalChange = false) {
        if (!this.previewFrame || !this.codeEditorManager) return;

        // Очищаем предыдущий таймаут
        if (this.previewUpdateTimeout) {
            clearTimeout(this.previewUpdateTimeout);
        }

        // Задержка для оптимизации производительности
        const delay = isLocalChange ? 300 : 100;
        
        this.previewUpdateTimeout = setTimeout(() => {
            this._performPreviewUpdate();
        }, delay);
    }

    /**
     * Выполнение обновления предварительного просмотра
     * @private
     */
    _performPreviewUpdate() {
        try {
            const html = this.codeEditorManager?.htmlEditor?.getValue() || '';
            const css = this.codeEditorManager?.cssEditor?.getValue() || '';

            // Создаем полную HTML структуру
            const fullHtml = this._getDocStructure(html, css);

            // Создаем blob URL для iframe
            const blob = new Blob([fullHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);

            // Очищаем предыдущий URL если есть
            if (this.previewFrame.src && this.previewFrame.src.startsWith('blob:')) {
                URL.revokeObjectURL(this.previewFrame.src);
            }

            // Устанавливаем новый URL
            this.previewFrame.src = url;

            // Очищаем URL через некоторое время для освобождения памяти
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);

        } catch (error) {
            console.error('[AppInitializer] Ошибка при обновлении превью:', error);
        }
    }

    /**
     * Создание полной HTML структуры документа
     * @param {string} html - HTML код
     * @param {string} css - CSS код
     * @returns {string} - Полная HTML структура
     * @private
     */
    _getDocStructure(html, css) {
        return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Предварительный просмотр</title>
    <style>
        ${css}
    </style>
</head>
<body>
    ${html}
</body>
</html>`;
    }

    /**
     * Показ ошибки пользователю
     * @param {string} message - Сообщение об ошибке
     * @private
     */
    _showError(message) {
        console.error('[AppInitializer]', message);
        
        // Показываем простое уведомление
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            alert(message);
        }
    }

    /**
     * Инициализация глобальных курсоров
     * @private
     */
    _initGlobalCursors() {
        console.log('[AppInitializer] Попытка инициализации глобальных курсоров...');
        console.log('[AppInitializer] socketService:', !!this.socketService);
        console.log('[AppInitializer] yAwareness:', !!this.socketService?.yAwareness);
        console.log('[AppInitializer] yDoc:', !!this.socketService?.yDoc);
        
        if (this.socketService && this.socketService.yAwareness && this.socketService.yDoc) {
            const localClientID = this.socketService.yDoc.clientID;
            console.log('[AppInitializer] Инициализация глобальных курсоров, localClientID:', localClientID);
            
            // Настраиваем отображение курсоров
            setupGlobalCursors(this.socketService.yAwareness, localClientID);
            
            // Добавляем отслеживание движения мыши по всей странице
            this._setupMouseTracking();
            
            console.log('[AppInitializer] Глобальные курсоры инициализированы');
        } else {
            console.warn('[AppInitializer] Не удалось инициализировать курсоры - отсутствуют необходимые объекты');
        }
    }

    /**
     * Настройка отслеживания движения мыши
     * @private
     */
    _setupMouseTracking() {
        let lastMouseUpdate = 0;
        let mouseUpdateTimeout;
        
        document.addEventListener('mousemove', (event) => {
            const now = Date.now();
            
            // Ограничиваем до ~60fps (16мс между обновлениями) для плавности
            if (now - lastMouseUpdate < 16) {
                clearTimeout(mouseUpdateTimeout);
                mouseUpdateTimeout = setTimeout(() => {
                    this._updateMousePosition(event.clientX, event.clientY);
                }, 16 - (now - lastMouseUpdate));
                return;
            }
            
            lastMouseUpdate = now;
            this._updateMousePosition(event.clientX, event.clientY);
        });

        console.log('[AppInitializer] Отслеживание мыши настроено (60fps)');
    }

    /**
     * Обновление позиции мыши в Yjs Awareness
     * @param {number} x - X координата
     * @param {number} y - Y координата
     * @private
     */
    _updateMousePosition(x, y) {
        if (this.socketService && this.socketService.yAwareness) {
            // Ограничиваем логи (показываем только каждое 100-е обновление)
            if (Math.random() < 0.01) {
                console.log('[AppInitializer] Обновляем позицию мыши:', { x, y });
            }
            
            this.socketService.yAwareness.setLocalStateField('mouse', {
                x: x,
                y: y,
                timestamp: Date.now()
            });
            
            // Проверим, что данные установились (редко)
            if (Math.random() < 0.005) {
                const localState = this.socketService.yAwareness.getLocalState();
                console.log('[AppInitializer] Локальное состояние после обновления:', localState);
            }
        }
    }
}