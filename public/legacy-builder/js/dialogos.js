const DIALOG_STYLE_ID = "pcbuilder-dialogo-estilos-runtime";

function garantirEstilosDialogo() {
  if (document.getElementById(DIALOG_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = DIALOG_STYLE_ID;
  style.textContent = `
    dialog.pcbuilder-dialogo {
      width: min(92vw, 460px) !important;
      max-width: 460px !important;
      margin: auto !important;
      padding: 0 !important;
      color: #172033 !important;
      background: transparent !important;
      border: 0 !important;
      border-radius: 18px !important;
      overflow: visible !important;
    }
    dialog.pcbuilder-dialogo::backdrop { background: rgba(15,23,42,.58) !important; backdrop-filter: blur(3px); }
    .pcbuilder-dialogo-conteudo {
      display: grid !important;
      gap: 14px !important;
      margin: 0 !important;
      padding: 24px !important;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
      color: #172033 !important;
      background: #fff !important;
      border: 1px solid #dbe4f0 !important;
      border-radius: 18px !important;
      box-shadow: 0 24px 70px rgba(15,23,42,.22), 0 6px 20px rgba(15,23,42,.10) !important;
    }
    .pcbuilder-dialogo-etiqueta {
      justify-self: start; display:inline-flex; align-items:center; min-height:26px; padding:4px 9px;
      color:#1d4ed8 !important; background:#eff6ff !important; border:1px solid #dbeafe !important;
      border-radius:999px; font-size:.72rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase;
    }
    .pcbuilder-dialogo h2 { margin:0 !important; color:#172033 !important; font-size:1.34rem !important; line-height:1.2; }
    .pcbuilder-dialogo-mensagem { margin:0 !important; color:#64748b !important; font-size:.95rem; line-height:1.55; }
    .pcbuilder-dialogo-campo { display:grid; gap:7px; color:#475569 !important; font-size:.82rem; font-weight:700; }
    .pcbuilder-dialogo-campo[hidden] { display:none !important; }
    .pcbuilder-dialogo-campo input {
      width:100%; min-height:43px; box-sizing:border-box; padding:10px 12px; color:#172033 !important;
      background:#fff !important; border:1px solid #cbd5e1 !important; border-radius:10px !important; outline:none; font:inherit;
    }
    .pcbuilder-dialogo-campo input:focus { border-color:#2563eb !important; box-shadow:0 0 0 3px rgba(37,99,235,.14); }
    .pcbuilder-dialogo-acoes { display:flex !important; justify-content:flex-end; gap:9px; padding-top:4px; }
    .pcbuilder-dialogo-acoes button {
      min-height:41px; padding:9px 15px; border:1px solid #d6deea !important; border-radius:10px !important;
      font:inherit; font-size:.86rem; font-weight:800; cursor:pointer;
    }
    .pcbuilder-dialogo-acoes [data-cancelar] { color:#334155 !important; background:#fff !important; }
    .pcbuilder-dialogo-acoes [data-confirmar] { color:#fff !important; background:#2563eb !important; border-color:#2563eb !important; box-shadow:0 8px 18px rgba(37,99,235,.20); }
    .pcbuilder-dialogo-acoes [data-confirmar]:hover { background:#1d4ed8 !important; }
    :root[data-theme='dark'] .pcbuilder-dialogo-conteudo, :root[data-tema='escuro'] .pcbuilder-dialogo-conteudo {
      color:#f1f5f9 !important; background:#111827 !important; border-color:#2a3950 !important; box-shadow:0 28px 80px rgba(0,0,0,.46) !important;
    }
    :root[data-theme='dark'] .pcbuilder-dialogo h2, :root[data-tema='escuro'] .pcbuilder-dialogo h2 { color:#f1f5f9 !important; }
    :root[data-theme='dark'] .pcbuilder-dialogo-mensagem, :root[data-tema='escuro'] .pcbuilder-dialogo-mensagem { color:#a7b3c6 !important; }
    :root[data-theme='dark'] .pcbuilder-dialogo-acoes [data-cancelar], :root[data-tema='escuro'] .pcbuilder-dialogo-acoes [data-cancelar] { color:#dbe5f2 !important; background:#182235 !important; border-color:#334155 !important; }
    :root[data-theme='dark'] .pcbuilder-dialogo-campo input, :root[data-tema='escuro'] .pcbuilder-dialogo-campo input { color:#f1f5f9 !important; background:#182235 !important; border-color:#334155 !important; }
    @media (max-width:520px) { .pcbuilder-dialogo-conteudo { padding:20px !important; } .pcbuilder-dialogo-acoes { display:grid !important; grid-template-columns:1fr 1fr; } .pcbuilder-dialogo-acoes button { width:100%; } }
  `;
  document.head.appendChild(style);
}

function criarDialogoBase() {
  garantirEstilosDialogo();
  const dialogo = document.createElement("dialog");
  dialogo.className = "pcbuilder-dialogo";
  dialogo.innerHTML = `
    <form method="dialog" class="pcbuilder-dialogo-conteudo">
      <span class="pcbuilder-dialogo-etiqueta">CriaByte</span>
      <h2></h2>
      <p class="pcbuilder-dialogo-mensagem"></p>
      <label class="pcbuilder-dialogo-campo" hidden>
        <span></span>
        <input type="text" maxlength="80" autocomplete="off">
      </label>
      <div class="pcbuilder-dialogo-acoes">
        <button type="button" data-cancelar>Cancelar</button>
        <button type="submit" data-confirmar>Confirmar</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialogo);
  return dialogo;
}

export function confirmar(mensagem, opcoes = {}) {
  return new Promise((resolve) => {
    const dialogo = criarDialogoBase();
    dialogo.querySelector("h2").textContent = opcoes.titulo ?? "Confirmar ação";
    dialogo.querySelector(".pcbuilder-dialogo-mensagem").textContent = mensagem;
    const confirmarBotao = dialogo.querySelector("[data-confirmar]");
    const cancelarBotao = dialogo.querySelector("[data-cancelar]");
    confirmarBotao.textContent = opcoes.textoConfirmar ?? "Confirmar";
    cancelarBotao.textContent = opcoes.textoCancelar ?? "Cancelar";

    const finalizar = (valor) => {
      if (dialogo.open) dialogo.close();
      dialogo.remove();
      resolve(valor);
    };

    confirmarBotao.addEventListener("click", (evento) => {
      evento.preventDefault();
      finalizar(true);
    });
    cancelarBotao.addEventListener("click", () => finalizar(false));
    dialogo.addEventListener("cancel", (evento) => {
      evento.preventDefault();
      finalizar(false);
    });
    dialogo.addEventListener("click", (evento) => {
      if (evento.target === dialogo) finalizar(false);
    });

    dialogo.showModal();
    confirmarBotao.focus();
  });
}

export function solicitarTexto(opcoes = {}) {
  return new Promise((resolve) => {
    const dialogo = criarDialogoBase();
    dialogo.querySelector("h2").textContent = opcoes.titulo ?? "Digite um nome";
    dialogo.querySelector(".pcbuilder-dialogo-mensagem").textContent = opcoes.mensagem ?? "";
    const campo = dialogo.querySelector(".pcbuilder-dialogo-campo");
    const rotulo = campo.querySelector("span");
    const input = campo.querySelector("input");
    const confirmarBotao = dialogo.querySelector("[data-confirmar]");
    const cancelarBotao = dialogo.querySelector("[data-cancelar]");

    campo.hidden = false;
    rotulo.textContent = opcoes.rotulo ?? "Nome";
    input.value = opcoes.valorInicial ?? "";
    input.placeholder = opcoes.placeholder ?? "";
    input.maxLength = Number(opcoes.maxLength) || 80;
    confirmarBotao.textContent = opcoes.textoConfirmar ?? "Salvar";
    cancelarBotao.textContent = opcoes.textoCancelar ?? "Cancelar";

    const finalizar = (valor) => {
      if (dialogo.open) dialogo.close();
      dialogo.remove();
      resolve(valor);
    };

    confirmarBotao.addEventListener("click", (evento) => {
      evento.preventDefault();
      const valor = input.value.trim();
      if (!valor) {
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      finalizar(valor);
    });
    cancelarBotao.addEventListener("click", () => finalizar(null));
    dialogo.addEventListener("cancel", (evento) => {
      evento.preventDefault();
      finalizar(null);
    });
    dialogo.addEventListener("click", (evento) => {
      if (evento.target === dialogo) finalizar(null);
    });

    dialogo.showModal();
    input.focus();
    input.select();
  });
}
