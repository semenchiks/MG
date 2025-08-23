// utils.js
// Вспомогательные функции, используемые в разных частях приложения

/**
 * Функция для дебаунсинга - ограничивает частоту вызова функции
 * @param {Function} func - Функция для выполнения
 * @param {number} wait - Время ожидания в мс
 * @return {Function} - Функция с дебаунсингом
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Функция для троттлинга - гарантирует, что функция не будет вызываться чаще, чем раз в указанный период
 * @param {Function} func - Функция для выполнения
 * @param {number} limit - Минимальный интервал между вызовами в мс
 * @return {Function} - Функция с троттлингом
 */
export const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Валидация HTML кода
 * @param {string} html - Код HTML для проверки
 * @return {boolean} - Валиден ли код
 */
export const validateHTML = (html) => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        return doc.querySelector('parsererror') === null;
    } catch (e) {
        console.error('Ошибка валидации HTML:', e);
        return false;
    }
};

/**
 * Валидация CSS кода
 * @param {string} css - Код CSS для проверки
 * @return {boolean} - Валиден ли код
 */
export const validateCSS = (css) => {
    try {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
        document.head.removeChild(style);
        return true;
    } catch (e) {
        console.error('Ошибка валидации CSS:', e);
        return false;
    }
};

/**
 * Безопасная обработка JSON данных
 * @param {string} data - Строка JSON для парсинга
 * @param {*} defaultValue - Значение по умолчанию в случае ошибки
 * @return {*} - Результат парсинга или значение по умолчанию
 */
export const safeJSONParse = (data, defaultValue = null) => {
    try {
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error('Ошибка при парсинге JSON:', error);
        return defaultValue;
    }
};

/**
 * Функция для повторения операции с задержкой в случае неудачи
 * @param {Function} operation - Функция, которую нужно выполнить
 * @param {number} maxRetries - Максимальное количество повторов (по умолчанию 3)
 * @param {number} delay - Задержка между повторами в мс (по умолчанию 1000)
 * @param {number} backoff - Коэффициент увеличения задержки (по умолчанию 1.5)
 * @return {Promise} - Промис с результатом выполнения
 */
export const retryOperation = async (operation, maxRetries = 3, delay = 1000, backoff = 1.5) => {
    let retries = 0;
    let currentDelay = delay;
    
    while (true) {
        try {
            return await operation();
        } catch (error) {
            retries++;
            
            if (retries >= maxRetries) {
                console.error(`Операция не удалась после ${maxRetries} попыток:`, error);
                throw error;
            }
            
            console.warn(`Попытка ${retries}/${maxRetries} не удалась, повтор через ${currentDelay}ms:`, error);
            
            // Ждем перед следующей попыткой
            await new Promise(resolve => setTimeout(resolve, currentDelay));
            
            // Увеличиваем задержку для следующей попытки
            currentDelay *= backoff;
        }
    }
};

/**
 * Показывает уведомление
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип уведомления ('success' или 'error')
 * @param {number} duration - Длительность показа в мс
 */
export const showNotification = (message, type = 'success', duration = 3000) => {
    // Только логируем сообщение, без отображения уведомлений
    console.log(`[Notification] ${type}: ${message}`);
};

/**
 * Показывает уведомление о слиянии изменений
 * @param {string} teamName - Имя команды, чьи изменения были объединены
 * @param {string} language - Язык редактора ('html' или 'css')
 */
export const showMergeNotification = (teamName, language) => {
    // Только логируем сообщение, без отображения уведомлений
    const languageName = language.toUpperCase();
    const message = `Изменения ${languageName} от команды "${teamName}" были объединены с вашими`;
    console.log(`[Notification] merge: ${message}`);
};

/**
 * Генерирует смайлик (эмодзи) на основе имени пользователя
 * @param {string} name - Имя пользователя
 * @returns {string} - Эмодзи
 */
export function getUserEmoji(name) {
    const emojis = ['😀','😎','🐱','🦊','🐯','🐤','🦁','🐹','🐲','🐉'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return emojis[Math.abs(hash) % emojis.length];
} 