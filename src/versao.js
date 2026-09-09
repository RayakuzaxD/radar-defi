/* A versão do radar. Um lugar só.
 *
 * Pedido dele em 08/09/2026, copiando o que o caderno de entregas já faz: uma
 * marca discreta num canto, para saber qual versão está rodando, e uma barrinha
 * de carregamento na abertura que confere se saiu versão nova antes de abrir.
 *
 * No radar isso conserta um problema concreto, e não é enfeite. O painel é um
 * aplicativo instalado, com service worker guardando a casca. A noite inteira
 * de 08/09 terminou em "recarregue o app, o cache subiu para a v17" — ele
 * olhando uma tela velha enquanto o conserto já estava no ar. A barrinha de
 * abertura existe para essa frase nunca mais precisar ser dita.
 *
 * DUAS REGRAS ao mexer aqui:
 *
 * 1. Sobe o número a cada publicação que muda a tela. É por ele que o app
 *    decide se o que está no aparelho ficou velho.
 * 2. O nome do cofre do service worker SAI daqui. Antes eram dois números
 *    escritos à mão em arquivos diferentes, e dois números que precisam
 *    concordar acabam discordando — normalmente no pior dia.
 */

export const VERSAO = "v2-a-regua-do-curso";

/* Só o número: "v18-posicao-na-orca" vira 18. É por ele que se compara. */
export const NUMERO_DA_VERSAO = Number((VERSAO.match(/^v(\d+)/) || [])[1] || 0);

/* O cofre do service worker. Trocar de nome é o que faz o navegador largar a
 * casca antiga — por isso ele carrega a versão dentro. */
export const COFRE_DA_CASCA = "radar-casca-" + VERSAO;
