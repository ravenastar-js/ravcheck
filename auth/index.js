const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const logger = require('../lib/utils/logger');

/**
 * 🔐 Sistema de autenticação com criptografia para RAVCHECK
 * Gerencia a chave API do urlscan.io com criptografia segura
 * @class AuthManager
 */
class AuthManager {
    /**
     * Cria uma instância do AuthManager
     * @constructor
     */
    constructor() {
        this.authDir = path.join(__dirname);
        this.keyFile = path.join(this.authDir, 'key.json');
        this.ensureAuthDirectory();
        this.encryptionKey = this.generateEncryptionKey();
    }

    /**
     * Garante que o diretório de autenticação existe
     * @private
     */
    ensureAuthDirectory() {
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
    }

    /**
     * Gera uma chave de criptografia baseada no sistema
     * @returns {string} Chave de criptografia de 32 caracteres
     * @private
     */
    generateEncryptionKey() {
        const os = require('os');
        const crypto = require('crypto');

        const systemInfo = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length
        };

        const keyMaterial = JSON.stringify(systemInfo) + process.env.USER + process.env.HOME;
        return crypto.createHash('sha256').update(keyMaterial).digest('hex').substring(0, 32);
    }

    /**
     * Verifica se a chave API está configurada
     * @returns {boolean} True se configurada, false caso contrário
     */
    hasApiKey() {
        return fs.existsSync(this.keyFile);
    }

    /**
     * Obtém a chave API descriptografada
     * @returns {string|null} Chave API descriptografada ou null se inválida
     */
    getApiKey() {
        try {
            if (!this.hasApiKey()) {
                return null;
            }

            const encryptedData = JSON.parse(fs.readFileSync(this.keyFile, 'utf8'));

            if (encryptedData.version !== '1.0') {
                logger.warn('⚠️ Versão de criptografia desatualizada. Recrie a chave API.');
                return null;
            }

            const bytes = CryptoJS.AES.decrypt(encryptedData.key, this.encryptionKey);
            const apiKey = bytes.toString(CryptoJS.enc.Utf8);

            if (!this.isValidApiKey(apiKey)) {
                logger.error('Chave API inválida ou corrompida.');
                return null;
            }

            return apiKey;
        } catch (error) {
            logger.error('Erro ao obter chave API:', error);
            return null;
        }
    }

    /**
     * Salva a chave API criptografada
     * @param {string} apiKey - Chave da API do urlscan.io no formato UUID
     * @returns {boolean} True se salvo com sucesso, false caso contrário
     */
    saveApiKey(apiKey) {
        try {
            if (!this.isValidApiKey(apiKey)) {
                throw new Error('❌ Chave API inválida. Formato esperado: UUID');
            }

            const encrypted = CryptoJS.AES.encrypt(apiKey, this.encryptionKey).toString();

            const data = {
                version: '1.0',
                key: encrypted,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            fs.writeFileSync(this.keyFile, JSON.stringify(data, null, 2), 'utf8');

            if (process.platform !== 'win32') {
                fs.chmodSync(this.keyFile, 0o600);
            }

            logger.success('Chave API salva com segurança!');
            return true;
        } catch (error) {
            logger.error('Erro ao salvar chave API:', error);
            return false;
        }
    }

    /**
     * Remove a chave API do sistema
     * @returns {boolean} True se removido com sucesso, false caso contrário
     */
    removeApiKey() {
        try {
            if (fs.existsSync(this.keyFile)) {
                fs.unlinkSync(this.keyFile);
                logger.info('🗑️ Chave API removida.');
                return true;
            }
            return false;
        } catch (error) {
            logger.error('Erro ao remover chave API:', error);
            return false;
        }
    }

    /**
     * Valida o formato da chave API
     * @param {string} apiKey - Chave a ser validada
     * @returns {boolean} True se válida, false caso contrário
     * @private
     */
    isValidApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') return false;
        return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(apiKey);
    }

    /**
     * Verifica o status da autenticação
     * @returns {Object} Status da autenticação
     */
    getStatus() {
        const hasKey = this.hasApiKey();
        const isValid = hasKey ? this.isValidApiKey(this.getApiKey()) : false;

        return {
            configured: hasKey,
            valid: isValid,
            fileExists: hasKey,
            canDecrypt: hasKey ? this.getApiKey() !== null : false
        };
    }

    /**
     * Obtém informações mascaradas da chave para exibição
     * @returns {Object} Informações mascaradas da chave
     */
    getMaskedInfo() {
        try {
            if (!this.hasApiKey()) {
                return { exists: false, maskedKey: null };
            }

            const apiKey = this.getApiKey();
            if (!apiKey) {
                return { exists: true, corrupted: true, maskedKey: null };
            }

            return {
                exists: true,
                valid: true,
                maskedKey: apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4),
                length: apiKey.length
            };
        } catch (error) {
            return { exists: false, error: error.message };
        }
    }
}

module.exports = new AuthManager();