import { getUserEmoji } from './utils.js';

/**
 * Инициализирует глобальные смайлик-курсоры и систему пометок для всех пользователей
 * @param {object} yAwareness - объект Yjs Awareness
 * @param {number} localClientID - ID текущего клиента
 */
export function setupGlobalCursors(yAwareness, localClientID) {
    const cursorLayerId = 'global-cursor-layer';
    let cursorLayer = document.getElementById(cursorLayerId);
    if (!cursorLayer) {
        cursorLayer = document.createElement('div');
        cursorLayer.id = cursorLayerId;
        cursorLayer.style.position = 'fixed';
        cursorLayer.style.left = '0';
        cursorLayer.style.top = '0';
        cursorLayer.style.width = '100vw';
        cursorLayer.style.height = '100vh';
        cursorLayer.style.pointerEvents = 'none';
        cursorLayer.style.zIndex = '9999';
        document.body.appendChild(cursorLayer);
    }



    // Кеш элементов курсоров для плавной анимации
    const cursorElements = new Map();
    
    // Таймауты для удаления неактивных курсоров
    const cursorTimeouts = new Map();

    function renderCursors() {
        const states = yAwareness.getStates();
        const currentClientIds = new Set();
        
        // Отладочный лог (ограничиваем частоту)
        if (Math.random() < 0.01) { // Показываем только 1% от всех обновлений
            console.log('[CursorOverlay] Состояния пользователей:', Array.from(states.entries()).map(([id, state]) => ({
                clientID: id, 
                hasUser: !!state.user, 
                hasMouse: !!state.mouse,
                user: state.user,
                mouse: state.mouse,
                isLocal: id === localClientID
            })));
        }
        
        // Сначала рендерим курсоры
        states.forEach((state, clientID) => {
            if (state.mouse && state.user && clientID !== localClientID) {
                currentClientIds.add(clientID);
                const { x, y, timestamp } = state.mouse;
                const name = state.user.name;
                const color = state.user.color;
                const emoji = getUserEmoji(name);

                // Очищаем таймаут для этого пользователя если он есть
                if (cursorTimeouts.has(clientID)) {
                    clearTimeout(cursorTimeouts.get(clientID));
                    cursorTimeouts.delete(clientID);
                }

                let cursorDiv = cursorElements.get(clientID);
                
                // Создаем новый элемент курсора если его нет
                if (!cursorDiv) {
                    cursorDiv = document.createElement('div');
                    cursorDiv.className = 'user-cursor';
                    cursorDiv.style.position = 'fixed';
                    cursorDiv.style.pointerEvents = 'none';
                    cursorDiv.style.zIndex = '10000';
                    cursorDiv.style.display = 'flex';
                    cursorDiv.style.alignItems = 'center';
                    
                    cursorDiv.innerHTML = `
                        <span class="cursor-emoji" style="font-size:2em; filter: drop-shadow(0 0 2px ${color});">${emoji}</span>
                        <span class="cursor-name" style="background:${color};color:#fff;padding:2px 6px;border-radius:4px;margin-left:6px;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,0.15);">${name}</span>
                    `;
                    
                    cursorLayer.appendChild(cursorDiv);
                    cursorElements.set(clientID, cursorDiv);
                }
                
                // Обновляем позицию с помощью transform для плавности
                cursorDiv.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
                
                // Устанавливаем таймаут для удаления неактивного курсора (10 секунд)
                const timeout = setTimeout(() => {
                    console.log(`[CursorOverlay] Удаляем неактивный курсор пользователя ${clientID}`);
                    const element = cursorElements.get(clientID);
                    if (element) {
                        element.remove();
                        cursorElements.delete(clientID);
                    }
                    cursorTimeouts.delete(clientID);
                }, 10000);
                
                cursorTimeouts.set(clientID, timeout);
            }
        });

        // Удаляем курсоры пользователей, которые больше не активны
        cursorElements.forEach((element, clientID) => {
            if (!currentClientIds.has(clientID)) {
                console.log(`[CursorOverlay] Удаляем курсор неактивного пользователя ${clientID}`);
                element.remove();
                cursorElements.delete(clientID);
                
                // Очищаем таймаут если он есть
                if (cursorTimeouts.has(clientID)) {
                    clearTimeout(cursorTimeouts.get(clientID));
                    cursorTimeouts.delete(clientID);
                }
            }
        });
    }

    // Обработка изменений в awareness (подключение/отключение пользователей)
    yAwareness.on('change', (changes) => {
        // Логируем изменения для отладки
        if (changes.removed.length > 0) {
            console.log('[CursorOverlay] Пользователи отключились:', changes.removed);
            
            // Удаляем курсоры отключившихся пользователей
            changes.removed.forEach(clientID => {
                const cursorElement = cursorElements.get(clientID);
                if (cursorElement) {
                    console.log(`[CursorOverlay] Удаляем курсор отключившегося пользователя ${clientID}`);
                    cursorElement.remove();
                    cursorElements.delete(clientID);
                }
                
                // Очищаем таймаут если он есть
                if (cursorTimeouts.has(clientID)) {
                    clearTimeout(cursorTimeouts.get(clientID));
                    cursorTimeouts.delete(clientID);
                }
            });
        }
        
        if (changes.added.length > 0) {
            console.log('[CursorOverlay] Пользователи подключились:', changes.added);
        }
        
        if (changes.updated.length > 0) {
            console.log('[CursorOverlay] Пользователи обновились:', changes.updated);
        }
        
        renderCursors();
    });
    
    renderCursors();
} 