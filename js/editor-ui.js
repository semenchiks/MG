// editor-ui.js
// Модуль для управления интерфейсом редактора

import { debounce } from './utils.js';

/**
 * Класс для управления интерфейсом редактора
 */
export class EditorUI {
    /**
     * Конструктор класса EditorUI
     * @param {Object} codeEditorManager - Экземпляр CodeEditorManager
     * @param {Object} appInitializer - Экземпляр AppInitializer (для доступа к adminInitContent)
     */
    constructor(codeEditorManager, appInitializer) {
        console.log('Инициализация EditorUI...');
        this.codeEditorManager = codeEditorManager;
        this.appInitializer = appInitializer;
        this.container = document.querySelector('.container');
        this.onlineUsersElement = document.querySelector('.online-users');
        this.fullscreenResult = document.getElementById('fullscreen-result');
        this.resultPreview = document.getElementById('result-preview');
        
        // Выводим отладочную информацию
        console.log('EditorUI элементы:');
        console.log('- container:', this.container ? 'найден' : 'не найден');
        console.log('- fullscreenResult:', this.fullscreenResult ? 'найден' : 'не найден');
        console.log('- resultPreview:', this.resultPreview ? 'найден' : 'не найден');
        
        // Флаг полноэкранного режима
        this.isFullscreen = false;
        this.currentFullscreenEditor = null;
        
        // Настраиваем адаптивные размеры редакторов
        this.setupEditorSizes();
        
        // Устанавливаем обработчики событий
        this.setupEventListeners();
        
        console.log('EditorUI полностью инициализирован.');
    }
    
    /**
     * Инициализация интерфейса
     */
    init() {
        console.log('Вызван метод init() для EditorUI');
        // Отображаем контейнер
        this.showEditor();
    }
    
    /**
     * Показать редактор кода
     */
    showEditor() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }
    
    /**
     * Скрыть редактор кода
     */
    hideEditor() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
    
    /**
     * Настройка адаптивных размеров редакторов
     */
    setupEditorSizes() {
        // Обработчик изменения размера окна
        const resizeHandler = debounce(() => {
            this.adjustEditorSizes();
        }, 100);
        
        window.addEventListener('resize', resizeHandler);
        
        // Первоначальная настройка размеров
        this.adjustEditorSizes();
    }
    
    /**
     * Корректировка размеров редакторов в зависимости от размера окна
     */
    adjustEditorSizes() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Адаптация для мобильных устройств
        if (windowWidth < 768) {
            // Мобильная версия: редакторы располагаются вертикально
            if (this.container) {
                this.container.classList.add('mobile-layout');
            }
        } else {
            // Десктопная версия: горизонтальное расположение
            if (this.container) {
                this.container.classList.remove('mobile-layout');
            }
        }
        
        // Диспетчеризация события изменения размера для Monaco
        if (this.codeEditorManager && this.codeEditorManager._refreshEditors) {
            this.codeEditorManager._refreshEditors(); // Обновляем все редакторы
        }
    }
    
    /**
     * Переключение полноэкранного режима для редактора
     * @param {HTMLElement} editorContainer - DOM-элемент контейнера редактора.
     * @param {string} editorType - Тип редактора ('html' или 'css').
     */
    toggleFullscreen(editorContainer, editorType) {
        log(`Переключение полноэкранного режима для редактора ${editorType}`);
        
        if (!editorContainer) {
            log(`Контейнер редактора ${editorType} не найден для toggleFullscreen`, 'error');
            return;
        }

        // Если другой редактор уже в полноэкранном режиме, сначала выходим из него
        const otherFullscreenEditor = document.querySelector('.editor-instance-container.fullscreen');
        if (otherFullscreenEditor && otherFullscreenEditor !== editorContainer) {
            log(`Выход из полноэкранного режима для другого редактора: ${otherFullscreenEditor.id}`);
            otherFullscreenEditor.classList.remove('fullscreen');
            const otherEditorType = otherFullscreenEditor.id.split('-')[0];
            // Показываем "бывший" полноэкранный редактор, если это не тот, который мы сейчас переключаем
            const stillOtherEditor = document.getElementById(`${otherEditorType}-editor-container`);
            if (stillOtherEditor && stillOtherEditor !== editorContainer) {
                 stillOtherEditor.style.display = '';
            }
        }

        editorContainer.classList.toggle('fullscreen');
        const isNowFullscreen = editorContainer.classList.contains('fullscreen');
        document.body.classList.toggle('fullscreen-active', isNowFullscreen);

        const button = document.querySelector(`.fullscreen-toggle-button[data-editor="${editorType}"]`);
        const closeButton = document.getElementById('close-fullscreen-button');

        if (isNowFullscreen) {
            if (button) button.innerHTML = '<i class="fas fa-compress-alt"></i>';
            if (closeButton) closeButton.style.display = 'block';

            // Скрыть другой редактор, если он не текущий полноэкранный
            const otherEditorTypeToHide = editorType === 'html' ? 'css' : 'html';
            const otherEditorToHide = document.getElementById(`${otherEditorTypeToHide}-editor-container`);
            if (otherEditorToHide && otherEditorToHide !== editorContainer) { // Убедимся, что не скрываем сами себя
                otherEditorToHide.style.display = 'none';
            }
            log(`Редактор ${editorType} переведен в полноэкранный режим.`);

        } else {
            if (button) button.innerHTML = '<i class="fas fa-expand-alt"></i>';
            if (closeButton) closeButton.style.display = 'none';

            // Показать другой редактор
            const otherEditorTypeToShow = editorType === 'html' ? 'css' : 'html';
            const otherEditorToShow = document.getElementById(`${otherEditorTypeToShow}-editor-container`);
            if (otherEditorToShow) {
                otherEditorToShow.style.display = ''; // Восстановить display
            }
            log(`Редактор ${editorType} вышел из полноэкранного режима.`);
        }

        // Обновляем размер Monaco редактора через короткую задержку
        setTimeout(() => {
            if (this.codeEditorManager && this.codeEditorManager.refreshSpecificEditor) {
                this.codeEditorManager.refreshSpecificEditor(editorType);
                // Если был другой полноэкранный редактор, его тоже нужно обновить после выхода.
                if (otherFullscreenEditor && otherFullscreenEditor !== editorContainer) {
                     this.codeEditorManager.refreshSpecificEditor(otherFullscreenEditor.id.split('-')[0]);
                }
            }
            log(`Обновлен макет для редактора ${editorType} после изменения полноэкранного режима.`);
        }, 150); 
    }
    
    /**
     * Обновление индикатора последнего редактора
     * @param {string} editorType - Тип редактора ('html' или 'css')
     * @param {string} teamName - Имя команды
     */
    updateLastEditorIndicator(editorType, teamName) {
        const indicator = document.getElementById(`last-${editorType}-editor`);
        
        if (indicator) {
            indicator.textContent = teamName ? `редактировал: ${teamName}` : '';
            
            // Анимация обновления
            indicator.classList.add('updated');
            setTimeout(() => {
                indicator.classList.remove('updated');
            }, 1000);
        }
    }
    
    /**
     * Установка обработчиков событий
     */
    setupEventListeners() {
        console.log('Настройка обработчиков событий для EditorUI...');
        
        // Кнопка инициализации (если она все еще используется)
        if (this.initButton) {
            this.initButton.addEventListener('click', () => {
                console.log('Кнопка инициализации нажата');
                // Здесь может быть вызов метода из appInitializer или другого управляющего класса
                if (this.appInitializer && typeof this.appInitializer.adminInitContent === 'function') {
                    this.appInitializer.adminInitContent();
                } else {
                    console.warn('appInitializer или метод adminInitContent не найдены');
                }
            });
        }

        // Обработка полноэкранного режима
        const fullscreenToggleButtons = document.querySelectorAll('.fullscreen-toggle-button');
        fullscreenToggleButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const editorType = event.currentTarget.dataset.editor;
                const editorContainer = document.getElementById(`${editorType}-editor-container`); 
                if (editorContainer) {
                    this.toggleFullscreen(editorContainer, editorType);
                }
            });
        });

        // Закрытие полноэкранного режима по кнопке Escape или специальной кнопке
        const closeFullscreenButton = document.getElementById('close-fullscreen-button');
        if (closeFullscreenButton) {
            closeFullscreenButton.addEventListener('click', () => {
                const anyFullscreen = document.querySelector('.editor-instance-container.fullscreen');
                if (anyFullscreen) {
                    const editorType = anyFullscreen.id.split('-')[0]; 
                    this.toggleFullscreen(anyFullscreen, editorType);
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const anyFullscreen = document.querySelector('.editor-instance-container.fullscreen');
                if (anyFullscreen) {
                    const editorType = anyFullscreen.id.split('-')[0];
                    this.toggleFullscreen(anyFullscreen, editorType);
                }
            }
        });

        // Подписка на событие изменения статуса SocketService для обновления UI
        if (window.socketService) { // Убедимся, что socketService доступен глобально или передан
            window.socketService.onAuth((authData) => {
                // Можно добавить логику для UI в зависимости от статуса авторизации
                console.log(`EditorUI: Auth status changed. Data: ${JSON.stringify(authData)}`);
                // Пример: if (authData.success) { /* показать UI */ } else { /* скрыть UI или показать ошибку */ }
            });
        }

        // Инициализация переключателей доступности, если они есть
        // this.initAccessibilityToggles(); // Если есть такой метод

        console.log('Обработчики событий для EditorUI настроены.');
    }
}

// Экземпляр класса больше не создается и не экспортируется здесь
// export const editorUI = new EditorUI(); 