function criarDialogoBase() {
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
