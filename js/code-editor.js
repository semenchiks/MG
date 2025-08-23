// код редактора
import { debounce, throttle } from './utils.js'; // ВОССТАНАВЛИВАЕМ ЭТОТ ИМПОРТ


export class CodeEditor {
    constructor(editorId, language, options = {}) {
        this.editorId = editorId;
        this.language = language;
        this.editor = null;
        this.value = '';
        this.isInitialized = false;
        this.hasUnsavedChanges = false;
        this.lastSavedValue = '';
        this.isEditing = false;
        this.editingTimer = null;
        this.editingTimeout = 10000; // 10 секунд - увеличено для предотвращения частых прерываний редактирования
        this.options = {
            onChange: () => {},
            onCursorPositionChange: () => {},
            ...options
        };

        // Создаем оптимизированные версии обработчиков
        // this.debouncedOnChange = debounce(this._handleContentChange.bind(this), 300); // Удаляем, логика объединена
        this.throttledCursorUpdate = throttle(this._handleCursorPositionChange.bind(this), 100); // Оставляем для курсора

        // _initialize больше не вызывает _createEditor напрямую здесь.
        // _createEditor (переименованный в initMonaco) будет вызван из CodeEditorManager.
        // this._initialize(); 
    }

    /**
     * Инициализация редактора кода - теперь это публичный метод для вызова извне.
     * Ранее был _createEditor.
     */
    initMonacoEditor() { // Переименован из _createEditor и сделан публичным
        const editorElement = document.getElementById(this.editorId);

        if (!editorElement) {
            console.error(`Элемент с id ${this.editorId} не найден`);
            return;
        }

        try {
            // Используем глобальный 'window.monaco'
            if (!window.monaco || !window.monaco.editor) {
                console.error('Monaco Editor (window.monaco) не загружен или некорректен, невозможно создать редактор');
                return;
            }

            // Определяем язык для подсветки синтаксиса
            const language = this.language === 'html' ? 'html' : 'css';

            console.log(`Создаю редактор ${this.language} с использованием Monaco`);

            // Проверяем доступные языки
            console.log('[CodeEditor] Доступные языки Monaco перед defineTheme:', window.monaco.languages.getLanguages().map(l => l.id));

            // Определяем нашу пользовательскую светлую тему
            const customSyntaxTheme = {
                base: 'vs', // Наследуем от стандартной светлой темы
                inherit: true,
                rules: [
                    // Общие правила
                    { token: '', foreground: '2D3748', background: 'FFFFFF' }, // Темно-серый текст на белом фоне
                    { token: 'comment', foreground: '718096', fontStyle: 'italic' }, // Серые комментарии
                    { token: 'string', foreground: '805AD5' },           // Фиолетовые строки (было зеленые)
                    { token: 'number', foreground: '3182CE' },           // Синие числа
                    { token: 'keyword', foreground: '805AD5' },          // Фиолетовые ключевые слова

                    // HTML специфичные правила
                    { token: 'tag.html', foreground: 'E53E3E', fontStyle: 'bold' },     // Красные HTML теги
                    { token: 'attribute.name.html', foreground: 'D69E2E' },             // Оранжевые имена атрибутов
                    { token: 'attribute.value.html', foreground: '805AD5' },            // Фиолетовые значения атрибутов (было зеленые)
                    { token: 'delimiter.html', foreground: '4A5568' },                  // Серые скобки
                    { token: 'metatag.html', foreground: '805AD5', fontStyle: 'bold' }, // Фиолетовые метатеги
                    { token: 'comment.html', foreground: '718096', fontStyle: 'italic' }, // Серые комментарии

                    // CSS специфичные правила
                    { token: 'tag.css', foreground: 'E53E3E', fontStyle: 'bold' },      // Красные селекторы тегов
                    { token: 'attribute.name.css', foreground: '3182CE' },              // Синие имена свойств
                    { token: 'attribute.value.css', foreground: '805AD5' },             // Фиолетовые значения свойств (было зеленые)
                    { token: 'attribute.value.number.css', foreground: 'D69E2E' },      // Оранжевые числа
                    { token: 'attribute.value.unit.css', foreground: 'D69E2E' },        // Оранжевые единицы
                    { token: 'keyword.css', foreground: '805AD5', fontStyle: 'bold' },  // Фиолетовые ключевые слова
                    { token: 'comment.css', foreground: '718096', fontStyle: 'italic' }, // Серые комментарии
                    { token: 'string.css', foreground: '805AD5' },                      // Фиолетовые строки (было зеленые)
                    
                    // Дополнительные правила для лучшей подсветки
                    { token: 'delimiter.bracket', foreground: '4A5568' },               // Скобки
                    { token: 'delimiter.parenthesis', foreground: '4A5568' },           // Круглые скобки
                    { token: 'delimiter.square', foreground: '4A5568' },                // Квадратные скобки
                    { token: 'operator', foreground: '805AD5' },                        // Операторы
                    { token: 'variable', foreground: '2D3748' },                        // Переменные
                    { token: 'type', foreground: 'E53E3E' },                           // Типы
                    { token: 'identifier', foreground: '2D3748' }                       // Идентификаторы
                ],
                colors: {
                    'editor.foreground': '#2D3748',                    // Основной цвет текста
                    'editor.background': '#FFFFFF',                    // Белый фон
                    'editorCursor.foreground': '#000000',              // Черный курсор (было желтый)
                    'editor.lineHighlightBackground': '#FFF9E6',       // Светло-желтая подсветка строки
                    'editor.selectionBackground': '#FFE000AA',         // Полупрозрачное желтое выделение
                    'editor.inactiveSelectionBackground': '#F7FAFC',   // Неактивное выделение
                    'editorLineNumber.foreground': '#A0AEC0',          // Серые номера строк
                    'editorLineNumber.activeForeground': '#FFE000',    // Желтый номер активной строки
                    'editorSuggestWidget.background': '#FFFFFF',       // Белый фон автодополнения
                    'editorSuggestWidget.border': '#E2E8F0',           // Серая граница автодополнения
                    'editorSuggestWidget.selectedBackground': '#FFF9E6', // Желтоватый фон выбранного элемента
                    'editorWidget.background': '#FFFFFF',              // Фон виджетов
                    'editorWidget.border': '#E2E8F0',                  // Граница виджетов
                    'editorHoverWidget.background': '#FFFFFF',         // Фон всплывающих подсказок
                    'editorHoverWidget.border': '#E2E8F0',             // Граница всплывающих подсказок
                    'scrollbar.shadow': '#00000010',                   // Тень скроллбара
                    'scrollbarSlider.background': '#CBD5E0AA',         // Фон ползунка скроллбара
                    'scrollbarSlider.hoverBackground': '#A0AEC0AA',    // Фон ползунка при наведении
                    'scrollbarSlider.activeBackground': '#718096AA',   // Фон активного ползунка
                    'editorBracketMatch.background': '#FFE00040',      // Подсветка парных скобок
                    'editorBracketMatch.border': '#FFE000',            // Граница парных скобок
                    'editorIndentGuide.background': '#E2E8F0',         // Направляющие отступов
                    'editorIndentGuide.activeBackground': '#CBD5E0',   // Активные направляющие отступов
                    'editorWhitespace.foreground': '#E2E8F0'           // Пробелы и табы
                }
            };

            // Регистрируем нашу пользовательскую тему
            window.monaco.editor.defineTheme('custom-syntax-theme', customSyntaxTheme);

            // Создаем модель отдельно с правильным начальным значением
            const model = window.monaco.editor.createModel(this.value || '', language);
            
            // Создаем редактор Monaco
            this.editor = window.monaco.editor.create(editorElement, {
                model: model,
                theme: 'custom-syntax-theme', // УСТАНАВЛИВАЕМ НАШУ ПОЛЬЗОВАТЕЛЬСКУЮ ТЕМУ
                automaticLayout: true,
                minimap: {
                    enabled: false // Отключаем миникарту для экономии ресурсов
                },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                // fontSize: 14, // УДАЛЕНО - Размер шрифта будет устанавливаться менеджером доступности
                wordWrap: 'on',
                tabSize: 2,
                folding: true,
                renderWhitespace: 'none',
                autoIndent: 'advanced',
                showFoldingControls: 'always',
                // Оптимизации для больших файлов
                largeFileOptimizations: true,
                // Экономия памяти
                wordBasedSuggestions: false,
                // Снижаем частоту обновления для экономии CPU
                renderValidationDecorations: 'editable',
                // Отключаем тяжелые фичи для больших файлов
                quickSuggestions: {
                    other: false,
                    comments: false,
                    strings: false
                },
                // Отложенное форматирование
                formatOnType: false,
                formatOnPaste: false,
                // Работает быстрее по сравнению с exact
                accessibilitySupport: 'off',
                renderLineHighlight: 'line',
                // Повышаем производительность рендеринга
                disableMonospaceOptimizations: false
            });

            // Настройка обработчика изменения содержимого
            this.editor.onDidChangeModelContent(debounce((event) => {
                // Игнорируем программные изменения (от Yjs)
                if (this.updatingProgrammatically) {
                    this.updatingProgrammatically = false;
                    return;
                }
                
                if (this.options.onChange) {
                    const currentValue = this.getValue();
                    // Проверяем, что значение действительно изменилось
                    if (currentValue !== this.value) {
                        this.value = currentValue;
                        this.options.onChange(currentValue);
                    }
                }
            }, 200)); // Уменьшили задержку для более отзывчивого ввода

            // Настройка обработчика изменения позиции курсора и выделения
            this.editor.onDidChangeCursorSelection(debounce((e) => {
                if (this.options.onCursorPositionChange) {
                    const position = {
                        lineNumber: e.selection.positionLineNumber,
                        column: e.selection.positionColumn
                    };
                    const selection = {
                        startLineNumber: e.selection.startLineNumber,
                        startColumn: e.selection.startColumn,
                        endLineNumber: e.selection.endLineNumber,
                        endColumn: e.selection.endColumn
                    };
                    // Передаем тип редактора для удобства обработки в CodeEditorManager
                    this.options.onCursorPositionChange(this.language, position, selection);
                }
            }, 50)); // Небольшая задержка для курсора

            // Устанавливаем флаг инициализации
            this.isInitialized = true;

            // Инициализируем глобальные события
            this._initEvents();

            console.log(`Редактор ${this.language} успешно создан`);
        } catch (error) {
            console.error(`Ошибка при создании редактора ${this.language}:`, error);
        }
    }

    /**
     * Получение текущего значения редактора
     * @returns {string} Текущее значение редактора
     */
    getValue() {
        if (!this.editor) return this.value;
        return this.editor.getValue();
    }

    /**
     * Установка значения редактора
     * @param {string} value Новое значение редактора
     */
    setValue(value) {
        // Если значение не изменилось, ничего не делаем
        if (this.value === value) return;

        // Сохраняем текущую позицию просмотра и курсора
        let currentPosition = null;
        let currentScrollTop = null;
        let currentVisibleRanges = null;
        let currentSelection = null;

        if (this.editor) {
            // Сохраняем текущую позицию курсора
            currentPosition = this.editor.getPosition();

            // Сохраняем текущую позицию скролла
            currentScrollTop = this.editor.getScrollTop();

            // Сохраняем видимый диапазон для более точного восстановления
            currentVisibleRanges = this.editor.getVisibleRanges();

            // Сохраняем текущее выделение
            currentSelection = this.editor.getSelection();

            // Запоминаем, что мы обновляем содержимое программно, а не пользователь
            this.updatingProgrammatically = true;

            // Создаем атомарные операции редактирования для оптимизации
            const editOperations = [];

            // Используем более производительный метод для больших изменений
            const currentModel = this.editor.getModel();
            if (currentModel) {
                const fullRange = currentModel.getFullModelRange();
                editOperations.push({
                    range: fullRange,
                    text: value,
                    forceMoveMarkers: true
                });

                // Применяем изменения как одну операцию
                currentModel.pushEditOperations([], editOperations, () => null);

                // Сбрасываем историю отмены для экономии памяти
                currentModel.pushStackElement();
            } else {
                // Запасной вариант, если модель не доступна
                this.editor.setValue(value);
            }

            // Обновляем значение
            this.value = value;

            // Сохраняем последнее сохраненное значение для отслеживания несохраненных изменений
            this.lastSavedValue = value;

            // Восстанавливаем позицию просмотра и курсора после того, как Monaco обработает изменения
            // Обертываем в setTimeout с задержкой, чтобы гарантировать, что Monaco завершил изменения
            setTimeout(() => {
                if (this.editor) {
                    try {
                        // Восстанавливаем позицию курсора, если она была сохранена
                        if (currentPosition) {
                            // Проверяем, что позиция валидна после изменений
                            const model = this.editor.getModel();
                            if (model) {
                                const lineCount = model.getLineCount();
                                // Если позиция выходит за пределы документа, используем последнюю строку
                                const safeLineNumber = Math.min(currentPosition.lineNumber, lineCount);
                                const lineContent = model.getLineContent(safeLineNumber);
                                // Корректируем позицию, если после изменений она вышла за пределы строки
                                const column = Math.min(currentPosition.column, lineContent.length + 1);
                                this.editor.setPosition({ lineNumber: safeLineNumber, column });
                            }
                        }

                        // Восстанавливаем выделение, если оно было сохранено
                        if (currentSelection) {
                            // Проверяем, что выделение валидно после изменений
                            const model = this.editor.getModel();
                            if (model) {
                                const lineCount = model.getLineCount();
                                // Корректируем начальную и конечную строки выделения
                                const safeStartLineNumber = Math.min(currentSelection.startLineNumber, lineCount);
                                const safeEndLineNumber = Math.min(currentSelection.endLineNumber, lineCount);

                                // Получаем содержимое строк с проверкой на существование
                                const startLine = model.getLineContent(safeStartLineNumber);
                                const endLine = model.getLineContent(safeEndLineNumber);

                                // Корректируем позиции колонок
                                const startColumn = Math.min(currentSelection.startColumn, startLine.length + 1);
                                const endColumn = Math.min(currentSelection.endColumn, endLine.length + 1);

                                // Создаем корректное выделение
                                const selection = {
                                    startLineNumber: safeStartLineNumber,
                                    startColumn: startColumn,
                                    endLineNumber: safeEndLineNumber,
                                    endColumn: endColumn
                                };

                                // Устанавливаем выделение
                                this.editor.setSelection(selection);
                            }
                        }

                        // Восстанавливаем позицию скролла
                        if (currentScrollTop !== null) {
                            this.editor.setScrollTop(currentScrollTop);
                        }
                    } catch (error) {
                        console.error('Ошибка при восстановлении позиции курсора:', error);
                    } finally {
                        // Сбрасываем флаг программного обновления
                        this.updatingProgrammatically = false;
                    }
                }
            }, 50); // Увеличиваем задержку для более надежного восстановления позиции

            // Принудительно обновляем редактор, чтобы избежать проблем с отображением
            this.editor.layout();
        } else {
            // Если редактор еще не создан, просто сохраняем значение
            this.value = value;
            this.lastSavedValue = value;
        }
    }

    /**
     * Обновляет визуальный статус сохранения
     * @param {string} status - Статус ('editing', 'saving', 'saved')
     * @private
     */
    _updateSavingStatus(status) {
        // Отключаем отображение статуса редактирования, так как это мешает пользователю
        return;

        // Получаем заголовок редактора
        const editorContainer = document.getElementById(this.editorId);
        if (!editorContainer) return;

        const editorParent = editorContainer.closest('.editor-instance-container');
        if (!editorParent) return;

        const statusContainer = editorParent.querySelector('.save-status');

        // Если контейнер статуса не существует, создаем его
        if (!statusContainer) {
            const header = editorParent.querySelector('.editor-header');
            if (!header) return;

            const statusDiv = document.createElement('div');
            statusDiv.className = 'save-status';
            statusDiv.style.marginLeft = '10px';
            statusDiv.style.fontSize = '12px';
            header.querySelector('.editor-title').appendChild(statusDiv);

            // Обновляем ссылку на новый контейнер
            this._updateSavingStatus(status);
            return;
        }

        // Обновляем статус
        switch (status) {
            case 'editing':
                statusContainer.textContent = '● редактируется';
                statusContainer.style.color = '#ffaa00';
                break;
            case 'saving':
                statusContainer.textContent = '● сохраняется...';
                statusContainer.style.color = '#66aaff';
                break;
            case 'saved':
                statusContainer.textContent = '● сохранено';
                statusContainer.style.color = '#66cc66';

                // Удаляем статус через 3 секунды
                setTimeout(() => {
                    if (statusContainer.textContent === '● сохранено') {
                        statusContainer.textContent = '';
                    }
                }, 3000);
                break;
        }
    }

    /**
     * Обработчик изменения позиции курсора
     * @private
     */
    _handleCursorPositionChange(event) {
        if (!this.isInitialized) return;

        const position = event.position;
        const editorElement = document.getElementById(this.editorId);
        const editorBounds = editorElement.getBoundingClientRect();

        // Получаем координаты позиции курсора в редакторе
        const coordinatesList = this.editor.getScrolledVisiblePosition(position);

        if (!coordinatesList) return;

        // Вычисляем абсолютные координаты курсора
        const x = editorBounds.left + coordinatesList.left;
        const y = editorBounds.top + coordinatesList.top;

        if (typeof this.options.onCursorPositionChange === 'function') {
            this.options.onCursorPositionChange({ x, y });
        }
    }

    /**
     * Инициализация глобальных событий
     * @private
     */
    _initEvents() {
        // Обработчик события начала сохранения
        document.addEventListener('editor_saving', (event) => {
            const { type } = event.detail;

            // Проверяем, относится ли событие к этому редактору
            if ((type === 'html' && this.language === 'html') ||
                (type === 'css' && this.language === 'css')) {
                    this._updateSavingStatus('saving');
            }
        });
    }
}