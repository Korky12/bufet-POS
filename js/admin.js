/**
 * admin.js
 * Jednoduchá správa menu a ceníku (přidávání, úprava cen a mazání produktů).
 */

/**
 * Vykreslí tabulku/seznam produktů v administraci
 */
function renderAdminProducts() {
  const container = document.getElementById('admin-products-list');
  if (!container) return;

  const products = getProducts();

  if (products.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-400">
          Žádné produkty v nabídce. Můžeš přidat nový nebo obnovit výchozí.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = products.map(p => {
    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
        <td class="py-3 px-4 text-2xl">${p.icon || '📦'}</td>
        <td class="py-3 px-4 font-semibold text-slate-800">${p.name}</td>
        <td class="py-3 px-4">
          <span class="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-md uppercase font-semibold">
            ${p.category}
          </span>
        </td>
        <td class="py-3 px-4 font-mono font-bold text-indigo-600">${p.price} Kč</td>
        <td class="py-3 px-4 text-right">
          <button onclick="editProductPrompt(${p.id})" class="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded mr-2 font-medium">
            Upravit ✏️
          </button>
          <button onclick="deleteProduct(${p.id})" class="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded font-medium">
            Smazat 🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Přidá nový produkt do nabídky
 */
function handleAddProduct(event) {
  event.preventDefault();

  const nameInput = document.getElementById('new-product-name');
  const priceInput = document.getElementById('new-product-price');
  const categoryInput = document.getElementById('new-product-category');
  const iconInput = document.getElementById('new-product-icon');

  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);
  const category = categoryInput.value;
  const icon = iconInput.value.trim() || '🥪';

  if (!name || isNaN(price) || price < 0) {
    alert('Prosím zadej platný název a cenu.');
    return;
  }

  const products = getProducts();
  const newProduct = {
    id: Date.now(),
    name,
    price,
    category,
    icon
  };

  products.push(newProduct);
  saveProducts(products);

  // Reset formuláře
  nameInput.value = '';
  priceInput.value = '';

  // Překreslení
  renderAdminProducts();
  renderProductGrid();
  showToast(`Produkt "${name}" byl úspěšně přidán.`);
}

/**
 * Smaže produkt z nabídky
 */
function deleteProduct(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const ok = confirm(`Opravdu chceš smazat produkt "${product.name}"?`);
  if (!ok) return;

  const updated = products.filter(p => p.id !== productId);
  saveProducts(updated);

  renderAdminProducts();
  renderProductGrid();
  showToast(`Produkt "${product.name}" byl smazán.`);
}

/**
 * Rychlá úprava ceny a názvu produktu
 */
function editProductPrompt(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const newName = prompt('Uprav název produktu:', product.name);
  if (newName === null) return;

  const newPriceStr = prompt('Uprav cenu produktu (Kč):', product.price);
  if (newPriceStr === null) return;

  const newPrice = parseFloat(newPriceStr);
  if (isNaN(newPrice) || newPrice < 0) {
    alert('Neplatná cena.');
    return;
  }

  product.name = newName.trim() || product.name;
  product.price = newPrice;

  saveProducts(products);
  renderAdminProducts();
  renderProductGrid();
  showToast('Produkt byl upraven.');
}

/**
 * Tlačítko pro obnovení výchozí nabídky bufetu
 */
function handleResetDefaults() {
  const ok = confirm('Opravdu chceš smazat vlastní změny a obnovit původní výchozí produkty bufetu?');
  if (ok) {
    resetDefaultProducts();
    renderAdminProducts();
    renderProductGrid();
    showToast('Byla obnovena výchozí nabídka produktů.');
  }
}
