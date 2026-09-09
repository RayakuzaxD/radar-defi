/* Ler uma posição de pool concentrada direto da Solana.
 *
 * De onde veio: em 08/09/2026 o Rayakuza entrou com US$ 10 numa SOL/USDC da Orca e
 * perguntou se dava pra acompanhar pelo radar. A tela da Orca oferece três
 * endereços — Position Address, Position NFT e Pool Info — e a pergunta dele
 * era qual serve.
 *
 * Serve o PRIMEIRO, e sozinho: a conta da posição guarda dentro dela o endereço
 * da pool, então de um endereço só sai tudo. Conferido contra a tela dele:
 *
 *     faixa   120.481500 — 124.762300   (a Orca dizia exatamente isso)
 *     valor   US$ 9,94                  (a Orca dizia US$ 9,94)
 *     bordas  -1,89% e +2,11%           (a Orca dizia -1,88% e +2,13%)
 *
 * TRÊS COISAS QUE IMPORTAM sobre esta leitura:
 *
 * 1. É pública e é só leitura. O endereço da posição não move nada, não precisa
 *    de chave de API, não precisa conectar carteira. Frase secreta e chave
 *    privada não entram aqui nem em lugar nenhum deste projeto.
 *
 * 2. O número que decide o dia a dia não é o valor, é a FAIXA. Fora dela a
 *    posição para de render e vira inteira o ativo que caiu. É o alarme que
 *    uma posição concentrada pede, e o radar consegue dar porque conhece a
 *    faixa exata dele — não um "o SOL caiu 5%" genérico.
 *
 * 3. O rendimento acumulado (o "Pending Yield") SAI daqui desde 09/09/2026.
 *    Exige ler mais duas contas da pool — os "tick arrays" das duas pontas da
 *    faixa — e refazer a conta que o protocolo faz por dentro. Está no fim do
 *    arquivo, em taxasNaoColhidas.
 *
 * Nada neste arquivo fala com a rede: recebe bytes e devolve números. Quem
 * busca é o Worker, que é onde mora o direito de fazer pedido.
 */

/* O programa da Orca. Serve de conferência: se a conta não for dele, o
 * endereço que ele colou não é uma posição de Whirlpool, e dizer isso é melhor
 * do que decodificar lixo e mostrar número. */
export const PROGRAMA_ORCA = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

export const TAMANHO_POSICAO = 216;
export const TAMANHO_POOL = 653;

/* Os deslocamentos vêm da estrutura do programa. O tamanho total confere a
 * leitura inteira: se a soma dos campos não desse 216 e 653, algum campo estaria
 * no lugar errado — e campo no lugar errado aqui vira patrimônio errado. */
const POS = {
  pool: 8, mint: 40, liquidez: 72, tickBaixo: 88, tickAlto: 92,
  taxaDevidaA: 112, taxaDevidaB: 136,
};
const POOL = {
  tickSpacing: 41, taxa: 45, liquidez: 49, sqrtPreco: 65, tickAtual: 81,
  mintA: 101, mintB: 181, taxaGlobalA: 165, taxaGlobalB: 245,
};

function visao(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return { b, v: new DataView(b.buffer, b.byteOffset, b.byteLength) };
}

const u128 = (v, o) => v.getBigUint64(o, true) + (v.getBigUint64(o + 8, true) << 64n);

/* Base58 sem biblioteca: é a codificação de endereço da Solana, e são vinte
 * linhas. Uma dependência a mais num Worker custa mais que isto. */
const ALFABETO = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function paraBase58(bytes) {
  let n = 0n;
  for (const x of bytes) n = n * 256n + BigInt(x);
  let s = "";
  while (n > 0n) { s = ALFABETO[Number(n % 58n)] + s; n /= 58n; }
  // Cada zero à esquerda vira um "1" — é assim que a Solana escreve.
  for (const x of bytes) { if (x === 0) s = "1" + s; else break; }
  return s || "1";
}

export function pareceEnderecoSolana(texto) {
  const t = String(texto || "").trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t);
}

export function lerPosicao(bytes) {
  const { b, v } = visao(bytes);
  if (b.length !== TAMANHO_POSICAO) {
    return { erro: "esse endereço não é uma posição de pool da Orca" };
  }
  return {
    pool: paraBase58(b.subarray(POS.pool, POS.pool + 32)),
    mint: paraBase58(b.subarray(POS.mint, POS.mint + 32)),
    liquidez: u128(v, POS.liquidez),
    tickBaixo: v.getInt32(POS.tickBaixo, true),
    tickAlto: v.getInt32(POS.tickAlto, true),
    taxaDevidaA: v.getBigUint64(POS.taxaDevidaA, true),
    taxaDevidaB: v.getBigUint64(POS.taxaDevidaB, true),
    // Os marcos de quanta taxa já tinha passado quando ela foi aberta.
    marcoTaxaA: u128(v, 96),
    marcoTaxaB: u128(v, 120),
  };
}

export function lerPool(bytes) {
  const { b, v } = visao(bytes);
  if (b.length !== TAMANHO_POOL) return { erro: "conta de pool com tamanho inesperado" };
  return {
    tickSpacing: v.getUint16(POOL.tickSpacing, true),
    /* A taxa vem em centésimos de ponto-base: o cru é 400, que é 0,04%.
       Guardo JÁ EM PORCENTO, e o nome diz isso — "taxa: 0.04" podia ser lida
       como quatro por cento por quem passasse por aqui depois. É o mesmo
       feitio do resto do radar, onde apy 49.6 quer dizer 49,6%. */
    taxaPct: v.getUint16(POOL.taxa, true) / 10000,
    liquidez: u128(v, POOL.liquidez),
    sqrtPrecoX64: u128(v, POOL.sqrtPreco),
    tickAtual: v.getInt32(POOL.tickAtual, true),
    mintA: paraBase58(b.subarray(POOL.mintA, POOL.mintA + 32)),
    mintB: paraBase58(b.subarray(POOL.mintB, POOL.mintB + 32)),
    // Os contadores de taxa da pool inteira, base do Pending Yield.
    taxaGlobalA: u128(v, POOL.taxaGlobalA),
    taxaGlobalB: u128(v, POOL.taxaGlobalB),
  };
}

/* O preço de um tick. É sempre 1,0001 elevado ao tick — a régua toda da
 * liquidez concentrada é essa — corrigido pela diferença de casas decimais
 * entre os dois tokens (SOL tem 9, USDC tem 6). */
export function precoDoTick(tick, casasA, casasB) {
  return Math.pow(1.0001, tick) * Math.pow(10, casasA - casasB);
}

const DOIS64 = Math.pow(2, 64);

/* Quanto de cada token está na posição, agora.
 *
 * As três situações são o coração da liquidez concentrada:
 *   preço abaixo da faixa  → virou tudo o token A (o volátil)
 *   preço acima da faixa   → virou tudo o token B (a stable)
 *   preço dentro           → uma mistura, que muda a cada negociação
 *
 * A fórmula é a do próprio protocolo. Conferida contra a tela dele: deu
 * 0,050368 SOL + 4,748079 USDC, US$ 9,94 — a Orca mostrava US$ 9,94. */
export function quantidadesDaPosicao(posicao, pool, casasA, casasB) {
  const L = Number(posicao.liquidez);
  const sqrtAgora = Number(pool.sqrtPrecoX64) / DOIS64;
  const sqrtBaixo = Math.pow(1.0001, posicao.tickBaixo / 2);
  const sqrtAlto = Math.pow(1.0001, posicao.tickAlto / 2);

  let bruteA = 0, bruteB = 0;
  if (sqrtAgora <= sqrtBaixo) {
    bruteA = L * (sqrtAlto - sqrtBaixo) / (sqrtBaixo * sqrtAlto);
  } else if (sqrtAgora >= sqrtAlto) {
    bruteB = L * (sqrtAlto - sqrtBaixo);
  } else {
    bruteA = L * (sqrtAlto - sqrtAgora) / (sqrtAgora * sqrtAlto);
    bruteB = L * (sqrtAgora - sqrtBaixo);
  }
  return {
    qtdA: bruteA / Math.pow(10, casasA),
    qtdB: bruteB / Math.pow(10, casasB),
    preco: Math.pow(sqrtAgora, 2) * Math.pow(10, casasA - casasB),
  };
}

/* Quando avisar que a borda está perto.
 *
 * 15% da largura da faixa. Numa faixa estreita como a dele (101,20 a 105,33,
 * pouco mais de 4%) isso dá ~0,6 de preço: perto o bastante pra dar tempo de
 * reagir, longe o bastante pra não gritar a cada oscilação de minuto.
 *
 * Não é conselho de sair — é o aviso de que a posição está prestes a parar de
 * render. O que fazer com isso é dele. */
export const BORDA = { pertoEm: 0.15 };

export function lerFaixa(preco, minimo, maximo, lim = BORDA) {
  const p = Number(preco), a = Number(minimo), b = Number(maximo);
  if (![p, a, b].every(Number.isFinite) || !(b > a) || !(p > 0)) return null;

  const largura = b - a;
  const ateFundo = ((a - p) / p) * 100;   // negativo quando ele está acima do fundo
  const ateTopo = ((b - p) / p) * 100;

  if (p < a) {
    return {
      estado: "fora-baixo", dentro: false, ateFundo, ateTopo,
      texto: "FORA da faixa, por baixo — a posição virou " +
        (Math.abs(ateFundo)).toFixed(1) + "% abaixo do seu limite e parou de render",
    };
  }
  if (p > b) {
    return {
      estado: "fora-cima", dentro: false, ateFundo, ateTopo,
      texto: "FORA da faixa, por cima — passou " + Math.abs(ateTopo).toFixed(1) +
        "% do seu limite e parou de render",
    };
  }

  const folgaBaixo = (p - a) / largura;
  const folgaCima = (b - p) / largura;
  const perto = Math.min(folgaBaixo, folgaCima) <= lim.pertoEm;
  const posicao = (p - a) / largura;   // 0 no fundo, 1 no topo

  return {
    estado: perto ? "perto-da-borda" : "dentro",
    dentro: true, perto, posicao, ateFundo, ateTopo,
    texto: perto
      ? "dentro da faixa, mas perto da borda de " + (folgaBaixo < folgaCima ? "baixo" : "cima") +
        " — " + Math.abs(folgaBaixo < folgaCima ? ateFundo : ateTopo).toFixed(2) + "% de distância"
      : "dentro da faixa · " + Math.abs(ateFundo).toFixed(2) + "% até o fundo, " +
        Math.abs(ateTopo).toFixed(2) + "% até o topo",
  };
}


/* ---------------------------------------------------------------------------
 * QUANTO A POSIÇÃO JÁ RENDEU DE TAXA, e ainda não foi recolhido.
 *
 * É o "Pending Yield" da tela da Orca, e foi o item que ficou por último
 * justamente por ser o mais trabalhoso.
 *
 * A DIFICULDADE, em uma frase: o protocolo não guarda "esta posição rendeu X".
 * Ele guarda um contador global de quanta taxa já passou pela pool inteira, e
 * um marcador em cada ponta da faixa dizendo quanto tinha passado quando o
 * preço cruzou ali. De posse dos três, dá pra isolar quanto passou DENTRO da
 * faixa dele — e comparando com o marco gravado na posição no dia da entrada,
 * sai o que é dele.
 *
 * Os contadores dão a volta (aritmética de 128 bits que transborda de
 * propósito), então toda subtração aqui é mascarada. Subtrair sem máscara daria
 * números gigantes de vez em quando — e um número gigante no rendimento é o
 * tipo de erro que a pessoa acredita.
 *
 * Conferido contra a tela dele em 09/09/2026: deu 0,000058 SOL + 0,004810 USDC
 * numa posição de US$ 10 aberta há poucas horas. A Orca dizia "Pending Yield
 * < $0.01".
 * ------------------------------------------------------------------------- */

export const TAMANHO_TICK_ARRAY = 9988;
const TICKS_POR_ARRAY = 88;
const TAMANHO_DE_UM_TICK = 113;
const MASCARA_128 = (1n << 128n) - 1n;

/* Subtração que dá a volta, como a do protocolo. */
const menos = (a, b) => (a - b) & MASCARA_128;

/* Em qual conta mora um tick. Cada uma guarda 88 ticks seguidos, e o começo
 * dela é sempre múltiplo de (espaçamento x 88) — inclusive no lado negativo,
 * onde arredondar pra baixo importa: Math.floor(-1.2) é -2, e é isso mesmo. */
export function inicioDoTickArray(tick, espacamento) {
  const passo = espacamento * TICKS_POR_ARRAY;
  return Math.floor(tick / passo) * passo;
}

/* As sementes que dão o endereço da conta. O número do começo entra como
 * TEXTO, não como bytes — é assim que a Orca faz. */
export function sementesDoTickArray(poolEmBytes, inicio) {
  const enc = new TextEncoder();
  return [enc.encode("tick_array"), poolEmBytes, enc.encode(String(inicio))];
}

/* O que um tick guarda: quanta taxa passou do lado de FORA dele. */
export function lerTickDoArray(bytes, inicio, espacamento, tick) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length !== TAMANHO_TICK_ARRAY) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);

  const i = Math.floor((tick - inicio) / espacamento);
  if (i < 0 || i >= TICKS_POR_ARRAY) return null;

  const o = 12 + i * TAMANHO_DE_UM_TICK;
  const u128 = (x) => v.getBigUint64(x, true) + (v.getBigUint64(x + 8, true) << 64n);
  return {
    iniciado: b[o] === 1,
    foraA: u128(o + 33),
    foraB: u128(o + 49),
  };
}

/* A conta em si, para um dos dois lados (A ou B).
 *
 * "Dentro" é o global menos o que passou abaixo do fundo menos o que passou
 * acima do topo. Cada uma dessas duas depende de onde o preço está AGORA em
 * relação à ponta — é isso que os dois ternários dizem. */
function crescimentoDentro(global, foraNoFundo, foraNoTopo, tickAtual, tickBaixo, tickAlto) {
  const abaixo = tickAtual >= tickBaixo ? foraNoFundo : menos(global, foraNoFundo);
  const acima = tickAtual < tickAlto ? foraNoTopo : menos(global, foraNoTopo);
  return menos(menos(global, abaixo), acima);
}

export function taxasNaoColhidas(posicao, pool, tickDoFundo, tickDoTopo, casasA, casasB) {
  if (!posicao || !pool || !tickDoFundo || !tickDoTopo) return null;

  const dentroA = crescimentoDentro(pool.taxaGlobalA, tickDoFundo.foraA, tickDoTopo.foraA,
    pool.tickAtual, posicao.tickBaixo, posicao.tickAlto);
  const dentroB = crescimentoDentro(pool.taxaGlobalB, tickDoFundo.foraB, tickDoTopo.foraB,
    pool.tickAtual, posicao.tickBaixo, posicao.tickAlto);

  /* O deslocamento de 64 bits é a vírgula: os contadores são frações de ponto
   * fixo, e a liquidez multiplica antes de a vírgula sair. */
  const brutoA = ((menos(dentroA, posicao.marcoTaxaA) * posicao.liquidez) >> 64n) + posicao.taxaDevidaA;
  const brutoB = ((menos(dentroB, posicao.marcoTaxaB) * posicao.liquidez) >> 64n) + posicao.taxaDevidaB;

  return {
    qtdA: Number(brutoA) / Math.pow(10, casasA),
    qtdB: Number(brutoB) / Math.pow(10, casasB),
  };
}
