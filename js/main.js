import { AppInitializer } from './app-initializer.js';
import { AccessibilityManager } from './accessibility.js';

// main.js
// Основной файл для инициализации приложения

/**
 * Инициализация базовых элементов приложения после загрузки DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('[MainJS] DOMContentLoaded - базовая инициализация...');

    // Проверка на мобильные устройства
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.body.classList.add('mobile-device');
        console.log('[MainJS] Обнаружено мобильное устройство.');
    }

    // Перехват глобальных ошибок
    window.addEventListener('error', (event) => {
        console.error('[MainJS] Необработанная ошибка:', event.error, event.message, event.filename, event.lineno);
    });

    console.log('[MainJS] Ожидание события "monaco_loaded"...');
});

/**
 * Инициализация компонентов, зависящих от Monaco, после его полной загрузки.
 */
window.addEventListener('monaco_loaded', () => {
    console.log('[MainJS] Событие "monaco_loaded" получено.');

    if (!window.monaco || !window.monaco.languages) {
        console.error('[MainJS] Monaco или monaco.languages не определены к моменту события monaco_loaded!');
        return; 
    }

    // Логируем языки, доступные сразу после monaco_loaded
    const initialLanguages = window.monaco.languages.getLanguages().map(l => l.id);
    console.log('[MainJS] Языки Monaco сразу после monaco_loaded:', initialLanguages);

    let htmlReady = initialLanguages.includes('html');
    let cssReady = initialLanguages.includes('css');
    let appInitialized = false;

    function tryInitializeApp() {
        if (htmlReady && cssReady && !appInitialized) {
            appInitialized = true;
            console.log('[MainJS] Языки HTML и CSS готовы. Инициализация основного приложения...');
            
            // Создаем экземпляр AppInitializer
            const appInitializerInstance = new AppInitializer();
            // Вызываем его метод init для запуска остальной логики приложения
            appInitializerInstance.init(); 
            // Делаем экземпляр глобально доступным
            window.appInitializer = appInitializerInstance;
            console.log('[MainJS] AppInitializer создан и его метод init() вызван.');

            window.accessibilityManager = new AccessibilityManager();
            console.log('[MainJS] AccessibilityManager инициализирован.');
        }
    }

    // Если языки уже готовы, сразу инициализируем
    tryInitializeApp();

    // Подписываемся на событие готовности языков, если они еще не готовы
    if (!htmlReady || !cssReady) {
        console.log('[MainJS] Не все языки готовы, ожидаем их загрузки...');
        
        // Проверяем языки периодически
        const checkLanguagesInterval = setInterval(() => {
            const currentLanguages = window.monaco.languages.getLanguages().map(l => l.id);
            htmlReady = currentLanguages.includes('html');
            cssReady = currentLanguages.includes('css');
            
            if (htmlReady && cssReady) {
                clearInterval(checkLanguagesInterval);
                tryInitializeApp();
            }
        }, 100);
        
        // Таймаут на случай, если языки не загрузятся
        setTimeout(() => {
            clearInterval(checkLanguagesInterval);
            if (!appInitialized) {
                console.warn('[MainJS] Таймаут ожидания языков Monaco, принудительная инициализация...');
                appInitialized = true;
                const appInitializerInstance = new AppInitializer();
                appInitializerInstance.init();
                window.appInitializer = appInitializerInstance;
                window.accessibilityManager = new AccessibilityManager();
            }
        }, 5000);
    }
});

// Функция для обновления счетчика пользователей (будет вызвана из AppInitializer)
window.setupOnlineUsersCounter = () => {
    if (window.socketService) {
        window.socketService.onOnlineUsersCount((count) => {
            const onlineCountElement = document.getElementById('online-count');
            if (onlineCountElement) {
                onlineCountElement.textContent = count;
                console.log('[MainJS] Счетчик пользователей обновлен:', count);
            }
        });
    }
};

