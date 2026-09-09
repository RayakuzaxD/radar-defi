/* O método B.A.R.C.A. — as cinco caixinhas da carteira.
 *
 * Transcrito da aula "Método B.A.R.C.A." (Portal 7) em 08/09/2026. Antes disso
 * eu só tinha duas migalhas soltas no código do POOLIANA ("já é o 15% BARCA" e
 * "penalidade de risco baseada no tipo de par"), e nenhuma das cinco letras.
 *
 *     B  Base sólida ....... Bitcoin. Preservação, comprado por DCA.
 *     A  Ativos voláteis ... altcoins. A valorização exponencial.
 *     R  Renda passiva ..... pools, real yield, lending, RWA. Juro composto.
 *     C  Caixa ............. stablecoins. Bala na agulha pra queda.
 *     A  Aprender .......... airdrops. Testar, interagir e errar.
 *
 * A REGRA MAIS IMPORTANTE DESTE ARQUIVO não é número nenhum — é esta frase:
 *
 *     "Não é para você copiar, não é para você engessar o que está aqui. É
 *      ridículo eu querer fazer você seguir a mesma coisa que eu sigo. [...] As
 *      alocações e as porcentagens VOCÊ que vai definir, de acordo com o seu
 *      perfil de risco, com a sua análise e com o ciclo em que nós estamos."
 *
 * É o mesmo que ele diz sobre range ("a gente não passa ranges aqui dentro").
 * Então tudo aqui é REFERÊNCIA, marcada como referência, e o alvo de verdade é
 * o que o Rayakuza escrever. O radar mostra a distância entre os dois e cala.
 *
 * Nada aqui fala com a rede nem com o banco.
 */

/* A divisão que ele desenha no slide.
 *
 * A transcrição ouviu "aprender 10%", o que somaria 105%. Mais adiante ele
 * repete três vezes "esse 5%" falando da parcela de airdrop — então é 5, e a
 * soma fecha 100. Corrigido pela aritmética, não por palpite.
 *
 * Confere com a única migalha que eu já tinha: o POOLIANA chama a parcela de LP
 * de "o 15% BARCA", que é exatamente a renda passiva daqui. */
export const REFERENCIA = [
  { chave: "base",    letra: "B", nome: "Base sólida",     o_que: "Bitcoin",                        pct: 50 },
  { chave: "volatil", letra: "A", nome: "Ativos voláteis", o_que: "altcoins",                       pct: 20 },
  { chave: "renda",   letra: "R", nome: "Renda passiva",   o_que: "pools, real yield, empréstimos", pct: 15 },
  { chave: "caixa",   letra: "C", nome: "Caixa",           o_que: "stablecoins",                    pct: 10 },
  { chave: "aprender",letra: "A", nome: "Aprender",        o_que: "airdrops",                       pct: 5  },
];

/* Como ELE mexe nas caixinhas conforme o ciclo. Palavras dele:
 *
 *   bear: "gosto de ter posições de 50% a 60% em Bitcoin e o resto em caixa
 *          [...] minha parcela de altcoins vai ser reduzida praticamente para
 *          zero, a de aprendizado praticamente para zero [...] renda passiva
 *          maior. Eu não posso perder dinheiro em um bear market."
 *
 *   bull: "essa parcela de Bitcoin começa a cair para 40%, 30%, e eu começo a
 *          aumentar muito a parcela de ativos voláteis; a de airdrops começa a
 *          ficar maior; em caixa costumo ter 10%, 15%."
 *
 * Os números abaixo são a leitura literal disso, e somam 100 nos dois casos.
 * Continuam sendo REFERÊNCIA — ele diz na mesma aula que isso é pessoal. */
export const POR_CICLO = {
  bear: { base: 60, volatil: 5,  renda: 25, caixa: 10, aprender: 0 },
  bull: { base: 35, volatil: 35, renda: 12, caixa: 13, aprender: 5 },
};

/* Quantos ativos ter em carteira, da aula "Alocação de Carteira".
 *
 *   "Períodos de bull market, 8, 10, 12 ativos. Períodos de bear market, 2, 3
 *    ativos — justamente para proteção patrimonial."
 *
 * E o motivo de mais NÃO ser melhor, que é contraintuitivo: passando de 10 a 15
 * o risco AUMENTA, porque a chance de repetir setor é alta ("tenho três
 * criptomoedas do mesmo setor; se esse setor der ruim eu sofro três vezes") e
 * porque ninguém acompanha 30 projetos ("cai 10%, você se desespera e vende"). */
export const QUANTOS_ATIVOS = {
  bull: { minimo: 8, maximo: 12 },
  bear: { minimo: 2, maximo: 3 },
  narrativas: { minimo: 3, maximo: 4 },
  ondeORiscoVolta: 15,
};

/* A referência do ciclo em que se está. "indefinido" cai na tabela geral, pelo
 * mesmo motivo do resto do radar: não fingir veredito que não tenho. */
export function referenciaDoCiclo(ciclo) {
  const porCiclo = POR_CICLO[ciclo];
  return REFERENCIA.map((r) => ({
    ...r,
    pct: porCiclo ? porCiclo[r.chave] : r.pct,
    deOnde: porCiclo ? `como ele faz em ${ciclo}` : "a divisão do slide",
  }));
}

export function quantosAtivos(ciclo) {
  return QUANTOS_ATIVOS[ciclo] || null;
}

/* ---------------------------------------------------------------------------
 * O REBALANCEAMENTO — "a tua carteira sempre vai te dizer o que fazer"
 *
 *   "Se você estipulou que a sua posição em caixa deveria ser 25% e agora ela
 *    está 28%, 30%, você tem um excedente. Pega um pouco disso e realoca na
 *    parte da carteira que está pedindo."
 *
 *   "Se a minha parcela de caixa foi de 20% para 25%, as altcoins derreteram.
 *    Então a minha parcela em altcoins, que era 20%, foi para 15%. O que eu
 *    faço? Pego o 5% de caixa, compro altcoins pra voltar aos 20%."
 *
 * Repare o que a regra NÃO é: ela não é uma opinião sobre o mercado. É
 * aritmética sobre um alvo que a própria pessoa escolheu. Por isso ela cabe
 * neste radar — o alvo continua sendo dele.
 * ------------------------------------------------------------------------- */

/* Quanto uma fatia precisa se afastar do alvo pra valer uma realocação.
 *
 * O exemplo da aula é 20% virando 25% ou 15% — cinco pontos. Abaixo disso o
 * movimento é oscilação de preço, e mexer na carteira por oscilação é pagar
 * taxa pra ficar no mesmo lugar. */
export const REBALANCO = { desvioQueImporta: 5 };

export function lerDesvio(fatia, lim = REBALANCO) {
  const alvo = Number(fatia?.alvo);
  const atual = Number(fatia?.pct);
  if (!Number.isFinite(alvo) || !Number.isFinite(atual)) return null;
  const desvio = atual - alvo;
  if (Math.abs(desvio) < lim.desvioQueImporta) {
    return { desvio, estado: "no-alvo", texto: `está em ${atual.toFixed(1)}%, perto do alvo de ${alvo}%` };
  }
  if (desvio > 0) {
    return {
      desvio, estado: "acima",
      texto: `está ${desvio.toFixed(1)} pontos ACIMA do seu alvo: ${atual.toFixed(1)}% contra ${alvo}%`,
    };
  }
  return {
    desvio, estado: "abaixo",
    texto: `está ${Math.abs(desvio).toFixed(1)} pontos ABAIXO do seu alvo: ${atual.toFixed(1)}% contra ${alvo}%`,
  };
}

/* O que a carteira está dizendo, no conjunto.
 *
 * Junta quem sobrou com quem faltou e nomeia o par — que é como a aula ensina
 * ("pego o 5% de caixa, compro altcoins"). Nunca em valor: o radar não sabe
 * quanto ele quer movimentar, e sugerir quantia seria passar de mostrar pra
 * mandar. */
export function oQueACarteiraDiz(fatias, lim = REBALANCO) {
  const com = (fatias || [])
    .map((f) => ({ f, d: lerDesvio(f, lim) }))
    .filter((x) => x.d);

  const acima = com.filter((x) => x.d.estado === "acima").sort((a, b) => b.d.desvio - a.d.desvio);
  const abaixo = com.filter((x) => x.d.estado === "abaixo").sort((a, b) => a.d.desvio - b.d.desvio);

  const recados = [];
  for (const s of acima) {
    const par = abaixo[0];
    recados.push({
      fatia: s.f.fatia, estado: "acima", desvio: s.d.desvio,
      texto: par
        ? `${s.f.fatia} ${s.d.texto}. ${par.f.fatia} ${par.d.texto} — é o par que a aula descreve.`
        : `${s.f.fatia} ${s.d.texto}.`,
    });
  }
  for (const s of abaixo) {
    if (acima.length) continue; // já nomeado como par acima
    recados.push({ fatia: s.f.fatia, estado: "abaixo", desvio: s.d.desvio, texto: `${s.f.fatia} ${s.d.texto}.` });
  }

  return {
    recados,
    equilibrada: recados.length === 0,
    // A ausência de recado é resposta, não silêncio.
    resumo: recados.length === 0
      ? "Nenhuma fatia se afastou mais de 5 pontos do alvo que você definiu."
      : `${recados.length} fatia${recados.length === 1 ? "" : "s"} fora do alvo que você definiu.`,
  };
}
