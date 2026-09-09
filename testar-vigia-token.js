/* Prova o vigia dos tokens: token novo e cruzamento do preço médio.
 *
 *   node testar-vigia-token.js
 *
 * Duas conferências mandam aqui, e são as mesmas do vigia das posições:
 *
 * 1. QUANDO CALAR. A carteira dele tem uma dúzia de tokens de poeira somando
 *    menos de dois dólares. Avisar de cada um transformaria o aviso de token
 *    novo em ruído no primeiro dia — e ruído é o que faz alguém desligar o
 *    bot, e bot desligado não avisa nada.
 *
 * 2. NENHUMA FRASE MANDA FAZER NADA. "Passou do seu preço médio" é fato.
 *    "Hora de vender" seria palpite sobre um futuro que ninguém tem.
 *
 * E há uma terceira, que é sobre mim: a conta do preço médio existe DUAS vezes
 * — aqui e dentro do painel, que roda no navegador e não consegue importar
 * deste arquivo. O último bloco arranca as duas e exige o mesmo número.
 */

import { readFileSync } from "node:fs";
import {
  MINIMO_PRA_AVISAR, precoMedio, ladoDoPreco,
  tokensNovos, avisoDeTokenNovo, avisoDeCruzamento, olharToken,
} from "./src/vigia-token.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log("\n" + t);
const perto = (a, b, tol) => Math.abs(a - b) < tol;

/* Um histórico de exemplo com a FORMA do real que calibrou este vigia:
 * compras de vários tamanhos, em preços diferentes, e uma venda no meio —
 * porque a venda é o que testa os dois descontos ao mesmo tempo. */
const comprasDoBtc = [
  { tipo: "aporte", valor_usd: 500.00, qtd_a: 0.00600000 },
  { tipo: "aporte", valor_usd: 100.00, qtd_a: 0.00125000 },
  { tipo: "aporte", valor_usd: 250.00, qtd_a: 0.00300000 },
  { tipo: "aporte", valor_usd: 400.00, qtd_a: 0.00470000 },
  { tipo: "aporte", valor_usd: 50.00,  qtd_a: 0.00058000 },
  { tipo: "aporte", valor_usd: 25.00,  qtd_a: 0.00030000 },
  { tipo: "aporte", valor_usd: 75.00,  qtd_a: 0.00090000 },
  { tipo: "saque",  valor_usd: 60.00,  qtd_a: 0.00070000 },
  { tipo: "aporte", valor_usd: 40.00,  qtd_a: 0.00050000 },
  { tipo: "aporte", valor_usd: 30.00,  qtd_a: 0.00036000 },
  { tipo: "aporte", valor_usd: 20.00,  qtd_a: 0.00025000 },
  { tipo: "aporte", valor_usd: 45.00,  qtd_a: 0.00054000 },
  { tipo: "aporte", valor_usd: 35.00,  qtd_a: 0.00042000 },
  { tipo: "aporte", valor_usd: 80.00,  qtd_a: 0.00095000 },
];

// ---------------------------------------------------------------------------
titulo("O preço médio, com um histórico cheio");

{
  const pm = precoMedio(comprasDoBtc);
  conferir("soma 0,01905 BTC", perto(pm.qtd, 0.01905, 1e-8));
  conferir("custo de US$ 1.590,00", perto(pm.custo, 1590, 0.01));
  conferir("preço médio de US$ 83.465", perto(pm.medio, 83464.57, 1),
    `deu ${pm.medio.toFixed(2)}`);
  conferir("a venda desconta dos dois lados", pm.qtd < 0.021,
    "senão os 0,00070000 BTC vendidos entrariam como se ainda estivessem lá");
}

{
  conferir("sem lançamento, não há preço médio", precoMedio([]) === null);
  conferir("só colheita não faz preço médio",
    precoMedio([{ tipo: "colheita", valor_usd: 5 }]) === null);
  conferir("lançamento sem quantidade não vira preço médio",
    precoMedio([{ tipo: "aporte", valor_usd: 100 }]) === null,
    "dinheiro sem token não diz por quanto ele comprou");
  conferir("vendeu tudo: não há preço médio do que não existe",
    precoMedio([
      { tipo: "aporte", valor_usd: 100, qtd_a: 1 },
      { tipo: "saque", valor_usd: 120, qtd_a: 1 },
    ]) === null);
}

// ---------------------------------------------------------------------------
titulo("Token novo: o que merece mensagem e o que é poeira");

{
  const carteira = [
    { mint: "So111", simbolo: "SOL",     quantidade: 0.1631, valor: 16.97 },
    { mint: "EPjFW", simbolo: "USDC",    quantidade: 52.42,  valor: 52.42 },
    { mint: "2b1kV", simbolo: "PYUSD",   quantidade: 0.86,   valor: 0.86 },
    { mint: "PAYmo", simbolo: "PAYAI",   quantidade: 54.17,  valor: 0.30 },
    { mint: "SoLiD", simbolo: "$SOLID",  quantidade: 4353,   valor: 0.60 },
    { mint: "semPr", simbolo: "?",       quantidade: 900,    valor: null },
  ];

  const novos = tokensNovos(carteira, ["EPjFW"], []);
  const simbolos = novos.map((t) => t.simbolo);

  conferir("o SOL de US$ 16,97 entra", simbolos.indexOf("SOL") >= 0);
  conferir("o USDC já lançado não entra", simbolos.indexOf("USDC") < 0);
  conferir("o PYUSD de 86 centavos NÃO entra", simbolos.indexOf("PYUSD") < 0,
    "abaixo de um dólar é poeira, e poeira vira ruído");
  conferir("o PAYAI de 30 centavos não entra", simbolos.indexOf("PAYAI") < 0);
  conferir("o token sem cotação não entra", simbolos.indexOf("?") < 0,
    "sem preço eu não sei se é poeira ou patrimônio, e calar erra menos");
  conferir("sobra um só", novos.length === 1,
    "numa carteira com doze tokens de poeira, o aviso tem que sair uma vez, não doze");

  conferir("o que já foi visto não repete",
    tokensNovos(carteira, ["EPjFW"], ["So111"]).length === 0,
    "senão ele receberia a mesma mensagem em toda rodada");

  conferir("o corte é um dólar", MINIMO_PRA_AVISAR === 1);
}

{
  const a = avisoDeTokenNovo({ simbolo: "SOL", quantidade: 0.1631404, valor: 16.97 });
  conferir("o aviso diz o símbolo", a.texto.includes("SOL"));
  conferir("e a quantidade", a.texto.includes("0,1631404"));
  conferir("e o valor", a.texto.includes("16,97"));
  conferir("e explica a consequência de estar fora",
    a.texto.includes("caixinha") && a.texto.includes("porcentagens"),
    "token fora de caixinha não conta no B.A.R.C.A., e ele precisa saber disso");
}

// ---------------------------------------------------------------------------
titulo("O cruzamento do preço médio: só na travessia");

{
  const MEDIO = 83464.57;

  conferir("acima do médio é 'acima'", ladoDoPreco(90000, MEDIO) === "acima");
  conferir("abaixo é 'abaixo'", ladoDoPreco(78849, MEDIO) === "abaixo");
  conferir("exatamente no médio conta como acima", ladoDoPreco(MEDIO, MEDIO) === "acima");
  conferir("sem preço não há lado", ladoDoPreco(0, MEDIO) === null);

  const subiu = avisoDeCruzamento("BTC", "abaixo", "acima", MEDIO, 90000);
  conferir("subindo, avisa que passou", subiu.tipo === "cruzou-acima");
  conferir("e mostra os dois preços",
    subiu.texto.includes("83.464,57") && subiu.texto.includes("90.000,00"));
  conferir("e a diferença em porcentagem", subiu.texto.includes("+7,8%"),
    `saiu: ${subiu.texto.match(/[+-][\d,]+%/)}`);

  const caiu = avisoDeCruzamento("BTC", "acima", "abaixo", MEDIO, 78849.72);
  conferir("caindo, avisa que caiu", caiu.tipo === "cruzou-abaixo");
  conferir("e diz o que isso significa", caiu.texto.includes("valendo menos do que você pagou"));

  conferir("continuar abaixo NÃO avisa",
    avisoDeCruzamento("BTC", "abaixo", "abaixo", MEDIO, 70000) === null,
    "senão ele receberia a mesma frase todo dia enquanto estivesse no vermelho");
  conferir("continuar acima também não",
    avisoDeCruzamento("BTC", "acima", "acima", MEDIO, 95000) === null);
  conferir("sem lado anterior, cala",
    avisoDeCruzamento("BTC", null, "abaixo", MEDIO, 70000) === null,
    "primeira olhada não tem de onde ter cruzado");
}

// ---------------------------------------------------------------------------
titulo("Nenhuma frase manda fazer nada");

{
  const PROIBIDO = /\b(saia|venda|compre|realize|feche|desfaça|segure|aguarde|espere|deveria|recomendo|sugiro|melhor|aproveite)\b/i;
  const textos = [
    avisoDeTokenNovo({ simbolo: "SOL", quantidade: 0.16, valor: 16.97 }).texto,
    avisoDeCruzamento("BTC", "abaixo", "acima", 83464.57, 95000).texto,
    avisoDeCruzamento("BTC", "acima", "abaixo", 83464.57, 70000).texto,
  ];
  const culpada = textos.find((t) => PROIBIDO.test(t));
  conferir("nenhum aviso usa verbo de ordem", !culpada, culpada || "");
  conferir("mas todos dizem o que ESTÁ acontecendo", textos.every((t) => t.length > 80));
}

// ---------------------------------------------------------------------------
titulo("O olhar completo, com o caso real dele");

{
  /* O BTC está a US$ 78.849 contra um médio de US$ 89.084 — abaixo. */
  const r = olharToken("BTC", comprasDoBtc, 78849.72, "acima");
  conferir("percebe que está abaixo", r.lado === "abaixo");
  conferir("e avisa a queda", r.aviso && r.aviso.tipo === "cruzou-abaixo");

  const parado = olharToken("BTC", comprasDoBtc, 78849.72, "abaixo");
  conferir("no dia seguinte, calado", parado.aviso === null);
  conferir("mas continua sabendo o lado", parado.lado === "abaixo");

  const semCompras = olharToken("SOL", [], 104, null);
  conferir("token sem compras lançadas não tem o que cruzar", semCompras.aviso === null);
  conferir("e nem lado", semCompras.lado === null);
}

// ---------------------------------------------------------------------------
titulo("A conta do preço médio é a MESMA no bot e na tela");

{
  /* Ela existe duas vezes: aqui e dentro do painel, que roda no navegador e
   * não consegue importar deste arquivo. Duas cópias divergem no primeiro
   * conserto feito num lugar só — então aqui elas são obrigadas a concordar. */
  const fonte = readFileSync("src/painel.js", "utf8");
  const i = fonte.indexOf("function precoMedioDoToken(");
  if (i < 0) throw new Error("não achei precoMedioDoToken em src/painel.js");
  let n = 0, j = fonte.indexOf("{", i), fim = -1;
  for (; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}") { n--; if (n === 0) { fim = j + 1; break; } }
  }
  const iM = fonte.indexOf("function movEmDolar(");
  let n2 = 0, j2 = fonte.indexOf("{", iM), fimM = -1;
  for (; j2 < fonte.length; j2++) {
    if (fonte[j2] === "{") n2++;
    else if (fonte[j2] === "}") { n2--; if (n2 === 0) { fimM = j2 + 1; break; } }
  }
  const { precoMedioDoToken } = new Function(
    `${fonte.slice(iM, fimM)}\n${fonte.slice(i, fim)} return { precoMedioDoToken: precoMedioDoToken };`
  )();

  [comprasDoBtc,
   [{ tipo: "aporte", valor_usd: 100, qtd_a: 2 }],
   [{ tipo: "aporte", valor_usd: 100, qtd_a: 2 }, { tipo: "saque", valor_usd: 60, qtd_a: 1 }],
  ].forEach((movs, k) => {
    const aqui = precoMedio(movs);
    const naTela = precoMedioDoToken(movs.map((m) => ({ ...m, moeda: "USD", valor: m.valor_usd })), 0);
    conferir(`caso ${k + 1}: o preço médio bate`,
      Math.abs(aqui.medio - naTela.medio) < 1e-9,
      `bot ${aqui.medio} vs tela ${naTela && naTela.medio}`);
    conferir(`caso ${k + 1}: e a quantidade também`,
      Math.abs(aqui.qtd - naTela.qtd) < 1e-12);
  });
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
