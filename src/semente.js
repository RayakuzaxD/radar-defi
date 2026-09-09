/* Colher o histórico do DefiLlama, rede por rede.
 *
 * Só roda no computador do Rayakuza, nunca no radar publicado. O motivo é duro: o
 * plano grátis da Cloudflare corta em 50 chamadas de rede por execução, e aqui
 * são centenas. Por isso o radar no ar guarda uma foto por dia e faz a conta em
 * cima do que ele mesmo guardou; este arquivo existe pra ele já nascer com
 * memória, em vez de passar a primeira semana sem ter o que dizer.
 */

import { historicoDaRede, historicoStablesDaRede, redesAgora, stablesAgora } from "./llama.js";

/* Quantas de cada vez. Cinco é educado: a API é aberta, de graça e sem chave,
 * e martelá-la com cem chamadas simultâneas é a maneira mais rápida de fazer
 * com que um dia ela deixe de ser aberta. */
const DE_CADA_VEZ = 5;

const respirar = (ms) => new Promise((r) => setTimeout(r, ms));

/* Roda `tarefa` sobre `itens` em levas, avisando o andamento. */
async function emLevas(itens, tarefa, aoAndar) {
  const saida = [];
  for (let i = 0; i < itens.length; i += DE_CADA_VEZ) {
    const leva = itens.slice(i, i + DE_CADA_VEZ);
    const feitos = await Promise.all(leva.map(async (it) => {
      try {
        return await tarefa(it);
      } catch (erro) {
        // Uma rede que falha não pode derrubar a colheita inteira. Rede sem
        // histórico simplesmente não terá variação — e `montarFichas` já sabe
        // devolver null em vez de inventar zero.
        return { item: it, erro: erro.message };
      }
    }));
    saida.push(...feitos);
    aoAndar?.(Math.min(i + DE_CADA_VEZ, itens.length), itens.length);
    await respirar(250);
  }
  return saida;
}

/* As redes que valem a pena guardar. */
export async function redesQueImportam(pisoTvl = 2e6) {
  const [redes, stables] = await Promise.all([redesAgora(), stablesAgora()]);
  const lista = [...redes.values()]
    .filter((r) => r.tvl >= pisoTvl)
    .sort((a, b) => b.tvl - a.tvl);
  return { lista, redes, stables };
}

/* Colhe o histórico e devolve Map(dia -> Map(rede -> {tvl, stables})).
 *
 * O formato é esse porque é exatamente o que `montarFichas` come, e porque é o
 * mesmo formato que sai do banco depois — assim o ensaio e o radar publicado
 * andam pelo mesmo caminho, e um erro de formato aparece no ensaio. */
export async function colherHistorico(nomes, { dias = 90, comStables = true, aoAndar } = {}) {
  const porDia = new Map();
  const guardar = (dia, rede, campo, valor) => {
    let doDia = porDia.get(dia);
    if (!doDia) porDia.set(dia, (doDia = new Map()));
    const linha = doDia.get(rede) || {};
    linha[campo] = valor;
    doDia.set(rede, linha);
  };

  const corte = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  await emLevas(nomes, async (rede) => {
    const pontos = await historicoDaRede(rede);
    for (const p of pontos) if (p.dia >= corte) guardar(p.dia, rede, "tvl", p.tvl);
    return { rede, pontos: pontos.length };
  }, aoAndar);

  if (comStables) {
    await emLevas(nomes, async (rede) => {
      const pontos = await historicoStablesDaRede(rede);
      for (const p of pontos) if (p.dia >= corte) guardar(p.dia, rede, "stables", p.stables);
      return { rede, pontos: pontos.length };
    }, aoAndar);
  }

  return porDia;
}

/* Recorta do histórico o mapa de "N dias atrás", que é o que os sinais pedem.
 *
 * Cai pra trás até achar um dia com dado: o DefiLlama às vezes pula um dia numa
 * rede, e comparar contra um dia vazio faria toda a rede sumir do radar em
 * silêncio — o pior tipo de falha, porque parece que não houve notícia. */
export function fotoDe(porDia, diasAtras, hoje = new Date()) {
  for (let recuo = 0; recuo <= 3; recuo++) {
    const alvo = new Date(hoje.getTime() - (diasAtras + recuo) * 86400000)
      .toISOString().slice(0, 10);
    const foto = porDia.get(alvo);
    if (foto && foto.size) return foto;
  }
  return new Map();
}
