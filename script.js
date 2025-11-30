const csvFilePath = "embalagens com categorias.csv";
let dadosCSV = [];

// Função para ler e armazenar o CSV
async function carregarCSV() {
  try {
    const resposta = await fetch(csvFilePath);
    const texto = await resposta.text();

    const linhas = texto.split("\n").filter((l) => l.trim() !== "");
    const cabecalho = linhas[0].split(";").map((c) => c.trim());

    dadosCSV = linhas.slice(1).map((linha) => {
      const valores = linha.split(";").map((v) => v.trim());
      const item = {};
      cabecalho.forEach((chave, i) => (item[chave] = valores[i] || ""));
      return item;
    });

    console.log("CSV carregado com sucesso!");
    criarArvoreCategorias();
    // ----------------------------------------------
    //  FUNÇÃO PARA MARCAR / DESMARCAR TODOS OS FILHOS
    // ----------------------------------------------
    function ativarMarcacaoHierarquica() {
      const checkboxes = document.querySelectorAll(
        "#container-arvore input[type='checkbox']"
      );

      checkboxes.forEach((cb) => {
        cb.addEventListener("change", () => {
          const li = cb.closest("li");
          if (!li) return;

          const filhos = li.querySelectorAll("ul input[type='checkbox']");
          filhos.forEach((filho) => {
            filho.checked = cb.checked;
          });
        });
      });
    }

    // Ativa o comportamento após a árvore existir
    ativarMarcacaoHierarquica();
  } catch (erro) {
    console.error("Erro ao carregar o CSV:", erro);
  }
}

// Função para criar a estrutura hierárquica
function criarEstruturaHierarquica(dados) {
  const arvore = {};
  dados.forEach((item) => {
    let nivelAtual = arvore;
    for (let i = 0; i <= 7; i++) {
      const chave = item[`NIVEL ${i}`]; // trim já foi feito antes
      if (!chave) break;
      if (!nivelAtual[chave]) {
        nivelAtual[chave] = {};
      }
      nivelAtual = nivelAtual[chave];
    }
  });
  return arvore;
}

// Função recursiva para gerar o HTML da árvore
function gerarHTMLArvore(obj, caminhoAtual = "") {
  const ul = document.createElement("ul");

  for (const chave in obj) {
    const li = document.createElement("li");
    li.classList.add("no-arvore");

    const caminhoCompleto = caminhoAtual ? `${caminhoAtual} > ${chave}` : chave;

    const nodeHeader = document.createElement("div");
    nodeHeader.classList.add("cabecalho-no");

    const filhos = obj[chave];
    const temFilhos = Object.keys(filhos).length > 0;

    const toggle = document.createElement("span");
    toggle.classList.add("toggle-no");
    toggle.textContent = temFilhos ? "▶" : "";
    toggle.style.userSelect = "none";
    toggle.style.transition = "color 0.2s";

    const label = document.createElement("label");
    label.innerHTML = `
      <input type="checkbox" class="checkbox-arvore" data-path="${caminhoCompleto}">
      ${chave}
    `;

    nodeHeader.appendChild(toggle);
    nodeHeader.appendChild(label);
    li.appendChild(nodeHeader);

    if (temFilhos) {
      const subUl = gerarHTMLArvore(filhos, caminhoCompleto);
      subUl.classList.add("ilhos-arvore");
      subUl.style.display = "none";
      li.appendChild(subUl);

      toggle.addEventListener("click", () => {
        if (subUl.style.display === "none" || subUl.style.display === "") {
          subUl.style.display = "block";
          toggle.textContent = "▼";
          toggle.style.color = "#007bff";
        } else {
          subUl.style.display = "none";
          toggle.textContent = "▶";
          toggle.style.color = "#333";
        }
      });
    }

    ul.appendChild(li);
  }

  return ul;
}

// Função principal para criar a árvore
function criarArvoreCategorias() {
  const estrutura = criarEstruturaHierarquica(dadosCSV);
  const container = document.getElementById("container-arvore");

  const arvoreHTML = gerarHTMLArvore(estrutura);

  const fragment = document.createDocumentFragment();
  fragment.appendChild(arvoreHTML);
  container.appendChild(fragment);
}

// Inicia o processo
document.addEventListener("DOMContentLoaded", carregarCSV);
