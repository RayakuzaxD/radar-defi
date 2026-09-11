/* O custo de recolher, contra o que há pra recolher.
 *
 *   node testar-recolher.js
 *
 * ---------------------------------------------------------------------------
 * DE ONDE VEM O GABARITO
 *
 * Da tabela fechada da página 3 do relatório "APR vs APY" (Defiverso,
 * julho/2026) — US$ 1.000 a 10%, e o saldo depois de um ano:
 *
 *   nenhuma composição   US$ 1.100,00   APY 10,00%
 *   mensal               US$ 1.104,71   APY 10,47%
 *   semanal              US$ 1.105,06   APY 10,51%
 *   diária               US$ 1.105,16   APY 10,52%
 *
 * E da regra da página 5, item 4, que é o motivo de tudo isto existir:
 *
 *   "cada reinvestimento paga taxa de rede. Em posições pequenas, reinvestir
 *    todo dia pode custar mais do que o ganho extra."
 *
 * O custo da rede foi MEDIDO, não estimado: 19 transações bem-sucedidas do
 * programa da Orca em 11/09/2026, mediana de 55.678 unidades de computação e
 * 7.011 lamports de taxa efetivamente paga.
 */

import {
  aprParaApy, quandoRecolher, recolherVale, COLETAS_POR_ANO, PISO_DE_COLETA_MEU,
} from "./src/metodo.js";
import {
  custoDeUmaColeta, TAXA_BASE_LAMPORTS, UNIDADES_DE_UMA_COLETA_MEDIDO,
} from "./src/solana.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log("  ok   " + oQue); }
  else { falhou++; console.log("  FALHOU  " + oQue + (det ? " — " + det : "")); }
}
const titulo = (t) => console.log("\n" + t);
const perto = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

/* ------------------------------------------------------------------------ */
titulo("A TABELA DA PÁGINA 3, linha por linha");
{
  /* Arredondada a duas casas, como o relatório mostra. */
  const casos = [[1, 10.00, 1100.00], [12, 10.47, 1104.71],
    [52, 10.51, 1105.06], [365, 10.52, 1105.16]];
  for (const [n, apyAlvo, saldoAlvo] of casos) {
    const apy = aprParaApy(10, n);
    conferir("compondo " + n + "x ao ano, o APY é " + apyAlvo + "%",
      perto(Number(apy.toFixed(2)), apyAlvo), apy.toFixed(4) + "%");
    conferir("e US$ 1.000 viram US$ " + saldoAlvo.toFixed(2),
      perto(Number((1000 * (1 + apy / 100)).toFixed(2)), saldoAlvo),
      (1000 * (1 + apy / 100)).toFixed(2));
  }
  conferir("compor uma vez por ano é o próprio APR, sem mágica",
    perto(aprParaApy(10, 1), 10));
}

/* ------------------------------------------------------------------------ */
titulo("O QUE A FREQUÊNCIA COMPRA É SÓ O JURO SOBRE JURO");
{
  /* O erro fácil — e que eu quase cometi — é comparar as taxas acumuladas
     inteiras com o custo de recolher. As taxas vão ser recolhidas de um jeito
     ou de outro, nem que seja ao fechar a posição. O que a FREQUÊNCIA compra é
     só o pedacinho composto, e é ele que tem de pagar a rede. */
  const r = quandoRecolher({ valor: 1000, aprPct: 10, custoPorColeta: 0 });
  const anual = r.linhas.find((l) => l.n === 1);
  const diaria = r.linhas.find((l) => l.n === 365);
  conferir("recolher uma vez ao ano não compra extra nenhum",
    perto(anual.extra, 0), anual.extra.toFixed(6));
  conferir("recolher todo dia compra US$ 5,16, e não US$ 105,16",
    perto(Number(diaria.extra.toFixed(2)), 5.16), diaria.extra.toFixed(4));
  conferir("o juro simples de referência é US$ 100", perto(r.simples, 100));
}

/* ------------------------------------------------------------------------ */
titulo("A FRASE DA PÁGINA 5 VIRA CONTA: posição pequena, rede cara");
{
  /* O caso que o relatório descreve com palavras. US$ 20 numa pool a 10%:
     o extra de compor todo dia é cerca de US$ 0,10 no ano inteiro, e 365
     coletas a US$ 0,0016 custam US$ 0,58. Recolher todo dia custaria quase
     seis vezes o que compra. */
  const r = quandoRecolher({ valor: 20, aprPct: 10, custoPorColeta: 0.0016 });
  const diaria = r.linhas.find((l) => l.n === 365);
  conferir("em posição pequena, recolher todo dia fica no vermelho",
    diaria.liquido < 0, "US$ " + diaria.liquido.toFixed(4));
  conferir("e a melhor frequência NÃO é a diária",
    r.melhor.n !== 365, r.melhor.nome);

  /* E O OUTRO LADO DA MESMA CONTA, com uma lição no meio.
   *
   * A primeira versão desta conferência usava o custo de rede do p75
   * (US$ 0,0016) e exigia que a DIÁRIA ganhasse. Ela passava — por dois
   * centavos. A US$ 0,0016 a coleta, numa posição de US$ 500 a 30%, a semanal
   * rende US$ 24,28 líquidos e a diária US$ 24,26: a semanal ganha, e a
   * conferência só passava porque eu tinha usado um valor de posição em que o
   * empate caía do outro lado.
   *
   * O teste agora guarda o que é VERDADE: com a rede barata a composição
   * frequente compensa, e QUAL das frequentes ganha é decidido por centavos.
   * Fingir uma vencedora clara aqui seria transformar ruído em veredito. */
  const barata = quandoRecolher({ valor: 500, aprPct: 30, custoPorColeta: 0.0005 });
  const d365 = barata.linhas.find((l) => l.n === 365);
  const d52 = barata.linhas.find((l) => l.n === 52);
  const d1 = barata.linhas.find((l) => l.n === 1);
  conferir("com a rede barata, compor sempre bate não compor",
    d365.liquido > d1.liquido && d365.liquido > 0,
    "US$ " + d365.liquido.toFixed(2) + " contra US$ " + d1.liquido.toFixed(2));
  conferir("e a diária e a semanal ficam a menos de um dólar uma da outra",
    Math.abs(d365.liquido - d52.liquido) < 1,
    "US$ " + Math.abs(d365.liquido - d52.liquido).toFixed(2) + " de diferença");

  /* A mesma posição com a rede no p75: a semanal passa na frente. É a regra do
     relatório funcionando na margem, e não só no caso extremo. */
  const p75 = quandoRecolher({ valor: 500, aprPct: 30, custoPorColeta: 0.0016 });
  conferir("no p75 da rede, a semanal passa a diária", p75.melhor.n === 52,
    p75.melhor.nome + ", US$ " + p75.melhor.liquido.toFixed(2));

  /* E O TERCEIRO CASO, que é o que impede a função de ser um carimbo: rede
     CARA o bastante vira o jogo mesmo com o dinheiro dele. Sem esta linha,
     "a diária ganha" passaria a ser resposta fixa disfarçada de conta. */
  const cara = quandoRecolher({ valor: 500, aprPct: 30, custoPorColeta: 0.10 });
  conferir("rede cara vira o jogo até na posição maior",
    cara.melhor.n !== 365, cara.melhor.nome);
}

/* ------------------------------------------------------------------------ */
titulo("Empate desfeito pela MENOR frequência");
{
  /* Mexer menos é o padrão: quando dois caminhos dão o mesmo dinheiro, o que
     pede menos clique dele ganha. */
  const r = quandoRecolher({ valor: 1000, aprPct: 10, custoPorColeta: 0 });
  const mensal = r.linhas.find((l) => l.n === 12);
  const empatado = quandoRecolher({
    valor: 1000, aprPct: 10,
    custoPorColeta: r.linhas.find((l) => l.n === 365).extra / 365,
  });
  conferir("com o custo comendo exatamente o extra da diária, a diária não ganha",
    empatado.melhor.n !== 365, empatado.melhor.nome);
  conferir("a linha mensal continua trazendo o seu APY junto",
    perto(Number(mensal.apy.toFixed(2)), 10.47), mensal.apy.toFixed(4));
}

/* ------------------------------------------------------------------------ */
titulo("O CUSTO DA REDE, medido e não chutado");
{
  /* Sem prioridade nenhuma sobra a taxa base, que é regra da rede. */
  const calma = custoDeUmaColeta({ microLamportsPorUnidade: 0, precoDoSol: 99.62 });
  conferir("rede calma cobra só a taxa base de 5.000 lamports",
    calma.lamports === TAXA_BASE_LAMPORTS, String(calma.lamports));
  conferir("que dão 0,000005 SOL", perto(calma.sol, 5e-6));
  conferir("e meio milésimo de dólar a US$ 99,62 o SOL",
    perto(Number(calma.dolar.toFixed(5)), 0.0005), calma.dolar.toFixed(6));

  /* A PROVA DE QUE A CONTA BATE COM A REALIDADE: com a prioridade mediana de
     0 medida em 11/09/2026, a conta dá 5.000 lamports e as 19 transações
     reais da Orca pagaram 7.011 de mediana. Mesma ordem de grandeza — que é
     tudo que se pode prometer com uma cauda desta. */
  conferir("e fica na ordem de grandeza dos 7.011 lamports realmente pagos",
    calma.lamports > 7011 / 3 && calma.lamports < 7011 * 3, String(calma.lamports));

  const congestionada = custoDeUmaColeta({
    microLamportsPorUnidade: 200000, precoDoSol: 99.62,
  });
  conferir("com a rede no p75, a prioridade soma sobre a base",
    congestionada.lamports > calma.lamports,
    congestionada.lamports.toFixed(0) + " contra " + calma.lamports);
  conferir("e ainda assim são frações de centavo",
    congestionada.dolar < 0.01, "US$ " + congestionada.dolar.toFixed(5));
  conferir("as unidades de computação padrão são as medidas na Orca",
    congestionada.unidades === UNIDADES_DE_UMA_COLETA_MEDIDO);
  conferir("sem preço do SOL não se inventa dólar",
    custoDeUmaColeta({}).dolar === null);
}

/* ------------------------------------------------------------------------ */
titulo("Quanto tem pra recolher, contra o que recolher custa");
{
  const folgado = recolherVale(2.50, 0.0016);
  conferir("US$ 2,50 de taxa pagam a coleta mais de mil vezes",
    folgado.quantasVezes > 1000, folgado.quantasVezes.toFixed(0) + "x");
  conferir("e isso não é apertado", folgado.apertado === false);

  const apertado = recolherVale(0.05, 0.0016);
  conferir("US$ 0,05 pagam a coleta só 31 vezes",
    Math.round(apertado.quantasVezes) === 31, apertado.quantasVezes.toFixed(1));
  conferir("e isso é apertado, porque o piso é " + PISO_DE_COLETA_MEU + "x",
    apertado.apertado === true);
  conferir("o piso está marcado como escolha minha, não do material",
    PISO_DE_COLETA_MEU === 100);
}

/* ------------------------------------------------------------------------ */
titulo("Entrada estragada não vira conta");
{
  conferir("sem valor", quandoRecolher({ valor: 0, aprPct: 10, custoPorColeta: 0 }) === null);
  conferir("APR zero não compõe nada",
    quandoRecolher({ valor: 100, aprPct: 0, custoPorColeta: 0 }) === null);
  conferir("APR negativo", quandoRecolher({ valor: 100, aprPct: -5, custoPorColeta: 0 }) === null);
  conferir("custo negativo", quandoRecolher({ valor: 100, aprPct: 10, custoPorColeta: -1 }) === null);
  conferir("APY com frequência menor que uma vez ao ano", aprParaApy(10, 0) === null);
  conferir("APY sem número", aprParaApy(null, 12) === null);
  conferir("custo zero não vira divisão por zero", recolherVale(1, 0) === null);
  conferir("taxa negativa", recolherVale(-1, 0.01) === null);
  conferir("são quatro frequências, e a diária é a última",
    COLETAS_POR_ANO.length === 4 && COLETAS_POR_ANO[3].n === 365);
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
