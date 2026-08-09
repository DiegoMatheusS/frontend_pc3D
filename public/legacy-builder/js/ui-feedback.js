const TEMPO_TOAST = 3600;

function obterRegiaoToast() {
  let regiao = document.getElementById("pcbuilder-toasts");
  if (regiao) return regiao;

  regiao = document.createElement("div");
  regiao.id = "pcbuilder-toasts";
  regiao.className = "pcbuilder-toasts";
  regiao.setAttribute("aria-live", "polite");
  regiao.setAttribute("aria-atomic", "true");
  document.body.appendChild(regiao);
  return regiao;
}

export function mostrarToast(mensagem, tipo = "info", duracao = TEMPO_TOAST) {
  const regiao = obterRegiaoToast();
  const toast = document.createElement("div");
  toast.className = "pcbuilder-toast";
  toast.dataset.tipo = tipo;
  toast.setAttribute("role", tipo === "erro" ? "alert" : "status");
  toast.innerHTML = `
    <span class="pcbuilder-toast-icone" aria-hidden="true"></span>
    <span class="pcbuilder-toast-texto"></span>
    <button type="button" class="pcbuilder-toast-fechar" aria-label="Fechar aviso">×</button>
  `;
  toast.querySelector(".pcbuilder-toast-texto").textContent = mensagem;

  const fechar = () => {
    toast.classList.add("saindo");
    window.setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector("button")?.addEventListener("click", fechar);
  regiao.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visivel"));

  if (duracao > 0) window.setTimeout(fechar, duracao);
  return toast;
}

export function definirEstadoContainer(container, estado, mensagem = "") {
  if (!container) return;
  container.dataset.estado = estado;

  if (!mensagem) return;

  const classe = estado === "erro"
    ? "pcbuilder-estado pcbuilder-estado-erro"
    : estado === "vazio"
      ? "pcbuilder-estado pcbuilder-estado-vazio"
      : "pcbuilder-estado pcbuilder-estado-carregando";

  container.innerHTML = `<p class="${classe}" role="status">${mensagem}</p>`;
}

export function definirBotaoCarregando(botao, carregando, texto = "Processando...") {
  if (!botao) return;

  if (carregando) {
    botao.dataset.textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    botao.textContent = texto;
    return;
  }

  botao.disabled = false;
  botao.removeAttribute("aria-busy");
  if (botao.dataset.textoOriginal) {
    botao.textContent = botao.dataset.textoOriginal;
    delete botao.dataset.textoOriginal;
  }
}

export async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  const copiou = document.execCommand("copy");
  campo.remove();
  if (!copiou) throw new Error("Falha ao copiar o texto.");
}

export function inicializarInterfaceGlobal() {
  const botaoTopo = document.createElement("button");
  botaoTopo.type = "button";
  botaoTopo.className = "btn-voltar-topo";
  botaoTopo.setAttribute("aria-label", "Voltar ao topo");
  botaoTopo.textContent = "↑";
  document.body.appendChild(botaoTopo);

  const atualizar = () => {
    botaoTopo.hidden = window.scrollY < 500;
  };

  botaoTopo.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("scroll", atualizar, { passive: true });
  atualizar();

  window.addEventListener("error", (evento) => {
    if (!evento.error) return;
    console.error("Erro global da interface:", evento.error);
  });

  window.addEventListener("unhandledrejection", (evento) => {
    console.error("Promessa rejeitada:", evento.reason);
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(new URL("../sw.js", import.meta.url), {
        scope: new URL("../", import.meta.url).pathname,
      }).catch((erro) => console.info("Service Worker não registrado:", erro));
    }, { once: true });
  }
}
