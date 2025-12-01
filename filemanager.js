// scripts/fileManager.js
import { formatFileSize } from '../utils/helpers.js';

export class FileManager {
    constructor() {
        this.loadedFiles = [];
    }
    
    async loadFiles(fileList) {
        this.loadedFiles = [];
        
        const filePromises = Array.from(fileList).map(file => 
            this.readFile(file)
        );
        
        const results = await Promise.allSettled(filePromises);
        
        // Procesar resultados exitosos
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                this.loadedFiles.push(result.value);
            } else {
                console.warn(`Error al cargar archivo ${fileList[index].name}:`, result.reason);
            }
        });
        
        return this.loadedFiles;
    }
    
    readFile(file) {
        return new Promise((resolve, reject) => {
            if (!this.isTextFile(file)) {
                reject(new Error(`El archivo ${file.name} no es un archivo de texto válido.`));
                return;
            }
            
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve({
                    name: file.name,
                    content: e.target.result,
                    size: file.size,
                    formattedSize: formatFileSize(file.size),
                    lines: e.target.result.split('\n')
                });
            };
            
            reader.onerror = () => {
                reject(new Error(`Error al leer el archivo ${file.name}`));
            };
            
            reader.readAsText(file);
        });
    }
    
    isTextFile(file) {
        return file.type === "text/plain" || file.name.toLowerCase().endsWith('.txt');
    }
    
    getLoadedFiles() {
        return this.loadedFiles;
    }
    
    getFileCount() {
        return this.loadedFiles.length;
    }
    
    clearFiles() {
        this.loadedFiles = [];
    }
    
    getFileByName(filename) {
        return this.loadedFiles.find(file => file.name === filename);
    }
}