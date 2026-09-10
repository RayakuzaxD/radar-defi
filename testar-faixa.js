/* A Faixa de Bull Market e a Cruz de Ouro.
 *
 *   node testar-faixa.js
 *
 * Os dois indicadores que ele mais usa no canal — a faixa aparece em 41 dos 84
 * vídeos que eu transcrevi, o cruzamento em 3 mas como o sinal estrutural.
 *
 * O QUE ESTE ARQUIVO GUARDA, e é diferente de "a conta está certa": guarda que
 * a conta é A DELE. Os números (20 semanas, 21 semanas, 50 e 200 dias) saíram
 * da boca dele em vídeo, transcritos. Um teste que só conferisse a aritmética
 * deixaria eu trocar 20 por 30 sem ninguém notar.
 */

import { lerFaixaDeBull, lerCruzamento, CORTES } from "./src/indicadores.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log("  ok   " + oQue); }
  else { falhou++; console.log("  FALHOU  " + oQue + (det ? " — " + det : "")); }
}
const titulo = (t) => console.log("\n" + t);

/* Uma série diária de `n` dias que sobe `pctAoDia` por cento ao dia. */
const subindo = (n, inicio, pctAoDia) =>
  Array.from({ length: n }, (_, i) => inicio * Math.pow(1 + pctAoDia / 100, i));

/* ------------------------------------------------------------------------ */
titulo("Os números são os DELE, não os meus");
{
  conferir("a faixa é 20 semanas de SMA",
    CORTES.faixaDeBull.sma === 20, "ele disse 20 no vídeo de 20/05/2026");
  conferir("e 21 semanas de EMA",
    CORTES.faixaDeBull.ema === 21, "ele disse 21");
  conferir("a cruz é 50 contra 200 dias",
    CORTES.cruz.rapida === 50 && CORTES.cruz.lenta === 200);
}

/* ------------------------------------------------------------------------ */
titulo("A faixa: sem histórico não há leitura");
{
  conferir("série vazia devolve null", lerFaixaDeBull([]) === null);
  conferir("100 dias (14 semanas) não bastam para 21", lerFaixaDeBull(subindo(100, 100, 0)) === null);
  conferir("175 dias (25 semanas) bastam", lerFaixaDeBull(subindo(175, 100, 0)) != null);

  /* Sem histórico é diferente de "no meio". Devolver um objeto com zona
     "meio" seria uma leitura inventada, e ela entraria na contagem do
     veredito como se fosse medida. */
  conferir("nunca devolve zona quando não pôde medir",
    lerFaixaDeBull(subindo(50, 100, 0)) === null);
}

/* ------------------------------------------------------------------------ */
titulo("A faixa: cada lado, e o meio");
{
  /* Preço parado: as duas médias colam no preço, e ele fica DENTRO. */
  const parado = lerFaixaDeBull(subindo(400, 100, 0));
  conferir("preço parado cai dentro da faixa", parado.lado === "na-faixa",
    parado.lado + " (fundo " + parado.fundo.toFixed(4) + ", topo " + parado.topo.toFixed(4) + ")");
  conferir("e a zona vira 'meio'", parado.zona === "meio");

  /* Subindo forte: o preço de hoje deixa as duas médias pra trás. */
  const alta = lerFaixaDeBull(subindo(400, 100, 0.4));
  conferir("subindo forte, fica ACIMA da faixa", alta.lado === "bull", alta.lado);
  conferir("e a zona soma pro lado de bull", alta.zona === "topo");
  conferir("o texto diz 'ACIMA'", /ACIMA da faixa/.test(alta.texto));

  /* Caindo: espelho. */
  const baixa = lerFaixaDeBull(subindo(400, 100, -0.4));
  conferir("caindo, fica ABAIXO da faixa", baixa.lado === "bear", baixa.lado);
  conferir("e a zona soma pro lado de fundo", baixa.zona === "fundo");
  conferir("o texto usa a palavra dele, 'bear market'", /bear market/.test(baixa.texto));

  conferir("o piso nunca fica acima do teto",
    alta.fundo <= alta.topo && baixa.fundo <= baixa.topo && parado.fundo <= parado.topo);
  conferir("as duas médias existem e são positivas",
    alta.sma > 0 && alta.ema > 0);
}

/* ------------------------------------------------------------------------ */
titulo("A EMA é semeada com a média, não com um ponto solto");
{
  /* A PRIMEIRA VERSÃO DESTE TESTE MEDIA A COISA ERRADA, e vale registrar.
   *
   * Ele injetava um pico de 100x no primeiro ponto e exigia menos de 1% de
   * desvio. Falhou com 13,86% — e eu quase "consertei" o código. Fui medir
   * antes: o desvio é LINEAR no tamanho do pico (2x → 0,14% · 3x → 0,28% ·
   * 5x → 0,56% · 100x → 13,86%).
   *
   * Ou seja: a semente resiste a preço, e não resiste a lixo. Cem vezes não é
   * uma oscilação de mercado, é um dado corrompido — e nenhum alisamento devia
   * fingir que absorve isso. O teste estava exigindo do indicador uma coisa
   * que é trabalho da fonte.
   *
   * O que importa de verdade é: MUDAR O TAMANHO DA JANELA MUDA A LEITURA DE
   * HOJE? Medido com preço real de Bitcoin em 10/09/2026: cortar 5 semanas de
   * semente mexe 0,02% na EMA. É isso que este teste guarda agora.
   *
   * A lição: quando um teste falha, a primeira pergunta é se ele estava
   * pedindo a coisa certa. Consertar o código pra passar num teste errado
   * deixa dois defeitos onde havia um. */
  const serie = subindo(400, 100, 0.15);

  const cheia = lerFaixaDeBull(serie);
  const curta = lerFaixaDeBull(serie.slice(35));      // 5 semanas a menos
  const desvioJanela = Math.abs(curta.ema / cheia.ema - 1) * 100;
  conferir("tirar 5 semanas do começo mexe menos de 1% na EMA de hoje",
    desvioJanela < 1, "mexeu " + desvioJanela.toFixed(2) + "%");

  /* E a oscilação REAL de preço, essa a semente tem que absorver. Três vezes
     é a ordem de grandeza de um crash ou de um topo de ciclo. */
  const contaminada = serie.slice();
  contaminada[0] = serie[0] * 3;
  const desvioPico = Math.abs(lerFaixaDeBull(contaminada).ema / cheia.ema - 1) * 100;
  conferir("um pico de 3x no primeiro ponto mexe menos de 1%",
    desvioPico < 1, "mexeu " + desvioPico.toFixed(2) + "%");
}

/* ------------------------------------------------------------------------ */
titulo("As semanas são contadas de trás pra frente");
{
  /* O último ponto da série TEM que ser o preço de hoje. Se as semanas
     fossem contadas do começo, a última ficaria incompleta e o indicador
     mudaria conforme o dia da semana em que a rodada rodasse. */
  const serie = subindo(400, 100, 0.2);
  const hoje = serie[serie.length - 1];
  const r = lerFaixaDeBull(serie);
  conferir("o 'hoje' da leitura é o último preço da série",
    Math.abs(r.hoje - hoje) < 1e-9);

  /* Tirar um dia do fim muda a leitura; se ela fosse ancorada no começo,
     tirar do fim mudaria pouco e tirar do começo mudaria muito. */
  const semOntem = lerFaixaDeBull(serie.slice(0, -1));
  conferir("tirar o último dia muda o 'hoje'", semOntem.hoje !== r.hoje);
}

/* ------------------------------------------------------------------------ */
titulo("A cruz: os dois estados, e quando virou");
{
  conferir("menos de 200 dias não dá leitura", lerCruzamento(subindo(150, 100, 0.3)) === null);

  const alta = lerCruzamento(subindo(400, 100, 0.3));
  conferir("subindo sempre, é cruz de ouro", alta.tipo === "ouro", alta.tipo);
  conferir("o nome é o do curso", alta.nome === "Cruz de Ouro");
  conferir("o texto traz a ressalva do curto prazo", /curto/.test(alta.texto));
  conferir("e a ressalva do ouro fala em topo local", /topo local/.test(alta.texto));

  const baixa = lerCruzamento(subindo(400, 100, -0.3));
  conferir("caindo sempre, é cruz da morte", baixa.tipo === "morte", baixa.tipo);
  conferir("e a ressalva da morte fala em fundo", /fundo daquele momento/.test(baixa.texto));

  /* Um cruzamento de verdade: cai por 250 dias, depois sobe forte. A média de
     50 alcança e passa a de 200 em algum ponto do trecho de alta. */
  const virada = [...subindo(250, 100, -0.25), ...subindo(150, 100 * Math.pow(0.9975, 249), 0.9)];
  const c = lerCruzamento(virada);
  conferir("depois de virar pra cima, vira cruz de ouro", c.tipo === "ouro", c.tipo);
  conferir("e ela sabe há quantos dias virou", c.quandoDias != null && c.quandoDias > 0,
    String(c.quandoDias));
  conferir("o texto diz o número de dias", new RegExp("ha " + c.quandoDias + " dias").test(c.texto),
    c.texto.slice(0, 90));
}

/* ------------------------------------------------------------------------ */
titulo("Não saber a data é diferente de não ter cruzamento");
{
  /* Série que nunca cruza dentro do que dá pra enxergar. A função tem que
     dizer "há mais de N dias" em vez de fingir uma data — ou pior, em vez de
     devolver quandoDias = 0, que a tela leria como "cruzou hoje". */
  const semCruzar = lerCruzamento(subindo(400, 100, 0.3));
  conferir("quandoDias vem null quando o cruzamento é velho demais",
    semCruzar.quandoDias === null, String(semCruzar.quandoDias));
  conferir("e o texto ADMITE o limite em vez de inventar",
    /mais de \d+ dias/.test(semCruzar.texto) && /historico que eu tenho/.test(semCruzar.texto),
    semCruzar.texto.slice(0, 120));
  conferir("e diz quantos dias ela consegue enxergar",
    semCruzar.diasVisiveis > 0 && semCruzar.diasVisiveis === 400 - 200);
}

/* ------------------------------------------------------------------------ */
titulo("Nenhum dos dois manda ele fazer nada");
{
  /* A regra mais antiga do projeto: o radar mede, ele decide. Um verbo de
     ordem aqui transformaria uma medida numa recomendação de investimento —
     que é exatamente o que este projeto não é. */
  const ORDEM = /\b(saia|retire|feche|venda|compre|invista|deveria|recomendo|sugiro|melhor)\b/i;
  const textos = [
    lerFaixaDeBull(subindo(400, 100, 0.4)).texto,
    lerFaixaDeBull(subindo(400, 100, -0.4)).texto,
    lerFaixaDeBull(subindo(400, 100, 0)).texto,
    lerCruzamento(subindo(400, 100, 0.3)).texto,
    lerCruzamento(subindo(400, 100, -0.3)).texto,
  ];
  textos.forEach((t, i) => {
    conferir("texto " + (i + 1) + " não dá ordem", !ORDEM.test(t),
      (t.match(ORDEM) || [""])[0]);
  });
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
