/* Mede as pools AQUI no computador, e manda o resultado pro banco.
 *
 *   node medir-pools.js            # mede e envia
 *   node medir-pools.js --seco     # mede, escreve o .sql, e não envia
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * O plano gratuito da Cloudflare dá **10 milissegundos de processamento** por
 * rodada. Medido em 09/09/2026, o que o radar baixa do DefiLlama:
 *
 *     redes      (/v2/chains)     64 KB   cabe folgado
 *     protocolos (/protocols)    8,8 MB   estoura sozinho
 *     pools      (/pools)       11,8 MB   estoura sozinho
 *
 * Não é a frequência que não cabe — é o peso de UMA rodada. Rodar uma vez por
 * dia em vez de quatro não muda nada: os 11,8 MB continuam sendo 11,8 MB.
 *
 * Então a divisão é esta: a nuvem cuida do que é leve e constante (redes,
 * ciclo, carteira, vigia, avisos) e o SEU COMPUTADOR cuida do que é pesado e
 * ocasional. Aqui não há limite de processamento nenhum.
 *
 * É o mesmo caminho que o `semear-pools.js` já usava, e pelo mesmo motivo.
 *
 * ---------------------------------------------------------------------------
 * A DECISÃO DE DESENHO QUE MAIS IMPORTA
 *
 * Este arquivo **não reimplementa a medição**. Ele importa as MESMAS funções
 * que o Worker usa (`guardarPiscinas`, `acrescentarPontoDoDia`,
 * `medirPiscinas`, `medirQualidade`) e entrega a elas um banco de mentira: um
 * objeto que tem a cara do D1, mas em vez de executar, ANOTA o SQL.
 *
 * Duas cópias de uma conta divergem no primeiro conserto feito num lugar só —
 * e a divergência apareceria como um número estranho na tela de alguém, meses
 * depois, sem pista de origem. Com uma cópia só, quem roda no grátis e quem
 * roda no pago vê exatamente o mesmo número.
 *
 * As LEITURAS não dá pra fingir: `medirPiscinas` precisa dos 45 dias de
 * histórico pra calcular o chão. Essas vão de verdade ao banco, pelo wrangler.
 */

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  guardarPiscinas, acrescentarPontoDoDia, medirPiscinas, medirQualidade,
  guardarProtocolos,
} from "./src/index.js";
import { redesAgora, stablesAgora, protocolosAgora } from "./src/llama.js";

const args = process.argv.slice(2);
const seco = args.includes("--seco");
const BANCO = "radar-defi";
const ARQUIVO = "medida-de-hoje.sql";

/* O dia em Brasília, igual ao do Worker: as fotos são fechadas por esse dia, e
   duas definições de "hoje" criariam duas linhas para o mesmo dia. */
const emBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000);
const hoje = emBrasilia().toISOString().slice(0, 10);

/* ---------------------------------------------------------------------------
 * O BANCO DE MENTIRA
 *
 * Tem a mesma forma do D1 (`prepare`, `bind`, `run`, `batch`, `all`, `first`),
 * mas escreve numa lista em vez de executar. Só as LEITURAS vão de verdade.
 * ------------------------------------------------------------------------- */

/* Um valor virando texto de SQL. Aspas simples viram duas, que é como o SQLite
   escapa — e nulo é NULL, não a palavra "null" entre aspas. */
function comoSql(v) {
  if (v == null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

/* Troca cada ? pelo valor correspondente. Faz isso fora de texto entre aspas
   pra que um "?" dentro de uma string do SQL não vire ponto de troca. */
function montarSql(sql, valores) {
  let i = 0, fora = "", dentro = false;
  for (const c of sql) {
    if (c === "'") { dentro = !dentro; fora += c; continue; }
    if (c === "?" && !dentro) { fora += comoSql(valores[i++]); continue; }
    fora += c;
  }
  return fora;
}

function bancoDeMentira(escritas) {
  const lerDeVerdade = (sql) => {
    /* Leitura vai ao banco pelo wrangler. É a única coisa que não dá pra
       fingir: o chão de uma pool é calculado sobre o histórico dela. */
    const saida = execFileSync("npx", [
      "wrangler", "d1", "execute", BANCO, "--remote", "--json", "--command", sql,
    ], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
    const d = JSON.parse(saida);
    const bloco = Array.isArray(d) ? d[0] : d;
    return { results: bloco?.results || [], success: true };
  };

  const declaracao = (sql) => ({
    bind: (...valores) => ({
      __sql: montarSql(sql, valores),
      run: async () => { escritas.push(montarSql(sql, valores)); return { success: true }; },
      all: async () => lerDeVerdade(montarSql(sql, valores)),
      first: async () => (lerDeVerdade(montarSql(sql, valores)).results || [])[0] || null,
    }),
    run: async () => { escritas.push(sql); return { success: true }; },
    all: async () => lerDeVerdade(sql),
    first: async () => (lerDeVerdade(sql).results || [])[0] || null,
  });

  return {
    prepare: declaracao,
    batch: async (lista) => {
      for (const d of lista) escritas.push(d.__sql ?? String(d));
      return lista.map(() => ({ success: true }));
    },
  };
}

/* ------------------------------------------------------------------------- */

const escritas = [];
const env = { BANCO: bancoDeMentira(escritas) };

console.log(`Medindo as pools de ${hoje}. Isto leva alguns minutos.\n`);

console.log("1/4  baixando as pools do DefiLlama (~12 MB)…");
const { piscinasDeRendimento } = await import("./src/llama.js");
const piscinas = await piscinasDeRendimento();
console.log(`     ${piscinas.length} pools.`);

console.log("2/4  guardando a foto de hoje e o ponto da série…");
const quantas = await guardarPiscinas(env, hoje, piscinas);
await acrescentarPontoDoDia(env, hoje, piscinas);
console.log(`     ${quantas} acima do corte.`);

console.log("3/4  calculando chão, abismo e classe de cada uma…");
await medirPiscinas(env, hoje, piscinas);

console.log("4/4  a qualidade das redes (baixa ~9 MB de protocolos)…");
const [redes, protocolos] = await Promise.all([redesAgora(), protocolosAgora()]);
await guardarProtocolos(env, hoje, protocolos);
await medirQualidade(env, hoje, protocolos, redes);

/* As escritas viram um arquivo só. Uma por linha, com ponto e vírgula, que é o
   que o wrangler aceita — e que dá pra ler com os próprios olhos antes de
   mandar, se der vontade de conferir. */
const sql = escritas.map((l) => l.trim().replace(/;+$/, "") + ";").join("\n");
writeFileSync(ARQUIVO, sql);
console.log(`\n${escritas.length} gravações escritas em ${ARQUIVO} (${(sql.length / 1e6).toFixed(1)} MB).`);

if (seco) {
  console.log(`\nPra enviar:\n  npx wrangler d1 execute ${BANCO} --remote --file=${ARQUIVO}`);
  process.exit(0);
}

console.log("\nEnviando pro banco…");
execFileSync("npx", ["wrangler", "d1", "execute", BANCO, "--remote", "--file", ARQUIVO, "--yes"],
  { stdio: "inherit" });

console.log(`
Pronto. As pools de ${hoje} estão medidas.

Rode isto UMA VEZ POR DIA pra manter a aba Pools viva. Se pular um dia, nada
se perde: a série continua de onde parou, e o chão volta a fechar quando você
rodar de novo. O que não dá é nunca rodar — aí a aba Pools fica com a medida
do dia em que você rodou pela última vez, e ela DIZ a data, sem fingir.
`);
