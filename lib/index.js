const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const authManager = require('../auth');
const logger = require('./utils/logger');
const boxManager = require('./utils/box');
const UI = require('./ui');
const { colors, theme } = require('./config/colors');
const rateLimitConfig = require('../data/rate-limit-free');
const logManager = require('./utils/logManager');
const OptionsManager = require('./config/optionsManager');

/**
 * 🚀 Classe principal RAVCHECK - Sistema de análise de URLs
 * Gerencia toda a lógica de análise, rate limiting e resultados
 * @class Ravcheck
 */
class Ravcheck {
    /**
     * Cria uma instância do Ravcheck
     * @constructor
     */
    constructor() {
        this.authManager = authManager;
        this.optionsManager = new OptionsManager();
        this.logManager = logManager;
        this.ui = null;
        this.config = {
            defaultVisibility: 'public',
            pollingInterval: 10000,
            maxPollingAttempts: 30,
            minDelayBetweenRequests: 5000
        };
        this.rateLimitInfo = {
            remaining: 1,
            reset: Date.now() + 60000,
            daily: { remaining: 100, limit: 100 },
            monthly: { remaining: 2500, limit: 2500 }
        };
        this.baseDir = path.join(__dirname, '..');
        this.fixedTagsPath = path.join(__dirname, 'config', 'fixedtags.txt');
    }

    /**
     * Inicializa a aplicação e verifica dependências
     * @returns {Promise<void>}
     */
    async init() {
        this.ui = new UI(this);

        if (!this.authManager.hasApiKey()) {
            logger.warn('Chave API não configurada. Configure-a no menu.');
        } else {
            const apiKey = this.authManager.getApiKey();
            if (!apiKey) {
                logger.error('Chave API inválida ou corrompida. Reconfigure-a.');
            } else {
                logger.success('Chave API carregada com sucesso!');
            }
        }

        // Carregar configurações do optionsManager
        this.config.defaultVisibility = this.optionsManager.getScanVisibility();
        const userAgentConfig = this.optionsManager.getUserAgent();
        this.config.userAgent = userAgentConfig.value;
    }

    /**
     * Mostra o menu principal interativo
     * @returns {Promise<void>}
     */
    async showMainMenu() {
        await this.ui.showMainMenu();
    }


    /**
     * Carrega tags combinadas (fixas + personalizadas)
     * @returns {string[]} Lista de tags combinadas
     */
    loadTags() {
        let allTags = [];

        // Carregar tags fixas
        if (fs.existsSync(this.fixedTagsPath)) {
            const fixedContent = fs.readFileSync(this.fixedTagsPath, 'utf8');
            const fixedTags = fixedContent.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            allTags.push(...fixedTags);
        }

        // Carregar tags personalizadas do OptionsManager
        const customTags = this.optionsManager.loadTags();
        allTags.push(...customTags);

        return [...new Set(allTags)]; // Remover duplicatas
    }

    /**
     * Analisa todas as URLs do arquivo links.txt
     * @returns {Promise<Object>} Resultados da análise
     */
    /**
     * Analisa todas as URLs do arquivo links.txt
     * @returns {Promise<Object>} Resultados da análise
     */
    async analyzeFromFile() {
        const urls = this.loadUrls();
        const tags = this.loadTags();

        if (urls.length === 0) {
            logger.error('Nenhuma URL válida encontrada no arquivo links.txt');
            return { resultados: [], sucessos: 0, falhas: 0 };
        }

        // Usar o box ANTES da análise
        console.log(boxManager.createPreAnalysisSummaryBox({
            total: urls.length,
            tags: tags,
            visibility: this.config.defaultVisibility,
            maxPollingAttempts: this.config.maxPollingAttempts
        }));

        const { confirm } = await require('inquirer').prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: colors.warning(`📊 Iniciar análise de ${urls.length} URL(s) com ${tags.length} tag(s)?`),
                default: false
            }
        ]);

        if (!confirm) {
            logger.info('📌 Análise cancelada pelo usuário.');
            return { resultados: [], sucessos: 0, falhas: 0 };
        }

        const resultados = [];
        let sucessos = 0;
        let falhas = 0;

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];

            if ((i + 1) % 5 === 0 || i === 0) {
                await this.showCurrentRateLimitStatus();
            }

            console.log(`\n${colors.text('┌──')} ${colors.title(`[${i + 1}/${urls.length}]`)} ${colors.url(url)}`);
            console.log(`${colors.text('│')} ${colors.tag(`🏷️ Tags: ${tags.join(', ')}`)}`);

            const resultado = await this.submitAndWaitForAnalysis(url, tags);

            if (resultado && resultado.sucesso) {
                sucessos++;
                console.log(`${colors.text('│')} ${colors.success('✅ Concluído!')}`);
                console.log(`${colors.text('│')} ${colors.link(`📊 Relatório: ${resultado.urlRelatorio}`)}`);
            } else {
                falhas++;
                console.log(`${colors.text('│')} ${colors.error('❌ Falha na análise')}`);
            }

            console.log(`${colors.text('└')}${colors.muted('─'.repeat(60))}`);

            if (i < urls.length - 1) {
                await this.delay(this.config.minDelayBetweenRequests);
            }
        }

        this.saveResults(resultados);

        // Usar o box DEPOIS da análise
        console.log('\n' + boxManager.createPostAnalysisSummaryBox({
            total: urls.length,
            sucessos: sucessos,
            falhas: falhas,
            tags: tags,
            visibility: this.config.defaultVisibility
        }));

        return { resultados, sucessos, falhas };
    }

    /**
     * Analisa uma única URL
     * @param {string} url - URL para analisar
     * @param {string[]} customTags - Tags personalizadas para aplicar
     * @param {string} visibility - Visibilidade da análise
     * @returns {Promise<Object|null>} Resultado da análise
     */
    async analyzeSingleUrl(url, customTags = [], visibility = 'public') {
        // Combinar tags fixas com personalizadas
        const allTags = this.combineTags(customTags);

        console.log(boxManager.createBox(
            colors.title('🔍 ANÁLISE DE URL ÚNICA') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text(`🌐 URL: ${colors.url(url)}\n`) +
            colors.text(`🏷️ Tags: ${colors.tag(allTags.join(', '))}\n`) +
            colors.text(`🔒 Visibilidade: ${colors.info(visibility)}`),
            { borderColor: colors.scan }
        ));

        await this.checkRateLimit();

        const resultado = await this.submitAndWaitForAnalysis(url, allTags, visibility);

        if (resultado) {
            console.log('\n' + boxManager.createScanResultBox(resultado));

            const resultados = [resultado];
            this.saveResults(resultados);

            return resultado;
        }

        return null;
    }

    /**
     * Combina tags fixas com personalizadas
     * @param {string[]} customTags - Tags personalizadas
     * @returns {string[]} Tags combinadas
     */
    combineTags(customTags = []) {
        // Carregar tags fixas
        let fixedTags = [];
        if (fs.existsSync(this.fixedTagsPath)) {
            const fixedContent = fs.readFileSync(this.fixedTagsPath, 'utf8');
            fixedTags = fixedContent.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
        }

        // Combinar e remover duplicatas
        const allTags = [...fixedTags, ...customTags.filter(tag => tag.trim())];
        return [...new Set(allTags)];
    }

    /**
     * Submete e aguarda análise da URL
     * @param {string} url - URL para analisar
     * @param {string[]} tags - Tags para aplicar
     * @param {string} visibility - Visibilidade da análise
     * @returns {Promise<Object|null>} Resultado da análise
     */
    async submitAndWaitForAnalysis(url, tags, visibility = 'public') {
        try {
            const apiKey = this.authManager.getApiKey();
            if (!apiKey) {
                throw new Error('❌ Chave API não configurada. Configure-a primeiro.');
            }

            logger.info(`📤 Submetendo análise para: ${url}`);
            logger.info(`🏷️ Tags: ${tags.join(', ')}`);
            logger.info(`🔒 Visibilidade: ${visibility}`);

            const submissionResult = await this.submitToUrlScan(url, tags, visibility, apiKey);

            if (!submissionResult || !submissionResult.uuid) {
                throw new Error('❌ Falha na submissão da análise');
            }

            const scanResult = await this.waitForResult(submissionResult.uuid, apiKey);

            if (!scanResult) {
                throw new Error('⏱️ Tempo esgotado aguardando resultado');
            }

            return {
                nome: `URL_${Date.now()}`,
                urlOriginal: url,
                urlRelatorio: `https://urlscan.io/result/${submissionResult.uuid}/`,
                uuid: submissionResult.uuid,
                tags: tags,
                visibility: visibility,
                sucesso: true,
                timestamp: new Date().toISOString(),
                data: scanResult
            };

        } catch (error) {
            logger.error(`Erro na análise de ${url}:`, error);

            return {
                nome: `URL_${Date.now()}`,
                urlOriginal: url,
                tags: tags,
                sucesso: false,
                erro: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Submete URL para análise no urlscan.io
     * @param {string} url - URL para analisar
     * @param {string[]} tags - Tags para aplicar
     * @param {string} visibility - Visibilidade
     * @param {string} apiKey - Chave API
     * @returns {Promise<Object|null>} Resultado da submissão
     */
    async submitToUrlScan(url, tags, visibility, apiKey) {
        try {
            await this.waitForRateLimit();

            const headers = {
                'Content-Type': 'application/json',
                'API-Key': apiKey,
                'User-Agent': this.config.userAgent
            };

            // Usar visibilidade do OptionsManager se não especificada
            const scanVisibility = visibility || this.optionsManager.getScanVisibility();

            const payload = {
                url: url,
                tags: tags,
                visibility: scanVisibility
            };

            logger.info(`📦 Submetendo payload: ${JSON.stringify(payload)}`);
            logger.info(`🤖 User-Agent: ${this.config.userAgent}`);

            const response = await fetch('https://urlscan.io/api/v1/scan/', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            this.updateRateLimitFromHeaders(response.headers);

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`Erro na submissão (${response.status}): ${errorText}`);

                if (response.status === 401) {
                    throw new Error('🔑 Chave API inválida ou expirada');
                } else if (response.status === 400) {
                    throw new Error(`📝 Requisição malformada: ${errorText.substring(0, 200)}`);
                } else if (response.status === 429) {
                    throw new Error('⏱️ Rate limit excedido');
                } else if (response.status === 402) {
                    throw new Error('💰 Quota insuficiente');
                } else {
                    throw new Error(`🌐 HTTP ${response.status}: ${errorText.substring(0, 200)}`);
                }
            }

            const data = await response.json();
            logger.success(`Análise submetida. UUID: ${data.uuid}`);

            return data;

        } catch (error) {
            if (error.message.includes('Rate limit')) {
                logger.warn('⚠️ Rate limit excedido. Aguardando 60 segundos...');
                await this.delay(60000);
                return this.submitToUrlScan(url, tags, visibility, apiKey);
            }
            throw error;
        }
    }

    /**
     * Aguarda resultado da análise
     * @param {string} uuid - UUID da análise
     * @param {string} apiKey - Chave API
     * @returns {Promise<Object|null>} Resultado da análise
     */
    async waitForResult(uuid, apiKey) {
        logger.info(`⏳ Aguardando resultado para UUID: ${uuid}`);

        const maxPollingAttempts = this.config.maxPollingAttempts || 30;
        const pollingInterval = this.config.pollingInterval || 10000;

        for (let attempt = 1; attempt <= maxPollingAttempts; attempt++) {
            await this.delay(pollingInterval);

            try {
                const headers = { 'API-Key': apiKey };
                const response = await fetch(`https://urlscan.io/api/v1/result/${uuid}/`, { headers });

                this.updateRateLimitFromHeaders(response.headers);

                if (response.status === 200) {
                    logger.success(`✅ Resultado obtido na tentativa ${attempt}/${maxPollingAttempts}`);
                    return await response.json();
                } else if (response.status === 404) {
                    if (attempt % 3 === 0) {
                        const minutos = (attempt * pollingInterval / 60000).toFixed(1);
                        logger.info(`⏳ Ainda processando... (${minutos} minutos)`);
                    }
                } else if (response.status === 410) {
                    throw new Error('🗑️ Resultado excluído ou expirado');
                } else if (response.status === 429) {
                    logger.warn('⚠️ Rate limit atingido durante polling. Aguardando 60 segundos...');
                    await this.delay(60000);
                    continue;
                } else {
                    throw new Error(`🌐 HTTP ${response.status}: ${await response.text()}`);
                }
            } catch (error) {
                if (attempt === maxPollingAttempts) {
                    throw new Error(`⏱️ Tempo máximo de espera excedido (${maxPollingAttempts} tentativas): ${error.message}`);
                }
                logger.debug(`🐛 Erro na tentativa ${attempt}: ${error.message}`);
            }
        }

        throw new Error(`⏱️ Tempo máximo de espera excedido (${maxPollingAttempts} tentativas)`);
    }

    /**
     * Verifica rate limit da API
     * @returns {Promise<Object|null>} Informações de quota
     */
    async checkRateLimit() {
        try {
            const apiKey = this.authManager.getApiKey();
            if (!apiKey) {
                throw new Error('❌ Chave API não configurada');
            }

            const headers = { 'API-Key': apiKey };
            const response = await fetch('https://urlscan.io/user/quotas', { headers });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`🌐 HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }

            const data = await response.json();
            const quotas = this.parseQuotaDataFromLimits(data.limits);

            const rateLimitHeaders = {
                remaining: response.headers.get('X-Rate-Limit-Remaining'),
                limit: response.headers.get('X-Rate-Limit-Limit'),
                reset: response.headers.get('X-Rate-Limit-Reset'),
                scope: response.headers.get('X-Rate-Limit-Scope')
            };

            const result = {
                team: data.scope === 'team' ? 'Team Plan' : 'Free Plan',
                ...quotas,
                rateLimitHeaders: rateLimitHeaders,
                timestamp: new Date().toISOString(),
                nextReset: this.calculateNextReset(),
                rawData: data,
                isDefault: false
            };

            logger.info('📊 Rate limit verificado com sucesso');
            return result;

        } catch (error) {
            logger.error('Erro ao verificar rate limit:', error);

            const defaultResult = this.getDefaultFreeLimits();
            defaultResult.isDefault = true;
            return defaultResult;
        }
    }

    /**
     * Parse dos dados de quota
     * @param {Object} limitsData - Dados da chave limits
     * @returns {Object} Dados processados
     * @private
     */
    parseQuotaDataFromLimits(limitsData) {
        if (!limitsData) {
            return this.getDefaultQuotaData();
        }

        const result = {
            limits: {},
            usage: {},
            totals: {
                daily: 0,
                hourly: 0,
                minute: 0
            }
        };

        const actions = [
            {
                apiKey: 'public',
                name: 'Public Scans',
                emoji: '🌐',
                type: 'scan'
            },
            {
                apiKey: 'unlisted',
                name: 'Unlisted Scans',
                emoji: '🔒',
                type: 'scan'
            },
            {
                apiKey: 'private',
                name: 'Private Scans',
                emoji: '🔐',
                type: 'scan'
            },
            {
                apiKey: 'search',
                name: 'Search Requests',
                emoji: '🔍',
                type: 'search'
            },
            {
                apiKey: 'retrieve',
                name: 'Result Retrieve',
                emoji: '📥',
                type: 'retrieve'
            }
        ];

        actions.forEach(action => {
            const actionData = limitsData[action.apiKey];

            if (actionData) {
                result.limits[action.name] = {
                    perMinute: actionData.minute?.limit || 0,
                    perHour: actionData.hour?.limit || 0,
                    perDay: actionData.day?.limit || 0
                };

                result.usage[action.name] = {
                    perMinute: this.calculateUsage(
                        actionData.minute?.used || 0,
                        actionData.minute?.limit || 0
                    ),
                    perHour: this.calculateUsage(
                        actionData.hour?.used || 0,
                        actionData.hour?.limit || 0
                    ),
                    perDay: this.calculateUsage(
                        actionData.day?.used || 0,
                        actionData.day?.limit || 0
                    )
                };

                result.totals.minute += actionData.minute?.used || 0;
                result.totals.hourly += actionData.hour?.used || 0;
                result.totals.daily += actionData.day?.used || 0;

                if (actionData.lastIP || actionData.lastActivity) {
                    result.usage[action.name].lastIP = actionData.lastIP;
                    result.usage[action.name].lastActivity = actionData.lastActivity;
                }
            } else {
                const defaultLimits = this.getDefaultLimitsForAction(action.name);

                result.limits[action.name] = defaultLimits;
                result.usage[action.name] = {
                    perMinute: this.calculateUsage(0, defaultLimits.perMinute),
                    perHour: this.calculateUsage(0, defaultLimits.perHour),
                    perDay: this.calculateUsage(0, defaultLimits.perDay)
                };
            }
        });

        return result;
    }

    /**
     * Calcula porcentagem de uso
     * @param {number} used - Quantidade usada
     * @param {number} limit - Limite total
     * @returns {Object} Informações de uso
     * @private
     */
    calculateUsage(used, limit) {
        if (limit === 0) {
            return {
                used: 0,
                limit: 0,
                remaining: 0,
                percentage: 0,
                percentageText: '(0%)',
                status: 'disabled',
                color: 'muted'
            };
        }

        const percentage = Math.round((used / limit) * 100);
        const remaining = Math.max(0, limit - used);

        let status = 'low';
        let color = 'success';

        if (percentage >= 80) {
            status = 'critical';
            color = 'error';
        } else if (percentage >= 50) {
            status = 'warning';
            color = 'warning';
        }

        return {
            used: used,
            limit: limit,
            remaining: remaining,
            percentage: percentage,
            percentageText: `(${percentage}%)`,
            status: status,
            color: color
        };
    }

    /**
     * Calcula próximo reset
     * @returns {Object} Informações de reset
     * @private
     */
    calculateNextReset() {
        const now = new Date();
        const utcNow = new Date(now.toUTCString());

        const dailyReset = new Date(utcNow);
        dailyReset.setUTCHours(24, 0, 0, 0);

        const hourlyReset = new Date(utcNow);
        hourlyReset.setUTCMinutes(60, 0, 0);

        const minuteReset = new Date(utcNow);
        minuteReset.setUTCSeconds(60, 0);

        return {
            daily: {
                time: dailyReset.toISOString(),
                in: Math.max(0, dailyReset - utcNow),
                formatted: `Hoje às ${dailyReset.toUTCString().split(' ')[4]} UTC`
            },
            hourly: {
                time: hourlyReset.toISOString(),
                in: Math.max(0, hourlyReset - utcNow),
                formatted: `${hourlyReset.toUTCString().split(' ')[4]} UTC`
            },
            minute: {
                time: minuteReset.toISOString(),
                in: Math.max(0, minuteReset - utcNow),
                formatted: 'A cada minuto'
            }
        };
    }

    /**
     * Retorna limites padrão do plano free
     * @returns {Object} Limites do plano free
     * @private
     */
    getDefaultFreeLimits() {
        const limits = rateLimitConfig.limits;

        return {
            team: 'Free Plan (Default)',
            limits: {
                'Public Scans': limits.public,
                'Unlisted Scans': limits.unlisted,
                'Private Scans': limits.private,
                'Search Requests': limits.search,
                'Result Retrieve': limits.retrieve
            },
            usage: {},
            totals: {
                daily: 0,
                hourly: 0,
                minute: 0
            },
            rateLimitHeaders: {},
            timestamp: new Date().toISOString(),
            nextReset: this.calculateNextReset(),
            isDefault: true
        };
    }

    /**
     * Obtém limites padrão para uma ação
     * @param {string} actionName - Nome da ação
     * @returns {Object} Limites padrão
     * @private
     */
    getDefaultLimitsForAction(actionName) {
        const limits = rateLimitConfig.limits;

        switch (actionName.toLowerCase()) {
            case 'public scans':
                return limits.public;
            case 'unlisted scans':
                return limits.unlisted;
            case 'private scans':
                return limits.private;
            case 'search requests':
                return limits.search;
            case 'result retrieve':
                return limits.retrieve;
            default:
                return limits.public;
        }
    }

    /**
     * Dados de quota padrão
     * @returns {Object} Dados padrão
     * @private
     */
    getDefaultQuotaData() {
        const limits = rateLimitConfig.limits;

        return {
            limits: {
                'Public Scans': limits.public,
                'Unlisted Scans': limits.unlisted,
                'Private Scans': limits.private,
                'Search Requests': limits.search,
                'Result Retrieve': limits.retrieve
            },
            usage: {
                'Public Scans': {
                    perMinute: this.calculateUsage(0, limits.public.perMinute),
                    perHour: this.calculateUsage(0, limits.public.perHour),
                    perDay: this.calculateUsage(0, limits.public.perDay)
                },
                'Unlisted Scans': {
                    perMinute: this.calculateUsage(0, limits.unlisted.perMinute),
                    perHour: this.calculateUsage(0, limits.unlisted.perHour),
                    perDay: this.calculateUsage(0, limits.unlisted.perDay)
                },
                'Private Scans': {
                    perMinute: this.calculateUsage(0, limits.private.perMinute),
                    perHour: this.calculateUsage(0, limits.private.perHour),
                    perDay: this.calculateUsage(0, limits.private.perDay)
                },
                'Search Requests': {
                    perMinute: this.calculateUsage(0, limits.search.perMinute),
                    perHour: this.calculateUsage(0, limits.search.perHour),
                    perDay: this.calculateUsage(0, limits.search.perDay)
                },
                'Result Retrieve': {
                    perMinute: this.calculateUsage(0, limits.retrieve.perMinute),
                    perHour: this.calculateUsage(0, limits.retrieve.perHour),
                    perDay: this.calculateUsage(0, limits.retrieve.perDay)
                }
            },
            totals: {
                daily: 0,
                hourly: 0,
                minute: 0
            }
        };
    }

    /**
     * Atualiza rate limit dos headers
     * @param {Headers} headers - Headers da resposta
     */
    updateRateLimitFromHeaders(headers) {
        const remaining = headers.get('X-Rate-Limit-Remaining');
        const reset = headers.get('X-Rate-Limit-Reset');

        if (remaining) {
            this.rateLimitInfo.remaining = parseInt(remaining);
        }
        if (reset) {
            this.rateLimitInfo.reset = parseInt(reset) * 1000;
        }
    }

    /**
     * Aguarda rate limit
     * @returns {Promise<void>}
     */
    async waitForRateLimit() {
        const now = Date.now();

        if (this.rateLimitInfo.remaining <= 0 && this.rateLimitInfo.reset > now) {
            const waitTime = this.rateLimitInfo.reset - now;
            const minutes = Math.ceil(waitTime / 60000);

            logger.warn(`⏱️ Rate limit atingido. Aguardando ${minutes} minutos...`);
            await this.delay(waitTime + 1000);

            this.rateLimitInfo.remaining = 1;
            this.rateLimitInfo.reset = now + 60000;
        }
    }

    /**
     * Mostra status atual do rate limit
     * @returns {Promise<void>}
     */
    async showCurrentRateLimitStatus() {
        try {
            const quotaInfo = await this.checkRateLimit();
            if (!quotaInfo) return;

            console.log('\n' + colors.subtitle('📊 STATUS ATUAL DO RATE LIMIT:'));
            console.log(colors.muted('─'.repeat(50)));

            if (quotaInfo.usage['Public Scans']) {
                const usage = quotaInfo.usage['Public Scans'].perDay;
                const limits = quotaInfo.limits['Public Scans'];

                console.log(colors.text(`🌐 Public Scans: `) +
                    this.formatUsageForDisplay(usage, limits.perDay));

                const barLength = 20;
                const filled = Math.round((usage.used / limits.perDay) * barLength);
                const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

                let barColor = colors.success;
                if (usage.percentage >= 80) barColor = colors.error;
                else if (usage.percentage >= 50) barColor = colors.warning;

                console.log(colors.text('  [' + barColor(bar) + colors.text(`] ${usage.used}/${limits.perDay}`)));
            }

            console.log(colors.muted(`🔄 Próximo reset diário: ${quotaInfo.nextReset.daily.formatted}`));

        } catch (error) {
            // Ignorar erros durante exibição de status
        }
    }

    /**
     * Formata uso para display
     * @param {Object} usage - Dados de uso
     * @param {number} limit - Limite total
     * @returns {string} String formatada
     */
    formatUsageForDisplay(usage, limit) {
        const { colors } = require('./config/colors');

        let colorFn = colors.success;
        if (usage.percentage >= 80) colorFn = colors.error;
        else if (usage.percentage >= 50) colorFn = colors.warning;

        return colorFn(`${usage.used}/${limit} (${usage.percentage}%)`);
    }

    /**
     * Salva resultados organizadamente
     * @param {Object[]} resultados - Resultados a salvar
     */
    saveResults(resultados) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            // Salvar em JSON
            const jsonData = {
                metadata: {
                    tool: 'RAVCHECK',
                    version: require('./utils/packageInfo').version,
                    timestamp: new Date().toISOString(),
                    totalResults: resultados.length,
                    successfulResults: resultados.filter(r => r.sucesso).length,
                    failedResults: resultados.filter(r => !r.sucesso).length,
                    visibility: this.config.defaultVisibility
                },
                resultados: resultados
            };

            const jsonPath = this.logManager.saveToCategory(
                'json',
                `ravcheck-results-${timestamp}.json`,
                jsonData,
                { json: true }
            );

            if (jsonPath) {
                logger.success(`📁 Resultados JSON salvos em: ${jsonPath}`);
            }

            // Salvar em CSV
            let csv = 'Nome,URL,Tags,Status,Relatorio,UUID,Timestamp\n';

            resultados.forEach(result => {
                const nome = `"${result.nome}"`;
                const url = `"${result.urlOriginal}"`;
                const tags = `"${result.tags.join('; ')}"`;
                const status = result.sucesso ? 'SUCESSO' : 'FALHA';
                const relatorio = result.urlRelatorio ? `"${result.urlRelatorio}"` : '"N/A"';
                const uuid = result.uuid ? `"${result.uuid}"` : '"N/A"';
                const timestamp = `"${result.timestamp}"`;

                csv += `${nome},${url},${tags},${status},${relatorio},${uuid},${timestamp}\n`;
            });

            const csvPath = this.logManager.saveToCategory(
                'csv',
                `ravcheck-results-${timestamp}.csv`,
                csv
            );

            if (csvPath) {
                logger.info(`📊 Resultados CSV salvos em: ${csvPath}`);
            }

            // Salvar logs de sucesso/erro separadamente
            resultados.forEach((result, index) => {
                const category = result.sucesso ? 'sucesso' : 'erros';
                const filename = `resultado-${timestamp}-${index + 1}.json`;

                this.logManager.saveToCategory(
                    category,
                    filename,
                    result,
                    { json: true }
                );
            });

        } catch (error) {
            logger.error('Erro ao salvar resultados:', error);
        }
    }

    /**
     * Debug da estrutura da API
     * @returns {Promise<void>}
     */
    async debugApiStructure() {
        try {
            const apiKey = this.authManager.getApiKey();
            if (!apiKey) {
                logger.error('Chave API não configurada');
                return;
            }

            const headers = { 'API-Key': apiKey };
            const response = await fetch('https://urlscan.io/user/quotas', { headers });

            if (!response.ok) {
                throw new Error(`🌐 HTTP ${response.status}`);
            }

            const data = await response.json();

            const debugData = {
                headers: {
                    'X-Rate-Limit-Remaining': response.headers.get('X-Rate-Limit-Remaining'),
                    'X-Rate-Limit-Limit': response.headers.get('X-Rate-Limit-Limit'),
                    'X-Rate-Limit-Reset': response.headers.get('X-Rate-Limit-Reset'),
                    'X-Rate-Limit-Scope': response.headers.get('X-Rate-Limit-Scope')
                },
                apiStructure: data,
                keys: Object.keys(data),
                timestamp: new Date().toISOString()
            };

            // Salvar debug em arquivo
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.logManager.saveToCategory(
                'debug',
                `api-debug-${timestamp}.json`,
                debugData,
                { json: true }
            );

            console.log('\n' + colors.title('🔍 DEBUG: ESTRUTURA DA API'));
            console.log(colors.muted('─'.repeat(50)));
            console.log(colors.success(`✅ Debug salvo em logs/debug/`));
            console.log(colors.info(`📝 Dados salvos para análise offline`));

        } catch (error) {
            logger.error('Erro no debug:', error);
        }
    }

    /**
     * Limpa todos os arquivos de log e temporários
     * @returns {Promise<Object>} Resultado da limpeza
     */
    async cleanLogsAndExit() {
        console.clear();

        console.log(boxManager.createBox(
            colors.error('⚠️ LIMPEZA COMPLETA') + '\n' +
            colors.muted('─'.repeat(45)) + '\n' +
            colors.text('Esta ação irá remover TODOS os arquivos das pastas:') + '\n' +
            colors.muted('📁 logs/ (incluindo todas as subpastas)') + '\n' +
            colors.muted('📝 Arquivos temporários e de debug') + '\n' +
            colors.muted('🔑 key.json (chave API da pasta auth)') + '\n\n' + 
            colors.text('📌 Os seguintes arquivos NÃO serão afetados:') + '\n' +
            colors.muted('📁 options/ (suas configurações serão mantidas)') + '\n' +
            colors.muted('🔗 links.txt (suas URLs serão mantidas)') + '\n' +
            colors.muted('🏷️ tags.txt (suas tags serão mantidas)') + '\n\n' +
            colors.text('🔴 Esta ação NÃO pode ser desfeita!'),
            { borderColor: theme.border.error, width: 75 }
        ));

        const { confirm } = await require('inquirer').prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: colors.error('🚨 TEM CERTEZA QUE DESEJA LIMPAR TUDO E SAIR?'),
                default: false
            }
        ]);

        if (confirm) {
            // Limpar logs
            const cleanResult = this.logManager.clearAllLogs(true);

            // Remover key.json da pasta auth
            let authCleaned = false;
            try {
                authCleaned = this.authManager.removeApiKey();
            } catch (error) {
                logger.error('Erro ao remover chave API:', error);
            }

            // Mostrar resultado
            console.log('\n' + boxManager.createBox(
                colors.success('🧹 LIMPEZA CONCLUÍDA') + '\n' +
                colors.muted('─'.repeat(30)) + '\n' +
                colors.text(cleanResult.message) + '\n' +
                (authCleaned ? colors.success('🔑 Chave API removida com sucesso!') : colors.warning('⚠️ Chave API não encontrada ou já removida')) + '\n\n' +
                colors.muted('✅ Arquivos preservados:') + '\n' +
                colors.muted('   📁 options/ (configurações)') + '\n' +
                colors.muted('   🔗 links.txt (URLs)') + '\n' +
                colors.muted('   🏷️ tags.txt (tags)') + '\n\n' +
                colors.text('👋 Saindo do RAVCHECK...'),
                { borderColor: theme.border.success, width: 75 }
            ));

            await this.delay(2000);
            return { success: true, ...cleanResult, authCleaned };
        } else {
            console.log(boxManager.createBox(
                colors.info('📌 LIMPEZA CANCELADA') + '\n' +
                colors.muted('─'.repeat(25)) + '\n' +
                colors.text('Nenhum arquivo foi removido.') + '\n' +
                colors.muted('Retornando ao menu principal...'),
                { borderColor: theme.border.info, width: 60 }
            ));

            await this.delay(1500);
            return { success: false, message: 'Limpeza cancelada pelo usuário' };
        }
    }

    /**
     * Delay robusto
     * @param {number} ms - Milissegundos para esperar
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => {
            if (ms > 0) {
                setTimeout(resolve, ms);
            } else {
                resolve();
            }
        });
    }
}

module.exports = { Ravcheck };