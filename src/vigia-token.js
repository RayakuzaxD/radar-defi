/* O vigia dos tokens: o que chegou, e o que cruzou o preço médio.
 *
 * Pedido dele em 09/09/2026, depois de eu conferir que o bot só olhava as
 * pools e o empréstimo: "pode fazer com todos tokens voláteis que eu for
 * lançando — o bot avisa isso? novo token etc...".
 *
 * DUAS COISAS, e ele escolheu as duas certas.
 *
 * 1. TOKEN NOVO NA CARTEIRA. Chegou algo que ele não lançou — airdrop, troco
 *    de swap, transferência. Hoje ele só descobriria abrindo o app e clicando
 *    em Importar, e coisa que só se descobre procurando é coisa que não se
 *    descobre.
 *
 * 2. CRUZOU O PREÇO MÉDIO. Ele estava 11,5% abaixo do que pagou pelo Bitcoin e
 *    voltou pro positivo — ou o contrário. É a única das duas que fala do
 *    dinheiro DELE em vez do mercado, e só ficou possível quando o preço médio
 *    passou a existir.
 *
 * A TERCEIRA QUE ELE NÃO PEDIU, e eu desaconselhei: "token seu se mexeu
 * muito". Cripto se mexe 10% num dia normal; o aviso sairia quase diário e em
 * duas semanas ele pararia de ler todos — inclusive os das pools, que são os
 * urgentes. Bot que fala demais é bot que se aprende a ignorar.
 *
 * A REGRA DE SEMPRE: nada aqui manda fazer nada. "Passou do seu preço médio" é
 * fato. "Hora de vender" seria palpite sobre um futuro que ninguém tem.
 *
 * Nada aqui fala com a rede nem com banco: recebe leituras, devolve texto.
 */

/* O menor valor que merece uma mensagem.
 *
 * A carteira dele tem uma dúzia de tokens de poeira — PAYAI, $SOLID, LRTSSOL,
 * somando menos de dois dólares. Avisar de cada um seria transformar o aviso
 * de token novo em ruído no primeiro dia. */
export const MINIMO_PRA_AVISAR = 1;

/* COM SEPARADOR DE MILHAR, e isso não é capricho: o preço do Bitcoin passa dos
 * oitenta mil, e "US$ 83125,47" numa notificação de celular se lê errado na
 * primeira olhada. Os outros avisos do radar falam de centavos de taxa, onde o
 * separador nunca aparecia — aqui ele é obrigatório. */
const dinheiro = (v) => {
  const n = Number(v || 0);
  return "US$ " + n.toLocaleString("pt-BR", {
    minimumFractionDigits: Math.abs(n) < 0.01 ? 6 : 2,
    maximumFractionDigits: Math.abs(n) < 0.01 ? 6 : 2,
  });
};
const numero = (v, casas) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: casas });
/* Vírgula, como todo número da casa. toFixed devolve ponto. */
const pct = (v) => (v >= 0 ? "+" : "") + Number(v).toFixed(1).replace(".", ",") + "%";

/* O preço médio de compra, a partir dos lançamentos.
 *
 * Mesma conta de precoMedioDoToken no painel — e a duplicação é obrigada: o
 * painel roda no navegador e não consegue importar deste arquivo. O teste
 * arranca as duas e exige que deem o mesmo número, que é o que impede as
 * cópias de divergirem no primeiro conserto feito num lugar só.
 *
 * O dinheiro sai de valor_usd, congelado no dia do lançamento: converter pelo
 * câmbio de hoje reescreveria o que ele pagou em junho. */
export function precoMedio(movimentos) {
  let pagos = 0, recebidos = 0, comprados = 0, vendidos = 0, temAlgo = false;

  for (const m of movimentos || []) {
    if (!m || (m.tipo !== "aporte" && m.tipo !== "saque")) continue;
    const v = Number(m.valor_usd);
    const q = Number(m.qtd_a);
    if (!Number.isFinite(v) || v <= 0) continue;
    temAlgo = true;
    if (!Number.isFinite(q) || q <= 0) continue;
    if (m.tipo === "aporte") { pagos += v; comprados += q; }
    else { recebidos += v; vendidos += q; }
  }

  if (!temAlgo) return null;
  const qtd = comprados - vendidos;
  const custo = pagos - recebidos;
  if (!(qtd > 0) || !(custo > 0)) return null;
  return { medio: custo / qtd, qtd, custo };
}

/* De que lado do preço médio o token está. */
export function ladoDoPreco(precoHoje, medio) {
  if (!(precoHoje > 0) || !(medio > 0)) return null;
  return precoHoje >= medio ? "acima" : "abaixo";
}

/* O aviso de que chegou token novo.
 *
 * `jaVistos` é o conjunto de mints que o vigia já conhece. Na PRIMEIRA olhada
 * ele está vazio e a carteira inteira pareceria nova — por isso quem chama
 * anota tudo e cala, e este arquivo só decide o texto. */
export function avisoDeTokenNovo(achado) {
  if (!achado) return null;
  const { simbolo, quantidade, valor } = achado;
  return {
    tipo: "token-novo",
    texto: "🆕 Chegou " + (simbolo || "um token") + " na sua carteira: " +
      numero(quantidade, 8) + " " + (simbolo || "") +
      (valor != null ? " (" + dinheiro(valor) + ")" : "") +
      ".\n\nEle ainda não está em nenhuma caixinha do B.A.R.C.A. — " +
      "enquanto não estiver, fica fora das suas porcentagens.",
  };
}

/* Separa o que é novo do que já se conhecia, e joga fora a poeira. */
export function tokensNovos(daCarteira, mintsConhecidos, jaVistos, minimo = MINIMO_PRA_AVISAR) {
  const conhecidos = new Set(mintsConhecidos || []);
  const vistos = new Set(jaVistos || []);
  const fora = [];
  for (const t of daCarteira || []) {
    if (!t || !t.mint) continue;
    if (conhecidos.has(t.mint) || vistos.has(t.mint)) continue;
    if (!(Number(t.quantidade) > 0)) continue;
    /* Sem preço eu não sei se é poeira ou patrimônio. Calo: token que não tem
       cotação é quase sempre coisa que ninguém mandou, e avisar de todos
       encheria a caixa dele no primeiro dia. */
    if (!(Number(t.valor) >= minimo)) continue;
    fora.push(t);
  }
  return fora;
}

/* O aviso de que o token cruzou o preço médio de compra.
 *
 * Só fala na TRAVESSIA. Enquanto continuar do mesmo lado, cala — senão ele
 * receberia a mesma frase todo dia enquanto o Bitcoin ficasse abaixo. */
export function avisoDeCruzamento(nome, antes, agora, medio, precoHoje) {
  if (!antes || !agora || antes === agora) return null;
  if (!(medio > 0) || !(precoHoje > 0)) return null;

  const base = "Seu preço médio é " + dinheiro(medio) + " e o de agora é " +
    dinheiro(precoHoje) + " — " + pct((precoHoje / medio - 1) * 100) + ".";

  if (agora === "acima") {
    return {
      tipo: "cruzou-acima",
      texto: "📈 " + nome + " PASSOU do seu preço médio.\n\n" + base +
        "\n\nO que estava abaixo do que você pagou voltou pro positivo.",
    };
  }
  return {
    tipo: "cruzou-abaixo",
    texto: "📉 " + nome + " CAIU abaixo do seu preço médio.\n\n" + base +
      "\n\nA posição está valendo menos do que você pagou por ela.",
  };
}

/* Tudo junto para uma linha de token. Um aviso por linha por rodada. */
export function olharToken(nome, movimentos, precoHoje, ladoAnterior) {
  const pm = precoMedio(movimentos);
  if (!pm) return { aviso: null, lado: null, medio: null };
  const lado = ladoDoPreco(precoHoje, pm.medio);
  if (!lado) return { aviso: null, lado: null, medio: pm.medio };
  return {
    aviso: avisoDeCruzamento(nome, ladoAnterior, lado, pm.medio, precoHoje),
    lado,
    medio: pm.medio,
  };
}
