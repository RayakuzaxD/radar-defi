/* O bloco macro: inflação, juros, regra de Taylor, M2 e balanço do FED.
 *
 *   node testar-macro.js
 *
 * Nada aqui fala com a rede. O que este arquivo guarda:
 *
 *   1. QUE A FÓRMULA É A DO MATERIAL. O Módulo 4 traz um exemplo numérico
 *      fechado — i = 2% + 3% + 0,5·(3%−2%) + 0,5·(1%) = 6%. Se a conta daqui
 *      deixar de dar 6, alguém mexeu num peso, e o teste diz na hora.
 *
 *   2. QUE OS TEXTOS NÃO MANDAM ELE FAZER NADA. Macro é o assunto em que mais
 *      escorrega pro palpite, e o radar mede.
 *
 *   3. QUE O QUE FALTA É DITO. Meia conta anunciada como inteira é o defeito
 *      que este projeto mais persegue.
 */

import {
  lerTaylor, lerPostura, lerInflacao, lerM2, lerBalanco,
  variacaoEmDozeMeses, CORTES_MACRO,
} from "./src/macro.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log("  ok   " + oQue); }
  else { falhou++; console.log("  FALHOU  " + oQue + (det ? " — " + det : "")); }
}
const titulo = (t) => console.log("\n" + t);

/* ------------------------------------------------------------------------ */
titulo("A regra de Taylor é a do material, e o exemplo dele prova");
{
  /* i = r* + π + 0,5(π − π*) + 0,5(hiato), com π = 3%, π* = 2%, hiato = 1%.
     O hiato entra pelo desemprego: hiato = okun·(natural − atual), então pra
     um hiato de 1 ponto com okun = 2, o desemprego tem que estar 0,5 abaixo
     do natural. */
  const r = lerTaylor({ inflacao: 3, desemprego: 4, natural: 4 + 1 / CORTES_MACRO.okunMeu });
  conferir("o exemplo fechado do material dá 6,0%",
    Math.abs(r.taxa - 6) < 1e-9, r.taxa.toFixed(6));
  conferir("e o hiato reconstruído é 1 ponto",
    Math.abs(r.hiato - 1) < 1e-9, String(r.hiato));

  conferir("a taxa neutra é 2%", CORTES_MACRO.taylor.neutra === 2);
  conferir("a meta de inflação é 2%", CORTES_MACRO.metaDeInflacao === 2);
  conferir("os dois pesos são 0,5",
    CORTES_MACRO.taylor.pesoDaInflacao === 0.5 && CORTES_MACRO.taylor.pesoDoHiato === 0.5);
}

/* ------------------------------------------------------------------------ */
titulo("Sem o hiato, ela DIZ que está sem o hiato");
{
  const semHiato = lerTaylor({ inflacao: 3, desemprego: null, natural: null });
  conferir("ainda devolve uma taxa", semHiato != null && semHiato.taxa > 0);
  conferir("mas marca que o hiato faltou", semHiato.temHiato === false);
  conferir("e o texto avisa", /sem o hiato/.test(semHiato.texto), semHiato.texto);
  /* Sem hiato a conta é 2 + 3 + 0,5·1 = 5,5. */
  conferir("a conta sem hiato fecha em 5,5%", Math.abs(semHiato.taxa - 5.5) < 1e-9);

  conferir("sem inflação não há regra", lerTaylor({ inflacao: null }) === null);
}

/* ------------------------------------------------------------------------ */
titulo("Frouxa, apertada, ou em cima da regra");
{
  const regra = { taxa: 6 };
  conferir("juro 3 pontos abaixo é política mais frouxa", lerPostura(3, regra).frouxa === true);
  conferir("juro acima da regra é política mais apertada", lerPostura(8, regra).apertada === true);
  const emCima = lerPostura(5.8, regra);
  conferir("diferença menor que meio ponto não vira nem um nem outro",
    !emCima.frouxa && !emCima.apertada, emCima.texto);
  conferir("sem juro, sem leitura", lerPostura(null, regra) === null);
  conferir("sem regra, sem leitura", lerPostura(3, null) === null);
}

/* ------------------------------------------------------------------------ */
titulo("A inflação contra a meta de 2%");
{
  const alta = lerInflacao({ pce: 3.7, cpi: 3.3, pceNucleo: 3.34, cpiNucleo: 2.47 });
  conferir("acima da meta é reconhecido", alta.acimaDaMeta === true);
  conferir("a distância é a diferença pra 2", Math.abs(alta.distancia - 1.7) < 1e-9);
  conferir("o PCE vem primeiro no texto", /^PCE/.test(alta.texto), alta.texto.slice(0, 40));
  conferir("o texto traz os quatro números",
    /PCE 3,70/.test(alta.texto) && /CPI 3,30/.test(alta.texto) &&
    /núcleo do PCE 3,34/.test(alta.texto) && /núcleo do CPI 2,47/.test(alta.texto));

  const baixa = lerInflacao({ pce: 1.2 });
  conferir("abaixo da meta também", baixa.acimaDaMeta === false && /ABAIXO/.test(baixa.texto));

  const naMeta = lerInflacao({ pce: 2.05 });
  conferir("quase na meta não vira 'acima' com 0,05",
    /praticamente na meta/.test(naMeta.texto), naMeta.texto);

  /* O PCE manda porque é o índice que o FED usa. Se ele faltar, o CPI assume —
     e não devolver nada quando um dos dois existe seria jogar fora medida boa. */
  const soCpi = lerInflacao({ cpi: 3.3 });
  conferir("sem PCE, o CPI assume", soCpi != null && soCpi.cpi === 3.3);
  conferir("sem nenhum dos dois, não há leitura", lerInflacao({}) === null);
}

/* ------------------------------------------------------------------------ */
titulo("Doze meses é o mesmo mês do ano passado, não doze posições");
{
  /* Série DIÁRIA: doze posições atrás seriam doze DIAS. */
  const diaria = [];
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 3; d++) {
      diaria.push({ dia: "2025-" + String(m).padStart(2, "0") + "-0" + d, valor: 100 });
    }
  }
  diaria.push({ dia: "2026-01-01", valor: 110 });
  const v = variacaoEmDozeMeses(diaria);
  conferir("acha o mesmo mês do ano anterior", v != null && Math.abs(v.pct - 10) < 1e-9,
    v ? v.pct.toFixed(4) + "% (de " + v.de + ")" : "null");
  conferir("e diz de onde até onde", v.de === "2025-01-01" && v.ate === "2026-01-01");

  conferir("série curta demais não inventa variação",
    variacaoEmDozeMeses([{ dia: "2026-01-01", valor: 100 }]) === null);
  conferir("série vazia devolve null", variacaoEmDozeMeses([]) === null);
}

/* ------------------------------------------------------------------------ */
titulo("M2 e balanço do FED");
{
  const m2 = lerM2(23.22e12, 5.4);
  conferir("o M2 sai em trilhões", /23,22 tri/.test(m2.texto), m2.texto);
  conferir("com a variação de 12 meses", /\+5,4%/.test(m2.texto));
  conferir("crescendo conta pro lado de expansão", m2.zona === "topo");
  conferir("encolhendo conta pro outro", lerM2(20e12, -3).zona === "fundo");

  const b = lerBalanco(6.74e12, 2.0);
  conferir("o balanço diz onde está entre o pico e o fundo",
    b.ondeNaFaixa != null && b.ondeNaFaixa > 0 && b.ondeNaFaixa < 100,
    b.ondeNaFaixa.toFixed(1) + "%");
  conferir("os marcos são os do material (8,97 tri e 6,59 tri)",
    CORTES_MACRO.balanco.pico === 8.97e12 && CORTES_MACRO.balanco.fundo === 6.59e12);
  conferir("sem nível, sem leitura", lerBalanco(null, 2) === null);
}

/* ------------------------------------------------------------------------ */
titulo("Nada aqui manda ele fazer nada");
{
  /* Macro é o assunto que mais puxa pro palpite: "juros vão cair, então
     compre". O radar mede e para. */
  const ORDEM = /\b(saia|retire|feche|venda|compre|invista|deveria|recomendo|sugiro|melhor)\b/i;
  const textos = [
    lerInflacao({ pce: 3.7, cpi: 3.3 }).texto,
    lerInflacao({ pce: 1.1 }).texto,
    lerInflacao({ pce: 2.02 }).texto,
    lerTaylor({ inflacao: 3, desemprego: 4, natural: 4.5 }).texto,
    lerTaylor({ inflacao: 3 }).texto,
    lerPostura(3, { taxa: 6 }).texto,
    lerPostura(8, { taxa: 6 }).texto,
    lerPostura(5.9, { taxa: 6 }).texto,
    lerM2(23e12, 5).texto,
    lerBalanco(6.7e12, 2).texto,
  ];
  textos.forEach((t, i) => {
    conferir("texto " + (i + 1) + " não dá ordem", !ORDEM.test(t), (t.match(ORDEM) || [""])[0]);
  });

  /* E não fala em nome do curso: os números são fatos de mercado, e é assim
     que eles aparecem. A procedência mora no comentário do código. */
  textos.forEach((t, i) => {
    conferir("texto " + (i + 1) + " não invoca o curso", !/\bcurso\b/i.test(t));
  });
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
