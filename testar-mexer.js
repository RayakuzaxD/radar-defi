/* Prova a conta de somar, tirar e mover dinheiro entre as fatias.
 *
 *   node testar-mexer.js
 *
 * Este é o único lugar do radar onde uma conta errada muda o patrimônio que o
 * Rayakuza vê. Um erro aqui não aparece como tela quebrada: aparece como um número
 * plausível e errado, que ele acredita. Por isso a conferência existe.
 *
 * O problema técnico: essas funções moram DENTRO do template literal do painel
 * (elas rodam no navegador dele), então não dá pra importar. A saída é arrancar
 * o texto de cada função do arquivo e compilá-la aqui, isolada. Não é elegante,
 * mas testa exatamente o código que vai ao ar — que é o que importa.
 */

import { readFileSync } from "node:fs";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

/* Arranca uma função pelo nome, contando chaves. Cru de propósito: nenhuma
 * dessas funções tem chave dentro de string, então contar basta. */
function pegarFuncao(fonte, nome) {
  const i = fonte.indexOf(`function ${nome}(`);
  if (i < 0) throw new Error(`não achei a função ${nome} em src/painel.js`);
  let nivel = 0, j = fonte.indexOf("{", i);
  const inicio = j;
  for (; j < fonte.length; j++) {
    if (fonte[j] === "{") nivel++;
    else if (fonte[j] === "}") { nivel--; if (nivel === 0) return fonte.slice(i, j + 1); }
  }
  throw new Error(`a função ${nome} não fecha`);
}

const fonte = readFileSync("src/painel.js", "utf8");
const semCotacao = (fonte.match(/var SEM_COTACAO = "([^"]+)"/) || [])[1];

const montar = new Function(`
  var moedaVista = "BRL";
  /* O modo privado (o olhinho que esconde os valores) passa por dinheiroNa e
     numeroDeToken. Aqui ele fica desligado: este arquivo mede a conta, e um
     numero tapado nao se confere. */
  var privado = false;
  var TAPADO = "----";
  var SEM_COTACAO = ${JSON.stringify(semCotacao)};
  ${["converterV", "dinheiroNa", "arred", "valorDe", "acharPorOrdem",
     "somarEm", "tirarDe", "mexerNaCarteira",
     "arredQtd", "numeroDeToken", "mexerNaQuantidade"].map((n) => pegarFuncao(fonte, n)).join("\n")}
  return { somarEm: somarEm, tirarDe: tirarDe, mexerNaCarteira: mexerNaCarteira,
           acharPorOrdem: acharPorOrdem, mexerNaQuantidade: mexerNaQuantidade };
`);
const { somarEm, tirarDe, mexerNaCarteira, mexerNaQuantidade } = montar();

const TAXA = 5.40; // um número redondo, pra conta de cabeça bater
const lista = () => [
  { fatia: "reserva", ordem: 0, valor: 20000, moeda: "BRL", alvo: 10 },
  { fatia: "BTC",     ordem: 1, valor: 3000,  moeda: "USD", alvo: 50 },
  { fatia: "altcoins",ordem: 2, valor: null,  moeda: "BRL", alvo: 20 },
];

// ---------------------------------------------------------------------------
titulo("Somar — o aporte");

{
  const f = { fatia: "reserva", valor: 20000, moeda: "BRL" };
  const r = somarEm(f, 300, "BRL", TAXA);
  conferir("real em fatia de real soma direto", f.valor === 20300, `saiu ${f.valor}`);
  conferir("e a fatia continua em real", f.moeda === "BRL");
  conferir("o texto mostra a conta inteira", r.texto.includes("20.000,00") && r.texto.includes("20.300,00"));
}

{
  /* O caso que ele descreveu: "compro 100 dólares em BTC por outra plataforma,
     eu deveria conseguir lançar também e lá converteria". */
  const f = { fatia: "BTC", valor: 3000, moeda: "USD" };
  somarEm(f, 540, "BRL", TAXA);
  conferir("real somado em fatia de dólar entra convertido", f.valor === 3100, `saiu ${f.valor}`);
  conferir("e a fatia NÃO muda de moeda", f.moeda === "USD",
    "se virasse real, a cotação de amanhã mudaria o passado dele");
}

{
  const f = { fatia: "reserva", valor: 20000, moeda: "BRL" };
  const r = somarEm(f, 100, "USD", TAXA);
  conferir("dólar somado em fatia de real vira R$ 540", f.valor === 20540, `saiu ${f.valor}`);
  conferir("e o texto diz quanto deu na conversão", r.texto.includes("540,00"),
    "sem isso ele vê o total mudar e não sabe por quê");
}

{
  const f = { fatia: "altcoins", valor: null, moeda: "BRL" };
  somarEm(f, 100, "USD", TAXA);
  conferir("fatia vazia adota a moeda do primeiro aporte", f.valor === 100 && f.moeda === "USD");
}

conferir("sem cotação, somar moeda diferente é recusado",
  somarEm({ fatia: "BTC", valor: 3000, moeda: "USD" }, 300, "BRL", null).erro != null,
  "chutar cotação seria inventar patrimônio");
conferir("mas somar na mesma moeda funciona sem cotação",
  somarEm({ fatia: "BTC", valor: 3000, moeda: "USD" }, 300, "USD", null).erro == null);

// ---------------------------------------------------------------------------
titulo("Tirar — e a recusa de tirar mais do que tem");

{
  const f = { fatia: "reserva", valor: 20000, moeda: "BRL" };
  tirarDe(f, 5000, "BRL", TAXA);
  conferir("tira o que foi pedido", f.valor === 15000, `saiu ${f.valor}`);
}

{
  const f = { fatia: "BTC", valor: 3000, moeda: "USD" };
  tirarDe(f, 540, "BRL", TAXA);
  conferir("tirar em real de fatia em dólar converte", f.valor === 2900, `saiu ${f.valor}`);
}

{
  const f = { fatia: "reserva", valor: 100, moeda: "BRL" };
  const r = tirarDe(f, 500, "BRL", TAXA);
  conferir("tirar mais do que tem é RECUSADO", r.erro != null);
  conferir("e o valor fica intacto", f.valor === 100,
    "aparar em silêncio é pior que recusar: ninguém repara que errou");
  conferir("o erro diz quanto ele tem", r.erro.includes("100,00"));
}

{
  const f = { fatia: "reserva", valor: 100, moeda: "BRL" };
  conferir("zerar a fatia exata é permitido", tirarDe(f, 100, "BRL", TAXA).erro == null);
  conferir("e ela fica em zero, não negativa", f.valor === 0, `saiu ${f.valor}`);
}

conferir("fatia zerada não tem o que tirar",
  tirarDe({ fatia: "x", valor: null, moeda: "BRL" }, 10, "BRL", TAXA).erro != null);

// ---------------------------------------------------------------------------
titulo("Mover — a rotação do B.A.R.C.A.");

{
  /* O movimento que ele descreveu: "dependendo do ciclo vou poder fazer uma
     rotação, tirar de caixa, pôr mais em altcoins". */
  const l = lista();
  const r = mexerNaCarteira(l, "mover", 0, 2, 5000, "BRL", TAXA);
  conferir("saiu da origem", l[0].valor === 15000, `saiu ${l[0].valor}`);
  conferir("e entrou no destino", l[2].valor === 5000, `saiu ${l[2].valor}`);
  conferir("o recado nomeia as duas fatias",
    r.texto.includes("reserva") && r.texto.includes("altcoins"));
}

{
  // Reserva em real indo para o BTC, que está em dólar.
  const l = lista();
  mexerNaCarteira(l, "mover", 0, 1, 540, "BRL", TAXA);
  conferir("mover entre moedas diferentes converte no destino",
    l[0].valor === 19460 && l[1].valor === 3100,
    `saiu ${l[0].valor} e ${l[1].valor}`);
}

{
  /* A conferência que dá segurança ao botão: se o destino não puder receber,
     a origem não pode ter perdido. Meio movimento é dinheiro sumindo. */
  const l = [
    { fatia: "caixa", ordem: 0, valor: 1000, moeda: "BRL" },
    { fatia: "BTC",   ordem: 1, valor: 3000, moeda: "USD" },
  ];
  const r = mexerNaCarteira(l, "mover", 0, 1, 100, "BRL", null);
  conferir("sem cotação, a rotação entre moedas é recusada", r.erro != null);
  conferir("e nada saiu da origem", l[0].valor === 1000, `saiu ${l[0].valor}`);
  conferir("nem entrou no destino", l[1].valor === 3000);
}

{
  const l = lista();
  conferir("tirar mais do que a origem tem também trava a rotação",
    mexerNaCarteira(l, "mover", 2, 0, 10, "BRL", TAXA).erro != null,
    "altcoins está vazia");
  conferir("e a lista fica intacta", l[0].valor === 20000 && l[2].valor === null);
}

conferir("mover para a própria fatia é recusado",
  mexerNaCarteira(lista(), "mover", 0, 0, 10, "BRL", TAXA).erro != null);

// ---------------------------------------------------------------------------
titulo("A fatia certa — o erro que ninguém veria");

{
  /* lerFatiasDaTela pula linha sem nome. Então a linha 2 da TELA pode ser a
     posição 1 da LISTA. Procurar por posição somaria dinheiro na fatia errada,
     e o total continuaria plausível. Por isso a busca é por 'ordem'. */
  const l = [
    { fatia: "reserva", ordem: 0, valor: 100, moeda: "BRL" },
    // ordem 1 é uma linha sem nome, que lerFatiasDaTela não devolveu
    { fatia: "BTC", ordem: 2, valor: 200, moeda: "BRL" },
  ];
  mexerNaCarteira(l, "somar", 2, null, 50, "BRL", TAXA);
  conferir("soma na fatia da ordem 2, não na posição 2",
    l[1].valor === 250 && l[0].valor === 100, `saiu ${l[0].valor} e ${l[1].valor}`);
  conferir("ordem que não existe dá erro claro",
    mexerNaCarteira(l, "somar", 9, null, 50, "BRL", TAXA).erro != null);
}

// ---------------------------------------------------------------------------
titulo("Valor que não é valor");

for (const ruim of [0, -50, NaN, null, undefined, ""]) {
  conferir(`${JSON.stringify(ruim)} é recusado`,
    mexerNaCarteira(lista(), "somar", 0, null, Number(ruim), "BRL", TAXA).erro != null);
}

{
  const l = lista();
  mexerNaCarteira(l, "somar", 0, null, 0.015, "BRL", TAXA);
  conferir("centavo quebrado é arredondado, não vira dízima",
    l[0].valor === 20000.02, `saiu ${l[0].valor}`);
}

// ---------------------------------------------------------------------------
titulo("Token se conta em unidade, não em dinheiro");

{
  /* O que ele sabe é "comprei 0,3 ETH", não "comprei R$ 3.800". O preço muda
     amanhã; a quantidade não. É isso que faz a carteira se atualizar sozinha. */
  const l = [{ fatia: "ETH", token: "ETH", ordem: 0, quantidade: 1.2, caixa: "volatil" }];
  const r = mexerNaQuantidade(l, "somar", 0, 0.3);
  conferir("somar quantidade soma quantidade", l[0].quantidade === 1.5, `saiu ${l[0].quantidade}`);
  conferir("e o recado fala em token, não em dinheiro",
    r.texto.includes("ETH") && !r.texto.includes("R$") && !r.texto.includes("US$"));
}

{
  const l = [{ fatia: "BTC", token: "BTC", ordem: 0, quantidade: 0.05 }];
  mexerNaQuantidade(l, "tirar", 0, 0.02);
  conferir("tirar quantidade tira quantidade", l[0].quantidade === 0.03, `saiu ${l[0].quantidade}`);
}

{
  const l = [{ fatia: "BTC", token: "BTC", ordem: 0, quantidade: 0.05 }];
  const r = mexerNaQuantidade(l, "tirar", 0, 1);
  conferir("vender mais do que tem é recusado", r.erro != null);
  conferir("e a quantidade fica intacta", l[0].quantidade === 0.05);
}

{
  const l = [{ fatia: "BTC", token: "BTC", ordem: 0, quantidade: null }];
  mexerNaQuantidade(l, "somar", 0, 0.001);
  conferir("primeira compra parte do zero", l[0].quantidade === 0.001);
}

{
  /* Oito casas: é onde o Bitcoin para. Arredondar antes disso apagaria
     satoshis; não arredondar nada deixaria 0.30000000000000004 na tela. */
  const l = [{ fatia: "BTC", token: "BTC", ordem: 0, quantidade: 0.1 }];
  mexerNaQuantidade(l, "somar", 0, 0.2);
  conferir("0,1 + 0,2 dá 0,3 e não 0,30000000000000004",
    l[0].quantidade === 0.3, `saiu ${l[0].quantidade}`);
  const s = [{ fatia: "BTC", token: "BTC", ordem: 0, quantidade: 0.00000001 }];
  mexerNaQuantidade(s, "somar", 0, 0.00000001);
  conferir("um satoshi não some no arredondamento", s[0].quantidade === 0.00000002);
}

conferir("mover token é recusado com explicação de como fazer",
  (mexerNaQuantidade([{ fatia: "ETH", token: "ETH", ordem: 0, quantidade: 1 }], "mover", 0, 1).erro || "")
    .includes("tire de um"),
  "mover é conta de dinheiro; token se troca tirando de um e somando no outro");

// ---------------------------------------------------------------------------
titulo("Nenhuma frase manda fazer nada");

{
  /* Mesma regra do testar-barca.js: o radar mostra a conta, nunca a decisão.
   * Aqui o texto descreve o que ELE acabou de mandar fazer — no passado, e
   * sem sugerir o próximo. */
  const PROIBIDO = /\b(compre|comprar|venda|vender|invista|deveria|recomendo|sugiro|melhor seria)\b/i;
  const textos = [
    mexerNaCarteira(lista(), "somar", 0, null, 100, "BRL", TAXA).texto,
    mexerNaCarteira(lista(), "tirar", 0, null, 100, "BRL", TAXA).texto,
    mexerNaCarteira(lista(), "mover", 0, 1, 100, "BRL", TAXA).texto,
  ];
  conferir("nenhum recado usa verbo de ordem",
    textos.every((t) => !PROIBIDO.test(t)), textos.find((t) => PROIBIDO.test(t)) || "");
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
