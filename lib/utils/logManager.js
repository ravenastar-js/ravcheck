const fs = require('fs');
const path = require('path');
const { colors } = require('../config/colors');

/**
 * 📁 Gerenciador de logs e arquivos temporários
 * Organiza arquivos em subcategorias e permite limpeza
 * @class LogManager
 */
class LogManager {
    /**
     * Cria uma instância do LogManager
     * @constructor
     */
    constructor() {
        this.baseDir = path.join(__dirname, '..', '..');
        this.logsDir = path.join(this.baseDir, 'logs');
        this.setupLogsStructure();
    }

    /**
     * Configura a estrutura completa de diretórios de logs
     * @private
     */
    setupLogsStructure() {
        const subDirs = [
            'erros',
            'sucesso',
            'csv',
            'json',
            'tmp',
            'debug',
            'relatorios'
        ];

        // Cria diretório principal se não existir
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }

        // Cria subdiretórios
        subDirs.forEach(subDir => {
            const dirPath = path.join(this.logsDir, subDir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        });
    }

    /**
     * Salva um arquivo na estrutura organizada
     * @param {string} category - Categoria (erros, sucesso, csv, json, etc)
     * @param {string} filename - Nome do arquivo
     * @param {string|Buffer} content - Conteúdo do arquivo
     * @param {Object} options - Opções adicionais
     * @returns {string} Caminho completo do arquivo salvo
     */
    saveToCategory(category, filename, content, options = {}) {
        const categoryDir = path.join(this.logsDir, category);

        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }

        const filePath = path.join(categoryDir, filename);

        try {
            if (options.json && typeof content === 'object') {
                fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
            } else if (options.csv && Array.isArray(content)) {
                fs.writeFileSync(filePath, content, 'utf8');
            } else {
                fs.writeFileSync(filePath, content, 'utf8');
            }

            return filePath;
        } catch (error) {
            console.error(colors.error(`❌ Erro ao salvar arquivo ${filename}:`), error);
            return null;
        }
    }

    /**
     * Limpa todos os arquivos da estrutura de logs
     * @param {boolean} confirm - Confirmação de segurança
     * @returns {Object} Resultado da limpeza
     */
    clearAllLogs(confirm = false) {
        if (!confirm) {
            return { success: false, message: '❌ Confirmação necessária para limpeza' };
        }

        try {
            let totalFiles = 0;
            let totalSize = 0;

            // Função recursiva para limpar diretórios
            const clearDirectory = (dirPath) => {
                if (!fs.existsSync(dirPath)) return;

                const items = fs.readdirSync(dirPath);

                items.forEach(item => {
                    const itemPath = path.join(dirPath, item);
                    const stats = fs.statSync(itemPath);

                    if (stats.isDirectory()) {
                        clearDirectory(itemPath);
                        // Remove diretório vazio
                        if (fs.readdirSync(itemPath).length === 0) {
                            fs.rmdirSync(itemPath);
                        }
                    } else {
                        totalFiles++;
                        totalSize += stats.size;
                        fs.unlinkSync(itemPath);
                    }
                });
            };

            clearDirectory(this.logsDir);

            // Recria estrutura vazia
            this.setupLogsStructure();

            return {
                success: true,
                message: `🧹 Limpeza completa! ${totalFiles} arquivos removidos (${this.formatBytes(totalSize)})`,
                stats: { files: totalFiles, size: totalSize }
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Erro na limpeza: ${error.message}`,
                error: error
            };
        }
    }

    /**
     * Obtém estatísticas dos logs
     * @returns {Object} Estatísticas dos arquivos de log
     */
    getLogStats() {
        try {
            let stats = {
                totalFiles: 0,
                totalSize: 0,
                categories: {},
                recentFiles: []
            };

            const scanDirectory = (dirPath, category = '') => {
                if (!fs.existsSync(dirPath)) return;

                const items = fs.readdirSync(dirPath);

                items.forEach(item => {
                    const itemPath = path.join(dirPath, item);
                    const itemStat = fs.statSync(itemPath);

                    if (itemStat.isDirectory()) {
                        const subCategory = category ? `${category}/${item}` : item;
                        scanDirectory(itemPath, subCategory);
                    } else {
                        stats.totalFiles++;
                        stats.totalSize += itemStat.size;

                        const fileInfo = {
                            name: item,
                            path: category ? `${category}/${item}` : item,
                            size: itemStat.size,
                            modified: itemStat.mtime,
                            category: category || 'root'
                        };

                        stats.recentFiles.push(fileInfo);

                        // Agrupar por categoria
                        if (!stats.categories[category || 'root']) {
                            stats.categories[category || 'root'] = { files: 0, size: 0 };
                        }
                        stats.categories[category || 'root'].files++;
                        stats.categories[category || 'root'].size += itemStat.size;
                    }
                });
            };

            scanDirectory(this.logsDir);

            // Ordenar arquivos recentes por data
            stats.recentFiles.sort((a, b) => b.modified - a.modified);
            stats.recentFiles = stats.recentFiles.slice(0, 10); // Top 10

            return stats;
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Formata bytes para string legível
     * @param {number} bytes - Bytes a formatar
     * @returns {string} String formatada
     * @private
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Abre o diretório de logs no explorador de arquivos
     */
    openLogsDirectory() {
        const { exec } = require('child_process');
        const os = require('os');

        const platform = os.platform();
        let command;

        switch (platform) {
            case 'win32':
                command = `explorer "${this.logsDir}"`;
                break;
            case 'darwin':
                command = `open "${this.logsDir}"`;
                break;
            default:
                command = `xdg-open "${this.logsDir}"`;
        }

        exec(command, (error) => {
            if (error) {
                console.log(colors.info(`📁 Diretório de logs: ${this.logsDir}`));
            }
        });
    }
}

module.exports = new LogManager();