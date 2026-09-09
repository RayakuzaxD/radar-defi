/* O que o radar diria agora, se estivesse ligado.
 *
 *   node ensaiar.js            # as 60 maiores redes
 *   node ensaiar.js 150        # mais fundo, demora mais
 *
 * Busca de verdade no DefiLlama, calcula os sinais de verdade, imprime a
 * mensagem de verdade — e não manda nada pra ninguém, não escreve no banco e
 * não precisa de token do Telegram.
 *
 * Serve pra duas coisas: conferir se os limiares estão soltando um punhado de
 * avisos (e não duzentos, que é o mesmo que nenhum), e ler a mensagem antes de
 * ela chegar no celular.
 */

import { protocolosAgora } from "./src/llama.js";
import { colherHistorico, fotoDe, redesQueImportam } from "./src/semente.js";
import { montarFichas, sinaisDeRede, sinaisDeProtocolo, quemPuxou, possivelDestino, stablesConfiaveis } from "./src/sinais.js";
import { textoDoResumo, dinheiro, pct } from "./src/telegram.js";

const quantas = Number(process.argv[2]) || 60;

console.log(`Buscando o mercado (${quantas} maiores redes)...\n`);

const { lista, redes, stables } = await redesQueImportam();
const alvos = lista.slice(0, quantas).map((r) => r.rede);
console.log(`${lista.length} redes acima de $2M; olhando as ${alvos.length} maiores.`);

console.log("Colhendo histórico (é a parte demorada)...");
let ultimo = 0;
const porDia = await colherHistorico(alvos, {
  dias: 40,
  aoAndar: (feito, total) => {
    const p = Math.floor((feito / total) * 10);
    if (p > ultimo) { ultimo = p; process.stdout.write(`  ${feito}/${total}\r`); }
  },
});
console.log(`\nHistórico de ${porDia.size} dias.\n`);

// A foto de hoje vem do valor ao vivo, não do histórico: o histórico do
// DefiLlama fecha à meia-noite UTC e hoje ainda não fechou.
const hoje = new Map();
for (const r of lista) hoje.set(r.rede, { tvl: r.tvl, stables: stables.get(r.rede) ?? 0 });

const passado = new Map([
  [1, fotoDe(porDia, 1)],
  [7, fotoDe(porDia, 7)],
  [30, fotoDe(porDia, 30)],
]);

const fichas = montarFichas(hoje, passado);
const comHistorico = fichas.filter((f) => f.varTvl7d != null);
console.log(`${comHistorico.length} redes com histórico suficiente pra comparar.\n`);

console.log("Buscando protocolos...");
const protocolos = await protocolosAgora();
console.log(`${protocolos.length} protocolos acima de $5M.\n`);

const fonte = stablesConfiaveis(fichas);
if (!fonte.confiavel) {
  console.log(`⚠️  DADO DE STABLECOIN SUSPEITO: ${fonte.motivo}`);
  console.log("   O radar vai falar só do valor parado nesta rodada.\n");
}

const achados = sinaisDeRede(fichas, new Set(), undefined, fonte.confiavel);
const deProtocolo = sinaisDeProtocolo(protocolos);
const pares = possivelDestino(
  achados.filter((a) => a.tipo === "fuga"),
  achados.filter((a) => a.tipo === "entrada" || a.tipo === "pequena"),
);

console.log("=".repeat(64));
console.log("QUANTOS AVISOS SAIRIAM");
console.log("=".repeat(64));
for (const tipo of ["pequena", "entrada", "fuga"]) {
  console.log(`  ${tipo.padEnd(10)} ${achados.filter((a) => a.tipo === tipo).length}`);
}
console.log(`  protocolo  ${deProtocolo.length}`);
console.log(`  trocas     ${pares.length}`);

const puxadoresPor = {};
for (const a of achados.slice(0, 8)) puxadoresPor[a.alvo] = quemPuxou(a.alvo, protocolos, 3);

console.log(`\n${"=".repeat(64)}`);
console.log("A MENSAGEM QUE CHEGARIA NO CELULAR");
console.log("=".repeat(64));
const texto = textoDoResumo({
  dia: new Date().toISOString().slice(0, 10),
  achados, protocolos: deProtocolo, pares, puxadoresPor,
});
// Tira as marcas de HTML só pra leitura no terminal.
console.log(texto.replace(/<\/?(b|i)>/g, ""));
console.log(`\n(${texto.length} caracteres — o Telegram corta em 4096)`);

console.log(`\n${"=".repeat(64)}`);
console.log("AS 15 MAIORES REDES, PRA CONFERIR CONTRA O SITE DO DEFILLAMA");
console.log("=".repeat(64));
console.log("rede              parado      7d        stablecoins   7d");
for (const f of fichas.slice(0, 15)) {
  console.log(
    f.rede.slice(0, 17).padEnd(18) +
    dinheiro(f.tvl).padEnd(11) +
    pct(f.varTvl7d).padStart(7) + "   " +
    dinheiro(f.stables).padEnd(13) +
    pct(f.varStables7d).padStart(7),
  );
}
