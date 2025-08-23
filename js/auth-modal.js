// auth-modal.js
// Модуль для управления формой авторизации

import { showNotification } from './utils.js';

/**
 * Класс для управления модальным окном авторизации
 */
export class AuthModal {
    /**
     * Конструктор класса AuthModal
     * @param {Object} socketService - Экземпляр сервиса сокетов
     * @param {Object} codeEditorManager - Экземпляр менеджера редакторов кода
     */
    constructor(socketService, codeEditorManager) {
        this.socketService = socketService;
        this.codeEditorManager = codeEditorManager;
        this.loginFormModal = null;
        this.loginForm = null;
        this.userNameInput = null;
        this.errorMsg = null;
        this.loginSubmitBtn = null;
        this.initialized = false;

        // Инициализация
        this._initialize();
    }

    /**
     * Инициализация модального окна
     * @private
     */
    _initialize() {
        try {
            console.log('[AuthModal] _initialize: Начало');
            this.loginFormModal = document.getElementById('login-form-modal');
            this.loginForm = document.getElementById('login-form');
            this.userNameInput = document.getElementById('user-name');
            this.errorMsg = document.getElementById('error-notification');
            this.loginSubmitBtn = document.getElementById('login-submit-btn');

            if (!this.loginFormModal) {
                console.error('Модальное окно формы входа не найдено (login-form-modal)');
            }
            if (!this.loginForm) {
                console.error('Форма входа не найдена (login-form)');
            }
            if (!this.userNameInput) {
                console.error('Поле ввода имени пользователя не найдено (user-name)');
            }
            if (!this.loginSubmitBtn) {
                console.error('Кнопка отправки формы входа не найдена (login-submit-btn)');
            }

            // Настраиваем обработчики событий
            this._setupEventListeners();

            // Показываем форму входа
            this.showLoginForm();

            // Устанавливаем флаг инициализации
            this.initialized = true;

            console.log('Модальное окно авторизации успешно инициализировано');
        } catch (error) {
            console.error('Ошибка при инициализации модального окна авторизации:', error);
        }
    }

    /**
     * Показать форму входа
     */
    showLoginForm() {
        console.log('Показываем форму входа');

        if (this.loginFormModal) {
            console.log('Модальное окно формы входа найдено, устанавливаем display: flex');
            this.loginFormModal.style.display = 'flex';
        } else {
            console.error('Модальное окно формы входа не найдено');
        }
    }

    /**
     * Скрыть модальное окно входа
     */
    hideLoginModals() {
        console.log('[AuthModal] hideLoginModals: Начало');
        if (this.loginFormModal) {
            this.loginFormModal.style.display = 'none';
            console.log('[AuthModal] hideLoginModals: loginFormModal скрыт.');
        } else {
            console.warn('[AuthModal] hideLoginModals: loginFormModal не найден.');
        }
        
        // Показываем основной контейнер
        this._showMainContainerAfterAuth();
        
        console.log('[AuthModal] hideLoginModals: Завершение');
    }

    /**
     * Показываем основной контейнер после авторизации
     * @private
     */
    _showMainContainerAfterAuth() {
        // Показываем основной контейнер
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = 'flex';
        }

        console.log('Основной контейнер показан после успешной авторизации');
    }

    /**
     * Выход из системы
     */
    logout() {
        console.log('Выход из системы...');
        
        if (this.socketService) {
            this.socketService.socket?.disconnect();
        }

        // Скрываем основной контейнер
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.display = 'none';
        }

        // Показываем форму входа
        this.showLoginForm();

        // Очищаем поле имени пользователя
        if (this.userNameInput) {
            this.userNameInput.value = '';
        }

        // Очищаем ошибку
        this._hideError();

        console.log('Выход выполнен');
    }

    /**
     * Настройка обработчиков событий
     * @private
     */
    _setupEventListeners() {
        // Обработчик отправки формы
        if (this.loginSubmitBtn) {
            this.loginSubmitBtn.addEventListener('click', (event) => {
                this._handleLoginSubmit(event);
            });
        }

        // Обработчик Enter в поле ввода имени
        if (this.userNameInput) {
            this.userNameInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this._handleLoginSubmit(event);
                }
            });
        }

        // Скрытие ошибки при вводе
        if (this.userNameInput) {
            this.userNameInput.addEventListener('input', () => {
                this._hideError();
            });
        }
    }

    /**
     * Обработка отправки формы входа
     * @private
     */
    _handleLoginSubmit(event) {
        event.preventDefault();

        const userName = this.userNameInput?.value?.trim();

        if (!userName) {
            this._showError('Пожалуйста, введите ваше имя');
            return;
        }

        if (userName.length < 2) {
            this._showError('Имя должно содержать минимум 2 символа');
            return;
        }

        if (userName.length > 30) {
            this._showError('Имя не должно превышать 30 символов');
            return;
        }

        console.log('[AuthModal] Попытка авторизации с именем:', userName);

        // Отключаем кнопку во время авторизации
        if (this.loginSubmitBtn) {
            this.loginSubmitBtn.disabled = true;
            this.loginSubmitBtn.textContent = 'Подключение...';
        }

        // Авторизация через сокет сервис
        this.socketService.authorize(userName, (response) => {
            // Включаем кнопку обратно
            if (this.loginSubmitBtn) {
                this.loginSubmitBtn.disabled = false;
                this.loginSubmitBtn.textContent = 'Войти';
            }

            if (response.success) {
                console.log('[AuthModal] Авторизация успешна');
                this.hideLoginModals();
                showNotification(`Добро пожаловать, ${userName}!`, 'success');
            } else {
                console.error('[AuthModal] Ошибка авторизации:', response.message);
                this._showError(response.message || 'Ошибка подключения');
            }
        });
    }

    /**
     * Показать ошибку
     * @private
     */
    _showError(message) {
        if (this.errorMsg) {
            this.errorMsg.textContent = message;
            this.errorMsg.style.display = 'block';
        }
    }

    /**
     * Скрыть ошибку
     * @private
     */
    _hideError() {
        if (this.errorMsg) {
            this.errorMsg.style.display = 'none';
            this.errorMsg.textContent = '';
        }
    }
}