const fs = require('fs');
const path = require('path');

/**
 * 📄 Carrega informações do package.json
 */
class PackageInfo {
    constructor() {
        this.packageData = this.loadPackageInfo();
    }

    /**
     * Carrega informações do package.json
     * @returns {Object} Dados do package.json
     * @private
     */
    loadPackageInfo() {
        try {
            const packagePath = path.join(__dirname, '..', '..', 'package.json');
            const packageJson = fs.readFileSync(packagePath, 'utf8');
            const data = JSON.parse(packageJson);

            return {
                name: data.name || 'ravcheck',
                version: data.version || '1.0.0',
                wuser: "RavenaStar",
                site:"https://secguide.pages.dev",
                description: data.description || '⚙️ CLI/NPM para envio automatizado de URLs para urlscan.io via API.',
                author: data.author || 'RavenaStar',
                license: data.license || 'MIT',
                homepage: data.homepage || 'https://github.com/ravenastar-js/ravcheck/'
            };
        } catch (error) {
            console.error('❌ Erro ao carregar package.json:', error.message);
            return this.getFallbackInfo();
        }
    }

    /**
     * Informações de fallback
     * @returns {Object} Dados padrão
     */
    getFallbackInfo() {
        return {
            name: 'ravcheck',
            version: '1.0.0',
            wuser: "RavenaStar",
            site:"https://secguide.pages.dev",
            description: '⚙️ CLI/NPM para envio automatizado de URLs para urlscan.io via API.',
            author: 'ravenastar-js',
            license: 'MIT',
            homepage: 'https://github.com/ravenastar-js/ravcheck/'
        };
    }

    /**
     * Retorna todas as informações
     * @returns {Object} Todas as informações
     */
    get allInfo() {
        return this.packageData;
    }

    /**
     * Retorna o nome
     * @returns {string} Nome do pacote
     */
    get name() {
        return this.packageData.name;
    }

    /**
     * Retorna a versão
     * @returns {string} Versão
     */
    get version() {
        return this.packageData.version;
    }

    /**
     * Retorna a descrição
     * @returns {string} Descrição
     */
    get description() {
        return this.packageData.description;
    }
}

module.exports = new PackageInfo();