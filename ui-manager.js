// scripts/ui-manager.js
class UIManager {
    constructor() {
        this.elements = {
            fileList: document.getElementById('fileList'),
            searchResults: document.getElementById('searchResults'),
            resultsHeader: document.getElementById('resultsHeader'),
            resultsStats: document.getElementById('resultsStats')
        };
    }

    // === GESTIÓN DE ARCHIVOS ===
    displayFileList(files) {
        const container = this.elements.fileList;
        
        if (files.length === 0) {
            this.showEmptyState('files');
            return;
        }

        const filesHTML = files.map(file => this.createFileItemHTML(file)).join('');
        container.innerHTML = filesHTML;
    }

    createFileItemHTML(file) {
        const size = this.formatFileSize(file.size);
        return `
            <div class="file-item" data-filename="${file.name}">
                <div class="file-info">
                    <div class="file-name">${this.escapeHTML(file.name)}</div>
                    <div class="file-meta">
                        <span class="file-size">${size}</span>
                        <span class="file-lines">${file.lines ? file.lines.length : 0} líneas</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-small remove-file" title="Eliminar archivo">🗑️</button>
                </div>
            </div>
        `;
    }

    // === GESTIÓN DE RESULTADOS DE BÚSQUEDA ===
    displaySearchResults(results, searchTerm, options) {
        const container = this.elements.searchResults;
        const header = this.elements.resultsHeader;
        const stats = this.elements.resultsStats;

        if (results.length === 0) {
            this.showEmptyState('results', searchTerm);
            header.style.display = 'none';
            return;
        }

        // Mostrar estadísticas
        const statsInfo = this.calculateResultsStats(results);
        stats.textContent = `${results.length} resultados en ${statsInfo.filesCount} archivos - ${statsInfo.totalMatches} coincidencias`;

        // Generar HTML de resultados
        const resultsHTML = results.map(result => 
            this.createResultItemHTML(result, searchTerm, options)
        ).join('');

        container.innerHTML = resultsHTML;
        header.style.display = 'flex';

        // Añadir event listeners para las acciones de resultado
        this.attachResultEventListeners();
    }

    createResultItemHTML(result, searchTerm, options) {
        const contextHTML = result.context.map(contextLine => 
            this.createContextLineHTML(contextLine, searchTerm, options.caseSensitive)
        ).join('');

        return `
            <div class="result-item" data-filename="${result.file}" data-line="${result.lineNumber}">
                <div class="result-header">
                    <div class="result-file">${this.escapeHTML(result.file)}</div>
                    <div class="result-meta">
                        <span class="result-line">Línea ${result.lineNumber}</span>
                        <span class="result-matches">${result.matchesCount} coincidencia(s)</span>
                    </div>
                </div>
                <div class="result-context">${contextHTML}</div>
            </div>
        `;
    }

    createContextLineHTML(contextLine, searchTerm, caseSensitive) {
        const highlightedContent = this.highlightText(contextLine.content, searchTerm, caseSensitive);
        const lineClass = contextLine.isMatch ? 'context-line match-line' : 'context-line';
        
        return `
            <div class="${lineClass}">
                <span class="line-number">${contextLine.lineNumber}</span>
                ${highlightedContent}
            </div>
        `;
    }

    highlightText(text, searchTerm, caseSensitive) {
        if (!searchTerm) return this.escapeHTML(text);

        const regex = new RegExp(this.escapeRegExp(searchTerm), caseSensitive ? 'g' : 'gi');
        return this.escapeHTML(text).replace(regex, match => 
            `<span class="highlight">${match}</span>`
        );
    }

    calculateResultsStats(results) {
        const filesCount = new Set(results.map(result => result.file)).size;
        const totalMatches = results.reduce((sum, result) => sum + result.matchesCount, 0);
        
        return {
            filesCount,
            totalMatches
        };
    }

    // === ESTADOS DE LA UI ===
    showEmptyState(section, searchTerm = '') {
        const emptyStates = {
            files: {
                icon: '📁',
                title: 'No hay archivos cargados',
                description: 'Selecciona archivos para comenzar'
            },
            results: {
                icon: '🔍',
                title: searchTerm ? `No se encontraron resultados para "${searchTerm}"` : 'Ingresa un término de búsqueda',
                description: searchTerm ? 'Intenta con otros términos o ajusta las opciones de búsqueda' : 'Los resultados aparecerán aquí'
            }
        };

        const state = emptyStates[section];
        const container = section === 'files' ? this.elements.fileList : this.elements.searchResults;

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${state.icon}</div>
                <p class="empty-text">${state.title}</p>
                <p class="empty-hint">${state.description}</p>
            </div>
        `;
    }

    showLoading(section, message = 'Cargando...') {
        const container = section === 'files' ? this.elements.fileList : this.elements.searchResults;
        
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p class="loading-text">${message}</p>
            </div>
        `;
    }

    // === NOTIFICACIONES Y MENSAJES ===
    showError(message) {
        this.showNotification(message, 'error');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        // Crear notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;

        // Estilos para la notificación
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'error' ? '#f8d7da' : '#d1ecf1',
            color: type === 'error' ? '#721c24' : '#0c5460',
            padding: '12px 16px',
            borderRadius: '6px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: '10000',
            maxWidth: '400px',
            border: `1px solid ${type === 'error' ? '#f5c6cb' : '#bee5eb'}`,
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        document.body.appendChild(notification);

        // Animación de entrada
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // === EVENT LISTENERS ===
    attachResultEventListeners() {
        // Event listeners para acciones de archivo (como eliminar)
        document.querySelectorAll('.remove-file').forEach(button => {
            button.addEventListener('click', (e) => {
                const fileItem = e.target.closest('.file-item');
                const fileName = fileItem.dataset.filename;
                this.trigger('fileRemove', { fileName });
            });
        });
    }

    // === UTILIDADES ===
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // === SISTEMA DE EVENTOS ===
    on(event, callback) {
        this._events = this._events || {};
        this._events[event] = this._events[event] || [];
        this._events[event].push(callback);
    }

    trigger(event, data) {
        if (this._events && this._events[event]) {
            this._events[event].forEach(callback => callback(data));
        }
    }
}

export { UIManager };