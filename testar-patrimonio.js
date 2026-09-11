/* O rendimento do patrimônio, e a regra que ele deu como requisito.
 *
 *   node testar-rendimento.js
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO GUARDA
 *
 * Uma frase dele, de 11/09/2026, e ela é falsificável — dá pra escrever um
 * teste que passa ou falha:
 *
 *   "vi vários lugares contando novos aportes como rendimento, isso não faz
 *    sentido. Novo aporte é só novo aporte; o rendimento dele inicia da data
 *    que foi colocado na caixinha pra frente."
 *
 * Traduzida: UM APORTE, DE QUALQUER TAMANHO, EM QUALQUER DATA, MUDA O RETORNO
 * EM EXATAMENTE ZERO. É o primeiro bloco daqui, e é o teste que importa.
 *
 * Os outros existem porque eu já errei antes por causa deles: a colheita
 * (receita 3.4 — colher não é sacar), a reconstrução que anda pra trás, e a
 * porcentagem, que é onde a conta certa em dólar vira conta errada em %.
 */

import {
  fluxoExterno, mexeNaQuantidade, quantidadeNaData, valorNaData,
  rendimentoDoPeriodo, lucroDesdeOComeco, JANELAS,
} from "./src/patrimonio.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log("  ok   " + oQue); }
  else { falhou++; console.log("  FALHOU  " + oQue + (det ? " — " + det : "")); }
}
const titulo = (t) => console.log("\n" + t);
const perto = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

/* ------------------------------------------------------------------------ */
titulo("A REGRA DELE: aporte não é rendimento");
{
  /* Mercado PARADO a semana inteira. Ele deposita US$ 500 no meio.
     A conta errada — que é a que os apps fazem — diria +50%. */
  const parado = [
    { dia: "2026-09-01", valor: 1000, fluxo: 0 },
    { dia: "2026-09-02", valor: 1000, fluxo: 0 },
    { dia: "2026-09-03", valor: 1500, fluxo: 500 },
    { dia: "2026-09-04", valor: 1500, fluxo: 0 },
  ];
  const r = rendimentoDoPeriodo(parado);
  conferir("mercado parado + aporte de 500 = lucro ZERO em dólar",
    perto(r.lucro, 0), "US$ " + r.lucro.toFixed(6));
  conferir("e retorno ZERO por cento — não +50%",
    perto(r.pct, 0), r.pct.toFixed(9) + "%");
  conferir("o aporte é contado e MOSTRADO, não escondido",
    perto(r.aportes, 500));

  /* O TAMANHO DO APORTE NÃO PODE IMPORTAR. Se importar, a fórmula está errada
     de um jeito que só aparece em número grande — e número grande é o dia em
     que ele mais vai olhar. */
  for (const quanto of [1, 500, 100000, 1e7]) {
    const s = [
      { dia: "2026-09-01", valor: 1000, fluxo: 0 },
      { dia: "2026-09-02", valor: 1000 + quanto, fluxo: quanto },
      { dia: "2026-09-03", valor: 1000 + quanto, fluxo: 0 },
    ];
    conferir("aporte de " + quanto + " continua dando 0%",
      perto(rendimentoDoPeriodo(s).pct, 0, 1e-9),
      rendimentoDoPeriodo(s).pct.toExponential(3));
  }

  /* E O SAQUE, do outro lado: tirar dinheiro não é prejuízo. */
  const sacou = [
    { dia: "2026-09-01", valor: 1000, fluxo: 0 },
    { dia: "2026-09-02", valor: 300, fluxo: -700 },
    { dia: "2026-09-03", valor: 300, fluxo: 0 },
  ];
  const rs = rendimentoDoPeriodo(sacou);
  conferir("sacar 700 num mercado parado não é prejuízo",
    perto(rs.lucro, 0) && perto(rs.pct, 0), rs.lucro + " / " + rs.pct);
}

/* ------------------------------------------------------------------------ */
titulo("O DINHEIRO NOVO RENDE A PARTIR DA DATA DELE, e não antes");
{
  /* Duas semanas. Na primeira o mercado sobe 10% e ele tem 1000.
     No começo da segunda ele aporta 1000, e a segunda sobe 10% também.
     O RETORNO é 21% (1,1 × 1,1), porque é assim que o dinheiro se comportou.
     O LUCRO em dólar é 100 na primeira + 220 na segunda = 320. */
  const s = [
    { dia: "d0", valor: 1000, fluxo: 0 },
    { dia: "d1", valor: 1100, fluxo: 0 },
    { dia: "d2", valor: 2100, fluxo: 1000 },
    { dia: "d3", valor: 2310, fluxo: 0 },
  ];
  const r = rendimentoDoPeriodo(s);
  conferir("o retorno é 21%, o do MERCADO — não diluído pelo aporte",
    perto(r.pct, 21, 1e-9), r.pct.toFixed(6) + "%");
  conferir("e o lucro em dólar é 310", perto(r.lucro, 310), r.lucro.toFixed(2));

  /* AS DUAS RESPOSTAS SÃO DIFERENTES E AS DUAS ESTÃO CERTAS. O dólar sabe que
     ele tinha mais dinheiro na parte que subiu; a porcentagem não, e nem
     deveria — ela mede o mercado, não o tamanho da aposta. Mostrar só uma das
     duas é que seria mentir por omissão. */
  conferir("310 de lucro sobre 21% de retorno não é contradição",
    r.lucro > 0 && r.pct > 0 && r.lucro !== r.pct);
}

/* ------------------------------------------------------------------------ */
titulo("COLHER NÃO É APORTAR (receita 3.4)");
{
  conferir("aporte é dinheiro de fora, positivo",
    fluxoExterno({ tipo: "aporte", valor_usd: 100 }) === 100);
  conferir("saque é dinheiro de fora, negativo",
    fluxoExterno({ tipo: "saque", valor_usd: 100 }) === -100);
  conferir("COLHEITA NÃO É dinheiro de fora",
    fluxoExterno({ tipo: "colheita", valor_usd: 100 }) === 0);

  /* Mas ela MEXE na quantidade — as moedas chegaram mesmo. São duas perguntas
     diferentes, e o arquivo responde as duas separadamente de propósito. */
  conferir("e mesmo assim a colheita mexe na quantidade",
    mexeNaQuantidade({ tipo: "colheita", valor_usd: 100 }) === 100);
  conferir("o saque mexe pro outro lado",
    mexeNaQuantidade({ tipo: "saque", valor_usd: 100 }) === -100);

  /* O TESTE QUE IMPORTA: colher US$ 50 de taxa aparece como LUCRO, e não some.
     "O momento em que o usuário realiza o lucro vira o momento em que a
     ferramenta diz que não houve nenhum" — é o erro que a receita 3.4 descreve,
     e aqui ele seria cometido se a colheita entrasse como fluxo. */
  const colheu = [
    { dia: "d0", valor: 1000, fluxo: 0 },
    { dia: "d1", valor: 1050, fluxo: 0 }, // 50 de taxa recolhida, fluxo ZERO
  ];
  const r = rendimentoDoPeriodo(colheu);
  conferir("colher 50 de taxa aparece como lucro de 50",
    perto(r.lucro, 50), r.lucro.toFixed(2));
  conferir("e como 5% de retorno", perto(r.pct, 5), r.pct.toFixed(4));
}

/* ------------------------------------------------------------------------ */
titulo("A RECONSTRUÇÃO ANDA PRA TRÁS");
{
  /* Ele tem 2 BTC hoje. Comprou US$ 10.000 em BTC no dia 05, quando o BTC
     estava a US$ 50.000 — ou seja, 0,2 BTC. Logo, no dia 01 ele tinha 1,8. */
  const precos = { "2026-09-05": 50000, "2026-09-01": 40000 };
  const precoEm = (d) => precos[d];
  const movs = [{ tipo: "aporte", valor_usd: 10000, quando: "2026-09-05" }];

  const q = quantidadeNaData(2, movs, precoEm, "2026-09-01");
  conferir("2 BTC hoje, menos os 0,2 comprados depois, dá 1,8 no dia 01",
    perto(q, 1.8), String(q));

  /* A CONVERSÃO É PELO PREÇO DO DIA DO LANÇAMENTO, e não pelo de hoje.
     Com o preço de hoje (40k no dia 01) daria 0,25 BTC e a resposta seria
     1,75 — errado, porque não foi isso que aquele dinheiro comprou. */
  conferir("e não 1,75, que é o que daria convertendo pelo preço errado",
    !perto(q, 1.75));

  /* A QUANTIDADE LANÇADA MANDA SOBRE A CONVERSÃO. Um aporte de US$ 10.000
     com qtd_a = 0,21 registrado desconta 0,21 — mesmo que o preço do dia
     dissesse 0,2. O 0,21 é o que ele comprou de fato (pagou melhor ou pior
     que o fechamento); o preço do dia é estimativa pra lançamento antigo que
     não anotou quantidade. */
  const exata = quantidadeNaData(2,
    [{ tipo: "aporte", valor_usd: 10000, qtd_a: 0.21, quando: "2026-09-05" }],
    precoEm, "2026-09-01");
  conferir("a quantidade lançada ganha da conversão pelo preço",
    perto(exata, 1.79), String(exata));
  conferir("e um saque com quantidade devolve as moedas",
    perto(quantidadeNaData(2,
      [{ tipo: "saque", valor_usd: 5000, qtd_a: 0.1, quando: "2026-09-05" }],
      precoEm, "2026-09-01"), 2.1));
  conferir("com quantidade lançada, nem precisa do preço do dia",
    perto(quantidadeNaData(2,
      [{ tipo: "aporte", valor_usd: 10, qtd_a: 0.5, quando: "2026-09-03" }],
      () => null, "2026-09-01"), 1.5));

  /* Movimento ANTES da data não mexe: já estava lá. */
  const antes = quantidadeNaData(2,
    [{ tipo: "aporte", valor_usd: 10000, quando: "2026-08-01" }], precoEm, "2026-09-01");
  conferir("movimento anterior à data não é descontado", perto(antes, 2));

  /* Sem preço do dia do movimento, não dá pra converter — e null faz a janela
     sumir, em vez de virar um número que parece certo. */
  conferir("sem preço do dia do lançamento, devolve null",
    quantidadeNaData(2, [{ tipo: "aporte", valor_usd: 1, quando: "2026-09-07" }],
      precoEm, "2026-09-01") === null);

  /* Quantidade negativa é história incompleta, não saldo. */
  conferir("história que dá quantidade negativa devolve null",
    quantidadeNaData(0.1, [{ tipo: "aporte", valor_usd: 10000, quando: "2026-09-05" }],
      precoEm, "2026-09-01") === null);
}

/* ------------------------------------------------------------------------ */
titulo("A CARTEIRA INTEIRA NUMA DATA, com os três tipos de linha");
{
  const precos = {
    "BTC:2026-09-01": 40000, "BTC:2026-09-11": 77000,
    "SOL:2026-09-01": 90, "SOL:2026-09-11": 99,
  };
  const precoEm = (t, d) => precos[t + ":" + d];
  const cambioEm = (d) => (d === "2026-09-01" ? 0.18 : 0.1931);

  const linhas = [
    { chave: "btc", token: "BTC", quantidade: 0.02 },
    { chave: "sol", token: "SOL", quantidade: 5 },
    { chave: "res", valor: 1000, moeda: "BRL" },
    { chave: "pool", posicao: "P1", valor_entrada: 200, data_entrada: "2026-09-08" },
  ];
  const movimentos = [];

  const hoje = valorNaData({ linhas, movimentos, precoEm, cambioEm }, "2026-09-11");
  conferir("hoje: 0,02 BTC + 5 SOL + R$1000 + pool de 200",
    perto(hoje, 0.02 * 77000 + 5 * 99 + 1000 * 0.1931 + 200),
    hoje.toFixed(2));

  /* NO DIA 01 A POOL NÃO EXISTIA — MAS O DINHEIRO DELA SIM.
     A primeira versão desta conferência exigia que a pool valesse ZERO no
     passado, e ela passava. Aí o bloco do remanejamento (acima) provou que
     isso fabrica lucro fantasma: pool aberta com dinheiro de dentro fazia o
     dinheiro sumir do passado e renascer no presente como rendimento. A pool
     não existia no dia 01; os 200 dólares dela, sem lançamento de fora,
     existiam — na carteira líquida. */
  const antes = valorNaData({ linhas, movimentos, precoEm, cambioEm }, "2026-09-01");
  conferir("no dia 01 a pool não existia, mas os 200 dela estavam na carteira",
    perto(antes, 0.02 * 40000 + 5 * 90 + 1000 * 0.18 + 200), antes.toFixed(2));

  /* E a linha em real usa o câmbio DO DIA, não o de hoje. */
  conferir("a reserva em real foi convertida pelo câmbio do dia 01",
    antes - (0.02 * 40000 + 5 * 90 + 200) > 179 &&
    antes - (0.02 * 40000 + 5 * 90 + 200) < 181);

  /* Posição já fechada some da data posterior ao fechamento. */
  const comFechada = [{ chave: "p", posicao: "P2", valor_entrada: 500,
    data_entrada: "2026-09-01", fechada_em: "2026-09-05" }];
  conferir("posição fechada não conta depois do fechamento",
    perto(valorNaData({ linhas: comFechada, movimentos: [], precoEm, cambioEm },
      "2026-09-11"), 0));
  conferir("mas contava antes de fechar",
    perto(valorNaData({ linhas: comFechada, movimentos: [], precoEm, cambioEm },
      "2026-09-03"), 500));

  /* Faltando um preço, a carteira inteira devolve null: meia carteira somada
     é pior que carteira nenhuma, porque parece um total. */
  conferir("sem preço de um token, o total é null",
    valorNaData({ linhas, movimentos, precoEm: () => null, cambioEm }, "2026-09-01") === null);
}

/* ------------------------------------------------------------------------ */
titulo("ABRIR UMA POOL NÃO É LUCRO — o remanejamento fica invisível");
{
  /* O caso real dele, em miniatura. Ontem: 210 USDC líquidos. Hoje: fundou uma
     pool com 200 desses USDC. A linha de USDC segue a cadeia e caiu pra 10
     SOZINHA — sem lançamento, porque remanejar não é aportar (receita 3.5).

     A reconstrução ingênua leria ontem como "10 de USDC e pool nenhuma" = 10,
     e hoje como 10 + 200 = 210: um lucro fantasma de 200 num dia em que nada
     rendeu. É o erro que ele pediu pra nunca cometer, de cabeça pra baixo —
     em vez de aporte virando lucro, remanejamento virando lucro. */
  const precoEm = () => 1;          // USDC: 1 dólar sempre
  const cambioEm = () => null;
  const linhas = [
    { chave: "usdc", token: "USDC", quantidade: 10 },
    { chave: "pool", posicao: "P1", valor_entrada: 200, data_entrada: "2026-09-11" },
  ];
  const ontem = valorNaData({ linhas, movimentos: [], precoEm, cambioEm }, "2026-09-10");
  const hoje = valorNaData({ linhas, movimentos: [], precoEm, cambioEm }, "2026-09-11");
  conferir("ontem a carteira já valia 210 — o dinheiro da pool estava no USDC",
    perto(ontem, 210), String(ontem));
  conferir("hoje vale os mesmos 210", perto(hoje, 210), String(hoje));
  conferir("e o rendimento do dia é ZERO, não +200",
    perto(rendimentoDoPeriodo([
      { dia: "2026-09-10", valor: ontem, fluxo: 0 },
      { dia: "2026-09-11", valor: hoje, fluxo: 0 },
    ]).lucro, 0));

  /* O OUTRO LADO: pool fundada com CAPITAL NOVO tem lançamento na chave dela
     ("desmontei 2 e coloquei capital novo"). Aí o dinheiro NÃO estava na
     carteira ontem — devolver a entrada ao passado contaria o capital novo
     duas vezes. */
  const movNovo = [{ chave: "pool2", tipo: "aporte", valor_usd: 150, quando: "2026-09-11" }];
  const linhas2 = [
    { chave: "usdc", token: "USDC", quantidade: 10 },
    { chave: "pool2", posicao: "P2", valor_entrada: 150, data_entrada: "2026-09-11" },
  ];
  const ontem2 = valorNaData({ linhas: linhas2, movimentos: movNovo, precoEm, cambioEm }, "2026-09-10");
  conferir("pool de capital novo NÃO é devolvida ao passado",
    perto(ontem2, 10), String(ontem2));
  conferir("porque o aporte dela é fluxo, e fluxo já é neutralizado na janela",
    perto(rendimentoDoPeriodo([
      { dia: "2026-09-10", valor: ontem2, fluxo: 0 },
      { dia: "2026-09-11", valor: 160, fluxo: 150 },
    ]).lucro, 0));

  /* E a MISTURA: entrada de 200, sendo 150 de fora e o resto de dentro. Só os
     50 de dentro voltam ao passado. */
  const linhas3 = [
    { chave: "usdc", token: "USDC", quantidade: 10 },
    { chave: "pool3", posicao: "P3", valor_entrada: 200, data_entrada: "2026-09-11" },
  ];
  const mov3 = [{ chave: "pool3", tipo: "aporte", valor_usd: 150, quando: "2026-09-11" }];
  conferir("na mistura, só o pedaço de dentro volta ao passado",
    perto(valorNaData({ linhas: linhas3, movimentos: mov3, precoEm, cambioEm }, "2026-09-10"), 60));

  /* Posição que abriu E FECHOU depois da data não volta: o dinheiro dela já
     está de novo na quantidade líquida de hoje, e voltaria dobrado. */
  const linhas4 = [
    { chave: "usdc", token: "USDC", quantidade: 210 },
    { chave: "pool4", posicao: "P4", valor_entrada: 200,
      data_entrada: "2026-09-11", fechada_em: "2026-09-11" },
  ];
  conferir("posição já fechada não é devolvida ao passado",
    perto(valorNaData({ linhas: linhas4, movimentos: [], precoEm, cambioEm }, "2026-09-10"), 210));
}

/* ------------------------------------------------------------------------ */
titulo("O LUCRO DESDE O COMEÇO, que não precisa de história");
{
  const movs = [
    { tipo: "aporte", valor_usd: 1000, quando: "2025-02-24" },
    { tipo: "aporte", valor_usd: 500, quando: "2025-06-01" },
    { tipo: "saque", valor_usd: 200, quando: "2025-09-01" },
    { tipo: "colheita", valor_usd: 80, quando: "2026-01-01" },
  ];
  const r = lucroDesdeOComeco(2000, movs);
  conferir("o custo é 1000 + 500 − 200 = 1300", perto(r.custo, 1300));
  conferir("A COLHEITA NÃO ENTRA NO CUSTO — ela já está no valor de hoje",
    perto(r.aportes, 1500), "se entrasse, aportes seriam 1580");
  conferir("o lucro é 2000 − 1300 = 700", perto(r.lucro, 700));
  conferir("e isso são 53,8% sobre o que ele pôs",
    perto(Number(r.pct.toFixed(2)), 53.85), r.pct.toFixed(4));

  conferir("sem custo nenhum, a porcentagem é null e não infinito",
    lucroDesdeOComeco(100, []).pct === null);
}

/* ------------------------------------------------------------------------ */
titulo("Entrada estragada não vira número");
{
  conferir("série de um ponto só não é período",
    rendimentoDoPeriodo([{ dia: "d", valor: 1, fluxo: 0 }]) === null);
  conferir("série vazia", rendimentoDoPeriodo([]) === null);
  conferir("sem série", rendimentoDoPeriodo(null) === null);
  conferir("ponto sem valor derruba a janela inteira",
    rendimentoDoPeriodo([{ dia: "a", valor: 1 }, { dia: "b", valor: null }]) === null);
  conferir("carteira vazia no começo do dia não vira divisão por zero",
    Number.isFinite(rendimentoDoPeriodo([
      { dia: "a", valor: 0, fluxo: 0 }, { dia: "b", valor: 100, fluxo: 100 },
    ]).pct));
  conferir("e um dia começando em zero com aporte não inventa retorno",
    perto(rendimentoDoPeriodo([
      { dia: "a", valor: 0, fluxo: 0 }, { dia: "b", valor: 100, fluxo: 100 },
    ]).pct, 0));
  conferir("as quatro janelas do pedido dele estão lá",
    JANELAS.length === 4 && JANELAS.map((j) => j.chave).join(",") === "24h,1m,3m,1a");
}

/* ------------------------------------------------------------------------ */
titulo("NADA AQUI MANDA ELE FAZER NADA");
{
  const r = rendimentoDoPeriodo([
    { dia: "a", valor: 1000, fluxo: 0 }, { dia: "b", valor: 700, fluxo: 0 },
  ]);
  const texto = JSON.stringify(r);
  const ordem = /\b(saia|retire|feche|venda|compre|invista|deveria|recomendo|sugiro|melhor|ruim|bom)\b/i;
  conferir("uma queda de 30% sai como medida, sem veredito",
    !ordem.test(texto) && perto(r.pct, -30), (texto.match(ordem) || [""])[0]);
}

/* ------------------------------------------------------------------------ */
titulo("A CÓPIA DO NAVEGADOR É LITERAL (receita 5.3)");
{
  /* A conta roda em dois lugares: aqui (o módulo) e dentro de painel.js (o
     navegador não importa módulo). Quando a duplicação é obrigada, o teste
     obriga a concordar — e aqui a concordância é CARACTERE A CARACTERE, não
     comportamental: se alguém mexer na conta num lado só, este bloco fica
     vermelho na hora, e não três semanas depois num número que não fecha.

     Duas diferenças toleradas, as duas de forma e não de conteúdo: crase vira
     apóstrofo (painel.js é um template literal gigante e uma crase dentro
     dele mata a página inteira) e o fim de linha é normalizado (o Windows
     grava um arquivo em CRLF e o outro em LF, e isso não é a conta mudando). */
  const { readFileSync } = await import("node:fs");
  const semCR = (t) => t.split("\r").join("");
  const mod = semCR(readFileSync(new URL("./src/patrimonio.js", import.meta.url), "utf8"));
  const painel = semCR(readFileSync(new URL("./src/painel.js", import.meta.url), "utf8"));

  const CRASE = String.fromCharCode(96);
  const esperado = mod.slice(mod.indexOf("export const JANELAS"))
    .split("export ").join("")
    .split(CRASE).join("'");

  const ini = painel.indexOf("NAO EDITE AQUI");
  const fim = painel.indexOf("FIM DA COPIA DE src/patrimonio.js");
  conferir("os marcadores da cópia existem no painel", ini > 0 && fim > ini);
  const dentro = painel.slice(painel.indexOf("*/", ini) + 2,
    painel.lastIndexOf("/*", fim));

  conferir("a cópia é idêntica ao módulo, caractere a caractere",
    dentro.trim() === esperado.trim(),
    "tamanhos: painel " + dentro.trim().length + " × módulo " + esperado.trim().length);
  conferir("e não sobrou crase nenhuma dentro dela", !dentro.includes(CRASE));
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
