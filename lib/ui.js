const inquirer = require('inquirer');
const { colors, theme } = require('./config/colors');
const logger = require('./utils/logger');
const boxManager = require('./utils/box');
const OptionsManager = require('./config/optionsManager');

/**
 * 🎪 Interface de Usuário Interativa do RAVCHECK
 * Gerencia menus e interações com o usuário
 * @class UI
 */
class UI {
    /**
     * Cria uma instância da UI
     * @constructor
     * @param {Ravcheck} ravcheckInstance - Instância do Ravcheck
     */
    constructor(ravcheckInstance) {
        this.ravcheck = ravcheckInstance;
        this.optionsManager = new OptionsManager();
    }

    /**
     * Mostra o menu principal interativo
     * @returns {Promise<void>}
     */
    async showMainMenu() {
        while (true) {
            try {
                console.clear();
                console.log(boxManager.createWelcomeBox());

                // Menu dinâmico baseado no estado
                const hasApiKey = this.ravcheck.authManager.hasApiKey();
                const urlsCount = this.ravcheck.loadUrls().length;
                const tagsCount = this.ravcheck.loadTags().length;
                const visibility = this.optionsManager.getScanVisibility();
                const userAgent = this.optionsManager.getUserAgent();

                const menuChoices = [
                    {
                        name: `🔗 Analisar URLs (${urlsCount} no arquivo)`,
                        value: 'analyze_file',
                        short: 'Arquivo',
                        disabled: urlsCount === 0 ? 'Adicione URLs primeiro' : false
                    },
                    {
                        name: '🔍 Analisar URL específica',
                        value: 'analyze_single',
                        short: 'URL Única'
                    },
                    {
                        name: `⚙️ Configurações (${visibility} | ${userAgent.type})`,
                        value: 'configurations',
                        short: 'Config'
                    },
                    new inquirer.Separator(colors.muted('─'.repeat(35))),
                    {
                        name: `🏷️ Tags (${tagsCount} configuradas)`,
                        value: 'manage_tags',
                        short: 'Tags'
                    },
                    {
                        name: `📝 URLs (${urlsCount} no arquivo)`,
                        value: 'manage_urls',
                        short: 'URLs'
                    },
                    {
                        name: `📂 Abrir pasta de opções (${tagsCount} tags, ${urlsCount} URLs)`,
                        value: 'open_options',
                        short: 'Opções'
                    },
                    new inquirer.Separator(colors.muted('─'.repeat(35))),
                    {
                        name: hasApiKey ? '🔑 Chave API (Configurada)' : '🔑 Chave API (Não configurada)',
                        value: 'setup_api',
                        short: 'API'
                    },
                    {
                        name: '📊 Rate Limit',
                        value: 'check_rate',
                        short: 'Rate'
                    },
                    {
                        name: '📁 Logs',
                        value: 'logs_menu',
                        short: 'Logs'
                    },
                    new inquirer.Separator(colors.muted('─'.repeat(35))),
                    {
                        name: '🧹 Limpar e Sair',
                        value: 'clean_exit',
                        short: 'Limpar'
                    },
                    {
                        name: '❌ Sair',
                        value: 'exit',
                        short: 'Sair'
                    }
                ];

                const { action } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'action',
                        prefix: '',
                        message: colors.accent('🎯 MENU PRINCIPAL'),
                        choices: menuChoices,
                        pageSize: 15,
                        loop: false
                    }
                ]);

                if (action === 'exit' || action === 'clean_exit') {
                    await this.handleMenuAction(action);
                    break;
                }

                await this.handleMenuAction(action);

                if (action !== 'clean_exit' && action !== 'exit') {
                    await this.clearInquirerBuffer();
                    await this.pressToContinue();
                }

            } catch (error) {
                if (error.message === 'User force closed the prompt') {
                    console.clear();
                    console.log(boxManager.createExitBox());
                    await this.delay(1500);
                    process.exit(0);
                }
                logger.error('Erro no menu principal:', error);
                console.log(boxManager.createErrorBox(`⚠️ Erro: ${error.message}`));

                await this.clearInquirerBuffer();
                await this.delay(3000);
            }
        }
    }


    /**
 * 🔄 Método para limpar o buffer do Inquirer
 * @returns {Promise<void>}
 */
    async clearInquirerBuffer() {
        try {
            // Pausa temporariamente o stdin
            process.stdin.pause();

            // Remove listeners específicos do Inquirer
            process.stdin.removeAllListeners('keypress');
            process.stdin.removeAllListeners('data');

            // Limpa qualquer dado pendente no buffer
            while (process.stdin.read() !== null) {
                // Continua lendo até esvaziar
            }

            // Resume o stdin
            process.stdin.resume();

            // Pequeno delay para estabilizar
            await this.delay(50);

        } catch (error) {
            // Ignora erros de limpeza
        }
    }

    /**
     * Processa a ação selecionada no menu
     * @param {string} action - Ação selecionada
     * @returns {Promise<void>}
     */
    async handleMenuAction(action) {
        console.clear();

        switch (action) {
            case 'analyze_file':
                await this.handleAnalyzeFile();
                break;
            case 'analyze_single':
                await this.handleAnalyzeSingle();
                break;
            case 'configurations':
                await this.handleConfigurations();
                break;
            case 'manage_tags':
                await this.handleManageTags();
                break;
            case 'manage_urls':
                await this.handleManageUrls();
                break;
            case 'setup_api':
                await this.handleSetupApi();
                break;
            case 'check_rate':
                await this.handleCheckRate();
                break;
            case 'open_options':
                await this.handleOpenOptions();
                break;
            case 'logs_menu':
                await this.handleLogsMenu();
                break;
            case 'clean_exit':
                const result = await this.ravcheck.cleanLogsAndExit();
                if (result.success) {
                    console.clear();
                    console.log(boxManager.createExitBox());
                    await this.delay(2000);
                    process.exit(0);
                }
                break;
            case 'exit':
                await this.handleExit();
                break;
        }
    }


    /**
    * Menu de configurações 
    * @returns {Promise<void>}
    */
    async handleConfigurations() {
        const visibility = this.optionsManager.getScanVisibility();
        const userAgentConfig = this.optionsManager.getUserAgent();

        console.log(boxManager.createBox(
            colors.title('⚙️ CONFIGURAÇÕES') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text(`🔒 Scan Visibility: ${colors.info(visibility)}`) + '\n' +
            colors.text(`🤖 User Agent: ${colors.info(userAgentConfig.type)}`) + '\n' +
            colors.muted(userAgentConfig.type === 'custom' ?
                `   Custom: ${userAgentConfig.value.substring(0, 50)}...` :
                `   Valor: ${userAgentConfig.value.substring(0, 50)}...`),
            { borderColor: theme.border.info }
        ));

        const { configAction } = await inquirer.prompt([
            {
                type: 'list',
                name: 'configAction',
                message: colors.text('🎯 O que deseja configurar?'),
                choices: [
                    { name: '🔒 Alterar Scan Visibility', value: 'visibility' },
                    { name: '🤖 Alterar User Agent', value: 'user_agent' },
                    { name: '📁 Abrir pasta de configurações', value: 'open_folder' },
                    { name: '🔙 Voltar', value: 'back' }
                ]
            }
        ]);

        switch (configAction) {
            case 'visibility':
                await this.handleScanVisibility();
                break;
            case 'user_agent':
                await this.handleUserAgent();
                break;
            case 'open_folder':
                this.optionsManager.openOptionsDirectory();
                console.log(boxManager.createBox(
                    colors.success('📁 ABRINDO PASTA DE CONFIGURAÇÕES') + '\n' +
                    colors.muted('─'.repeat(40)) + '\n' +
                    colors.text('A pasta "options" está sendo aberta...'),
                    { borderColor: colors.info2 }
                ));
                await this.delay(1500);
                break;
        }
    }


    /**
   * Configura Scan Visibility 
   * @returns {Promise<void>}
   */
    async handleScanVisibility() {
        const currentVisibility = this.optionsManager.getScanVisibility();

        const { visibility } = await inquirer.prompt([
            {
                type: 'list',
                name: 'visibility',
                message: colors.text('🔒 Selecione a visibilidade dos scans:'),
                choices: [
                    {
                        name: `🌐 Pública ${currentVisibility === 'public' ? '✓' : ''}`,
                        value: 'public',
                        description: 'Scan visível publicamente no urlscan.io'
                    },
                    {
                        name: `🔒 Não-listada ${currentVisibility === 'unlisted' ? '✓' : ''}`,
                        value: 'unlisted',
                        description: 'Scan acessível apenas com link direto'
                    },
                    {
                        name: `🔐 Privada ${currentVisibility === 'private' ? '✓' : ''}`,
                        value: 'private',
                        description: 'Scan visível apenas para você'
                    }
                ],
                default: currentVisibility
            }
        ]);

        this.optionsManager.setScanVisibility(visibility);
        this.ravcheck.config.defaultVisibility = visibility;

        console.log(boxManager.createBox(
            colors.success('✅ CONFIGURAÇÃO ATUALIZADA') + '\n' +
            colors.muted('─'.repeat(30)) + '\n' +
            colors.text(`Scan Visibility definido como: ${colors.info(visibility)}`),
            { borderColor: theme.border.success, width: 60 }
        ));

        await this.delay(1000);
    }

    /**
     * Configura User Agent 
     * @returns {Promise<void>}
     */
    async handleUserAgent() {
        const currentConfig = this.optionsManager.getUserAgent();

        const { agentType } = await inquirer.prompt([
            {
                type: 'list',
                name: 'agentType',
                message: colors.text('🤖 Selecione o tipo de User-Agent:'),
                choices: [
                    {
                        name: `🔄 Padrão ${currentConfig.type === 'default' ? '✓' : ''}`,
                        value: 'default',
                        description: 'User-Agent padrão do RAVCHECK'
                    },
                    {
                        name: `🌐 Chrome ${currentConfig.type === 'chrome' ? '✓' : ''}`,
                        value: 'chrome',
                        description: 'Simula navegador Chrome'
                    },
                    {
                        name: `🦊 Firefox ${currentConfig.type === 'firefox' ? '✓' : ''}`,
                        value: 'firefox',
                        description: 'Simula navegador Firefox'
                    },
                    {
                        name: `🍎 Safari ${currentConfig.type === 'safari' ? '✓' : ''}`,
                        value: 'safari',
                        description: 'Simula navegador Safari'
                    },
                    {
                        name: `⚡ Personalizado ${currentConfig.type === 'custom' ? '✓' : ''}`,
                        value: 'custom',
                        description: 'Use um User-Agent personalizado'
                    }
                ],
                default: currentConfig.type
            }
        ]);

        if (agentType === 'custom') {
            const currentCustom = this.optionsManager.getCustomUserAgent();

            const { customAgent } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'customAgent',
                    message: colors.text('📝 Digite o User-Agent personalizado:'),
                    default: currentCustom || 'Mozilla/5.0 (RAVCHECK Scanner)',
                    validate: (input) => {
                        if (!input.trim()) return '❌ O User-Agent não pode estar vazio!';
                        if (input.length > 500) return '❌ User-Agent muito longo!';
                        return true;
                    }
                }
            ]);

            this.optionsManager.setCustomUserAgent(customAgent);
        }

        this.optionsManager.setUserAgentType(agentType);
        this.ravcheck.config.userAgent = this.optionsManager.getUserAgent().value;

        console.log(boxManager.createBox(
            colors.success('✅ USER-AGENT CONFIGURADO') + '\n' +
            colors.muted('─'.repeat(30)) + '\n' +
            colors.text(`Tipo: ${colors.info(agentType)}`) + '\n' +
            colors.muted(`Valor: ${this.ravcheck.config.userAgent.substring(0, 60)}...`),
            { borderColor: theme.border.success, width: 65 }
        ));

        await this.delay(1000);
    }

    /**
     * Abre diretório de opções
     * @returns {Promise<void>}
     */
    async handleOpenOptions() {
        // Usa o OptionsManager para abrir a pasta
        this.optionsManager.openOptionsDirectory();

        console.log(boxManager.createBox(
            colors.success('📁 ABRINDO PASTA DE OPÇÕES') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text('📂 A pasta "options" está sendo aberta...') + '\n\n' +
            colors.muted('📍 Localização: ') + colors.info(this.optionsManager.optionsDir),
            { borderColor: colors.info2 }
        ));

        await this.delay(1500);
    }

    /**
     * Menu de logs 
     * @returns {Promise<void>}
     */
    async handleLogsMenu() {
        const { logAction } = await inquirer.prompt([
            {
                type: 'list',
                name: 'logAction',
                message: colors.text('📁 GERENCIAR LOGS'),
                choices: [
                    { name: '📊 Ver estatísticas de logs', value: 'stats' },
                    { name: '📂 Abrir pasta de logs', value: 'open' },
                    { name: '🔍 Debug API Structure', value: 'debug' },
                    { name: '🔙 Voltar', value: 'back' }
                ]
            }
        ]);

        switch (logAction) {
            case 'stats':
                await this.handleLogStats();
                break;
            case 'open':
                await this.handleOpenLogs();
                break;
            case 'debug':
                await this.handleDebugApi();
                break;
        }
    }

    /**
     * Gerencia análise de arquivo
     * @returns {Promise<void>}
     */
    async handleAnalyzeFile() {
        console.clear();

        console.log(boxManager.createBox(
            colors.title('📁 ANÁLISE DE ARQUIVO') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text('📄 Lendo URLs do arquivo links.txt...'),
            { borderColor: colors.scan }
        ));

        await this.delay(500); // Pequeno delay para visualização

        // O restante do método já chama ravcheck.analyzeFromFile() que mostra o box correto
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: colors.warning('📊 Deseja ver o resumo e iniciar a análise?'),
                default: false
            }
        ]);

        if (confirm) {
            await this.ravcheck.analyzeFromFile();
        }
    }

    /**
     * Gerencia análise de URL única
     * @returns {Promise<void>}
     */
    async handleAnalyzeSingle() {
        console.clear();

        console.log(boxManager.createBox(
            colors.title('🔍 ANÁLISE DE URL ÚNICA') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text('Digite o domínio ou URL completa') + '\n' +
            colors.muted('Exemplo: secguide.pages.dev ou https://exemplo.com'),
            { borderColor: theme.border.url }
        ));

        let canExit = false;

        while (!canExit) {
            try {
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'url',
                        message: colors.text('🌐 Digite o domínio ou URL para análise:'),
                        prefix: '',
                        validate: (input) => {
                            if (!input || !input.trim()) {
                                return colors.error('⚠️ É necessário digitar algo. Use "voltar" para retornar ao menu.');
                            }

                            const lowerInput = input.toLowerCase();
                            if (lowerInput === 'voltar' || lowerInput === 'back' || lowerInput === '..' || lowerInput === 'menu') {
                                canExit = true;
                                return true;
                            }

                            return true;
                        },
                    }
                ]);

                if (canExit) {
                    console.log(colors.muted('📌 Retornando ao menu principal...'));
                    return;
                }

                const rawInput = answers.url.trim();
                const processedData = this.processUrlIntelligently(rawInput);

                if (!processedData.valid) {
                    console.log('\n' + boxManager.createBox(
                        colors.warning('⚠️ CORREÇÃO DETECTADA') + '\n' +
                        colors.muted('─'.repeat(35)) + '\n' +
                        colors.text(`Você digitou: ${colors.url(rawInput)}`) + '\n' +
                        colors.text(`Sugerimos usar: ${colors.info(processedData.suggestedUrl)}`) + '\n' +
                        colors.muted(`Motivo: ${processedData.detectionMethod || 'Domínio detectado'}`),
                        { borderColor: theme.border.warning, width: 65 }
                    ));

                    const { confirm } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: colors.text('✅ Usar a URL corrigida automaticamente?'),
                            default: true,
                            prefix: ''
                        }
                    ]);

                    if (confirm) {
                        await this.proceedWithUrlAnalysis(processedData.suggestedUrl, processedData.type || 'dominio_detectado');
                        return;
                    } else {
                        const { tryAgain } = await inquirer.prompt([
                            {
                                type: 'confirm',
                                name: 'tryAgain',
                                message: colors.text('🔄 Deseja digitar outra URL?'),
                                default: true,
                                prefix: ''
                            }
                        ]);

                        if (!tryAgain) {
                            console.log(colors.muted('📌 Retornando ao menu principal...'));
                            return;
                        }
                        continue;
                    }
                }

                const finalUrl = processedData.url;

                console.log('\n' + boxManager.createBox(
                    colors.success('✅ URL PRONTA PARA ANÁLISE') + '\n' +
                    colors.muted('─'.repeat(35)) + '\n' +
                    colors.text(`Você digitou: ${colors.muted(rawInput)}`) + '\n' +
                    colors.text(`Será analisado: ${colors.url(finalUrl)}`),
                    { borderColor: theme.border.success, width: 60 }
                ));

                const { confirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: colors.text('🚀 Iniciar análise com esta URL?'),
                        default: true,
                        prefix: ''
                    }
                ]);

                if (confirm) {
                    await this.proceedWithUrlAnalysis(finalUrl, processedData.type || 'url_completa');
                    return;
                } else {
                    const { tryAgain } = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'tryAgain',
                            message: colors.text('🔄 Deseja analisar outra URL?'),
                            default: true,
                            prefix: ''
                        }
                    ]);

                    if (!tryAgain) {
                        console.log(colors.muted('📌 Retornando ao menu principal...'));
                        return;
                    }
                }

            } catch (error) {
                if (error.message === 'User force closed the prompt') {
                    console.log(colors.muted('\n📌 Operação cancelada pelo usuário.'));
                    return;
                }
                logger.error('❌ Erro na análise de URL única:', error);
                console.log(boxManager.createErrorBox(`❌ Erro: ${error.message}`));
                await this.pressToContinue();
            }
        }
    }

    /**
     * Processa URL de forma inteligente
     * @param {string} rawInput - Input do usuário
     * @returns {Object} Dados processados da URL
     */
    processUrlIntelligently(rawInput) {
        const input = rawInput.trim();

        if (input.startsWith('http://') || input.startsWith('https://')) {
            try {
                new URL(input);
                return {
                    url: input,
                    type: 'url_completa',
                    detectionMethod: 'URL completa válida',
                    originalInput: rawInput,
                    valid: true,
                    needsCorrection: false
                };
            } catch (error) {
                return {
                    error: `❌ URL inválida: ${error.message}`,
                    suggestedUrl: null,
                    originalInput: rawInput,
                    valid: false,
                    needsCorrection: false
                };
            }
        }

        let cleanInput = input;
        if (cleanInput.startsWith('//')) {
            cleanInput = cleanInput.substring(2);
        }

        const domainPatterns = [
            /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?:\/[^\s]*)?$/,
            /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?(?:\/[^\s]*)?$/,
            /^localhost(?::[0-9]+)?(?:\/[^\s]*)?$/i
        ];

        const isLikelyDomain = domainPatterns.some(pattern => pattern.test(cleanInput));

        if (isLikelyDomain) {
            const suggestedUrl = `https://${cleanInput}`;
            return {
                url: suggestedUrl,
                type: 'dominio_detectado',
                detectionMethod: 'Domínio detectado - será usado HTTPS',
                originalInput: rawInput,
                valid: true,
                needsCorrection: true,
                suggestedUrl: suggestedUrl
            };
        }

        if (cleanInput.includes('.') && !cleanInput.includes(' ') && cleanInput.length > 3) {
            const suggestedUrl = `https://${cleanInput}`;
            return {
                url: suggestedUrl,
                type: 'dominio_provavel',
                detectionMethod: 'Padrão de domínio detectado',
                originalInput: rawInput,
                valid: true,
                needsCorrection: true,
                suggestedUrl: suggestedUrl
            };
        }

        return {
            error: `❌ Formato não reconhecido. Digite uma URL completa ou um domínio válido.`,
            suggestedUrl: `https://${cleanInput}`,
            originalInput: rawInput,
            valid: false,
            needsCorrection: true
        };
    }

    /**
     * Procede com análise da URL
     * @param {string} url - URL para análise
     * @param {string} urlType - Tipo da URL detectada
     * @returns {Promise<void>}
     */
    async proceedWithUrlAnalysis(url, urlType) {
        console.clear();

        console.log(boxManager.createBox(
            colors.title('🔍 CONFIGURAÇÃO DA ANÁLISE') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text(`🌐 URL para análise: ${colors.url(url)}`) + '\n' +
            colors.muted(`📝 Tipo: ${urlType}`),
            { borderColor: theme.border.scan }
        ));

        const tagsOptions = await inquirer.prompt([
            {
                type: 'input',
                name: 'tags',
                message: colors.text('🏷️ Digite tags personalizadas (separadas por vírgula, Enter para usar apenas tags fixas):'),
                default: '',
                prefix: ''
            },
            {
                type: 'list',
                name: 'visibility',
                message: colors.text('🔒 Selecione a visibilidade:'),
                choices: [
                    { name: '🌐 Pública (visível para todos)', value: 'public' },
                    { name: '🔒 Não-listada (apenas com link)', value: 'unlisted' },
                    { name: '🔐 Privada (apenas você)', value: 'private' }
                ],
                default: 'public',
                prefix: ''
            }
        ]);

        const customTags = tagsOptions.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        const allTags = this.ravcheck.combineTags(customTags);

        console.log('\n' + boxManager.createBox(
            colors.title('🎯 RESUMO DA ANÁLISE') + '\n' +
            colors.muted('─'.repeat(35)) + '\n' +
            colors.text(`🌐 URL: ${colors.url(url)}`) + '\n' +
            colors.text(`🏷️ Tags fixas: ${colors.muted(this.ravcheck.loadTags().slice(0, 3).join(', ') + '...')}`) + '\n' +
            colors.text(`🏷️ Tags personalizadas: ${colors.tag(customTags.length > 0 ? customTags.join(', ') : 'Nenhuma')}`) + '\n' +
            colors.text(`🏷️ Total de tags: ${colors.highlight(allTags.length)}`) + '\n' +
            colors.text(`🔒 Visibilidade: ${colors.info(tagsOptions.visibility)}`),
            { borderColor: theme.border.info, width: 70 }
        ));

        const { finalConfirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'finalConfirm',
                message: colors.text('🚀 Confirmar e iniciar análise?'),
                default: true,
                prefix: ''
            }
        ]);

        if (finalConfirm) {
            await this.ravcheck.analyzeSingleUrl(url, customTags, tagsOptions.visibility);
        } else {
            console.log(colors.muted('\n📌 Análise cancelada pelo usuário.'));
        }
    }

    /**
     * Gerencia tags
     * @returns {Promise<void>}
     */
    async handleManageTags() {
        const fixedTags = []; // Tags fixas do arquivo antigo
        if (fs.existsSync(this.ravcheck.fixedTagsPath)) {
            const fixedContent = fs.readFileSync(this.ravcheck.fixedTagsPath, 'utf8');
            fixedTags.push(...fixedContent.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#')));
        }

        const customTags = this.optionsManager.loadTags();
        const totalTags = [...fixedTags, ...customTags];

        console.log(boxManager.createFileInfoBox({
            name: 'tags.txt',
            validLines: customTags.length,
            totalItems: totalTags.length,
            path: this.optionsManager.getFilePath('tags.txt')
        }));

        console.log('\n' + colors.title('🏷️ TAGS FIXAS (não editáveis):'));
        if (fixedTags.length > 0) {
            fixedTags.forEach((tag, index) => {
                console.log(colors.text(`  ${index + 1}. ${colors.muted(tag)} ${colors.dim('(fixa)')}`));
            });
        } else {
            console.log(colors.muted('  📭 Nenhuma tag fixa configurada'));
        }

        console.log('\n' + colors.title('🏷️ TAGS PERSONALIZADAS:'));
        if (customTags.length > 0) {
            customTags.forEach((tag, index) => {
                console.log(colors.text(`  ${index + 1}. ${colors.tag(tag)}`));
            });
        } else {
            console.log(colors.muted('  📌 Nenhuma tag personalizada adicionada.'));
            console.log(colors.muted('  💡 Use "Adicionar nova tag" para criar tags exclusivas.'));
        }

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: colors.text('🎯 O que deseja fazer?'),
                choices: [
                    { name: '➕ Adicionar nova tag personalizada', value: 'add' },
                    { name: '✏️ Editar tags personalizadas', value: 'edit' },
                    { name: '🗑️ Limpar todas as tags personalizadas', value: 'clear' },
                    { name: '🔙 Voltar', value: 'back' }
                ]
            }
        ]);

        switch (action) {
            case 'add':
                await this.handleAddTag();
                break;
            case 'edit':
                await this.handleEditTags();
                break;
            case 'clear':
                await this.handleClearTags();
                break;
        }
    }

    /**
     * Adiciona nova tag corretamente
     * @returns {Promise<void>}
     */
    async handleAddTag() {
        const { tag } = await inquirer.prompt([
            {
                type: 'input',
                name: 'tag',
                message: colors.text('🏷️ Digite a nova tag personalizada:'),
                validate: (input) => {
                    const trimmed = input.trim();
                    if (!trimmed) return '❌ A tag não pode estar vazia!';
                    if (trimmed.length > 50) return '❌ Tag muito longa (máx: 50 caracteres)!';
                    if (!/^[a-zA-Z0-9-_]+$/.test(trimmed)) {
                        return '❌ Use apenas letras, números, hífens e underlines!';
                    }
                    return true;
                }
            }
        ]);

        const trimmedTag = tag.trim();
        const success = this.ravcheck.addTag(trimmedTag);

        if (success) {
            logger.success(`Tag "${trimmedTag}" adicionada com sucesso!`);
        } else {
            logger.warn(`Tag "${trimmedTag}" não foi adicionada (possível duplicata).`);
        }
    }

    /**
     * Edita tags personalizadas
     * @returns {Promise<void>}
     */
    async handleEditTags() {
        const customTags = this.ravcheck.loadCustomTags();

        if (customTags.length === 0) {
            console.log(boxManager.createWarningBox('⚠️ Nenhuma tag personalizada para editar.'));
            return;
        }

        const { tags: newTags } = await inquirer.prompt([
            {
                type: 'editor',
                name: 'tags',
                message: colors.text('✏️ Edite as tags personalizadas (uma por linha):'),
                default: customTags.join('\n')
            }
        ]);

        const updatedTags = newTags.split('\n')
            .map(tag => tag.trim())
            .filter(tag => tag && !tag.startsWith('#'));

        this.ravcheck.saveTags(updatedTags);
        logger.success(`${updatedTags.length} tags personalizadas salvas!`);
    }

    /**
     * Limpa todas as tags personalizadas
     * @returns {Promise<void>}
     */
    async handleClearTags() {
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: colors.error('🚨 TEM CERTEZA? Isso removerá TODAS as tags personalizadas!'),
                default: false
            }
        ]);

        if (confirm) {
            this.ravcheck.saveTags([]);
            logger.success('✅ Todas as tags personalizadas foram removidas!');
        }
    }

    /**
     * Gerencia URLs
     * @returns {Promise<void>}
     */
    async handleManageUrls() {
        const urls = this.optionsManager.loadUrls();

        console.log(boxManager.createFileInfoBox({
            name: 'links.txt',
            validLines: urls.length,
            totalItems: urls.length,
            path: this.optionsManager.getFilePath('links.txt')
        }));

        if (urls.length > 0) {
            console.log('\n' + colors.title('🔗 URLs ATUAIS:'));
            urls.forEach((url, index) => {
                console.log(colors.text(`  ${index + 1}. ${colors.url(url)}`));
            });
        }

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: colors.text('🎯 O que deseja fazer?'),
                choices: [
                    { name: '➕ Adicionar nova URL', value: 'add' },
                    { name: '✏️ Editar URLs', value: 'edit' },
                    { name: '🗑️ Limpar todas as URLs', value: 'clear' },
                    { name: '🔙 Voltar', value: 'back' }
                ]
            }
        ]);

        switch (action) {
            case 'add':
                await this.handleAddUrl();
                break;
            case 'edit':
                await this.handleEditUrls();
                break;
            case 'clear':
                await this.handleClearUrls();
                break;
        }
    }

    /**
     * Adiciona nova URL
     * @returns {Promise<void>}
     */
    async handleAddUrl() {
        const { url } = await inquirer.prompt([
            {
                type: 'input',
                name: 'url',
                message: colors.text('🔗 Digite a nova URL:'),
                validate: (input) => {
                    if (!input.trim()) return '❌ A URL não pode estar vazia!';
                    if (!input.startsWith('http://') && !input.startsWith('https://')) {
                        return '❌ URL deve começar com http:// ou https://';
                    }
                    return true;
                }
            }
        ]);

        this.ravcheck.addUrl(url.trim());
        logger.success(`URL "${url}" adicionada!`);
    }

    /**
     * Edita URLs
     * @returns {Promise<void>}
     */
    async handleEditUrls() {
        const urls = this.optionsManager.loadUrls();

        if (urls.length === 0) {
            console.log(boxManager.createWarningBox('⚠️ Nenhuma URL para editar.'));
            return;
        }

        const { urls: newUrls } = await inquirer.prompt([
            {
                type: 'editor',
                name: 'urls',
                message: colors.text('✏️ Edite as URLs (uma por linha):'),
                default: urls.join('\n')
            }
        ]);

        const updatedUrls = newUrls.split('\n')
            .map(url => url.trim())
            .filter(url => url && !url.startsWith('#') &&
                (url.startsWith('http://') || url.startsWith('https://')));

        this.optionsManager.saveUrls(updatedUrls);
        logger.success(`${updatedUrls.length} URLs salvas!`);
    }

    /**
     * Limpa todas as URLs
     * @returns {Promise<void>}
     */
    async handleClearUrls() {
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: colors.error('🚨 TEM CERTEZA? Isso removerá TODAS as URLs!'),
                default: false
            }
        ]);

        if (confirm) {
            this.ravcheck.saveUrls([]);
            logger.success('✅ Todas as URLs foram removidas!');
        }
    }

    /**
     * Configura API
     * @returns {Promise<void>}
     */
    async handleSetupApi() {
        const authStatus = this.ravcheck.authManager.getStatus();

        if (authStatus.configured && authStatus.valid) {
            const maskedInfo = this.ravcheck.authManager.getMaskedInfo();
            console.log(boxManager.createApiConfigBox(maskedInfo.maskedKey));

            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: colors.text('🔑 A chave API já está configurada. O que deseja fazer?'),
                    choices: [
                        { name: '🔄 Alterar chave API', value: 'change' },
                        { name: '🗑️ Remover chave API', value: 'remove' },
                        { name: '🔙 Voltar', value: 'back' }
                    ]
                }
            ]);

            if (action === 'change') {
                await this.promptForApiKey();
            } else if (action === 'remove') {
                await this.handleRemoveApiKey();
            }
        } else {
            await this.promptForApiKey();
        }
    }

    /**
     * Solicita chave API
     * @returns {Promise<void>}
     */
    async promptForApiKey() {
        console.log(boxManager.createBox(
            colors.title('🔑 CONFIGURAÇÃO DA API') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text('📋 Obtenha sua chave API em: ') + colors.link('https://urlscan.io/user/signup') + '\n' +
            colors.text('📝 Formato esperado: UUID (ex: 12345678-1234-1234-1234-123456789012)'),
            { borderColor: colors.primary }
        ));

        const { apiKey } = await inquirer.prompt([
            {
                type: 'password',
                name: 'apiKey',
                message: colors.text('🔑 Digite sua chave API do urlscan.io:'),
                validate: (input) => {
                    if (!input) return '❌ A chave API é obrigatória!';
                    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input)) {
                        return '❌ Formato inválido! Use o formato UUID.';
                    }
                    return true;
                },
                mask: '*'
            }
        ]);

        const success = this.ravcheck.authManager.saveApiKey(apiKey);
        if (success) {
            logger.success('✅ Chave API configurada com sucesso!');
        }
    }

    /**
     * Remove chave API
     * @returns {Promise<void>}
     */
    async handleRemoveApiKey() {
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: colors.error('🚨 TEM CERTEZA? Isso removerá a chave API permanentemente!'),
                default: false
            }
        ]);

        if (confirm) {
            this.ravcheck.authManager.removeApiKey();
            logger.success('✅ Chave API removida!');
        }
    }

    /**
     * Verifica rate limit
     * @returns {Promise<void>}
     */
    async handleCheckRate() {
        console.clear();

        console.log(boxManager.createBox(
            colors.title('📊 VERIFICAÇÃO DE RATE LIMIT') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text('🔗 Conectando à API do urlscan.io...'),
            { borderColor: theme.border.info }
        ));

        try {
            const quotaInfo = await this.ravcheck.checkRateLimit();

            if (!quotaInfo) {
                console.log(boxManager.createErrorBox('❌ Não foi possível verificar o rate limit.'));
                return;
            }

            console.clear();

            let rateBoxContent = colors.title('📊 RATE LIMIT & QUOTAS') + '\n';
            rateBoxContent += colors.muted('─'.repeat(50)) + '\n\n';

            rateBoxContent += colors.subtitle('📋 PLANO: ') +
                colors.success(quotaInfo.team) + '\n';

            rateBoxContent += colors.muted('🔄 Quotas diárias são resetadas às ') +
                colors.info('12:00 AM UTC') + colors.muted(' (meia-noite UTC)') + '\n\n';

            rateBoxContent += colors.subtitle('🎯 LIMITES POR AÇÃO:') + '\n';
            rateBoxContent += colors.muted('─'.repeat(60)) + '\n';

            const actions = [
                { key: 'Public Scans', name: 'Public Scans', emoji: '🌐' },
                { key: 'Unlisted Scans', name: 'Unlisted Scans', emoji: '🔒' },
                { key: 'Private Scans', name: 'Private Scans', emoji: '🔐' },
                { key: 'Search Requests', name: 'Search Requests', emoji: '🔍' },
                { key: 'Result Retrieve', name: 'Result Retrieve', emoji: '📥' }
            ];

            actions.forEach(action => {
                const limits = quotaInfo.limits[action.key];
                const usage = quotaInfo.usage[action.key];

                if (limits && limits.perDay > 0) {
                    rateBoxContent += '\n' + colors.highlight(`${action.emoji} ${action.name}:`) + '\n';

                    let minuteLine = colors.text('  🕐 Por Minuto: ');
                    if (usage && usage.perMinute) {
                        minuteLine += this.formatUsageLine(usage.perMinute, limits.perMinute);
                    } else {
                        minuteLine += colors.text(`${0} / ${limits.perMinute} `) +
                            colors.muted('(0%)');
                    }
                    rateBoxContent += minuteLine + '\n';

                    let hourLine = colors.text('  🕐 Por Hora:   ');
                    if (usage && usage.perHour) {
                        hourLine += this.formatUsageLine(usage.perHour, limits.perHour);
                    } else {
                        hourLine += colors.text(`${0} / ${limits.perHour} `) +
                            colors.muted('(0%)');
                    }
                    rateBoxContent += hourLine + '\n';

                    let dayLine = colors.text('  📅 Por Dia:    ');
                    if (usage && usage.perDay) {
                        dayLine += this.formatUsageLine(usage.perDay, limits.perDay);

                        if (quotaInfo.rawData?.limits?.[action.key.toLowerCase().replace(' scans', '').replace(' ', '_')]?.day?.reset) {
                            const resetTime = new Date(quotaInfo.rawData.limits[action.key.toLowerCase().replace(' scans', '').replace(' ', '_')].day.reset);
                            rateBoxContent += colors.text(`    🔄 Reset: ${colors.info(resetTime.toUTCString().split(' ')[4])} UTC\n`);
                        }
                    } else {
                        dayLine += colors.text(`${0} / ${limits.perDay} `) +
                            colors.muted('(0%)');
                    }
                    rateBoxContent += dayLine + '\n';

                    if (usage && usage.lastActivity) {
                        const lastActivity = new Date(usage.lastActivity);
                        rateBoxContent += colors.text(`  🕒 Última atividade: ${colors.muted(lastActivity.toLocaleString('pt-BR'))}\n`);
                    }
                }
            });

            rateBoxContent += '\n' + colors.subtitle('📈 TOTAIS UTILIZADOS HOJE:') + '\n';
            rateBoxContent += colors.muted('─'.repeat(30)) + '\n';

            let totalPublic = 0, totalUnlisted = 0, totalPrivate = 0, totalSearch = 0, totalRetrieve = 0;

            if (quotaInfo.usage['Public Scans'] && quotaInfo.usage['Public Scans'].perDay) {
                totalPublic = quotaInfo.usage['Public Scans'].perDay.used;
            }
            if (quotaInfo.usage['Unlisted Scans'] && quotaInfo.usage['Unlisted Scans'].perDay) {
                totalUnlisted = quotaInfo.usage['Unlisted Scans'].perDay.used;
            }
            if (quotaInfo.usage['Private Scans'] && quotaInfo.usage['Private Scans'].perDay) {
                totalPrivate = quotaInfo.usage['Private Scans'].perDay.used;
            }
            if (quotaInfo.usage['Search Requests'] && quotaInfo.usage['Search Requests'].perDay) {
                totalSearch = quotaInfo.usage['Search Requests'].perDay.used;
            }
            if (quotaInfo.usage['Result Retrieve'] && quotaInfo.usage['Result Retrieve'].perDay) {
                totalRetrieve = quotaInfo.usage['Result Retrieve'].perDay.used;
            }

            const totalDaily = totalPublic + totalUnlisted + totalPrivate;

            rateBoxContent += colors.text(`  🌐 Scans Públicos:    ${colors.info(totalPublic)}\n`);
            rateBoxContent += colors.text(`  🔒 Scans Não-listados: ${colors.info(totalUnlisted)}\n`);
            rateBoxContent += colors.text(`  🔐 Scans Privados:    ${colors.info(totalPrivate)}\n`);
            rateBoxContent += colors.text(`  🔍 Buscas:            ${colors.info(totalSearch)}\n`);
            rateBoxContent += colors.text(`  📥 Recuperações:      ${colors.info(totalRetrieve)}\n`);
            rateBoxContent += colors.muted('─'.repeat(30)) + '\n';
            rateBoxContent += colors.text(`  📊 Total de Scans:    ${colors.highlight(totalDaily)}\n`);
            rateBoxContent += colors.text(`  📈 Total Geral:       ${colors.highlight(totalDaily + totalSearch + totalRetrieve)}\n`);

            if (quotaInfo.nextReset) {
                rateBoxContent += '\n' + colors.subtitle('🔄 PRÓXIMOS RESETS:') + '\n';
                rateBoxContent += colors.muted('─'.repeat(30)) + '\n';

                const dailyReset = new Date(quotaInfo.nextReset.daily.time);
                const hourlyReset = new Date(quotaInfo.nextReset.hourly.time);

                rateBoxContent += colors.text(`  📅 Diário:    ${colors.info(dailyReset.toUTCString().split(' ')[4])} UTC\n`);
                rateBoxContent += colors.text(`  🕐 Por Hora:   ${colors.info(hourlyReset.toUTCString().split(' ')[4])} UTC\n`);
                rateBoxContent += colors.text(`  ⏱️ Por Minuto: ${colors.info('A cada minuto')}\n`);
            }

            rateBoxContent += '\n' + colors.subtitle('📊 STATUS DO PLANO:') + '\n';
            rateBoxContent += colors.muted('─'.repeat(30)) + '\n';

            const dailyPercentage = totalDaily > 0 ? Math.round((totalDaily / 5000) * 100) : 0;
            let planStatus = colors.success('🟢 NORMAL');
            let planMessage = colors.muted('Uso dentro dos limites');

            if (dailyPercentage >= 80) {
                planStatus = colors.error('🔴 CRÍTICO');
                planMessage = colors.error('Uso próximo do limite diário');
            } else if (dailyPercentage >= 50) {
                planStatus = colors.warning('🟡 ALERTA');
                planMessage = colors.warning('Uso moderado');
            }

            rateBoxContent += colors.text(`  Status: ${planStatus}\n`);
            rateBoxContent += colors.text(`  Uso diário: ${colors.info(dailyPercentage)}%\n`);
            rateBoxContent += colors.text(`  Mensagem: ${planMessage}\n`);

            rateBoxContent += '\n' + colors.muted(`🕒 ${new Date().toLocaleString('pt-BR')}`);

            console.log(boxManager.createBox(rateBoxContent, {
                borderStyle: 'classic',
                borderColor: dailyPercentage >= 80 ? theme.border.error :
                    dailyPercentage >= 50 ? theme.border.warning : theme.border.success,
                width: 70,
                padding: 1,
                margin: 1,
                textAlignment: 'left'
            }));

        } catch (error) {
            console.log(boxManager.createErrorBox(`❌ Erro ao verificar rate limit: ${error.message}`));
        }
    }

    /**
     * Mostra estatísticas dos logs
     * @returns {Promise<void>}
     */
    async handleLogStats() {
        console.clear();

        console.log(boxManager.createBox(
            colors.title('📈 ESTATÍSTICAS DE LOGS') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text('📊 Analisando estrutura de logs...'),
            { borderColor: theme.border.info }
        ));

        const stats = this.ravcheck.logManager.getLogStats();

        if (stats.error) {
            console.log(boxManager.createErrorBox(`❌ Erro ao obter estatísticas: ${stats.error}`));
            return;
        }

        let statsContent = colors.title('📊 ESTATÍSTICAS DE ARQUIVOS DE LOG') + '\n';
        statsContent += colors.muted('─'.repeat(50)) + '\n\n';

        statsContent += colors.subtitle('📁 RESUMO GERAL:') + '\n';
        statsContent += colors.muted('─'.repeat(30)) + '\n';
        statsContent += colors.text(`  📄 Total de arquivos: ${colors.highlight(stats.totalFiles)}\n`);
        statsContent += colors.text(`  💾 Espaço total: ${colors.info(this.formatBytes(stats.totalSize))}\n\n`);

        statsContent += colors.subtitle('📂 DISTRIBUIÇÃO POR CATEGORIA:') + '\n';
        statsContent += colors.muted('─'.repeat(40)) + '\n';

        Object.entries(stats.categories).forEach(([category, data]) => {
            const categoryName = category === 'root' ? '📁 Principal' : `📂 ${category}`;
            statsContent += colors.text(`  ${categoryName}:\n`);
            statsContent += colors.text(`    📄 Arquivos: ${colors.info(data.files)}\n`);
            statsContent += colors.text(`    💾 Tamanho: ${colors.info(this.formatBytes(data.size))}\n\n`);
        });

        if (stats.recentFiles.length > 0) {
            statsContent += colors.subtitle('🕒 ARQUIVOS RECENTES:') + '\n';
            statsContent += colors.muted('─'.repeat(40)) + '\n';

            stats.recentFiles.forEach((file, index) => {
                const emoji = index < 3 ? '🔥' : '📄';
                const timeAgo = this.getTimeAgo(file.modified);
                statsContent += colors.text(`  ${emoji} ${file.name}\n`);
                statsContent += colors.muted(`    📁 ${file.category} | 💾 ${this.formatBytes(file.size)} | 🕒 ${timeAgo}\n\n`);
            });
        }

        statsContent += colors.muted(`🕒 Última atualização: ${new Date().toLocaleString('pt-BR')}`);

        console.log(boxManager.createBox(statsContent, {
            borderStyle: 'classic',
            borderColor: theme.border.info2,
            width: 70,
            padding: 1,
            margin: 1,
            textAlignment: 'left'
        }));
    }

    /**
     * Formata bytes para string legível
     * @param {number} bytes - Bytes a formatar
     * @returns {string} String formatada
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Calcula tempo relativo
     * @param {Date} date - Data para calcular
     * @returns {string} Tempo relativo em português
     */
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.round(diffMs / 60000);
        const diffHours = Math.round(diffMs / 3600000);
        const diffDays = Math.round(diffMs / 86400000);

        if (diffMins < 1) return 'agora mesmo';
        if (diffMins < 60) return `há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
        if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        if (diffDays < 30) return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;

        const diffMonths = Math.round(diffDays / 30);
        if (diffMonths < 12) return `há ${diffMonths} mês${diffMonths > 1 ? 'es' : ''}`;

        const diffYears = Math.round(diffMonths / 12);
        return `há ${diffYears} ano${diffYears > 1 ? 's' : ''}`;
    }

    /**
     * Debug da estrutura da API
     * @returns {Promise<void>}
     */
    async handleDebugApi() {
        console.clear();

        console.log(boxManager.createBox(
            colors.title('🐛 DEBUG DA API') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text('🔍 Analisando estrutura da API do urlscan.io...'),
            { borderColor: theme.border.warning }
        ));

        await this.ravcheck.debugApiStructure();
    }

    /**
     * Abre diretório de logs
     * @returns {Promise<void>}
     */
    async handleOpenLogs() {
        this.ravcheck.logManager.openLogsDirectory();
        console.log(boxManager.createBox(
            colors.success('📁 ABRINDO PASTA DE LOGS') + '\n' +
            colors.muted('─'.repeat(40)) + '\n' +
            colors.text('📂 A pasta de logs está sendo aberta...'),
            { borderColor: colors.info2 }
        ));
    }

    /**
     * Sai do programa normalmente
     * @returns {Promise<void>}
     */
    async handleExit() {
        console.clear();
        console.log(boxManager.createExitBox());
        await this.delay(1500);
        process.exit(0);
    }

    /**
     * Formata linha de uso
     * @param {Object} usage - Dados de uso
     * @param {number} limit - Limite total
     * @returns {string} Linha formatada
     */
    formatUsageLine(usage, limit) {
        if (!usage || limit === 0) {
            return colors.text(`0 / ${limit} `) + colors.muted('(0%)');
        }

        let colorFn;
        const percentage = usage.percentage || Math.round((usage.used / limit) * 100);

        if (percentage >= 80) {
            colorFn = colors.error;
        } else if (percentage >= 50) {
            colorFn = colors.warning;
        } else {
            colorFn = colors.success;
        }

        return colorFn(`${usage.used} / ${limit} `) +
            colors.muted(`(${percentage}%)`);
    }

    /**
     * Aguarda pressionamento de tecla para continuar
     * @returns {Promise<void>}
     */
    async pressToContinue() {
        try {
            console.log('\n' + colors.muted('─'.repeat(50)));

            await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'ready',
                    message: colors.muted('⏎ Pressione Enter para voltar ao menu principal...'),
                    default: true,
                    prefix: ''
                }
            ]);

            // Limpar buffer após confirmação
            this.clearInquirerBuffer();

        } catch (error) {
            // Se houver erro, apenas limpe e continue
            this.clearInquirerBuffer();
        }

        // Limpar console após confirmação
        console.clear();
    }

    /**
     * Delay
     * @param {number} ms - Milissegundos
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = UI;