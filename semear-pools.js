/* Semeia o histórico das pools: 60 dias de cada uma, de uma vez.
 *
 *   node semear-pools.js --portoes       # só as que passam nos portões do método
 *   node semear-pools.js                 # universo padrão (TVL >= $2M, APY >= 4%)
 *   node semear-pools.js 5000000 6       # corte próprio: TVL e APY mínimos
 *   node semear-pools.js --só-arquivo    # gera o .sql e não envia
 *
 * Roda uma vez, aqui no computador. Depois disso a série se mantém sozinha:
 * cada rodada diária do radar já busca o APY de todas as pools e acrescenta o
 * ponto do dia.
 *
 * Roda aqui e não na nuvem por dois motivos que se somam: o gráfico é uma
 * chamada POR POOL (centenas), e a API devolve 429 se as chamadas vierem
 * rápido — em 05/09/2026, seis chamadas simultâneas derrubaram 41 de 70
 * pedidos. O worker não tem nem o limite de chamadas nem a paciência.
 */

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { piscinasDeRendimento } from "./src/llama.js";
import { diaDoCarimbo } from "./src/llama.js";
import { passaNosPortoes } from "./src/metodo.js";

const args = process.argv.slice(2);
const soArquivo = args.includes("--só-arquivo") || args.includes("--so-arquivo");
const numeros = args.filter((a) => /^\d+$/.test(a)).map(Number);
const CORTE_TVL = numeros[0] || 2e6;
const CORTE_APY = numeros[1] ?? 4;

/* `--portoes`: semeia exatamente as pools que o método aceita, e mais nenhuma.
 *
 * É o modo certo pra completar buraco. Semear por faixa de TVL busca o gráfico
 * de milhares de pools pra ganhar dezenas — em 06/09/2026, descer o corte pra
 * $500k dava 1.409 pools (29 minutos de chamadas) pra que 230 passassem nos
 * portões. Pelos portões são as mesmas 230, em 5 minutos.
 *
 * O que ele NÃO faz é adivinhar o futuro: quem passa nos portões muda todo dia,
 * e uma pool que só passe amanhã não tem série semeada. Quem cuida disso é o
 * ponto diário do radar, que guarda de $500k pra cima — daí ela começa a
 * acumular no dia em que fica elegível, sem precisar de semeadura nenhuma. */
const porPortoes = args.includes("--portoes") || args.includes("--portões");

/* Devagar de propósito. 1,2 segundo entre chamadas foi o que passou sem levar
 * 429 no teste de 05/09/2026; 200 ms derrubou mais da metade. A API é aberta e
 * de graça, e apressá-la é a maneira mais rápida de ela deixar de ser. */
const ESPERA = 1200;
const respirar = (ms) => new Promise((r) => setTimeout(r, ms));

/* Quantos dias de histórico guardar. 60 cobre com folga a janela de 30 que as
 * medidas usam, e deixa margem pra dias faltando na série. */
const DIAS = 60;
const CORTE_DIA = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);

console.log(porPortoes
  ? "Universo: as pools que passam nos portões do método.\n"
  : `Universo: TVL >= $${(CORTE_TVL / 1e6).toFixed(0)}M e APY >= ${CORTE_APY}%\n`);

const todas = await piscinasDeRendimento();
const universo = todas
  .filter((p) => {
    if (!p.id) return false;
    if (porPortoes) {
      return passaNosPortoes({
        simbolo: p.simbolo, tvl: p.tvlUsd, apyBase: p.apyBase,
        apy: p.apy, volume1d: p.volume1d,
      }).passa;
    }
    return p.tvlUsd >= CORTE_TVL && p.apy >= CORTE_APY && p.apy < 500;
  })
  .sort((a, b) => b.tvlUsd - a.tvlUsd);

console.log(`${todas.length} pools no total; ${universo.length} no universo.`);
console.log(`A ${(ESPERA / 1000).toFixed(1)}s por pool, isso leva ~${Math.ceil(universo.length * ESPERA / 60000)} minutos.\n`);

const escapar = (t) => (t == null ? "NULL" : `'${String(t).replace(/'/g, "''")}'`);
const numero = (v) => (v == null || !Number.isFinite(v) ? "NULL" : v.toFixed(4));

const linhas = [];
let ok = 0, vazias = 0, barrados = 0;

for (const [i, p] of universo.entries()) {
  try {
    const r = await fetch(`https://yields.llama.fi/chart/${p.id}`);
    if (r.status === 429) {
      barrados++;
      // Levou 429: para mais tempo. Insistir no mesmo ritmo só piora.
      await respirar(6000);
      continue;
    }
    const pontos = (await r.json())?.data || [];
    if (!pontos.length) { vazias++; continue; }

    for (const ponto of pontos) {
      const dia = String(ponto.timestamp || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
      /* Só a janela recente.
       *
       * O gráfico devolve a vida inteira da pool — em 05/09/2026, 234 pools
       * deram 86 mil pontos, uma média de 370 dias cada. Guardar tudo daria 254
       * mil linhas e um arquivo de 33 MB pra sustentar uma conta que só olha 30
       * dias. O corte não é economia: é não carregar o que não se usa. */
      if (dia < CORTE_DIA) continue;
      linhas.push(
        `INSERT OR REPLACE INTO historico_piscina (id, dia, apy, apy_base, apy_reward, tvl) VALUES (` +
        `${escapar(p.id)}, ${escapar(dia)}, ${numero(ponto.apy)}, ${numero(ponto.apyBase)}, ` +
        `${numero(ponto.apyReward)}, ${numero(ponto.tvlUsd)});`,
      );
    }
    ok++;
  } catch {
    vazias++;
  }
  if (i % 10 === 0 || i === universo.length - 1) {
    process.stdout.write(`  ${i + 1}/${universo.length} · ${ok} colhidas · ${linhas.length} pontos   \r`);
  }
  await respirar(ESPERA);
}

console.log(`\n\n${ok} pools colhidas, ${vazias} sem gráfico, ${barrados} barradas pela API.`);
console.log(`${linhas.length} pontos de histórico.`);

if (!linhas.length) {
  console.log("\nNada pra enviar. Se todas foram barradas, espere alguns minutos e rode de novo.");
  process.exit(1);
}

const arquivo = "semente-pools.sql";
writeFileSync(arquivo, linhas.join("\n") + "\n", "utf8");
console.log(`Gravei ${arquivo}.`);

if (soArquivo) {
  console.log(`\nPra enviar:\n  npx wrangler d1 execute radar-defi --remote --file=${arquivo}`);
  process.exit(0);
}

console.log("\nMandando pro banco na nuvem (pode demorar)...");
try {
  execFileSync("npx", ["wrangler", "d1", "execute", "radar-defi", "--remote", "--file", arquivo, "--yes"],
    { stdio: "inherit", shell: process.platform === "win32" });
  console.log("\nPronto. Agora abra /medir/<GATILHO> pra calcular as medidas.");
} catch {
  console.log(`\nNão consegui enviar sozinho. Mande à mão:`);
  console.log(`  npx wrangler d1 execute radar-defi --remote --file=${arquivo}`);
  process.exit(1);
}
