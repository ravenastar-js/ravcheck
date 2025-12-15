const { colors, theme } = require('../config/colors');
const packageInfo = require('./packageInfo');
const logger = require('./logger');

/**
 * 🎪 Gerenciador de Boxes Visuais
 * @class BoxManager
 * @description Cria caixas estilizadas para diferentes tipos de conteúdo
 */
class BoxManager {
    /**
     * 🏗️ Construtor da classe BoxManager
     * @constructor
     */
    constructor() {
        this.appInfo = packageInfo.allInfo;
    }

    /**
     * 📦 Cria uma caixa estilizada com conteúdo
     * @param {string} content - Conteúdo da caixa
     * @param {Object} options - Opções de formatação
     * @returns {string} Caixa formatada
     */
    createBox(content, options = {}) {
        try {
            const boxen = require('boxen');

            const defaultOptions = {
                padding: 1,
                margin: 1,
                borderStyle: 'classic',
                borderColor: theme.border.primary,
                backgroundColor: theme.background,
                width: 60,
                textAlignment: 'left'
            };

            const finalOptions = { ...defaultOptions, ...options };
            return boxen(content, finalOptions);
        } catch (error) {
            logger.debug('Fallback de box ativado:', error);
            return `\n${'═'.repeat(60)}\n${content}\n${'═'.repeat(60)}\n`;
        }
    }

    /**
     * 📏 Função para quebrar texto em múltiplas linhas
     * @param {string} text - Texto a ser quebrado
     * @param {number} maxWidth - Largura máxima por linha
     * @returns {string[]} Array de linhas quebradas
     */
    wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            // Se adicionando esta palavra exceder o limite, começa nova linha
            if ((currentLine + ' ' + word).trim().length <= maxWidth) {
                currentLine = (currentLine + ' ' + word).trim();
            } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            }
        });

        if (currentLine) lines.push(currentLine);
        return lines;
    }

    /**
     * 🎉 Cria box de boas-vindas
     * @returns {string} Box de welcome estilizado
     */
    createWelcomeBox() {
        console.clear();
        try {
            let bannerText;
            let boxWidth = 60; // Largura desejada do box

            try {
                const figlet = require('figlet');
                // Usar fonte mais compacta
                bannerText = colors.success(
                    figlet.textSync(this.appInfo.name.toUpperCase(), {
                        font: 'Small', // Compacta
                        horizontalLayout: 'fitted'
                    })
                );

                // Calcular largura real do banner
                const bannerLines = bannerText.split('\n');
                const bannerWidth = Math.max(...bannerLines.map(line => {
                    // Remover códigos de cor para contar caracteres reais
                    return line.replace(/\x1b\[[0-9;]*m/g, '').length;
                }));

                // Ajustar width se o banner for mais largo
                boxWidth = Math.max(boxWidth, bannerWidth + 4);

            } catch (figletError) {
                logger.debug('Figlet não disponível, usando fallback');
                bannerText = colors.success.bold(` ${this.appInfo.name.toUpperCase()} `) +
                    colors.highlight2(`v${this.appInfo.version}`);
            }

            // Processar descrição com quebra de linha
            const cleanDescription = this.appInfo.description
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Quebrar descrição para caber no box (considerando padding)
            const textWidth = boxWidth - 6; // -6 para bordas (2) + padding (4)
            const wrappedDescription = this.wrapText(cleanDescription, textWidth);

            // Processar homepage (se muito longo, encurtar)
            let homepageDisplay = this.appInfo.site;
            if (homepageDisplay.length > textWidth) {
                homepageDisplay = homepageDisplay.substring(0, textWidth - 3) + '...';
            }

            // Construir conteúdo
            const contentLines = [
                bannerText,
                colors.highlight2(`v${this.appInfo.version}`),
                ''
            ];

            // Adicionar descrição quebrada
            wrappedDescription.forEach(line => {
                contentLines.push(colors.text(line));
            });

            // Adicionar informações restantes
            contentLines.push(
                '',
                colors.text('Feito com ') + colors.danger('💚') + colors.text(' por ') + colors.primary.bold(this.appInfo.wuser),
                '',
                colors.text('🔗 ') + colors.link(homepageDisplay),
                '',
                colors.muted('Pressione ') + colors.warning('Ctrl+C') + colors.muted(' para sair')
            );

            return this.createBox(contentLines.join('\n'), {
                borderStyle: 'classic',
                borderColor: theme.border.primary,
                width: boxWidth,
                padding: 1,
                margin: 1,
                textAlignment: 'center'
            });
        } catch (error) {
            logger.error('Erro crítico em createWelcomeBox:', error);
            // Fallback com quebra de texto também
            try {
                const fallbackWidth = 55;
                const textWidth = fallbackWidth - 6;
                const wrappedDesc = this.wrapText(this.appInfo.description, textWidth);

                const fallbackContent = [
                    colors.success.bold(`${this.appInfo.name.toUpperCase()}`),
                    colors.highlight2(`v${this.appInfo.version}`),
                    ''
                ];

                wrappedDesc.forEach(line => {
                    fallbackContent.push(colors.text(line));
                });

                fallbackContent.push(
                    '',
                    colors.text('Feito com ') + colors.danger('💚') + colors.text(' por ') + colors.primary.bold(this.appInfo.wuser)
                );

                return this.createBox(fallbackContent.join('\n'), {
                    borderStyle: 'classic',
                    borderColor: theme.border.primary,
                    width: fallbackWidth,
                    padding: 1,
                    textAlignment: 'center'
                });
            } catch (fallbackError) {
                // Último fallback mínimo
                return this.createBox(
                    [
                        colors.success.bold(`${this.appInfo.name} v${this.appInfo.version}`),
                        '',
                        colors.text(this.appInfo.description.substring(0, 40) + '...'),
                        '',
                        colors.primary(`by ${this.appInfo.wuser}`)
                    ].join('\n'),
                    {
                        borderStyle: 'classic',
                        borderColor: theme.border.primary,
                        width: 50,
                        padding: 1,
                        textAlignment: 'center'
                    }
                );
            }
        }
    }


    /**
     * 👋 Cria box de despedida
     * @returns {string} Box de despedida estilizado
     */
    createExitBox() {
        try {
            // Processar homepage (se muito longo, encurtar)
            let homepageDisplay = this.appInfo.homepage;
            const textWidth = 60 - 6; // Considerando padding e bordas
            if (homepageDisplay.length > textWidth) {
                homepageDisplay = homepageDisplay.substring(0, textWidth - 3) + '...';
            }

            const content = [
                colors.highlight('👋 ATÉ LOGO!'),
                colors.muted('─'.repeat(20)),
                '',
                colors.text('Feito com ') + colors.danger('💚') + colors.text(' por ') + colors.primary.bold(this.appInfo.wuser),
                '',
                colors.text('🔗 ') + colors.link(homepageDisplay),
                '',
                colors.muted('Até a próxima análise! 🚀')
            ].join('\n');

            return this.createBox(content, {
                borderStyle: 'classic',
                borderColor: 'yellow',
                width: 60,
                padding: 1,
                margin: 1,
                textAlignment: 'center'
            });
        } catch (error) {
            logger.error('Erro em createExitBox:', error);
            // Fallback simples
            return this.createBox(
                [
                    colors.highlight('👋 ATÉ LOGO!'),
                    colors.muted('─'.repeat(20)),
                    '',
                    colors.text('Feito com ') + colors.danger('💚') + colors.text(' por ') + colors.primary.bold(this.appInfo.wuser),
                    '',
                    colors.text('🔗 ') + colors.link(this.appInfo.homepage),
                    '',
                    colors.muted('Até a próxima análise! 🚀')
                ].join('\n'),
                {
                    borderStyle: 'classic',
                    borderColor: 'yellow',
                    width: 60,
                    padding: 1,
                    textAlignment: 'center'
                }
            );
        }
    }

    /**
     * 📊 Cria box de resultado de análise
     * @param {Object} result - Resultado da análise
     * @returns {string} Box formatado
     */
    createScanResultBox(result) {
        try {
            // Quebrar URL se for muito longa
            let urlDisplay = result.urlOriginal;
            const maxUrlLength = 45;
            if (urlDisplay.length > maxUrlLength) {
                urlDisplay = urlDisplay.substring(0, maxUrlLength - 3) + '...';
            }

            // Quebrar tags se houver muitas
            let tagsDisplay = result.tags.join(', ');
            const maxTagsLength = 40;
            if (tagsDisplay.length > maxTagsLength) {
                tagsDisplay = tagsDisplay.substring(0, maxTagsLength - 3) + '...';
            }

            const content = [
                colors.success('✅ ANÁLISE CONCLUÍDA'),
                colors.muted('─'.repeat(35)),
                '',
                colors.text(`📝 Nome: ${colors.highlight(result.nome)}`),
                colors.text(`🌐 URL: ${colors.url(urlDisplay)}`),
                '',
                colors.text(`🏷️ Tags: ${colors.tag(tagsDisplay)}`),
                '',
                result.sucesso ?
                    colors.success(`✅ Status: SUCESSO`) :
                    colors.error(`❌ Status: FALHA`),
                '',
                result.urlRelatorio ?
                    colors.text(`📊 Relatório: ${colors.link(result.urlRelatorio)}`) :
                    colors.text(`📊 Relatório: N/A`),
                '',
                colors.text(`🆔 UUID: ${colors.uuid(result.uuid || 'N/A')}`),
                '',
                colors.muted(`🕒 ${result.timestamp}`)
            ].join('\n');

            return this.createBox(content, {
                borderStyle: 'classic',
                borderColor: result.sucesso ? 'green' : 'red',
                width: 60,
                margin: 1,
                padding: 1
            });
        } catch (error) {
            logger.error('Erro em createScanResultBox:', error);
            return colors.text(`📊 Resultado: ${JSON.stringify(result)}\n`);
        }
    }

    /**
     * 📋 Cria box de resumo ANTES da execução (para confirmação)
     * @param {Object} summary - Resumo da execução
     * @returns {string} Box formatado
     */
    createPreAnalysisSummaryBox(summary) {
        try {
            // Quebrar tags se houver muitas
            let tagsDisplay = '';
            if (summary.tags && summary.tags.length > 0) {
                tagsDisplay = summary.tags.join(', ');
                const maxTagsLength = 45;
                if (tagsDisplay.length > maxTagsLength) {
                    tagsDisplay = tagsDisplay.substring(0, maxTagsLength - 3) + '...';
                }
            }

            const contentLines = [
                colors.title('📊 RESUMO DA ANÁLISE'),
                colors.muted('─'.repeat(40)),
                '',
                colors.text(`📋 Total de URLs para análise: ${colors.info(summary.total)}`),
                ''
            ];

            // Adicionar tags quebradas se existirem
            if (tagsDisplay) {
                const wrappedTags = this.wrapText(`🏷️ Tags que serão aplicadas: ${tagsDisplay}`, 55);
                wrappedTags.forEach(line => {
                    contentLines.push(colors.text(line));
                });
                contentLines.push('');
            }

            // Adicionar informações restantes
            contentLines.push(
                colors.text(`🔒 Visibilidade: ${colors.info(summary.visibility)}`),
                '',
                colors.text(`⚡ Delay entre requisições: ${colors.highlight('5 segundos')}`),
                colors.text(`🔄 Tentativas de polling: ${colors.highlight(summary.maxPollingAttempts || '30')}`),
                '',
                colors.warning('⚠️ Esta operação consumirá sua quota da API'),
                '',
                colors.muted(`📅 Início previsto: ${new Date().toLocaleString('pt-BR')}`)
            );

            return this.createBox(contentLines.join('\n'), {
                borderStyle: 'classic',
                borderColor: 'yellow',
                width: 65,
                padding: 1,
                textAlignment: 'left'
            });
        } catch (error) {
            logger.error('Erro em createPreAnalysisSummaryBox:', error);
            return colors.text(`📊 Resumo inicial: ${JSON.stringify(summary)}\n`);
        }
    }

    /**
     * 📊 Cria box de resumo DEPOIS da execução (com resultados)
     * @param {Object} summary - Resumo da execução
     * @returns {string} Box formatado
     */
    createPostAnalysisSummaryBox(summary) {
        try {
            const successRate = summary.total > 0 ?
                Math.round((summary.sucessos / summary.total) * 100) : 0;

            let successColor = colors.success;
            let statusEmoji = '✅';

            if (successRate < 50) {
                successColor = colors.error;
                statusEmoji = '❌';
            } else if (successRate < 80) {
                successColor = colors.warning;
                statusEmoji = '⚠️';
            }

            // Quebrar tags se houver muitas
            let tagsDisplay = '';
            if (summary.tags && summary.tags.length > 0) {
                tagsDisplay = summary.tags.join(', ');
                const maxTagsLength = 45;
                if (tagsDisplay.length > maxTagsLength) {
                    tagsDisplay = tagsDisplay.substring(0, maxTagsLength - 3) + '...';
                }
            }

            const contentLines = [
                colors.title(`${statusEmoji} RESULTADO DA ANÁLISE`),
                colors.muted('─'.repeat(40)),
                '',
                colors.text(`📊 Total de URLs analisadas: ${colors.info(summary.total)}`),
                colors.text(`✅ Análises bem-sucedidas: ${colors.success(summary.sucessos)}`),
                colors.text(`❌ Análises com falha: ${colors.error(summary.falhas)}`),
                '',
                colors.text(`📈 Taxa de sucesso: ${successColor(`${successRate}%`)}`),
                ''
            ];

            // Adicionar tags quebradas se existirem
            if (tagsDisplay) {
                const wrappedTags = this.wrapText(`🏷️ Tags aplicadas: ${tagsDisplay}`, 55);
                wrappedTags.forEach(line => {
                    contentLines.push(colors.text(line));
                });
                contentLines.push('');
            }

            // Adicionar informações restantes
            contentLines.push(
                colors.text(`🔒 Visibilidade: ${colors.info(summary.visibility)}`),
                '',
                colors.muted(`📅 Concluído em: ${new Date().toLocaleString('pt-BR')}`)
            );

            return this.createBox(contentLines.join('\n'), {
                borderStyle: 'classic',
                borderColor: successRate >= 80 ? 'green' : successRate >= 50 ? 'yellow' : 'red',
                width: 65,
                padding: 1,
                textAlignment: 'left'
            });
        } catch (error) {
            logger.error('Erro em createPostAnalysisSummaryBox:', error);
            return colors.text(`📊 Resumo final: ${JSON.stringify(summary)}\n`);
        }
    }

    /**
     * ⚠️ Cria box de aviso
     * @param {string} message - Mensagem de aviso
     * @returns {string} Box formatado
     */
    createWarningBox(message) {
        try {
            // Quebrar mensagem longa
            const textWidth = 50 - 6;
            const wrappedMessage = this.wrapText(message, textWidth);

            const contentLines = [
                colors.warning('⚠️ AVISO'),
                colors.muted('─'.repeat(25)),
                ''
            ];

            // Adicionar mensagem quebrada
            wrappedMessage.forEach(line => {
                contentLines.push(colors.text(line));
            });

            return this.createBox(contentLines.join('\n'), {
                borderStyle: 'classic',
                borderColor: 'yellow',
                width: 50,
                padding: 1
            });
        } catch (error) {
            logger.error('Erro em createWarningBox:', error);
            return colors.text(`⚠️ ${message}\n`);
        }
    }

    /**
     * ❌ Cria box de erro
     * @param {string} message - Mensagem de erro
     * @returns {string} Box formatado
     */
    createErrorBox(message) {
        try {
            // Quebrar mensagem longa
            const textWidth = 50 - 6;
            const wrappedMessage = this.wrapText(message, textWidth);

            const contentLines = [
                colors.error('❌ ERRO'),
                colors.muted('─'.repeat(25)),
                ''
            ];

            // Adicionar mensagem quebrada
            wrappedMessage.forEach(line => {
                contentLines.push(colors.text(line));
            });

            return this.createBox(contentLines.join('\n'), {
                borderStyle: 'classic',
                borderColor: 'red',
                width: 50,
                padding: 1
            });
        } catch (error) {
            logger.error('Erro em createErrorBox:', error);
            return colors.text(`❌ ${message}\n`);
        }
    }

    /**
     * 🔑 Cria box de configuração de API
     * @param {string} apiKey - Chave da API (mascarada)
     * @returns {string} Box formatado
     */
    createApiConfigBox(apiKey) {
        try {
            const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);

            const content = [
                colors.success('🔑 CONFIGURAÇÃO DA API'),
                colors.muted('─'.repeat(35)),
                '',
                colors.text(`Chave API: ${colors.highlight(maskedKey)}`),
                colors.text(`Status: ${colors.success('CONFIGURADA')}`),
                '',
                colors.muted('A chave está criptografada e armazenada com segurança.')
            ].join('\n');

            return this.createBox(content, {
                borderStyle: 'classic',
                borderColor: 'green',
                width: 55,
                padding: 1
            });
        } catch (error) {
            logger.error('Erro em createApiConfigBox:', error);
            return colors.text(`🔑 API Configurada\n`);
        }
    }

    /**
     * 📝 Cria box de informações do arquivo
     * @param {Object} fileInfo - Informações do arquivo
     * @returns {string} Box formatado
     */
    createFileInfoBox(fileInfo) {
        try {
            // Quebrar caminho se for muito longo
            let pathDisplay = fileInfo.path;
            const maxPathLength = 45;
            if (pathDisplay.length > maxPathLength) {
                const start = pathDisplay.substring(0, 20);
                const end = pathDisplay.substring(pathDisplay.length - 20);
                pathDisplay = start + '...' + end;
            }

            const content = [
                colors.info('📁 INFORMAÇÕES DO ARQUIVO'),
                colors.muted('─'.repeat(35)),
                '',
                colors.text(`📄 Arquivo: ${colors.highlight(fileInfo.name)}`),
                colors.text(`📝 Linhas válidas: ${colors.info(fileInfo.validLines)}`),
                colors.text(`📊 Total de itens: ${colors.info(fileInfo.totalItems)}`),
                '',
                colors.muted(`📍 Caminho: ${pathDisplay}`)
            ].join('\n');

            return this.createBox(content, {
                borderStyle: 'classic',
                borderColor: 'blue',
                width: 60,
                padding: 1
            });
        } catch (error) {
            logger.error('Erro em createFileInfoBox:', error);
            return colors.text(`📁 ${fileInfo.name}: ${fileInfo.validLines} itens\n`);
        }
    }

    /**
     * 🎨 Cria box personalizado com tema
     * @param {string} title - Título do box
     * @param {string} contentText - Conteúdo do box
     * @param {Object} style - Estilo personalizado
     * @returns {string} Box formatado
     */
    createCustomBox(title, contentText, style = {}) {
        try {
            const defaultStyle = {
                borderStyle: 'classic',
                borderColor: theme.border.primary,
                width: 65,
                padding: 1,
                margin: 1,
                textAlignment: 'left'
            };

            const finalStyle = { ...defaultStyle, ...style };

            // Quebrar conteúdo se necessário
            const textWidth = finalStyle.width - 6;
            const wrappedContent = this.wrapText(contentText, textWidth);

            const boxContent = colors.title(title) + '\n' +
                colors.muted('─'.repeat(Math.min(title.length * 2, 50))) + '\n\n' +
                wrappedContent.join('\n');

            return this.createBox(boxContent, finalStyle);
        } catch (error) {
            logger.error('Erro em createCustomBox:', error);
            return `\n${'═'.repeat(50)}\n${title}\n${'═'.repeat(50)}\n${contentText}\n`;
        }
    }

    /**
     * 📊 Cria box de estatísticas
     * @param {Object} stats - Estatísticas
     * @returns {string} Box formatado
     */
    createStatsBox(stats) {
        try {
            const contentLines = [
                colors.title('📈 ESTATÍSTICAS DETALHADAS'),
                colors.muted('─'.repeat(50)),
                ''
            ];

            if (stats.total) {
                contentLines.push(colors.text(`📊 Total: ${colors.highlight(stats.total)}`));
            }
            if (stats.success) {
                contentLines.push(colors.text(`✅ Sucessos: ${colors.success(stats.success)}`));
            }
            if (stats.failed) {
                contentLines.push(colors.text(`❌ Falhas: ${colors.error(stats.failed)}`));
            }
            if (stats.pending) {
                contentLines.push(colors.text(`⏳ Pendentes: ${colors.warning(stats.pending)}`));
            }
            if (stats.percentage) {
                const percentage = stats.percentage;
                let color = colors.success;
                if (percentage < 50) color = colors.error;
                else if (percentage < 80) color = colors.warning;

                contentLines.push(colors.text(`📈 Taxa de sucesso: ${color(`${percentage}%`)}`));
            }

            contentLines.push('', colors.muted(`🕒 ${new Date().toLocaleString('pt-BR')}`));

            return this.createBox(contentLines.join('\n'), {
                borderStyle: 'classic',
                borderColor: stats.percentage >= 80 ? 'green' :
                    stats.percentage >= 50 ? 'yellow' : 'red',
                width: 60,
                padding: 1,
                textAlignment: 'left'
            });
        } catch (error) {
            logger.error('Erro em createStatsBox:', error);
            return this.createBox(colors.text('📊 Estatísticas não disponíveis'), {
                borderColor: theme.border.warning,
                width: 50,
                padding: 1
            });
        }
    }

    /**
     * 🎮 Cria box de menu interativo
     * @param {string} title - Título do menu
     * @param {Array} options - Opções do menu
     * @returns {string} Box formatado
     */
    createMenuBox(title, options) {
        try {
            let content = colors.title(title) + '\n';
            content += colors.muted('─'.repeat(Math.min(title.length * 2, 40))) + '\n\n';

            options.forEach((option, index) => {
                const number = (index + 1).toString().padStart(2, '0');
                content += colors.text(`  ${number}. ${option}\n`);
            });

            return this.createBox(content, {
                borderStyle: 'classic',
                borderColor: theme.border.info,
                width: 55,
                padding: { top: 1, bottom: 1, left: 2, right: 2 },
                textAlignment: 'left'
            });
        } catch (error) {
            logger.error('Erro em createMenuBox:', error);
            return `\n${title}\n${'─'.repeat(40)}\n${options.join('\n')}\n`;
        }
    }

    /**
     * 💾 Cria box de progresso
     * @param {string} task - Nome da tarefa
     * @param {number} current - Progresso atual
     * @param {number} total - Total
     * @returns {string} Box formatado
     */
    createProgressBox(task, current, total) {
        try {
            const percentage = Math.round((current / total) * 100);
            const barLength = 30;
            const filled = Math.round((current / total) * barLength);
            const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

            let barColor = colors.success;
            if (percentage < 30) barColor = colors.error;
            else if (percentage < 70) barColor = colors.warning;

            const content = [
                colors.title(`🔄 ${task.toUpperCase()}`),
                colors.muted('─'.repeat(35)),
                '',
                colors.text(`Progresso: ${current}/${total} (${percentage}%)`),
                colors.text(`[${barColor(bar)}]`),
                '',
                colors.muted(`⏱️ Processando...`)
            ].join('\n');

            return this.createBox(content, {
                borderStyle: 'classic',
                borderColor: theme.border.info,
                width: 60,
                padding: 1,
                margin: { top: 1, bottom: 1 }
            });
        } catch (error) {
            logger.error('Erro em createProgressBox:', error);
            return colors.text(`🔄 ${task}: ${current}/${total}\n`);
        }
    }
}

module.exports = new BoxManager();