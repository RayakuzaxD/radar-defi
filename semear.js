/* Dá memória ao radar antes de ele nascer.
 *
 *   node semear.js              # 120 maiores redes, 45 dias
 *   node semear.js 200 90       # mais redes, mais fundo
 *   node semear.js --só-arquivo # gera o .sql e não envia
 *
 * O radar publicado guarda uma foto por dia e faz as contas em cima do que ele
 * mesmo guardou. Sem este passo ele levaria uma semana pra conseguir dizer
 * "cresceu 7%" — e um radar que fica sete dias mudo é um radar que ninguém
 * confia depois.
 *
 * Roda aqui e não lá porque são centenas de chamadas de rede, e o plano grátis
 * da Cloudflare corta em 50 por execução. Aqui não tem esse limite.
 */

import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { colherHistorico, redesQueImportam } from "./src/semente.js";

const args = process.argv.slice(2);
const soArquivo = args.includes("--só-arquivo") || args.includes("--so-arquivo");
const numeros = args.filter((a) => /^\d+$/.test(a)).map(Number);
const quantasRedes = numeros[0] || 120;
const quantosDias = numeros[1] || 45;

console.log(`Semeando ${quantasRedes} redes × ${quantosDias} dias.\n`);

const { lista } = await redesQueImportam();
const alvos = lista.slice(0, quantasRedes).map((r) => r.rede);
console.log(`${lista.length} redes acima de $2M; vou buscar as ${alvos.length} maiores.`);
console.log("Isso demora alguns minutos — são duas passadas (valor parado e stablecoins).\n");

const porDia = await colherHistorico(alvos, {
  dias: quantosDias,
  aoAndar: (feito, total) => process.stdout.write(`  ${feito}/${total}   \r`),
});

console.log(`\n\nColhi ${porDia.size} dias.`);

/* Vira SQL. Uma linha por (dia, rede); `INSERT OR REPLACE` para poder semear de
 * novo depois sem duplicar nem apagar o que o radar já gravou sozinho. */
const linhas = [];
const escapar = (t) => `'${String(t).replace(/'/g, "''")}'`;
const numero = (v) => (v == null || !Number.isFinite(v) ? "NULL" : v.toFixed(2));

let vazias = 0;
for (const [dia, redes] of [...porDia].sort()) {
  for (const [rede, v] of redes) {
    // Dia sem valor parado não vira linha: uma linha com tvl NULL faria
    // `fotoDeDiasAtras` achar que aquele dia existe e parar de recuar,
    // comparando contra o nada.
    if (v.tvl == null) { vazias++; continue; }
    linhas.push(
      `INSERT OR REPLACE INTO fotos (dia, rede, tvl, stables) VALUES (${escapar(dia)}, ${escapar(rede)}, ${numero(v.tvl)}, ${numero(v.stables)});`,
    );
  }
}

const arquivo = "semente.sql";
writeFileSync(arquivo, linhas.join("\n") + "\n", "utf8");
console.log(`${linhas.length} linhas em ${arquivo}${vazias ? ` (${vazias} dias sem valor parado, descartados)` : ""}.`);

// Uma conferida antes de mandar: quem instala precisa saber se o radar vai nascer
// capaz de comparar 7 e 30 dias, e não descobrir isso depois pelo silêncio.
const dias = [...porDia.keys()].sort();
console.log(`Cobertura: de ${dias[0]} a ${dias[dias.length - 1]}.`);
if (dias.length < 31) {
  console.log(`⚠️  Só ${dias.length} dias — a conta de 30 dias vai ficar vazia até completar.`);
}

if (soArquivo) {
  console.log(`\nNão enviei nada. Pra enviar:\n  npx wrangler d1 execute radar-defi --remote --file=${arquivo}`);
  process.exit(0);
}

console.log("\nMandando pro banco na nuvem...");
try {
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "radar-defi", "--remote", "--file", arquivo, "--yes"],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  console.log("\nPronto. Confira em /saude se o radar já tem os 8 dias que precisa.");
} catch {
  console.log(`\nNão consegui enviar sozinho. O arquivo está pronto — mande à mão:`);
  console.log(`  npx wrangler d1 execute radar-defi --remote --file=${arquivo}`);
  process.exit(1);
}
