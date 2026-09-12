/* O MOTIVO DE UM ERRO, SEM O SEGREDO DENTRO.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO É UM ARQUIVO
 *
 * Toda vez que a mensagem de uma exceção vira resposta, ela carrega texto que
 * NÃO foi escrito aqui. Duas fontes, e as duas são de fora:
 *
 *   1. o runtime escreve "Fetch API cannot load: <URL INTEIRA>" quando a URL
 *      não parseia — e a URL do nó da Solana carrega a chave da API dentro;
 *   2. o servidor do outro lado escreve o que quiser na mensagem de erro dele,
 *      inclusive ecoar a URL que recebeu.
 *
 * Achado por revisão adversarial em 12/09/2026, numa rota de diagnóstico
 * escrita naquele mesmo dia. Ela cortava a mensagem em 60 caracteres, e o
 * revisor CONTOU: o prefixo até "api-key=" tem 63. O corte parava TRÊS
 * caracteres antes do valor da chave.
 *
 * A chave sobrevivia por aritmética de sorte. Bastava um provedor de host mais
 * curto, ou o runtime mudar a frase, pra ela ir parar numa resposta pública. E
 * a rota tinha, no próprio comentário, a regra "NUNCA a URL do nó na
 * resposta" — regra escrita não é regra cumprida.
 *
 * Ao conferir o arquivo inteiro, havia QUINZE lugares repassando erro cru; a
 * rota nova era só o mais recente.
 *
 * ---------------------------------------------------------------------------
 * MORA SOZINHO DE PROPÓSITO
 *
 * Podia ser uma função dentro do Worker, e foi, por um commit. Mas aí a
 * conferência que a testa precisa importar o Worker inteiro — com banco,
 * Supabase e tudo — e no repositório público isso nem carrega. Guarda de
 * segurança que só roda num dos dois repositórios é meia guarda.
 *
 * Um arquivo sem dependência nenhuma roda em qualquer lugar, e é testável em
 * três linhas. */

/* Devolve o motivo legível de um erro, com todo endereço trocado por
 * "<endereço>" e todo valor de chave por "<oculto>" ANTES de qualquer corte.
 *
 * Quem lê continua sabendo o que houve ("o nó recusou a credencial"), sem
 * saber por onde. Não substitui o cuidado de nunca pôr segredo em resposta: é
 * a rede embaixo dele, pro dia em que o cuidado falhar. Já falhou uma vez. */
export function motivoSemSegredo(e, teto = 120) {
  const cru = String(e?.message || e || "");
  return cru
    /* O endereço inteiro primeiro: ele pode carregar a chave na querystring,
       e trocá-lo já resolve os dois casos de uma vez. */
    .replace(/https?:\/\/\S+/gi, "<endereço>")
    /* E a chave solta, sem endereço na frente — um "/v1/rpc?api-key=..." que
       o outro lado ecoou sem o esquema. */
    .replace(/([?&](?:api[-_]?key|key|token|secret|auth)=)[^\s&]*/gi, "$1<oculto>")
    .slice(0, teto);
}
