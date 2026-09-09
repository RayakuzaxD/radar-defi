/* Prova que a página do painel é HTML e JavaScript válidos.
 *
 *   node testar-painel.js
 *
 * Existe por causa de um buraco real: o painel inteiro é uma string (template
 * literal), então o JavaScript que roda no navegador do Rayakuza NÃO é conferido
 * por `node --check`, nem por nenhum outro teste. Para o Node aquilo é texto.
 *
 * Em 06/09/2026 escrevi uma crase dentro de um comentário desse arquivo. A
 * crase fechou o template literal e quebrou a página inteira. Só apareceu
 * porque eu rodei `node --check` por hábito — se tivesse publicado, o painel
 * teria ido ao ar em branco, e o erro estaria numa string que nenhum teste lê.
 *
 * Este arquivo lê o HTML gerado, arranca o <script> e MANDA O MOTOR DO
 * JAVASCRIPT ANALISAR. Se não compilar, fica vermelho aqui e não na tela dele.
 */

import { readFileSync } from "node:fs";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

/* ---------------------------------------------------------------------------
 * A CRASE VEM ANTES DE TUDO, e a ORDEM é o ponto.
 *
 * Uma crase solta dentro do template quebra o arquivo inteiro. Se este teste
 * importasse painel.js no topo, o import falharia ANTES da conferência rodar, e
 * o que apareceria seria "SyntaxError: Unexpected identifier" apontando pra um
 * comentário — que não parece nem de longe um problema de aspas. Caí nisso três
 * vezes em dois dias, e a primeira versão desta conferência não servia pra nada
 * justamente por vir depois do import.
 *
 * Então: lê como TEXTO primeiro, acusa a crase pelo nome, e só depois importa.
 * ------------------------------------------------------------------------- */
titulo("Nenhuma crase solta dentro do template");

{
  const fonte = readFileSync("src/painel.js", "utf8");
  const inicio = fonte.indexOf("return `<!doctype html>");
  const fim = fonte.lastIndexOf("`;");
  const dentro = inicio >= 0 && fim > inicio ? fonte.slice(inicio + 23, fim) : "";
  const crases = (dentro.match(/`/g) || []).length;
  conferir("nenhuma crase dentro do template da página", crases === 0,
    crases + " crase(s) solta(s) — uma só fecha a string e derruba o arquivo");
  if (crases > 0) {
    // Sem esta saída, o import abaixo explode com uma mensagem que não ajuda.
    console.log(`\n${"-".repeat(60)}`);
    console.log("1 FALHARAM — conserte a crase antes de rodar o resto.");
    process.exit(1);
  }
}

const { paginaDoPainel } = await import("./src/painel.js");
const html = paginaDoPainel();
const SEPARADOR = String.fromCharCode(10);


// ---------------------------------------------------------------------------
titulo("A página se monta");

conferir("devolve texto", typeof html === "string" && html.length > 5000,
  `saiu ${typeof html} com ${html?.length} caracteres`);
conferir("é um documento HTML", html.trimStart().startsWith("<!doctype html>"));
conferir("fecha o documento", html.trimEnd().endsWith("</html>"));
conferir("não sobrou marcador de template", !html.includes("${"),
  "'${' na saída quer dizer que uma interpolação virou texto literal");

// ---------------------------------------------------------------------------
titulo("O JavaScript da página compila");

{
  const blocos = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  conferir("achou o script da página", blocos.length >= 1, `achou ${blocos.length}`);

  blocos.forEach((codigo, i) => {
    let erro = null;
    try {
      /* `new Function` compila sem executar: pega erro de sintaxe (crase solta,
       * parêntese aberto, vírgula a mais) sem tocar em DOM, rede ou banco. */
      new Function(codigo);
    } catch (e) {
      erro = e.message;
    }
    conferir(`o script ${i + 1} não tem erro de sintaxe`, erro === null, erro || "");
  });
}

// ---------------------------------------------------------------------------
titulo("Toda função chamada existe de verdade");

{
  /* O TESTE QUE FALTAVA, e o buraco que ele tapa custou duas reclamações.
   *
   * telaDeLogin() era chamada e não existia. Quem já tinha sessão guardada
   * nunca via: a aba Carteira só passa por ela quando NÃO há login. No celular
   * do Rayakuza havia; no computador não. Ele disse duas vezes que "no computador
   * a carteira não abre", e na primeira eu culpei o cache.
   *
   * `new Function` compila mas não executa, então nome que falta não aparece.
   * Aqui a conferência é outra: junta o que o script CHAMA com o que ele
   * DECLARA, e reclama do que sobra.
   *
   * Não é um analisador de JavaScript — é uma varredura de texto. Erra pra mais
   * (acha chamada onde não há) e por isso existe a lista de conhecidos abaixo:
   * o que o navegador dá de graça. Errar pra mais é o lado certo de errar num
   * teste: obriga a olhar. */
  const bruto = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

  /* Fora texto e comentário ANTES de varrer, e nesta ordem.
   *
   * Sem isso o teste acusava "espalhamento", "semeado" e "precisa" de serem
   * funções que faltam — palavras de comentário seguidas de parêntese. Teste
   * que acusa vinte coisas certas é teste que se aprende a ignorar, e aí ele
   * deixa de valer justamente no dia em que acha a errada.
   *
   * Texto primeiro porque "https://" tem duas barras: limpando comentário antes,
   * cada endereço comeria o resto da própria linha. */
  const script = bruto
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  const declaradas = new Set();
  for (const m of script.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) declaradas.add(m[1]);
  for (const m of script.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/g)) declaradas.add(m[1]);
  for (const m of script.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g)) declaradas.add(m[1]);
  for (const m of script.matchAll(/function\s*\(([^)]*)\)/g)) {
    for (const a of m[1].split(",")) { const n = a.trim(); if (n) declaradas.add(n); }
  }
  for (const m of script.matchAll(/\(([^)]{0,80}?)\)\s*=>/g)) {
    for (const a of m[1].split(",")) { const n = a.trim(); if (n) declaradas.add(n); }
  }
  for (const m of script.matchAll(/(?:catch|for)\s*\(\s*(?:var|let|const)?\s*([A-Za-z_$][\w$]*)/g)) declaradas.add(m[1]);

  /* O que o navegador traz pronto. Lista curta de propósito: quanto menor,
     mais o teste enxerga. */
  const DO_NAVEGADOR = new Set([
    "fetch", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "Number", "String", "Boolean", "Array", "Object", "Math", "JSON", "Date",
    "Map", "Set", "Promise", "RegExp", "Error", "BigInt", "isFinite", "isNaN",
    "parseInt", "parseFloat", "encodeURIComponent", "decodeURIComponent",
    "atob", "btoa", "alert", "confirm", "addEventListener", "requestAnimationFrame",
    "Request", "Response", "Headers", "URL", "URLSearchParams", "Intl", "TextEncoder",
    "Uint8Array", "Uint32Array",
    // Palavras do próprio JavaScript, que a varredura confunde com chamada.
    "if", "for", "while", "switch", "catch", "return", "typeof", "function",
    "in", "of", "async", "await", "new", "delete", "void", "do", "else",
  ]);

  const chamadas = new Set();
  for (const m of script.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) chamadas.add(m[1]);

  const faltando = [...chamadas].filter((n) => !declaradas.has(n) && !DO_NAVEGADOR.has(n));
  conferir("nenhuma função é chamada sem existir", faltando.length === 0,
    faltando.join(", ") + " — é assim que telaDeLogin sumiu e só quebrou pra quem não estava logado");
}

// ---------------------------------------------------------------------------
titulo("A tela de entrar existe e está inteira");

conferir("a tela de login está no código", html.includes('id="cEmail"') && html.includes('id="cSenha"'),
  "sem ela, a aba Carteira quebra em qualquer aparelho sem sessão guardada");
conferir("com os botões de entrar e criar conta",
  html.includes('id="btEntrar"') && html.includes('id="btCriar"'));
conferir("e o de esquecer a senha", html.includes('id="btEsqueci"'));

// ---------------------------------------------------------------------------
titulo("As tags abrem e fecham");

{
  /* Contagem simples, não um analisador de HTML. Pega o caso que interessa:
   * uma <div> a mais ou a menos desmonta o resto da página em silêncio. */
  const semScript = html.replace(/<script>[\s\S]*?<\/script>/g, "");
  for (const tag of ["div", "style", "head", "body", "html"]) {
    const abre = (semScript.match(new RegExp(`<${tag}[\\s>]`, "g")) || []).length;
    const fecha = (semScript.match(new RegExp(`</${tag}>`, "g")) || []).length;
    conferir(`<${tag}> abre e fecha o mesmo tanto`, abre === fecha,
      `abre ${abre}, fecha ${fecha}`);
  }
}

// ---------------------------------------------------------------------------
titulo("O que o Rayakuza precisa achar está na página");

conferir("a legenda explica o chão", /superou em 9 de cada 10 dias/.test(html),
  "'chão' é palavra nossa: não pode aparecer sem a explicação junto");
/* Sem distinguir maiúscula: a legenda escreve "incentivos" e o título da caixa
 * escreve "INCENTIVO". As duas formas valem — o que não pode voltar são as
 * palavras que eu tinha inventado. */
conferir("e usa as palavras do curso",
  /\btaxas\b/i.test(html) && /\bincentivos?\b/i.test(html));
{
  /* Só o que ele LÊ.
   *
   * Fora da conta ficam: o <style> (a classe `.et-alugada` tem que continuar
   * `alugada`, porque é o valor que o banco guarda) e os comentários do código
   * (que falam das palavras antigas justamente pra explicar a troca).
   *
   * Sem esse recorte o teste acusava as duas coisas certas como erro — e teste
   * que acusa acerto é teste que se aprende a ignorar. */
  const visivel = html
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  conferir("e as minhas invenções não voltaram pra tela",
    !/token emitido|uso real/i.test(visivel),
    "'emitido' e 'uso real' eram invenção minha tendo 'incentivos' e 'taxas' do curso à mão");

  /* `alugada` sozinha não é proibida: continua sendo a CHAVE do mapa e a classe
   * de CSS, porque é o valor que o banco guarda. O que não pode é ela chegar
   * ao Rayakuza como rótulo. Então a conferência é sobre o rótulo, não a chave. */
  conferir("a classe 'alugada' chega à tela como 'incentivada'",
    /alugada:\s*"[^"]*incentivada/.test(html),
    "a chave é do banco, o rótulo é dele");
  conferir("e as caixas dizem de onde vem o dinheiro",
    /vivem de TAXAS/.test(html) && /vivem de INCENTIVO/.test(html));
}
conferir("cita a fonte da ideia de cartaz",
  html.includes("fotografia do momento"),
  "a frase é do material dele, e dizer de onde vem é o que a torna verificável");
conferir("o link pra achar a pool existe",
  html.includes("defillama.com/yields/pool/"),
  "sem ele o cartão diz onde a pool está mas não leva até lá");
conferir("o link abre em outra aba sem dar poder à página de destino",
  html.includes('rel="noopener"'));
conferir("a faixa do ciclo está montada", html.includes('id="ciclo"'));
conferir("o app continua instalável",
  html.includes('rel="manifest"') && html.includes("beforeinstallprompt"));

// ---------------------------------------------------------------------------
titulo("A abertura: quatro caminhos, e nenhum tranca a porta");

{
  /* A barrinha de abertura confere se saiu versão nova antes de mostrar o
   * mercado. A decisão mora numa função sozinha justamente pra caber aqui — o
   * resto é fetch, caches e reload, que só existem no navegador.
   *
   * A conferência que mais importa é a última: em nenhum caminho o app deixa
   * de abrir. Radar que se recusa a abrir por não conseguir conferir a versão
   * é pior que radar velho. */
  const fonte = readFileSync("src/painel.js", "utf8");
  const i = fonte.indexOf("function decidirAbertura(");
  let nivel = 0, j = fonte.indexOf("{", i), fim = -1;
  for (; j < fonte.length; j++) {
    if (fonte[j] === "{") nivel++;
    else if (fonte[j] === "}") { nivel--; if (nivel === 0) { fim = j + 1; break; } }
  }
  const decidir = new Function(fonte.slice(i, fim) + "; return decidirAbertura;")();

  const emDia = decidir("v18-x", { versao: "v18-x" }, null);
  conferir("mesma versão: abre e diz que está em dia", emDia.abre && emDia.passo === "em-dia");

  const nova = decidir("v18-x", { versao: "v19-y" }, null);
  conferir("versão nova: NÃO abre, vai atualizar", !nova.abre && nova.passo === "atualizar");
  conferir("e diz qual é a nova", nova.nova === "v19-y" && nova.recado.includes("v19-y"));

  conferir("sem resposta: abre assim mesmo", decidir("v18-x", null, null).abre);
  conferir("resposta estranha também abre", decidir("v18-x", { oi: 1 }, null).abre);

  /* O freio. Sem ele: recarrega, volta no mesmo número, recarrega — e o app
   * nunca abre. Um número errado no servidor trancaria o radar pra sempre. */
  const laco = decidir("v18-x", { versao: "v19-y" }, "v19-y");
  conferir("já tentei essa versão e voltei igual: ABRE, não tenta de novo",
    laco.abre && laco.passo === "laco");
  conferir("e avisa que isso não deveria acontecer",
    laco.recado.includes("não deveria acontecer"));
  conferir("ter tentado OUTRA versão não segura a atualização",
    !decidir("v18-x", { versao: "v20-z" }, "v19-y").abre);

  const caminhos = [
    decidir("v1", { versao: "v1" }, null),
    decidir("v1", null, null),
    decidir("v1", { versao: "v2" }, "v2"),
    decidir("v1", undefined, "qualquer"),
  ];
  conferir("todo caminho que não é atualização ABRE o app",
    caminhos.every((c) => c.abre),
    "nenhum estado pode deixar o Rayakuza olhando a tela de abertura pra sempre");
  conferir("e todo caminho tem recado escrito",
    caminhos.every((c) => typeof c.recado === "string" && c.recado.length > 10));
}

// ---------------------------------------------------------------------------
titulo("A versão aparece na tela");

conferir("a marca discreta está no rodapé", /class="versaoCanto"/.test(html));
conferir("e a tela de abertura mostra a versão", /class="abVersao"/.test(html));
conferir("o alien está desenhado", /class="abAlien"/.test(html) && html.includes("<svg"));
conferir("a barrinha existe", /id="abTrilho"/.test(html));
{
  const marcas = [...new Set(html.match(/v\d+-[a-z-]+/g) || [])];
  conferir("as duas marcas dizem a MESMA versão", marcas.length === 1,
    "achei: " + marcas.join(", ") + " — duas versões na mesma tela é pior que nenhuma");
}

// ---------------------------------------------------------------------------
titulo("Ícone: todo endereço carrega a versão");

{
  /* A DOR DE CABEÇA DE 09/09/2026, virada em conferência.
   *
   * Ele trocou o alien e continuou vendo o antigo por horas. Eu tinha prova de
   * que o servidor entregava a imagem certa, e mesmo assim na tela aparecia a
   * velha: o ícone ia com "guarde por 7 dias" num endereço que nunca mudava,
   * então o navegador nem perguntava se havia outro.
   *
   * Ele: "precisa ser padrão isso para não ter essa dor de cabeça — instalar já
   * vem com o ícone atualizado, seja esse ou outro se eu atualizar de novo".
   *
   * Então: nenhum endereço de ícone pode aparecer na página sem a versão. */
  const { VERSAO } = await import("./src/versao.js");

  const enderecos = [...html.matchAll(/href="(\/icone-[^"]*)"/g)].map((m) => m[1])
    .concat([...html.matchAll(/src="(\/icone-[^"]*)"/g)].map((m) => m[1]));

  conferir("a página aponta para algum ícone", enderecos.length > 0);
  const semVersao = enderecos.filter((e) => !e.includes("v=" + VERSAO));
  conferir("todo endereço de ícone carrega a versão de agora", semVersao.length === 0,
    semVersao.join(", ") + " — sem isso o navegador serve o desenho velho por uma semana");

  /* Os tamanhos que cada lugar pede: 32 pra aba, 64/128 pro atalho do Windows,
   * 192 e 512 pra tela inicial. Faltando um, o navegador reduz na marra e o
   * desenho embola. */
  for (const t of ["32", "64", "128", "192", "512"]) {
    conferir("declara o ícone de " + t, html.includes('sizes="' + t + "x" + t + '"'),
      "sem sizes o navegador pega o primeiro que achar");
  }
}

// ---------------------------------------------------------------------------
titulo("Tema: nada fica sem cor definida");

conferir("o corpo tem fundo próprio", /body\s*\{[^}]*background:\s*var\(--fundo\)/.test(html),
  "sem fundo explícito a página empresta o tema de quem a abre");
conferir("há paleta clara e escura",
  html.includes("prefers-color-scheme: dark") && html.includes(":root {"));

// ---------------------------------------------------------------------------
titulo("Abrir e fechar a caixinha: um toque, uma mudança");

{
  /* O DEFEITO QUE ISTO PEGA, e custou duas respostas erradas minhas.
   *
   * A caixinha nasce FECHADA: encolhida() devolve true quando não há nada
   * guardado. Mas virarEncolhida fazia !encolhidas[chave] — e !undefined é
   * true, o MESMO estado. O primeiro toque não fazia nada; só o segundo abria.
   *
   * Somado ao "Pronto", que devolvia a caixinha ao estado guardado (fechada),
   * ele não conseguia chegar na tela de vista: editava, dava Pronto, a
   * caixinha fechava, e os rendimentos "sumiam". Ele reportou duas vezes —
   * "não mostra mais rendimentos igual antes", "os rendimentos sumiram range
   * de pool etc" — e as duas vezes eu disse que era o modo editar.
   *
   * Valor guardado e estado que aparece não são a mesma coisa quando existe um
   * padrão. Quem vira tem que virar o que se VÊ. */
  /* Arranca uma função pelo nome, contando chaves — o mesmo de testar-mexer.js.
     Nenhuma destas tem chave dentro de string, então contar basta. */
  const pegarFuncao = (fonte, nome) => {
    const i = fonte.indexOf(`function ${nome}(`);
    if (i < 0) throw new Error(`não achei a função ${nome} em src/painel.js`);
    let nivel = 0, j = fonte.indexOf("{", i);
    for (; j < fonte.length; j++) {
      if (fonte[j] === "{") nivel++;
      else if (fonte[j] === "}") { nivel--; if (nivel === 0) return fonte.slice(i, j + 1); }
    }
    throw new Error(`a função ${nome} não fecha`);
  };

  const fonte = readFileSync("src/painel.js", "utf8");
  const montar = new Function(`
    var encolhidas = {};
    var localStorage = { setItem: function () {}, getItem: function () { return null; } };
    ${["encolhida", "virarEncolhida", "abrirCaixa"].map((n) => pegarFuncao(fonte, n)).join("\n")}
    return { encolhida: encolhida, virar: virarEncolhida, abrir: abrirCaixa,
             ver: function () { return encolhidas; } };
  `);
  const c = montar();

  conferir("a caixinha nasce fechada", c.encolhida("renda") === true,
    "foi o pedido dele: fica muito poluído se tudo ficar exposto");

  c.virar("renda");
  conferir("UM toque abre", c.encolhida("renda") === false,
    "aqui estava o defeito: !undefined é true, o mesmo estado de antes");

  c.virar("renda");
  conferir("outro toque fecha", c.encolhida("renda") === true);
  c.virar("renda");
  conferir("e abre de novo", c.encolhida("renda") === false);

  /* Sair da edição não pode fechar em cima do trabalho recém-feito. */
  const d = montar();
  conferir("abrirCaixa abre uma caixinha nunca tocada",
    (d.abrir("renda"), d.encolhida("renda") === false),
    "é o que o Pronto faz — senão ele edita, dá Pronto, e a caixinha some");
  d.abrir("renda");
  conferir("e abrir uma já aberta a mantém aberta", d.encolhida("renda") === false);
}

/* ---------------------------------------------------------------------------
 * NENHUM BOTÃO É AGARRADO SEM CONFERIR SE ELE ESTÁ NA TELA
 *
 * Custou a tela inteira em 08/09/2026. A sub-aba "resumo" tirou o botão Salvar
 * do desenho, e ligarCarteira fazia:
 *
 *     document.getElementById("btSalvar").onclick = ...
 *
 * Sem o botão, isso estoura ali mesmo — e leva junto TODO o resto de
 * ligarCarteira, que roda depois. Um botão ausente matando a aba inteira.
 *
 * A tela do painel é montada por pedaços que aparecem e somem conforme o
 * estado. Então NENHUM elemento é garantido, com uma exceção: os da tela de
 * login, ligados dentro do ramo que acabou de desenhá-la e volta em seguida.
 * ------------------------------------------------------------------------- */
titulo("Nenhum botão é agarrado sem conferir se está na tela");
{
  /* As duas exceções legítimas, e elas são diferentes uma da outra.
   *
   * DO ESQUELETO: escritos à mão no HTML da página, fora de qualquer condição.
   * Não somem porque não há estado que os apague.
   *
   * DA TELA DE LOGIN: ligados dentro do ramo que acabou de desenhá-la e volta
   * em seguida. Existem por construção, naquele ponto do código.
   *
   * Tudo o mais é desenhado por pedaço que aparece e some — e aí a guarda não é
   * capricho: é a diferença entre um botão faltando e a aba inteira morrendo. */
  const DO_ESQUELETO = new Set(["sub", "instalar", "alertas", "conteudo"]);
  const DA_TELA_DE_LOGIN = new Set(["btCriar", "cSenha", "cEmail", "btEsqueci", "btEntrar"]);

  const todoOScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).join(SEPARADOR);

  const soltos = [];
  for (const m of todoOScript.matchAll(/document\.getElementById\(\s*"([^"]+)"\s*\)\s*\./g)) {
    if (!DA_TELA_DE_LOGIN.has(m[1]) && !DO_ESQUELETO.has(m[1])) soltos.push(m[1]);
  }
  conferir("todo getElementById passa por uma guarda antes de ser usado",
    soltos.length === 0,
    soltos.join(", ") + " — some da tela em algum estado e derruba o resto junto");
}

console.log(SEPARADOR + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
