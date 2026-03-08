const CSV_FILE = "embalagens com categorias.csv";

export async function carregarCadastro() {
  const response = await fetch(CSV_FILE);
  const text = await response.text();
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const headers = lines[0].split(";").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(";").map((value) => value.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    return row;
  });
}

export function criarArvoreCategorias(dados) {
  const tree = {};
  dados.forEach((item) => {
    let current = tree;
    for (let i = 0; i <= 7; i += 1) {
      const key = item[`NIVEL ${i}`]?.trim();
      if (!key) break;
      if (!current[key]) current[key] = {};
      current = current[key];
    }
  });
  return tree;
}

export function caminhoProduto(produto) {
  const niveis = [];
  for (let i = 0; i <= 7; i += 1) {
    const value = produto[`NIVEL ${i}`];
    if (value) niveis.push(value);
  }
  return niveis.join(" > ");
}