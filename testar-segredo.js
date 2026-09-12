/* Prova que nenhum segredo do Worker sai numa resposta.
 *
 *   node testar-segredo.js
 *
 * ---------------------------------------------------------------------------
 * POR QUE EXISTE
 *
 * Em 12/09/2026 uma revisão adversarial achou isto na rota /saude/transacao,
 * escrita naquele mesmo dia:
 *
 *   caminho.push({ no: i + 1, disse: "erro: " + String(e?.message).slice(0, 60) })
 *
 * Duas fontes de texto passam por ali e NENHUMA das duas é minha:
 *
 *   1. o runtime lança "Fetch API cannot load: <URL INTEIRA>" quando a URL não
 *      parseia — e a URL do nó principal carrega a chave da API dentro;
 *   2. a mensagem de erro do próprio nó é texto escrito por ele, refletido
 *      sem nenhum filtro.
 *
 * O corte em 60 caracteres parava TRÊS caracteres antes do valor da chave, no
 * host do provedor atual. A chave sobrevivia por aritmética de sorte: bastava
 * um provedor de host mais curto, ou o runtime mudar a frase, pra ela ir parar
 * numa resposta pública.
 *
 * A rota tinha, no próprio comentário, a regra "NUNCA a URL do nó na
 * resposta". Regra escrita não é regra cumprida — a que mais escapa é a que
 * só dói depois. Esta é a versão que cumpre.
 *
 * ---------------------------------------------------------------------------
 * O QUE SE PROVA
 *
 * Por leitura do código-fonte, não por chamada: nenhuma rota interpola texto
 * de exceção ou de resposta alheia direto numa saída. É varredura de texto,
 * então erra PRA MAIS — e errar pra mais é o lado certo de errar aqui, porque
 * obriga a olhar.
 */

import { readFileSync } from "node:fs";
import { motivoSemSegredo } from "./src/segredo.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log("  ok   " + oQue); }
  else { falhou++; console.log("  FALHOU  " + oQue + (det ? " — " + det : "")); }
}
const titulo = (t) => console.log("\n" + t);
const NL = String.fromCharCode(10);

const fonte = readFileSync("src/index.js", "utf8");

/* Sem comentários: o que está neles não roda, e narrar o erro não pode acusar
   o erro. Preserva as quebras pra o número da linha não mentir. */
const soEspaco = (m) => m.split(NL).map((l) => " ".repeat(l.length)).join(NL);
const limpo = fonte
  .replace(/\/\*[\s\S]*?\*\//g, soEspaco)
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
const linhas = limpo.split(NL);

conferir("o limpador preserva as linhas (senão o número mente)",
  linhas.length === fonte.split(NL).length);

// ---------------------------------------------------------------------------
titulo("Nenhuma resposta carrega texto de exceção");

{
  /* O PADRÃO PERIGOSO: String(e.message) — ou e?.message direto — indo parar
     numa string que é montada pra sair. A pista de que sai é estar numa linha
     que também constrói texto de resposta: concatenação com literal, ou um
     campo de objeto que vira Response.json. */
  const suspeitas = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!/\be\??\.(message)\b|String\(\s*e\b/.test(l)) continue;

    /* Guardar o erro numa variável pra classificar depois é o jeito CERTO, e
       ele não pode ser acusado. O que se acusa é o erro virando saída na
       mesma linha. */
    const viraSaida = /["'`].*\+|\+\s*["'`]|:\s*String\(\s*e|erro\s*:|disse\s*:|resposta\s*=/.test(l);
    const soGuarda = /^\s*(const|let|var)\s+\w+\s*=\s*String\(\s*e/.test(l);
    if (viraSaida && !soGuarda) suspeitas.push((i + 1) + ": " + l.trim().slice(0, 90));
  }

  /* A LISTA DE CONHECIDOS: rotas de diagnóstico que repassam erro de fonte
     PÚBLICA, onde não há segredo nenhum no caminho. Cada uma entra aqui com
     nome e motivo — e entrar aqui é uma decisão, não um descuido. */
  const PERDOADAS = [
    "fontePrincipal",    // /saude/vdd: erro da bitcoin-data.com, sem credencial
    "fluxoDosEtfs",      // /saude/etf: erro da página do Farside, pública
    "tesourariasDeBitcoin", // /saude/tesouraria: CoinGecko público
  ];
  const sobraram = suspeitas.filter((s) => !PERDOADAS.some((p) => s.includes(p)));

  conferir("nenhuma exceção nova é copiada direto para uma resposta",
    sobraram.length === 0,
    sobraram.join(" | "));
}

// ---------------------------------------------------------------------------
titulo("A rota da lupa não deixa a chave do nó escapar");

{
  const i = fonte.indexOf('url.pathname === "/saude/transacao"');
  conferir("a rota existe", i > 0);

  if (i > 0) {
    /* O corpo da rota: até o próximo `if (url.pathname`, que é a rota
       seguinte. Basta e não depende de contar chaves em código com strings. */
    const depois = fonte.slice(i);
    const fim = depois.indexOf("if (url.pathname", 40);
    const corpo = fim > 0 ? depois.slice(0, fim) : depois;

    conferir("ela exige o GATILHO antes de falar com o nó",
      /env\.GATILHO/.test(corpo),
      "aberta, ela é um proxy grátis contra o nó pago — e drenar a cota do nó " +
      "empurra as leituras dele de volta aos nós podados");

    conferir("o GATILHO é conferido ANTES da chamada ao nó",
      corpo.indexOf("env.GATILHO") < corpo.indexOf("pedir("),
      "conferir depois é pagar a chamada e só então recusar");

    /* O que se proíbe é o nó ir PARA a resposta, não o nó ser usado: passar
       nos[i] ao pedir() é o trabalho da rota. Olha só o que entra no caminho
       e no Response.json. */
    const saidas = (corpo.match(/caminho\.push\([^)]*\)|Response\.json\([^;]*\)/g) || []).join(" ");
    conferir("nenhuma variável de nó vai para a resposta",
      !/nos\[|SOLANA_RPC|env\.GATILHO/.test(saidas),
      "a URL do nó carrega a chave dentro dela — achei: " + saidas.slice(0, 120));

    conferir("o erro sai classificado, não copiado",
      /classe/.test(corpo) && !/disse:\s*"erro: "\s*\+\s*String\(/.test(corpo),
      "texto de exceção pode conter a URL inteira, e a URL tem a chave");

    /* A PROVA DE QUE A REDE PEGA O PEIXE: a forma antiga, plantada, tem que
       ser acusada. Guarda nunca testada contra o caso ruim é fé. */
    const comOErro = corpo.replace("const cru =",
      'caminho.push({ no: 1, disse: "erro: " + String(e?.message).slice(0, 60) });' + NL + "const cru =");
    conferir("e a conferência pega a forma antiga, plantada de propósito",
      /disse:\s*"erro: "\s*\+\s*String\(/.test(comOErro));
  }
}

// ---------------------------------------------------------------------------
titulo("Os nomes dos segredos não aparecem em nenhuma saída");

{
  /* Nunca o VALOR — ele não está no código. O que se confere é o nome não
     viajar dentro de um JSON de resposta, porque nome de segredo numa
     resposta costuma vir acompanhado do valor. */
  const SEGREDOS = ["SOLANA_RPC", "SUPABASE_SERVICE_KEY", "TELEGRAM_TOKEN", "GATILHO",
                    "COINGECKO_KEY", "FRED_KEY"];
  const dentroDeResposta = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!/Response\.json|JSON\.stringify/.test(l)) continue;
    for (const s of SEGREDOS) {
      if (l.includes("env." + s)) dentroDeResposta.push(s + " na linha " + (i + 1));
    }
  }
  conferir("nenhum segredo é lido dentro de uma linha que monta resposta",
    dentroDeResposta.length === 0, dentroDeResposta.join(", "));

  /* E o teste do teste: um segredo plantado numa linha de resposta é pego. */
  const plantada = 'return Response.json({ x: env.SOLANA_RPC });';
  conferir("e a conferência pega um segredo plantado numa resposta",
    /Response\.json/.test(plantada) && plantada.includes("env.SOLANA_RPC"));
}

// ---------------------------------------------------------------------------
/* A REDAÇÃO FUNCIONANDO, e não só existindo.
 *
 * As conferências de cima leem o código; estas EXECUTAM. A diferença importa:
 * uma função de limpar segredo que é chamada em toda parte e limpa errado é
 * pior que nenhuma, porque dá confiança. */
titulo("O motivo do erro sai sem o segredo dentro");

{
  /* A FRASE EXATA que o runtime lança quando a URL não parseia — é ela que
     quase levou a chave embora. A URL aqui é inventada. */
  const doRuntime = new TypeError(
    "Fetch API cannot load: https://exemplo-de-no.invalido/?api-key=CHAVE_SECRETA_DE_MENTIRA");
  const limpo = motivoSemSegredo(doRuntime);
  conferir("a URL some da mensagem do runtime", !limpo.includes("exemplo-de-no"), limpo);
  conferir("e o valor da chave some junto",
    !limpo.includes("CHAVE_SECRETA_DE_MENTIRA"), limpo);
  conferir("mas o motivo continua legível",
    /cannot load|Fetch API/i.test(limpo), limpo);
}

{
  /* O segundo caminho: a chave numa querystring solta, sem http na frente. */
  const solto = new Error("recusado em /v1/rpc?api-key=OUTRA_CHAVE_DE_MENTIRA&x=1");
  const limpo = motivoSemSegredo(solto);
  conferir("chave em querystring sem http também é ocultada",
    !limpo.includes("OUTRA_CHAVE_DE_MENTIRA"), limpo);
}

{
  /* TEXTO ESCRITO PELO OUTRO LADO: o nó pode devolver o que quiser na
     mensagem de erro, inclusive ecoar a URL que recebeu. */
  const doNo = new Error("upstream error for https://no-qualquer.invalido/?token=SEGREDO_ECOADO");
  conferir("erro escrito pelo próprio nó também é limpo",
    !motivoSemSegredo(doNo).includes("SEGREDO_ECOADO"), motivoSemSegredo(doNo));
}

{
  /* Erro comum, sem endereço nenhum: tem que passar inteiro. Uma redação que
     apaga o que não precisa apagar cega o diagnóstico. */
  conferir("erro sem endereço passa inteiro",
    motivoSemSegredo(new Error("o nó respondeu 429")) === "o nó respondeu 429");
  conferir("e o corte pedido é respeitado",
    motivoSemSegredo(new Error("x".repeat(400)), 50).length === 50);
  conferir("texto solto, não-Erro, não quebra",
    motivoSemSegredo("só um texto") === "só um texto");
  conferir("nulo vira vazio, não a palavra null",
    motivoSemSegredo(null) === "");
}

console.log(NL + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
