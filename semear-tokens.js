/* Enche a tabela de símbolos do D1 com os mil maiores tokens do mercado.
 *
 *   node semear-tokens.js            (mostra o que faria)
 *   node semear-tokens.js --gravar   (grava no D1 de verdade)
 *
 * POR QUE ISTO EXISTE, e a descoberta que o obrigou:
 *
 * O radar resolvia símbolo desconhecido perguntando ao CoinGecko na hora. Em
 * 09/09/2026 alguém lançou WEMIX e não veio preço. O token existe (rank 284,
 * US$ 0,19) e o DefiLlama tem o preço dele — mas o CoinGecko RECUSA pedido
 * vindo da Cloudflare. Do meu computador responde; do Worker, não. É o mesmo
 * bloqueio que o nó oficial da Solana faz.
 *
 * Ou seja: a busca ao vivo funcionava nos meus testes e nunca funcionou no ar.
 * O pior tipo de defeito — o que passa em teste e falha em produção.
 *
 * A saída é trazer a lista de UMA VEZ, daqui, onde o CoinGecko responde, e
 * deixar guardada. O Worker nunca mais precisa perguntar: ele lê do banco.
 * É o mesmo feitio do semear.js.
 *
 * Símbolo repetido: fica o de maior mercado. Existem quatro "WEMIX" e um deles
 * é um stablecoin de rank 4155 — pegar o errado daria um preço plausível do
 * token errado, que é o pior jeito de errar dinheiro.
 */

import { writeFileSync } from "node:fs";

const PAGINAS = 4;          // 4 x 250 = os mil maiores
const POR_PAGINA = 250;
const gravar = process.argv.includes("--gravar");

/* O CoinGecko corta quem insiste (429), e corta rápido: rodar o ensaio e o
 * gravar em seguida já basta. Então espera crescente, e a espera é longa de
 * propósito — isto roda uma vez por mês, não tem pressa nenhuma. */
async function pagina(n) {
  const url = "https://api.coingecko.com/api/v3/coins/markets" +
    `?vs_currency=usd&order=market_cap_desc&per_page=${POR_PAGINA}&page=${n}`;
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (r.ok) return await r.json();
    if (r.status !== 429) throw new Error(`o CoinGecko respondeu ${r.status} na página ${n}`);
    const espera = tentativa * 30;
    console.log(`  página ${n}: levei 429, esperando ${espera}s (tentativa ${tentativa})`);
    await new Promise((x) => setTimeout(x, espera * 1000));
  }
  throw new Error(`o CoinGecko não deixou ler a página ${n}`);
}

const limpo = (s) => String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const porSimbolo = new Map();
let lidos = 0;

for (let n = 1; n <= PAGINAS; n++) {
  const lista = await pagina(n);
  lidos += lista.length;
  for (const c of lista) {
    const simbolo = limpo(c.symbol);
    if (!simbolo || !c.id) continue;
    // A lista já vem por mercado, do maior pro menor: o primeiro é o certo.
    if (!porSimbolo.has(simbolo)) {
      porSimbolo.set(simbolo, { id: c.id, nome: c.name, rank: c.market_cap_rank });
    }
  }
  if (n < PAGINAS) await new Promise((r) => setTimeout(r, 2500)); // o CoinGecko é sensível
}

console.log(`li ${lidos} tokens, ${porSimbolo.size} símbolos diferentes`);
console.log("exemplos:", ["BTC", "ETH", "WEMIX", "ZEC", "SOL"]
  .map((s) => `${s}=${porSimbolo.get(s)?.id || "(não achei)"}`).join("  "));

if (!gravar) {
  console.log("\nnada foi gravado. rode com --gravar pra valer.");
  process.exit(0);
}

const hoje = new Date().toISOString().slice(0, 10);
const escapar = (t) => String(t ?? "").replace(/'/g, "''");
const linhas = [...porSimbolo.entries()].map(([s, v]) =>
  `('${escapar(s)}','${escapar(v.id)}','${escapar(v.nome)}','${hoje}')`);

/* Grava num arquivo .sql e manda o wrangler ler dali.
 *
 * Passar mil linhas pela linha de comando estoura o limite de tamanho do
 * Windows, e o erro que volta não diz isso — diz um objeto de erro vazio, que
 * é o tipo de pista que faz perder meia hora. Arquivo não tem esse limite. */
const TAMANHO = 200;
const partes = [];
for (let i = 0; i < linhas.length; i += TAMANHO) {
  const valores = linhas.slice(i, i + TAMANHO).join(",\n");
  partes.push("INSERT OR REPLACE INTO token_id (simbolo, id, nome, achado_em) VALUES\n" + valores + ";");
}
writeFileSync("semente-tokens.sql", partes.join("\n\n") + "\n", "utf8");
console.log(`
escrevi semente-tokens.sql com ${linhas.length} símbolos.`);
console.log("agora rode:");
console.log("  npx wrangler d1 execute radar-defi --remote --file=semente-tokens.sql");
