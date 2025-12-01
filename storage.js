// scripts/storage.js
class StorageSystem {
    constructor() {
        this.config = {
            userKey: 'buscador_pro_user_v1',
            backupKey: 'buscador_pro_backup',
            settingsKey: 'buscador_pro_settings',
            historyKey: 'buscador_pro_history',
            autoBackup: true,
            backupInterval: 30000 // 30 segundos
        };
        
        this.init();
    }

    init() {
        // Auto-backup periódico
        if (this.config.autoBackup) {
            setInterval(() => {
                this.createBackup();
            }, this.config.backupInterval);
        }
    }

    // === GESTIÓN DE DATOS DE USUARIO ===
    saveUserProgress(userData) {
        try {
            const dataToSave = {
                ...userData,
                lastUpdated: new Date().toISOString(),
                version: '1.0'
            };

            localStorage.setItem(this.config.userKey, JSON.stringify(dataToSave));
            
            // Auto-backup en cada guardado importante
            if (this.config.autoBackup) {
                this.createBackup();
            }

            return true;
        } catch (error) {
            console.error('Error guardando progreso:', error);
            return false;
        }
    }

    getCurrentUser() {
        try {
            const userData = localStorage.getItem(this.config.userKey);
            if (!userData) return null;

            const parsed = JSON.parse(userData);
            return this.migrateUserData(parsed);
        } catch (error) {
            console.error('Error cargando datos de usuario:', error);
            return null;
        }
    }

    migrateUserData(userData) {
        // Migraciones futuras si es necesario
        if (!userData.version) {
            return {
                ...userData,
                version: '1.0',
                loadedFiles: userData.loadedFiles || []
            };
        }

        return userData;
    }

    // === SISTEMA DE BACKUP ===
    createBackup() {
        try {
            const userData = this.getCurrentUser();
            if (!userData) return false;

            const backup = {
                data: userData,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };

            localStorage.setItem(this.config.backupKey, JSON.stringify(backup));
            return true;
        } catch (error) {
            console.error('Error creando backup:', error);
            return false;
        }
    }

    restoreBackup() {
        try {
            const backupData = localStorage.getItem(this.config.backupKey);
            if (!backupData) return false;

            const backup = JSON.parse(backupData);
            
            if (this.validateUserData(backup.data)) {
                localStorage.setItem(this.config.userKey, JSON.stringify(backup.data));
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error restaurando backup:', error);
            return false;
        }
    }

    // === CONFIGURACIONES ===
    saveSettings(settings) {
        try {
            const settingsToSave = {
                ...settings,
                lastModified: new Date().toISOString()
            };

            localStorage.setItem(this.config.settingsKey, JSON.stringify(settingsToSave));
            return true;
        } catch (error) {
            console.error('Error guardando configuraciones:', error);
            return false;
        }
    }

    getSettings() {
        try {
            const settings = localStorage.getItem(this.config.settingsKey);
            return settings ? JSON.parse(settings) : null;
        } catch (error) {
            console.error('Error cargando configuraciones:', error);
            return null;
        }
    }

    // === HISTORIAL DE BÚSQUEDAS ===
    saveSearchHistory(history) {
        try {
            localStorage.setItem(this.config.historyKey, JSON.stringify(history));
            return true;
        } catch (error) {
            console.error('Error guardando historial:', error);
            return false;
        }
    }

    getSearchHistory() {
        try {
            const history = localStorage.getItem(this.config.historyKey);
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error cargando historial:', error);
            return [];
        }
    }

    clearSearchHistory() {
        try {
            localStorage.removeItem(this.config.historyKey);
            return true;
        } catch (error) {
            console.error('Error limpiando historial:', error);
            return false;
        }
    }

    // === VALIDACIÓN DE DATOS ===
    validateUserData(userData) {
        const requiredFields = ['loadedFiles', 'version'];
        return requiredFields.every(field => userData.hasOwnProperty(field));
    }

    // === EXPORTAR/IMPORTAR ===
    exportUserData() {
        const userData = this.getCurrentUser();
        const settings = this.getSettings();
        const history = this.getSearchHistory();

        if (!userData && !settings && history.length === 0) {
            return null;
        }

        const exportData = {
            userData,
            settings,
            history,
            exportDate: new Date().toISOString(),
            exportVersion: '1.0'
        };

        return JSON.stringify(exportData, null, 2);
    }

    importUserData(jsonData) {
        try {
            const importedData = JSON.parse(jsonData);
            
            if (importedData.userData && this.validateUserData(importedData.userData)) {
                localStorage.setItem(this.config.userKey, JSON.stringify(importedData.userData));
            }
            
            if (importedData.settings) {
                localStorage.setItem(this.config.settingsKey, JSON.stringify(importedData.settings));
            }
            
            if (importedData.history) {
                localStorage.setItem(this.config.historyKey, JSON.stringify(importedData.history));
            }
            
            return true;
        } catch (error) {
            console.error('Error importando datos:', error);
            return false;
        }
    }

    // === LIMPIEZA ===
    clearAllData() {
        try {
            localStorage.removeItem(this.config.userKey);
            localStorage.removeItem(this.config.backupKey);
            localStorage.removeItem(this.config.settingsKey);
            localStorage.removeItem(this.config.historyKey);
            return true;
        } catch (error) {
            console.error('Error limpiando datos:', error);
            return false;
        }
    }

    clearFiles() {
        try {
            const userData = this.getCurrentUser();
            if (userData) {
                userData.loadedFiles = [];
                this.saveUserProgress(userData);
            }
            return true;
        } catch (error) {
            console.error('Error limpiando archivos:', error);
            return false;
        }
    }

    // === INFORMACIÓN DE ALMACENAMIENTO ===
    getStorageInfo() {
        const userData = localStorage.getItem(this.config.userKey);
        const backupData = localStorage.getItem(this.config.backupKey);
        const settingsData = localStorage.getItem(this.config.settingsKey);
        const historyData = localStorage.getItem(this.config.historyKey);
        
        const sizes = {
            userData: userData ? userData.length : 0,
            backupData: backupData ? backupData.length : 0,
            settingsData: settingsData ? settingsData.length : 0,
            historyData: historyData ? historyData.length : 0
        };
        
        const totalSize = Object.values(sizes).reduce((sum, size) => sum + size, 0);
        
        return {
            ...sizes,
            totalSize,
            lastBackup: backupData ? JSON.parse(backupData).timestamp : null
        };
    }

    // === COMPROBACIÓN DE COMPATIBILIDAD ===
    isStorageAvailable() {
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            console.error('LocalStorage no disponible:', error);
            return false;
        }
    }

    // === GESTIÓN DE ARCHIVOS ESPECÍFICA ===
    updateFileContent(fileName, newContent) {
        try {
            const userData = this.getCurrentUser();
            if (!userData || !userData.loadedFiles) return false;

            const fileIndex = userData.loadedFiles.findIndex(file => file.name === fileName);
            if (fileIndex === -1) return false;

            userData.loadedFiles[fileIndex].content = newContent;
            userData.loadedFiles[fileIndex].lines = newContent.split('\n');
            userData.loadedFiles[fileIndex].lastModified = new Date().toISOString();

            return this.saveUserProgress(userData);
        } catch (error) {
            console.error('Error actualizando archivo:', error);
            return false;
        }
    }

    getFileByName(fileName) {
        const userData = this.getCurrentUser();
        if (!userData || !userData.loadedFiles) return null;
        
        return userData.loadedFiles.find(file => file.name === fileName);
    }

    getTotalFilesSize() {
        const userData = this.getCurrentUser();
        if (!userData || !userData.loadedFiles) return 0;
        
        return userData.loadedFiles.reduce((total, file) => total + (file.size || 0), 0);
    }
}

// Singleton pattern para asegurar una única instancia
const Storage = new StorageSystem();
export { Storage };