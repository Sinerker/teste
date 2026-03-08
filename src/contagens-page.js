import { addContagem, ensureStores, getAll } from "./db.js";

const state = {
  loteAtual: null,
  produtos: [],
  produtoSelecionado: null,
};

function showMessage(text, kind = "error") {
  const current = document.querySelector(".toast");
  if (current) current.remove();

  const div = document.createElement("div");
  div.className = `toast ${kind}`;
  div.textContent = text;
  document.body.appendChild(div);

  setTimeout(() => div.classList.add("hide"), 1800);
  setTimeout(() => div.remove(), 2200);
}

function fillSelects() {
  const coluna = document.getElementById("coluna");
  const andar = document.getElementById("andar");

  coluna.innerHTML = "<option value=''>Selecione</option>";
  for (let code = 65; code <= 90; code += 1) {
    const option = document.createElement("option");
    option.value = String.fromCharCode(code);
    option.textContent = String.fromCharCode(code);
    coluna.appendChild(option);
  }

  andar.innerHTML = "<option value=''>Selecione</option>";
  for (let floor = 1; floor <= 20; floor += 1) {
    const option = document.createElement("option");
    option.value = floor;
    option.textContent = floor;
    andar.appendChild(option);
  }
}

function saveEstadoCampos() {
  const estado = {
    corredor: document.getElementById("corredor").value,
    coluna: document.getElementById("coluna").value,
    andar: document.getElementById("andar").value,
    radioSelecionado: document.querySelector("input[name='tipo-contagem']:checked")?.value || "loja",
  };
  localStorage.setItem("estadoContagem", JSON.stringify(estado));
}

function restoreEstadoCampos() {
  const raw = localStorage.getItem("estadoContagem");
  if (!raw) return;

  try {
    const estado = JSON.parse(raw);
    document.getElementById("corredor").value = estado.corredor || "";
    document.getElementById("coluna").value = estado.coluna || "";
    document.getElementById("andar").value = estado.andar || "";

    if (estado.radioSelecionado) {
      const radio = document.querySelector(
        `input[name='tipo-contagem'][value='${estado.radioSelecionado}']`
      );
      if (radio) radio.checked = true;
    }
  } catch (error) {
    console.warn("Falha ao restaurar estado:", error);
  }
}

function renderProduto(produto) {
  const resultado = document.getElementById("resultado");
  resultado.innerHTML = "";

  const card = document.createElement("article");
  card.className = "produto-card";

  const seq = document.createElement("strong");
  seq.textContent = `SEQ: ${produto.SEQPRODUTO}`;

  const nome = document.createElement("p");
  nome.textContent = produto.DESCCOMPLETA;

  const codigo = document.createElement("p");
  codigo.textContent = `Cód: ${produto.CODACESSO}`;

  const emb = document.createElement("p");
  emb.textContent = `Emb.: ${produto.QTDEMBALAGEM}`;

  card.append(seq, nome, codigo, emb);
  resultado.appendChild(card);
}

function renderListaProdutos(lista) {
  const resultado = document.getElementById("resultado");
  resultado.innerHTML = "";

  if (!lista.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Nenhum produto encontrado.";
    resultado.appendChild(empty);
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "produto-lista";

  lista.forEach((produto) => {
    const li = document.createElement("li");
    li.className = "produto-item";

    const title = document.createElement("strong");
    title.textContent = produto.DESCCOMPLETA;

    const details = document.createElement("small");
    details.textContent = `SEQ: ${produto.SEQPRODUTO} • COD: ${produto.CODACESSO} • EMB: ${produto.QTDEMBALAGEM}`;

    li.append(title, details);
    li.addEventListener("click", async () => {
      state.produtoSelecionado = produto;
      renderProduto(produto);

      const qtde1 = document.getElementById("qtde1").checked;
      if (qtde1) {
        document.getElementById("quantidade").value = 1;
        await confirmarQuantidade();
        return;
      }

      const soma = await somaContagensExistentes(produto);
      const qtdInput = document.getElementById("quantidade");
      qtdInput.value = soma || "";
      qtdInput.focus();
      qtdInput.select();
    });

    ul.appendChild(li);
  });

  resultado.appendChild(ul);
}

async function carregarLote() {
  const lotes = await getAll("lotes");
  if (!lotes.length) {
    showMessage("Nenhum lote disponível. Crie um lote na tela inicial.");
    return;
  }

  const ultimo = lotes[lotes.length - 1];
  state.loteAtual = {
    nome: ultimo.nome,
    usuario: ultimo.usuario,
    loja: ultimo.loja,
  };
  state.produtos = ultimo.produtos || [];
}

function buscarPorCodigo(valor) {
  const exact = state.produtos.filter((p) => (p.CODACESSO || "").trim() === valor);
  if (exact.length) return exact;
  return state.produtos.filter((p) => (p.CODACESSO || "").includes(valor));
}

function buscarPorNome(valor) {
  const q = valor.toLowerCase();
  return state.produtos.filter((p) => (p.DESCCOMPLETA || "").toLowerCase().includes(q));
}

function isCode(text) {
  return /^\d+$/.test(text.trim());
}

async function somaContagensExistentes(produto) {
  const contagens = await getAll("contagens");
  return contagens.reduce((acc, current) => {
    if (
      current.loteNome === state.loteAtual?.nome &&
      String(current.codacesso) === String(produto.CODACESSO)
    ) {
      return acc + (Number(current.quantidade) || 0);
    }
    return acc;
  }, 0);
}

function mostrarUltimoContado(registro) {
  const painel = document.getElementById("ultimo-contado");
  painel.hidden = false;
  painel.innerHTML = "";

  const rows = [
    `SEQ: ${registro.seqproduto}`,
    `Nome: ${registro.desccompleta}`,
    `Código: ${registro.codacesso}`,
    `Embalagem: ${registro.qtdeembalagem}`,
    `Qtd: ${registro.quantidade}`,
  ];

  rows.forEach((text) => {
    const p = document.createElement("p");
    p.textContent = text;
    painel.appendChild(p);
  });
}

function validarPosicao() {
  const corredor = document.getElementById("corredor").value.trim();
  const coluna = document.getElementById("coluna").value.trim();
  const andar = document.getElementById("andar").value.trim();
  return Boolean(corredor && coluna && andar);
}

async function confirmarQuantidade() {
  if (!validarPosicao()) {
    showMessage("Preencha Corredor, Coluna e Andar antes de salvar.");
    return;
  }

  const qtdInput = document.getElementById("quantidade");
  const quantidade = Number(qtdInput.value.trim());

  if (Number.isNaN(quantidade) || Math.abs(quantidade) > 5999) {
    showMessage("Quantidade inválida.");
    qtdInput.select();
    return;
  }

  if (!state.produtoSelecionado) {
    showMessage("Nenhum produto selecionado.");
    return;
  }

  if (quantidade === 0) {
    document.getElementById("codigo").value = "";
    qtdInput.value = "";
    document.getElementById("resultado").innerHTML = "";
    state.produtoSelecionado = null;
    return;
  }

  const registro = {
    loteNome: state.loteAtual?.nome || null,
    usuario: state.loteAtual?.usuario || null,
    loja: state.loteAtual?.loja || null,
    tipoContagem: document.querySelector("input[name='tipo-contagem']:checked")?.value || "",
    corredor: document.getElementById("corredor").value,
    coluna: document.getElementById("coluna").value,
    andar: document.getElementById("andar").value,
    seqproduto: state.produtoSelecionado.SEQPRODUTO,
    desccompleta: state.produtoSelecionado.DESCCOMPLETA,
    codacesso: state.produtoSelecionado.CODACESSO,
    qtdeembalagem: state.produtoSelecionado.QTDEMBALAGEM,
    quantidade,
    dataHora: new Date().toISOString(),
  };

  await addContagem(registro);
  mostrarUltimoContado(registro);

  const qtd1 = document.getElementById("qtde1").checked;
  document.getElementById("codigo").value = "";
  document.getElementById("resultado").innerHTML = "";
  state.produtoSelecionado = null;
  qtdInput.value = qtd1 ? 1 : "";

  document.getElementById("codigo").focus();
}

async function onCodigoEnter(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();

  const value = event.target.value.trim();
  if (!value) return;

  if (!state.produtos.length) {
    showMessage("Nenhum produto disponível no lote.");
    return;
  }

  const qtde1 = document.getElementById("qtde1").checked;

  if (isCode(value)) {
    const found = buscarPorCodigo(value);
    if (!found.length) {
      renderListaProdutos([]);
      return;
    }

    state.produtoSelecionado = found[0];
    renderProduto(found[0]);

    if (qtde1) {
      document.getElementById("quantidade").value = 1;
      await confirmarQuantidade();
      return;
    }

    const soma = await somaContagensExistentes(found[0]);
    const qtdInput = document.getElementById("quantidade");
    qtdInput.value = soma || "";
    qtdInput.focus();
    qtdInput.select();
    return;
  }

  const foundByName = buscarPorNome(value);
  if (!foundByName.length) {
    renderListaProdutos([]);
    return;
  }

  if (qtde1 && foundByName.length === 1) {
    state.produtoSelecionado = foundByName[0];
    renderProduto(foundByName[0]);
    document.getElementById("quantidade").value = 1;
    await confirmarQuantidade();
    return;
  }

  renderListaProdutos(foundByName);
}

async function exportarContagens() {
  const contagens = await getAll("contagens");
  if (!contagens.length) {
    showMessage("Nenhuma contagem registrada para exportar.");
    return;
  }

  const usuario = (contagens[0].usuario || "USUARIO").toUpperCase();
  const loja = (contagens[0].loja || "LOJA").toUpperCase();
  const data = new Date().toISOString().split("T")[0];

  const header =
    "DATA;HORA;USUARIO;TIPO-CONTAGEM;CORREDOR;COLUNA;ANDAR;SEQPRODUTO;CODACESSO;DESCCOMPLETA;QTDEMBALAGEM;QUANTIDADE;";

  const rows = contagens.map((item) => {
    let dia = "";
    let hora = "";
    if (item.dataHora) {
      const parts = item.dataHora.split("T");
      dia = parts[0];
      hora = (parts[1] || "").split(".")[0];
    }

    return [
      dia,
      hora,
      String(item.usuario || "").toUpperCase(),
      String(item.tipoContagem || "").toUpperCase(),
      String(item.corredor || "").toUpperCase(),
      String(item.coluna || "").toUpperCase(),
      String(item.andar || "").toUpperCase(),
      String(item.seqproduto || "").toUpperCase(),
      String(item.codacesso || "").toUpperCase(),
      String(item.desccompleta || "").toUpperCase(),
      String(item.qtdeembalagem || "").toUpperCase(),
      String(item.quantidade || "").toUpperCase(),
    ].join(";");
  });

  const csv = [header, ...rows].join("\n");
  baixarArquivo(`${usuario}_${loja}_${data}.csv`, csv, "text/csv;charset=utf-8;");

  const agrupado = {};
  contagens.forEach((registro) => {
    const cod = String(registro.codacesso || "").trim();
    const qtd = parseFloat(registro.quantidade) || 0;
    if (!cod) return;
    agrupado[cod] = (agrupado[cod] || 0) + qtd;
  });

  const linhasConcat = Object.entries(agrupado)
    .filter(([, qtd]) => qtd > 0)
    .map(([cod, qtd]) => `000000${cod.padStart(14, "0")}${Math.round(qtd).toString().padStart(7, "0")}`)
    .join("\n");

  baixarArquivo(
    `${usuario}_${loja}_${data}_CONCATENADO.txt`,
    linhasConcat,
    "text/plain;charset=utf-8;"
  );

  showMessage("Arquivos exportados com sucesso.", "success");
}

function baixarArquivo(nome, conteudo, mime) {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nome;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function setupFullscreen() {
  const btn = document.getElementById("fullscreen-btn");
  btn.addEventListener("click", async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error(error);
    }
  });
}

function setupQtde1() {
  const check = document.getElementById("qtde1");
  const qtdInput = document.getElementById("quantidade");

  check.addEventListener("change", () => {
    if (check.checked) {
      qtdInput.value = 1;
      qtdInput.readOnly = true;
      return;
    }

    qtdInput.readOnly = false;
    qtdInput.value = "";
  });
}

function setupEventos() {
  ["corredor", "coluna", "andar"].forEach((id) => {
    document.getElementById(id).addEventListener("change", saveEstadoCampos);
  });

  document.querySelectorAll("input[name='tipo-contagem']").forEach((radio) => {
    radio.addEventListener("change", saveEstadoCampos);
  });

  document.getElementById("codigo").addEventListener("keydown", onCodigoEnter);
  document.getElementById("quantidade").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmarQuantidade();
    }
  });

  document.getElementById("exportar-contagens").addEventListener("click", exportarContagens);
}

async function start() {
  await ensureStores();
  fillSelects();
  restoreEstadoCampos();
  await carregarLote();
  setupFullscreen();
  setupQtde1();
  setupEventos();
}

start().catch((error) => {
  console.error(error);
  showMessage("Falha ao iniciar a tela de contagens.");
});