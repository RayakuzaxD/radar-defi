/* Os quatro indicadores de ciclo, buscados DAQUI e guardados no banco.
 *
 *   node semear-indicadores.js              # busca e envia
 *   node semear-indicadores.js --so-arquivo # gera o .sql e não envia
 *
 * ---------------------------------------------------------------------------
 * POR QUE ISTO EXISTE
 *
 * O radar no ar NUNCA conseguiu ler a fonte de referência. Conferido em
 * 11/09/2026: a tabela `ajustes` não tinha a linha `indicadores_bons`, ou seja,
 * nenhuma rodada jamais gravou um valor vindo do bitcoin-data.com. MVRV,
 * Z-Score e Puell só aparecem na tela porque existe a fonte reserva; o VDD, que
 * não tem reserva, simplesmente nunca existiu.
 *
 * O motivo já estava escrito em llama.js e continua verdadeiro: a fonte dá 10
 * chamadas por hora POR IP, e o Worker sai pelo IP compartilhado da Cloudflare,
 * que chega no balde já vazio. Testado do Worker em 11/09/2026, seis vezes
 * seguidas e com as duas formas de cabeçalho: 429 RATE_LIMIT_HOUR_EXCEEDED em
 * todas. NÃO é o engano do Farside — lá faltava identificação, aqui o limite é
 * de verdade.
 *
 * Do computador do Rayakuza, o mesmo endereço responde 200 no primeiro tento.
 *
 * ---------------------------------------------------------------------------
 * POR QUE UM NÚMERO DE ONTEM SERVE, E ISSO NÃO É DESCULPA
 *
 * Os quatro mudam UMA VEZ POR DIA na origem, e são indicadores de CICLO: o VDD
 * anda entre 0,5 e 3,0 ao longo de anos. Um valor de alguns dias atrás,
 * DECLARADO com a data dele, responde a mesma pergunta que o de hoje.
 *
 * É a regra que o projeto já usa em três lugares (a última leitura boa das
 * posições, o `deAntes` dos indicadores, o carimbo de "medido em"): número
 * velho declarado velho é melhor que número ausente. O que não se pode é
 * mostrar um valor de terça como se fosse de hoje.
 *
 * ---------------------------------------------------------------------------
 * FALHA NUNCA APAGA VALOR BOM
 *
 * Este arquivo lê o que já está guardado antes de escrever, e só substitui o
 * que conseguiu buscar. É a mesma lição que está em index.js sobre o
 * `indicadores_bons`: cache que a falha sobrescreve não é cache, é uma
 * bomba-relógio — funciona em todo teste e some no primeiro dia ruim, que é
 * justamente o dia em que ele fazia falta.
 */

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const soArquivo = process.argv.slice(2).some((a) => /^--so?-?arquivo$/.test(a));

const CASA = "https://bitcoin-data.com/v1";
const INDICADORES = [
  { chave: "mvrv", caminho: "/mvrv/last", campo: "mvrv" },
  { chave: "zscore", caminho: "/mvrv-zscore/last", campo: "mvrvZscore" },
  { chave: "puell", caminho: "/puell-multiple/last", campo: "puellMultiple" },
  { chave: "vdd", caminho: "/vdd-multiple/last", campo: "vddMultiple" },
];

const respirar = (ms) => new Promise((ok) => setTimeout(ok, ms));
/* `npx` com `shell` no Windows, e não "npx.cmd" direto — é o detalhe que o
   semear.js já tinha resolvido e que eu refiz errado aqui.
 *
 * E COM `shell`, ARGUMENTO COM ESPAÇO PRECISA DE ASPAS. Sem elas o shell parte
 * o SQL em pedaços e o wrangler responde "Unknown arguments" — que foi o erro
 * que apareceu assim que eu parei de engolir a exceção.
 *
 * `shell: true` não é preguiça: no Node de hoje, `execFileSync("npx.cmd", …)`
 * sem shell devolve EINVAL no Windows. Testado. O aviso de depreciação que o
 * Node imprime é sobre argumento não escapado virar injeção — aqui todos os
 * argumentos são escritos neste arquivo (SQL literal e nome de arquivo), nada
 * vem de fora. */
const aspas = (a) => (process.platform === "win32" && /\s/.test(a) ? `"${a}"` : a);
const naNuvem = (args) => execFileSync("npx", ["wrangler", "d1", "execute",
  "radar-defi", "--remote", ...args].map(aspas), {
  encoding: "utf8", shell: process.platform === "win32",
  stdio: ["ignore", "pipe", "pipe"],
});

/* 1. O QUE JÁ ESTÁ GUARDADO. Lido antes de qualquer busca, porque o que eu não
      conseguir buscar tem que sobreviver a esta execução. */
let guardados = {};
try {
  const saida = JSON.parse(naNuvem(
    ["--command", "SELECT valor FROM ajustes WHERE nome = 'indicadores_bons';", "--json"]));
  const linha = saida?.[0]?.results?.[0]?.valor;
  if (linha) guardados = JSON.parse(linha) || {};
  console.log(`Já guardados: ${Object.keys(guardados).length ? Object.keys(guardados).join(", ") : "nenhum"}`);
} catch (e) {
  /* O MOTIVO VAI À TELA, e não um "não consegui" educado.
   *
   * A primeira versão engolia o erro e seguia com `{}` — e seguir com vazio
   * aqui é exatamente o que destrói valor bom na hora de gravar. Eu li a
   * mensagem genérica como se fosse "não havia nada guardado", quando na
   * verdade era a chamada do wrangler quebrando por um detalhe de Windows.
   * É a receita 6.4 do próprio projeto, cometida por quem a escreveu. */
  console.log("ERRO ao ler o que já estava guardado: " + String(e?.message || e).slice(0, 200));
  console.log("PARANDO. Gravar sem saber o que já existe pode apagar valor bom.");
  process.exit(1);
}

/* 2. BUSCA, com a mesma pausa de 1,5s que o radar respeita. Não é cerimônia:
      em paralelo os quatro contam como um pico e a fonte recusa. */
console.log(`\nBuscando os quatro em ${CASA} …`);
const novos = {};
const falhas = [];
for (let i = 0; i < INDICADORES.length; i++) {
  const ind = INDICADORES[i];
  if (i) await respirar(1500);
  try {
    const r = await fetch(CASA + ind.caminho, { headers: { accept: "application/json" } });
    if (!r.ok) {
      falhas.push(`${ind.chave}: HTTP ${r.status}`);
      console.log(`  ${ind.chave.padEnd(7)} HTTP ${r.status}`);
      continue;
    }
    const d = await r.json();
    const v = Number(d?.[ind.campo]);
    if (!Number.isFinite(v)) {
      falhas.push(`${ind.chave}: sem o campo ${ind.campo}`);
      console.log(`  ${ind.chave.padEnd(7)} veio sem ${ind.campo}`);
      continue;
    }
    novos[ind.chave] = { valor: v, dia: d?.d || null };
    console.log(`  ${ind.chave.padEnd(7)} ${v}   (${d?.d || "sem data"})`);
  } catch (e) {
    falhas.push(`${ind.chave}: ${String(e?.message || e).slice(0, 60)}`);
    console.log(`  ${ind.chave.padEnd(7)} erro: ${String(e?.message || e).slice(0, 60)}`);
  }
}

if (!Object.keys(novos).length) {
  console.log("\nNenhum indicador veio. Nada a gravar — o que estava guardado continua intacto.");
  if (falhas.length) console.log("Falhas: " + falhas.join(" · "));
  process.exit(1);
}

/* 3. JUNTA. O novo ganha onde existe; o velho fica onde o novo não veio, com a
      data dele intacta. Mesma regra de `juntarIndicadores` em llama.js — e ela
      mora nos dois lugares porque são dois programas, não porque é opcional. */
const juntos = { ...guardados };
for (const [k, v] of Object.entries(novos)) juntos[k] = v;

const quantos = Object.keys(juntos).length;
const sobreviveram = Object.keys(guardados).filter((k) => !novos[k]);
console.log(`\nVão para o banco: ${quantos} indicadores.`);
if (sobreviveram.length) {
  console.log(`Mantidos do que já havia (não vieram agora): ${sobreviveram.join(", ")}`);
}
if (falhas.length) console.log(`Falharam agora: ${falhas.join(" · ")}`);

/* 4. GRAVA. Aspas simples dobradas porque o JSON vai dentro de uma string SQL. */
const linha = `INSERT OR REPLACE INTO ajustes (nome, valor) VALUES ('indicadores_bons', '${
  JSON.stringify(juntos).replace(/'/g, "''")}');`;

const arquivo = "semente-indicadores.sql";
writeFileSync(arquivo, linha + "\n");

if (soArquivo) {
  console.log(`\nEscrevi ${arquivo} e não enviei. Pra enviar:`);
  console.log(`  npx wrangler d1 execute radar-defi --remote --file=${arquivo}`);
} else {
  console.log("\nEnviando…");
  execFileSync("npx", ["wrangler", "d1", "execute", "radar-defi", "--remote",
    "--file", arquivo, "--yes"],
    { stdio: "inherit", shell: process.platform === "win32" });
  console.log("\nPronto. Confira em /saude/indicadores.");
}
