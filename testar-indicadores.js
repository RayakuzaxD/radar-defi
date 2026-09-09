/* Prova os indicadores de ciclo do curso.
 *
 *   node testar-indicadores.js
 *
 * ESTE ARQUIVO EXISTE POR CAUSA DE UM ERRO MEU, e o erro está escrito aqui pra
 * não se repetir: eu tinha afirmado, dentro do `src/ciclo.js`, que "o curso
 * nunca diz como determinar o ciclo". O Portal 2 — Teoria dos Ciclos diz, com
 * indicador nomeado e corte numérico. Eu tinha lido os Módulos 4 e 8 e concluído
 * sobre o curso inteiro.
 *
 * A REGRA DESTE ARQUIVO: todo corte conferido aqui é CITAÇÃO do Portal 2, não
 * escolha minha. Onde o número for meu, o teste diz que é meu — porque a única
 * coisa pior que usar um número errado é não saber de quem ele é.
 *
 * Os valores reais de 07/09/2026 (bitcoin-data.com) entram como conferência
 * final: é a carteira do mundo, e ela precisa cair onde o curso diz que cai.
 */

import {
  CORTES, lerMvrv, lerZscore, lerPuell, lerVdd, lerMedia50, lerAltseason,
  vereditoDoCurso, juntarLeituras,
} from "./src/indicadores.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log("\n" + t);

// ---------------------------------------------------------------------------
titulo("Os cortes são os do curso, letra por letra");

conferir("MVRV: fundo abaixo de 1", CORTES.mvrv.fundo === 1.0,
  '"Comprar abaixo de 1 ( Fundo)"');
conferir("MVRV: acumulação de 1,4 a 1,5",
  CORTES.mvrv.acumulaBaixo === 1.4 && CORTES.mvrv.acumulaAlto === 1.5,
  '"Acumulação ( 1.4 - 1.5 )"');
conferir("MVRV: topo acima de 3,5", CORTES.mvrv.topo === 3.5,
  '"Vender acima de 3.5 ( Topo )"');
conferir("Z-Score: fundo 0,5 e topo 3",
  CORTES.zscore.fundo === 0.5 && CORTES.zscore.topo === 3.0,
  '"Fundo normalmente - de 0,5 / Topo normalmente + de 3"');
conferir("VDD: fundo 0,5 e topo 3",
  CORTES.vdd.fundo === 0.5 && CORTES.vdd.topo === 3.0,
  '"Abaixo de 0,5 - Fundo / Acima de 3 - Topo"');
conferir("a média do curso é a de 50 dias", CORTES.media.curso === 50,
  '"SMA 50 — Abaixo = Bear market, Acima = Bull Market"');
conferir("e a de 200 continua, marcada como a lenta", CORTES.media.lenta === 200,
  "a de 200 é convenção de mercado, não do curso — as duas coexistem");

// ---------------------------------------------------------------------------
titulo("Cada indicador cai onde o curso manda");

{
  conferir("MVRV 0,80 é fundo", lerMvrv(0.80).zona === "fundo");
  conferir("MVRV 1,00 NÃO é fundo — o curso diz ABAIXO de 1",
    lerMvrv(1.00).zona !== "fundo",
    "o corte é 'abaixo de 1', e 1,00 não está abaixo de 1");
  conferir("MVRV 1,45 é acumulação", lerMvrv(1.45).zona === "acumulacao");
  conferir("MVRV 1,40 é acumulação (a borda entra)", lerMvrv(1.40).zona === "acumulacao");
  conferir("MVRV 1,50 é acumulação (a outra borda também)", lerMvrv(1.50).zona === "acumulacao");
  conferir("MVRV 1,51 já saiu da faixa", lerMvrv(1.51).zona === "meio");
  conferir("MVRV 2,00 é meio, não topo", lerMvrv(2.00).zona === "meio",
    "entre 1,5 e 3,5 o curso não marca nada — e não marcar é uma resposta");
  conferir("MVRV 3,60 é topo", lerMvrv(3.60).zona === "topo");

  conferir("Z-Score 0,30 é fundo", lerZscore(0.30).zona === "fundo");
  conferir("Z-Score 3,20 é topo", lerZscore(3.20).zona === "topo");
  conferir("Z-Score 1,50 é meio", lerZscore(1.50).zona === "meio");

  conferir("Puell 0,40 é fundo", lerPuell(0.40).zona === "fundo");
  conferir("Puell 3,50 é topo", lerPuell(3.50).zona === "topo");

  conferir("VDD 0,30 é fundo", lerVdd(0.30).zona === "fundo");
  conferir("VDD 4,00 é topo", lerVdd(4.00).zona === "topo");
}

titulo("Sem leitura não se inventa zona");
{
  conferir("MVRV nulo devolve null", lerMvrv(null) === null);
  conferir("Z-Score de texto devolve null", lerZscore("abacaxi") === null);
  conferir("Puell indefinido devolve null", lerPuell(undefined) === null);
  conferir("VDD infinito devolve null", lerVdd(Infinity) === null,
    "número que não é número tem que parar aqui, não virar zona");
}

// ---------------------------------------------------------------------------
titulo("A média de 50, que é a do curso");

{
  const subindo = Array.from({ length: 60 }, (_, i) => 50000 + i * 500);
  const m = lerMedia50(subindo);
  conferir("série em alta: preço acima da média de 50", m.lado === "bull");
  conferir("e a média é a dos ÚLTIMOS 50, não da série inteira",
    Math.abs(m.valor - (subindo.slice(-50).reduce((a, b) => a + b, 0) / 50)) < 1e-6);

  const caindo = Array.from({ length: 60 }, (_, i) => 90000 - i * 500);
  conferir("série em queda: preço abaixo da média", lerMedia50(caindo).lado === "bear");

  conferir("com menos de 50 dias não há média — devolve null",
    lerMedia50(Array(49).fill(50000)) === null,
    "média de 50 feita com 20 dias é um número que mente sobre o próprio nome");
  conferir("série vazia devolve null", lerMedia50([]) === null);
  conferir("zeros e lixo são descartados antes de contar",
    lerMedia50([0, null, ...Array(50).fill(60000)]).valor === 60000);
}

// ---------------------------------------------------------------------------
titulo("A temporada das altcoins (ETH/BTC)");

{
  conferir("ETH/BTC subindo 8% é dinheiro descendo pras alts",
    lerAltseason(0.054, 0.050).lado === "alts");
  conferir("caindo 8% é dinheiro voltando pro Bitcoin",
    lerAltseason(0.046, 0.050).lado === "btc");
  conferir("variação de 2% é ruído, não temporada",
    lerAltseason(0.051, 0.050).lado === "parado",
    "o corte de 5% é MEU — o curso mostra o gráfico e não dá número");
  conferir("sem as duas pontas, não calcula", lerAltseason(0.05, 0) === null);
}

// ---------------------------------------------------------------------------
titulo("O veredito sai por contagem, não por média");

{
  const topo = vereditoDoCurso([lerMvrv(3.8), lerZscore(3.4), lerPuell(3.5), lerVdd(3.2)]);
  conferir("quatro em topo dão topo", topo.fase === "topo");
  conferir("e a firmeza diz quantos foram", topo.firmeza.includes("4 de 4"));

  const fundo = vereditoDoCurso([lerMvrv(0.8), lerZscore(0.3), lerPuell(0.4), lerVdd(0.3)]);
  conferir("quatro em fundo dão fundo", fundo.fase === "fundo");

  const misto = vereditoDoCurso([lerMvrv(3.8), lerZscore(0.3), lerPuell(2.0), lerVdd(2.0)]);
  conferir("um topo, um fundo e dois no meio não viram veredito",
    misto.fase === "meio",
    "empate virando direção seria o radar escolhendo por ele");

  /* UM INDICADOR SOZINHO NÃO FAZ FASE, e esta conferência guarda a razão de
     acumulação ter virado bandeira em vez de fase: só o MVRV tem essa faixa,
     então "a maioria em acumulação" nunca aconteceria — era código morto com
     cara de regra. */
  const soAcumula = vereditoDoCurso([lerMvrv(1.45), lerZscore(0.9), lerPuell(0.94), lerVdd(0.65)]);
  conferir("um indicador em acumulação e três no meio dá MEIO",
    soAcumula.fase === "meio",
    "1 de 4 não é consenso, e chamar de fase seria o radar escolhendo por ele");
  conferir("mas a bandeira de acumulação não se perde",
    soAcumula.acumulando === true,
    "é a informação que a fase sozinha jogaria fora");
  conferir("e ela aparece na firmeza, escrita",
    soAcumula.firmeza.includes("acumulação"));

  const fundoDeVerdade = vereditoDoCurso([lerMvrv(1.45), lerZscore(0.3), lerPuell(0.4), lerVdd(0.3)]);
  conferir("com dois em fundo, a acumulação soma e a fase vira fundo",
    fundoDeVerdade.fase === "fundo",
    "o curso põe acumulação logo acima do fundo, não em direção contrária");

  conferir("sem indicador nenhum, diz sem-dado",
    vereditoDoCurso([]).fase === "sem-dado");
  conferir("e lista de nulos é o mesmo que lista vazia",
    vereditoDoCurso([null, null]).fase === "sem-dado",
    "indicador que não foi lido não pode contar como voto");

  conferir("o porquê traz uma frase por indicador lido",
    topo.porque.length === 4 && topo.porque.every((t) => typeof t === "string" && t.length > 10));
}

// ---------------------------------------------------------------------------
titulo("As duas réguas: quando concordam e quando não");

{
  const cursoFundo = vereditoDoCurso([lerMvrv(0.8), lerZscore(0.3), lerPuell(0.4), lerVdd(0.3)]);

  const juntas = juntarLeituras(cursoFundo, { ciclo: "bear" }, null);
  conferir("curso em fundo + radar em bear = concordam", juntas.concordam === true);
  conferir("e o recado diz isso", juntas.recado.includes("concordam"));

  const brigando = juntarLeituras(cursoFundo, { ciclo: "bull" }, null);
  conferir("curso em fundo + radar em bull = DISCORDAM", brigando.discordam === true);
  conferir("e o recado diz que discordam, em maiúscula",
    brigando.recado.includes("DISCORDAM"),
    "a discordância É a informação; escondê-la seria esconder o que mais importa");
  conferir("e não escolhe nenhuma das duas",
    brigando.recado.includes("Nenhuma das duas está escolhendo por você"));

  const radarIndef = juntarLeituras(cursoFundo, { ciclo: "indefinido" }, null);
  conferir("radar indefinido não conta como discordância",
    radarIndef.discordam === false,
    "não ter opinião é diferente de ter a opinião contrária");

  const semCurso = juntarLeituras(null, { ciclo: "bear" }, null);
  conferir("sem os indicadores do curso, diz que vale só o radar",
    semCurso.recado.includes("não foram lidos"));
}

// ---------------------------------------------------------------------------
titulo("O mundo real de 07/09/2026 — a conferência que importa");

{
  /* Valores lidos de bitcoin-data.com em 08/09/2026, referentes a 07/09.
     Não são inventados: são o que o mercado marcava no dia em que este arquivo
     foi escrito, e servem pra provar que os cortes do curso encontram a
     realidade em vez de só encontrarem a si mesmos. */
  const mvrv = lerMvrv(1.4997);
  const z = lerZscore(0.9116);
  const puell = lerPuell(0.9389);
  const vdd = lerVdd(0.65);

  conferir("MVRV 1,4997 cai EXATAMENTE na faixa de acumulação do curso",
    mvrv.zona === "acumulacao",
    "1,4 a 1,5 — e o mercado estava em 1,4997");
  conferir("Z-Score 0,9116 está no meio, longe do topo", z.zona === "meio");
  conferir("Puell 0,9389 está no meio, perto do fundo", puell.zona === "meio");
  conferir("VDD 0,65 está no meio", vdd.zona === "meio");

  const v = vereditoDoCurso([mvrv, z, puell, vdd]);
  conferir("nenhum dos quatro marca topo",
    (v.contagem.topo || 0) === 0,
    "é o que sustenta a leitura do radar naquele dia: não era euforia");

  /* E o confronto com o que o radar dizia no mesmo dia: bear/repique. */
  const j = juntarLeituras(v, { ciclo: "bear" }, null);
  conferir("as duas réguas NÃO brigavam em 08/09/2026", j.discordam === false,
    "duas medidas independentes no mesmo lado é o melhor sinal de que a conta está certa");
}

console.log("\n" + "-".repeat(60));
if (falhou) { console.log(`${falhou} FALHARAM (de ${passou + falhou})`); process.exit(1); }
console.log(`TUDO VERDE — ${passou} conferências`);
