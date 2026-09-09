/* Prova a leitura de um empréstimo na Kamino, contra a posição REAL.
 *
 *   node testar-kamino.js
 *
 * Como o testar-orca.js, este não usa dado inventado: os bytes em
 * provas/kamino-posicao.txt são um depósito real de US$ 10, gravado em 08/09/2026,
 * lidos no mesmo minuto em que a tela foi fotografada. A Kamino dizia:
 *
 *     Net value $10.00      Net APY 3.27%      Interest Earned $0.00
 *
 * Decodificar conta de blockchain é ler bytes por deslocamento, e um campo
 * lido no lugar errado não dá erro: dá um número plausível e errado. Por isso
 * a conferência é contra uma tela que ele viu com os próprios olhos.
 */

import { existsSync } from "node:fs";

/* AS PROVAS NÃO VÊM NO REPOSITÓRIO, e o motivo importa: são os bytes de uma
 * posição REAL, lidos da blockchain — e dentro deles vai o endereço da carteira
 * de quem gravou. Endereço público não move dinheiro, mas expõe o patrimônio
 * inteiro de uma pessoa pra sempre. Então cada instalação grava as SUAS provas
 * (uma posição sua, os bytes dela, a tela que você viu) e este teste confere
 * contra elas. Sem provas, ele se declara pulado — alto, pra ninguém achar que
 * a decodificação foi conferida quando não foi. */
/* As conferências numéricas abaixo (cTokens, câmbio, valores) foram calibradas
 * contra a prova ORIGINAL. Ao gravar a sua, ajuste os números esperados pros
 * da SUA tela — é esse o desenho: o teste confere contra o que você viu. */
if (!existsSync("provas/kamino-posicao.txt")) {
  console.log("\nPULADO — provas/ não existe neste repositório.");
  console.log("Este teste confere a decodificação contra bytes de uma posição REAL.");
  console.log("Grave a sua (veja o cabeçalho deste arquivo) e rode de novo.");
  process.exit(0);
}

import { readFileSync } from "node:fs";
import {
  lerObrigacao, lerReserva, cambioDaReserva, valorDoDeposito, juroAcumulado,
  MERCADOS, TAMANHO_OBRIGACAO, TAMANHO_RESERVA,
} from "./src/kamino.js";
import { paraBase58 } from "./src/orca.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);
const perto = (a, b, folga) => Math.abs(a - b) <= folga;

const bruto = readFileSync("provas/kamino-posicao.txt", "utf8");
const pegar = (nome) => {
  const linha = bruto.split("\n").find((l) => l.startsWith(nome + "="));
  return Uint8Array.from(Buffer.from(linha.split("=")[1].trim(), "base64"));
};
const BYTES_OBRIGACAO = pegar("OBRIGACAO");
const BYTES_RESERVA = pegar("RESERVA");

/* O dono esperado vem da PRÓPRIA prova (linha CARTEIRA=...), não do código:
 * a prova é de quem gravou, e o endereço de ninguém fica no repositório. */
const CARTEIRA = (bruto.split("\n").find((l) => l.startsWith("CARTEIRA=")) || "=").split("=")[1].trim();
const MERCADO = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// ---------------------------------------------------------------------------
titulo("Os tamanhos conferem o mapa inteiro");

conferir("a obrigação tem 3344 bytes", BYTES_OBRIGACAO.length === TAMANHO_OBRIGACAO);
conferir("a reserva tem 8624 bytes", BYTES_RESERVA.length === TAMANHO_RESERVA);

// ---------------------------------------------------------------------------
titulo("A posição de empréstimo");

const o = lerObrigacao(BYTES_OBRIGACAO, paraBase58);
const r = lerReserva(BYTES_RESERVA, paraBase58);

conferir("não deu erro", !o.erro && !r.erro, o.erro || r.erro || "");
/* Só confere o dono se a prova disser quem é (linha CARTEIRA=...). Sem a
   linha, mostra em vez de afirmar: afirmar contra vazio reprovaria toda prova
   recém-gravada. */
if (CARTEIRA) conferir("o DONO é a carteira de quem gravou a prova", o.dono === CARTEIRA, `veio ${o.dono}`);
else console.log(`  (sem linha CARTEIRA= na prova; o dono lido foi ${o.dono})`);
conferir("e o mercado é o SOL/BTC que a tela mostrava", o.mercado === MERCADO);
conferir("tem exatamente um depósito", o.depositos.length === 1, `achei ${o.depositos.length}`);
conferir("de 8.337570 cTokens", o.depositos[0].cTokens === 8337570n,
  `veio ${o.depositos[0].cTokens}`);
conferir("na reserva de USDC",
  o.depositos[0].reserva === "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");

// ---------------------------------------------------------------------------
titulo("A reserva, e o câmbio onde mora o juro");

conferir("a reserva é de USDC", r.mint === USDC, `veio ${r.mint}`);
conferir("com 6 casas decimais", r.casas === 6);
conferir("e o preço do USDC é ~1", perto(r.preco, 1, 0.01), `veio ${r.preco}`);
conferir("tem liquidez disponível", r.disponivel > 0n);
conferir("e tem gente devendo", r.emprestado > 0n,
  "sem tomador não há juro, e o câmbio ficaria parado");

{
  const c = cambioDaReserva(r);
  conferir("o câmbio é maior que 1", c > 1,
    "cToken vale mais que o token porque o juro já correu");
  conferir("e bate com 1,19939", perto(c, 1.19939, 0.0001), `saiu ${c}`);
}

// ---------------------------------------------------------------------------
titulo("O VALOR — contra os US$ 10,00 da tela dele");

{
  const v = valorDoDeposito(o.depositos[0].cTokens, r);
  conferir("dá 10,0000 USDC", perto(v.emToken, 10, 0.001), `saiu ${v.emToken.toFixed(6)}`);
  conferir("e US$ 10,00", perto(v.emDolar, 10, 0.01), `saiu US$ ${v.emDolar.toFixed(4)}`);
}

// ---------------------------------------------------------------------------
titulo("O juro: a diferença de câmbio, e nada além disso");

{
  /* A quantidade de cTokens nunca muda com o tempo — só quando ele deposita
   * ou saca. Então TODO o ganho está na diferença de câmbio, e a conta é
   * exata: não é estimativa nem média. */
  const agora = cambioDaReserva(r);
  const j = juroAcumulado(o.depositos[0].cTokens, r, agora);
  conferir("entrando no câmbio de hoje, o juro é zero",
    perto(j.emDolar, 0, 1e-9), `saiu ${j.emDolar}`);

  const jSeis = juroAcumulado(o.depositos[0].cTokens, r, agora - 0.06);
  conferir("com o câmbio 0,06 mais baixo, rendeu meio dólar",
    perto(jSeis.emDolar, 0.5, 0.01), `saiu US$ ${jSeis.emDolar.toFixed(4)}`);
  conferir("e o juro nunca é negativo quando o câmbio subiu", jSeis.emDolar > 0);

  conferir("sem câmbio de entrada não há juro calculável",
    juroAcumulado(o.depositos[0].cTokens, r, 0) === null,
    "sem base não há de que subtrair — inventar uma seria inventar o lucro dele");
}

// ---------------------------------------------------------------------------
titulo("Contas que não são o que dizem ser");

conferir("obrigação com tamanho errado é recusada pelo nome",
  (lerObrigacao(new Uint8Array(100), paraBase58).erro || "").includes("Kamino"));
conferir("reserva com tamanho errado também",
  lerReserva(new Uint8Array(100), paraBase58).erro != null);
conferir("reserva sem cTokens emitidos não inventa câmbio",
  cambioDaReserva({ ...r, colateralSupply: 0n }) === null);

// ---------------------------------------------------------------------------
titulo("A lista de mercados");

conferir("o mercado dele está na lista",
  MERCADOS.some((m) => m.id === MERCADO),
  "sem ele, o empréstimo do Rayakuza não apareceria na importação");
conferir("nenhum mercado repetido",
  new Set(MERCADOS.map((m) => m.id)).size === MERCADOS.length);
conferir("todos com nome", MERCADOS.every((m) => m.nome && m.nome.length > 2));
conferir("todos parecem endereço da Solana",
  MERCADOS.every((m) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m.id)));

// ---------------------------------------------------------------------------
titulo("O juro pelo câmbio só vale com UMA entrada");

{
  /* Ele perguntou antes de depositar de novo: "conserte antes então".
   *
   * A conta pelo câmbio assume que TODOS os cTokens foram comprados no câmbio
   * de entrada. Com uma entrada só ela é exata; com duas ela conta juro sobre
   * dinheiro que acabou de chegar. Este teste mede as duas coisas, e não
   * confere nenhuma fórmula contra ela mesma: constrói os depósitos e soma. */
  const juroPeloCambio = (valorHoje, c0, c1) => {
    const cresceu = c1 / c0 - 1;
    return valorHoje * (cresceu / (1 + cresceu));
  };

  // UMA ENTRADA: 10 USDC a 1,19939103, o câmbio vai a 1,25.
  {
    const c0 = 1.19939103, c1 = 1.25;
    const q = 10 / c0;                    // cTokens comprados
    const valorHoje = q * c1;
    const verdade = valorHoje - 10;       // rendeu isto, por construção

    conferir("com uma entrada, a conta do câmbio acerta",
      Math.abs(juroPeloCambio(valorHoje, c0, c1) - verdade) < 1e-9,
      `câmbio deu ${juroPeloCambio(valorHoje, c0, c1).toFixed(8)}, verdade ${verdade.toFixed(8)}`);

    /* E a conta dos aportes dá o MESMO número — que é o motivo de a linha
       poder desaparecer sem perda: valor de hoje menos o que ele pôs. */
    conferir("e a conta dos aportes dá o mesmo", Math.abs((valorHoje - 10) - verdade) < 1e-12);
  }

  // DUAS ENTRADAS: 10 a 1,19939103 e mais 10 a 1,23. O câmbio vai a 1,25.
  {
    const c0 = 1.19939103, cMeio = 1.23, c1 = 1.25;
    const q = 10 / c0 + 10 / cMeio;
    const valorHoje = q * c1;
    const verdade = valorHoje - 20;       // pôs 20 no total

    const peloCambio = juroPeloCambio(valorHoje, c0, c1);

    conferir("com duas entradas, a conta do câmbio ERRA",
      Math.abs(peloCambio - verdade) > 0.05,
      `câmbio diz ${peloCambio.toFixed(4)}, verdade ${verdade.toFixed(4)}`);
    conferir("e erra pra CIMA, que é o pior lado",
      peloCambio > verdade,
      "número alto com cara de certo é o que faz alguém decidir errado");
    conferir("a conta dos aportes continua exata",
      Math.abs((valorHoje - 20) - verdade) < 1e-12,
      "por isso a linha aponta pra ela quando há mais de um aporte");
  }

  /* A REGRA QUE A TELA USA, escrita aqui pra não se perder no HTML. */
  const soUmaEntrada = (aportes, saques) => aportes <= 1 && saques === 0;
  conferir("sem lançamento nenhum, a conta do câmbio ainda vale", soUmaEntrada(0, 0) === true,
    "é a linha recém-importada, com a entrada original só");
  conferir("com um aporte, vale", soUmaEntrada(1, 0) === true);
  conferir("com dois aportes, não vale", soUmaEntrada(2, 0) === false);
  conferir("com um saque, também não", soUmaEntrada(1, 1) === false,
    "sacar tira cTokens comprados a câmbios diferentes");
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
