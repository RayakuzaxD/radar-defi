/* Prova o método B.A.R.C.A. contra a aula que o ensina.
 *
 *   node testar-barca.js
 *
 * A conferência mais importante daqui não é sobre número: é a que garante que
 * nenhuma frase manda o Rayakuza fazer alguma coisa. Alocação é a parte do método
 * mais perto de conselho de investimento, e o próprio autor recusa prescrever:
 *
 *     "Não é para você copiar, não é para você engessar o que está aqui. [...]
 *      As alocações e as porcentagens VOCÊ que vai definir."
 *
 * Se essas conferências ficarem vermelhas, o radar passou de mostrar pra mandar.
 */

import {
  REFERENCIA, POR_CICLO, QUANTOS_ATIVOS, REBALANCO,
  referenciaDoCiclo, quantosAtivos, lerDesvio, oQueACarteiraDiz,
} from "./src/barca.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);
const soma = (o) => Object.values(o).reduce((s, v) => s + v, 0);

// ---------------------------------------------------------------------------
titulo("As cinco caixinhas, e o que cada letra é");

conferir("são cinco", REFERENCIA.length === 5);
conferir("as letras formam BARCA",
  REFERENCIA.map((r) => r.letra).join("") === "BARCA");
conferir("B é Bitcoin", REFERENCIA[0].o_que === "Bitcoin");
conferir("C é stablecoin", REFERENCIA.find((r) => r.letra === "C").o_que === "stablecoins");
conferir("o segundo A é airdrop", REFERENCIA[4].o_que === "airdrops");

// ---------------------------------------------------------------------------
titulo("A divisão do slide soma 100");

{
  const total = REFERENCIA.reduce((s, r) => s + r.pct, 0);
  conferir("50+20+15+10+5 = 100", total === 100, `saiu ${total}`);
  /* A transcrição ouviu "aprender 10%", o que daria 105. Mais adiante ele diz
   * três vezes "esse 5%" falando de airdrop. Corrigi pela aritmética. */
  conferir("aprender é 5%, não 10%",
    REFERENCIA.find((r) => r.chave === "aprender").pct === 5,
    "com 10 a soma daria 105, e ele repete 'esse 5%' três vezes na aula");
  conferir("renda passiva é 15%, batendo com o POOLIANA",
    REFERENCIA.find((r) => r.chave === "renda").pct === 15,
    "o código dele chamava a parcela de LP de 'o 15% BARCA'");
}

// ---------------------------------------------------------------------------
titulo("As duas variações de ciclo também somam 100");

conferir("bear soma 100", soma(POR_CICLO.bear) === 100, `saiu ${soma(POR_CICLO.bear)}`);
conferir("bull soma 100", soma(POR_CICLO.bull) === 100, `saiu ${soma(POR_CICLO.bull)}`);

conferir("em bear tem MAIS bitcoin que em bull",
  POR_CICLO.bear.base > POR_CICLO.bull.base,
  "'em bear gosto de 50 a 60% em Bitcoin'");
conferir("em bear as altcoins vão quase a zero",
  POR_CICLO.bear.volatil <= 5,
  "'minha parcela de altcoins vai ser reduzida praticamente para zero'");
conferir("em bear o aprendizado vai a zero", POR_CICLO.bear.aprender === 0);
conferir("em bear a renda passiva é maior que em bull",
  POR_CICLO.bear.renda > POR_CICLO.bull.renda,
  "'vou ter uma renda passiva maior'");
conferir("em bull as altcoins crescem muito",
  POR_CICLO.bull.volatil >= POR_CICLO.bear.volatil * 3,
  "'começo a aumentar muito a minha parcela de ativos voláteis'");
conferir("em bull o bitcoin cai pra faixa de 30 a 40",
  POR_CICLO.bull.base >= 30 && POR_CICLO.bull.base <= 40,
  "'essa parcela de Bitcoin começa a cair para 40%, 30%'");
conferir("em bull o caixa fica entre 10 e 15",
  POR_CICLO.bull.caixa >= 10 && POR_CICLO.bull.caixa <= 15,
  "'em caixa costumo ter 10%, 15%'");

// ---------------------------------------------------------------------------
titulo("A referência acompanha o ciclo");

{
  const bear = referenciaDoCiclo("bear");
  conferir("em bear o bitcoin sobe pra 60",
    bear.find((r) => r.chave === "base").pct === 60);
  conferir("e a linha diz de onde veio o número",
    bear[0].deOnde.includes("bear"));

  const indef = referenciaDoCiclo("indefinido");
  conferir("ciclo indefinido cai na divisão do slide",
    indef.find((r) => r.chave === "base").pct === 50,
    "não fingir veredito que não tenho");
  conferir("e diz que é a do slide", indef[0].deOnde.includes("slide"));
}

// ---------------------------------------------------------------------------
titulo("Quantos ativos — e por que mais NÃO é melhor");

conferir("em bull, 8 a 12", quantosAtivos("bull").minimo === 8 && quantosAtivos("bull").maximo === 12);
conferir("em bear, 2 a 3", quantosAtivos("bear").minimo === 2 && quantosAtivos("bear").maximo === 3);
conferir("o risco volta a subir passando de 15", QUANTOS_ATIVOS.ondeORiscoVolta === 15,
  "'passou de 10 a 15 ativos, você começa a aumentar o seu risco'");
conferir("3 a 4 narrativas", QUANTOS_ATIVOS.narrativas.minimo === 3);
conferir("ciclo sem regra devolve null", quantosAtivos("indefinido") === null);

// ---------------------------------------------------------------------------
titulo("O desvio — a carteira dizendo o que fazer");

{
  conferir("dentro de 5 pontos é 'no alvo'",
    lerDesvio({ alvo: 20, pct: 23 }).estado === "no-alvo",
    "mexer na carteira por oscilação é pagar taxa pra ficar no mesmo lugar");
  conferir("5 pontos acima já conta",
    lerDesvio({ alvo: 20, pct: 25 }).estado === "acima");
  conferir("5 pontos abaixo também",
    lerDesvio({ alvo: 20, pct: 15 }).estado === "abaixo");
  conferir("o texto traz os dois números",
    lerDesvio({ alvo: 20, pct: 25 }).texto.includes("25.0%") &&
    lerDesvio({ alvo: 20, pct: 25 }).texto.includes("20%"));
  conferir("sem alvo não há desvio", lerDesvio({ pct: 25 }) === null,
    "sem alvo que ELE definiu, não há do que se afastar");
  conferir("o corte é de 5 pontos, o do exemplo da aula", REBALANCO.desvioQueImporta === 5);
}

// ---------------------------------------------------------------------------
titulo("O par que a aula descreve: caixa sobrando, altcoins faltando");

{
  /* O exemplo literal: caixa foi de 20 pra 25, altcoins de 20 pra 15. */
  const r = oQueACarteiraDiz([
    { fatia: "caixa", alvo: 20, pct: 25 },
    { fatia: "altcoins", alvo: 20, pct: 15 },
    { fatia: "bitcoin", alvo: 50, pct: 52 },
  ]);
  conferir("a caixa aparece como quem sobrou",
    r.recados.some((x) => x.fatia === "caixa" && x.estado === "acima"));
  conferir("e o recado nomeia quem está faltando",
    r.recados[0].texto.includes("altcoins"),
    "é assim que a aula ensina: 'pego o 5% de caixa, compro altcoins'");
  conferir("o bitcoin dentro da margem não vira recado",
    !r.recados.some((x) => x.fatia === "bitcoin"));
  conferir("não está equilibrada", r.equilibrada === false);
}

{
  const r = oQueACarteiraDiz([
    { fatia: "bitcoin", alvo: 50, pct: 51 },
    { fatia: "caixa", alvo: 10, pct: 9 },
  ]);
  conferir("carteira no alvo não gera recado", r.equilibrada === true);
  conferir("e ainda assim diz alguma coisa", r.resumo.length > 20,
    "ausência de recado é resposta, não silêncio");
}

conferir("carteira vazia não quebra", oQueACarteiraDiz([]).equilibrada === true);
conferir("lista ausente não quebra", oQueACarteiraDiz(null).equilibrada === true);

// ---------------------------------------------------------------------------
titulo("Nenhuma frase manda fazer nada");

{
  /* A conferência que dá nome ao arquivo. O autor do método recusa prescrever
   * — "não é para você copiar, não é para você engessar" — e o radar tem menos
   * direito ainda: eu não sou consultor de investimento do Rayakuza. */
  const cenarios = [
    [{ fatia: "caixa", alvo: 20, pct: 30 }, { fatia: "altcoins", alvo: 20, pct: 10 }],
    [{ fatia: "bitcoin", alvo: 50, pct: 70 }],
    [{ fatia: "aprender", alvo: 5, pct: 0 }],
  ];
  const PROIBIDO = /\b(compre|comprar|venda|vender|realoque|realocar|invista|tire|retire|aumente|diminua|recomendo|sugiro|deve comprar|deve vender)\b/i;
  let limpo = true, culpada = "";
  for (const c of cenarios) {
    for (const r of oQueACarteiraDiz(c).recados) {
      if (PROIBIDO.test(r.texto)) { limpo = false; culpada = r.texto; }
    }
    if (PROIBIDO.test(oQueACarteiraDiz(c).resumo)) { limpo = false; culpada = oQueACarteiraDiz(c).resumo; }
  }
  conferir("nenhum recado usa verbo de ordem", limpo, culpada);

  conferir("a referência é marcada como referência, nunca como alvo dele",
    referenciaDoCiclo("bull").every((r) => typeof r.deOnde === "string" && r.deOnde.length > 5),
    "número sem procedência vira ordem na cabeça de quem lê");
}

// ---------------------------------------------------------------------------
titulo("Quanto falta EM DINHEIRO para chegar no alvo");

{
  /* Pedido dele em 09/09/2026: "seria bom saber quanto exatamente preciso em
   * valores para chegar na % que ainda falta, aí sei quanto preciso pôr em
   * cada posição em relação de quanto tenho em dólar/reais".
   *
   * Ele está certo, e o motivo é prático: "24 pontos abaixo" não se
   * transfere. Ele não move pontos entre caixinhas, move dinheiro. */
  const { readFileSync } = await import("node:fs");
  const fonte = readFileSync("src/painel.js", "utf8");
  const i = fonte.indexOf("function faltaEmDinheiro(");
  if (i < 0) throw new Error("não achei faltaEmDinheiro em src/painel.js");
  let nivel = 0, j = fonte.indexOf("{", i), fim = -1;
  for (; j < fonte.length; j++) {
    if (fonte[j] === "{") nivel++;
    else if (fonte[j] === "}") { nivel--; if (nivel === 0) { fim = j + 1; break; } }
  }
  const { faltaEmDinheiro } = new Function(
    `${fonte.slice(i, fim)} return { faltaEmDinheiro: faltaEmDinheiro };`
  )();

  /* Uma carteira de exemplo: uma caixinha sobrando, duas faltando, uma vazia. */
  const TOTAL = 5000.0;
  const caixinhas = [
    { nome: "Base sólida",    tem: 3600, alvo: 60 },
    { nome: "Caixa",          tem: 1000, alvo: 10 },
    { nome: "Renda passiva",  tem: 350,  alvo: 25 },
    { nome: "Ativos voláteis", tem: 50,   alvo: 5 },
  ];

  const contas = caixinhas.map((c) => ({ ...c, falta: faltaEmDinheiro(TOTAL, c.tem, c.alvo) }));

  conferir("Base sólida, 72% contra alvo 60%: sobra dinheiro", contas[0].falta < 0);
  conferir("e sobram uns US$ 600", Math.abs(contas[0].falta + 600) < 1,
    `deu ${contas[0].falta.toFixed(2)}`);
  conferir("Renda passiva, 7% contra alvo 25%: falta dinheiro", contas[2].falta > 0);
  conferir("e faltam uns US$ 900", Math.abs(contas[2].falta - 900) < 1,
    `deu ${contas[2].falta.toFixed(2)} — é o número que se usa pra saber quanto pôr`);

  /* A PROPRIEDADE QUE FAZ A CONTA FECHAR, e é o motivo de ela ser de
     remanejamento: como os alvos dele somam 100%, o que sobra numa caixinha é
     exatamente o que falta nas outras. O dinheiro que sai de uma entra na
     outra, até o centavo. Se isto quebrar, o bloco estaria mandando ele tirar
     um valor e pôr outro diferente. */
  const somaDosAlvos = caixinhas.reduce((s, c) => s + c.alvo, 0);
  conferir("os alvos dele somam 100%", somaDosAlvos === 100);

  const sobras = contas.filter((c) => c.falta < 0).reduce((s, c) => s - c.falta, 0);
  const faltas = contas.filter((c) => c.falta > 0).reduce((s, c) => s + c.falta, 0);
  conferir("o que sobra é igual ao que falta", Math.abs(sobras - faltas) < 0.01,
    `sobras ${sobras.toFixed(2)} vs faltas ${faltas.toFixed(2)}`);

  /* Com alvos que NÃO somam 100 a conta não fecha, e isso é verdade sobre os
     alvos dele — não um defeito a esconder. */
  const outros = [
    faltaEmDinheiro(1000, 500, 50),
    faltaEmDinheiro(1000, 500, 30),
  ];
  conferir("alvo igual ao que tem dá zero", outros[0] === 0);
  conferir("alvo abaixo do que tem dá negativo", outros[1] < 0);

  // ---- as bordas que virariam número maluco na tela ----
  conferir("sem total, não há dinheiro que signifique nada",
    faltaEmDinheiro(0, 100, 25) === null);
  conferir("total negativo também", faltaEmDinheiro(-5, 100, 25) === null);
  conferir("sem alvo definido por ele, não inventa",
    faltaEmDinheiro(1000, 100, null) === null,
    "usar a referência do método como alvo seria decidir por ele");
  conferir("alvo vazio também", faltaEmDinheiro(1000, 100, "") === null);
  conferir("alvo que não é número", faltaEmDinheiro(1000, 100, "abacaxi") === null);
  conferir("caixinha vazia conta como zero, não quebra",
    faltaEmDinheiro(1000, null, 25) === 250);
}

// ---------------------------------------------------------------------------
titulo("A folga do alvo é proporcional, e é UMA regra só");

{
  /* DOIS DEFEITOS, e o segundo veio de eu ter consertado o primeiro pela
   * metade.
   *
   * 1. A tela dizia "Ativos voláteis · alvo 5% · no alvo" estando em 0,8%.
   *    Faltavam 84% do caminho. Cinco pontos de folga são pouco pra quem mira
   *    60% e são quase tudo pra quem mira 5%.
   *
   * 2. Consertei o cabeçalho da caixinha e esqueci do bloco de rebalanço. As
   *    duas metades da mesma tela passaram a discordar: uma dizia "faltam 4.2
   *    pontos (US$ 105,25)", a outra dizia "dentro dos 5 pontos, e por isso
   *    fora da lista". Ele reparou na hora: "cadê os ativos voláteis?".
   *
   * Duas cópias de uma regra são duas chances de consertar só uma. Agora é uma
   * função, e este teste existe pra ela não se dividir de novo. */
  const { readFileSync: ler } = await import("node:fs");
  const src = ler("src/painel.js", "utf8");
  const i = src.indexOf("function folgaDoAlvo(");
  if (i < 0) throw new Error("não achei folgaDoAlvo em src/painel.js");
  let n = 0, j = src.indexOf("{", i), fim = -1;
  for (; j < src.length; j++) {
    if (src[j] === "{") n++;
    else if (src[j] === "}") { n--; if (n === 0) { fim = j + 1; break; } }
  }
  const { folgaDoAlvo } = new Function(`${src.slice(i, fim)} return { folgaDoAlvo: folgaDoAlvo };`)();

  conferir("num alvo de 60%, a folga continua sendo 5 pontos", folgaDoAlvo(60) === 5,
    "um quarto de 60 são 15, então os 5 é que mandam");
  conferir("num alvo de 25%, também", folgaDoAlvo(25) === 5);
  conferir("num alvo de 20%, é exatamente 5", folgaDoAlvo(20) === 5);
  conferir("num alvo de 10%, cai pra 2,5", folgaDoAlvo(10) === 2.5);
  conferir("num alvo de 5%, cai pra 1,25", folgaDoAlvo(5) === 1.25,
    "o caso que motivou: 1% contra 5% fica FORA da folga, como tem que ficar");
  conferir("num alvo de 0%, a folga é zero", folgaDoAlvo(0) === 0);

  /* Uma carteira vista em porcentagens, e quem deve aparecer no bloco. */
  const dele = [
    { nome: "Base sólida", pct: 72.0, alvo: 60 },
    { nome: "Caixa", pct: 20.0, alvo: 10 },
    { nome: "Renda passiva", pct: 7.0, alvo: 25 },
    { nome: "Ativos voláteis", pct: 1.0, alvo: 5 },
    { nome: "Aprender", pct: 0.0, alvo: 0 },
  ];
  const fora = dele.filter((c) => Math.abs(c.pct - c.alvo) > folgaDoAlvo(c.alvo)).map((c) => c.nome);

  conferir("Ativos voláteis APARECE na lista", fora.indexOf("Ativos voláteis") >= 0,
    "é o que ele foi procurar e não achou");
  conferir("e as três de sempre também",
    ["Base sólida", "Caixa", "Renda passiva"].every((n) => fora.indexOf(n) >= 0));
  conferir("Aprender, no alvo de 0% com 0%, fica de fora", fora.indexOf("Aprender") < 0,
    "zero contra zero está no lugar, e não tem dinheiro nenhum a mover");
  conferir("são quatro fora do alvo", fora.length === 4);
}

// ---------------------------------------------------------------------------
titulo("Dinheiro NOVO precisa de mais que dinheiro remanejado");

{
  /* O ENGANO QUE ISTO EVITA, e ele quase caiu nele.
   *
   * Ele descreveu o uso: "se eu ponho X reais em tal caixinha fico com X% e
   * bate, aí consigo equilibrar meus APORTES". Aporte é dinheiro de fora — e
   * com dinheiro de fora a conta de remanejamento erra.
   *
   * Pondo os 900 que a conta de remanejamento diz, a Renda passiva desta
   * carteira vira 1.250 num total de 5.900: 21,2%, e não os 25% do alvo. Só se
   * descobriria depois de pôr o dinheiro. */
  const { readFileSync } = await import("node:fs");
  const fonte = readFileSync("src/painel.js", "utf8");
  const pegar = (nome) => {
    const i = fonte.indexOf(`function ${nome}(`);
    if (i < 0) throw new Error(`não achei ${nome}`);
    let n = 0, j = fonte.indexOf("{", i);
    for (; j < fonte.length; j++) {
      if (fonte[j] === "{") n++;
      else if (fonte[j] === "}") { n--; if (n === 0) return fonte.slice(i, j + 1); }
    }
    throw new Error(`${nome} não fecha`);
  };
  const { faltaEmDinheiro, aporteParaOAlvo } = new Function(
    `${pegar("faltaEmDinheiro")}\n${pegar("aporteParaOAlvo")}
     return { faltaEmDinheiro: faltaEmDinheiro, aporteParaOAlvo: aporteParaOAlvo };`
  )();

  const TOTAL = 5000.0, RENDA = 350, ALVO = 25;

  const remanejando = faltaEmDinheiro(TOTAL, RENDA, ALVO);
  const novo = aporteParaOAlvo(TOTAL, RENDA, ALVO);

  conferir("dinheiro novo é MAIOR que remanejado", novo > remanejando,
    `remanejando ${remanejando.toFixed(2)} vs novo ${novo.toFixed(2)}`);
  conferir("e são US$ 1.200", Math.abs(novo - 1200) < 0.05, `deu ${novo.toFixed(2)}`);

  /* A CONFERÊNCIA QUE VALE: pôr o dinheiro e ver se dá a porcentagem.
     Provar a fórmula contra ela mesma não provaria nada. */
  const chegou = (x) => ((RENDA + x) / (TOTAL + x)) * 100;
  conferir("pondo o valor de dinheiro novo, chega em 25%",
    Math.abs(chegou(novo) - ALVO) < 0.001, `chegou em ${chegou(novo).toFixed(2)}%`);
  conferir("pondo o valor de remanejamento como dinheiro novo, NÃO chega",
    Math.abs(chegou(remanejando) - ALVO) > 3,
    `chegaria em ${chegou(remanejando).toFixed(1)}% — o engano que a conta certa evita`);

  /* E remanejando (o total não muda), o valor de remanejamento acerta. */
  conferir("remanejando, o valor de remanejamento chega em 25%",
    Math.abs(((RENDA + remanejando) / TOTAL) * 100 - ALVO) < 0.001);

  /* Vale pra qualquer caixinha e qualquer alvo. */
  [[0, 5], [100, 40], [900, 60], [1500, 80]].forEach(([tem, alvo]) => {
    const x = aporteParaOAlvo(TOTAL, tem, alvo);
    if (x == null) return;
    const dep = ((tem + x) / (TOTAL + x)) * 100;
    conferir(`alvo ${alvo}% partindo de ${tem}: o aporte chega lá`,
      Math.abs(dep - alvo) < 0.001, `chegou em ${dep.toFixed(3)}%`);
  });

  // ---- quando não faz sentido, não inventa ----
  conferir("caixinha já ACIMA do alvo não se conserta pondo mais nela",
    aporteParaOAlvo(TOTAL, 3600, 60) === null,
    "aportar aumentaria ainda mais a fatia dela");
  conferir("alvo de 100% não se alcança aportando", aporteParaOAlvo(1000, 100, 100) === null,
    "dividiria por zero");
  conferir("alvo acima de 100% também", aporteParaOAlvo(1000, 100, 120) === null);
  conferir("alvo zero não tem aporte que faça sentido", aporteParaOAlvo(1000, 0, 0) === null);
  conferir("sem total, não inventa", aporteParaOAlvo(0, 10, 25) === null);
  conferir("sem alvo dele, não inventa", aporteParaOAlvo(1000, 10, null) === null);
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
