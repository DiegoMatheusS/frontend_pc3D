export function codificarBase64Url(valor) {
  const bytes = new TextEncoder().encode(JSON.stringify(valor));
  let binario = "";
  bytes.forEach((byte) => {
    binario += String.fromCharCode(byte);
  });

  return btoa(binario)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodificarBase64Url(codigo = "") {
  const base64 = String(codigo).replace(/-/g, "+").replace(/_/g, "/");
  const preenchimento = "=".repeat((4 - (base64.length % 4)) % 4);
  const binario = atob(base64 + preenchimento);
  const bytes = Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function decodificarBuildLegada(valor = "") {
  const parametros = new URLSearchParams(valor);
  const configuracao = {};

  parametros.forEach((id, chave) => {
    const slot = chave.match(/^([^[]+)\[(\d+)]$/);
    if (slot) {
      const categoria = slot[1];
      const indice = Number(slot[2]);
      if (!Array.isArray(configuracao[categoria])) configuracao[categoria] = [];
      configuracao[categoria][indice] = { id };
      return;
    }
    configuracao[chave] = { id };
  });

  return configuracao;
}

export function obterConfiguracaoCompartilhadaDaUrl(urlAtual = window.location.href) {
  const url = new URL(urlAtual, window.location.href);
  const codigo = url.searchParams.get("build");
  if (!codigo) return null;

  try {
    const payload = decodificarBase64Url(codigo);
    return payload?.configuracao ?? payload?.config ?? payload;
  } catch {
    try {
      return decodificarBuildLegada(codigo);
    } catch (erro) {
      console.error("Não foi possível abrir a build compartilhada.", erro);
      return null;
    }
  }
}

export function criarUrlCompartilhamento(configuracao, urlAtual = window.location.href) {
  const url = new URL(urlAtual, window.location.href);
  url.hash = "";
  url.search = "";
  url.searchParams.set("build", codificarBase64Url({ versao: 2, configuracao }));
  return url.toString();
}
