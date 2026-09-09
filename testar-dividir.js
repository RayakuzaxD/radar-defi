/* Prova a divisão de um valor entre as caixinhas do B.A.R.C.A.
 *
 *   node testar-dividir.js
 *
 * Pedido dele: "faça com dinheiro novo ou trocando parte do dinheiro das
 * próprias caixinhas, fica mais organizado e mais fácil pra eu saber como
 * aportar ou o que fazer".
 *
 * A REGRA DESTE ARQUIVO: nada aqui confere a fórmula contra ela mesma. Toda
 * conferência que importa PÕE O DINHEIRO e refaz a divisão — porque foi assim
 * que eu descobri, na conversa com ele, que a conta de remanejamento não
 * servia pra aporte. Fórmula que se prova sozinha prova o erro junto.
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
const { dividirDinheiro } = new Function(
  `${pegarFuncao(fonte, "dividirDinheiro")} return { dividirDinheiro: dividirDinheiro };`
)();

/* Uma carteira de exemplo com a mesma forma da real: uma caixinha sobrando, duas faltando. */
const TOTAL = 5000.0;
const caixas = () => [
  { chave: "base",    nome: "Base sólida",     tem: 3600, alvo: 60 },
  { chave: "caixa",   nome: "Caixa",           tem: 1000, alvo: 10 },
  { chave: "renda",   nome: "Renda passiva",   tem: 350,  alvo: 25 },
  { chave: "volatil", nome: "Ativos voláteis", tem: 50,   alvo: 5 },
];
const soma = (lista) => lista.reduce((t, x) => t + x.quanto, 0);
const acha = (lista, ch) => lista.find((x) => x.chave === ch);

// ---------------------------------------------------------------------------
titulo("Dinheiro novo: R$ 300 divididos entre o que falta");

{
  const r = dividirDinheiro(caixas(), TOTAL, 300, "novo");

  conferir("divide o valor inteiro", Math.abs(soma(r.partes) - 300) < 0.01,
    `dividiu ${soma(r.partes).toFixed(2)}`);
  conferir("o total depois sobe junto", Math.abs(r.totalDepois - 5300) < 0.01,
    "dinheiro novo entra na carteira, então o alvo é sobre o total maior");

  conferir("nada vai pra Base sólida, que já está acima", !acha(r.partes, "base"));
  conferir("nada vai pra Caixa, que também está acima", !acha(r.partes, "caixa"));
  conferir("vai pra Renda passiva", !!acha(r.partes, "renda"));
  conferir("e pros Ativos voláteis", !!acha(r.partes, "volatil"));

  /* A proporção: Renda passiva falta MUITO mais, então leva a maior parte. */
  conferir("quem falta mais recebe mais",
    acha(r.partes, "renda").quanto > acha(r.partes, "volatil").quanto);
  conferir("Renda passiva leva uns R$ 246",
    Math.abs(acha(r.partes, "renda").quanto - 245.80) < 1,
    `deu ${acha(r.partes, "renda").quanto.toFixed(2)}`);

  /* A CONFERÊNCIA DE VERDADE: põe o dinheiro e refaz as porcentagens. */
  const totalDepois = TOTAL + 300;
  caixas().forEach((c) => {
    const p = acha(r.partes, c.chave);
    const fica = c.tem + (p ? p.quanto : 0);
    const pct = (fica / totalDepois) * 100;
    const daTela = acha(r.depois, c.chave).pctDepois;
    conferir(`${c.nome}: a porcentagem que a tela promete é a que dá`,
      Math.abs(pct - daTela) < 0.001,
      `refazendo a conta deu ${pct.toFixed(2)}%, a tela diz ${daTela.toFixed(2)}%`);
  });

  conferir("as porcentagens depois somam 100",
    Math.abs(r.depois.reduce((t, d) => t + d.pctDepois, 0) - 100) < 0.01);
}

// ---------------------------------------------------------------------------
titulo("Aporte grande: o alvo de TODAS sobe junto");

{
  /* ISTO CORRIGIU UM ERRO MEU DE RACIOCÍNIO, e o teste pegou antes de virar
   * frase errada na tela dele.
   *
   * A intuição diz que um aporte maior que a soma das faltas cobre todas.
   * Não cobre: dinheiro novo sobe O TOTAL, e o alvo de cada caixinha é uma
   * fatia do total. Nesta carteira, com 2.000 dentro, 60% de 7.000 são 4.200 —
   * e a Base sólida, que HOJE está acima do alvo, passa a estar 600 ABAIXO.
   *
   * É contraintuitivo e é verdade: aportar bastante em qualquer lugar faz
   * faltar dinheiro em todas as caixinhas ao mesmo tempo. */
  const r = dividirDinheiro(caixas(), TOTAL, 2000, "novo");
  conferir("divide o valor inteiro", Math.abs(soma(r.partes) - 2000) < 0.01,
    `dividiu ${soma(r.partes).toFixed(2)}`);
  conferir("R$ 2.000 NÃO cobrem todas as faltas", r.cobreTudo === false,
    "porque o próprio aporte levantou o alvo de todo mundo");
  conferir("e agora a Base sólida também recebe", !!acha(r.partes, "base"),
    "ela está 76% hoje, mas 60% de um total maior é mais dinheiro do que ela tem");

  const totalDepois = TOTAL + 2000;
  caixas().forEach((c) => {
    const p = acha(r.partes, c.chave);
    const pct = ((c.tem + (p ? p.quanto : 0)) / totalDepois) * 100;
    const daTela = acha(r.depois, c.chave).pctDepois;
    conferir(`${c.nome}: a porcentagem prometida é a que dá`,
      Math.abs(pct - daTela) < 0.001,
      `refazendo deu ${pct.toFixed(2)}%, a tela diz ${daTela.toFixed(2)}%`);
    /* Só quem RECEBEU pode ser acusado de passar do alvo. A Caixa fica acima
       sem receber nada — está acima porque já estava, e o aporte só diluiu.
       Cobrar dela seria cobrar por dinheiro que ela não recebeu. */
    if (p) {
      conferir(`${c.nome}: recebeu e não passou do alvo`, pct <= c.alvo + 0.01,
        `ficou em ${pct.toFixed(2)}% com alvo ${c.alvo}%`);
    }
  });
}

// ---------------------------------------------------------------------------
titulo("Alvos que não somam 100: aí sim sobra dinheiro");

{
  /* Quando os alvos dele somam menos de 100, um aporte grande cobre todas as
     faltas e ainda sobra. A sobra não pode sumir nem ser escondida: vai pelos
     alvos, que é a única divisão que ele já escolheu. */
  const parciais = [
    { chave: "renda", nome: "Renda", tem: 0, alvo: 20 },
    { chave: "volatil", nome: "Voláteis", tem: 0, alvo: 10 },
  ];
  const r = dividirDinheiro(parciais, 1000, 2000, "novo");
  conferir("cobre todas as faltas", r.cobreTudo === true);
  conferir("e mesmo assim divide o valor inteiro",
    Math.abs(soma(r.partes) - 2000) < 0.01,
    `dividiu ${soma(r.partes).toFixed(2)} — dinheiro que some da divisão é dinheiro que ele perde de vista`);
  conferir("a sobra vai na proporção dos alvos dele",
    Math.abs(acha(r.partes, "renda").quanto / acha(r.partes, "volatil").quanto - 2) < 0.15,
    "20% contra 10% é o dobro");
}

// ---------------------------------------------------------------------------
titulo("Remanejando: o dinheiro sai de quem está acima");

{
  const r = dividirDinheiro(caixas(), TOTAL, 300, "remanejar");

  conferir("o total NÃO muda", Math.abs(r.totalDepois - TOTAL) < 0.01,
    "trocar de lugar não cria nem destrói dinheiro");
  conferir("o que sai é igual ao que entra",
    Math.abs(soma(r.tirando) - soma(r.partes)) < 0.01,
    `sai ${soma(r.tirando).toFixed(2)}, entra ${soma(r.partes).toFixed(2)}`);

  conferir("sai da Base sólida", !!acha(r.tirando, "base"));
  conferir("e da Caixa", !!acha(r.tirando, "caixa"));
  conferir("não sai de quem está faltando", !acha(r.tirando, "renda"));

  /* Confere movendo o dinheiro de verdade. */
  caixas().forEach((c) => {
    const entra = acha(r.partes, c.chave);
    const sai = acha(r.tirando, c.chave);
    const fica = c.tem + (entra ? entra.quanto : 0) - (sai ? sai.quanto : 0);
    const pct = (fica / TOTAL) * 100;
    const daTela = acha(r.depois, c.chave).pctDepois;
    conferir(`${c.nome}: a porcentagem prometida é a que dá`,
      Math.abs(pct - daTela) < 0.001,
      `refazendo deu ${pct.toFixed(2)}%, a tela diz ${daTela.toFixed(2)}%`);
    conferir(`${c.nome}: ninguém fica com valor negativo`, fica >= -0.01);
  });
}

// ---------------------------------------------------------------------------
titulo("Não dá pra tirar mais do que sobra");

{
  /* Sobram 1.100 acima dos alvos (600 na Base, 500 na Caixa). Pedir 5.000
     remanejados é impossível — e a tela precisa DIZER isso, não devolver um
     número inventado. */
  const r = dividirDinheiro(caixas(), TOTAL, 5000, "remanejar");
  conferir("o valor é limitado ao que existe acima do alvo", r.limitado === true);
  conferir("e o limite é o excesso real", Math.abs(r.valor - 1100) < 0.5,
    `limitou em ${r.valor.toFixed(2)}`);
  conferir("o que sai continua igual ao que entra",
    Math.abs(soma(r.tirando) - soma(r.partes)) < 0.01);

  /* Remanejando tudo que sobra, cada caixinha chega no alvo. */
  caixas().forEach((c) => {
    const d = acha(r.depois, c.chave);
    conferir(`${c.nome} chega no alvo de ${c.alvo}%`,
      Math.abs(d.pctDepois - c.alvo) < 0.05,
      `ficou em ${d.pctDepois.toFixed(2)}%`);
  });
}

// ---------------------------------------------------------------------------
titulo("Uma carteira já equilibrada não inventa movimento");

{
  const certas = [
    { chave: "base", nome: "Base", tem: 600, alvo: 60 },
    { chave: "caixa", nome: "Caixa", tem: 100, alvo: 10 },
    { chave: "renda", nome: "Renda", tem: 250, alvo: 25 },
    { chave: "volatil", nome: "Voláteis", tem: 50, alvo: 5 },
  ];
  const r = dividirDinheiro(certas, 1000, 200, "remanejar");
  conferir("nada sobra acima do alvo, então não há o que remanejar",
    r.nada === true || soma(r.partes) < 0.01,
    "inventar um movimento numa carteira certa seria mexer por mexer");
}

// ---------------------------------------------------------------------------
titulo("As bordas que virariam número errado na tela");

{
  conferir("valor zero não vira divisão", dividirDinheiro(caixas(), TOTAL, 0, "novo") === null);
  conferir("valor negativo também", dividirDinheiro(caixas(), TOTAL, -50, "novo") === null);
  conferir("texto no lugar do valor", dividirDinheiro(caixas(), TOTAL, "abacaxi", "novo") === null);
  conferir("sem total, não divide", dividirDinheiro(caixas(), 0, 300, "novo") === null);
  conferir("sem caixinha com alvo, não divide",
    dividirDinheiro([{ chave: "a", nome: "A", tem: 10, alvo: null }], 1000, 300, "novo") === null,
    "sem alvo definido por ELE não há do que se aproximar");
  conferir("lista vazia", dividirDinheiro([], 1000, 300, "novo") === null);

  /* Centavos: dividir R$ 0,03 entre duas caixinhas não pode virar linha de
     R$ 0,00 na tela. */
  const mium = dividirDinheiro(caixas(), TOTAL, 0.03, "novo");
  conferir("valor mínimo não gera linha de zero",
    mium.partes.every((p) => p.quanto > 0.004));
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
