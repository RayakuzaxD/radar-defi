/* O leitor do fluxo dos ETFs de bitcoin.
 *
 *   node testar-etf.js
 *
 * ---------------------------------------------------------------------------
 * O GABARITO É A PÁGINA, E ELA ESTÁ GUARDADA
 *
 * provas/farside-fluxo.html é marcação LITERAL, copiada do ar em 11/09/2026
 * pelo próprio Worker. Nada foi reescrito: só as linhas do meio saíram, e o
 * corte está dito no lugar onde acontece.
 *
 * Os números que este arquivo cobra são os que a página mostrava naquele dia:
 *
 *   11 Jan 2024   IBIT 111.7  FBTC 227.0  GBTC (95.1)  MSBT -   Total 655.3
 *   10 Sep 2026   IBIT (24.5) ARKB (164.3) MSBT 4.0            Total (282.7)
 *   Total         IBIT 64,023 GBTC (27,782)                    Total 55,237
 *
 * A LINHA "Total" É A ARMADILHA DESTE ARQUIVO. Ela tem exatamente o mesmo
 * formato de um dia e somaria 55 bilhões de dólares ao fluxo se entrasse. Não
 * é resolvida por "pule a última linha" — é resolvida por "só é dia o que tem
 * cara de data", e é isso que os testes cobram.
 */

import { readFileSync } from "node:fs";
import {
  lerTabelaDoFarside, lerFluxoDosEtfs, diaDoFarside, numeroDoFarside,
} from "./src/etf.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log("  ok   " + oQue); }
  else { falhou++; console.log("  FALHOU  " + oQue + (det ? " — " + det : "")); }
}
const titulo = (t) => console.log("\n" + t);
const perto = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

const html = readFileSync(new URL("./provas/farside-fluxo.html", import.meta.url), "utf8");

/* ------------------------------------------------------------------------ */
titulo("A data, que é o que separa um dia do rodapé");
{
  conferir("'11 Jan 2024' vira 2024-01-11", diaDoFarside("11 Jan 2024") === "2024-01-11");
  conferir("'09 Sep 2026' vira 2026-09-09", diaDoFarside("09 Sep 2026") === "2026-09-09");
  conferir("'01 Dec 2025' vira 2025-12-01", diaDoFarside("01 Dec 2025") === "2025-12-01");
  conferir("'Total' NÃO é data", diaDoFarside("Total") === null);
  conferir("'Average' NÃO é data", diaDoFarside("Average") === null);
  conferir("'Date' NÃO é data", diaDoFarside("Date") === null);
  conferir("mês inventado não passa", diaDoFarside("11 Xyz 2024") === null);
  conferir("dia 32 não passa", diaDoFarside("32 Jan 2024") === null);
  conferir("vazio não passa", diaDoFarside("") === null && diaDoFarside(null) === null);
}

/* ------------------------------------------------------------------------ */
titulo("O número, com as quatro formas que a página usa");
{
  conferir("'111.7' é 111,7", perto(numeroDoFarside("111.7"), 111.7));
  conferir("'(95.1)' é NEGATIVO", perto(numeroDoFarside("(95.1)"), -95.1));
  conferir("'64,023' é 64023, e a vírgula é de milhar",
    perto(numeroDoFarside("64,023"), 64023));
  conferir("'(27,782)' junta as duas", perto(numeroDoFarside("(27,782)"), -27782));
  conferir("'0.0' é zero, e zero não é null", numeroDoFarside("0.0") === 0);
  /* A diferença que importa: traço é AUSÊNCIA de dado, zero é fluxo medido e
     igual a zero. Tratar traço como zero inventaria um dia de fluxo nulo pra
     um fundo que nem existia ainda. */
  conferir("'-' é ausência, e vira null", numeroDoFarside("-") === null);
  conferir("texto qualquer vira null", numeroDoFarside("n/a") === null);
}

/* ------------------------------------------------------------------------ */
titulo("A tabela de verdade, lida da prova");
{
  const r = lerTabelaDoFarside(html);
  conferir("leu sem erro", !r.erro, r.erro || "");
  conferir("achou os doze fundos do cabeçalho", r.fundos.length === 12,
    r.fundos.join(" "));
  conferir("e 'Date' não virou fundo", !r.fundos.includes("Date"));
  conferir("e 'Total' não virou fundo", !r.fundos.includes("Total"));

  /* A CONFERÊNCIA QUE JUSTIFICA O ARQUIVO. */
  conferir("são DOIS dias, e não três — a linha 'Total' ficou de fora",
    r.dias.length === 2, r.dias.map((d) => d.dia).join(", "));

  const velho = r.dias.find((d) => d.dia === "2024-01-11");
  conferir("11 Jan 2024: total 655,3", perto(velho.total, 655.3), String(velho.total));
  conferir("  IBIT 111,7", perto(velho.porFundo.IBIT, 111.7));
  conferir("  FBTC 227,0", perto(velho.porFundo.FBTC, 227));
  conferir("  GBTC negativo, −95,1", perto(velho.porFundo.GBTC, -95.1));
  conferir("  MSBT não existia, e por isso NÃO está no mapa",
    !("MSBT" in velho.porFundo), JSON.stringify(velho.porFundo.MSBT));

  const novo = r.dias.find((d) => d.dia === "2026-09-10");
  conferir("10 Sep 2026: total −282,7", perto(novo.total, -282.7), String(novo.total));
  conferir("  IBIT −24,5", perto(novo.porFundo.IBIT, -24.5));
  conferir("  ARKB −164,3", perto(novo.porFundo.ARKB, -164.3));
  conferir("  MSBT +4,0, já existindo", perto(novo.porFundo.MSBT, 4));
  conferir("  BTCO 0,0 está no mapa, porque zero é medida",
    novo.porFundo.BTCO === 0);

  conferir("a ordem é do mais novo pro mais velho",
    r.dias[0].dia === "2026-09-10");
}

/* ------------------------------------------------------------------------ */
titulo("Marcação estragada não vira número");
{
  conferir("sem tabela", lerTabelaDoFarside("<p>oi</p>").erro === "não achei a tabela");
  conferir("tabela vazia", !!lerTabelaDoFarside("<table></table>").erro);
  conferir("sem nada", !!lerTabelaDoFarside(null).erro);
  conferir("tabela só com o rodapé não vira um dia",
    !!lerTabelaDoFarside(
      "<table><th>Date</th><th>IBIT</th><th>Total</th>" +
      "<tr><td>Total</td><td>1</td><td>1</td></tr></table>").erro);
}

/* ------------------------------------------------------------------------ */
titulo("A LEITURA: a semana manda, o dia é contexto");
{
  /* Série inventada de propósito, com os números escolhidos pra separar as
     duas perguntas. O último dia é de SAÍDA, e a semana inteira é de ENTRADA:
     quem lesse só o último dia diria o contrário do que a semana diz. */
  const dias = [
    { dia: "2026-09-10", total: -50 },
    { dia: "2026-09-09", total: 120 },
    { dia: "2026-09-08", total: 200 },
    { dia: "2026-09-05", total: 80 },
    { dia: "2026-09-04", total: 60 },
    { dia: "2026-09-03", total: 40 },
    { dia: "2026-09-02", total: 30 },
    { dia: "2026-09-01", total: 9999 }, // fora da janela de 7
  ];
  const r = lerFluxoDosEtfs(dias, 7);
  conferir("a janela é de 7 dias, e o oitavo fica fora",
    r.janela === 7 && perto(r.semana, 480), String(r.semana));
  conferir("a direção vem da SEMANA: entrando", r.direcao === "entrando");
  conferir("e o último dia é dito à parte: saindo",
    r.direcaoDoUltimo === "saindo" && perto(r.ultimo, -50));
  conferir("a data do último dia viaja junto", r.ultimoDia === "2026-09-10");
}

/* ------------------------------------------------------------------------ */
titulo("A SEQUÊNCIA, que é o que a soma esconde");
{
  /* Duas semanas com a MESMA soma, −50, e histórias opostas: uma é um tombo
     isolado no meio de dias bons, a outra são cinco saídas seguidas. Se a
     leitura não distinguisse as duas, a linha da tela não valeria nada. */
  const tombo = lerFluxoDosEtfs([
    { dia: "2026-09-10", total: -290 }, { dia: "2026-09-09", total: 60 },
    { dia: "2026-09-08", total: 60 }, { dia: "2026-09-05", total: 60 },
    { dia: "2026-09-04", total: 60 },
  ]);
  const sangria = lerFluxoDosEtfs([
    { dia: "2026-09-10", total: -10 }, { dia: "2026-09-09", total: -10 },
    { dia: "2026-09-08", total: -10 }, { dia: "2026-09-05", total: -10 },
    { dia: "2026-09-04", total: -10 }, { dia: "2026-09-03", total: 0 },
  ]);
  conferir("as duas somam o mesmo", perto(tombo.semana, sangria.semana),
    tombo.semana + " e " + sangria.semana);
  conferir("mas o tombo isolado conta 1 dia seguido", tombo.seguidos === 1,
    String(tombo.seguidos));
  conferir("e a sangria conta 5", sangria.seguidos === 5, String(sangria.seguidos));

  /* Zero é feriado de fluxo: não vira sequência nem quebra a de ninguém. */
  const comZero = lerFluxoDosEtfs([
    { dia: "2026-09-10", total: -10 }, { dia: "2026-09-09", total: 0 },
    { dia: "2026-09-08", total: -10 }, { dia: "2026-09-05", total: 20 },
  ]);
  conferir("o zero no meio não quebra a sequência", comZero.seguidos === 2,
    String(comZero.seguidos));

  const paradoHoje = lerFluxoDosEtfs([
    { dia: "2026-09-10", total: 0 }, { dia: "2026-09-09", total: -10 },
  ]);
  conferir("e um dia parado não abre sequência nenhuma",
    paradoHoje.seguidos === 0 && paradoHoje.direcaoDoUltimo === "parado");
}

/* ------------------------------------------------------------------------ */
titulo("A LEITURA NÃO MANDA ELE FAZER NADA");
{
  /* A regra mais antiga do projeto. Fluxo de ETF é medida, e o que fazer com
     ela é dele — inclusive porque entrada forte de ETF já foi topo e já foi
     começo de alta, e quem diz qual é o caso não sou eu. */
  const r = lerFluxoDosEtfs([{ dia: "2026-09-10", total: -300 }]);
  const texto = JSON.stringify(r);
  const ordem = /\b(saia|retire|feche|venda|compre|invista|deveria|recomendo|sugiro|melhor|ruim|bom)\b/i;
  conferir("nada de veredito no que sai da função", !ordem.test(texto),
    (texto.match(ordem) || [""])[0]);
  conferir("nem palavra de ciclo: quem decide o ciclo é ele",
    !/bull|bear/i.test(texto));
}

/* ------------------------------------------------------------------------ */
titulo("Série estragada não vira leitura");
{
  conferir("sem série", lerFluxoDosEtfs(null) === null);
  conferir("série vazia", lerFluxoDosEtfs([]) === null);
  conferir("série só com dias sem total",
    lerFluxoDosEtfs([{ dia: "2026-09-10", total: null }]) === null);
  conferir("dia sem total é pulado, e o resto continua valendo",
    perto(lerFluxoDosEtfs([
      { dia: "2026-09-10", total: null }, { dia: "2026-09-09", total: 5 },
    ]).semana, 5));
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
