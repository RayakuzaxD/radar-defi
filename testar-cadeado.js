/* Prova o cadeado e as linhas que seguem a carteira.
 *
 *   node testar-cadeado.js
 *
 * O desenho é dele, e a frase é a especificação inteira: "os que eu digito
 * você não consegue ler, e os da carteira pode atualizar automático os
 * lançamentos ou retiradas".
 *
 * Este arquivo existe por causa de UM caso, e ele é o motivo de o resto ter
 * sido escrito com cuidado:
 *
 *   getTokenAccountsByOwner pode falhar e devolver LISTA VAZIA SEM ERRO. Uma
 *   lista vazia é indistinguível de "ele tirou tudo da carteira". Tratar as
 *   duas igual faz um nó fora do ar zerar a carteira dele na tela — e ele
 *   olharia um Base sólida em 0% que na verdade tem 0,02 BTC dentro.
 *
 * Metade das conferências aqui é sobre o que NÃO pode ser tocado.
 */

import { readFileSync } from "node:fs";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log("\n" + t);

/* Arrancadas do painel: rodam no navegador dele, não dá pra importar. */
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
const { podeSeguir, seguindo, aplicarSaldos, repetidos } = new Function(`
  ${["podeSeguir", "seguindo", "aplicarSaldos", "tokensRepetidos"].map((n) => pegarFuncao(fonte, n)).join("\n")}
  return { podeSeguir: podeSeguir, seguindo: seguindo, aplicarSaldos: aplicarSaldos,
           repetidos: tokensRepetidos };
`)();

/* Uma carteira de exemplo, com a forma da real. */
const MINT_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const carteira = () => [
  { chave: "a", fatia: "BTC", token: "BTC", quantidade: 0.0731945, mint: null, segue_carteira: true },
  { chave: "b", fatia: "USDC", token: "USDC", quantidade: 418.903215, mint: MINT_USDC, segue_carteira: true },
  { chave: "c", fatia: "Reserva de Emergência", token: null, valor: 2500, moeda: "BRL", mint: null, segue_carteira: true },
  { chave: "d", fatia: "SOL/USDC na Orca", token: null, posicao: "PosExemplo1", mint: null, segue_carteira: true },
];
const acha = (l, ch) => l.find((f) => f.chave === ch);

// ---------------------------------------------------------------------------
titulo("Quem pode seguir, e quem não pode");

{
  const l = carteira();
  conferir("o USDC pode seguir — veio da carteira e tem mint", podeSeguir(acha(l, "b")) === true);
  conferir("o BTC NÃO pode — ele digitou, não está na Solana", podeSeguir(acha(l, "a")) === false,
    "sem mint eu não tenho o que procurar");
  conferir("a Reserva em real não pode", podeSeguir(acha(l, "c")) === false);
  conferir("a posição da Orca não pode", podeSeguir(acha(l, "d")) === false,
    "ela já se atualiza por endereço, que é outro caminho");

  conferir("seguir é poder E não estar travado", seguindo(acha(l, "b")) === true);
  const travado = { ...acha(l, "b"), segue_carteira: false };
  conferir("linha travada não segue", seguindo(travado) === false);
  conferir("e continuar podendo seguir", podeSeguir(travado) === true,
    "o cadeado é escolha dele, não impossibilidade");
}

// ---------------------------------------------------------------------------
titulo("Leitura boa: a linha da carteira acompanha");

{
  /* Ele gastou 20 USDC. */
  const l = carteira();
  const mudou = aplicarSaldos(l, { [MINT_USDC]: 398.903215 }, true);
  conferir("o USDC virou 398,903215", acha(l, "b").quantidade === 398.903215);
  conferir("e a mudança é contada", mudou.length === 1 && mudou[0].token === "USDC");
  conferir("com o de e o para", mudou[0].de === 418.903215 && mudou[0].para === 398.903215,
    "mudança de quantidade em silêncio é mudança que ele descobre num total que não fecha");
  conferir("o BTC não foi tocado", acha(l, "a").quantidade === 0.0731945);
}

{
  /* Ele recebeu USDC. Aportes contam igual. */
  const l = carteira();
  aplicarSaldos(l, { [MINT_USDC]: 150 }, true);
  conferir("aporte na carteira também sobe a linha", acha(l, "b").quantidade === 150);
}

{
  /* Nada mudou: não há o que anunciar. */
  const l = carteira();
  const mudou = aplicarSaldos(l, { [MINT_USDC]: 418.903215 }, true);
  conferir("saldo igual não gera mudança", mudou.length === 0,
    "senão ele receberia aviso a cada abertura sobre nada");
}

// ---------------------------------------------------------------------------
titulo("A RETIRADA TOTAL: zerar só quando eu tenho certeza");

{
  /* Ele tirou TODO o USDC. A leitura ficou completa e o mint sumiu: zerar é o
     certo, e foi o que ele pediu. */
  const l = carteira();
  const mudou = aplicarSaldos(l, {}, true);
  conferir("leitura completa e o token sumiu: zera", acha(l, "b").quantidade === 0);
  conferir("e a mudança é marcada como sumiço", mudou[0] && mudou[0].sumiu === true);
}

{
  /* O CASO QUE DÁ NOME AO ARQUIVO.
   *
   * A consulta falhou e devolveu lista vazia SEM ERRO. Igualzinha ao caso de
   * cima, e completamente diferente: ele não tirou nada. */
  const l = carteira();
  const mudou = aplicarSaldos(l, {}, false);
  conferir("leitura INCOMPLETA e lista vazia: NÃO mexe",
    acha(l, "b").quantidade === 418.903215,
    "um nó fora do ar não pode zerar a carteira dele");
  conferir("e nada é anunciado", mudou.length === 0);
  conferir("o BTC segue intocado", acha(l, "a").quantidade === 0.0731945);
}

{
  /* Leitura incompleta mas o token APARECEU: presença é prova, sempre.
     Só a ausência é que precisa de leitura completa pra valer. */
  const l = carteira();
  aplicarSaldos(l, { [MINT_USDC]: 50 }, false);
  conferir("leitura incompleta com o token presente: atualiza",
    acha(l, "b").quantidade === 50,
    "ver o número é prova; não ver é só não ter olhado direito");
}

// ---------------------------------------------------------------------------
titulo("O cadeado: o que ele trava, eu não encosto");

{
  const l = carteira();
  acha(l, "b").segue_carteira = false;   // ele travou o USDC
  const mudou = aplicarSaldos(l, { [MINT_USDC]: 5 }, true);
  conferir("linha travada não muda nem com leitura boa", acha(l, "b").quantidade === 418.903215);
  conferir("e não entra no que mudou", mudou.length === 0);

  /* O caso que ele descreveu: USDC na Solana e mais numa corretora. Ele digita
     o total e trava, mesmo sendo uma linha que eu CONSEGUIRIA ler. */
  acha(l, "b").quantidade = 300;
  aplicarSaldos(l, { [MINT_USDC]: 418.903215 }, true);
  conferir("o total digitado por ele sobrevive à leitura", acha(l, "b").quantidade === 300);
}

// ---------------------------------------------------------------------------
titulo("As bordas que viram número errado na tela");

{
  const l = carteira();
  conferir("sem saldos, não mexe em nada",
    (aplicarSaldos(l, null, true), acha(l, "b").quantidade === 418.903215),
    "null é falha, não carteira vazia");

  const l2 = carteira();
  aplicarSaldos(l2, { [MINT_USDC]: -5 }, true);
  conferir("quantidade negativa é recusada", acha(l2, "b").quantidade === 418.903215);

  const l3 = carteira();
  aplicarSaldos(l3, { [MINT_USDC]: "abacaxi" }, true);
  conferir("quantidade que não é número é recusada", acha(l3, "b").quantidade === 418.903215);

  conferir("lista de linhas vazia não quebra", aplicarSaldos([], { a: 1 }, true).length === 0);
  conferir("lista nula não quebra", aplicarSaldos(null, { a: 1 }, true).length === 0);

  /* Zero de verdade, vindo lido, é diferente de ausência. */
  const l4 = carteira();
  aplicarSaldos(l4, { [MINT_USDC]: 0 }, false);
  conferir("zero LIDO vale mesmo com leitura incompleta", acha(l4, "b").quantidade === 0,
    "a conta existe e está vazia — isso eu vi, não deduzi");
}

/* ---------------------------------------------------------------------------
 * O MESMO TOKEN EM DUAS LINHAS
 *
 * Ele perguntou se podia usar o USDC da carteira como reserva de oportunidade
 * "também". Pode — mas se as duas linhas seguirem a carteira, cada uma recebe o
 * saldo inteiro e o total dele dobra em silêncio. Estas conferências existem
 * para o aviso aparecer exatamente aí, e em nenhum outro caso.
 * ------------------------------------------------------------------------- */
titulo("O mesmo token em duas linhas que seguem");
{
  const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const sol = "So11111111111111111111111111111111111111112";
  const linha = (nome, mint, token, extra = {}) =>
    ({ chave: nome, fatia: nome, mint, token, ...extra });

  conferir("uma linha só não vira aviso",
    repetidos([linha("USDC", usdc, "USDC")]).length === 0);

  const duas = repetidos([
    linha("USDC", usdc, "USDC"),
    linha("USDC · oportunidade", usdc, "USDC"),
  ]);
  conferir("duas do mesmo token viram um aviso", duas.length === 1);
  conferir("e o aviso sabe quais são as duas", duas[0] && duas[0].linhas.length === 2,
    "sem os nomes ele saberia que há um problema e não onde");

  conferir("tokens diferentes não viram aviso",
    repetidos([linha("USDC", usdc, "USDC"), linha("SOL", sol, "SOL")]).length === 0);

  conferir("a que está no cadeado não conta",
    repetidos([
      linha("USDC", usdc, "USDC"),
      linha("USDC · oportunidade", usdc, "USDC", { segue_carteira: false }),
    ]).length === 0,
    "é exatamente a saída que o aviso propõe — depois de trancar, ele some");

  conferir("linha sem mint nunca entra",
    repetidos([
      linha("BTC", null, "BTC"),
      linha("BTC na outra corretora", null, "BTC"),
    ]).length === 0,
    "o BTC dele é digitado à mão nas duas; nenhuma segue carteira nenhuma");

  conferir("o mesmo símbolo com mints diferentes não é o mesmo token",
    repetidos([
      linha("USDC", usdc, "USDC"),
      linha("USDC falso", "Fake1111111111111111111111111111111111111111", "USDC"),
    ]).length === 0,
    "na Solana qualquer um cria um token chamado USDC — o endereço é quem não repete");

  conferir("três linhas do mesmo token são um aviso só, com as três dentro",
    (() => {
      const r = repetidos([
        linha("a", usdc, "USDC"), linha("b", usdc, "USDC"), linha("c", usdc, "USDC"),
      ]);
      return r.length === 1 && r[0].linhas.length === 3;
    })(),
    "um aviso por linha extra seria três avisos pro mesmo problema");

  conferir("lista vazia não quebra", repetidos([]).length === 0);
  conferir("e nem lista ausente", repetidos(null).length === 0);
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
