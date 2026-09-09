/* Prova a detecção de depósito e saque pelo TAMANHO da posição.
 *
 *   node testar-tamanho.js
 *
 * Ele depositou US$ 10 na Orca e US$ 10 na Kamino direto na plataforma e
 * perguntou: "se eu só adicionar lá, não atualiza na minha carteira?".
 *
 * O valor atualizava; o "quanto você pôs", não. Descobrir quanto tinha
 * entrado de verdade deu uma investigação de quatro transações decodificadas
 * à mão — e o número final, US$ 9,38, não era nem os US$ 10 que ele achava
 * que tinha posto (o auto-swap deixou US$ 0,55 de troco na carteira).
 *
 * NÃO PRECISAVA. A liquidez de uma posição da Orca e a quantidade de cTokens
 * da Kamino só mudam quando ele deposita ou saca:
 *
 *   preço andando     não mexe
 *   taxa acumulando   não mexe (fica guardada fora da posição)
 *   juro da Kamino    não mexe (quem sobe é o câmbio, não a quantidade)
 *
 * Este arquivo prova as duas metades: que o número calculado bate com o
 * depósito real, e que as coisas que NÃO são depósito não disparam nada.
 */

import { readFileSync } from "node:fs";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log("\n" + t);

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
const { mudancaDeTamanho } = new Function(
  `${pegarFuncao(fonte, "mudancaDeTamanho")} return { mudancaDeTamanho: mudancaDeTamanho };`
)();

const perto = (a, b, tol) => Math.abs(a - b) < tol;

// ---------------------------------------------------------------------------
titulo("O caso que calibrou: um depósito na Kamino, um na Orca");

{
  /* KAMINO: os cTokens dobram quando o depósito dobra. Como cToken é
     inteiro na cadeia, a proporção é exata. */
  const antes = { tamanho: "5000000", valor: 25.000000 };
  const pos = { tamanho: "10000000", valor: 50.000000 };   // dobrou

  const m = mudancaDeTamanho(antes, pos);
  conferir("percebe que houve movimento", m !== null);
  conferir("e diz que foi APORTE", m.tipo === "aporte");
  conferir("com o valor perto dos US$ 25", perto(m.quanto, 25.0, 0.02),
    `calculou US$ ${m.quanto.toFixed(4)} — o depósito foi US$ 25,00`);
  conferir("e guarda o tamanho novo pra próxima comparação", m.tamanho === "10000000");
}

{
  /* ORCA. A posição valia US$ 40,00 e passou a valer US$ 76,90 depois do
     depósito. Mas o que ENTROU foram US$ 36,43 — a fatia do valor de hoje que
     corresponde à liquidez nova. O resto da diferença é o preço mexendo:
     valor se mexe com preço, liquidez só com depósito e saque. */
  const antes = { tamanho: "1000000000", valor: 40.000000 };
  const pos = { tamanho: "1900000000", valor: 76.90 };

  const m = mudancaDeTamanho(antes, pos);
  conferir("percebe o depósito na pool", m && m.tipo === "aporte");
  conferir("com o valor perto dos US$ 36,43", perto(m.quanto, 36.4263, 0.02),
    `calculou US$ ${m.quanto.toFixed(4)} — o que entrou foi US$ 36,43`);
  conferir("e não os US$ 36,90 da diferença de valor",
    !perto(m.quanto, 36.9, 0.3),
    "a diferença de valor mistura o depósito com o preço se mexendo");
}

// ---------------------------------------------------------------------------
titulo("O saque, que é onde a conta é mais fácil de errar");

{
  /* Metade sacada: 100 unidades valendo US$ 100, sobram 50 valendo US$ 50.
     Saiu US$ 50. */
  const m = mudancaDeTamanho({ tamanho: "100", valor: 100 }, { tamanho: "50", valor: 50 });
  conferir("metade sacada é reconhecida como saque", m.tipo === "saque");
  conferir("e vale metade", perto(m.quanto, 50, 0.01), `calculou ${m.quanto.toFixed(4)}`);
}

{
  /* Um quarto sacado: 100 unidades a US$ 1, sobram 75 valendo US$ 75.
     Saiu US$ 25 — e este é o caso que pega conta errada, porque 25/75 não é
     25/100 e é fácil dividir pelo lado errado. */
  const m = mudancaDeTamanho({ tamanho: "100", valor: 100 }, { tamanho: "75", valor: 75 });
  conferir("um quarto sacado vale um quarto do original",
    perto(m.quanto, 25, 0.01), `calculou ${m.quanto.toFixed(4)}, esperado 25`);
}

{
  /* Posição fechada: o tamanho foi a zero. Não há valor de que tirar regra de
     três, e o último valor visto é a melhor resposta que existe. */
  const m = mudancaDeTamanho({ tamanho: "100", valor: 42.5 }, { tamanho: "0", valor: 0 });
  conferir("posição fechada é saque", m.tipo === "saque");
  conferir("e é marcada como fechamento", m.fechou === true);
  conferir("valendo o último valor visto", perto(m.quanto, 42.5, 0.001),
    "é o 'quanto fiquei quando saí' que ele pediu");
}

// ---------------------------------------------------------------------------
titulo("O QUE NÃO PODE DISPARAR — metade do valor deste arquivo");

{
  /* O PREÇO ANDOU. A pool vale bem mais, mas a liquidez é a mesma: ele não
     mexeu em nada. Perguntar aqui seria pedir pra ele confirmar um aporte que
     nunca houve — e ensinar a clicar sem ler. */
  const m = mudancaDeTamanho({ tamanho: "1000000000", valor: 9.95 },
                             { tamanho: "1000000000", valor: 14.80 });
  conferir("preço subindo 50% NÃO vira aporte", m === null,
    "a liquidez não mudou, então ele não pôs dinheiro nenhum");

  const caiu = mudancaDeTamanho({ tamanho: "1000000000", valor: 9.95 },
                                { tamanho: "1000000000", valor: 4.10 });
  conferir("e preço caindo pela metade NÃO vira saque", caiu === null);
}

{
  /* O JURO DA KAMINO. Os cTokens ficam parados e o câmbio sobe — é assim que
     o juro é pago. Se eu olhasse o VALOR em vez do tamanho, todo rendimento
     viraria um falso "você depositou?". */
  const m = mudancaDeTamanho({ tamanho: "5000000", valor: 10.00 },
                             { tamanho: "5000000", valor: 10.42 });
  conferir("juro rendendo NÃO vira aporte", m === null,
    "na Kamino a quantidade de cTokens não muda com juro; quem sobe é o câmbio");
}

{
  conferir("primeira olhada não pergunta nada",
    mudancaDeTamanho(null, { tamanho: "100", valor: 10 }) === null,
    "não há de onde ter mudado");
  conferir("posição sem tamanho lido não pergunta",
    mudancaDeTamanho({ tamanho: "100", valor: 10 }, { valor: 10 }) === null);
  conferir("tamanho que não é número não quebra a tela",
    mudancaDeTamanho({ tamanho: "100", valor: 10 }, { tamanho: "abacaxi", valor: 10 }) === null);
  conferir("sem leitura nenhuma", mudancaDeTamanho(null, null) === null);
}

// ---------------------------------------------------------------------------
titulo("Números grandes: os dígitos finais são os que importam");

{
  /* A liquidez de uma posição da Orca passa de 10^18. Em Number, dois valores
     que diferem no último dígito viram o MESMO número — e é exatamente essa
     diferença que distingue "mudou" de "não mudou". Por isso o tamanho viaja
     como texto e a comparação é em BigInt. */
  const a = "123456789012345678901";
  const b = "123456789012345678902";   // um a mais, no último dígito
  conferir("em Number os dois seriam iguais", Number(a) === Number(b),
    "é o motivo de a comparação NÃO poder ser feita em Number");
  conferir("mas a detecção vê a diferença",
    mudancaDeTamanho({ tamanho: a, valor: 100 }, { tamanho: b, valor: 100 }) !== null);
  conferir("e tamanhos idênticos continuam sem disparar",
    mudancaDeTamanho({ tamanho: a, valor: 100 }, { tamanho: a, valor: 100 }) === null);
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
