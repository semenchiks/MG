/**
 * Socket.IO провайдер для Yjs
 * Используется в продакшене когда WebSocket недоступен
 */
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness.js';

export class SocketIOProvider {
    constructor(socket, roomname, ydoc, options = {}) {
        this.socket = socket;
        this.roomname = roomname;
        this.doc = ydoc;
        this.awareness = options.awareness || new awarenessProtocol.Awareness(ydoc);
        this.connected = false;
        this.synced = false;
        
        this._setupEventListeners();
        this._connect();
    }

    _setupEventListeners() {
        // Обработка обновлений документа
        this.doc.on('update', (update, origin) => {
            if (origin !== this) {
                this.socket.emit('yjs-sync', {
                    docName: this.roomname,
                    update: Array.from(update)
                });
            }
        });

        // Обработка awareness обновлений
        this.awareness.on('update', ({ added, updated, removed }) => {
            const states = {};
            added.concat(updated).forEach(clientID => {
                states[clientID] = this.awareness.getStates().get(clientID);
            });

            this.socket.emit('yjs-awareness', {
                docName: this.roomname,
                states,
                removed
            });
        });

        // Обработка Socket.IO событий
        this.socket.on('yjs-sync', (data) => {
            if (data.docName === this.roomname && data.state) {
                Y.applyUpdate(this.doc, new Uint8Array(data.state), this);
                this.synced = true;
                this._emit('sync', true);
            }
        });

        this.socket.on('yjs-update', (data) => {
            if (data.docName === this.roomname && data.update) {
                Y.applyUpdate(this.doc, new Uint8Array(data.update), this);
            }
        });

        this.socket.on('yjs-awareness', (data) => {
            if (data.docName === this.roomname) {
                // Обновляем локальные состояния awareness
                Object.entries(data.states).forEach(([clientID, state]) => {
                    const id = parseInt(clientID);
                    // Используем правильный API для установки состояния
                    this.awareness.getStates().set(id, state);
                });

                // Удаляем отключившихся пользователей
                if (data.removed && data.removed.length > 0) {
                    data.removed.forEach(clientID => {
                        this.awareness.getStates().delete(parseInt(clientID));
                    });
                }
                
                // Эмулируем событие change для awareness
                this.awareness.emit('change', {
                    added: Object.keys(data.states).map(id => parseInt(id)),
                    updated: [],
                    removed: data.removed || []
                });
            }
        });

        this.socket.on('connect', () => {
            this.connected = true;
            this._emit('status', { status: 'connected' });
            this._connect();
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this.synced = false;
            this._emit('status', { status: 'disconnected' });
        });
    }

    _connect() {
        if (this.connected) {
            this.socket.emit('yjs-join', this.roomname);
        }
    }

    _emit(eventName, data) {
        // Эмулируем события для совместимости с WebsocketProvider
        if (this._listeners && this._listeners[eventName]) {
            this._listeners[eventName].forEach(callback => callback(data));
        }
    }

    on(eventName, callback) {
        if (!this._listeners) {
            this._listeners = {};
        }
        if (!this._listeners[eventName]) {
            this._listeners[eventName] = [];
        }
        this._listeners[eventName].push(callback);
    }

    destroy() {
        if (this.socket) {
            this.socket.off('yjs-sync');
            this.socket.off('yjs-update');
        }
        this.connected = false;
        this.synced = false;
    }

    // Геттеры для совместимости
    get wsconnected() {
        return this.connected;
    }

    disconnect() {
        this.destroy();
    }
}
