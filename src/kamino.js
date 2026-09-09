/* Ler um empréstimo na Kamino, direto da Solana.
 *
 * Mesma ideia do orca.js e a mesma promessa: recebe bytes, devolve números.
 * Nada aqui fala com a rede.
 *
 * O QUE A KAMINO GUARDA, e por que isso é uma boa notícia.
 *
 * Ela não guarda "US$ 10". Guarda 8,337570 cTokens — e o cToken vale mais a
 * cada dia. O juro não é pago em token novo: ele está embutido no CÂMBIO, que
 * sobe sozinho enquanto os tomadores pagam.
 *
 * Isso resolve de graça o que na Orca é o trabalho mais chato. Lá as taxas
 * ficam guardadas em contas de tick separadas, que precisam ser reconstruídas.
 * Aqui basta ler o câmbio de hoje.
 *
 * Conferido contra a tela do Rayakuza em 08/09/2026:
 *
 *     8.337570 cTokens x câmbio 1,19939103 = 10,0000 USDC
 *     a Kamino mostrava                      Net value $10.00
 *
 * E dá pra ver o juro correndo: duas leituras com minutos de diferença deram
 * câmbio 1,19939103 e depois 1,19939185 — US$ 10,000000 virando US$ 10,000014.
 */

export const PROGRAMA_KAMINO = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";

export const TAMANHO_OBRIGACAO = 3344;
export const TAMANHO_RESERVA = 8624;

/* Os mercados da Kamino que valem procurar.
 *
 * Existem 217 contas de mercado na rede, e a esmagadora maioria é teste
 * ("Test fail 17", "Mike 3", "USELESS"). Procurar em todos custaria catorze
 * idas à rede por importação, e o nó público não gosta disso.
 *
 * Então a lista é curada: os que têm nome reconhecível, lidos da própria rede
 * em 08/09/2026. Quem usar um mercado fora daqui não vê o empréstimo aparecer
 * sozinho — e para esse caso existe o campo de colar o endereço à mão. É uma
 * limitação de verdade, e está escrita na tela, não só aqui. */
export const MERCADOS = [
  { id: "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF", nome: "SOL/BTC Market" },
  { id: "DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek", nome: "JLP Market" },
  { id: "ByYiZxp8QrdN9qbdtaAiePN8AAr3qvTPppNJDpf5DVJ5", nome: "Altcoins Market" },
  { id: "BJnbcRHqvppTyGesLzWASGKnmnF1wq9jZu6ExrjT7wvF", nome: "Ethena Market" },
  { id: "H6rHXmXoCQvq8Ue81MqNh7ow5ysPa1dSozwW3PU1dDH6", nome: "Jito Market" },
  { id: "GVDUXFwS8uvBG35RjZv6Y8S1AkV5uASiMJ9qTUKqb5PL", nome: "Marinade Market" },
  { id: "eNLm5e5KVDX2vEcCkt75PpZ2GMfXcZES3QrFshgpVzp", nome: "Sanctum Market" },
  { id: "QCif94ezBGkSUbEVTQuoxANCBS34yghMxTjDY25bzio", nome: "Pendle Market" },
  { id: "DTkFbetMoo6WpKxfU4qK7Ly3JCHt6krxq7Yscbd9y1qv", nome: "Pendle Market II" },
  { id: "7hzGvUjrPuV4fXw1L6BBRPGAaWtonfwQEcuZ68P2UEqD", nome: "JLP/USDC" },
  { id: "fWfo1D8NDxCrZzjDkwesa6ZX9E22vkXaWqwF9rk7yFq", nome: "Marinade" },
];

/* Os deslocamentos vêm da estrutura do programa, e os tamanhos totais (3344 e
 * 8624) conferem o mapa inteiro de uma vez: se a soma dos campos não desse
 * isso, algum estaria no lugar errado — e campo no lugar errado aqui vira
 * patrimônio errado, sem dar erro nenhum. */
const OBG = { mercado: 32, dono: 64, depositos: 96, porDeposito: 136, quantos: 8 };
const RES = {
  liquidezMint: 128, disponivel: 224, emprestadoSf: 232, precoSf: 248, casas: 272,
  taxasSf: 344, colateralMint: 2560, colateralSupply: 2592,
};

/* Os números de valor da Kamino vêm em "fração escalada": inteiro com 60 bits
 * de casa decimal. Dividir por 2^60 devolve o número de verdade. */
const ESCALA = 2n ** 60n;

function visao(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return { b, v: new DataView(b.buffer, b.byteOffset, b.byteLength) };
}
const u128 = (v, o) => v.getBigUint64(o, true) + (v.getBigUint64(o + 8, true) << 64n);

export function lerObrigacao(bytes, paraBase58) {
  const { b, v } = visao(bytes);
  if (b.length !== TAMANHO_OBRIGACAO) {
    return { erro: "esse endereço não é uma posição de empréstimo da Kamino" };
  }
  const depositos = [];
  for (let i = 0; i < OBG.quantos; i++) {
    const o = OBG.depositos + i * OBG.porDeposito;
    const reserva = paraBase58(b.subarray(o, o + 32));
    const quantidade = v.getBigUint64(o + 32, true);
    // Espaço vazio: reserva nula e nada depositado.
    if (quantidade === 0n && reserva === "11111111111111111111111111111111") continue;
    depositos.push({ reserva, cTokens: quantidade });
  }
  return {
    mercado: paraBase58(b.subarray(OBG.mercado, OBG.mercado + 32)),
    dono: paraBase58(b.subarray(OBG.dono, OBG.dono + 32)),
    depositos,
  };
}

export function lerReserva(bytes, paraBase58) {
  const { b, v } = visao(bytes);
  if (b.length !== TAMANHO_RESERVA) return { erro: "conta de reserva com tamanho inesperado" };
  return {
    mint: paraBase58(b.subarray(RES.liquidezMint, RES.liquidezMint + 32)),
    casas: Number(v.getBigUint64(RES.casas, true)),
    disponivel: v.getBigUint64(RES.disponivel, true),
    emprestado: u128(v, RES.emprestadoSf) / ESCALA,
    taxasDoProtocolo: u128(v, RES.taxasSf) / ESCALA,
    // Preço do token em dólar, também em fração escalada.
    preco: Number(u128(v, RES.precoSf)) / Number(ESCALA),
    colateralMint: paraBase58(b.subarray(RES.colateralMint, RES.colateralMint + 32)),
    colateralSupply: v.getBigUint64(RES.colateralSupply, true),
  };
}

/* O câmbio de um cToken: quanta liquidez existe dividida por quantos cTokens
 * foram emitidos. É ele que sobe com o tempo, e é nele que mora o juro.
 *
 * As taxas do protocolo saem da conta porque não são dos depositantes. */
export function cambioDaReserva(reserva) {
  const total = reserva.disponivel + reserva.emprestado - reserva.taxasDoProtocolo;
  if (!(reserva.colateralSupply > 0n) || !(total > 0n)) return null;
  return Number(total) / Number(reserva.colateralSupply);
}

/* Quanto vale um depósito, em token e em dólar. */
export function valorDoDeposito(cTokens, reserva) {
  const cambio = cambioDaReserva(reserva);
  if (cambio == null) return null;
  const emToken = (Number(cTokens) * cambio) / Math.pow(10, reserva.casas);
  return { emToken, emDolar: emToken * reserva.preco, cambio };
}

/* Quanto rendeu, quando se sabe o câmbio do dia da entrada.
 *
 * A quantidade de cTokens não muda com o tempo — só quando ele deposita ou
 * saca. Então todo o ganho está na diferença de câmbio, e essa conta é exata:
 * não é estimativa nem média. */
export function juroAcumulado(cTokens, reserva, cambioDaEntrada) {
  const agora = cambioDaReserva(reserva);
  if (agora == null || !(cambioDaEntrada > 0)) return null;
  const diferenca = (Number(cTokens) * (agora - cambioDaEntrada)) / Math.pow(10, reserva.casas);
  return { emToken: diferenca, emDolar: diferenca * reserva.preco, cambioDeAgora: agora };
}
