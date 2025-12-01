// scripts/app.js
import { Storage } from './storage.js';
import { SearchEngine } from './search-engine.js';
import { UIManager } from './ui-manager.js';

class BuscadorProApp {
    constructor() {
        this.storage = new Storage();
        this.searchEngine = new SearchEngine();
        this.uiManager = new UIManager();
        
        this.loadedFiles = [];
        this.currentSearchTerm = '';
        this.searchOptions = {
            caseSensitive: false,
            contextLines: 2,
            maxResults: 100
        };
        
        this.init();
    }
    
    async init() {
        try {
            // Cargar estado previo
            await this.loadPreviousState();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            // Inicializar UI
            this.uiManager.showEmptyState('files');
            this.uiManager.showEmptyState('results');
            
            // Registrar service worker
            this.registerServiceWorker();
            
            console.log('Buscador Pro inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando la aplicación:', error);
            this.uiManager.showError('Error al inicializar la aplicación');
        }
    }
    
    async loadPreviousState() {
        const savedState = this.storage.getCurrentUser();
        if (savedState && savedState.loadedFiles) {
            this.loadedFiles = savedState.loadedFiles;
            this.uiManager.displayFileList(this.loadedFiles);
        }
        
        // Cargar configuraciones
        const settings = this.storage.getSettings();
        if (settings) {
            this.searchOptions = { ...this.searchOptions, ...settings.searchOptions };
            this.applySettingsToUI();
        }
    }
    
    setupEventListeners() {
        // Eventos de carga de archivos
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
        
        // Eventos de búsqueda
        document.getElementById('searchButton').addEventListener('click', () => {
            this.performSearch();
        });
        
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
        
        // Eventos de opciones de búsqueda
        document.getElementById('caseSensitive').addEventListener('change', (e) => {
            this.searchOptions.caseSensitive = e.target.checked;
            this.saveSettings();
            if (this.currentSearchTerm) {
                this.performSearch(); // Re-buscar si hay término actual
            }
        });
        
        document.getElementById('contextLines').addEventListener('change', (e) => {
            this.searchOptions.contextLines = parseInt(e.target.value);
            this.saveSettings();
            if (this.currentSearchTerm) {
                this.performSearch();
            }
        });
        
        document.getElementById('maxResults').addEventListener('change', (e) => {
            this.searchOptions.maxResults = parseInt(e.target.value);
            this.saveSettings();
            if (this.currentSearchTerm) {
                this.performSearch();
            }
        });
        
        // Eventos de modal de configuración
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettingsModal();
        });
        
        document.getElementById('closeSettings').addEventListener('click', () => {
            this.hideSettingsModal();
        });
        
        document.getElementById('autoBackup').addEventListener('change', (e) => {
            this.storage.config.autoBackup = e.target.checked;
            this.saveSettings();
        });
        
        document.getElementById('exportData').addEventListener('click', () => {
            this.exportUserData();
        });
        
        document.getElementById('importData').addEventListener('click', () => {
            this.importUserData();
        });
        
        // Cerrar modal al hacer clic fuera
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('settingsModal');
            if (e.target === modal) {
                this.hideSettingsModal();
            }
        });
        
        // Actualizar estado de conexión
        window.addEventListener('online', () => {
            this.updateConnectionStatus(true);
        });
        
        window.addEventListener('offline', () => {
            this.updateConnectionStatus(false);
        });
    }
    
    applySettingsToUI() {
        document.getElementById('caseSensitive').checked = this.searchOptions.caseSensitive;
        document.getElementById('contextLines').value = this.searchOptions.contextLines;
        document.getElementById('maxResults').value = this.searchOptions.maxResults;
        document.getElementById('autoBackup').checked = this.storage.config.autoBackup;
    }
    
    async handleFileUpload(fileList) {
        if (!fileList || fileList.length === 0) return;
        
        try {
            this.uiManager.showLoading('files', 'Cargando archivos...');
            
            const newFiles = [];
            const validFiles = Array.from(fileList).filter(file => 
                file.type === 'text/plain' || 
                file.name.match(/\.(txt|md|csv|log)$/i)
            );
            
            for (const file of validFiles) {
                try {
                    const fileData = await this.readFile(file);
                    newFiles.push(fileData);
                } catch (error) {
                    console.warn(`Error leyendo archivo ${file.name}:`, error);
                    this.uiManager.showError(`Error procesando ${file.name}`);
                }
            }
            
            // Evitar duplicados
            const existingNames = new Set(this.loadedFiles.map(f => f.name));
            const uniqueNewFiles = newFiles.filter(file => !existingNames.has(file.name));
            
            this.loadedFiles.push(...uniqueNewFiles);
            
            // Actualizar UI y guardar estado
            this.uiManager.displayFileList(this.loadedFiles);
            await this.saveCurrentState();
            
            if (uniqueNewFiles.length !== newFiles.length) {
                this.uiManager.showInfo('Algunos archivos duplicados fueron ignorados');
            }
            
        } catch (error) {
            console.error('Error en carga de archivos:', error);
            this.uiManager.showError('Error al cargar los archivos');
        }
    }
    
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    content: e.target.result,
                    lines: e.target.result.split('\n')
                });
            };
            
            reader.onerror = () => {
                reject(new Error(`No se pudo leer el archivo: ${file.name}`));
            };
            
            reader.readAsText(file);
        });
    }
    
    removeFile(fileName) {
        this.loadedFiles = this.loadedFiles.filter(file => file.name !== fileName);
        this.uiManager.displayFileList(this.loadedFiles);
        this.saveCurrentState();
        
        // Limpiar resultados si el archivo estaba en uso
        if (this.currentSearchTerm) {
            this.performSearch();
        }
    }
    
    async performSearch() {
        const searchTerm = document.getElementById('searchInput').value.trim();
        this.currentSearchTerm = searchTerm;
        
        if (!this.validateSearch(searchTerm)) return;
        
        try {
            this.uiManager.showLoading('results', 'Buscando...');
            
            // Pequeño delay para mostrar loading
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const results = this.searchEngine.search(
                this.loadedFiles,
                searchTerm,
                this.searchOptions
            );
            
            this.uiManager.displaySearchResults(results, searchTerm, this.searchOptions);
            
            // Guardar en historial
            await this.saveSearchToHistory(searchTerm, results.length);
            
        } catch (error) {
            console.error('Error en búsqueda:', error);
            this.uiManager.showError('Error al realizar la búsqueda');
        }
    }
    
    validateSearch(searchTerm) {
        if (!searchTerm) {
            this.uiManager.showError('Por favor, ingresa un término de búsqueda');
            return false;
        }
        
        if (this.loadedFiles.length === 0) {
            this.uiManager.showError('Primero carga algunos archivos de texto');
            return false;
        }
        
        if (searchTerm.length < 2) {
            this.uiManager.showError('El término de búsqueda debe tener al menos 2 caracteres');
            return false;
        }
        
        return true;
    }
    
    async saveCurrentState() {
        const userData = {
            loadedFiles: this.loadedFiles,
            lastAccess: new Date().toISOString(),
            version: '1.0'
        };
        
        return this.storage.saveUserProgress(userData);
    }
    
    saveSettings() {
        const settings = {
            searchOptions: this.searchOptions,
            uiSettings: {
                darkMode: document.getElementById('darkMode').checked
            }
        };
        
        this.storage.saveSettings(settings);
    }
    
    async saveSearchToHistory(searchTerm, resultCount) {
        const history = this.storage.getSearchHistory();
        history.unshift({
            term: searchTerm,
            results: resultCount,
            timestamp: new Date().toISOString(),
            filesCount: this.loadedFiles.length
        });
        
        // Mantener solo los últimos 50 registros
        const trimmedHistory = history.slice(0, 50);
        this.storage.saveSearchHistory(trimmedHistory);
    }
    
    showSettingsModal() {
        document.getElementById('settingsModal').style.display = 'block';
        setTimeout(() => {
            document.getElementById('settingsModal').style.opacity = '1';
        }, 10);
    }
    
    hideSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
    
    exportUserData() {
        const exportData = this.storage.exportUserData();
        if (!exportData) {
            this.uiManager.showError('No hay datos para exportar');
            return;
        }
        
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `buscador-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.uiManager.showInfo('Datos exportados correctamente');
    }
    
    importUserData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const success = this.storage.importUserData(event.target.result);
                    if (success) {
                        this.uiManager.showInfo('Datos importados correctamente');
                        location.reload(); // Recargar para aplicar cambios
                    } else {
                        this.uiManager.showError('Error al importar los datos');
                    }
                } catch (error) {
                    this.uiManager.showError('Formato de archivo inválido');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    updateConnectionStatus(online) {
        const indicator = document.getElementById('offlineStatus');
        if (online) {
            indicator.textContent = '🌐';
            indicator.title = 'En línea';
        } else {
            indicator.textContent = '📴';
            indicator.title = 'Sin conexión - Modo offline';
        }
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registrado correctamente');
            } catch (error) {
                console.warn('Error registrando Service Worker:', error);
            }
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new BuscadorProApp();
});

// Exportar para pruebas
export { BuscadorProApp };