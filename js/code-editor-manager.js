import { CodeEditor } from './code-editor.js';
import { MonacoBinding } from 'y-monaco';


/**
 * Логирующая функция
 * @param {string} message Сообщение для логирования
 * @param {string} level Уровень логирования
 * @returns {void}
 */
function log(message, level = 'info') {
    const isProd = window.location.hostname !== 'localhost';
    // В продакшене логируем только ошибки
    if (isProd && level !== 'error') return;

    switch (level) {
        case 'error':
            console.error(`[CodeEditor] ${message}`);
            break;
        case 'warn':
            console.warn(`[CodeEditor] ${message}`);
            break;
        default:
            console.log(`[CodeEditor] ${message}`);
    }
}

/**
 * Класс для управления редакторами кода
 */
class CodeEditorManager {
    /**
     * Конструктор класса CodeEditorManager
     * @param {SocketService} socketService Сервис для работы с сокетами
     */
    constructor(socketService) {
        this.socketService = socketService;
        this.htmlEditor = null;
        this.cssEditor = null;
        this.editorUI = null;
        this.isInitialized = false;

        // --- Yjs Свойства (полученные от SocketService) ---
        this.yTextHtml = null;
        this.yTextCss = null;
        this.yAwareness = null;
        this.htmlBinding = null; // Для хранения экземпляра MonacoBinding
        this.cssBinding = null;  // Для хранения экземпляра MonacoBinding
        // -------------------------------------------------
    }

    /**
     * Инициализация редакторов кода
     * @returns {boolean} Успешность инициализации
     */
    initCodeEditors() {
        try {
            // Получаем Yjs объекты от SocketService
            // Это должно происходить после того, как SocketService их инициализировал (после авторизации)
            this.yTextHtml = this.socketService.getYTextHtml();
            this.yTextCss = this.socketService.getYTextCss();
            this.yAwareness = this.socketService.getYAwareness();

            if (!this.yTextHtml || !this.yTextCss || !this.yAwareness) {
                log('Yjs объекты (yTextHtml, yTextCss, yAwareness) не получены от SocketService. Редакторы не могут быть связаны с Yjs.', 'error');
                // Можно показать уведомление пользователю или попытаться получить их позже
                // Для простоты пока выходим, но в реальном приложении нужна более надежная обработка.
                // Возможно, initCodeEditors должен вызываться только после события yjsReady от SocketService.
                return false; 
            }

            // Инициализация редактора HTML с использованием Monaco
            this.htmlEditor = new CodeEditor('html-code', 'html', {
                onChange: (value) => this._handleHtmlChange(value),
                onCursorPositionChange: (editorType, position, selection) => this._handleCursorOrSelectionChange(editorType, position, selection)
            });

            // Инициализация редактора CSS с использованием Monaco
            this.cssEditor = new CodeEditor('css-code', 'css', {
                onChange: (value) => this._handleCssChange(value),
                onCursorPositionChange: (position, selection) => this._handleCursorOrSelectionChange('css', position, selection)
            });

            // Явно инициализируем Monaco редакторы после создания экземпляров CodeEditor
            if (this.htmlEditor) {
                this.htmlEditor.initMonacoEditor();
            }
            if (this.cssEditor) {
                this.cssEditor.initMonacoEditor();
            }

            // --- Привязка редакторов к Yjs документам через y-monaco ---
            if (this.htmlEditor && this.htmlEditor.editor && this.yTextHtml && this.yAwareness) {
                this.htmlBinding = new MonacoBinding(
                    this.yTextHtml, 
                    this.htmlEditor.editor.getModel(), 
                    new Set([this.htmlEditor.editor]), 
                    this.yAwareness
                );
                log('HTML редактор успешно связан с Yjs (y-monaco).');
            } else {
                log('Не удалось связать HTML редактор с Yjs: один из компонентов отсутствует.', 'error');
            }

            if (this.cssEditor && this.cssEditor.editor && this.yTextCss && this.yAwareness) {
                this.cssBinding = new MonacoBinding(
                    this.yTextCss, 
                    this.cssEditor.editor.getModel(), 
                    new Set([this.cssEditor.editor]), 
                    this.yAwareness
                );
                log('CSS редактор успешно связан с Yjs (y-monaco).');
            } else {
                log('Не удалось связать CSS редактор с Yjs: один из компонентов отсутствует.', 'error');
            }
            // ---------------------------------------------------------

            // Настройка обработчиков событий
            this._setupEventHandlers();

            // Добавляем обработчик для динамической стилизации курсоров
            this._setupDynamicCursorStyles();

            // Инициализация UI редактора (если необходимо)
            // Примечание: для Monaco может потребоваться другой подход к UI
            // this.editorUI = new EditorUI(this.htmlEditor, this.cssEditor);

            // Обновляем код
            this._refreshEditors();

            this.isInitialized = true;
            log('Редакторы кода успешно инициализированы с использованием Monaco');
            return true;
        } catch (error) {
            log(`Ошибка при инициализации редакторов кода: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Настройка обработчиков событий
     * @private
     */
    _setupEventHandlers() {
        // Обработчик изменения размера окна
        window.addEventListener('resize', () => {
            this._refreshEditors();
        });

        /* // Удаляем подписки, так как Yjs + MonacoBinding сами обновляют редакторы,
           // а _handleHtmlChange/_handleCssChange вызываются при любом изменении (локальном или удаленном)
           // и обновляют предпросмотр.
        // Подписываемся на события обновления от SocketService (которые приходят от Yjs)
        this.socketService.onHtmlUpdated(data => {
            if (data.isRemote) { // Обновляем предпросмотр только если изменения удаленные
                log('CodeEditorManager: Получено удаленное обновление HTML от SocketService(Yjs). Обновляем предпросмотр.');
                this._updateResult(); 
            }
        });

        this.socketService.onCssUpdated(data => {
            if (data.isRemote) { // Обновляем предпросмотр только если изменения удаленные
                log('CodeEditorManager: Получено удаленное обновление CSS от SocketService(Yjs). Обновляем предпросмотр.');
                this._updateResult();
            }
        });
        */
        
        // Обработка входящих курсоров (отображение управляется y-monaco через Awareness)
        // this.socketService.onCursorMoved(cursorInfo => {
        //     // y-monaco должен сам отображать курсоры других пользователей.
        //     // Здесь можно добавить дополнительную логику, если нужно (например, отображение списка пользователей).
        //     log(`CodeEditorManager: Получена информация о курсоре от пользователя ${cursorInfo.userName} (ID: ${cursorInfo.clientId})`, 'info');
        //     // Пример: this.displayRemoteCursor(cursorInfo.editorType, cursorInfo.cursorData, cursorInfo.userName, cursorInfo.clientId);
        // });

        // Код для полноэкранного режима удален
    }

    /**
     * Настраивает динамическое создание CSS-стилей для курсоров y-monaco.
     * @private
     */
    _setupDynamicCursorStyles() {
        if (!this.yAwareness) {
            log('Yjs Awareness не инициализирован, динамические стили курсоров не могут быть настроены.', 'warn');
            return;
        }

        const styleTagId = 'y-monaco-custom-cursor-styles';
        let styleTag = document.getElementById(styleTagId);
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleTagId;
            styleTag.type = 'text/css';
            document.head.appendChild(styleTag);
        }

        const updateStyles = () => {
            if (!this.yAwareness) return;
            const states = this.yAwareness.getStates(); // Map<clientID, state>
            const localClientID = this.yAwareness.clientID;
            let cssString = '';

            states.forEach((state, clientID) => {
                if (clientID === localClientID) return; // Не стилизуем свой курсор таким образом

                if (state.user && state.user.name && state.user.color) {
                    const userName = state.user.name.replace(/['"]/g, '\''); // Экранируем кавычки для CSS content
                    const userColor = state.user.color;

                    // Стиль для "головки" курсора (вертикальная черта)
                    cssString += `
                        .yRemoteSelectionHead-${clientID} {
                            border-left-color: ${userColor} !important;
                        }
                    `;

                    // Стиль для метки с именем пользователя
                    cssString += `
                        .yRemoteSelectionHead-${clientID}::after {
                            content: '${userName}';
                            background-color: ${userColor} !important;
                            color: white;
                            padding: 1px 5px;
                            border-radius: 3px;
                            font-size: 11px;
                            line-height: 1.2;
                            font-family: sans-serif;
                            white-space: nowrap;
                            position: absolute;
                            left: -2px; /* Отступ от линии курсора */
                            top: -1.4em; /* Позиция над строкой текста */
                            z-index: 20; /* Выше других элементов редактора, но ниже основного курсора Monaco */
                            pointer-events: none;
                            /* Дополнительно можно добавить тень или другие эффекты */
                        }
                    `;
                }
            });
            styleTag.textContent = cssString;
        };

        // Обновляем стили при инициализации и при каждом изменении awareness
        this.yAwareness.on('change', updateStyles);
        updateStyles(); // Первоначальный вызов для уже подключенных пользователей

        log('Динамическая стилизация курсоров y-monaco настроена.');
    }

    /**
     * Обработка изменений HTML (вызывается из CodeEditor, но y-monaco сам пишет в Y.Text)
     * @param {string} value - Новое значение HTML
     * @private
     */
    _handleHtmlChange(value) {
        // y-monaco автоматически синхронизирует локальные изменения в Y.Text.
        // Вызывать socketService.updateHtml(value) больше не нужно.
        // Y.Text вызовет .observe() в SocketService, который уведомит других клиентов.
        log('CodeEditorManager: _handleHtmlChange вызван. y-monaco должен был обновить Y.Text.');
        this._updateResult(true); // Обновляем локальный предпросмотр немедленно
    }

    /**
     * Обработка изменений CSS (вызывается из CodeEditor, но y-monaco сам пишет в Y.Text)
     * @param {string} value - Новое значение CSS
     * @private
     */
    _handleCssChange(value) {
        // Аналогично _handleHtmlChange
        log('CodeEditorManager: _handleCssChange вызван. y-monaco должен был обновить Y.Text.');
        this._updateResult(true); // Обновляем локальный предпросмотр немедленно
    }

    /**
     * Обработка изменений позиции курсора или выделения
     * @param {'html' | 'css'} editorType - Тип редактора
     * @param {object} position - Позиция курсора {lineNumber, column}
     * @param {object} selection - Выделение {startLineNumber, startColumn, endLineNumber, endColumn}
     * @private
     */
    _handleCursorOrSelectionChange(editorType, position, selection) {
        if (this.socketService && this.socketService.isAuthorized() && this.yAwareness) {
            // const cursorData = { // Данные больше не формируем здесь для отправки
            //     editorType: editorType,
            //     position: position,      // {lineNumber, column}
            //     selection: selection     // {startLineNumber, startColumn, endLineNumber, endColumn}
            // };
            // this.socketService.updateCursorAndSelection(cursorData); // Убираем явный вызов

            // MonacoBinding должен сам обновлять awareness для своего редактора.
            // Нам нужно убедиться, что в awareness.setLocalStateField('user', ...) есть имя и цвет, что делается в SocketService._initYAwareness.
            log(`_handleCursorOrSelectionChange: ${editorType} курсор изменен. MonacoBinding должен обновить awareness.`);
        }
    }

    /**
     * Обновление результата
     * @param {boolean} isLocalChange - Является ли изменение локальным (от текущего пользователя)
     * @private
     */
    _updateResult(isLocalChange = false) {
        // Получение значений редакторов
        const htmlCode = this.htmlEditor.getValue();
        const cssCode = this.cssEditor.getValue();

        // Обновление iframe
        const resultFrame = document.getElementById('output');
        if (resultFrame) {
            const frameDoc = resultFrame.contentDocument || resultFrame.contentWindow.document;

            try {
                frameDoc.open();
                frameDoc.write(`
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <meta charset="utf-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                                /* Только пользовательские стили */
                                ${cssCode}
                            </style>
                        </head>
                        <body>${htmlCode}</body>
                    </html>
                `);
                frameDoc.close();
            } catch (error) {
                log(`Ошибка при обновлении результата: ${error.message}`, 'error');
            }
        }

        // Убираем дублирующее обновление в app-initializer
        // так как мы уже обновили iframe выше
    }

    /**
     * Обновление размеров редакторов
     * @private
     */
    _refreshEditors() {
        // Для Monaco редакторов необходимо вызывать layout()
        if (this.htmlEditor && this.htmlEditor.editor) {
            this.htmlEditor.editor.layout();
        }

        if (this.cssEditor && this.cssEditor.editor) {
            this.cssEditor.editor.layout();
        }
    }

    /**
     * Установка HTML кода в редактор
     * @param {string} html HTML код
     * @param {string} source Источник изменений
     */
    setHtmlCode(html, source = 'server') {
        // Этот метод больше не нужен в таком виде, так как y-monaco
        // будет синхронизировать содержимое редактора с Y.Text напрямую.
        // Начальное состояние загрузится автоматически при привязке MonacoBinding.
        log(`CodeEditorManager: setHtmlCode вызван (source: ${source}). С Yjs это обычно не требуется.`, 'warn');
        // if (this.htmlEditor && this.htmlEditor.getValue() !== html) { 
        //    // this.htmlEditor.setValue(html); // y-monaco сделает это
        // }
        // this._updateResult(); // Обновление предпросмотра будет вызвано событием от Y.Text
    }

    /**
     * Установка CSS кода в редактор
     * @param {string} css CSS код
     * @param {string} source Источник изменений
     */
    setCssCode(css, source = 'server') {
       log(`CodeEditorManager: setCssCode вызван (source: ${source}). С Yjs это обычно не требуется.`, 'warn');
    }

    // Методы _applySmartUpdate и _highlightChanges удалены как неиспользуемые
}

// Экспортируем класс
export default CodeEditorManager;