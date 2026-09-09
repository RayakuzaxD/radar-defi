/* Prova o aviso de "você tem coisa não salva".
 *
 *   node testar-nao-salvo.js
 *
 * Pedido dele em 09/09/2026: "o aviso ajudaria, posso esquecer de salvar, aí
 * escolho se salvo o que fiz ou cancelo".
 *
 * Veio de uma perda de verdade: ele importou o SOL, o app recarregou antes de
 * ele apertar Salvar, e a linha sumiu. Não ficou rastro nenhum — o que não é
 * salvo não deixa marca — e ele ficou sem saber se tinha sido bug ou ele.
 * Duvidar da ferramenta é pior que perder a linha.
 *
 * O TESTE QUE DÁ VALOR AO AVISO É O DO FALSO POSITIVO. Um aviso que aparece
 * quando ele não fez nada é um aviso que se aprende a ignorar — e aviso
 * ignorado não avisa nada no dia em que importa. Metade das conferências aqui
 * é sobre quando ele NÃO pode aparecer.
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
const colunas = (fonte.match(/var COLUNAS_DA_ALOCACAO = (\[[\s\S]*?\]);/) || [])[1];
if (!colunas) throw new Error("não achei COLUNAS_DA_ALOCACAO");

/* Monta o pedaço do painel que decide o aviso, com um estado de mundo que o
   teste controla. */
function mundo() {
  return new Function(`
    var COLUNAS_DA_ALOCACAO = ${colunas};
    var fatias = null, alvos = null, salvoComo = null;
    ${["linhaParaOBanco", "podeSeguir", "seguindo", "aplicarSaldos",
       "retratoDaCarteira", "temCoisaNaoSalva", "marcarComoSalvo"]
      .map((n) => pegarFuncao(fonte, n)).join("\n")}
    return {
      carregar: function (linhas, alv) { fatias = linhas; alvos = alv || {}; marcarComoSalvo(); },
      fatias: function () { return fatias; },
      alvos: function (a) { if (a) alvos = a; return alvos; },
      temCoisaNaoSalva: temCoisaNaoSalva,
      marcarComoSalvo: marcarComoSalvo,
      aplicarSaldos: function (l, s, c) { return aplicarSaldos(l, s, c); },
      esquecer: function () { salvoComo = null; },
    };
  `)();
}

const MINT_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const carteira = () => [
  { chave: "a", fatia: "BTC", token: "BTC", quantidade: 0.0731945, mint: null, ordem: 0, caixa: "base", segue_carteira: true },
  { chave: "b", fatia: "USDC", token: "USDC", quantidade: 64.812300, mint: MINT_USDC, ordem: 1, caixa: "caixa", segue_carteira: true },
  { chave: "c", fatia: "SOL/USDC na Orca", posicao: "PosExemplo1", ordem: 2, caixa: "renda", segue_carteira: true },
];

// ---------------------------------------------------------------------------
titulo("Sem mexer em nada, não avisa");

{
  const m = mundo();
  m.carregar(carteira(), { base: 60, caixa: 10 });
  conferir("carteira recém-carregada não tem coisa pendente", m.temCoisaNaoSalva() === false);
}

{
  const m = mundo();
  conferir("antes de carregar, também não avisa", m.temCoisaNaoSalva() === false,
    "carteira que ainda não chegou não é carteira com mudança");
}

// ---------------------------------------------------------------------------
titulo("O FALSO POSITIVO que mataria o aviso");

{
  /* A blockchain andou: o USDC dele foi de 72,39 para 52,39 porque ele
   * depositou numa pool. A linha segue a carteira, então a quantidade muda
   * SOZINHA, sem ele tocar em nada.
   *
   * Se isso acendesse o aviso, ele veria "você tem coisa não salva" toda vez
   * que abrisse o app — e em uma semana pararia de ler. */
  const m = mundo();
  m.carregar(carteira(), { base: 60 });
  m.aplicarSaldos(m.fatias(), { [MINT_USDC]: 52.399904 }, true);

  conferir("o saldo mudando sozinho NÃO acende o aviso", m.temCoisaNaoSalva() === false,
    "aviso que aparece à toa é aviso que se aprende a ignorar");
  conferir("e a quantidade mudou mesmo", m.fatias()[1].quantidade === 52.399904,
    "senão o teste acima não estaria provando nada");
}

{
  /* Mas a linha que ele TRAVOU não segue a carteira — se a quantidade dela
     mudar, foi ele quem mudou, e isso conta. */
  const m = mundo();
  const l = carteira();
  l[1].segue_carteira = false;
  m.carregar(l, {});
  m.fatias()[1].quantidade = 500;
  conferir("mexer na quantidade de linha travada acende o aviso",
    m.temCoisaNaoSalva() === true);
}

// ---------------------------------------------------------------------------
titulo("O que ELE faz, acende");

{
  const m = mundo();
  m.carregar(carteira(), { base: 60 });
  m.fatias().push({ chave: "d", fatia: "SOL", token: "SOL", quantidade: 0.159, mint: "So111", ordem: 3, caixa: "volatil" });
  conferir("importar uma linha acende o aviso", m.temCoisaNaoSalva() === true,
    "é exatamente o caso do SOL que ele perdeu");
}

{
  const m = mundo();
  m.carregar(carteira(), { base: 60 });
  m.fatias().splice(0, 1);
  conferir("apagar uma linha acende", m.temCoisaNaoSalva() === true);
}

{
  const m = mundo();
  m.carregar(carteira(), { base: 60 });
  m.fatias()[0].caixa = "volatil";
  conferir("mover de caixinha acende", m.temCoisaNaoSalva() === true);
}

{
  const m = mundo();
  m.carregar(carteira(), { base: 60 });
  m.fatias()[0].fatia = "Bitcoin";
  conferir("renomear acende", m.temCoisaNaoSalva() === true);
}

{
  const m = mundo();
  m.carregar(carteira(), { base: 60, caixa: 10 });
  m.alvos({ base: 55, caixa: 10 });
  conferir("mudar um alvo acende", m.temCoisaNaoSalva() === true,
    "o alvo é salvo junto com as linhas, então conta igual");
}

// ---------------------------------------------------------------------------
titulo("Salvar apaga o aviso, e só ele");

{
  const m = mundo();
  m.carregar(carteira(), { base: 60 });
  m.fatias()[0].fatia = "Bitcoin";
  conferir("antes de salvar, acende", m.temCoisaNaoSalva() === true);
  m.marcarComoSalvo();
  conferir("depois de salvar, apaga", m.temCoisaNaoSalva() === false);
  m.fatias()[0].fatia = "BTC de novo";
  conferir("e uma mudança nova acende outra vez", m.temCoisaNaoSalva() === true,
    "o retrato tem que ser o do último salvamento, não o do carregamento");
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
