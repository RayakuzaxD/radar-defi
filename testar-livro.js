/* O livro-razão: um lugar só decide o que é lucro e o que é dinheiro andando.
 *
 *   node testar-livro.js
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE ARQUIVO GUARDA
 *
 * Um pedido dele, de 11/09/2026, depois de eu consertar o MESMO erro cinco
 * vezes em cinco lugares:
 *
 *   "sei que consegue criar uma lógica/regra pra isso não confundir mais,
 *    faça isso"
 *
 * A regra está em src/livro.js. Este arquivo guarda as três espécies, as três
 * telas erradas que elas existem pra impedir, e — o mais importante — o BLOCO
 * FINAL, que confere que ninguém mais decide isso por conta própria.
 *
 * Sem o bloco final, esta regra dura até o próximo conserto apressado.
 */

import { readFileSync } from "node:fs";
import {
  NOVO, REMANEJO, RENDIMENTO, especieDo, valorDo, montarLivro,
  dinheiroNovo, novoPorDia, fluxoDaLinha, colheitaDaLinha, sombrasPorToken,
  temRastro,
} from "./src/livro.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log("  ok   " + oQue); }
  else { falhou++; console.log("  FALHOU  " + oQue + (det ? " — " + det : "")); }
}
const titulo = (t) => console.log("\n" + t);
const perto = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

/* A carteira em miniatura, com as três situações que importam. */
const linhas = [
  { chave: "btc", token: "BTC", quantidade: 1 },
  { chave: "usdc", token: "USDC", quantidade: 0 },
  { chave: "poolRastro", posicao: "P1", valor_entrada: 200, data_entrada: "2026-09-09" },
  { chave: "poolCega", posicao: "P2", valor_entrada: 50, data_entrada: "2026-09-09" },
];

/* ------------------------------------------------------------------------ */
titulo("AS TRÊS ESPÉCIES, E SÓ EXISTEM ESTAS TRÊS");
{
  conferir("compra de token é dinheiro NOVO",
    especieDo({ tipo: "aporte", valor_usd: 100 }, false) === NOVO);
  conferir("venda de token também",
    especieDo({ tipo: "saque", valor_usd: 100 }, false) === NOVO);
  conferir("colheita é RENDIMENTO, em qualquer linha",
    especieDo({ tipo: "colheita", valor_usd: 5 }, true) === RENDIMENTO &&
    especieDo({ tipo: "colheita", valor_usd: 5 }, false) === RENDIMENTO);

  /* A PERGUNTA ÚNICA: dá pra ver o outro lado? Dinheiro que anda entre linhas
     tem dois lados; se eu enxergo os dois, ele se cancela sozinho. Se só
     enxergo um, tratar como remanejo faria o dinheiro sumir do passado. */
  conferir("mexida em pool COM o outro lado visível é REMANEJO",
    especieDo({ tipo: "saque", valor_usd: 100, qtd_a: 1, simbolo_a: "SOL" }, true) === REMANEJO);
  conferir("mexida em pool que a cadeia contou é REMANEJO",
    especieDo({ tipo: "aporte", valor_usd: 100, daCadeia: true }, true) === REMANEJO);
  conferir("mexida em pool SEM o outro lado é NOVO, e não remanejo",
    especieDo({ tipo: "aporte", valor_usd: 100 }, true) === NOVO,
    "sem rastro, tratar como remanejo faria o dinheiro sumir do passado");

  conferir("movimento de tipo desconhecido não tem espécie",
    especieDo({ tipo: "coisa", valor_usd: 1 }, false) === null);
  conferir("sem movimento, null", especieDo(null, false) === null);
}

/* ------------------------------------------------------------------------ */
titulo("O SINAL É DO PONTO DE VISTA DA LINHA");
{
  conferir("aporte entra na linha, positivo", valorDo({ tipo: "aporte", valor_usd: 10 }) === 10);
  conferir("saque sai dela, negativo", valorDo({ tipo: "saque", valor_usd: 10 }) === -10);
  conferir("valor estragado vira zero, não NaN",
    valorDo({ tipo: "aporte", valor_usd: "abc" }) === 0);
}

/* ------------------------------------------------------------------------ */
titulo("A CADEIA MANDA, E MANDA INTEIRA");
{
  /* Ele lançou o FECHAMENTO mas não o depósito — quem funda pool com dinheiro
     de dentro não lança nada. A cadeia tem os dois. Misturar conta o
     fechamento duas vezes. */
  const movimentos = [
    { chave: "poolRastro", tipo: "saque", valor_usd: 195, quando: "2026-09-11" },
  ];
  const daCadeia = [
    { chave: "poolRastro", tipo: "aporte", valor_usd: 200, quando: "2026-09-09",
      qtd_a: 200, simbolo_a: "USDC" },
    { chave: "poolRastro", tipo: "saque", valor_usd: 195, quando: "2026-09-11",
      qtd_a: 1.95, simbolo_a: "SOL" },
  ];
  const livro = montarLivro({ linhas, movimentos, daCadeia });

  const daPool = livro.porChave.get("poolRastro") || [];
  conferir("a pool com rastro tem DOIS eventos, não três",
    daPool.length === 2, daPool.length + " eventos");
  conferir("e os dois vieram da cadeia",
    daPool.every((e) => e.deOnde === "cadeia"));
  conferir("o lançamento dele foi ignorado nessa posição",
    !daPool.some((e) => e.deOnde === "lancamento"));
  conferir("e ela é marcada como tendo rastro", temRastro(livro, "poolRastro"));

  /* O resultado da pool: entrou 200, voltou 195. Perdeu 5. */
  conferir("o fluxo DA LINHA dá o resultado dela: −5 de saldo",
    perto(fluxoDaLinha(livro, "poolRastro"), 5), String(fluxoDaLinha(livro, "poolRastro")));
}

/* ------------------------------------------------------------------------ */
titulo("AS TRÊS TELAS ERRADAS QUE ISTO EXISTE PRA IMPEDIR");
{
  const movimentos = [
    { chave: "btc", tipo: "aporte", valor_usd: 500, quando: "2026-09-01" },
    { chave: "poolCega", tipo: "aporte", valor_usd: 50, quando: "2026-09-09" },
  ];
  const daCadeia = [
    { chave: "poolRastro", tipo: "aporte", valor_usd: 200, quando: "2026-09-09",
      qtd_a: 200, simbolo_a: "USDC" },
    { chave: "poolRastro", tipo: "saque", valor_usd: 195, quando: "2026-09-11",
      qtd_a: 1.95, simbolo_a: "SOL" },
    { chave: "poolRastro", tipo: "colheita", valor_usd: 3, quando: "2026-09-11",
      qtd_a: 0.03, simbolo_a: "SOL" },
  ];
  const livro = montarLivro({ linhas, movimentos, daCadeia });

  /* 1. "+US$ 101,95 de lucro" num mês em que a pool perdeu dinheiro.
        O saque de uma pool com rastro NÃO é dinheiro saindo do patrimônio. */
  conferir("fechar pool não tira dinheiro do patrimônio",
    perto(dinheiroNovo(livro, "2026-09-10", "2026-09-12"), 0),
    String(dinheiroNovo(livro, "2026-09-10", "2026-09-12")));

  /* 2. "−US$ 194,58" num dia em que o patrimônio mexeu vinte e um.
        Abrir pool com dinheiro de dentro também não é fluxo. Só a pool COM
        rastro entra nesta conferência: a outra existe pra provar o contrário,
        logo abaixo. */
  const soComRastro = montarLivro({
    linhas, movimentos: [], daCadeia: daCadeia.slice(0, 1),
  });
  conferir("abrir pool com dinheiro de dentro também não é",
    perto(dinheiroNovo(soComRastro, "2026-09-08", "2026-09-10"), 0),
    String(dinheiroNovo(soComRastro, "2026-09-08", "2026-09-10")));

  /* 3. A compra de BTC É dinheiro novo, e tem que continuar sendo. Um conserto
        que zera tudo "resolve" os dois de cima e quebra este. */
  conferir("mas comprar BTC continua sendo dinheiro novo",
    perto(dinheiroNovo(livro, "2026-08-31", "2026-09-02"), 500));

  /* E A POOL SEM RASTRO: o aporte CONTA, senão o dinheiro dela aparece do nada
     como lucro no dia em que ela foi aberta. É a assimetria deliberada — sem
     o outro lado visível, remanejo vira invenção. */
  const cego = (livro.porChave.get("poolCega") || [])[0];
  conferir("pool sem rastro: o aporte é NOVO, e não remanejo",
    cego && cego.especie === NOVO, cego && cego.especie);
  conferir("e por isso ele conta como dinheiro entrando",
    perto(dinheiroNovo(livro, "2026-09-08", "2026-09-10"), 50),
    String(dinheiroNovo(livro, "2026-09-08", "2026-09-10")));

  /* A COLHEITA NÃO É FLUXO DE ESPÉCIE NENHUMA — é o lucro. Contá-la apagaria
     o ganho no exato momento em que ele é realizado (receita 3.4). */
  conferir("colheita não entra no dinheiro novo",
    perto(dinheiroNovo(livro, "2026-09-10", "2026-09-12"), 0));
  conferir("mas ela é legível como o que é: rendimento",
    perto(colheitaDaLinha(livro, "poolRastro", "2026-09-10", "2026-09-12"), 3));
}

/* ------------------------------------------------------------------------ */
titulo("AS SOMBRAS: as moedas que a pool devolveu não estavam na linha antes");
{
  const daCadeia = [
    { chave: "poolRastro", tipo: "aporte", valor_usd: 200, quando: "2026-09-09",
      qtd_a: 200, simbolo_a: "USDC" },
    { chave: "poolRastro", tipo: "saque", valor_usd: 195, quando: "2026-09-11",
      qtd_a: 1.95, simbolo_a: "SOL" },
  ];
  const livro = montarLivro({ linhas, movimentos: [], daCadeia });
  const s = sombrasPorToken(livro);

  conferir("o USDC que fundou a pool virou sombra na linha de USDC", s.has("USDC"));
  conferir("e o SOL que voltou virou sombra na linha de SOL", s.has("SOL"));

  /* O TIPO É INVERTIDO: o que saiu da pool ENTROU na linha. */
  conferir("o saque da pool vira aporte na linha de token",
    s.get("SOL")[0].tipo === "aporte", s.get("SOL")[0].tipo);
  conferir("e o aporte na pool vira saque na linha",
    s.get("USDC")[0].tipo === "saque", s.get("USDC")[0].tipo);

  /* Dinheiro NOVO não gera sombra: ele veio de fora e nunca esteve em linha
     nenhuma. Gerar sombra aqui tiraria do passado um dinheiro que não estava
     lá. */
  const comNovo = montarLivro({
    linhas,
    movimentos: [{ chave: "poolCega", tipo: "aporte", valor_usd: 50,
      quando: "2026-09-09", qtd_a: 50, simbolo_a: "USDC" }],
    daCadeia: [],
  });
  const eventoCego = (comNovo.porChave.get("poolCega") || [])[0];
  conferir("pool com quantidade lançada é remanejo (tem o outro lado)",
    eventoCego.especie === REMANEJO);
  conferir("e por isso gera sombra", sombrasPorToken(comNovo).has("USDC"));
}

/* ------------------------------------------------------------------------ */
titulo("O dinheiro novo por dia, que é o formato que a série pede");
{
  const livro = montarLivro({
    linhas,
    movimentos: [
      { chave: "btc", tipo: "aporte", valor_usd: 100, quando: "2026-09-01" },
      { chave: "btc", tipo: "aporte", valor_usd: 50, quando: "2026-09-01" },
      { chave: "btc", tipo: "saque", valor_usd: 20, quando: "2026-09-02" },
    ],
    daCadeia: [],
  });
  const porDia = novoPorDia(livro);
  conferir("dois aportes no mesmo dia somam", perto(porDia["2026-09-01"], 150));
  conferir("e o saque entra negativo", perto(porDia["2026-09-02"], -20));
  conferir("dia sem movimento não vira chave",
    !("2026-09-03" in porDia));
}

/* ------------------------------------------------------------------------ */
titulo("NINGUÉM MAIS DECIDE ISSO SOZINHO");
{
  /* ESTE É O BLOCO QUE ELE PEDIU.
   *
   * A regra não é o arquivo: é o arquivo SER O ÚNICO. Sem esta conferência,
   * o próximo conserto apressado cria a sexta cópia da decisão e o erro volta
   * com outra cara — foi exatamente assim que ele apareceu cinco vezes.
   *
   * A prova é mecânica: fora de livro.js e das cópias literais, nenhum arquivo
   * pode olhar o `tipo` de um movimento pra decidir se ele é lucro. */
  const semCR = (t) => t.split("\r").join("");
  const livroSrc = semCR(readFileSync(new URL("./src/livro.js", import.meta.url), "utf8"));
  const painel = semCR(readFileSync(new URL("./src/painel.js", import.meta.url), "utf8"));
  const patrimonio = semCR(readFileSync(new URL("./src/patrimonio.js", import.meta.url), "utf8"));

  /* 1. A cópia do navegador é literal — senão a regra vale num lado só. */
  const CRASE = String.fromCharCode(96);
  const esperado = livroSrc.slice(livroSrc.indexOf("export const NOVO"))
    .split("export ").join("").split(CRASE).join("'");
  const ini = painel.indexOf("NAO EDITE AQUI <<<<<\n *\n * UM LUGAR SO DECIDE");
  const fim = painel.indexOf("FIM DA COPIA DE src/livro.js");
  conferir("a cópia do livro existe no painel", ini > 0 && fim > ini);
  const dentroDaCopia = painel.slice(painel.indexOf("*/", ini) + 2,
    painel.lastIndexOf("/*", fim));
  conferir("e é idêntica ao módulo, caractere a caractere",
    dentroDaCopia.trim() === esperado.trim(),
    "painel " + dentroDaCopia.trim().length + " × módulo " + esperado.trim().length);

  /* 2. NO PAINEL, FORA DAS CÓPIAS, NINGUÉM DECIDE A ESPÉCIE.
   *
   * As funções de decisão (`fluxoExterno`, `ehRemanejamento`,
   * `fluxoDoPatrimonio`) existem dentro dos módulos e viajam pro painel na
   * cópia literal. O que NÃO pode é o código do painel chamá-las direto: foi
   * assim que a mesma pergunta passou a ter cinco respostas.
   *
   * Quem precisa da classificação pergunta ao livro. */
  const semCopias = (() => {
    let t = painel;
    for (const [abre, fecha] of [
      ["UM LUGAR SO DECIDE", "FIM DA COPIA DE src/livro.js"],
      ["COPIA LITERAL DE src/patrimonio.js", "FIM DA COPIA DE src/patrimonio.js"],
    ]) {
      const i = t.indexOf(abre);
      const f = t.indexOf(fecha);
      if (i > 0 && f > i) t = t.slice(0, i) + t.slice(f);
    }
    return t;
  })();

  const decisores = ["fluxoExterno", "ehRemanejamento", "fluxoDoPatrimonio"];
  const QUEBRA = String.fromCharCode(10);
  const todos = [];
  for (const nome of decisores) {
    const re = new RegExp("\\b" + nome + "\\s*\\(", "g");
    let m;
    while ((m = re.exec(semCopias))) {
      todos.push(nome + " na linha " + semCopias.slice(0, m.index).split(QUEBRA).length);
    }
  }

  conferir("nenhum arquivo decide a espécie por conta própria",
    todos.length === 0,
    todos.length ? "decidem sozinhos: " + todos.join(", ") : "");
}

// ---------------------------------------------------------------------------
/* A CADEIA SÓ MANDA NO QUE ELA LEU INTEIRO.
 *
 * O caso real, com os números dele em 12/09/2026. Uma pool SOL/USDC aberta e
 * fechada em dois dias:
 *
 *   o que ele lançou   3 aportes: 9,92 + 9,38 + 9,51 = 28,81
 *                      1 saque:   28,86
 *                      → ganho de CINCO CENTAVOS
 *
 *   o que a cadeia leu 1 depósito:  9,94
 *                      1 fechamento: 28,96
 *                      → ganho de 19,02
 *
 * A leitura trouxe só uma das três entradas. A regra antiga — "a cadeia manda
 * inteira: onde ela falou, o lançamento dele cala" — apagou os três
 * lançamentos bons e ficou com o pedaço. A pool passou a aparecer rendendo
 * quase o dobro do que chegou a ter dentro, em três janelas ao mesmo tempo.
 *
 * A regra está certa quando a leitura é completa. A correção não é desistir da
 * cadeia: é medir se ela leu tudo. E o teste é o DINHEIRO QUE ENTROU, não a
 * contagem de eventos — contar eventos daria "duas contra quatro" e falharia
 * no dia em que ele lançasse um aporte só onde a cadeia viu dois.
 * ------------------------------------------------------------------------- */
titulo("A cadeia só manda no que ela leu inteiro");

{
  const linhas = [{ chave: "p", posicao: "ALGUMA" }];
  const movimentos = [
    { chave: "p", quando: "2026-09-08", tipo: "aporte", valor_usd: 9.92 },
    { chave: "p", quando: "2026-09-08", tipo: "aporte", valor_usd: 9.38 },
    { chave: "p", quando: "2026-09-08", tipo: "aporte", valor_usd: 9.507822 },
    { chave: "p", quando: "2026-09-09", tipo: "saque", valor_usd: 28.860468 },
  ];
  /* A cadeia viu um depósito só. */
  const daCadeia = [
    { chave: "p", quando: "2026-09-08", tipo: "aporte", valor_usd: 9.938870, qtd_a: 0.048, simbolo_a: "SOL" },
    { chave: "p", quando: "2026-09-09", tipo: "saque", valor_usd: 28.963354, qtd_a: 0.2, simbolo_a: "SOL" },
  ];

  const livro = montarLivro({ linhas, movimentos, daCadeia });
  const eventos = livro.porChave.get("p") || [];
  const entrou = eventos.filter((e) => e.usd > 0).reduce((s, e) => s + e.usd, 0);

  conferir("leitura incompleta não cala os lançamentos dele",
    Math.abs(entrou - 28.807822) < 0.01,
    "entrou " + entrou.toFixed(2) + " — devia ser 28,81, o que ele lançou");
  conferir("e a cadeia pela metade não entra junto (seria contar duas vezes)",
    eventos.every((e) => e.deOnde === "lancamento"),
    eventos.map((e) => e.deOnde).join(", "));
  conferir("a posição não fica marcada como explicada pela cadeia",
    !livro.comCadeia.has("p"));
}

{
  /* E A CADEIA COMPLETA CONTINUA MANDANDO — que é a regra original, e ela
     existe por um motivo bom: a cadeia sabe o valor do instante, que nenhum
     lançamento à mão acerta. */
  const linhas = [{ chave: "p", posicao: "ALGUMA" }];
  const movimentos = [
    { chave: "p", quando: "2026-09-08", tipo: "aporte", valor_usd: 100 },
  ];
  const daCadeia = [
    { chave: "p", quando: "2026-09-08", tipo: "aporte", valor_usd: 99.7, qtd_a: 1, simbolo_a: "SOL" },
    { chave: "p", quando: "2026-09-09", tipo: "saque", valor_usd: 101.2, qtd_a: 1, simbolo_a: "SOL" },
  ];
  const livro = montarLivro({ linhas, movimentos, daCadeia });
  const eventos = livro.porChave.get("p") || [];
  conferir("cadeia completa continua calando o lançamento dele",
    eventos.every((e) => e.deOnde === "cadeia"),
    eventos.map((e) => e.deOnde).join(", "));
  conferir("e a folga de 10% cobre a diferença de preço do instante",
    livro.comCadeia.has("p"), "99,70 contra 100,00 é a mesma entrada");
}

{
  /* Posição SEM lançamento nenhum: a cadeia manda, porque não há com o que
     comparar e ela é a única que sabe. Exigir lançamento aqui apagaria as
     pools que ele montou direto na carteira, sem passar pelo painel. */
  const linhas = [{ chave: "p", posicao: "ALGUMA" }];
  const daCadeia = [
    { chave: "p", quando: "2026-09-11", tipo: "aporte", valor_usd: 99.5, qtd_a: 1, simbolo_a: "SOL" },
  ];
  const livro = montarLivro({ linhas, movimentos: [], daCadeia });
  conferir("sem lançamento pra comparar, a cadeia manda",
    livro.comCadeia.has("p"));
}

{
  /* A colheita não conta como entrada. Se contasse, uma pool cujas taxas a
     cadeia leu passaria por "leitura completa" sem ter visto depósito nenhum. */
  const linhas = [{ chave: "p", posicao: "ALGUMA" }];
  const movimentos = [{ chave: "p", quando: "2026-09-08", tipo: "aporte", valor_usd: 100 }];
  const daCadeia = [
    { chave: "p", quando: "2026-09-09", tipo: "colheita", valor_usd: 100, qtd_a: 1, simbolo_a: "SOL" },
  ];
  const livro = montarLivro({ linhas, movimentos, daCadeia });
  conferir("colheita lida não faz a leitura passar por completa",
    !livro.comCadeia.has("p"),
    "colher não é aportar — a entrada continua não vista");
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
