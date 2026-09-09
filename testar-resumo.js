/* Prova o resumo da carteira: os pedaços da pizza e o ranking.
 *
 *   node testar-resumo.js
 *
 * Pedido dele em 08/09/2026: "rankear meus tokens por quantidade ou %... um
 * gráfico em formato de pizza com legendas mostrando como se encontra meu
 * portfólio hoje em dia".
 *
 * A CARTEIRA DAS CONFERÊNCIAS É A DELE, de 08/09/2026, com os números que
 * estavam na tela: BTC, USDC, duas reservas em real, a pool da Orca, o
 * empréstimo na Kamino e SOL solto. Carteira inventada esconde exatamente os
 * casos que a dele tem — a linha sem preço lido, a reserva fora de cadeia, a
 * posição que vale zero.
 *
 * O QUE ESTE ARQUIVO GUARDA DE VERDADE: que linha sem valor NÃO entra como
 * zero. Se entrasse, a fatia de todo mundo encolheria e a pizza mentiria
 * calada — que é o pior jeito de uma tela errar.
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

/* CAIXAS e caixaDe vêm do próprio painel: se ele ganhar uma caixinha nova e
   este teste tiver a lista copiada, o teste passa e a tela erra. */
const iCaixas = fonte.indexOf("var CAIXAS = [");
const CAIXAS_TXT = fonte.slice(iCaixas, fonte.indexOf("];", iCaixas) + 2);

const amb = new Function(`
  ${CAIXAS_TXT}
  ${pegarFuncao(fonte, "caixaDe")}
  ${pegarFuncao(fonte, "podeSeguir")}
  ${pegarFuncao(fonte, "temLancamento")}
  ${pegarFuncao(fonte, "ondeEsta")}
  ${pegarFuncao(fonte, "nomeDoPedaco")}
  ${pegarFuncao(fonte, "pedacosDoPortfolio")}
  ${pegarFuncao(fonte, "corDoPedaco")}
  ${pegarFuncao(fonte, "pedacoDaRosca")}
  ${pegarFuncao(fonte, "desenhoDaPizza")}
  return { ondeEsta, nomeDoPedaco, pedacosDoPortfolio, corDoPedaco, desenhoDaPizza };
`)();

const { ondeEsta, nomeDoPedaco, pedacosDoPortfolio, corDoPedaco, desenhoDaPizza } = amb;

/* Uma carteira de exemplo, em dólar, com a forma da real que calibrou a tela. */
const l = (f, convertido) => ({ f, convertido, pct: null });

const carteira = () => ({
  linhas: [
    l({ chave: "a", caixa: "base", fatia: "BTC", token: "BTC", quantidade: "0.0731945" }, 2400.00),
    l({ chave: "b", caixa: "caixa", fatia: "USDC", token: "USDC", quantidade: "418.903215",
        mint: "EPjF...v" }, 418.90),
    l({ chave: "c", caixa: "caixa", fatia: "Reserva de Emergência", valor: "2500", moeda: "BRL" }, 500.00),
    l({ chave: "d", caixa: "caixa", fatia: "Reserva de Oportunidade", valor: "600", moeda: "BRL" }, 120.00),
    l({ chave: "e", caixa: "renda", fatia: "SOL/USDC na Orca", posicao: "Hx1...", onde: "orca" }, 80.00),
    l({ chave: "f", caixa: "renda", fatia: "USDC na Kamino", posicao: "Kb2...", onde: "kamino" }, 40.00),
    l({ chave: "g", caixa: "volatil", fatia: "SOL", token: "SOL", quantidade: "0.5211407",
        mint: "So111...1" }, 60.00),
  ],
});

titulo("Onde o dinheiro está pousado — o corte que não existia");
conferir("posição na Orca conta como Orca", ondeEsta({ posicao: "x", onde: "orca" }) === "Orca");
conferir("e na Kamino como Kamino", ondeEsta({ posicao: "x", onde: "kamino" }) === "Kamino");
conferir("posição sem nome de protocolo não vira nome inventado",
  ondeEsta({ posicao: "x" }) === "posição on-chain");
conferir("token que segue a carteira está solto nela",
  ondeEsta({ token: "SOL", mint: "So1" }) === "solto na carteira");
conferir("token sem mint está fora da carteira (corretora)",
  ondeEsta({ token: "BTC" }) === "fora da carteira",
  "o BTC dele está em corretora, não na carteira Solana");
conferir("a reserva em real está fora de cadeia",
  ondeEsta({ valor: "2500", moeda: "BRL" }) === "fora de cadeia",
  "e isso é informação: ela não corre risco de plataforma nenhum");

titulo("Os três cortes olham a MESMA carteira");
const porCaixa = pedacosDoPortfolio(carteira(), "caixa");
const porToken = pedacosDoPortfolio(carteira(), "token");
const porOnde = pedacosDoPortfolio(carteira(), "onde");

const soma = (r) => r.pedacos.reduce((t, p) => t + p.valor, 0);
conferir("o total não muda de corte para corte",
  Math.abs(soma(porCaixa) - soma(porToken)) < 0.01 &&
  Math.abs(soma(porCaixa) - soma(porOnde)) < 0.01,
  `${soma(porCaixa)} / ${soma(porToken)} / ${soma(porOnde)}`);
conferir("e bate com a soma das linhas", Math.abs(soma(porCaixa) - 3618.90) < 0.01, String(soma(porCaixa)));
conferir("as porcentagens somam 100",
  Math.abs(porCaixa.pedacos.reduce((t, p) => t + p.pct, 0) - 100) < 0.001);

titulo("Por caixinha");
conferir("Base sólida é o maior pedaço", porCaixa.pedacos[0].nome === "Base sólida");
conferir("e vale 66.3% do total", Math.abs(porCaixa.pedacos[0].pct - 66.32) < 0.1,
  porCaixa.pedacos[0].pct.toFixed(2));
conferir("Caixa junta as três linhas dela",
  porCaixa.pedacos.find((p) => p.nome === "Caixa").quantas === 3);
conferir("caixinha vazia não vira fatia de zero",
  !porCaixa.pedacos.some((p) => p.nome === "Aprender"),
  "fatia de zero grau não desenha e polui a legenda");

titulo("Por token");
conferir("BTC aparece pelo símbolo", porToken.pedacos[0].nome === "BTC");
conferir("as duas reservas viram um pedaço só, 'reais'",
  porToken.pedacos.find((p) => p.nome === "reais").quantas === 2,
  "elas são a mesma coisa para quem olha por token");
conferir("e somam 620,00", Math.abs(porToken.pedacos.find((p) => p.nome === "reais").valor - 620.00) < 0.01);
conferir("a posição sem token usa o nome da linha",
  porToken.pedacos.some((p) => p.nome === "SOL/USDC na Orca"));

titulo("Por onde está — risco de plataforma");
const acha = (n) => porOnde.pedacos.find((p) => p.nome === n);
conferir("a Kamino guarda exatamente os US$ 40", Math.abs(acha("Kamino").valor - 40) < 0.01);
conferir("a Orca exatamente os US$ 80,00", Math.abs(acha("Orca").valor - 80.00) < 0.01);
conferir("fora de cadeia são as duas reservas", acha("fora de cadeia").quantas === 2);
conferir("e o BTC não é contado como se estivesse na carteira Solana",
  acha("fora da carteira").quantas === 1 && Math.abs(acha("fora da carteira").valor - 2400.00) < 0.01);
conferir("na cadeia, o que corre risco de protocolo é 3.3% do total",
  Math.abs((acha("Kamino").pct + acha("Orca").pct) - 3.32) < 0.1,
  (acha("Kamino").pct + acha("Orca").pct).toFixed(2));

titulo("A linha sem valor NÃO entra como zero");
const cega = carteira();
cega.linhas[4].convertido = null;         // a Orca não foi lida
const semOrca = pedacosDoPortfolio(cega, "onde");
conferir("ela é contada à parte", semOrca.foraDaConta === 1);
conferir("e não vira uma fatia de zero", !semOrca.pedacos.some((p) => p.nome === "Orca"));
conferir("o total encolhe pelo valor dela, e por mais nada",
  Math.abs(soma(semOrca) - (3618.90 - 80.00)) < 0.01, String(soma(semOrca)));
conferir("as porcentagens continuam somando 100 sobre o que foi lido",
  Math.abs(semOrca.pedacos.reduce((t, p) => t + p.pct, 0) - 100) < 0.001,
  "se a linha cega entrasse como zero, todas as outras fatias encolheriam calladas");

titulo("Casos que quebrariam o desenho");
conferir("carteira sem nada devolve lista vazia, não erro",
  pedacosDoPortfolio({ linhas: [] }, "caixa").pedacos.length === 0);
conferir("e o desenho dela é vazio, não um arco quebrado",
  desenhoDaPizza([]) === "");
conferir("uma fatia só vira círculo inteiro, não um arco de 360 que não desenha",
  desenhoDaPizza([{ valor: 10 }]).includes("<circle"),
  "arco com começo igual ao fim some da tela sem dar erro");
conferir("duas fatias viram dois caminhos",
  (desenhoDaPizza([{ valor: 1 }, { valor: 1 }]).match(/<path/g) || []).length === 2);
conferir("valor total zero não desenha nada", desenhoDaPizza([{ valor: 0 }, { valor: 0 }]) === "");
conferir("linha com valor zero fica de fora da pizza",
  pedacosDoPortfolio({ linhas: [l({ caixa: "base", fatia: "fechada" }, 0)] }, "caixa").pedacos.length === 0,
  "posição fechada vale zero de verdade — e zero não é fatia");

titulo("As cores da legenda");
conferir("vizinhos nunca recebem a mesma cor",
  corDoPedaco(0) !== corDoPedaco(1) && corDoPedaco(1) !== corDoPedaco(2));
conferir("e ficam longe no círculo de matizes",
  new Set([0, 1, 2, 3, 4, 5, 6].map(corDoPedaco)).size === 7,
  "cor repetida perto faz a legenda deixar de ligar cor a nome");

console.log("\n" + "-".repeat(60));
if (falhou) { console.log(`${falhou} FALHARAM (de ${passou + falhou})`); process.exit(1); }
console.log(`TUDO VERDE — ${passou} conferências`);
