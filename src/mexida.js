/* O QUE ENTROU E SAIU DE UMA POSIÇÃO, lido da cadeia em vez de estimado.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTIMAR NÃO SERVE AQUI
 *
 * O radar detecta que ele mexeu numa posição comparando a liquidez com a da
 * última olhada (receita 1.5) e estima o valor por regra de três. A estimativa
 * é boa pra PERGUNTAR, e era o que existia. Ela não serve pra REGISTRAR, e a
 * prova disso custou US$ 105 de prejuízo inventado:
 *
 *   uma pool SOL/ETH foi desmontada e a tela anunciou uma perda de três
 *   dígitos. O saque fora lançado com o valor em ETH no campo de dólar,
 *   porque o valor de uma posição sai na moeda B quando falta cotação de um
 *   dos lados — dois zeros e vírgula onde devia haver uma centena.
 *
 * Consertei o portão da unidade. Aí ele recusou também a MINHA correção:
 *
 *   "tem que ser na hora que a pool foi encerrada, não faz sentido fechar com
 *    outro valor. Logo após coloquei mais USDC e abri outra pool pouco tempo
 *    depois."
 *
 * Ele está certo, e a razão é estrutural: FECHAR UMA POSIÇÃO É REMANEJAMENTO,
 * NÃO RESULTADO. O dinheiro sai da pool e entra na carteira no MESMO instante,
 * pelo MESMO valor. Qualquer preço de outro momento cria uma diferença que não
 * existiu — prejuízo fabricado pela régua, não pelo mercado.
 *
 * A cadeia sabe o número exato. Ler é mais barato que estimar.
 *
 * ---------------------------------------------------------------------------
 * OS COFRES, NÃO A CARTEIRA (receita 1.6) — e eu errei isso outra vez
 *
 * A primeira versão deste arquivo somava a variação de saldo da CARTEIRA dele,
 * e errava na sexta e na terceira casa decimal conforme o caso — sempre pra
 * mais, sempre pouco. A razão é a mesma de 2026-09: o saldo da carteira
 * carrega ALUGUEL DE CONTA e taxa de rede junto, e o fechamento devolve o
 * aluguel de três contas de uma vez.
 *
 * O número limpo está do outro lado: o COFRE da pool perde exatamente o que a
 * posição devolveu, ao milionésimo. É a receita 1.6, que eu mesmo escrevi
 * depois de cair nisso, e refiz o erro assim mesmo — porque desta vez a
 * pergunta parecia outra ("quanto ele recebeu" em vez de "quanto entrou").
 * Era a mesma.
 *
 * De quebra, ler o cofre apaga uma armadilha inteira: o SOL nativo não aparece
 * nos saldos de token (ele chega fechando a conta de wSOL, só em lamports), mas
 * o COFRE guarda wSOL, que é token e aparece. Quem lê o lado certo nem precisa
 * saber disso.
 *
 * ---------------------------------------------------------------------------
 * AS OUTRAS DUAS ARMADILHAS, achadas na transação real dele
 *
 * 1. A TAXA É UMA TRANSAÇÃO SEPARADA da liquidez, e a distinção é a receita
 *    3.4: colher não é sacar. No caso dele foram 39 segundos de diferença:
 *    `CollectFees` às 03:59:43 e `ClosePosition` às 04:00:28.
 *
 * 2. PODE VOLTAR UM TOKEN SÓ. A posição estava fora da faixa, convertida
 *    inteira em SOL — nenhuma estimativa por composição adivinharia isso.
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO NÃO FAZ
 *
 * Não avalia em dólar e não lança nada. Ele diz QUANTO DE CADA TOKEN se mexeu e
 * QUANDO — fatos da cadeia. Quem converte é quem tem o preço do instante, e
 * quem lança é ele, confirmando. Continua valendo: pergunta, nunca lança
 * sozinha. */

/* A taxa da rede, em lamports. Não entra na conta da mexida — lendo os cofres
 * ela nem aparece — mas fica exposta porque é o que explica a diferença entre
 * "o que a pool devolveu" e "o que apareceu na carteira", e essa diferença é a
 * pergunta que me fez errar duas vezes. */
export function taxaDaTransacao(tx) {
  const f = Number(tx?.meta?.fee ?? tx?.fee);
  return Number.isFinite(f) && f > 0 ? f : 0;
}

/* O NOME DA MEXIDA, pela instrução que a Orca registrou.
 *
 * Sai do log e não da forma do saldo: "o saldo aumentou" não distingue taxa
 * recolhida de liquidez retirada, e a conta trata as duas de jeitos opostos.
 *
 * MAS O LOG PODE CALAR — e calou. Em 12/09/2026 dois aportes reais dele
 * passaram sem NENHUMA linha "Instruction:" no log: o programa da Orca rodou,
 * moveu o dinheiro e não se apresentou. Por isso esta função não é mais a
 * única voz: quando ela devolve null, `lerMexida` ainda tenta classificar
 * pela DIREÇÃO do dinheiro (veja lá). Nome é etiqueta; direção sempre existe. */
export function tipoDaMexida(instrucoes) {
  const tem = (re) => (instrucoes || []).some((i) => re.test(String(i)));

  /* A LIQUIDEZ VEM ANTES DA COLHEITA, e a ordem aqui é a diferença entre um
   * saque e um lucro inventado.
   *
   * A versão antiga testava CollectFees primeiro. Numa transação que carrega
   * as DUAS coisas — e a própria Orca emite assim: sacar liquidez costuma vir
   * com as taxas no mesmo pacote — o evento inteiro virava "colheita". Os
   * deltas dos cofres vêm fundidos (não dá pra separar principal de taxa pelo
   * saldo), então o principal sacado inteiro seria lançado como LUCRO
   * REALIZADO, com o saque em zero.
   *
   * É a mesma mentira do lucro fabricado por outra porta: dinheiro que só mudou
   * de lugar contado como rendimento. No histórico dele os dois vieram
   * separados por 39 segundos (receita 6.20) — sorte, não garantia.
   *
   * Com a liquidez ganhando, o evento fundido vira saque pelo valor inteiro:
   * a taxa embutida deixa de ser contada como lucro e vira parte do principal
   * devolvido. Isso SUBESTIMA o rendimento em alguns dólares, e subestimar é
   * o lado certo de errar — a conta nunca fabrica verde.
   *
   * Quem precisa saber que houve fusão pergunta a `taxaEmbutida` na mexida. */
  if (tem(/ClosePosition/i)) return "fechamento";
  if (tem(/DecreaseLiquidity/i)) return "retirada";
  if (tem(/IncreaseLiquidity|OpenPosition/i)) return "deposito";
  if (tem(/CollectFees|CollectReward/i)) return "colheita";
  return null;
}

/* A transação mexeu na liquidez E colheu taxa no mesmo pacote?
 *
 * Quando isso acontece, os saldos dos cofres vêm somados e não há como
 * separar principal de taxa por eles. A mexida sai com o tipo da liquidez e
 * esta marca ligada, pra quem lê saber que o valor tem taxa dentro. */
export function taxaVemEmbutida(instrucoes) {
  const tem = (re) => (instrucoes || []).some((i) => re.test(String(i)));
  return tem(/CollectFees|CollectReward/i) &&
    tem(/ClosePosition|DecreaseLiquidity|IncreaseLiquidity|OpenPosition/i);
}

/* O programa das pools concentradas da Orca. Endereço público e fixo — é por
 * ele que se reconhece "esta instrução é da pool" numa transação que também
 * carrega outras coisas (um swap por outras pools, por exemplo). */
export const PROGRAMA_WHIRLPOOL = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

/* AS CONTAS DA INSTRUÇÃO QUE TOCA A POSIÇÃO — o filtro que separa a pool dele
 * do resto da transação.
 *
 * O caso que ensinou (12/09/2026): ele aumentou uma pool pondo USDC, e a Orca
 * embutiu a TROCA no mesmo pacote — a transação atravessa outras pools no
 * caminho. O leitor de cofres via "conta que não é dele" e somava TUDO: os
 * cofres das pools alheias do swap entravam na conta, e o aporte saía com
 * números de mentira — na medição que pegou isto, um aporte saiu com o
 * sinal trocado num dos lados e quase o dobro no outro.
 *
 * A âncora é a instrução: toda mexida na posição passa por UMA instrução do
 * programa Whirlpool que lista a posição nas contas dela — e lista também os
 * cofres CERTOS. O que essa instrução não lista não é da pool dele.
 *
 * Aceita a transação crua da cadeia (message.instructions + innerInstructions)
 * ou o objeto reduzido que mexidasDaPosicao monta (instrucoesComContas).
 * Devolve um Set com as contas, ou null quando nenhuma instrução do Whirlpool
 * toca a posição — e null aqui significa "sem filtro", não "sem mexida": uma
 * pool de outro protocolo (a Kamino, por exemplo) cai no caminho de sempre. */
export function contasDaInstrucaoDaPosicao(tx, posicao) {
  if (!tx || !posicao) return null;
  const todas = tx.instrucoesComContas || [
    ...(tx.transaction?.message?.instructions || []),
    ...((tx.meta?.innerInstructions || []).flatMap((x) => x?.instructions || [])),
  ];
  const contas = new Set();
  let achou = false;
  for (const ins of todas) {
    if (ins?.programId !== PROGRAMA_WHIRLPOOL) continue;
    const cs = ins?.accounts || [];
    if (!cs.includes(posicao)) continue;
    achou = true;
    for (const c of cs) contas.add(c);
  }
  return achou ? contas : null;
}

/* QUANTO DE CADA TOKEN A POSIÇÃO DEVOLVEU OU RECEBEU, nesta transação.
 *
 * Lido pelo COFRE e não pela carteira (receita 1.6): o cofre perde exatamente o
 * que a posição devolveu, sem aluguel de conta nem taxa de rede no meio.
 *
 * `dono` é a carteira DELE, e serve pra saber quem NÃO é cofre. O sinal sai
 * invertido do ponto de vista do cofre: cofre perdendo = ele recebendo.
 *
 * Positivo = voltou pra ele. Devolve um mapa mint -> quantidade. */
export function tokensQueSeMexeram(tx, dono, soEstasContas = null) {
  if (!tx || !dono) return null;
  const meta = tx.meta || tx;
  const antes = new Map(), depois = new Map();
  for (const b of meta.preTokenBalances || []) antes.set(b.accountIndex, b);
  for (const b of meta.postTokenBalances || []) depois.set(b.accountIndex, b);
  if (!antes.size && !depois.size) return null;

  /* O endereço de cada conta, pelo índice — é o que o filtro compara. Vem da
     transação crua (accountKeys) ou do objeto reduzido (contas). */
  const chaves = tx.contas
    || (tx.transaction?.message?.accountKeys || []).map((k) => k?.pubkey || k);

  /* O DONO PRECISA APARECER NA TRANSAÇÃO — e esta guarda nasceu de um susto.
   *
   * Testando ao vivo eu adivinhei a carteira por um prefixo e errei o
   * endereço. Com o dono errado, TODA conta vira "cofre": o que a pool
   * entregou e o que ele recebeu entram os dois na soma, com sinais opostos, e
   * o resultado é zero. Nenhum erro, nenhum aviso — só um token sumindo do
   * extrato.
   *
   * É o defeito que este arquivo já descrevia num comentário de teste e
   * cometia na prática: zero em toda mexida nunca dá erro e nunca dá número.
   * Dono que não participou da transação vira null, que é visível. */
  const participa = [...antes.values(), ...depois.values()]
    .some((b) => String(b.owner) === String(dono));
  if (!participa) return null;

  const fora = {};
  for (const i of new Set([...antes.keys(), ...depois.keys()])) {
    const a = antes.get(i), d = depois.get(i);
    const ref = d || a;

    /* Só as contas que NÃO são dele: essas são os cofres do protocolo. */
    if (String(ref.owner) === String(dono)) continue;

    /* E, quando há filtro, só os cofres DA INSTRUÇÃO DA POSIÇÃO. Sem isso,
       uma transação que também carrega um swap soma os cofres das pools
       alheias por onde a troca passou — medido em 12/09/2026: o aporte de
       o aporte saía com um dos tokens de sinal trocado e o outro inflado
       pelos cofres das pools alheias por onde a troca passou. */
    if (soEstasContas && !soEstasContas.has(chaves[i])) continue;

    /* Token sem casa decimal é NFT, e o NFT da posição sendo queimado apareceu
       no mapa da primeira versão como se fosse dinheiro. Não é: é o recibo. */
    const casas = Number(ref.uiTokenAmount?.decimals);
    if (Number.isFinite(casas) && casas === 0) continue;

    const n0 = a ? Number(a.uiTokenAmount?.uiAmountString ?? a.uiTokenAmount?.uiAmount) : 0;
    const n1 = d ? Number(d.uiTokenAmount?.uiAmountString ?? d.uiTokenAmount?.uiAmount) : 0;
    if (!Number.isFinite(n0) || !Number.isFinite(n1)) continue;

    const saiuDoCofre = n0 - n1;   // cofre perdendo = ele recebendo
    if (Math.abs(saiuDoCofre) < 1e-12) continue;
    fora[ref.mint] = (fora[ref.mint] || 0) + saiuDoCofre;
  }
  for (const m of Object.keys(fora)) {
    if (Math.abs(fora[m]) < 1e-12) delete fora[m];
  }
  return fora;
}

/* Uma transação vira um evento legível: o que é, quando, e o que se mexeu.
 *
 * `posicao` é opcional e destrava duas coisas que uma pool real dele exigiu:
 *
 *   1. O FILTRO: os tokens são medidos só nos cofres da instrução que toca a
 *      posição, e o swap que viaja na mesma transação fica de fora.
 *   2. A DIREÇÃO COMO VOZ DE RESERVA: quando o log não nomeia a instrução
 *      (aconteceu — o programa rodou calado), o dinheiro saindo TODO dele
 *      para a pool só pode ser depósito. Colheita e retirada não tiram nada
 *      do dono, então não há com o que confundir.
 *
 *      O contrário não vale: dinheiro voltando sem nome pode ser retirada OU
 *      colheita, e as contas tratam as duas de jeitos opostos (receita 3.4).
 *      Sem nome e voltando, continua null — e a leitura se declara cega em
 *      vez de chutar. */
export function lerMexida(tx, dono, posicao = null) {
  const filtro = contasDaInstrucaoDaPosicao(tx, posicao);
  const tokens = tokensQueSeMexeram(tx, dono, filtro);
  if (!tokens) return null;

  const instrucoes = tx?.instrucoes
    || (tx?.meta?.logMessages || [])
      .filter((l) => /Instruction: /.test(l))
      .map((l) => String(l).split("Instruction: ")[1]);

  let tipo = tipoDaMexida(instrucoes);

  if (!tipo && filtro) {
    const qtds = Object.values(tokens);
    if (qtds.length && qtds.every((v) => v < 0)) tipo = "deposito";
  }
  if (!tipo) return null;

  const quando = Number(tx.blockTime);
  return {
    tipo, tokens,
    /* A taxa veio dentro deste mesmo valor? Então o valor é principal + taxa
       somados, e o rendimento sai subestimado — nunca inflado. */
    taxaEmbutida: taxaVemEmbutida(instrucoes),
    quando: Number.isFinite(quando) ? quando : null,
    assinatura: tx.assinatura || tx.transaction?.signatures?.[0] || null,
  };
}

/* O VALOR EM DÓLAR, ao preço do INSTANTE — e este é o ponto do arquivo.
 *
 * `precoEm(mint, quando)` devolve o preço daquele mint naquele segundo. Se
 * faltar o preço de qualquer token que se mexeu, o valor inteiro é null: meia
 * conta somada é pior que conta nenhuma, porque parece um total. */
export function valorDaMexida(mexida, precoEm) {
  if (!mexida || !mexida.tokens) return null;
  let total = 0;
  for (const [mint, qtd] of Object.entries(mexida.tokens)) {
    const p = precoEm(mint, mexida.quando);
    if (!(p > 0)) return null;
    total += qtd * p;
  }
  return total;
}

/* O QUE LANÇAR, a partir dos eventos de uma posição.
 *
 * Junta as mexidas em duas contas, que são as duas que o resto do radar já
 * sabe tratar — e a separação é a receita 3.4:
 *
 *   colheita   taxa recolhida. NÃO é dinheiro de fora: é lucro realizado.
 *   saque      liquidez que voltou (retirada ou fechamento).
 *   aporte     liquidez que entrou.
 *
 * Devolve os três somados em dólar, com a data de cada um, prontos pra virar
 * lançamento — depois de ele confirmar. */
export function lancamentosDasMexidas(mexidas, precoEm) {
  const fora = { aporte: 0, saque: 0, colheita: 0, quando: null, incompleto: false };
  for (const m of mexidas || []) {
    const v = valorDaMexida(m, precoEm);
    if (v == null) { fora.incompleto = true; continue; }
    if (m.quando && (!fora.quando || m.quando > fora.quando)) fora.quando = m.quando;
    if (m.tipo === "colheita") { fora.colheita += Math.abs(v); continue; }
    if (v > 0) fora.saque += v; else fora.aporte += -v;
  }
  return fora;
}

/* AS MEXIDAS DE UMA POSIÇÃO, buscadas na cadeia.
 *
 * `pedir(metodo, params)` é o falador com o nó — vem de fora pra esta função
 * continuar testável sem rede.
 *
 * O TETO DE TRANSAÇÕES É BAIXO de propósito. Uma posição de faixa concentrada
 * tem poucos eventos na vida (abrir, mexer, colher, fechar), e cada uma custa
 * uma subrequisição. Quem tem oito posições e pede vinte de cada estoura o
 * orçamento do Worker por dado que ninguém vai olhar.
 *
 * FALHA DE UMA NÃO DERRUBA AS OUTRAS: transação que não veio vira silêncio, e
 * o silêncio aparece em `faltaram`. A conta de cima decide se ainda vale. */
export async function mexidasDaPosicao(posicao, dono, pedir, { quantas = 12 } = {}) {
  if (!posicao || !dono || typeof pedir !== "function") return null;

  const sigs = await pedir("getSignaturesForAddress", [posicao, { limit: quantas }])
    .catch(() => null);
  if (!Array.isArray(sigs)) return null;

  const fora = [], faltaram = [], naoEntendi = [];
  for (const s of sigs) {
    if (s?.err) continue; // transação que falhou não moveu dinheiro
    const t = await pedir("getTransaction", [s.signature, {
      maxSupportedTransactionVersion: 0, encoding: "jsonParsed",
    }]).catch(() => null);
    if (!t) { faltaram.push(s.signature); continue; }
    const m = lerMexida({
      assinatura: s.signature,
      blockTime: t.blockTime,
      fee: t.meta?.fee,
      contas: (t.transaction?.message?.accountKeys || []).map((k) => k?.pubkey || k),
      preBalances: t.meta?.preBalances,
      postBalances: t.meta?.postBalances,
      preTokenBalances: t.meta?.preTokenBalances,
      postTokenBalances: t.meta?.postTokenBalances,
      instrucoes: (t.meta?.logMessages || [])
        .filter((l) => /Instruction: /.test(l))
        .map((l) => String(l).split("Instruction: ")[1]),
      /* AS INSTRUÇÕES COM AS CONTAS DELAS — de cima e as de dentro. É por
         elas que o leitor acha a instrução da posição e filtra os cofres
         certos; os logs, que era tudo que viajava antes, PODEM CALAR (duas
         transações reais dele rodaram sem uma linha "Instruction:"). */
      instrucoesComContas: [
        ...(t.transaction?.message?.instructions || []),
        ...((t.meta?.innerInstructions || []).flatMap((x) => x?.instructions || [])),
      ].map((ins) => ({ programId: ins?.programId, accounts: ins?.accounts || [] })),
    }, dono, posicao);
    if (m) fora.push(m);
    else {
      /* GUARDA O PORQUE, nao so o fato. "Nao entendi duas" nao diz nada; "nao
         entendi duas, e as instrucoes delas sao IncreaseLiquidityV2" diz onde
         esta o buraco e como fecha-lo. */
      naoEntendi.push({
        assinatura: s.signature,
        instrucoes: (t.meta?.logMessages || [])
          .filter((l) => /Instruction: /.test(l))
          .map((l) => String(l).split("Instruction: ")[1]),
        tokensNaTx: (t.meta?.postTokenBalances || []).length,
        donoParticipa: (t.transaction?.message?.accountKeys || [])
          .some((k) => (k?.pubkey || k) === dono),
      });
    }
  }
  /* Do mais velho pro mais novo: é a ordem em que as coisas aconteceram, e a
     ordem em que um extrato se lê. */
  fora.sort((a, b) => (a.quando || 0) - (b.quando || 0));

  /* A LEITURA SABE SE FICOU COMPLETA, e essa é a informação mais importante
   * que sai daqui.
   *
   * Três coisas diferentes acontecem com uma transação:
   *
   *   virou mexida   o caminho feliz;
   *   FALTOU         o nó não devolveu (histórico podado, rede caiu). Não sei
   *                  o que tinha nela;
   *   não entendi    li e não reconheci — ou ela não mexe no dinheiro dele
   *                  (a criação do NFT de posição, por exemplo), ou mexe de um
   *                  jeito que eu ainda não sei ler.
   *
   * As duas últimas são ausência, e ausência vira mentira quando passa por
   * prova. Foi o que aconteceu em 12/09/2026: uma pool com QUATRO transações
   * devolveu duas mexidas, e quem lê achou que eram todas. A conta comparou
   * o valor de UM depósito (dos três que houve) com o valor certo da saída,
   * e anunciou como lucro mais da metade do que a pool teve dentro, num dia.
   *
   * Quem decide o que fazer com isso é quem chama. O trabalho daqui é NÃO
   * ESCONDER. */
  /* NEM TODA "NAO ENTENDI" E BURACO — e eu errei isso na primeira tentativa.
   *
   * Escrevi `completa = faltaram.length === 0` achando que transacao lida e
   * nao reconhecida fosse sempre inofensiva (a criacao do NFT da posicao, por
   * exemplo, que nao move dinheiro nenhum). Medido contra a pool dele no mesmo
   * dia: das duas nao entendidas, uma era
   *
   *     SwapRouteV3, SwapV2, SwapV2     com 11 tokens se mexendo
   *
   * Um SWAP. Quando ele aumenta uma pool pondo so um dos lados, a Orca troca e
   * deposita na mesma transacao — e o leitor, que so conhece
   * IncreaseLiquidity/CollectFees/ClosePosition, devolve nada.
   *
   * A pergunta que separa as duas e simples: o dono participa E ha saldo de
   * token mudando? Entao aquela transacao mexeu no dinheiro dele e eu nao sei
   * dizer como. Isso e buraco, e buraco tem que se declarar.
   *
   * Enquanto o leitor nao aprender a ler swap, esta e a resposta honesta: a
   * leitura se diz incompleta, a cadeia nao cala o que ele lancou, e a conta
   * usa o numero dele. Preferir o pior dado ao dado inventado. */
  const cegueira = naoEntendi.filter((x) => x.donoParticipa && x.tokensNaTx > 0);

  return {
    mexidas: fora, faltaram, naoEntendi,
    olhou: sigs.length,
    completa: faltaram.length === 0 && cegueira.length === 0,
  };
}
