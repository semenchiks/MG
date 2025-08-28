/**
 * Модуль для управления функциями доступности
 */
export class AccessibilityManager {
    
    /**
     * Статический метод для инициализации доступности на любой странице
     */
    static initForPage() {
        // Проверяем, не инициализирован ли уже модуль
        if (window.accessibilityManager) {
            return window.accessibilityManager;
        }

        // Добавляем HTML структуру для доступности, если её нет
        AccessibilityManager.injectAccessibilityHTML();
        
        // Добавляем CSS стили для доступности
        AccessibilityManager.injectAccessibilityCSS();
        
        // Создаем и сохраняем экземпляр менеджера
        window.accessibilityManager = new AccessibilityManager();
        return window.accessibilityManager;
    }

    /**
     * Добавляет HTML структуру для панели доступности
     */
    static injectAccessibilityHTML() {
        // Проверяем, есть ли уже кнопка доступности
        if (document.getElementById('accessibility-btn')) {
            return;
        }

        const accessibilityHTML = `
            <!-- SVG фильтры для режимов дальтонизма -->
            <svg style="position: absolute; width: 0; height: 0; overflow: hidden;" aria-hidden="true">
                <defs>
                    <!-- Протанопия (не видит красный) -->
                    <filter id="protanopia-filter">
                        <feColorMatrix
                            type="matrix"
                            values="0.367, 0.633, 0, 0, 0,
                                    0.367, 0.633, 0, 0, 0,
                                    0, 0.167, 0.833, 0, 0,
                                    0, 0, 0, 1, 0" />
                        <feComponentTransfer>
                            <feFuncR type="gamma" exponent="0.9" amplitude="1" offset="0"/>
                            <feFuncG type="gamma" exponent="0.9" amplitude="1" offset="0"/>
                            <feFuncB type="gamma" exponent="0.9" amplitude="1" offset="0"/>
                        </feComponentTransfer>
                    </filter>
                    <!-- Дейтеранопия (не видит зеленый) -->
                    <filter id="deuteranopia-filter">
                        <feColorMatrix
                            type="matrix"
                            values="0.625, 0.375, 0, 0, 0,
                                    0.7, 0.3, 0, 0, 0,
                                    0, 0.3, 0.7, 0, 0,
                                    0, 0, 0, 1, 0" />
                        <feColorMatrix
                            type="saturate"
                            values="0.5" />
                        <feComponentTransfer>
                            <feFuncR type="gamma" exponent="1.2" amplitude="1" offset="0"/>
                            <feFuncG type="gamma" exponent="0.9" amplitude="1" offset="0"/>
                            <feFuncB type="gamma" exponent="1" amplitude="1" offset="0"/>
                        </feComponentTransfer>
                    </filter>
                    <!-- Тританопия (не видит синий) -->
                    <filter id="tritanopia-filter">
                        <feColorMatrix
                            type="matrix"
                            values="1, 0, 0, 0, 0,
                                    0, 0.7, 0.3, 0, 0,
                                    0, 0.7, 0.3, 0, 0,
                                    0, 0, 0, 1, 0" />
                        <feColorMatrix
                            type="saturate"
                            values="0.8" />
                        <feComponentTransfer>
                            <feFuncR type="gamma" exponent="1" amplitude="1" offset="0"/>
                            <feFuncG type="gamma" exponent="1" amplitude="1" offset="0"/>
                            <feFuncB type="gamma" exponent="0.9" amplitude="1" offset="0"/>
                        </feComponentTransfer>
                    </filter>
                </defs>
            </svg>

            <!-- Кнопка доступности -->
            <button id="accessibility-btn" class="accessibility-btn" aria-label="Настройки доступности" aria-expanded="false" aria-controls="accessibility-panel">
                <i class="fas fa-universal-access"></i>
            </button>

            <!-- Панель доступности -->
            <div id="accessibility-panel" class="accessibility-panel" aria-labelledby="accessibility-heading" role="dialog">
                <h3 id="accessibility-heading">Настройки доступности</h3>

                <div class="accessibility-section">
                    <h4>Размер шрифта</h4>
                    <div class="accessibility-btn-group">
                        <button id="font-normal" class="font-size-btn active" aria-pressed="true">Обычный</button>
                        <button id="font-large" class="font-size-btn" aria-pressed="false">Большой</button>
                        <button id="font-xlarge" class="font-size-btn" aria-pressed="false">Очень большой</button>
                    </div>
                </div>

                <div class="accessibility-section">
                    <h4>Контрастность</h4>
                    <div class="accessibility-btn-group">
                        <button id="contrast-normal" class="contrast-btn active" aria-pressed="true">Обычная</button>
                        <button id="contrast-high" class="contrast-btn" aria-pressed="false">Высокая</button>
                    </div>
                </div>

                <div class="accessibility-section">
                    <h4>Режим для дальтонизма</h4>
                    <select id="colorblind-mode" class="accessibility-select" aria-label="Выберите режим для дальтонизма">
                        <option value="normal">Обычный режим</option>
                        <option value="protanopia">Протанопия (не видит красный)</option>
                        <option value="deuteranopia">Дейтеранопия (не видит зеленый)</option>
                        <option value="tritanopia">Тританопия (не видит синий)</option>
                    </select>
                </div>

                <div class="accessibility-section">
                    <h4>Анимации</h4>
                    <div class="accessibility-toggle">
                        <input type="checkbox" id="animations-toggle" checked aria-label="Включить или отключить анимации">
                        <label for="animations-toggle">Включить анимации</label>
                    </div>
                </div>

                <button id="accessibility-reset" class="accessibility-reset">Сбросить настройки</button>
            </div>
        `;

        // Добавляем HTML в начало body
        document.body.insertAdjacentHTML('afterbegin', accessibilityHTML);
    }

    /**
     * Добавляет CSS стили для панели доступности
     */
    static injectAccessibilityCSS() {
        // Проверяем, есть ли уже стили доступности
        if (document.getElementById('accessibility-styles')) {
            return;
        }

        const accessibilityCSS = `
            /* Кнопка доступности */
            .accessibility-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: #ffe000;
                border: none;
                border-radius: 50%;
                cursor: pointer;
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                color: #222;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                transition: all 0.3s ease;
            }

            .accessibility-btn:hover {
                background: #ffd600;
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
            }

            .accessibility-btn:focus {
                outline: 3px solid #0066cc;
                outline-offset: 2px;
            }

            /* Панель доступности */
            .accessibility-panel {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 300px;
                background: #fff;
                border: 2px solid #ffe000;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                z-index: 9998;
                display: none;
                max-height: 80vh;
                overflow-y: auto;
            }

            .accessibility-panel.show {
                display: block;
            }

            .accessibility-panel h3 {
                margin: 0 0 20px 0;
                color: #222;
                font-size: 1.2em;
                font-weight: 700;
            }

            .accessibility-panel h4 {
                margin: 0 0 10px 0;
                color: #444;
                font-size: 1em;
                font-weight: 600;
            }

            .accessibility-section {
                margin-bottom: 20px;
            }

            .accessibility-btn-group {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .font-size-btn, .contrast-btn {
                padding: 8px 12px;
                border: 2px solid #ddd;
                background: #fff;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9em;
                transition: all 0.2s ease;
            }

            .font-size-btn:hover, .contrast-btn:hover {
                border-color: #ffe000;
                background: #fff7d6;
            }

            .font-size-btn.active, .contrast-btn.active {
                background: #ffe000;
                border-color: #ffe000;
                color: #222;
                font-weight: 600;
            }

            .accessibility-select {
                width: 100%;
                padding: 8px 12px;
                border: 2px solid #ddd;
                border-radius: 6px;
                font-size: 0.9em;
                background: #fff;
            }

            .accessibility-select:focus {
                border-color: #ffe000;
                outline: none;
            }

            .accessibility-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .accessibility-toggle input[type="checkbox"] {
                width: 18px;
                height: 18px;
                accent-color: #ffe000;
            }

            .accessibility-toggle label {
                font-size: 0.9em;
                color: #444;
                cursor: pointer;
            }

            .accessibility-reset {
                width: 100%;
                padding: 10px;
                background: #ff4444;
                color: #fff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9em;
                font-weight: 600;
                margin-top: 10px;
            }

            .accessibility-reset:hover {
                background: #cc3333;
            }

            /* Стили доступности */
            html.font-size-large {
                font-size: 1.25em;
            }

            html.font-size-xlarge {
                font-size: 1.5em;
            }

            html.contrast-high {
                filter: contrast(1.4) brightness(1.1);
            }

            html.contrast-high body {
                background: #000 !important;
                color: #fff !important;
            }

                         html.reduce-animations * {
                 animation: none !important;
                 transition: none !important;
                 transform: none !important;
             }
             html.reduce-animations .yellow-shape,
             html.reduce-animations .shape1,
             html.reduce-animations .shape2,
             html.reduce-animations .shape3,
             html.reduce-animations .shape4,
             html.reduce-animations .shape5,
             html.reduce-animations .shape6 {
                 animation: none !important;
                 transform: none !important;
             }

            /* Фильтры для дальтонизма */
            html.colorblind-protanopia {
                filter: url(#protanopia-filter);
            }

            html.colorblind-deuteranopia {
                filter: url(#deuteranopia-filter);
            }

            html.colorblind-tritanopia {
                filter: url(#tritanopia-filter);
            }

            /* Адаптивность для мобильных */
            @media (max-width: 768px) {
                .accessibility-panel {
                    right: 10px;
                    left: 10px;
                    width: auto;
                    top: 70px;
                }
                
                .accessibility-btn {
                    right: 15px;
                    top: 15px;
                    width: 45px;
                    height: 45px;
                    font-size: 18px;
                }
            }
        `;

        // Создаем элемент style и добавляем CSS
        const styleElement = document.createElement('style');
        styleElement.id = 'accessibility-styles';
        styleElement.textContent = accessibilityCSS;
        document.head.appendChild(styleElement);
    }
    constructor() {
        this.settings = {
            fontSize: 'normal', // normal, large, x-large
            contrast: 'normal', // normal, high
            colorblind: 'normal', // normal, protanopia, deuteranopia, tritanopia
            animations: true, // true - включены, false - отключены
        };

        // Загружаем сохраненные настройки
        this.loadSettings();

        // Инициализируем панель доступности
        this.initAccessibilityPanel();

        // Применяем настройки
        this.applySettings();

        // Обработчик для iframe
        this.setupIframeHandler();

        // Обработчик для Monaco
        this.setupMonacoHandler();
    }

    /**
     * Настройка обработчика для Monaco
     */
    setupMonacoHandler() {
        // Проверяем, загружен ли Monaco
        if (window.monaco) {
            // Если Monaco уже загружен, применяем настройки
            this.applySettingsToMonacoEditors();
        } else {
            // Если Monaco еще не загружен, добавляем обработчик события
            window.addEventListener('monaco_loaded', () => {
                // Применяем настройки после загрузки Monaco
                setTimeout(() => {
                    this.applySettingsToMonacoEditors();
                }, 500); // Небольшая задержка, чтобы редакторы успели инициализироваться
            });
        }
    }

    /**
     * Настройка обработчика для iframe
     */
    setupIframeHandler() {
        const outputFrame = document.getElementById('output');
        if (outputFrame) {
            // Обработчик загрузки iframe
            outputFrame.addEventListener('load', () => {
                this.applySettingsToIframe(outputFrame);
            });

            // Периодическая проверка и обновление настроек
            setInterval(() => {
                this.applySettingsToIframe(outputFrame);
            }, 2000); // Проверяем каждые 2 секунды
        }
    }

    /**
     * Применение настроек к iframe
     */
    applySettingsToIframe(iframe) {
        if (iframe && iframe.contentDocument) {
            try {
                const frameHtml = iframe.contentDocument.documentElement;

                // Применяем размер шрифта
                frameHtml.classList.remove('font-size-normal', 'font-size-large', 'font-size-xlarge');
                frameHtml.classList.add(`font-size-${this.settings.fontSize}`);

                // Добавляем стили для iframe
                let style = iframe.contentDocument.getElementById('accessibility-styles');

                if (!style) {
                    style = iframe.contentDocument.createElement('style');
                    style.id = 'accessibility-styles';
                    iframe.contentDocument.head.appendChild(style);
                }

                style.textContent = `
                    html.font-size-large { font-size: 1.25em !important; }
                    html.font-size-xlarge { font-size: 1.5em !important; }
                    html.font-size-large *, html.font-size-xlarge * { font-size: inherit; }

                    /* Высокая контрастность */
                    html.contrast-high { filter: contrast(1.4); }
                    html.contrast-high body { background: #000 !important; color: #fff !important; }

                    /* Отключение анимаций */
                    html.reduce-animations * {
                        animation: none !important;
                        transition: none !important;
                        transform: none !important;
                    }
                    html.reduce-animations .yellow-shape,
                    html.reduce-animations .shape1,
                    html.reduce-animations .shape2,
                    html.reduce-animations .shape3,
                    html.reduce-animations .shape4,
                    html.reduce-animations .shape5,
                    html.reduce-animations .shape6 {
                        animation: none !important;
                        transform: none !important;
                    }
                `;

                // Применяем контрастность
                frameHtml.classList.remove('contrast-normal', 'contrast-high');
                frameHtml.classList.add(`contrast-${this.settings.contrast}`);

                // Применяем настройки анимаций
                if (this.settings.animations) {
                    frameHtml.classList.remove('reduce-animations');
                } else {
                    frameHtml.classList.add('reduce-animations');
                }
            } catch (e) {
                console.error('Ошибка при применении стилей к iframe:', e);
            }
        }
    }

    /**
     * Инициализация панели доступности
     */
    initAccessibilityPanel() {
        // Находим кнопку доступности и панель
        const accessibilityBtn = document.getElementById('accessibility-btn');
        const accessibilityPanel = document.getElementById('accessibility-panel');

        if (!accessibilityBtn || !accessibilityPanel) {
            console.error('Элементы панели доступности не найдены');
            return;
        }

        // Обработчик для открытия/закрытия панели
        accessibilityBtn.addEventListener('click', () => {
            accessibilityPanel.classList.toggle('show');

            // Обновляем ARIA-атрибуты
            const isExpanded = accessibilityPanel.classList.contains('show');
            accessibilityBtn.setAttribute('aria-expanded', isExpanded);

            // Фокус на первый элемент панели при открытии
            if (isExpanded) {
                const firstControl = accessibilityPanel.querySelector('button, select');
                if (firstControl) firstControl.focus();
            }
        });

        // Закрытие панели по клику вне её
        document.addEventListener('click', (event) => {
            if (!accessibilityPanel.contains(event.target) &&
                !accessibilityBtn.contains(event.target) &&
                accessibilityPanel.classList.contains('show')) {
                accessibilityPanel.classList.remove('show');
                accessibilityBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Обработчики для элементов управления
        this.setupFontSizeControls();
        this.setupContrastControls();
        this.setupColorBlindControls();
        this.setupAnimationControls();

        // Добавляем обработчик для кнопки сброса
        const resetBtn = document.getElementById('accessibility-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }
    }

    /**
     * Настройка контролов размера шрифта
     */
    setupFontSizeControls() {
        const fontNormal = document.getElementById('font-normal');
        const fontLarge = document.getElementById('font-large');
        const fontXLarge = document.getElementById('font-xlarge');

        if (fontNormal) {
            fontNormal.addEventListener('click', () => {
                this.settings.fontSize = 'normal';
                this.applySettings();
                this.saveSettings();
                this.updateActiveButtons();
            });
        }

        if (fontLarge) {
            fontLarge.addEventListener('click', () => {
                this.settings.fontSize = 'large';
                this.applySettings();
                this.saveSettings();
                this.updateActiveButtons();
            });
        }

        if (fontXLarge) {
            fontXLarge.addEventListener('click', () => {
                this.settings.fontSize = 'xlarge';
                this.applySettings();
                this.saveSettings();
                this.updateActiveButtons();
            });
        }
    }

    /**
     * Настройка контролов контрастности
     */
    setupContrastControls() {
        const contrastNormal = document.getElementById('contrast-normal');
        const contrastHigh = document.getElementById('contrast-high');

        if (contrastNormal) {
            contrastNormal.addEventListener('click', () => {
                this.settings.contrast = 'normal';
                this.applySettings();
                this.saveSettings();
                this.updateActiveButtons();
            });
        }

        if (contrastHigh) {
            contrastHigh.addEventListener('click', () => {
                this.settings.contrast = 'high';
                this.applySettings();
                this.saveSettings();
                this.updateActiveButtons();
            });
        }
    }

    /**
     * Настройка контролов для режимов дальтонизма
     */
    setupColorBlindControls() {
        const colorblindSelect = document.getElementById('colorblind-mode');

        if (colorblindSelect) {
            colorblindSelect.addEventListener('change', () => {
                this.settings.colorblind = colorblindSelect.value;
                this.applySettings();
                this.saveSettings();
            });

            // Устанавливаем текущее значение
            colorblindSelect.value = this.settings.colorblind;
        }
    }

    /**
     * Настройка контролов для анимаций
     */
    setupAnimationControls() {
        const animationsToggle = document.getElementById('animations-toggle');

        if (animationsToggle) {
            animationsToggle.addEventListener('change', () => {
                this.settings.animations = animationsToggle.checked;
                this.applySettings();
                this.saveSettings();
            });

            // Устанавливаем текущее значение
            animationsToggle.checked = this.settings.animations;
        }
    }

    /**
     * Обновление активных кнопок в соответствии с текущими настройками
     */
    updateActiveButtons() {
        // Размер шрифта
        document.querySelectorAll('.font-size-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeFontBtn = document.getElementById(`font-${this.settings.fontSize}`);
        if (activeFontBtn) activeFontBtn.classList.add('active');

        // Контрастность
        document.querySelectorAll('.contrast-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const activeContrastBtn = document.getElementById(`contrast-${this.settings.contrast}`);
        if (activeContrastBtn) activeContrastBtn.classList.add('active');

        // Режим дальтонизма
        const colorblindSelect = document.getElementById('colorblind-mode');
        if (colorblindSelect) colorblindSelect.value = this.settings.colorblind;

        // Анимации
        const animationsToggle = document.getElementById('animations-toggle');
        if (animationsToggle) animationsToggle.checked = this.settings.animations;
    }

    /**
     * Применение настроек доступности
     */
    applySettings() {
        const html = document.documentElement;

        // Применяем размер шрифта
        html.classList.remove('font-size-normal', 'font-size-large', 'font-size-xlarge');
        html.classList.add(`font-size-${this.settings.fontSize}`);

        // Применяем контрастность
        html.classList.remove('contrast-normal', 'contrast-high');
        html.classList.add(`contrast-${this.settings.contrast}`);

        // Применяем режим дальтонизма
        html.classList.remove('colorblind-normal', 'colorblind-protanopia', 'colorblind-deuteranopia', 'colorblind-tritanopia');
        html.classList.add(`colorblind-${this.settings.colorblind}`);

        // Применяем настройки анимаций
        if (this.settings.animations) {
            html.classList.remove('reduce-animations');
        } else {
            html.classList.add('reduce-animations');
        }

        // Обновляем активные кнопки
        this.updateActiveButtons();

        // Применяем настройки к Monaco редакторам
        this.applySettingsToMonacoEditors();

        // Применяем настройки к iframe
        const outputFrame = document.getElementById('output');
        if (outputFrame) {
            this.applySettingsToIframe(outputFrame);
        }

        console.log('Применены настройки доступности:', this.settings);
    }

    /**
     * Применение настроек к редакторам Monaco
     */
    applySettingsToMonacoEditors() {
        // Проверяем, существует ли объект monaco и его свойство editor
        if (typeof window.monaco === 'undefined' || typeof window.monaco.editor === 'undefined') {
            return;
        }

        const editors = window.monaco.editor.getEditors();
        if (!editors || editors.length === 0) {
            return;
        }

        // Определяем размер шрифта на основе текущих настроек
        let fontSize = 14; // Размер шрифта по умолчанию
        switch (this.settings.fontSize) {
            case 'large':
                fontSize = 18;
                break;
            case 'xlarge':
                fontSize = 22;
                break;
        }

        console.log(`[Accessibility] Применяем к Monaco только fontSize: ${fontSize}. Тема остается без изменений.`);

        // Применяем ТОЛЬКО размер шрифта ко всем редакторам
        editors.forEach(editor => {
            editor.updateOptions({ fontSize: fontSize });
        });

    }

    /**
     * Сохранение настроек в localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('accessibility-settings', JSON.stringify(this.settings));
            console.log('Настройки доступности сохранены');
        } catch (error) {
            console.error('Ошибка при сохранении настроек доступности:', error);
        }
    }

    /**
     * Загрузка настроек из localStorage
     */
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('accessibility-settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
                console.log('Настройки доступности загружены:', this.settings);
            }
        } catch (error) {
            console.error('Ошибка при загрузке настроек доступности:', error);
        }
    }

    /**
     * Сброс настроек к значениям по умолчанию
     */
    resetSettings() {
        this.settings = {
            fontSize: 'normal',
            contrast: 'normal',
            colorblind: 'normal',
            animations: true
        };

        this.applySettings();
        this.saveSettings();
        console.log('Настройки доступности сброшены к значениям по умолчанию');
    }
}
