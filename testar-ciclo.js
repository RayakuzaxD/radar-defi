/* Prova a leitura de ciclo com séries construídas.
 *
 *   node testar-ciclo.js
 *
 * Os valores de referência vêm do mercado real em 06/09/2026:
 *   Bitcoin US$ 79.923, 14,6% acima da média de 200 dias, nesse lado há 19 dias
 *   (virou em 20/08/2026, com o Bitcoin a US$ 72.501)
 *   Estoque de stablecoin US$ 312,1 bi, +1,45% em 30 dias
 *   Distribuição de 3 anos da variação de 30 dias:
 *   p10 -0,62% · p25 +0,55% · mediana +2,12% · p75 +3,98% · p90 +6,37%
 *
 * Ou seja: naquele dia o preço dizia bull e o capital não confirmava. A leitura
 * certa era "indefinido", e metade destas conferências existe pra garantir que
 * ela continue saindo "indefinido" — porque a tentação de fazer o programa
 * sempre responder alguma coisa é o defeito que este arquivo previne.
 */

import {
  CICLO, mediaMovel, regimeDePreco, idadeDoRegime, fluxoDeCapital,
  lerCiclo, cicloEfetivo, cicloParaMeta, inclinacaoDaMedia, ladoDoRegime,
} from "./src/ciclo.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

/* Uma série plana de `n` pontos, e depois `m` pontos num degrau. Serve pra
 * colocar o preço numa distância exata da média: com 200 dias a 100 e depois
 * um salto, a média sobe devagar e dá pra prever de que lado o último ponto
 * cai. */
const plana = (n, v) => Array.from({ length: n }, () => v);

// ---------------------------------------------------------------------------
titulo("A média móvel exige a janela cheia");

conferir("199 pontos não viram média de 200", mediaMovel(plana(199, 100), 200) === null,
  "média de 140 dias chamada de 'média de 200 dias' é outro número com o nome do original");
conferir("200 pontos viram", mediaMovel(plana(200, 100), 200) === 100);
conferir("a média usa os ÚLTIMOS n, não os primeiros",
  mediaMovel([...plana(200, 1), ...plana(200, 50)], 200) === 50);
conferir("série vazia não quebra", mediaMovel([], 200) === null);
conferir("n zero não quebra", mediaMovel(plana(200, 100), 0) === null);
conferir("preço zero ou negativo invalida a janela",
  mediaMovel([...plana(199, 100), 0], 200) === null,
  "preço zero é falha de dado, e a média não pode diluí-lo na conta");

// ---------------------------------------------------------------------------
titulo("O regime de preço, e a banda morta de ±5%");

{
  const media = plana(200, 100);
  conferir("+14,6% acima da média é bull (o caso real de 06/09/2026)",
    regimeDePreco([...media, 114.6]).estado === "bull");
  conferir("-14,6% abaixo é bear", regimeDePreco([...media, 85.4]).estado === "bear");
  conferir("+3% é neutro, não bull", regimeDePreco([...media, 103]).estado === "neutro",
    "sem a banda, a linha tremeria toda vez que o preço encostasse na média");
  conferir("-3% é neutro, não bear", regimeDePreco([...media, 97]).estado === "neutro");
  conferir("exatamente +5% ainda é neutro (a banda é fechada)",
    regimeDePreco([...media, 105]).estado === "neutro");
  conferir("+5,1% já é bull", regimeDePreco([...media, 105.1]).estado === "bull");
}

{
  const r = regimeDePreco(plana(100, 100));
  conferir("sem 200 dias de preço o regime é 'sem-dado'", r.estado === "sem-dado");
  conferir("e diz o que falta", r.texto.includes("200 dias"),
    "'sem-dado' sem motivo é indistinguível de erro");
}

// ---------------------------------------------------------------------------
titulo("A idade do regime — 19 dias é diferente de 8 meses");

{
  /* 200 dias a 100, 30 dias de queda a 80, 19 dias a 130.
   *
   * A resposta é 8, não 19 — e a diferença é justamente o que o Rayakuza apontou
   * em 08/09/2026. Dos 19 dias em que o preço esteve acima da média, os 11
   * primeiros a média AINDA DESCIA (repique, lado de baixa) e só nos 8 últimos
   * ela virou pra cima (bull, lado de alta).
   *
   * Este teste já exigiu 19, de quando o eixo olhava só a posição do preço.
   * Aquele 19 era a medida afobada: contava como alta um período em que a
   * tendência longa ainda caía. */
  const serie = [...plana(200, 100), ...plana(30, 80), ...plana(19, 130)];
  const dias = idadeDoRegime(serie);
  conferir("conta os dias no mesmo LADO, não desde que o preço cruzou",
    dias === 8, `saiu ${dias}`);

  conferir("no começo da subida ainda era repique",
    regimeDePreco(serie.slice(0, 240)).estado === "repique",
    "preço acima de média que desce é repique, não virada");
  conferir("e só depois virou bull",
    regimeDePreco(serie).estado === "bull");
}

// ---------------------------------------------------------------------------
titulo("Repique: a correção que o Rayakuza trouxe em 08/09/2026");

{
  /* O caso real daquele dia: Bitcoin 13% acima da média de 200 dias, mas a
   * média caindo 0,58% em 30 dias, com topos e fundos descendentes. */
  const subindo = [...plana(200, 100), ...plana(30, 130)];
  /* Preço alto no passado, tombo, e um repique que passa da média — que
   * continua descendo porque ainda está digerindo os preços altos de meses
   * atrás. Média sai de 138,5 pra 131,1 (-5,3%) e o preço de 145 fica 10,6%
   * acima dela: exatamente a figura de 08/09/2026. */
  const caindo = [...plana(200, 140), ...plana(30, 80), ...plana(5, 145)];

  conferir("preço acima de média que SOBE é bull",
    regimeDePreco(subindo).estado === "bull");
  conferir("preço acima de média que CAI é repique",
    regimeDePreco(caindo).estado === "repique",
    "'teve uma leve subida e lateralização, mas ainda não se sustentou'");

  conferir("repique conta como lado de BAIXA", ladoDoRegime("repique") === "baixa");
  conferir("correção conta como lado de ALTA", ladoDoRegime("correcao") === "alta");

  conferir("a inclinação vira texto legível",
    /média está caindo/.test(regimeDePreco(caindo).texto),
    regimeDePreco(caindo).texto);
}

{
  const inc = inclinacaoDaMedia([...plana(200, 100), ...plana(30, 200)]);
  conferir("média puxada pra cima é lida como subindo", inc.sentido === "subindo");
  conferir("e a variação vem junto", inc.variacao > 0);
  conferir("série curta demais não devolve inclinação",
    inclinacaoDaMedia(plana(210, 100)) === null,
    "faltam 200 dias antes da janela de 30 pra comparar");
  conferir("média parada não é nem subindo nem caindo",
    inclinacaoDaMedia(plana(240, 100)).sentido === "parada");
}

{
  // Sobe, atravessa a banda (neutro) e volta a subir: a passagem pelo neutro
  // não zera a idade.
  const serie = [...plana(200, 100), ...plana(10, 80), 130, 103, 131, 132];
  const dias = idadeDoRegime(serie);
  conferir("passar pelo neutro não interrompe o regime", dias === 4, `saiu ${dias}`);
}

{
  const serie = [...plana(200, 100), ...plana(50, 130)];
  conferir("quando a série não alcança a virada, a idade é null (não se inventa)",
    idadeDoRegime(serie) === null,
    "'pelo menos 50 dias' seria idade que não medi apresentada como idade");
}

conferir("regime neutro não tem idade", idadeDoRegime([...plana(200, 100), 101]) === null);

// ---------------------------------------------------------------------------
titulo("O fluxo de capital — e por que 'positivo' não é sinal de nada");

{
  const base = plana(31, 300e9);
  const com = (pct) => [...base, 300e9 * (1 + pct / 100)];

  conferir("+1,45% em 30 dias é capital PARADO, não entrando (o caso real)",
    fluxoDeCapital(com(1.45)).estado === "parado",
    "a mediana de 3 anos é +2,12%: crescer 1,45% é crescer MENOS que o normal");
  conferir("+5% já é dinheiro entrando (acima do p75 de 3,98%)",
    fluxoDeCapital(com(5)).estado === "entrando");
  conferir("-1% é dinheiro saindo (encolher é o p10)",
    fluxoDeCapital(com(-1)).estado === "saindo");
  conferir("exatamente 0% é saindo (o estoque parou de crescer)",
    fluxoDeCapital(com(0)).estado === "saindo");

  const parado = fluxoDeCapital(com(1.45));
  conferir("e o texto do 'parado' avisa que positivo aqui é abaixo do normal",
    /abaixo do mês normal/.test(parado.texto),
    "sem esse aviso, +1,5% se lê como entrada de capital");
}

{
  conferir("31 pontos são o mínimo (30 dias + hoje)",
    fluxoDeCapital(plana(31, 300e9)).estado !== "sem-dado");
  conferir("30 pontos não bastam", fluxoDeCapital(plana(30, 300e9)).estado === "sem-dado");
  conferir("estoque zero no passado não divide por zero",
    fluxoDeCapital([0, ...plana(30, 300e9)]).estado === "sem-dado");
}

// ---------------------------------------------------------------------------
titulo("A leitura: os dois concordam, ou não há veredito");

const preco = (estado) => ({ estado, texto: `preço ${estado}` });
const capital = (estado) => ({ estado, texto: `capital ${estado}` });

conferir("bull + entrando = bull", lerCiclo(preco("bull"), capital("entrando")).ciclo === "bull");
conferir("bear + saindo = bear", lerCiclo(preco("bear"), capital("saindo")).ciclo === "bear");

{
  const r = lerCiclo(preco("bull"), capital("parado"));
  /* ERA "= INDEFINIDO". Nao existe ciclo indefinido: o mercado esta em bear
     ou em bull, e "nao sei qual" era o MEU estado, nao o dele. O que este
     teste sempre quis guardar continua guardado, e ate melhor — que o caso
     real de 06/09 seja RECONHECIDO como falta de consenso, em vez de virar um
     veredito confiante. */
  conferir("bull + parado = bear, marcado como sem consenso (o caso real de 06/09/2026)",
    r.ciclo === "bear" && r.semConsenso === true,
    "uma fórmula que sempre devolve resposta confiante esconderia este caso");
  conferir("e a firmeza nomeia o que está acontecendo",
    r.firmeza === "o preço virou, o capital ainda não confirmou");
}

{
  const r = lerCiclo(preco("bear"), capital("entrando"));
  conferir("bear + entrando = bear sem consenso, com o motivo do outro lado",
    r.ciclo === "bear" && r.semConsenso === true && r.firmeza.includes("capital está entrando"));
}

{
  const a = lerCiclo(preco("neutro"), capital("entrando"));
  conferir("neutro + entrando = bear sem consenso", a.ciclo === "bear" && a.semConsenso === true);
  const b = lerCiclo(preco("bull"), capital("sem-dado"));
  conferir("bull + sem-dado = bear sem consenso", b.ciclo === "bear" && b.semConsenso === true);

  /* E O CONTRARIO TEM QUE VALER: quando as duas concordam, NAO ha bandeira.
     Sem esta conferencia, marcar semConsenso em tudo passaria no teste — e a
     bandeira que vale sempre nao informa nada. */
  const firme = lerCiclo(preco("bull"), capital("entrando"));
  conferir("bull + entrando = bull, sem bandeira nenhuma",
    firme.ciclo === "bull" && !firme.semConsenso);
}
conferir("os dois eixos entram no 'porque'",
  lerCiclo(preco("bull"), capital("parado")).porque.length === 2,
  "o veredito sozinho é palavra que se aceita; os dois eixos são medida que se confere");

// ---------------------------------------------------------------------------
titulo("A escolha do Rayakuza manda — o botão não pode ser decorativo");

{
  const leitura = lerCiclo(preco("bull"), capital("parado")); // bear, sem consenso
  const auto = cicloEfetivo("auto", leitura);
  conferir("em 'auto' vale a medida", auto.ciclo === "bear" && auto.origem === "medido");
  /* Era "a meta de bear está valendo" — a meta saiu do radar (veja metodo.js:
     ela citava um documento que nao existe). O que continua importando e que
     'indefinido' nao fique sozinho: o texto tem que dizer qual lado esta sendo
     usado enquanto ele nao decide. */
  conferir("e o texto diz que as medidas ainda não concordam",
    /não concordam/i.test(auto.texto) && /bear/i.test(auto.texto), auto.texto.slice(0, 100));

  const dele = cicloEfetivo("bull", leitura);
  conferir("'bull' escolhido sobrepõe a medida", dele.ciclo === "bull" && dele.origem === "escolhido");
  conferir("a leitura continua junto, mesmo contrariada", dele.leitura === leitura,
    "esconder a medida faria a escolha envelhecer sem ele perceber");
}

{
  const bear = lerCiclo(preco("bear"), capital("saindo"));
  const dele = cicloEfetivo("bull", bear);
  conferir("quando a escolha contraria a medida, isso é anunciado", dele.discorda === true);
  conferir("mas a escolha continua valendo", dele.ciclo === "bull");

  conferir("concordar não vira aviso", cicloEfetivo("bear", bear).discorda === false);
  conferir("medida indefinida não contraria escolha nenhuma",
    cicloEfetivo("bull", lerCiclo(preco("bull"), capital("parado"))).discorda === false,
    "'indefinido' não é uma opinião contrária, é ausência de opinião");
}

conferir("valor estranho no banco cai em 'auto', não quebra",
  cicloEfetivo("talvez", null).origem === "medido");
/* Sem leitura nenhuma vale o lado conservador, e nao um terceiro estado. */
conferir("sem leitura nenhuma vale bear",
  cicloEfetivo("auto", null).ciclo === "bear");

// ---------------------------------------------------------------------------
titulo("A meta que sai do ciclo");

conferir("bull pede 20% ao mês", cicloParaMeta("bull") === "bull");
conferir("bear pede 4%", cicloParaMeta("bear") === "bear");
conferir("INDEFINIDO usa a meta de bear", cicloParaMeta("indefinido") === "bear",
  "entre errar a meta pra cima e pra baixo, errar pra cima faz aceitar pool que não sustenta o número");

// ---------------------------------------------------------------------------
titulo("Os cortes estão onde a distribuição real os pôs");

conferir("a entrada de capital é o p75 de 3 anos (+3,98%)", CICLO.capitalEntrando === 4);
conferir("a saída é o encolhimento (perto do p10 de -0,62%)", CICLO.capitalSaindo === 0);
conferir("a média do preço é de 200 dias", CICLO.janelaMedia === 200);
conferir("a banda morta é de ±5%", CICLO.banda === 0.05);

// ---------------------------------------------------------------------------
titulo("O preço de agora: o painel e o servidor têm que dar o MESMO número");

{
  /* POR QUE ESTE TESTE EXISTE.
   *
   * Ele reparou que a célula "AGORA" do Bitcoin trazia a leitura da manhã:
   * "acreditei que foi um tipo de painel que atualizava com o preço do
   * Bitcoin". Estava certo — número velho com etiqueta de novo é a mesma
   * armadilha do APY anunciado que este radar inteiro existe pra desarmar.
   *
   * O conserto foi recalcular no navegador, com o preço vivo, a posição na
   * faixa. Isso DUPLICOU a conta: uma cópia em src/ciclo.js (servidor) e outra
   * dentro do painel, que não consegue importar do Worker.
   *
   * Duas cópias da mesma conta divergem no primeiro conserto feito num lugar
   * só. Então aqui elas são obrigadas a concordar, no mesmo número. */
  const { readFileSync } = await import("node:fs");
  const { posicaoNoCiclo, lerPosicao } = await import("./src/ciclo.js");

  const pegarFuncao = (fonte, nome) => {
    const i = fonte.indexOf(`function ${nome}(`);
    if (i < 0) throw new Error(`não achei ${nome} em src/painel.js`);
    let nivel = 0, j = fonte.indexOf("{", i);
    for (; j < fonte.length; j++) {
      if (fonte[j] === "{") nivel++;
      else if (fonte[j] === "}") { nivel--; if (nivel === 0) return fonte.slice(i, j + 1); }
    }
    throw new Error(`${nome} não fecha`);
  };
  const fonte = readFileSync("src/painel.js", "utf8");
  const { posicaoComPreco } = new Function(
    `${pegarFuncao(fonte, "posicaoComPreco")} return { posicaoComPreco: posicaoComPreco };`
  )();

  /* Uma série de 260 dias que passeia entre 59k e 97k, como a janela dele. */
  const serie = [];
  for (let i = 0; i < 260; i++) {
    serie.push(59000 + Math.round(38000 * (0.5 + 0.5 * Math.sin(i / 21)) ));
  }

  const daServidor = (precos) => lerPosicao(posicaoNoCiclo(precos));

  /* Para cada preço, o painel recalculando tem que bater com o servidor
     medindo uma série que termina naquele preço. */
  [70000, 78035.9, 85000, 60000, 96000].forEach((preco) => {
    const guardado = daServidor(serie);
    const noPainel = posicaoComPreco(guardado, preco);
    const noServidor = daServidor(serie.concat([preco]));

    conferir(`a ${fmtK(preco)} a posição na faixa bate`,
      Math.abs(noPainel.posicao - noServidor.posicao) < 0.001,
      `painel ${noPainel.posicao.toFixed(3)} vs servidor ${noServidor.posicao.toFixed(3)}`);
    conferir(`a ${fmtK(preco)} a distância do topo bate`,
      Math.abs(noPainel.doTopo - noServidor.doTopo) < 0.001);
    conferir(`a ${fmtK(preco)} a frase é a mesma`,
      noPainel.texto.replace(/\d+ dias/, "N dias") === noServidor.texto.replace(/\d+ dias/, "N dias"),
      `painel "${noPainel.texto}" vs servidor "${noServidor.texto}"`);
  });

  /* O PREÇO QUE FURA A JANELA. Se ele bate máxima nova entre duas leituras, o
     topo guardado de manhã ficou pequeno — e a marca sairia da régua. */
  const guardado = daServidor(serie);
  const furouCima = posicaoComPreco(guardado, guardado.topo * 1.10);
  conferir("preço acima do topo guardado não estoura a régua",
    furouCima.posicao <= 100 && furouCima.posicao >= 0,
    `deu ${furouCima.posicao}`);
  conferir("e o topo novo passa a ser o preço novo",
    Math.abs(furouCima.topo - guardado.topo * 1.10) < 0.01,
    "furar o topo é notícia, não erro");
  conferir("colado no topo, ele diz isso", furouCima.onde === "colado no topo da janela");

  const furouBaixo = posicaoComPreco(guardado, guardado.fundo * 0.9);
  conferir("preço abaixo do fundo também não estoura",
    furouBaixo.posicao >= 0 && furouBaixo.posicao <= 100);
  conferir("e vira o fundo novo", furouBaixo.onde === "colado no fundo da janela");

  /* Sem preço vivo, devolve o que estava guardado — nunca inventa. */
  conferir("sem preço, devolve a leitura guardada intacta",
    posicaoComPreco(guardado, null) === guardado,
    "melhor o número da manhã, dito como da manhã, que um número inventado");
  conferir("preço zero também", posicaoComPreco(guardado, 0) === guardado);
  conferir("sem leitura guardada, não inventa nada", posicaoComPreco(null, 78000) === null);
}

function fmtK(v) { return "US$ " + Math.round(v / 1000) + "k"; }

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
