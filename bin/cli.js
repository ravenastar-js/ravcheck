#!/usr/bin/env node

const { Ravcheck } = require('../lib/index');
const { colors } = require('../lib/config/colors');
const boxManager = require('../lib/utils/box');

/**
 * 🚀 Ponto de entrada principal do RAVCHECK
 * Inicializa a aplicação e gerencia o ciclo de vida
 */
async function main() {
    try {
        // Limpar console e mostrar welcome box imediatamente
        console.clear();
        console.log(boxManager.createWelcomeBox());
        console.log('\n' + colors.muted('⏳ Inicializando RAVCHECK...'));

        const ravcheck = new Ravcheck();
        await ravcheck.init();

        // Dar um pequeno delay para mostrar a mensagem
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Iniciar o menu principal
        await ravcheck.showMainMenu();
    } catch (error) {
        console.error(colors.error('❌ Erro fatal:'), error.message);
        console.log(colors.muted('\n⏎ Pressione Enter para sair...'));
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', process.exit.bind(process, 1));
    }
}

if (require.main === module) {
    main();
}