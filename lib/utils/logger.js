const { colors } = require('../config/colors');
const logManager = require('./logManager');

/**
 * 📝 Sistema de logging para RAVCHECK
 * Agora usa a estrutura organizada de logs
 * @class Logger
 */
class Logger {
    /**
     * Cria uma instância do Logger
     * @constructor
     */
    constructor() {
        this.logLevels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        };
        this.currentLogLevel = this.logLevels.INFO;
    }

    /**
     * Log de debug
     * @param {string} message - Mensagem
     * @param {Object} data - Dados adicionais
     */
    debug(message, data = null) {
        if (this.currentLogLevel <= this.logLevels.DEBUG) {
            const logMessage = `[DEBUG] ${new Date().toISOString()} - ${message}`;
            console.log(colors.muted(`🐛 ${logMessage}`));
            if (data) console.log(colors.muted(JSON.stringify(data, null, 2)));
            this.writeToFile('debug', logMessage, data);
        }
    }

    /**
     * Log de informação
     * @param {string} message - Mensagem
     */
info(message) {
    if (this.currentLogLevel <= this.logLevels.INFO) {
        const logMessage = `[INFO] ${new Date().toISOString()} - ${message}`;
        console.log(colors.info(`ℹ ${message}`));
        this.writeToFile('info', logMessage);
    }
}

    /**
     * Log de sucesso
     * @param {string} message - Mensagem
     */
    success(message) {
        const logMessage = `[SUCCESS] ${new Date().toISOString()} - ${message}`;
        console.log(colors.success(`${message}`));
        this.writeToFile('sucesso', logMessage);
    }

    /**
     * Log de aviso
     * @param {string} message - Mensagem
     */
    warn(message) {
        if (this.currentLogLevel <= this.logLevels.WARN) {
            const logMessage = `[WARN] ${new Date().toISOString()} - ${message}`;
            console.log(colors.warning(`⚠️ ${message}`));
            this.writeToFile('erros', logMessage);
        }
    }

    /**
     * Log de erro
     * @param {string} message - Mensagem
     * @param {Error} error - Objeto de erro
     */
    error(message, error = null) {
        const logMessage = `[ERROR] ${new Date().toISOString()} - ${message}`;
        console.log(colors.error(`❌ ${message}`));
        if (error) {
            console.error(colors.error(error.stack || error.message));
            this.writeToFile('erros', `${logMessage}\n${error.stack || error.message}`);
        } else {
            this.writeToFile('erros', logMessage);
        }
    }

    /**
     * Escreve no arquivo de log organizado
     * @param {string} category - Categoria do log
     * @param {string} message - Mensagem
     * @param {Object} data - Dados adicionais
     * @private
     */
    writeToFile(category, message, data = null) {
        try {
            const date = new Date().toISOString().split('T')[0];
            const filename = `ravcheck-${date}.log`;

            let logEntry = message;
            if (data) {
                logEntry += `\n${JSON.stringify(data, null, 2)}\n`;
            }

            logManager.saveToCategory(category, filename, logEntry + '\n');
        } catch (error) {
            console.error(colors.error('❌ Erro ao escrever no arquivo de log:'), error.message);
        }
    }

    /**
     * Define o nível de log
     * @param {string} level - Nível (DEBUG, INFO, WARN, ERROR)
     */
    setLogLevel(level) {
        const upperLevel = level.toUpperCase();
        if (this.logLevels[upperLevel] !== undefined) {
            this.currentLogLevel = this.logLevels[upperLevel];
        }
    }

    /**
     * Abre o diretório de logs
     */
    openLogsDirectory() {
        logManager.openLogsDirectory();
    }
}

module.exports = new Logger();