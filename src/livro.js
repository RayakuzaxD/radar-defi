/* O LIVRO-RAZÃO: um lugar só decide o que é lucro e o que é dinheiro andando.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * Pedido dele em 11/09/2026, depois de eu consertar o MESMO erro cinco vezes:
 *
 *   "sei que consegue criar uma lógica/regra pra isso não confundir mais,
 *    faça isso"
 *
 * Ele tem razão, e o diagnóstico é simples de escrever e foi difícil de ver: a
 * pergunta "este movimento é lucro?" estava sendo respondida em cinco lugares
 * diferentes — no fluxo diário do patrimônio, no "de onde veio" de cada
 * janela, no verde/vermelho de cada caixinha, no valor da posição no passado e
 * na reconstrução das linhas de token. Cada conserto arrumava um e deixava os
 * outros, e o erro reaparecia com outra cara:
 *
 *   "+US$ 101,95" de lucro num mês em que a pool perdeu três dólares
 *   "−US$ 194,58" num dia em que o patrimônio mexeu vinte e um
 *   "−US$ 437" numa caixinha que tinha caído duzentos e quarenta
 *
 * O próprio projeto já tinha escrito a regra contra isso, em `fluxoExterno`:
 * "um lugar só decide isto no programa inteiro. Espalhado, acabaria respondido
 * de dois jeitos diferentes no mesmo arquivo". Eu escrevi isso e espalhei
 * assim mesmo.
 *
 * ---------------------------------------------------------------------------
 * AS TRÊS ESPÉCIES, E SÓ EXISTEM ESTAS TRÊS
 *
 *   NOVO        dinheiro cruzando a fronteira do patrimônio. Ele comprou BTC
 *               com dinheiro da corretora, ou sacou pra conta. Soma ou tira do
 *               total, e NÃO é lucro nem prejuízo.
 *
 *   REMANEJO    dinheiro andando entre as linhas dele. Fundar pool com USDC da
 *               carteira, desmontar pool e o dinheiro virar SOL. O total não
 *               muda, e por isso não pode mexer no rendimento — nem pra cima
 *               nem pra baixo.
 *
 *   RENDIMENTO  taxa colhida da pool. Já está no valor de hoje, e é lucro
 *               realizado: não é fluxo de espécie nenhuma (receita 3.4 —
 *               colher não é sacar).
 *
 * A frase dele, que é a definição inteira: "lucro é rendimento de tokens ou
 * taxa de pools; o resto deveria ser apenas aporte no total do patrimônio".
 *
 * ---------------------------------------------------------------------------
 * COMO SE DECIDE, E A ÚNICA PERGUNTA QUE IMPORTA
 *
 * É sempre a mesma: DÁ PRA VER O OUTRO LADO?
 *
 * Dinheiro que anda entre linhas tem dois lados — sai de uma, entra noutra. Se
 * eu enxergo os dois, é remanejo e se cancela sozinho. Se só enxergo um, tenho
 * que tratar como dinheiro novo, senão ele aparece ou some do nada.
 *
 *   movimento numa linha de POSIÇÃO, com o outro lado visível   → REMANEJO
 *   movimento numa linha de POSIÇÃO, sem o outro lado           → NOVO
 *   movimento numa linha de TOKEN                                → NOVO
 *   colheita, em qualquer linha                                  → RENDIMENTO
 *
 * "Outro lado visível" quer dizer: a cadeia contou esta mexida (e aí ela traz
 * quantidade, símbolo e instante), ou o lançamento dele trouxe quantidade e
 * símbolo. Nos dois casos dá pra descontar as moedas da linha de token de onde
 * elas vieram — é o que este arquivo chama de SOMBRA.
 *
 * ---------------------------------------------------------------------------
 * A CADEIA MANDA, E MANDA INTEIRA
 *
 * Quando a cadeia respondeu por uma posição, os lançamentos DELE naquela
 * posição são ignorados. Não é desprezo pelo que ele digitou: é que a cadeia
 * tem a história completa e o lançamento tem metade — ele lança o fechamento e
 * não lança o depósito, porque fundar pool com dinheiro de dentro não parece
 * um lançamento. Misturar os dois conta o fechamento duas vezes. */

export const NOVO = "novo";
export const REMANEJO = "remanejo";
export const RENDIMENTO = "rendimento";

/* `soODiaNoLivro` e nao `soODia`: patrimonio.js tem uma funcao com o mesmo
   nome, e no navegador as duas copias moram no MESMO escopo — dois `const` com
   o mesmo nome derrubam a pagina inteira. Nome de ajudante privado num modulo
   nao e privado depois da copia. */
const soODiaNoLivro = (d) => String(d || "").slice(0, 10);

/* Um movimento tem o outro lado visível? Só então ele é remanejo. */
function temOutroLado(m) {
  if (m?.daCadeia) return true;
  const qa = Number(m?.qtd_a), qb = Number(m?.qtd_b);
  return !!((m?.simbolo_a && qa > 0) || (m?.simbolo_b && qb > 0));
}

/* A ESPÉCIE DE UM MOVIMENTO. Esta função é a única que responde isto.
 *
 * `ehPosicao` diz se a linha do movimento é uma posição na cadeia. Vem de
 * fora porque o movimento não sabe: ele só tem a chave. */
export function especieDo(m, ehPosicao) {
  if (!m) return null;
  if (m.tipo === "colheita") return RENDIMENTO;
  if (m.tipo !== "aporte" && m.tipo !== "saque") return null;
  if (!ehPosicao) return NOVO;
  return temOutroLado(m) ? REMANEJO : NOVO;
}

/* O valor com sinal, do ponto de vista da LINHA: positivo entrou nela.
 *
 * Repare que a colheita tem valor e não tem espécie de fluxo. Os dois são
 * verdade ao mesmo tempo: as moedas chegaram (mexem na quantidade) e não são
 * dinheiro de fora (não mexem no custo). Confundir isso apagaria o lucro dele
 * no exato momento em que ele o realiza. */
export function valorDo(m) {
  const v = Number(m?.valor_usd);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return m.tipo === "saque" ? -v : v;
}

/* ---------------------------------------------------------------------------
 * O LIVRO
 *
 * Entra a carteira, os lançamentos dele e o que a cadeia contou. Sai UMA lista
 * de eventos, cada um já classificado, e os índices que as contas precisam.
 *
 * Depois disto, nenhuma conta olha para `tipo` de movimento nem decide nada:
 * elas perguntam ao livro. */
export function montarLivro({ linhas, movimentos, daCadeia } = {}) {
  const posicoes = new Set(
    (linhas || []).filter((l) => l?.posicao && l?.chave).map((l) => l.chave));

  /* Quais posições a cadeia explica — e ela só explica o que leu INTEIRO.
   *
   * A regra antiga era "a cadeia manda: onde ela falou, o lançamento dele
   * cala". Ela está certa quando a leitura é completa, e faz estrago quando
   * não é: uma leitura pela metade apaga lançamentos bons e a conta passa a
   * medir só o pedaço que sobrou.
   *
   * O caso que pegou, com os números dele (12/09/2026). Uma pool SOL/USDC
   * fechada, com TRÊS aportes lançados à mão e um saque de valor quase igual
   * — ganho de alguns centavos. A leitura da cadeia trouxe só DUAS
   * transações: UM dos depósitos e o fechamento. Os três lançamentos
   * calaram, e a pool passou a aparecer rendendo mais da metade do que ela
   * chegou a ter dentro.
   *
   * O número apareceu em três janelas ao mesmo tempo e ele viu na tela.
   *
   * É a receita 2.5 numa terceira roupa: ausência só vale como prova quando a
   * leitura ficou completa. A cadeia é autoridade sobre o que ela VIU — nunca
   * sobre o que ela não viu.
   *
   * O teste é o dinheiro que ENTROU, e não a contagem de eventos: se o que ele
   * lançou de aporte é sensivelmente maior do que o que a cadeia achou, faltou
   * transação, e aí quem manda é o lançamento. A folga de 10% existe porque os
   * dois nunca batem exatamente — a cadeia avalia no preço do instante e o
   * lançamento no que ele digitou. */
  const somaDeAportes = (lista) => {
    const por = new Map();
    for (const m of lista || []) {
      if (!m?.chave) continue;
      /* COLHEITA NÃO É ENTRADA, e ela chega aqui com valor positivo porque só
         saque leva sinal negativo. Sem esta linha, uma posição cujas TAXAS a
         cadeia leu passaria por "leitura completa" sem ela ter visto depósito
         nenhum — e aí o buraco voltava inteiro, por uma porta mais estreita.
         Quem pegou foi o próprio teste, na primeira rodada. */
      if (m.tipo === "colheita") continue;
      const v = valorDo(m);
      if (!(v > 0)) continue;
      por.set(m.chave, (por.get(m.chave) || 0) + v);
    }
    return por;
  };
  const aportouNaCadeia = somaDeAportes(daCadeia);
  const aportouNoLancamento = somaDeAportes(movimentos);

  const comCadeia = new Set();
  for (const m of daCadeia || []) {
    if (!m?.chave) continue;
    const dele = aportouNoLancamento.get(m.chave) || 0;
    const naCadeia = aportouNaCadeia.get(m.chave) || 0;
    if (dele > 0 && naCadeia < dele * 0.9) continue;   // leitura incompleta
    comCadeia.add(m.chave);
  }

  /* E o que a cadeia leu pela metade não entra junto com o lançamento dele:
     somar os dois contaria o mesmo dinheiro duas vezes. Onde a leitura ficou
     curta, ela inteira sai de cena. */
  const cadeiaQueVale = (daCadeia || []).filter((m) => comCadeia.has(m?.chave));

  const eventos = [];
  const guardar = (m, deOnde) => {
    const ehPosicao = posicoes.has(m?.chave);
    const especie = especieDo(m, ehPosicao);
    if (!especie) return;
    eventos.push({
      chave: m.chave,
      quando: soODiaNoLivro(m.quando),
      usd: valorDo(m),
      tipo: m.tipo,
      especie,
      ehPosicao,
      deOnde,
      qtd_a: m.qtd_a ?? null, simbolo_a: m.simbolo_a ?? null,
      qtd_b: m.qtd_b ?? null, simbolo_b: m.simbolo_b ?? null,
    });
  };

  for (const m of movimentos || []) {
    /* A CADEIA MANDA INTEIRA: onde ela falou, o lançamento dele cala. */
    if (comCadeia.has(m?.chave)) continue;
    guardar(m, "lancamento");
  }
  for (const m of cadeiaQueVale) guardar({ ...m, daCadeia: true }, "cadeia");

  eventos.sort((a, b) => (a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0));

  const porChave = new Map();
  for (const e of eventos) {
    if (!porChave.has(e.chave)) porChave.set(e.chave, []);
    porChave.get(e.chave).push(e);
  }

  return { eventos, porChave, posicoes, comCadeia };
}

const dentro = (e, de, ate) => (!de || e.quando > de) && (!ate || e.quando <= ate);

/* O DINHEIRO NOVO no período — o único que o rendimento do patrimônio desconta.
 *
 * Remanejo não entra (o total não mudou) e rendimento não entra (é o lucro,
 * não um fluxo). */
export function dinheiroNovo(livro, de, ate) {
  let total = 0;
  for (const e of livro?.eventos || []) {
    if (e.especie === NOVO && dentro(e, de, ate)) total += e.usd;
  }
  return total;
}

/* O dinheiro novo por dia, que é o formato que a série do rendimento pede. */
export function novoPorDia(livro) {
  const fora = {};
  for (const e of livro?.eventos || []) {
    if (e.especie !== NOVO || !e.usd) continue;
    fora[e.quando] = (fora[e.quando] || 0) + e.usd;
  }
  return fora;
}

/* O FLUXO DE UMA LINHA, que é outra pergunta.
 *
 * Pro patrimônio, fechar pool não é saída — o dinheiro fica. Pra LINHA da
 * pool, é: o resultado dela é o que voltou menos o que entrou. As duas
 * perguntas convivem porque são perguntas diferentes, e é por isso que elas
 * têm nomes diferentes aqui. Chamar as duas de "fluxo" foi metade do meu
 * problema. */
export function fluxoDaLinha(livro, chave, de, ate) {
  let total = 0;
  for (const e of livro?.porChave?.get(chave) || []) {
    if (e.especie === RENDIMENTO) continue;
    if (dentro(e, de, ate)) total += e.usd;
  }
  return total;
}

/* O que a linha COLHEU no período: lucro realizado, e só ele. */
export function colheitaDaLinha(livro, chave, de, ate) {
  let total = 0;
  for (const e of livro?.porChave?.get(chave) || []) {
    if (e.especie === RENDIMENTO && dentro(e, de, ate)) total += Math.abs(e.usd);
  }
  return total;
}

/* AS SOMBRAS: as moedas que entraram ou saíram de uma linha de TOKEN por causa
 * de uma posição.
 *
 * A linha de token segue a carteira e muda sozinha quando uma pool devolve ou
 * consome moedas. Sem isto, a reconstrução do passado põe o mesmo dinheiro na
 * pool E na linha ao mesmo tempo.
 *
 * Só remanejo e rendimento geram sombra: o dinheiro NOVO veio de fora e nunca
 * esteve em linha nenhuma. */
export function sombrasPorToken(livro) {
  const fora = new Map();
  for (const e of livro?.eventos || []) {
    if (!e.ehPosicao) continue;
    if (e.especie === NOVO) continue;
    for (const [qtd, simbolo] of [[e.qtd_a, e.simbolo_a], [e.qtd_b, e.simbolo_b]]) {
      const q = Number(qtd);
      if (!Number.isFinite(q) || q <= 0 || !simbolo) continue;
      const chave = String(simbolo).toUpperCase();
      if (!fora.has(chave)) fora.set(chave, []);
      /* Tipo INVERTIDO: o que saiu da pool entrou na linha, e vice-versa. */
      fora.get(chave).push({
        quando: e.quando,
        tipo: e.usd < 0 ? "aporte" : "saque",
        qtd_a: q, valor_usd: 1, sombra: true,
      });
    }
  }
  return fora;
}

/* O REMANEJO QUE TOCOU UMA LINHA DE TOKEN, em dólar.
 *
 * Na decomposição por linha, remanejo CONTA — e aqui está a sutileza que me
 * escapou duas vezes. No total do patrimônio ele não conta, porque o dinheiro
 * que sai de uma linha entra noutra e os dois se cancelam. Mas a linha de USDC
 * sozinha não sabe disso: ela viu o dinheiro ir embora.
 *
 * Sem isto, a linha de USDC aparecia com "−US$ 177,47" de prejuízo no dia em
 * que ele fundou as pools com esse USDC. O dinheiro não sumiu — mudou de
 * lugar, e o lugar novo está três linhas abaixo na mesma tela.
 *
 * O valor sai do RATEIO do evento pelos tokens que ele moveu: uma pool de par
 * move dois, e cada linha responde pela parte dela. `precoEm(simbolo, dia)`
 * dá o preço; sem ele, a parte não entra e quem pergunta trata como
 * incompleto. */
export function remanejoDoToken(livro, simbolo, de, ate, precoEm) {
  if (!simbolo || typeof precoEm !== "function") return 0;
  const alvo = String(simbolo).toUpperCase();
  let total = 0;
  for (const e of livro?.eventos || []) {
    if (e.especie !== REMANEJO && e.especie !== RENDIMENTO) continue;
    if (!dentro(e, de, ate)) continue;
    for (const [qtd, s] of [[e.qtd_a, e.simbolo_a], [e.qtd_b, e.simbolo_b]]) {
      const q = Number(qtd);
      if (!Number.isFinite(q) || q <= 0) continue;
      if (String(s || "").toUpperCase() !== alvo) continue;
      const p = precoEm(alvo, e.quando);
      if (!(p > 0)) continue;
      /* Sinal invertido: o que saiu da pool ENTROU na linha. */
      total += (e.usd < 0 ? q : -q) * p;
    }
  }
  return total;
}

/* A posição foi explicada pela cadeia? Quem sabe disso não precisa mais
 * aproximar de onde veio o dinheiro dela. */
export function temRastro(livro, chave) {
  return !!livro?.comCadeia?.has(chave);
}
