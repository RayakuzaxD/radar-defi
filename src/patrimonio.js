/* QUANTO O PATRIMÔNIO RENDEU — e por que aporte novo não é rendimento.
 *
 * ---------------------------------------------------------------------------
 * NÃO CONFUNDIR COM `rendimento.js`, e o nome deste arquivo é o conserto
 *
 * Eu escrevi tudo isto dentro de `src/rendimento.js` e SOBRESCREVI o arquivo
 * que já existia — o que mede quanto uma POOL paga (cartaz, chão, classe). O
 * teste dele foi junto. Só apareceu quando o `index.js` parou de carregar
 * procurando um `separarPar` que eu tinha apagado.
 *
 * São duas coisas com o mesmo nome em português e nada em comum:
 *
 *   rendimento.js   o que uma POOL paga — entra série de APY, sai chão e classe
 *   patrimonio.js   como o DINHEIRO DELE se comportou — entra carteira e
 *                   lançamentos, sai lucro e retorno
 *
 * A lição não é "olhe antes de escrever": é que nome genérico em domínio que
 * tem duas coisas parecidas é uma colisão esperando acontecer. `patrimonio` diz
 * de quem é o número.
 *
 * ---------------------------------------------------------------------------
 * O ERRO QUE ESTE ARQUIVO EXISTE PRA NÃO COMETER
 *
 * Pedido dele em 11/09/2026, e a frase é o requisito inteiro:
 *
 *   "vi vários lugares contando novos aportes como rendimento, isso não faz
 *    sentido. Novo aporte é só novo aporte; o rendimento dele inicia da data
 *    que foi colocado na caixinha pra frente, não pode entrar como lucro."
 *
 * Ele está certo, e o erro é comum porque a conta errada é a mais óbvia:
 * "quanto eu tenho hoje menos quanto eu tinha no mês passado". Quem deposita
 * US$ 500 num mês parado lê +50% de rendimento e fica feliz com nada.
 *
 * A conta certa subtrai o dinheiro que ENTROU:
 *
 *     lucro = valor no fim − valor no início − aportes + saques
 *
 * O aporte entra dos dois lados e se cancela. Depositar hoje rende zero hoje,
 * e passa a render do próximo movimento de preço em diante — que é exatamente
 * o que ele descreveu.
 *
 * ---------------------------------------------------------------------------
 * A PORCENTAGEM É OUTRO PROBLEMA, E MAIS TRAIÇOEIRO
 *
 * Achar o lucro em dólar é fácil. Dividir por QUÊ é que não é: o capital mudou
 * de tamanho no meio do caminho. Dividir pelo valor do início superestima
 * (ignora que o dinheiro novo também trabalhou); dividir pelo do fim
 * subestima.
 *
 * A resposta é encadear os pedaços: o retorno de cada dia é medido sobre o
 * capital que existia NAQUELE dia, e os dias se multiplicam. É o retorno
 * ponderado pelo tempo, e ele tem a propriedade que o Rayakuza pediu como
 * DEFINIÇÃO, não como consequência: um aporte, de qualquer tamanho, em
 * qualquer data, muda o retorno em exatamente zero.
 *
 *     retorno = Π ( V_i − F_i ) / V_(i−1)  − 1
 *
 * ---------------------------------------------------------------------------
 * COLHER NÃO É APORTAR (receita 3.4 do projeto)
 *
 * Três tipos de movimento, e a colheita é a que engana:
 *
 *   aporte     dinheiro de fora entrando   → é fluxo, sai da conta do lucro
 *   saque      dinheiro saindo pra fora    → é fluxo, sai da conta do lucro
 *   colheita   taxa recolhida da pool      → NÃO é fluxo: é lucro realizado
 *
 * A colheita MEXE na quantidade de token (as moedas chegaram mesmo na
 * carteira) mas NÃO é dinheiro de fora. Tratá-la como aporte apagaria
 * justamente o ganho que ele foi buscar — "o momento em que o usuário realiza
 * o lucro vira o momento em que a ferramenta diz que não houve nenhum". */

export const JANELAS = [
  { chave: "24h", nome: "24 horas", dias: 1 },
  { chave: "1m", nome: "1 mês", dias: 30 },
  { chave: "3m", nome: "3 meses", dias: 90 },
  { chave: "1a", nome: "1 ano", dias: 365 },
];

/* O movimento é dinheiro de FORA? Devolve o valor com sinal, ou 0.
 *
 * Um lugar só decide isto no programa inteiro. Espalhado, "colheita conta?"
 * acabaria respondido de dois jeitos diferentes no mesmo arquivo — que é como
 * nasce o relatório que não fecha com a tela. */
export function fluxoExterno(m) {
  const v = Number(m?.valor_usd);
  if (!Number.isFinite(v) || v <= 0) return 0;
  if (m.tipo === "aporte") return v;
  if (m.tipo === "saque") return -v;
  return 0; // colheita: lucro realizado, não dinheiro de fora
}

/* MOVIMENTO EM LINHA DE POSIÇÃO É REMANEJAMENTO, NÃO DINHEIRO DE FORA.
 *
 * Ele viu e disse a regra inteira em duas linhas:
 *
 *   "lançamento de pools estão somando como lucro, isso também é mentira.
 *    Lucro é rendimento de tokens ou taxa de pool; o resto deveria ser apenas
 *    aporte no total do patrimônio."
 *
 * Está certo, e o mecanismo do erro é este: fechar a pool lançava um SAQUE de
 * US$ 101,95, a conta lia "saiu dinheiro do patrimônio" e compensava com
 * lucro — +101,95 de ganho num dia em que nada rendeu. O dinheiro não saiu de
 * lugar nenhum: virou SOL na carteira dele, dois centímetros ao lado na mesma
 * tela.
 *
 * Fundar uma pool com USDC que já estava lá é o mesmo caso pelo avesso.
 * Dinheiro que anda ENTRE as linhas dele não entra nem sai do patrimônio, e
 * por isso não pode mexer no rendimento — nem pra cima nem pra baixo.
 *
 * Dinheiro NOVO continua sendo dinheiro novo: ele entra pela linha do token
 * que chegou (o USDC que veio da corretora), e ali é aporte de verdade. */
export function ehRemanejamento(m, chavesDePosicao) {
  if (!m || !chavesDePosicao) return false;
  const k = m.chave;
  if (!k) return false;
  const tem = typeof chavesDePosicao.has === "function"
    ? chavesDePosicao.has(k)
    : !!chavesDePosicao[k];

  /* SÓ O SAQUE, e a assimetria é o ponto fino desta regra.
   *
   * SAQUE de posição: o dinheiro VOLTA pra carteira dele, e a linha de token
   * cresce sozinha. Contar como saída faria a conta compensar com lucro — foi
   * o "+US$ 101,95" que ele viu. Fluxo zero, e a sombra na linha de token
   * cuida do resto.
   *
   * APORTE em posição: conta, e tem que contar. Quem funda pool com dinheiro
   * de DENTRO não lança nada (a linha de origem míngua sozinha), e pra essa a
   * posição é devolvida ao passado pelo valor de entrada. Quem LANÇA um aporte
   * está dizendo que o dinheiro veio de fora — a posição não volta ao passado,
   * e sem o fluxo o dinheiro apareceria do nada como lucro.
   *
   * É a frase dele, literal: "deve contar como novos aportes mas não como
   * lucros". O aporte soma no total e rende zero; o saque não faz nem uma
   * coisa nem outra. */
  return tem && m.tipo === "saque";
}

/* O fluxo que conta pro patrimônio: o externo, sem o remanejamento. */
export function fluxoDoPatrimonio(m, chavesDePosicao) {
  return ehRemanejamento(m, chavesDePosicao) ? 0 : fluxoExterno(m);
}

/* O movimento mexe na QUANTIDADE de token? Aí a colheita conta.
 *
 * São perguntas diferentes e a resposta é diferente: a colheita não é dinheiro
 * de fora, mas as moedas chegaram de verdade na carteira. Reconstruir a
 * quantidade de ontem sem descontá-la daria uma quantidade errada — e um valor
 * de ontem inflado vira prejuízo inventado hoje. */
export function mexeNaQuantidade(m) {
  const v = Number(m?.valor_usd);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return m.tipo === "saque" ? -v : v; // aporte e colheita entram
}

const soODia = (d) => String(d || "").slice(0, 10);

/* QUANTOS TOKENS HAVIA NA DATA, partindo de quantos há hoje.
 *
 * Anda pra trás: tudo que ENTROU depois daquela data não estava lá, e tudo que
 * SAIU depois ainda estava. Cada movimento é convertido de dólar pra token
 * pelo preço DO DIA DELE — o `valor_usd` já vem congelado no lançamento, e é
 * justamente isso que faz a conversão ser o número de moedas que aquele
 * dinheiro comprou, e não o que compraria hoje.
 *
 * Devolve null quando falta preço de algum dia necessário. Null aqui vira
 * "esta janela não aparece na tela" — melhor do que um valor que parece certo. */
export function quantidadeNaData(qtdHoje, movimentos, precoEm, data) {
  const q0 = Number(qtdHoje);
  if (!Number.isFinite(q0) || q0 < 0) return null;
  const corte = soODia(data);
  if (!corte) return null;

  let q = q0;
  for (const m of movimentos || []) {
    const quando = soODia(m?.quando);
    if (!quando || quando <= corte) continue;
    const usd = mexeNaQuantidade(m);
    if (!usd) continue;

    /* A QUANTIDADE LANÇADA MANDA; o preço do dia é o socorro.
     *
     * O lançamento dele guarda `qtd_a` — quantas moedas aquele dinheiro
     * comprou DE VERDADE, no preço que ele pagou, não no fechamento do dia.
     * É o que ele disse em 11/09/2026: "a blockchain dá a idade do token e
     * quando comprei por quanto". Quando a quantidade existe, converter por
     * preço seria trocar um fato por uma estimativa.
     *
     * Hoje 17 dos 24 lançamentos têm quantidade; os outros 7 caem na
     * conversão pelo preço do dia, que é estimativa e se declara como tal
     * pelo campo `estimada` no resultado. */
    const qm = Number(m?.qtd_a);
    if (Number.isFinite(qm) && qm > 0) {
      q -= (usd < 0 ? -qm : qm);
    } else {
      const p = precoEm(quando);
      if (!(p > 0)) return null;
      q -= usd / p;
    }
  }
  /* Quantidade negativa não é um saldo: é sinal de que a história está
     incompleta (uma troca não lançada, por exemplo). Devolver zero esconderia
     isso; devolver null faz a janela sumir e é honesto. */
  return q < -1e-12 ? null : Math.max(0, q);
}

/* O VALOR DA CARTEIRA INTEIRA NUMA DATA.
 *
 * Três tipos de linha, três tratamentos, e os três declaram o que não sabem:
 *
 *   token + quantidade   reconstruída (acima) e avaliada ao preço do dia
 *   posição na cadeia    valia ZERO antes de entrar; depois, o valor de
 *                        entrada, porque valor histórico de pool não existe
 *                        em fonte nenhuma
 *   valor digitado       o que ele digitou, convertido pelo câmbio do dia
 *
 * A POSIÇÃO É A PARTE FRACA, e está dita: entre a data de entrada e hoje eu uso
 * o valor de entrada, que ignora o que ela rendeu no meio. Para as janelas de
 * um mês pra cima isso não toca em nada — nenhuma posição dele tem mais de
 * quatro dias — mas o dia em que tiver, o número vai ser conservador, e é o
 * lado certo pra errar. */
export function valorNaData({ linhas, movimentos, precoEm, cambioEm }, data) {
  const corte = soODia(data);
  if (!corte || !Array.isArray(linhas)) return null;

  const porChave = new Map();
  for (const m of movimentos || []) {
    const k = m?.chave;
    if (!k) continue;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(m);
  }

  /* AS MOEDAS QUE A POOL DEVOLVEU NÃO ESTAVAM NA LINHA DE TOKEN ANTES.
   *
   * Esta é a outra metade de "remanejamento não é lucro", e sem ela o erro só
   * troca de sinal. A linha de SOL segue a carteira: quando a pool fecha e
   * devolve 1,0266 SOL, a linha CRESCE sozinha, sem lançamento nenhum. Andando
   * pra trás sem descontar, o SOL de hoje apareceria também no passado — e o
   * patrimônio de ontem ficaria inflado pela pool E pelo SOL dela ao mesmo
   * tempo, contando o mesmo dinheiro duas vezes.
   *
   * O lançamento da posição carrega a quantidade e o símbolo quando foi lido
   * da cadeia (`qtd_a`/`simbolo_a`). Daí sai um movimento-sombra na linha do
   * token, com o TIPO INVERTIDO: saque da pool = moedas entrando na linha;
   * aporte na pool = moedas saindo dela.
   *
   * Sem quantidade e símbolo não há sombra a criar — e aí vale o
   * comportamento antigo, que erra pra menos e não inventa. É mais uma razão
   * pra ler a cadeia em vez de estimar. */
  const chavesDePosicao = new Set(
    linhas.filter((l) => l?.posicao && l?.chave).map((l) => l.chave));
  const sombras = new Map();
  for (const m of movimentos || []) {
    if (!chavesDePosicao.has(m?.chave)) continue;
    if (m.tipo !== "aporte" && m.tipo !== "saque") continue;
    for (const [qtd, simbolo] of [[m.qtd_a, m.simbolo_a], [m.qtd_b, m.simbolo_b]]) {
      const q = Number(qtd);
      if (!Number.isFinite(q) || q <= 0 || !simbolo) continue;
      const chave = String(simbolo).toUpperCase();
      if (!sombras.has(chave)) sombras.set(chave, []);
      sombras.get(chave).push({
        quando: m.quando,
        tipo: m.tipo === "saque" ? "aporte" : "saque",
        valor_usd: 1, // só o sinal importa: a quantidade manda
        qtd_a: q,
      });
    }
  }

  let total = 0;
  for (const l of linhas) {
    const movs = porChave.get(l?.chave) || [];

    if (l?.posicao) {
      const entrou = soODia(l.data_entrada);
      const fechou = soODia(l.fechada_em);
      const v = Number(l.valor_entrada);
      if (!Number.isFinite(v)) return null;

      if (entrou && entrou <= corte) {
        if (fechou && fechou <= corte) continue; // já não existia na data

        /* A ENTRADA MAIS O QUE ELE MEXEU DEPOIS. Ele aumenta pools e tira
         * pedaços delas ("posso querer aumentar uma pool... posso retirar
         * parte"), e o detector de mexida transforma isso em lançamento na
         * chave da posição. Sem somá-los aqui, uma janela aberta DEPOIS do
         * aporte partiria do valor de entrada velho e o aporte apareceria
         * como valorização — o erro proibido, na casa das posições. */
        let comMexidas = v;
        for (const m of movs) {
          const quando = soODia(m?.quando);
          if (!quando || quando <= entrou || quando > corte) continue;
          comMexidas += fluxoExterno(m);
        }
        total += Math.max(0, comMexidas);
        continue;
        /* `fluxoExterno` e não `fluxoDoPatrimonio` aqui de propósito: a
           pergunta é quanto a POSIÇÃO valia, e pra ela o depósito entrou de
           verdade. Se veio de dentro ou de fora é pergunta do PATRIMÔNIO, e
           quem responde essa é a sombra na linha de token, logo acima. */
      }

      /* A POSIÇÃO AINDA NÃO EXISTIA — MAS O DINHEIRO DELA JÁ, e este é o
       * buraco que quase virou lucro fantasma.
       *
       * Quando ele funda uma pool com USDC que já estava na carteira, a linha
       * de USDC que segue a cadeia DIMINUI SOZINHA, sem lançamento nenhum —
       * é remanejamento, não aporte (receita 3.5). A reconstrução da linha
       * líquida não enxerga essa saída, então numa data anterior à pool ela
       * devolveria o USDC já magro E a pool ainda inexistente: o dinheiro
       * sumia do passado, e dinheiro que some do passado reaparece no
       * presente como rendimento. É exatamente a classe de erro que ele pediu
       * pra nunca cometer, só que de cabeça pra baixo.
       *
       * Então: posição aberta DEPOIS da data devolve ao passado o pedaço do
       * seu valor de entrada que veio DE DENTRO — a entrada menos os aportes
       * externos lançados na chave dela nesse meio-tempo. O que veio de fora
       * ("desmontei 2 e coloquei capital novo") tem lançamento, e lançamento
       * já é tratado como fluxo; devolver esse pedaço também contaria o
       * capital novo duas vezes.
       *
       * E SÓ PRA POSIÇÃO AINDA ABERTA HOJE. A pergunta não é "quando ela
       * fechou", é "o dinheiro dela está fora da carteira líquida AGORA?".
       * Posição que abriu e fechou depois da data devolveu o dinheiro pra
       * carteira antes de hoje: a quantidade líquida de hoje já o contém, a
       * reconstrução que parte de hoje já o carrega pro passado, e devolver
       * a entrada de novo contaria o mesmo dinheiro duas vezes. */
      if (!fechou) {
        let deFora = 0;
        for (const m of movs) {
          const quando = soODia(m?.quando);
          if (!quando || quando <= corte) continue;
          const f = fluxoExterno(m);
          if (f > 0) deFora += f;
        }
        total += Math.max(0, v - deFora);
      }
      continue;
    }

    if (l?.token != null && l?.quantidade != null) {
      const comSombras = movs.concat(
        sombras.get(String(l.token).toUpperCase()) || []);
      const q = quantidadeNaData(l.quantidade, comSombras, (d) => precoEm(l.token, d), corte);
      if (q == null) return null;
      const p = precoEm(l.token, corte);
      if (!(p > 0)) return null;
      total += q * p;
      continue;
    }

    if (l?.valor != null) {
      const v = Number(l.valor);
      if (!Number.isFinite(v)) return null;
      if (l.moeda === "BRL") {
        const c = cambioEm(corte); // dólares por real
        if (!(c > 0)) return null;
        total += v * c;
      } else {
        total += v;
      }
      continue;
    }
  }
  return total;
}

/* O RENDIMENTO DE UM PERÍODO, com o aporte neutralizado.
 *
 * Recebe a série diária já montada: [{ dia, valor, fluxo }], do mais velho pro
 * mais novo, com `fluxo` sendo o dinheiro de fora que entrou (+) ou saiu (−)
 * NAQUELE dia.
 *
 * Devolve o lucro em dólar e o retorno em porcentagem, e os dois respondem
 * perguntas diferentes: o dólar é o que ele sente no bolso, a porcentagem é
 * como o dinheiro se comportou independentemente de quanto dinheiro era. */
export function rendimentoDoPeriodo(serie) {
  if (!Array.isArray(serie) || serie.length < 2) return null;
  for (const p of serie) {
    /* `p.valor == null` ANTES do Number(), e não depois.
     *
     * `Number(null)` é 0, e 0 é finito — então a guarda que só olhava
     * `Number.isFinite` deixava passar um dia SEM medida como se fosse um dia
     * em que a carteira valia zero. Uma janela com um buraco assim no meio
     * mostraria uma queda de 100% seguida de uma alta infinita, e as duas com
     * cara de número. Foi o teste que pegou. */
    if (!p || p.valor == null || !Number.isFinite(Number(p.valor))) return null;
  }

  const inicio = Number(serie[0].valor);
  const fim = Number(serie[serie.length - 1].valor);

  /* Os fluxos do PRIMEIRO ponto não contam: ele é a fotografia de onde a
     janela começa, e o que entrou antes dela já está dentro do valor inicial. */
  let aportes = 0, saques = 0;
  for (let i = 1; i < serie.length; i++) {
    const f = Number(serie[i].fluxo) || 0;
    if (f > 0) aportes += f; else saques += -f;
  }

  const lucro = fim - inicio - aportes + saques;

  /* O RETORNO ENCADEADO. Cada dia é medido sobre o capital daquele dia, e o
     fluxo do dia sai do numerador — é isso que faz o aporte valer zero por
     definição, e não por sorte de arredondamento. */
  let fator = 1;
  let temBuraco = false;
  for (let i = 1; i < serie.length; i++) {
    const v0 = Number(serie[i - 1].valor);
    const v1 = Number(serie[i].valor);
    const f = Number(serie[i].fluxo) || 0;
    if (!(v0 > 0)) {
      /* Carteira vazia no começo do dia: não há sobre o que render. O dia é
         pulado em vez de virar divisão por zero — e fica marcado, porque uma
         janela cheia de buracos não merece a mesma confiança. */
      if (v1 - f !== 0) temBuraco = true;
      continue;
    }
    fator *= (v1 - f) / v0;
  }

  return {
    inicio, fim, lucro, aportes, saques,
    pct: (fator - 1) * 100,
    dias: serie.length - 1,
    deQuando: serie[0].dia,
    ateQuando: serie[serie.length - 1].dia,
    temBuraco,
  };
}

/* O LUCRO DESDE O COMEÇO — exato, e sem precisar de história nenhuma.
 *
 * É o único número que não depende de saber quanto a carteira valia no
 * passado: o que entrou menos o que saiu é o custo, e o que ela vale hoje
 * menos esse custo é o lucro. Vale para os 18 meses de lançamentos dele.
 *
 * A colheita não entra, e essa é a parte que mais gente erra: ela já está
 * dentro do valor de hoje. Contá-la como aporte inflaria o custo e apagaria
 * exatamente o lucro que ela representa. */
export function lucroDesdeOComeco(valorHoje, movimentos) {
  const v = Number(valorHoje);
  if (!Number.isFinite(v)) return null;
  let aportes = 0, saques = 0;
  for (const m of movimentos || []) {
    const f = fluxoExterno(m);
    if (f > 0) aportes += f; else if (f < 0) saques += -f;
  }
  const custo = aportes - saques;
  return {
    valorHoje: v, aportes, saques, custo,
    lucro: v - custo,
    pct: custo > 0 ? ((v - custo) / custo) * 100 : null,
  };
}
