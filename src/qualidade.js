/* As três perguntas que separam crescimento de verdade de crescimento comprado.
 *
 * O resto do radar responde "para onde o dinheiro foi". Este arquivo responde
 * "esse dinheiro tem motivo pra ficar" — que é a pergunta que o Rayakuza faz depois,
 * e que ele vai atrás de responder sozinho. Aqui não há recomendação nenhuma:
 * são três medidas e o contexto pra lê-las.
 *
 *   1. ALUGADO   — quanto do rendimento é pago em token emitido pela própria
 *                  rede, em vez de vir de uso real. Rendimento alugado atrai
 *                  dinheiro que vai embora quando o aluguel para. É o motivo
 *                  número um de uma rede subir 300% e devolver tudo depois.
 *
 *   2. TAXAS     — quanto a rede arrecada por dia, e quanto isso dá por milhão
 *                  parado. Uma rede com bilhão parado que arrecada mil por dia
 *                  é um estacionamento, não uma economia.
 *
 *   3. CONCENTRAÇÃO — quanto do dinheiro está num protocolo só. Se um protocolo
 *                  responde por 85% da rede, você não está olhando uma rede
 *                  crescendo: está olhando um produto crescendo, e o risco todo
 *                  mora nele.
 *
 * Nada aqui fala com a rede nem com o banco — entra dado bruto, sai medida.
 */

/* Aprende como a API de taxas chama cada rede.
 *
 * Os apelidos da API de taxas NÃO são deriváveis do nome oficial: `robinhood` é
 * "Robinhood Chain", `xdai` é "Gnosis", `avax` é "Avalanche", `era` é "ZKsync
 * Era". Em 03/09/2026 checamos: 104 dos 278 apelidos não saem de nenhuma
 * transformação do nome.
 *
 * Escrever a tabela à mão seria assinar a manutenção dela pra sempre — e o
 * sintoma de estar desatualizada é uma rede aparecer com taxa zero, que se
 * confunde com "essa rede não arrecada". Erro calado, do pior tipo.
 *
 * Então o mapa se aprende sozinho: um protocolo que vive numa rede só e aparece
 * com um apelido só na quebra revela o par. Com 1500 protocolos, quase toda rede
 * que importa é revelada por algum deles. */
export function aprenderApelidos(protocolosDeTaxa, redesOficiais) {
  const votos = new Map();
  for (const p of protocolosDeTaxa || []) {
    const redes = (p.chains || []).filter((r) => redesOficiais.has(r));
    const apelidos = Object.keys(p.breakdown24h || {});
    if (redes.length !== 1 || apelidos.length !== 1) continue;
    const chave = apelidos[0];
    const conta = votos.get(chave) || new Map();
    conta.set(redes[0], (conta.get(redes[0]) || 0) + 1);
    votos.set(chave, conta);
  }
  // Na dúvida, ganha quem tem mais protocolos confirmando.
  const mapa = new Map();
  for (const [apelido, conta] of votos) {
    const [melhor] = [...conta].sort((a, b) => b[1] - a[1]);
    mapa.set(apelido, melhor[0]);
  }
  return mapa;
}

/* Quanto cada rede arrecada por dia, em taxas de verdade. */
export function taxasPorRede(protocolosDeTaxa, apelidos) {
  const porRede = new Map();
  const somar = (rede, campo, valor) => {
    const r = porRede.get(rede) || { taxas24h: 0, taxas7d: 0, taxas30d: 0 };
    r[campo] += valor;
    porRede.set(rede, r);
  };
  for (const p of protocolosDeTaxa || []) {
    for (const [campo, quebra] of [
      ["taxas24h", p.breakdown24h],
      ["taxas30d", p.breakdown30d],
    ]) {
      for (const [apelido, dentro] of Object.entries(quebra || {})) {
        const rede = apelidos.get(apelido);
        if (!rede) continue;
        const total = Object.values(dentro || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        if (total) somar(rede, campo, total);
      }
    }
  }
  return porRede;
}

/* Quanto do rendimento de cada rede é alugado.
 *
 * `apyBase` é o que a coisa rende por ser usada — juros de quem tomou emprestado,
 * taxa de quem trocou. `apyReward` é token novo impresso e distribuído. A conta
 * pesa cada piscina pelo tamanho dela, senão uma piscina de mil dólares pagando
 * 900% ao ano distorceria a rede inteira. */
export function dependenciaDeIncentivo(piscinas) {
  const porRede = new Map();
  for (const p of piscinas || []) {
    const tvl = Number(p.tvlUsd) || 0;
    if (!p.chain || tvl <= 0) continue;
    const r = porRede.get(p.chain) || { tvl: 0, real: 0, alugado: 0, piscinas: 0 };
    r.tvl += tvl;
    r.piscinas++;
    // dólares por ano, não porcentagem: é o que permite somar piscinas de
    // tamanhos diferentes sem que a pequena mande na conta
    r.real += ((Number(p.apyBase) || 0) / 100) * tvl;
    r.alugado += ((Number(p.apyReward) || 0) / 100) * tvl;
    porRede.set(p.chain, r);
  }
  for (const r of porRede.values()) {
    const total = r.real + r.alugado;
    // Sem rendimento nenhum não dá pra dizer que é alugado nem que não é.
    // null é "não sei" — e não pode virar 0%, que seria um elogio inventado.
    r.fatiaAlugada = total > 0 ? (r.alugado / total) * 100 : null;
  }
  return porRede;
}

/* Quanto do dinheiro da rede está num protocolo só.
 *
 * A fatia é medida contra a SOMA dos protocolos daquela rede, nunca contra o TVL
 * oficial. Medir contra o oficial dá resultados acima de 100%, porque o
 * DefiLlama tira categorias inteiras da conta da rede mas não da lista de
 * protocolos — em 03/09/2026 a Mantle apareceu com ">100%" fazendo assim. */
export function concentracao(protocolos, rede, quantos = 3) {
  const naRede = [];
  for (const p of protocolos || []) {
    const aqui = p.porRede?.[rede];
    const tvl = Number(aqui?.tvl) || 0;
    if (tvl > 0) naRede.push({ nome: p.nome, categoria: p.categoria, tvl });
  }
  if (!naRede.length) return null;
  naRede.sort((a, b) => b.tvl - a.tvl);
  const soma = naRede.reduce((s, x) => s + x.tvl, 0);
  return {
    soma,
    quantos: naRede.length,
    maior: naRede[0].nome,
    fatiaDoMaior: (naRede[0].tvl / soma) * 100,
    topo: naRede.slice(0, quantos).map((x) => ({ ...x, fatia: (x.tvl / soma) * 100 })),
  };
}

/* Acima de $20.000 de taxa por dia a cada $1M parado, a rede estaria devolvendo
 * 2% do capital POR DIA — mais de 700% ao ano. Isso não existe de forma
 * sustentada. Quando aparece, é a conta dizendo que a taxa não vem daquele
 * capital, e não que a rede é excelente. */
export const TAXA_IMPLAUSIVEL = 20000;

/* Junta as três medidas numa ficha por rede. */
export function fichaDeQualidade(rede, { tvl, incentivo, taxas, concentra }) {
  const t24 = taxas?.taxas24h ?? null;
  return {
    rede,
    alugado: incentivo?.fatiaAlugada ?? null,
    piscinas: incentivo?.piscinas ?? 0,
    taxas24h: t24,
    // O número que compara redes de tamanhos diferentes: quanto de taxa cada
    // milhão parado gera por dia. É o mais próximo de "essa rede é usada".
    taxaPorMilhao: t24 != null && tvl > 0 ? t24 / (tvl / 1e6) : null,
    concentracao: concentra?.fatiaDoMaior ?? null,
    maiorProtocolo: concentra?.maior ?? null,
    topo: concentra?.topo ?? [],
  };
}

/* As observações que a ficha permite — cada uma nomeando o que olhar, nunca o
 * que fazer. São gatilhos de estudo, não conclusões.
 *
 * Os cortes são grosseiros de propósito: eles marcam "vale investigar", e quem
 * investiga é o Rayakuza. Um número fino aqui daria falsa precisão a uma leitura
 * que é, no fundo, um cheiro. */
export function observacoes(f) {
  const notas = [];

  if (f.alugado != null && f.alugado >= 60) {
    notas.push({
      peso: "cuidado",
      texto: `${f.alugado.toFixed(0)}% do rendimento é incentivo, não taxa`,
      estudar: "quanto tempo esse incentivo ainda dura, e o que sobra quando parar",
    });
  } else if (f.alugado != null && f.alugado <= 15 && f.piscinas >= 5) {
    notas.push({
      peso: "bom",
      texto: `quase todo o rendimento vem de taxas (só ${f.alugado.toFixed(0)}% é incentivo)`,
      estudar: "de onde vem esse uso, e se ele depende de um punhado de usuários",
    });
  }

  if (f.taxaPorMilhao != null) {
    if (f.taxaPorMilhao > TAXA_IMPLAUSIVEL) {
      /* Acima disso a arrecadação diária passa de 2% do capital parado — mais de
       * 700% ao ano. Nenhum capital rende isso de forma sustentada; o que a
       * conta está dizendo é que a taxa NÃO é gerada por esse capital.
       *
       * Acontece quando o DefiLlama atribui à rede uma taxa que não tem relação
       * com o TVL dela: taxa de emissor, de corretora, de ponte. Em 03/09/2026
       * a Canton apareceu com $205.574 por $1M — 20% do capital por dia.
       *
       * Mostrar isso como virtude seria o pior tipo de erro deste radar: um
       * número enorme, de aparência excelente, medindo outra coisa. */
      notas.push({
        peso: "duvidoso",
        texto: `a conta dá $${f.taxaPorMilhao.toFixed(0)} de taxa por dia a cada $1M parado — alto demais pra ser esse capital rendendo`,
        estudar: "de onde vem essa taxa; normalmente é de emissor, corretora ou ponte, e não tem relação com o dinheiro parado ali",
      });
    } else if (f.taxaPorMilhao < 50) {
      notas.push({
        peso: "cuidado",
        texto: `arrecada só $${f.taxaPorMilhao.toFixed(0)} por dia a cada $1M parado — o dinheiro está parado mesmo`,
        estudar: "por que o dinheiro está ali se não está sendo usado; costuma ser incentivo",
      });
    } else if (f.taxaPorMilhao > 1000) {
      notas.push({
        peso: "bom",
        texto: `arrecada $${f.taxaPorMilhao.toFixed(0)} por dia a cada $1M parado — muito uso pra pouco capital`,
        estudar: "se é volume real ou volume inflado, e quem paga essas taxas",
      });
    }
  }

  if (f.concentracao != null && f.concentracao >= 50) {
    notas.push({
      peso: "cuidado",
      texto: `${f.concentracao.toFixed(0)}% do dinheiro está num protocolo só (${f.maiorProtocolo})`,
      estudar: `não é a rede que está crescendo, é o ${f.maiorProtocolo}; o risco todo mora nele`,
    });
  }

  return notas;
}
