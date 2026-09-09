/* Prova a conta de impermanent loss.
 *
 *   node testar-il.js
 *
 * Ele pediu: "quando fechar a posição faz sentido, porque vou saber quanto
 * rendeu ou se tive IL e perdi — o curso ensina isso tudo".
 *
 * O QUE ESTE ARQUIVO GUARDA, e é o motivo de existir: IL não é "quanto entrou
 * versus quanto saiu". É quanto a posição vale hoje CONTRA quanto valeriam os
 * mesmos tokens se ele tivesse só segurado. Duas contas que dão números
 * diferentes, e trocar uma pela outra é o erro fácil aqui.
 *
 * Os casos de referência são construídos com números redondos, para a resposta
 * poder ser conferida de cabeça — e o último tem a forma da posição real que calibrou a conta.
 */

import { readFileSync } from "node:fs";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log("\n" + t);
const perto = (a, b, tol) => Math.abs(a - b) < tol;

const fonte = readFileSync("src/painel.js", "utf8");
function pegarFuncao(nome) {
  const i = fonte.indexOf(`function ${nome}(`);
  if (i < 0) throw new Error(`não achei ${nome} em src/painel.js`);
  let n = 0, j = fonte.indexOf("{", i);
  for (; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}") { n--; if (n === 0) return fonte.slice(i, j + 1); }
  }
  throw new Error(`${nome} não fecha`);
}
const { contaDoIL, contaDoFechamento } = new Function(
  `${pegarFuncao("contaDoIL")}
${pegarFuncao("contaDoFechamento")}
   return { contaDoIL: contaDoIL, contaDoFechamento: contaDoFechamento };`
)();

const aporte = (qa, qb, extra = {}) => ({
  tipo: "aporte", valor: 1, qtd_a: qa, qtd_b: qb, ...extra,
});
const posicao = (qtdA, qtdB, preco, taxas = null) => ({
  tipo: "pool", qtdA, qtdB, preco, simboloA: "SOL", simboloB: "USDC",
  taxas: taxas == null ? null : { emDolar: taxas },
});

// ---------------------------------------------------------------------------
titulo("O preço parado: sem IL nenhum");

{
  /* Entrou com 1 SOL + 100 USDC a 100. O preço não andou, a pool não
     rebalanceou nada: a posição é idêntica ao que ele teria segurando. */
  const r = contaDoIL([aporte(1, 100)], posicao(1, 100, 100, 0));
  conferir("segurando valeria 200", perto(r.segurando, 200, 1e-9));
  conferir("na posição vale 200", perto(r.naPosicao, 200, 1e-9));
  conferir("IL é zero", perto(r.il, 0, 1e-9),
    "preço parado é o único caso em que IL é exatamente zero");
}

// ---------------------------------------------------------------------------
titulo("O preço subiu: a pool vendeu, e isso CUSTA");

{
  /* Entrou 1 SOL + 100 USDC a 100. O preço vai a 144 e a pool rebalanceou:
     agora ele tem menos SOL e mais USDC.

     SEGURANDO teria 1 x 144 + 100 = 244.
     NA POSIÇÃO tem 0,8 x 144 + 120 = 235,2.
     IL = -8,8. */
  const r = contaDoIL([aporte(1, 100)], posicao(0.8, 120, 144, 0));
  conferir("segurando valeria 244", perto(r.segurando, 244, 1e-9));
  conferir("na posição vale 235,20", perto(r.naPosicao, 235.2, 1e-9));
  conferir("IL é NEGATIVO", r.il < 0, "a pool vendeu SOL no caminho pra cima");
  conferir("e vale -8,80", perto(r.il, -8.8, 1e-9), `deu ${r.il}`);
}

{
  /* O MESMO caso, mas com taxas. É a pergunta do curso: as taxas cobriram? */
  const semTaxa = contaDoIL([aporte(1, 100)], posicao(0.8, 120, 144, 3));
  conferir("com US$ 3 de taxa, o resultado ainda é negativo",
    perto(semTaxa.resultado, -5.8, 1e-9),
    "IL -8,80 mais taxa 3,00");

  const comTaxa = contaDoIL([aporte(1, 100)], posicao(0.8, 120, 144, 12));
  conferir("com US$ 12 de taxa, vira positivo", perto(comTaxa.resultado, 3.2, 1e-9),
    "aí a pool pagou mais do que custou — é a resposta que ele procura");
}

// ---------------------------------------------------------------------------
titulo("O preço caiu: a pool comprou, e também custa");

{
  /* De 100 pra 64: a pool comprou SOL com a stable no caminho pra baixo.
     SEGURANDO: 1 x 64 + 100 = 164.
     NA POSIÇÃO: 1,25 x 64 + 80 = 160. */
  const r = contaDoIL([aporte(1, 100)], posicao(1.25, 80, 64, 0));
  conferir("segurando valeria 164", perto(r.segurando, 164, 1e-9));
  conferir("na posição vale 160", perto(r.naPosicao, 160, 1e-9));
  conferir("IL também é negativo na queda", perto(r.il, -4, 1e-9),
    "IL não tem lado: qualquer movimento de preço cobra");
}

// ---------------------------------------------------------------------------
titulo("Vários aportes somam em TOKEN, não em dólar");

{
  /* Dois aportes em preços diferentes. O que ele teria segurando é a soma dos
     TOKENS, avaliada ao preço de hoje — e não a soma dos dólares que ele pôs.
     Trocar uma coisa pela outra é o erro que este teste existe pra pegar. */
  const r = contaDoIL(
    [aporte(1, 100), aporte(0.5, 60)],
    posicao(1.4, 170, 120, 0),
  );
  conferir("soma 1,5 SOL", perto(r.qtdA, 1.5, 1e-9));
  conferir("e 160 USDC", perto(r.qtdB, 160, 1e-9));
  conferir("segurando valeria 340", perto(r.segurando, 1.5 * 120 + 160, 1e-9),
    "1,5 x 120 + 160 — os tokens ao preço de HOJE");
  conferir("e NÃO os 220 dólares que ele pôs", !perto(r.segurando, 220, 1),
    "o dinheiro que entrou é outra conta, e é a do lucro, não a do IL");
}

{
  /* Saque tira tokens do que ele "teria segurando". */
  const r = contaDoIL([aporte(2, 200), { tipo: "saque", qtd_a: 0.5, qtd_b: 50 }],
                      posicao(1.5, 150, 100, 0));
  conferir("o saque desconta do que ele teria segurando", perto(r.qtdA, 1.5, 1e-9));
  conferir("e o IL fica zero neste caso", perto(r.il, 0, 1e-9));
}

// ---------------------------------------------------------------------------
titulo("A POSIÇÃO REAL DELE, com as três entradas lidas da blockchain");

{
  /* Três depósitos com composição ao milionésimo, como os cofres de um
   * whirlpool registram de verdade. A forma é a do caso real que calibrou
   * esta conta: entradas em horários e proporções diferentes, somadas. */
  const varios = [
    aporte(0.050000000, 5.000000000),
    aporte(0.040000000, 5.500000000),
    aporte(0.030000000, 6.500000000),
  ];
  const r = contaDoIL(varios, posicao(0.068500000, 13.250000, 100.00, 0.0450));

  conferir("total posto: 0,12 SOL", perto(r.qtdA, 0.12, 1e-8));
  conferir("e 17,000000 USDC", perto(r.qtdB, 17.0, 1e-6));
  conferir("a conta sai", r.faltando === 0);
  conferir("segurando valeria uns US$ 29,00",
    perto(r.segurando, 0.12 * 100.00 + 17.0, 1e-6),
    `deu ${r.segurando.toFixed(4)}`);
  conferir("e o IL é um número, não um palpite", isFinite(r.il));
  conferir("o resultado soma as taxas", perto(r.resultado, r.il + 0.0450, 1e-9));
}

// ---------------------------------------------------------------------------
titulo("Sem composição não há conta — e ela DIZ isso");

{
  const r = contaDoIL([aporte(1, 100), { tipo: "aporte", valor: 50 }], posicao(1, 100, 100, 0));
  conferir("um aporte sem composição já para a conta", r.faltando === 1,
    "IL estimado por cima é pior que IL nenhum: tem cara de resposta");
  conferir("e não devolve número nenhum", r.il === undefined);

  conferir("empréstimo não tem IL", contaDoIL([aporte(1, 100)], { tipo: "emprestimo" }) === null,
    "um ativo só não rebalanceia contra nada");
  conferir("sem posição lida, não inventa", contaDoIL([aporte(1, 100)], null) === null);
  conferir("sem preço, não inventa", contaDoIL([aporte(1, 100)], posicao(1, 100, 0, 0)) === null);
  conferir("sem lançamento nenhum, não inventa",
    contaDoIL([], posicao(1, 100, 100, 0)) === null);
  conferir("colheita não entra na composição",
    contaDoIL([aporte(1, 100), { tipo: "colheita", valor: 5 }], posicao(1, 100, 100, 0)).faltando === 0,
    "colher tira taxa do pendente, não muda o que ele pôs na pool");
}

// ---------------------------------------------------------------------------
titulo("A posição FECHADA: quanto ele ficou quando saiu");

{
  /* A conta muda quando não há mais nada dentro. Na aberta eu comparo o que
   * está na pool contra segurar; na fechada, o que ELE RECEBEU contra segurar
   * — as duas ao preço do fechamento, que é o único instante em que as duas
   * existem lado a lado.
   *
   * Caso construído pra conferir de cabeça: pôs 1 SOL + 100 USDC com SOL a
   * 100 (US$ 200). Fechou com SOL a 144, recebendo 0,8 SOL + 120 USDC
   * (US$ 235,20). Colheu US$ 12 de taxa no caminho.
   *
   *   segurando  1 x 144 + 100  = 244,00
   *   recebido   0,8 x 144 + 120 = 235,20
   *   IL                          -8,80
   *   resultado  -8,80 + 12      = +3,20   (as taxas cobriram) */
  const movs = [
    { tipo: "aporte", valor_usd: 200, qtd_a: 1, qtd_b: 100, preco: 100, simbolo_a: "SOL", simbolo_b: "USDC" },
    { tipo: "colheita", valor_usd: 12 },
    { tipo: "saque", valor_usd: 235.2, qtd_a: 0.8, qtd_b: 120, preco: 144, simbolo_a: "SOL", simbolo_b: "USDC" },
  ];
  const r = contaDoFechamento(movs);

  conferir("a conta sai", r.faltando === 0);
  conferir("segurando valeria 244", perto(r.segurando, 244, 1e-9));
  conferir("ele recebeu o equivalente a 235,20", perto(r.recebidoEmTokens, 235.2, 1e-9));
  conferir("IL de -8,80", perto(r.il, -8.8, 1e-9));
  conferir("colheu 12", perto(r.colhido, 12, 1e-9));
  conferir("resultado +3,20: as taxas cobriram o IL", perto(r.resultado, 3.2, 1e-9),
    "é a pergunta que decide se valeu a pena ter feito a pool");

  /* E o LUCRO EM DÓLAR, que é a outra pergunta e dá outro número. */
  conferir("o lucro em dólar é +47,20", perto(r.lucro, 47.2, 1e-9),
    "ganhou dinheiro (+47,20) E ganhou mais que segurando (+3,20) — duas contas");
  conferir("e os dois números são diferentes", !perto(r.lucro, r.resultado, 1),
    "confundir um com o outro é o erro fácil aqui");
}

{
  /* O caso em que as taxas NÃO cobriram: mesma pool, só US$ 2 de taxa. */
  const r = contaDoFechamento([
    { tipo: "aporte", valor_usd: 200, qtd_a: 1, qtd_b: 100, preco: 100 },
    { tipo: "colheita", valor_usd: 2 },
    { tipo: "saque", valor_usd: 235.2, qtd_a: 0.8, qtd_b: 120, preco: 144 },
  ]);
  conferir("com pouca taxa, segurar teria sido melhor", r.resultado < 0);
  conferir("mesmo tendo lucro em dólar", r.lucro > 0,
    "ganhou dinheiro e ainda assim perdeu pra quem só segurou — é o que o método quer que ele veja");
}

{
  /* Saída parcelada: dois saques. O preço do fechamento é o do ÚLTIMO. */
  const r = contaDoFechamento([
    { tipo: "aporte", valor_usd: 200, qtd_a: 1, qtd_b: 100, preco: 100 },
    { tipo: "saque", valor_usd: 100, qtd_a: 0.5, qtd_b: 50, preco: 110 },
    { tipo: "saque", valor_usd: 130, qtd_a: 0.4, qtd_b: 60, preco: 120 },
  ]);
  conferir("soma o que ele pôs", perto(r.postosA, 1, 1e-9));
  conferir("e usa o preço do último saque", perto(r.preco, 120, 1e-9),
    "é o instante em que ele terminou de sair");
}

{
  conferir("sem saque nenhum, não é fechamento",
    contaDoFechamento([{ tipo: "aporte", valor_usd: 100, qtd_a: 1, qtd_b: 0, preco: 100 }]) === null);
  conferir("sem aporte também não", contaDoFechamento([{ tipo: "saque", valor_usd: 100 }]) === null);
  conferir("lista vazia", contaDoFechamento([]) === null);

  /* Sem composição, o LUCRO EM DÓLAR ainda sai — ele não depende de token. */
  const semComp = contaDoFechamento([
    { tipo: "aporte", valor_usd: 200 },
    { tipo: "saque", valor_usd: 240 },
  ]);
  conferir("sem composição, ainda diz o lucro em dólar", perto(semComp.lucro, 40, 1e-9),
    "não ter IL não é motivo pra esconder o que dá pra saber");
  conferir("mas avisa que falta pro IL", semComp.faltando > 0);
  conferir("e não inventa IL", semComp.il === undefined);
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
