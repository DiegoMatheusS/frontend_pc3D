export const CHAVE_RASCUNHO_BUILD = "pcBuilderRascunhoBuild";
export const CHAVE_SESSAO_CONTA = "pcBuilderSessao";
export const PREFIXO_BUILDS_SALVAS = "pcBuilderBuildsSalvas:";

export function obterSessaoConta() {
  try {
    const sessao = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO_CONTA) || "null");
    const expiracao = Date.parse(sessao?.expiraEm || "");
    const valida = Boolean(sessao?.id && sessao?.email)
      && Number.isFinite(expiracao)
      && expiracao > Date.now();

    if (!valida) {
      sessionStorage.removeItem(CHAVE_SESSAO_CONTA);
      localStorage.removeItem(CHAVE_SESSAO_CONTA);
      return null;
    }
    return sessao;
  } catch {
    sessionStorage.removeItem(CHAVE_SESSAO_CONTA);
    localStorage.removeItem(CHAVE_SESSAO_CONTA);
    return null;
  }
}

export function obterRascunhoBuild() {
  try {
    const rascunho = JSON.parse(localStorage.getItem(CHAVE_RASCUNHO_BUILD) || "null");
    return rascunho?.configuracao ?? null;
  } catch {
    return null;
  }
}

export function gravarRascunhoBuild(configuracao) {
  localStorage.setItem(
    CHAVE_RASCUNHO_BUILD,
    JSON.stringify({
      versao: 1,
      atualizadaEm: new Date().toISOString(),
      configuracao,
    }),
  );
}

export function removerRascunhoBuild() {
  localStorage.removeItem(CHAVE_RASCUNHO_BUILD);
}

export function obterChaveBuildsSalvas(email = "") {
  return `${PREFIXO_BUILDS_SALVAS}${encodeURIComponent(String(email).trim().toLowerCase())}`;
}
