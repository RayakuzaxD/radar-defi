/* O mesmo par, em toda parte — e onde ele paga mais.
 *
 * Este arquivo existe por causa de um trecho da aula "Pools na prática", em que
 * o Lucas quer montar ETH-USDC e abre a Uniswap rede por rede, anotando o
 * multiplicador de cada uma:
 *
 *     "Ethereum está me dando 12,44. Vamos na Base — está em 3. Vamos na
 *      Polygon — esquece. Unichain — 6. Arbitrum — 10,92."
 *
 * Cinco abas de navegador, à mão, uma por rede. Depois ele repete o processo
 * entre Orca e Raydium para SOL-USDC, na calculadora.
 *
 * O radar já tem todas essas pools medidas, de todas as redes, no mesmo banco.
 * Fazer essa comparação é uma consulta. Medido em 07/09/2026 sobre as 236 pools
 * que passam nos portões, a diferença dentro do MESMO par chega a 8,4x:
 * ETH-USDC vai de 0,053%/dia a 0,447%/dia dependendo de onde você abre.
 *
 * A regra que ele resume no fim da aula:
 *
 *     "Você vai procurar o maior volume, menor TVL possível, considerando o
 *      volume, e o maior multiplicador — levando taxas pagas nas últimas 24
 *      horas sobre o TVL."
 *
 * Nada aqui fala com a rede nem com o banco.
 */

import { separarPar } from "./rendimento.js";

/* Quando dois multiplicadores contam como "empate".
 *
 * Não é enfeite: é uma regra do método que eu jamais teria adivinhado. Na aula,
 * ETH-USDC dá 12,44 na Ethereum e 10,92 na Arbitrum, e ele escolhe a ARBITRUM:
 *
 *     "Se você tem pouco capital, faz mais sentido você vir para a Arbitrum.
 *      Um, montagem de taxas mais baratas. Dois, o TVL é consideravelmente
 *      menor [...] a representação do capital sobre 1 milhão e 900 te dá uma
 *      participação maior de TVL, consequentemente uma participação maior do
 *      direito das taxas."
 *
 * E ele mesmo delimita quando isso vale:
 *
 *     "só quando é muito, muito, muito próximo como é esse caso, e quando o
 *      TVL é muito discrepante um do outro."
 *
 * Os dois números abaixo saem desse exemplo: 10,92 contra 12,44 são 12% de
 * diferença (cabe em 20%), e 9,3M contra 1,9M são 4,9x (passa de 3x). Com esses
 * cortes a regra dispara exatamente no caso que ele descreve, e cala quando a
 * diferença de multiplicador é grande de verdade. */
export const COMPARACAO = {
  proximidade: 0.20,      // diferença de multiplicador que ainda é "empate"
  discrepanciaTvl: 3,     // quantas vezes o TVL precisa diferir pra virar nota
  minimoDeLugares: 2,     // par que só existe num lugar não se compara com nada
};

/* Os apelidos que são o MESMO token com nome diferente.
 *
 * WETH é Ethereum embalado; WSOL é Solana embalado; WBTC e cbBTC são Bitcoin em
 * outra rede. Pra escolher ONDE abrir um par, tratá-los como tokens diferentes
 * quebraria a comparação em pedaços — que é exatamente o que se quer evitar.
 *
 * O que NÃO entra aqui: stablecoins entre si. USDC e USDT andam parecido mas
 * não são o mesmo ativo, têm emissores diferentes e o método trata risco de
 * emissor como risco. Juntar os dois esconderia uma escolha real. */
const APELIDOS = {
  WETH: "ETH", WSOL: "SOL", WMATIC: "MATIC", WPOL: "POL",
  WBTC: "BTC", CBBTC: "BTC", TBTC: "BTC", WBNB: "BNB", WAVAX: "AVAX",
};

/* A chave canônica de um par: tokens sem embalagem, em ordem alfabética.
 *
 * A ordem alfabética é o que faz "ETH-USDC" e "USDC-ETH" caírem no mesmo lugar.
 * Sem isso a comparação some justamente nos pares mais comuns — no banco em
 * 07/09/2026 havia 7 pools em "ETH-USDC" e outras 4 em "USDC-ETH", separadas
 * por nada além da ordem em que o protocolo escreveu. */
export function chaveDoPar(simbolo) {
  const { tokens } = separarPar(simbolo);
  if (!tokens.length) return null;
  const limpos = tokens
    .map((t) => t.toUpperCase())
    .map((t) => APELIDOS[t] || t)
    .filter(Boolean);
  if (!limpos.length) return null;
  // Duplicata some: "ETH-WETH" é um par só de Ethereum consigo mesmo.
  return [...new Set(limpos)].sort().join("-");
}

/* Junta as pools por par canônico.
 *
 * Só entram as que têm multiplicador — sem ele não há o que comparar, e uma
 * linha "sem dado" no meio de um ranking convida a leitura errada. */
export function agruparPorPar(pools, lim = COMPARACAO) {
  const grupos = new Map();
  for (const p of pools || []) {
    if (p?.multiplicador == null || !(p.multiplicador > 0)) continue;
    const chave = chaveDoPar(p.simbolo);
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(p);
  }
  for (const [chave, lista] of grupos) {
    if (lista.length < lim.minimoDeLugares) grupos.delete(chave);
  }
  return grupos;
}

/* A comparação de um par: onde ele paga mais, e o que mais convém saber.
 *
 * Devolve as opções ordenadas pelo multiplicador (o critério do método) e a
 * nota do TVL quando ela se aplica. */
export function compararPar(chave, pools, lim = COMPARACAO) {
  const ordenadas = [...pools].sort((a, b) => b.multiplicador - a.multiplicador);
  const melhor = ordenadas[0];
  const pior = ordenadas[ordenadas.length - 1];

  /* O "vale a pena olhar": quantas vezes o melhor paga mais que o pior.
   *
   * É o número que justifica a tela existir. Par que varia 5% entre redes não
   * merece a atenção dele; par que varia 8x, sim. */
  const espalhamento = pior.multiplicador > 0
    ? melhor.multiplicador / pior.multiplicador : null;

  /* A nota do TVL menor, quando o topo está empatado.
   *
   * Compara o primeiro com os seguintes que ainda estão dentro da proximidade.
   * Não reordena a lista: o método ordena pelo multiplicador, e trocar a ordem
   * seria eu decidindo por ele. A nota diz o que ele precisa saber e a decisão
   * continua dele — que é o mesmo desenho de todo o resto do radar. */
  let notaDoTvl = null;
  for (const outra of ordenadas.slice(1)) {
    const perto = (melhor.multiplicador - outra.multiplicador) / melhor.multiplicador <= lim.proximidade;
    if (!perto) break;
    if (!(melhor.tvl > 0) || !(outra.tvl > 0)) continue;
    if (melhor.tvl / outra.tvl >= lim.discrepanciaTvl) {
      notaDoTvl = {
        preferida: outra,
        vezesMenor: melhor.tvl / outra.tvl,
        texto: `${outra.projeto} na ${outra.rede} paga quase o mesmo (${outra.multiplicador.toFixed(3)}% contra ${melhor.multiplicador.toFixed(3)}%) com um TVL ${(melhor.tvl / outra.tvl).toFixed(1)}x menor. Com pouco capital isso costuma render mais: sua fatia da pool é maior, e a fatia das taxas acompanha.`,
      };
      break;
    }
  }

  return {
    par: chave,
    opcoes: ordenadas,
    melhor,
    pior,
    espalhamento,
    redes: new Set(ordenadas.map((p) => p.rede)).size,
    dexes: new Set(ordenadas.map((p) => p.projeto)).size,
    notaDoTvl,
  };
}

/* Os pares que valem uma tela, do que mais varia pro que menos varia.
 *
 * Ordenar por espalhamento e não por rendimento é deliberado: a pergunta que
 * esta tela responde não é "qual par paga mais", que as outras já respondem, e
 * sim "onde eu estaria deixando dinheiro na mesa por abrir no lugar errado". */
export function paresQueValemComparar(pools, { minimoDeEspalhamento = 1.5, limite = 10 } = {}) {
  const grupos = agruparPorPar(pools);
  const comparados = [];
  for (const [chave, lista] of grupos) {
    const c = compararPar(chave, lista);
    if (c.espalhamento != null && c.espalhamento >= minimoDeEspalhamento) comparados.push(c);
  }
  return comparados
    .sort((a, b) => b.espalhamento - a.espalhamento)
    .slice(0, limite);
}

/* A frase que resume uma comparação. */
export function porqueDaComparacao(c) {
  if (!c || !c.melhor) return "";
  const partes = [];
  if (c.espalhamento != null && c.espalhamento >= 1.5) {
    partes.push(`O mesmo par paga ${c.espalhamento.toFixed(1)}x mais em ${c.melhor.rede} (${c.melhor.projeto}) do que no pior lugar da lista.`);
  }
  partes.push(`Está em ${c.redes} rede${c.redes === 1 ? "" : "s"} e ${c.dexes} protocolo${c.dexes === 1 ? "" : "s"}.`);
  if (c.notaDoTvl) partes.push(c.notaDoTvl.texto);
  return partes.join(" ");
}
