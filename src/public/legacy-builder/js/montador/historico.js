const CHAVE_HISTORICO = "pcBuilderHistoricoMontagem";
const LIMITE = 20;

export function registrarHistorico(configuracao, descricao = "Alteração na montagem") {
  try {
    const atual = JSON.parse(sessionStorage.getItem(CHAVE_HISTORICO) || "[]");
    const historico = Array.isArray(atual) ? atual : [];
    const serializado = JSON.stringify(configuracao);
    if (historico[0]?.configuracaoSerializada === serializado) return;

    historico.unshift({
      data: new Date().toISOString(),
      descricao,
      configuracao,
      configuracaoSerializada: serializado,
    });
    sessionStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico.slice(0, LIMITE)));
  } catch (erro) {
    console.info("Histórico temporário indisponível:", erro);
  }
}

export function desfazerHistorico() {
  try {
    const historico = JSON.parse(sessionStorage.getItem(CHAVE_HISTORICO) || "[]");
    if (!Array.isArray(historico) || historico.length < 2) return null;
    historico.shift();
    sessionStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
    return historico[0]?.configuracao ?? null;
  } catch {
    return null;
  }
}

export function limparHistorico() {
  sessionStorage.removeItem(CHAVE_HISTORICO);
}
