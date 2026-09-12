/* Prova o mensageiro dos nós da Solana: a função `pedir`.
 *
 *   node testar-nos.js
 *
 * Existe por causa de um defeito medido em 12/09/2026: nó público gratuito
 * PODA o histórico e responde `result: null` com HTTP 200 para transação
 * antiga — sem erro nenhum. O `pedir` aceitava esse nada como resposta e nem
 * tentava o próximo nó da fila. Bastava o nó principal engasgar uma vez pra a
 * mesma pergunta dar resposta diferente a cada hora, e a tela dele oscilar
 * junto.
 *
 * O fetch aqui é de mentira, trocado no global: cada "nó" é um roteiro do que
 * ele responde. O que se prova é a ORDEM das decisões — quem é tentado, quando
 * se desiste, o que conta como resposta.
 */
import { pedir } from "./src/solana.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

const fetchDeVerdade = globalThis.fetch;

/* Um conjunto de nós de mentira: { "https://no-a": resposta } — a resposta
   pode ser um corpo JSON-RPC, um número (status HTTP de erro) ou "explode". */
function armarNos(roteiro, chamadas) {
  globalThis.fetch = async (url) => {
    chamadas.push(url);
    const r = roteiro[url];
    if (r === "explode") throw new Error("rede caiu");
    if (typeof r === "number") return { ok: false, status: r };
    return { ok: true, json: async () => r };
  };
}

// ---------------------------------------------------------------------------
titulo('"Não tenho" manda a pergunta pro próximo nó');

{
  /* O caso real: o primeiro nó (podado) diz null, o segundo tem a resposta. */
  const chamadas = [];
  armarNos({
    "https://podado": { jsonrpc: "2.0", result: null },
    "https://inteiro": { jsonrpc: "2.0", result: { blockTime: 123 } },
  }, chamadas);
  const r = await pedir("getTransaction", ["x"], ["https://podado", "https://inteiro"]);
  conferir("o null do nó podado não vira resposta", r && r.blockTime === 123,
    JSON.stringify(r));
  conferir("e os dois nós foram perguntados", chamadas.length === 2, chamadas.join(", "));
}

{
  /* Só quando TODOS dizem nada é que nada é a resposta — aí a explicação que
     sobra é a transação não existir. */
  const chamadas = [];
  armarNos({
    "https://a": { jsonrpc: "2.0", result: null },
    "https://b": { jsonrpc: "2.0", result: null },
  }, chamadas);
  const r = await pedir("getTransaction", ["x"], ["https://a", "https://b"]);
  conferir("todos dizendo nada devolve null, sem explodir", r === null);
  conferir("depois de perguntar a todos", chamadas.length === 2);
}

{
  /* Resposta de verdade no primeiro: ninguém mais é incomodado. */
  const chamadas = [];
  armarNos({
    "https://a": { jsonrpc: "2.0", result: [1, 2, 3] },
    "https://b": { jsonrpc: "2.0", result: [9] },
  }, chamadas);
  const r = await pedir("getSignaturesForAddress", ["x"], ["https://a", "https://b"]);
  conferir("resposta boa no primeiro nó encerra a fila",
    Array.isArray(r) && r.length === 3 && chamadas.length === 1);
}

titulo("Erro continua sendo erro");

{
  /* Nó com erro + nó com resposta: a resposta vence. */
  armarNos({
    "https://caido": 500,
    "https://explosivo": "explode",
    "https://bom": { jsonrpc: "2.0", result: { ok: 1 } },
  }, []);
  const r = await pedir("getTransaction", ["x"],
    ["https://caido", "https://explosivo", "https://bom"]);
  conferir("status ruim e rede caída passam a vez", r && r.ok === 1);
}

{
  /* Todos com erro: explode com o último erro, não devolve nada calado. */
  armarNos({ "https://a": 500, "https://b": "explode" }, []);
  let explodiu = null;
  try { await pedir("getTransaction", ["x"], ["https://a", "https://b"]); }
  catch (e) { explodiu = e; }
  conferir("todo mundo com erro é erro, não silêncio", explodiu !== null);
}

{
  /* A MISTURA que enganava: um nó ERRA e outro diz NADA. Nada ganha do erro —
     "não tenho" é uma informação, "quebrei" não é. */
  armarNos({
    "https://quebrado": 429,
    "https://podado": { jsonrpc: "2.0", result: null },
  }, []);
  const r = await pedir("getTransaction", ["x"], ["https://quebrado", "https://podado"]);
  conferir("um erro e um 'não tenho' devolvem null, não explosão", r === null);
}

globalThis.fetch = fetchDeVerdade;

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
