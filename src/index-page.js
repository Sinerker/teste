import { carregarCadastro, criarArvoreCategorias, caminhoProduto } from "./csv.js";
import { clearAllDatabases, ensureStores, getAll, saveLote } from "./db.js";

const state = {
  produtos: [],
};

function toast(message) {
  const current = document.querySelector(".toast");
  if (current) current.remove();

  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(() => div.classList.add("hide"), 1800);
  setTimeout(() => div.remove(), 2200);
}

function createTreeNode(name, children, parentPath = "") {
  const li = document.createElement("li");

  const row = document.createElement("div");
  row.className = "tree-row";

  const path = parentPath ? `${parentPath} > ${name}` : name;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "tree-toggle";
  toggle.textContent = Object.keys(children).length ? "▶" : "";

  const label = document.createElement("label");
  label.className = "tree-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.dataset.path = path;

  const text = document.createElement("span");
  text.textContent = name;

  label.append(checkbox, text);
  row.append(toggle, label);
  li.appendChild(row);

  if (Object.keys(children).length) {
    const ul = document.createElement("ul");
    ul.className = "tree-children";
    ul.hidden = true;

    Object.entries(children).forEach(([childName, childNode]) => {
      ul.appendChild(createTreeNode(childName, childNode, path));
    });

    toggle.addEventListener("click", () => {
      ul.hidden = !ul.hidden;
      toggle.textContent = ul.hidden ? "▶" : "▼";
    });

    li.appendChild(ul);
  }

  return li;
}

function renderTree(produtos) {
  const container = document.getElementById("tree-container");
  container.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "Categorias";

  const subtitle = document.createElement("p");
  subtitle.className = "muted";
  subtitle.textContent = "Marque uma ou mais categorias para montar o lote.";

  const rootUl = document.createElement("ul");
  rootUl.className = "tree-root";

  const tree = criarArvoreCategorias(produtos);
  Object.entries(tree).forEach(([name, node]) => {
    rootUl.appendChild(createTreeNode(name, node));
  });

  container.append(title, subtitle, rootUl);
}

async function confirmar(titulo, mensagem) {
  const dialog = document.getElementById("confirm-modal");
  document.getElementById("modal-title").textContent = titulo;
  document.getElementById("modal-message").textContent = mensagem;

  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => {
        resolve(dialog.returnValue === "confirm");
      },
      { once: true }
    );
  });
}

function produtosSelecionados(categorias) {
  return state.produtos.filter((produto) => {
    const path = caminhoProduto(produto);
    return categorias.some((categoria) => path.startsWith(categoria));
  });
}

async function criarLote() {
  const usuario = document.getElementById("usuario").value.trim();
  const loja = document.getElementById("loja").value.trim();

  const checkboxes = document.querySelectorAll("#tree-container input[type='checkbox']:checked");
  const categorias = Array.from(checkboxes, (checkbox) => checkbox.dataset.path);

  if (!usuario || !loja) {
    toast("Preencha usuário e loja.");
    return;
  }

  if (categorias.length === 0) {
    toast("Selecione ao menos uma categoria.");
    return;
  }

  const produtos = produtosSelecionados(categorias);
  if (!produtos.length) {
    toast("Nenhum produto encontrado para as categorias selecionadas.");
    return;
  }

  await saveLote({
    nome: `${usuario}_${loja}`,
    usuario,
    loja,
    dataCriacao: new Date().toISOString(),
    produtos,
  });

  window.location.href = "./contagens.html";
}

async function setupActionButtons() {
  const lotes = await getAll("lotes");
  const hasLote = lotes.length > 0;

  const btnContinuar = document.getElementById("continuar-contagens");
  const btnLimpar = document.getElementById("limpar-banco");

  btnContinuar.style.display = hasLote ? "inline-flex" : "none";
  btnLimpar.style.display = hasLote ? "inline-flex" : "none";

  btnLimpar.addEventListener("click", async () => {
    const first = await confirmar(
      "Apagar todos os dados",
      "Tem certeza que deseja apagar lotes e contagens?"
    );
    if (!first) return;

    const second = await confirmar(
      "Confirmação final",
      "Essa ação é irreversível. Deseja continuar?"
    );
    if (!second) return;

    await clearAllDatabases();
    localStorage.removeItem("estadoContagem");
    window.location.reload();
  });
}

async function start() {
  await ensureStores();
  state.produtos = await carregarCadastro();
  renderTree(state.produtos);
  await setupActionButtons();

  document.getElementById("criar-lote").addEventListener("click", criarLote);
}

start().catch((error) => {
  console.error(error);
  toast("Falha ao carregar cadastro.");
});