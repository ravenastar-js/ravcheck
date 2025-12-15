// lib/config/optionsManager.js
const fs = require('fs');
const path = require('path');
const { colors } = require('./colors');
const logger = require('../utils/logger');

/**
 * 📁 Gerenciador de opções de configuração
 * Organiza arquivos de configuração em pasta dedicada
 * @class OptionsManager
 */
class OptionsManager {
    /**
     * Cria uma instância do OptionsManager
     * @constructor
     */
    constructor() {
        this.baseDir = path.join(__dirname, '..', '..');
        this.optionsDir = path.join(this.baseDir, 'options');
        this.setupOptionsDirectory();
        this.ensureDefaultConfigs();
    }

    /**
     * Configura a estrutura do diretório options
     * @private
     */
    setupOptionsDirectory() {
        if (!fs.existsSync(this.optionsDir)) {
            fs.mkdirSync(this.optionsDir, { recursive: true });
            logger.info('📁 Diretório "options" criado.');
        }
    }

    /**
     * Garante que os arquivos de configuração padrão existam
     * @private
     */
    ensureDefaultConfigs() {
        const defaultConfigs = {
            'links.txt': '# links.txt\n# Adicione suas URLs aqui, uma por linha\n# Exemplo: https://exemplo.com\n\n',
            'tags.txt': '# tags.txt\n# Adicione suas tags personalizadas aqui, uma por linha\n# Exemplo: minha-tag\n\n',
            'scan-visibility.txt': 'public\n',
            'user-agent.txt': 'default\n',
            'custom-user-agent.txt': '# custom-user-agent.txt\n# Adicione um User-Agent personalizado aqui (opcional)\n# Se estiver vazio, será usado o padrão do sistema\n\n'
        };

        Object.entries(defaultConfigs).forEach(([filename, content]) => {
            const filePath = path.join(this.optionsDir, filename);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, content, 'utf8');
                logger.info(`📄 Arquivo ${filename} criado em options/.`);
            }
        });
    }

    /**
     * Obtém caminho de um arquivo de configuração
     * @param {string} filename - Nome do arquivo
     * @returns {string} Caminho absoluto
     */
    getFilePath(filename) {
        return path.join(this.optionsDir, filename);
    }

    /**
     * Carrega conteúdo de um arquivo de configuração
     * @param {string} filename - Nome do arquivo
     * @returns {string[]} Lista de linhas válidas
     */
    loadFile(filename) {
        const filePath = this.getFilePath(filename);
        if (!fs.existsSync(filePath)) {
            this.ensureDefaultConfigs();
        }

        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    /**
     * Carrega URLs válidas do arquivo links.txt
     * @returns {string[]} Lista de URLs válidas
     */
    loadUrls() {
        const lines = this.loadFile('links.txt');
        return lines.filter(line => 
            line.startsWith('http://') || line.startsWith('https://')
        );
    }

    /**
     * Carrega tags do arquivo tags.txt
     * @returns {string[]} Lista de tags
     */
    loadTags() {
        return this.loadFile('tags.txt');
    }

    /**
     * Obtém a configuração de visibilidade do scan
     * @returns {string} Visibilidade (public, unlisted, private)
     */
    getScanVisibility() {
        const lines = this.loadFile('scan-visibility.txt');
        const visibility = lines[0]?.toLowerCase() || 'public';
        return ['public', 'unlisted', 'private'].includes(visibility) ? visibility : 'public';
    }

    /**
     * Define a configuração de visibilidade do scan
     * @param {string} visibility - Visibilidade (public, unlisted, private)
     */
    setScanVisibility(visibility) {
        const filePath = this.getFilePath('scan-visibility.txt');
        if (['public', 'unlisted', 'private'].includes(visibility)) {
            fs.writeFileSync(filePath, visibility + '\n', 'utf8');
            logger.success(`🔒 Visibilidade definida como: ${visibility}`);
        }
    }

    /**
     * Obtém o User-Agent configurado
     * @returns {Object} Configuração do User-Agent
     */
    getUserAgent() {
        const lines = this.loadFile('user-agent.txt');
        const agentType = lines[0]?.toLowerCase() || 'default';
        
        if (agentType === 'custom') {
            const customAgent = this.getCustomUserAgent();
            return {
                type: agentType,
                value: customAgent || 'RAVCHECK Scanner/1.0'
            };
        }
        
        return {
            type: agentType,
            value: this.getDefaultUserAgent(agentType)
        };
    }

    /**
     * Define o tipo de User-Agent
     * @param {string} agentType - Tipo (default, chrome, firefox, safari, custom)
     */
    setUserAgentType(agentType) {
        const validTypes = ['default', 'chrome', 'firefox', 'safari', 'custom'];
        if (validTypes.includes(agentType)) {
            const filePath = this.getFilePath('user-agent.txt');
            fs.writeFileSync(filePath, agentType + '\n', 'utf8');
            logger.success(`🤖 User-Agent definido como: ${agentType}`);
        }
    }

    /**
     * Obtém User-Agent personalizado
     * @returns {string|null} User-Agent personalizado ou null
     */
    getCustomUserAgent() {
        const filePath = this.getFilePath('custom-user-agent.txt');
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
        
        return lines[0] || null;
    }

    /**
     * Define User-Agent personalizado
     * @param {string} userAgent - User-Agent personalizado
     */
    setCustomUserAgent(userAgent) {
        const filePath = this.getFilePath('custom-user-agent.txt');
        const content = `# custom-user-agent.txt\n# User-Agent personalizado para RAVCHECK\n\n${userAgent}\n`;
        fs.writeFileSync(filePath, content, 'utf8');
        logger.success(`🤖 User-Agent personalizado definido.`);
    }

    /**
     * Obtém User-Agent padrão baseado no tipo
     * @param {string} type - Tipo de User-Agent
     * @returns {string} User-Agent string
     */
    getDefaultUserAgent(type) {
        const agents = {
            default: `RAVCHECK/${require('../utils/packageInfo').version} (Node.js/${process.version})`,
            chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
        };
        
        return agents[type] || agents.default;
    }

    /**
     * Adiciona URL ao arquivo links.txt
     * @param {string} url - URL para adicionar
     */
    addUrl(url) {
        const filePath = this.getFilePath('links.txt');
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (content.trim().length > 0) {
            if (!content.endsWith('\n')) {
                fs.appendFileSync(filePath, '\n' + url, 'utf8');
            } else {
                fs.appendFileSync(filePath, url, 'utf8');
            }
        } else {
            fs.writeFileSync(filePath, url, 'utf8');
        }
    }

    /**
     * Adiciona tag ao arquivo tags.txt
     * @param {string} tag - Tag para adicionar
     */
    addTag(tag) {
        const filePath = this.getFilePath('tags.txt');
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (content.trim().length > 0) {
            if (!content.endsWith('\n')) {
                fs.appendFileSync(filePath, '\n' + tag, 'utf8');
            } else {
                fs.appendFileSync(filePath, tag, 'utf8');
            }
        } else {
            fs.writeFileSync(filePath, tag, 'utf8');
        }
    }

    /**
     * Salva URLs no arquivo links.txt
     * @param {string[]} urls - Lista de URLs
     */
    saveUrls(urls) {
        const filePath = this.getFilePath('links.txt');
        const content = `# links.txt\n# Adicione suas URLs aqui, uma por linha\n# Exemplo: https://exemplo.com\n\n` +
            urls.join('\n');
        fs.writeFileSync(filePath, content, 'utf8');
    }

    /**
     * Salva tags no arquivo tags.txt
     * @param {string[]} tags - Lista de tags
     */
    saveTags(tags) {
        const filePath = this.getFilePath('tags.txt');
        const content = `# tags.txt\n# Adicione suas tags personalizadas aqui, uma por linha\n# Tags fixas estão em lib/config/fixedtags.txt\n# Exemplo: minha-tag\n\n` +
            tags.join('\n');
        fs.writeFileSync(filePath, content, 'utf8');
    }

    /**
     * Lista todos os arquivos de configuração disponíveis
     * @returns {Object} Informações dos arquivos
     */
    listConfigFiles() {
        const files = fs.readdirSync(this.optionsDir);
        const configFiles = {};
        
        files.forEach(file => {
            const filePath = path.join(this.optionsDir, file);
            const stats = fs.statSync(filePath);
            
            configFiles[file] = {
                path: filePath,
                size: stats.size,
                modified: stats.mtime,
                lines: fs.readFileSync(filePath, 'utf8').split('\n').length
            };
        });
        
        return configFiles;
    }

    /**
     * Abre o diretório options no explorador de arquivos
     */
    openOptionsDirectory() {
        const { exec } = require('child_process');
        const os = require('os');

        const platform = os.platform();
        let command;

        switch (platform) {
            case 'win32':
                command = `explorer "${this.optionsDir}"`;
                break;
            case 'darwin':
                command = `open "${this.optionsDir}"`;
                break;
            default:
                command = `xdg-open "${this.optionsDir}"`;
        }

        exec(command, (error) => {
            if (error) {
                logger.info(`📁 Diretório de opções: ${this.optionsDir}`);
            }
        });
    }
}

// Exportar a classe, não uma instância
module.exports = OptionsManager;