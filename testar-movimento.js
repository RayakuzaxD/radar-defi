/* Prova a conta de aportes, saques e colheitas.
 *
 *   node testar-movimento.js
 *
 * Os três casos que dão nome ao arquivo são os três que ele nomeou, e cada um
 * é um jeito diferente de a ferramenta mentir sobre o dinheiro dele:
 *
 *   sem aporte   → pôr mais dinheiro vira lucro do nada
 *   sem saque    → tirar dinheiro vira prejuízo
 *   sem colheita → realizar o lucro faz o lucro sumir
 *
 * O terceiro é o pior, e é o que tem os testes mais duros aqui.
 */

import { readFileSync } from "node:fs";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log("\n" + t);
const perto = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

/* Estas funções rodam no NAVEGADOR dele: moram dentro do template literal do
 * painel, então não dá pra importar. A saída é a mesma de testar-mexer.js —
 * arrancar cada uma pelo nome e mandar o motor do JavaScript montar.
 *
 * Feio, e de propósito: assim o teste prova exatamente o código que vai ao ar.
 * Uma segunda cópia destas contas num módulo separado passaria no teste e
 * divergiria da tela no primeiro conserto feito num lugar só. */
function pegarFuncao(fonte, nome) {
  const i = fonte.indexOf(`function ${nome}(`);
  if (i < 0) throw new Error(`não achei a função ${nome} em src/painel.js`);
  let nivel = 0, j = fonte.indexOf("{", i);
  for (; j < fonte.length; j++) {
    if (fonte[j] === "{") nivel++;
    else if (fonte[j] === "}") { nivel--; if (nivel === 0) return fonte.slice(i, j + 1); }
  }
  throw new Error(`a função ${nome} não fecha`);
}

const fonte = readFileSync("src/painel.js", "utf8");
const tipos = (fonte.match(/var TIPOS_DE_MOVIMENTO = (\[[^\]]*\])/) || [])[1];
if (!tipos) throw new Error("não achei TIPOS_DE_MOVIMENTO em src/painel.js");

const montar = new Function(`
  var TIPOS_DE_MOVIMENTO = ${tipos};
  ${["movEmDolar", "primeiroAporte", "resumoDosMovimentos", "resumoDaLinhaInteira",
     "resultadoDaLinha", "conferirMovimento", "pendenteDaLinha"].map((n) => pegarFuncao(fonte, n)).join("\n")}
  return { movEmDolar: movEmDolar, resumoDosMovimentos: resumoDosMovimentos,
           resumoDaLinhaInteira: resumoDaLinhaInteira,
           resultadoDaLinha: resultadoDaLinha, conferirMovimento: conferirMovimento,
           pendenteDaLinha: pendenteDaLinha, TIPOS: TIPOS_DE_MOVIMENTO };
`);
const {
  movEmDolar, resumoDosMovimentos, resumoDaLinhaInteira, resultadoDaLinha,
  conferirMovimento, pendenteDaLinha, TIPOS,
} = montar();

const mov = (tipo, valor, extras = {}) => ({
  chave: "linha-1", tipo, valor, moeda: "USD", valor_usd: valor,
  quando: "2026-09-08", ...extras,
});

// ---------------------------------------------------------------------------
titulo("Em dólar: o que foi congelado manda");

conferir("valor_usd é o que vale", movEmDolar(mov("aporte", 50, { valor_usd: 47.5 })) === 47.5,
  "o câmbio de hoje não reescreve o que ele aportou em março");
conferir("sem valor_usd, dólar vale por si", movEmDolar({ tipo: "aporte", valor: 30, moeda: "USD" }) === 30);
conferir("real sem cotação vira NULL, não zero",
  movEmDolar({ tipo: "aporte", valor: 300, moeda: "BRL" }) === null,
  "virar zero faria um aporte de 300 reais sumir do custo e reaparecer como lucro");
conferir("valor zero não conta", movEmDolar({ tipo: "aporte", valor: 0, moeda: "USD" }) === null);

// ---------------------------------------------------------------------------
titulo("O aporte: pôr mais dinheiro não é lucro");

{
  /* Um caso com a forma do real: entrou com 12,50 na pool, depois pôs mais 10. */
  const r = resumoDosMovimentos([mov("aporte", 12.50), mov("aporte", 10)]);
  conferir("dois aportes somam no custo", perto(r.custo, 22.50));
  conferir("e o realizado continua zero", r.realizado === 0);

  const res = resultadoDaLinha(r, 22.53, 0);
  conferir("a posição valendo 22,53 dá ganho de 0,03", perto(res.ganho, 0.03, 1e-9));
  conferir("e não de 10,03", !perto(res.ganho, 10.03, 0.01),
    "sem registrar o aporte, os 10 que ele PÔS apareceriam como lucro");
}

// ---------------------------------------------------------------------------
titulo("O saque: tirar dinheiro não é prejuízo");

{
  const r = resumoDosMovimentos([mov("aporte", 20), mov("saque", 10)]);
  conferir("o saque desce o custo", perto(r.custo, 10));

  const res = resultadoDaLinha(r, 10.5, 0);
  conferir("metade sacada, metade valendo 10,50, ganho de 0,50", perto(res.ganho, 0.5));
  conferir("e não prejuízo de 9,50", res.ganho > 0,
    "sem registrar o saque, tirar metade viraria prejuízo de metade");
  conferir("a porcentagem é sobre o que sobrou", perto(res.pct, 5));
}

// ---------------------------------------------------------------------------
titulo("A COLHEITA: realizar o lucro não pode apagar o lucro");

{
  /* O CASO CRUEL, e o motivo de este arquivo existir.
   *
   * Ele entra com 10. A pool rende 0,50 em taxas, que a cadeia mostra como
   * pendente. A tela diz: vale 10, rendeu 0,50 pendente. Ótimo.
   *
   * Aí ele COLHE. O pendente na cadeia vira ZERO — porque as taxas saíram da
   * posição e foram pra carteira dele. Se a colheita não for registrada, a
   * tela passa a dizer: vale 10, rendeu 0. O lucro sumiu no instante em que
   * ele o realizou. */
  const antesDeColher = resumoDosMovimentos([mov("aporte", 10)]);
  const a = resultadoDaLinha(antesDeColher, 10, 0.5);
  conferir("antes de colher, o ganho é a taxa pendente", perto(a.ganho, 0.5));

  const semRegistrar = resultadoDaLinha(antesDeColher, 10, 0);
  conferir("colhendo SEM registrar, o ganho vira zero", perto(semRegistrar.ganho, 0),
    "é a ferramenta dizendo que não houve lucro justamente quando deu certo");

  const comRegistro = resumoDosMovimentos([mov("aporte", 10), mov("colheita", 0.5)]);
  conferir("registrando a colheita, o ganho continua 0,50",
    perto(resultadoDaLinha(comRegistro, 10, 0).ganho, 0.5));
  conferir("e a colheita NÃO mexeu no custo", perto(comRegistro.custo, 10),
    "colher não é sacar: é lucro que saiu do pendente, não dinheiro que ele pôs");
  conferir("ela entra como realizado", perto(comRegistro.realizado, 0.5));
}

{
  /* E o que continua rendendo depois da colheita entra por cima. */
  const r = resumoDosMovimentos([mov("aporte", 10), mov("colheita", 0.5)]);
  const res = resultadoDaLinha(r, 10, 0.2);
  conferir("colhido mais pendente novo somam", perto(res.ganho, 0.7));
  conferir("e as partes aparecem separadas",
    perto(res.realizado, 0.5) && perto(res.pendente, 0.2),
    "somar tudo num número só esconderia se a taxa paga o que a faixa custa");
}

// ---------------------------------------------------------------------------
titulo("A linha NUNCA fica muda: o valor de entrada é o chão");

{
  /* O DEFEITO QUE ISTO PEGA, e aconteceu de verdade em 09/09/2026.
   *
   * A linha "quanto rendeu desde a entrada" aparecia sempre que houvesse
   * valor_entrada. Troquei por uma conta melhor, feita dos lançamentos — e a
   * conta melhor tem três jeitos novos de NÃO aparecer: linha sem chave, busca
   * dos lançamentos que falhou, e lançamento que não existe.
   *
   * O terceiro aconteceu: um app velho regenerou as chaves, os aportes ficaram
   * órfãos, e a linha sumiu da tela dele. Ele reparou na hora. Trocar uma
   * coisa que sempre funcionava por outra que às vezes não aparece é piorar,
   * mesmo quando a conta nova está certa. */
  const semNada = resumoDaLinhaInteira([], 12.50, "2026-09-08");
  conferir("sem lançamento, o valor de entrada vira o custo", perto(semNada.custo, 12.50),
    "é a linha que ele viu sumir");
  conferir("e a data da entrada vira o 'desde'", semNada.desde === "2026-09-08");
  conferir("e ela se declara como entrada original, não como lançamento dele",
    semNada.doValorDeEntrada === true);

  const r = resultadoDaLinha(semNada, 12.423527, 0.0291);
  conferir("a conta sai igual à de antes", perto(r.ganho, 12.423527 + 0.0291 - 12.50, 1e-6));
  conferir("com porcentagem", r.pct != null);

  /* E quando HÁ lançamento, quem manda é ele — não o valor de entrada. */
  const comMov = resumoDaLinhaInteira([mov("aporte", 20)], 12.50, "2026-09-08");
  conferir("havendo lançamento, o valor de entrada não entra", perto(comMov.custo, 20),
    "senão o aporte seria contado duas vezes");
  conferir("e a marca de entrada original não aparece", !comMov.doValorDeEntrada);

  /* Linha sem valor de entrada e sem lançamento continua sem conta — não há
     o que dizer, e inventar uma base seria inventar o lucro dele. */
  const vazia = resumoDaLinhaInteira([], null, null);
  conferir("sem entrada e sem lançamento, não há conta", vazia.total === 0);
  conferir("e isso não vira resultado", resultadoDaLinha(vazia, 10, 0) === null);
  conferir("valor de entrada zero também não inventa base",
    resumoDaLinhaInteira([], 0, null).total === 0);
}

// ---------------------------------------------------------------------------
titulo("O pendente de cada tipo de posição — e o dinheiro contado duas vezes");

{
  /* POOL: o valor lido da cadeia NÃO inclui as taxas não recolhidas, então
     elas entram por fora. */
  const pool = { posicao: { tipo: "pool", taxas: { emDolar: 0.0075 } } };
  conferir("na pool, o pendente é a taxa não recolhida", perto(pendenteDaLinha(pool), 0.0075));

  /* EMPRÉSTIMO: o valor lido JÁ inclui o juro, porque a quantidade de cTokens
     não muda e quem sobe é o câmbio. Somar por fora contaria duas vezes. */
  const emprestimo = { posicao: { tipo: "emprestimo", cambio: 1.19939103 } };
  conferir("no empréstimo, o pendente é ZERO", pendenteDaLinha(emprestimo) === 0,
    "o juro da Kamino já está dentro do valor — somar por fora contaria o dinheiro dele duas vezes");

  conferir("pool sem leitura das taxas devolve null",
    pendenteDaLinha({ posicao: { tipo: "pool", taxas: null } }) === null,
    "não consegui ler é diferente de é zero");
  conferir("linha sem posição devolve null", pendenteDaLinha({ f: {} }) === null);

  /* A prova de que a distinção importa: o mesmo número em dois tipos. */
  const r = resumoDosMovimentos([mov("aporte", 10)]);
  const comoPool = resultadoDaLinha(r, 10, pendenteDaLinha(pool));
  const comoEmp = resultadoDaLinha(r, 10, pendenteDaLinha(emprestimo));
  conferir("a pool ganha a taxa por fora", perto(comoPool.ganho, 0.0075));
  conferir("o empréstimo não ganha nada por fora", perto(comoEmp.ganho, 0),
    "se ganhasse, seria juro contado duas vezes");
}

// ---------------------------------------------------------------------------
titulo("Quando a conta não fecha, ela diz");

{
  const r = resumoDosMovimentos([
    mov("aporte", 10),
    { chave: "x", tipo: "aporte", valor: 300, moeda: "BRL", valor_usd: null, quando: "2026-09-08" },
  ]);
  conferir("o aporte em real sem cotação é contado como faltando", r.semCambio === 1);
  conferir("e não entrou no custo", perto(r.custo, 10),
    "melhor um custo incompleto que ele SABE que está incompleto");

  const res = resultadoDaLinha(r, 12, 0);
  conferir("o resultado se declara incompleto", res.completa === false);
  conferir("e diz quantos ficaram de fora", res.semCambio === 1);
}

{
  const r = resumoDosMovimentos([mov("aporte", 10)]);
  const res = resultadoDaLinha(r, 10, null);
  conferir("sem leitura das taxas, o pendente vem null", res.pendente === null);
  conferir("e a conta se declara incompleta", res.completa === false,
    "não consegui ler as taxas é diferente de as taxas serem zero");
  conferir("mas o ganho ainda sai, sem inventar taxa", perto(res.ganho, 0));
}

// ---------------------------------------------------------------------------
titulo("As bordas que viram número maluco na tela");

{
  conferir("linha sem lançamento nenhum não vira resultado",
    resultadoDaLinha(resumoDosMovimentos([]), 10, 0) === null);
  conferir("sem saber quanto vale hoje, também não",
    resultadoDaLinha(resumoDosMovimentos([mov("aporte", 10)]), null, 0) === null);

  /* Ele sacou mais do que pôs: daqui pra frente é tudo lucro, e a
     porcentagem perde o sentido. Melhor não mostrar do que mostrar 900%. */
  const r = resumoDosMovimentos([mov("aporte", 10), mov("saque", 12)]);
  const res = resultadoDaLinha(r, 1, 0);
  conferir("custo negativo não vira porcentagem", res.pct === null);
  conferir("mas o ganho continua certo", perto(res.ganho, 3),
    "tirou 12 de uma entrada de 10 e ainda sobra 1 valendo");

  const zerado = resultadoDaLinha(resumoDosMovimentos([mov("aporte", 5), mov("saque", 5)]), 2, 0);
  conferir("custo zero também não vira porcentagem", zerado.pct === null,
    "dividir por zero daria Infinity na tela");
}

// ---------------------------------------------------------------------------
titulo("A data de 'desde quando' vem do primeiro aporte");

{
  const r = resumoDosMovimentos([
    mov("colheita", 1, { quando: "2026-03-01" }),
    mov("aporte", 10, { quando: "2026-02-10" }),
    mov("aporte", 5, { quando: "2026-05-20" }),
  ]);
  conferir("é o aporte mais antigo", r.desde === "2026-02-10",
    "e não a colheita, que é mais antiga que o segundo aporte");
  conferir("e os contadores separam os tipos",
    r.quantos.aporte === 2 && r.quantos.colheita === 1 && r.quantos.saque === 0);
}

// ---------------------------------------------------------------------------
titulo("Conferir um lançamento antes de gravar, e dizer o motivo");

{
  conferir("tipo desconhecido é recusado",
    conferirMovimento({ chave: "x", tipo: "resgate", valor: 1 }) !== null);
  conferir("valor zero é recusado",
    conferirMovimento({ chave: "x", tipo: "aporte", valor: 0 }) !== null);
  conferir("valor negativo é recusado",
    conferirMovimento({ chave: "x", tipo: "aporte", valor: -5 }) !== null,
    "quem diz a direção é o tipo, não o sinal");
  conferir("real sem cotação é recusado",
    conferirMovimento({ chave: "x", tipo: "aporte", valor: 300, moeda: "BRL" }) !== null,
    "melhor recusar na hora que guardar um lançamento que nunca entraria na conta");
  conferir("real COM cotação passa",
    conferirMovimento({ chave: "x", tipo: "aporte", valor: 300, moeda: "BRL", valor_usd: 55 }) === null);
  conferir("sem a linha é recusado",
    conferirMovimento({ tipo: "aporte", valor: 10 }) !== null);
  conferir("um aporte normal passa", conferirMovimento(mov("aporte", 10)) === null);

  /* O motivo é TEXTO, não `false`. "Não deu certo" sem dizer por quê é a mesma
     família de erro que apagou os lançamentos dele em silêncio. */
  conferir("o motivo é uma frase legível",
    typeof conferirMovimento({ chave: "x", tipo: "aporte", valor: 0 }) === "string");
}

// ---------------------------------------------------------------------------
titulo("Os três tipos, e nada além deles");

conferir("são exatamente três", TIPOS.length === 3);
conferir("aporte, saque e colheita",
  TIPOS.indexOf("aporte") >= 0 && TIPOS.indexOf("saque") >= 0 && TIPOS.indexOf("colheita") >= 0);

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
