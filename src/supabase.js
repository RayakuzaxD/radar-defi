/* A conversa do Worker com o Supabase, usando a chave de serviço.
 *
 * O PAINEL fala com o Supabase como o Rayakuza: ele entra com e-mail e senha, e o
 * banco decide o que ele pode ver pelas regras de RLS. Isso continua igual.
 *
 * ESTE ARQUIVO é outra coisa: é o vigia de madrugada, quando não há ninguém
 * logado pra olhar as posições. Ele usa a chave de SERVIÇO, que passa por cima
 * das regras de RLS — é a única forma de um relógio às três da manhã ler a
 * carteira de alguém.
 *
 * TRÊS CUIDADOS, porque essa chave abre tudo:
 *
 * 1. Ela nunca aparece no código. Vive num segredo da Cloudflare, posto pelo
 *    teclado dele. Se `env.SUPABASE_SERVICE_KEY` não existir, o vigia não roda
 *    — e não roda em silêncio, escreve o motivo.
 *
 * 2. Ela nunca chega ao navegador. Nada daqui é chamado por rota de painel.
 *
 * 3. As leituras são estreitas de propósito: só as linhas que têm posição
 *    ligada, e só as colunas que o vigia precisa. Chave que abre tudo não é
 *    motivo pra ler tudo.
 */

/* A URL do SEU projeto Supabase vem do wrangler.jsonc (vars.SUPABASE_URL).
 * Não mora aqui de propósito: código é público, configuração é de cada um. */
function urlBase(env) {
  const u = String(env?.SUPABASE_URL || "").replace(/\/$/, "");
  if (!u || u.includes("SEU-PROJETO")) throw new Error("preencha SUPABASE_URL no wrangler.jsonc");
  return u;
}

function cabecalhos(chave) {
  return {
    apikey: chave,
    authorization: "Bearer " + chave,
    "content-type": "application/json",
  };
}

export function temChaveDeServico(env) {
  return typeof env?.SUPABASE_SERVICE_KEY === "string" && env.SUPABASE_SERVICE_KEY.length > 20;
}

async function pedir(env, caminho, opcoes = {}) {
  if (!temChaveDeServico(env)) throw new Error("sem a chave de serviço do Supabase");
  const r = await fetch(urlBase(env) + caminho, {
    ...opcoes,
    headers: { ...cabecalhos(env.SUPABASE_SERVICE_KEY), ...(opcoes.headers || {}) },
  });
  if (!r.ok) throw new Error("o Supabase respondeu " + r.status + ": " + (await r.text()).slice(0, 120));
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

/* As posições de todo mundo que tem alguma ligada.
 *
 * Hoje é só ele, mas a consulta já é por pessoa: quando houver outra conta, o
 * vigia não vai misturar as duas nem precisar ser reescrito. */
export async function posicoesLigadas(env) {
  return await pedir(env,
    "/rest/v1/alocacao?select=user_id,fatia,caixa,posicao,valor_entrada,data_entrada,cambio_entrada" +
    "&posicao=not.is.null&order=user_id");
}

/* O que o vigia viu da última vez, e o histórico de 24h pra contar travessias.
 *
 * Uma consulta só pras duas coisas: o mais recente é o primeiro da lista. */
export async function historicoDasPosicoes(env, desdeHoras = 26) {
  const desde = new Date(Date.now() - desdeHoras * 3600 * 1000).toISOString();
  return await pedir(env,
    "/rest/v1/posicao_historico?select=user_id,posicao,estado,quando" +
    "&quando=gte." + encodeURIComponent(desde) + "&order=quando.desc");
}

/* AS LINHAS DE TOKEN, com os lançamentos que dão o preço médio.
 *
 * Duas leituras estreitas, e estreitas de propósito: a chave de serviço abre
 * tudo, e chave que abre tudo não é motivo pra ler tudo. */
export async function tokensLancados(env) {
  return await pedir(env,
    "/rest/v1/alocacao?select=user_id,chave,fatia,token,mint,quantidade" +
    "&token=not.is.null&order=user_id");
}

export async function movimentosDeToken(env) {
  return await pedir(env,
    "/rest/v1/movimento?select=user_id,chave,tipo,valor_usd,qtd_a" +
    "&tipo=in.(aporte,saque)&qtd_a=not.is.null");
}

export async function carteirasSolana(env) {
  return await pedir(env, "/rest/v1/carteira_solana?select=user_id,endereco");
}

export async function tokensVistos(env) {
  return await pedir(env, "/rest/v1/token_visto?select=user_id,mint");
}

export async function anotarTokensVistos(env, linhas) {
  if (!linhas || !linhas.length) return 0;
  await pedir(env, "/rest/v1/token_visto", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(linhas),
  });
  return linhas.length;
}

export async function ladosDeToken(env) {
  return await pedir(env, "/rest/v1/token_lado?select=user_id,chave,lado");
}

export async function anotarLadosDeToken(env, linhas) {
  if (!linhas || !linhas.length) return 0;
  await pedir(env, "/rest/v1/token_lado", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(linhas),
  });
  return linhas.length;
}

/* O RETRATO DA CARTEIRA de uma pessoa, pra virar cópia de segurança.
 *
 * O conteudo e definido por uma funcao no banco (retrato_da_carteira), e nao
 * aqui: a copia vai por dois caminhos — o bot manda no Telegram, o painel grava
 * no Drive dele — e duas definicoes de "o que e um backup" divergem no primeiro
 * campo novo. A que divergir vai estar num arquivo que ele so abre no dia em
 * que precisar. */
export async function retratoDaCarteira(env, dono) {
  return await pedir(env, "/rest/v1/rpc/retrato_da_carteira", {
    method: "POST",
    body: JSON.stringify({ dono }),
  });
}

export async function donosComCarteira(env) {
  return await pedir(env, "/rest/v1/alocacao?select=user_id");
}

export async function copiasEnviadas(env, onde) {
  return await pedir(env,
    "/rest/v1/copia_enviada?select=user_id,digital,quando&onde=eq." + encodeURIComponent(onde));
}

export async function anotarCopiaEnviada(env, linhas) {
  if (!linhas || !linhas.length) return 0;
  await pedir(env, "/rest/v1/copia_enviada", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(linhas),
  });
  return linhas.length;
}

export async function anotarEstado(env, linhas) {
  if (!linhas || !linhas.length) return 0;
  await pedir(env, "/rest/v1/posicao_historico", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify(linhas),
  });
  return linhas.length;
}

export async function limparHistoricoVelho(env) {
  try {
    return await pedir(env, "/rest/v1/rpc/limpar_historico_velho", {
      method: "POST", body: "{}",
    });
  } catch {
    // Limpeza que falha não pode derrubar a rodada: é arrumação, não trabalho.
    return null;
  }
}
