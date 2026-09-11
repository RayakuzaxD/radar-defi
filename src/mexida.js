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
 *   ele desmontou uma pool SOL/ETH e a tela disse que ele perdeu 105 dólares.
 *   O saque fora lançado como US$ 0,04 — que eram 0,042342 ETH, porque o valor
 *   de uma posição sai na moeda B quando falta cotação de um dos lados.
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
 * A primeira versão deste arquivo somava a variação de saldo da CARTEIRA dele.
 * Dava 0,001850696 SOL onde a pool devolveu 0,001854239, e 1,036139696 onde ela
 * devolveu 1,026659469. A razão é a mesma de 2026-09: o saldo da carteira
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
 * recolhida de liquidez retirada, e a conta trata as duas de jeitos opostos. */
export function tipoDaMexida(instrucoes) {
  const tem = (re) => (instrucoes || []).some((i) => re.test(String(i)));
  if (tem(/ClosePosition/i)) return "fechamento";
  if (tem(/CollectFees|CollectReward/i)) return "colheita";
  if (tem(/DecreaseLiquidity/i)) return "retirada";
  if (tem(/IncreaseLiquidity|OpenPosition/i)) return "deposito";
  return null;
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
export function tokensQueSeMexeram(tx, dono) {
  if (!tx || !dono) return null;
  const meta = tx.meta || tx;
  const antes = new Map(), depois = new Map();
  for (const b of meta.preTokenBalances || []) antes.set(b.accountIndex, b);
  for (const b of meta.postTokenBalances || []) depois.set(b.accountIndex, b);
  if (!antes.size && !depois.size) return null;

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

/* Uma transação vira um evento legível: o que é, quando, e o que se mexeu. */
export function lerMexida(tx, dono) {
  const tipo = tipoDaMexida(tx?.instrucoes
    || (tx?.meta?.logMessages || [])
      .filter((l) => /Instruction: /.test(l))
      .map((l) => String(l).split("Instruction: ")[1]));
  if (!tipo) return null;
  const tokens = tokensQueSeMexeram(tx, dono);
  if (!tokens) return null;
  const quando = Number(tx.blockTime);
  return {
    tipo, tokens,
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

  const fora = [], faltaram = [];
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
    }, dono);
    if (m) fora.push(m);
  }
  /* Do mais velho pro mais novo: é a ordem em que as coisas aconteceram, e a
     ordem em que um extrato se lê. */
  fora.sort((a, b) => (a.quando || 0) - (b.quando || 0));
  return { mexidas: fora, faltaram, olhou: sigs.length };
}
