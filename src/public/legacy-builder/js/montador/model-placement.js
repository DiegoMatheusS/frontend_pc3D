// O encaixe pertence ao gabinete; o pivô e as unidades pertencem ao arquivo GLB.
// Mantê-los em grupos distintos impede a normalização/animação de mover a peça.
export function escala3DPositiva(valor, fallback = 1) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : fallback;
}

export function resolverPosicaoEncaixe3D(base, transform = {}) {
  const valores = Array.isArray(transform.posicao) ? transform.posicao : [];
  const posicao = new THREE.Vector3(...[0, 1, 2].map((indice) => {
    const numero = Number(valores[indice]);
    return Number.isFinite(numero) ? numero : 0;
  }));
  // Snapshots antigos gravavam "absoluta" com o vetor padrão zerado.
  // Esse valor não é uma calibração e deve continuar usando o slot da peça.
  if (transform.modoPosicao === "absoluta" && posicao.lengthSq() > 0) return posicao;
  return base.clone().add(posicao);
}

export function criarEncaixeModelo3D(modelo, posicao, categoria, centralizar = true) {
  modelo.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(modelo);
  if (caixa.isEmpty()) throw new Error("Modelo 3D sem geometria.");
  const tamanho = caixa.getSize(new THREE.Vector3());
  if (![tamanho.x, tamanho.y, tamanho.z].every((valor) => Number.isFinite(valor) && valor > 0)) {
    throw new Error("Modelo 3D com dimensões inválidas.");
  }
  if (centralizar) {
    const centro = caixa.getCenter(new THREE.Vector3());
    // A placa-mãe encosta na bandeja pelo lado traseiro. Dissipadores e
    // conectores avançam para o interior, sem afundar metade do GLB no painel.
    if (categoria === "placamae") centro.x = caixa.min.x;
    modelo.position.sub(centro);
    modelo.updateMatrixWorld(true);
  }
  const encaixe = new THREE.Group();
  encaixe.position.copy(posicao);
  encaixe.add(modelo);
  encaixe.userData.encaixe3D = true;
  return encaixe;
}

export function formatoArmazenamento3D(peca = {}) {
  const specs = peca.especificacoes || {};
  const texto = [specs.formato, specs.interface, specs.tipo, peca.nome, peca.modelo]
    .filter(Boolean).join(" ").toUpperCase();
  if (/M\.?2|NVME|22(?:30|42|60|80|110)/.test(texto)) return "m2";
  if (/HDD|DISCO R[IÍ]GIDO|3[.,]5|7200|5400/.test(texto)) return "hdd";
  return "sata";
}

export function dimensoesPlacaMae3D(peca = {}) {
  const specs = peca.especificacoes || {};
  const formato = String(specs.formato || peca.formato || "ATX").toUpperCase().replace(/[ _-]/g, "");
  let altura = 305;
  let largura = 244;
  if (/MINI|ITX/.test(formato)) altura = largura = 170;
  else if (/MICRO|MATX/.test(formato)) altura = largura = 244;
  else if (/EATX/.test(formato)) largura = 330;
  return {
    altura: escala3DPositiva(specs.alturaMm, altura) * 0.01,
    profundidade: escala3DPositiva(specs.larguraMm, largura) * 0.01,
  };
}

export function dimensoesGabinete3D(peca = {}, padrao = { largura: 2.4, altura: 4.6, profundidade: 4.5 }) {
  const specs = peca?.especificacoes || {};
  const eixos = ["largura", "altura", "profundidade"];
  const medidas = eixos.map((eixo) => Number(specs[`${eixo}Mm`] ?? peca?.[`${eixo}Mm`]));
  // Cadastros legados, como o White PC-240, trazem 24/39/47 cm nos campos
  // *Mm. Só converte quando o trio inteiro tem essa ordem de grandeza;
  // uma largura pequena isolada pode ser um gabinete slim válido em mm.
  const fatorUnidade = medidas.every((valor) => Number.isFinite(valor) && valor >= 10 && valor < 100) ? 10 : 1;
  return Object.fromEntries(eixos.map((eixo, indice) => {
    const valor = medidas[indice];
    return [eixo, Number.isFinite(valor) && valor > 0 ? valor * fatorUnidade * 0.01 : padrao[eixo]];
  }));
}
