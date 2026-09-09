/* Prova o modo privado — o olhinho que esconde os valores.
 *
 *   node testar-privado.js
 *
 * Pedido dele em 09/09/2026: "seria legal um iconezinho de um olhinho pra
 * abrir ou fechar, para mostrar ou ocultar os valores caso eu queira divulgar
 * essa parte aqui da tela".
 *
 * A FALHA QUE IMPORTA AQUI É UMA SÓ: um canto esquecido. Esconder 90% dos
 * números não é esconder — é o patrimônio dele aparecendo num vídeo que já foi
 * publicado, num pedaço da tela que ninguém conferiu.
 *
 * Por isso o esconderijo mora DENTRO das três funções que formatam número de
 * dinheiro, e não em cada lugar da tela. Este arquivo prova que são só três, e
 * que quem passa por elas some.
 */

import { readFileSync } from "node:fs";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log("\n" + t);

const fonte = readFileSync("src/painel.js", "utf8");

function pegarFuncao(nome) {
  const i = fonte.indexOf(`function ${nome}(`);
  if (i < 0) throw new Error(`não achei a função ${nome} em src/painel.js`);
  let nivel = 0, j = fonte.indexOf("{", i);
  for (; j < fonte.length; j++) {
    if (fonte[j] === "{") nivel++;
    else if (fonte[j] === "}") { nivel--; if (nivel === 0) return fonte.slice(i, j + 1); }
  }
  throw new Error(`a função ${nome} não fecha`);
}

const tapado = (fonte.match(/var TAPADO = "([^"]+)"/) || [])[1];
if (!tapado) throw new Error("não achei TAPADO em src/painel.js");

function montar(ligado) {
  return new Function(`
    var privado = ${ligado ? "true" : "false"};
    var TAPADO = "${tapado}";
    ${["dinheiroNa", "dinheiroMiudo", "numeroDeToken"].map(pegarFuncao).join("\n")}
    return { dinheiroNa: dinheiroNa, dinheiroMiudo: dinheiroMiudo, numeroDeToken: numeroDeToken };
  `)();
}

const aberto = montar(false);
const fechado = montar(true);

// ---------------------------------------------------------------------------
titulo("Com o olho aberto, tudo aparece");

{
  conferir("o total da carteira", aberto.dinheiroNa(2148.17, "USD").indexOf("2.148,17") >= 0);
  conferir("um valor acima de um centavo usa o formato normal",
    aberto.dinheiroMiudo(0.0348, "USD").indexOf("0,03") >= 0);
  conferir("e abaixo de um centavo abre as seis casas",
    aberto.dinheiroMiudo(0.0000348, "USD").indexOf("0,000035") >= 0,
    "é o pendente de uma pool pequena, e arredondar pra zero esconderia o rendimento");
  conferir("uma quantidade de token", aberto.numeroDeToken(0.0731945).indexOf("0,0731945") >= 0);
}

// ---------------------------------------------------------------------------
titulo("Com o olho fechado, NENHUM número escapa");

{
  /* Os números reais da carteira dele em 09/09/2026 — se algum pedaço deles
     sobrevивesse, apareceria num vídeo. */
  const dele = [
    ["total em dólar", fechado.dinheiroNa(2148.17, "USD"), ["2148", "2.148", "148,17"]],
    ["total em real", fechado.dinheiroNa(11011.94, "BRL"), ["11011", "11.011", "011,94"]],
    ["a Base sólida", fechado.dinheiroNa(1615.95, "USD"), ["1615", "1.615", "615,95"]],
    ["o que falta na Renda passiva", fechado.dinheiroNa(478.13, "USD"), ["478", "13"]],
    ["as taxas pendentes", fechado.dinheiroMiudo(0.0348, "USD"), ["0348", "034800"]],
    ["um ganho pequeno", fechado.dinheiroMiudo(0.0999, "USD"), ["0999", "099900"]],
    ["a quantidade de BTC", fechado.numeroDeToken(0.0731945), ["0731945", "731945"]],
    ["a quantidade de SOL", fechado.numeroDeToken(0.5211407), ["521140", "52114"]],
    ["a quantidade de USDC", fechado.numeroDeToken(418.903215), ["418", "903215"]],
  ];

  dele.forEach(([oQue, saiu, pedacos]) => {
    const vazou = pedacos.find((p) => saiu.indexOf(p) >= 0);
    conferir(oQue + " some", !vazou, vazou ? `vazou "${vazou}" em "${saiu}"` : "");
  });

  conferir("e o que sobra é o símbolo da moeda, pra tela não ficar sem sentido",
    fechado.dinheiroNa(2148.17, "USD").indexOf("US$") === 0);
  conferir("em real também", fechado.dinheiroNa(11011.94, "BRL").indexOf("R$") === 0);
}

// ---------------------------------------------------------------------------
titulo("O que NÃO pode ser escondido");

{
  /* Esconder o "—" de um valor que não existe faria parecer que existe um
     valor escondido. Não sei quanto vale é diferente de não quero mostrar. */
  conferir("valor que não existe continua sendo travessão",
    fechado.dinheiroNa(null, "USD") === "—");
  conferir("quantidade que não existe também", fechado.numeroDeToken(null) === "—");
  conferir("e um número inválido", fechado.dinheiroMiudo(NaN, "USD") === "—");
}

// ---------------------------------------------------------------------------
titulo("São TRÊS portas, e o teste conta");

{
  /* Se alguém criar uma quarta função que formata dinheiro e não passar por
   * estas, o modo privado ganha um buraco silencioso. Este teste não impede —
   * mas deixa o número escrito, pra a próxima pessoa reparar. */
  const portas = ["dinheiroNa", "dinheiroMiudo", "numeroDeToken"];
  portas.forEach((n) => {
    conferir(`${n} confere o modo privado`, pegarFuncao(n).indexOf("privado") >= 0,
      "toda porta por onde sai número de dinheiro tem que olhar o olhinho");
  });

  /* E o estado tem que sobreviver a fechar o app: ele liga o modo privado
     antes de gravar um vídeo, e o vídeo pode continuar depois de um F5. */
  conferir("o modo privado é guardado no aparelho",
    fonte.indexOf('var PRIVADO = "radar:privado"') >= 0 &&
    fonte.indexOf("localStorage.setItem(PRIVADO") >= 0);
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
