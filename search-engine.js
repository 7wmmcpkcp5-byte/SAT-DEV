// scripts/search-engine.js
class SearchEngine {
    constructor() {
        this.maxResults = 1000; // Límite máximo de resultados por búsqueda
    }

    search(files, searchTerm, options = {}) {
        const {
            caseSensitive = false,
            contextLines = 2,
            maxResults = 100
        } = options;

        if (!searchTerm || files.length === 0) {
            return [];
        }

        const results = [];
        const searchRegex = this.createSearchRegex(searchTerm, caseSensitive);

        for (const file of files) {
            const fileResults = this.searchInFile(file, searchRegex, contextLines);
            results.push(...fileResults);
        }

        // Ordenar por número de línea (opcional: podríamos ordenar por relevancia en el futuro)
        results.sort((a, b) => a.lineNumber - b.lineNumber);

        // Limitar resultados
        return results.slice(0, Math.min(maxResults, this.maxResults));
    }

    searchInFile(file, searchRegex, contextLines) {
        const results = [];
        const lines = file.lines || [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const matches = line.match(searchRegex);

            if (matches) {
                const context = this.getContext(lines, i, contextLines);
                results.push({
                    file: file.name,
                    lineNumber: i + 1,
                    matchesCount: matches.length,
                    context: context,
                    originalLine: line
                });
            }
        }

        return results;
    }

    getContext(lines, currentIndex, contextLines) {
        const startLine = Math.max(0, currentIndex - contextLines);
        const endLine = Math.min(lines.length - 1, currentIndex + contextLines);

        const context = [];
        for (let i = startLine; i <= endLine; i++) {
            context.push({
                lineNumber: i + 1,
                content: lines[i],
                isMatch: i === currentIndex
            });
        }

        return context;
    }

    createSearchRegex(searchTerm, caseSensitive) {
        // Escapar caracteres especiales de regex
        const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = caseSensitive ? 'g' : 'gi';
        return new RegExp(escapedTerm, flags);
    }

    highlightMatches(text, searchTerm, caseSensitive) {
        if (!searchTerm) return text;

        const regex = this.createSearchRegex(searchTerm, caseSensitive);
        return text.replace(regex, match => `<span class="highlight">${match}</span>`);
    }

    // Método para búsqueda avanzada con múltiples términos
    advancedSearch(files, searchQuery, options) {
        // Por ahora, dividimos por espacios y buscamos cada término
        // En el futuro, podríamos implementar operadores lógicos (AND, OR, NOT)
        const terms = searchQuery.split(/\s+/).filter(term => term.length > 0);
        
        if (terms.length === 0) {
            return [];
        }

        // Buscar cada término y combinar resultados (AND)
        let results = [];
        for (const term of terms) {
            const termResults = this.search(files, term, options);
            if (results.length === 0) {
                results = termResults;
            } else {
                // Intersección de resultados: mismo archivo y misma línea
                results = results.filter(result => 
                    termResults.some(tr => 
                        tr.file === result.file && tr.lineNumber === result.lineNumber
                    )
                );
            }
        }

        return results;
    }

    // Método para obtener estadísticas de búsqueda
    getSearchStats(results, searchTerm) {
        const totalMatches = results.reduce((sum, result) => sum + result.matchesCount, 0);
        const filesWithMatches = [...new Set(results.map(result => result.file))].length;

        return {
            totalResults: results.length,
            totalMatches,
            filesWithMatches,
            searchTerm
        };
    }
}

export { SearchEngine };