/**
 * pos.js
 * Vykreslování mřížky produktů, filtry kategorií a vyhledávání.
 * Inspirováno dotykovým rozhraním Storyous POS.
 */

let activeCategory = 'all';
let searchQuery = '';

/**
 * Vykreslí horní lištu kategorií (tlačítka pro rychlé filtrování)
 */
function renderCategories() {
  const container = document.getElementById('category-pills');
  if (!container) return;

  const categories = getCategories();

  container.innerHTML = categories.map(cat => {
    const isActive = cat.id === activeCategory;
    const activeClasses = isActive 
      ? 'bg-slate-800 text-white shadow-md border-slate-800' 
      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300';

    return `
      <button onclick="setCategory('${cat.id}')" 
              class="touch-btn px-4 py-2 rounded-xl border font-semibold text-sm transition-all flex items-center gap-2 whitespace-nowrap shadow-sm ${activeClasses}">
        <span class="text-lg">${cat.icon}</span>
        <span>${cat.name}</span>
      </button>
    `;
  }).join('');
}

/**
 * Přepne aktivní kategorii a překreslí produkty
 */
function setCategory(categoryId) {
  activeCategory = categoryId;
  renderCategories();
  renderProductGrid();
}

/**
 * Vyhledávání v produktech
 */
function searchProducts(query) {
  searchQuery = query.toLowerCase().trim();
  renderProductGrid();
}

/**
 * Vykreslí mřížku karet produktů
 */
function renderProductGrid() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const products = getProducts();

  // Filtrování podle kategorie a vyhledávacího textu
  const filtered = products.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400">
        <span class="text-5xl block mb-3">🔍</span>
        <p class="text-lg font-medium">Nebyly nalezeny žádné produkty</p>
        <p class="text-sm">Zkus zvolit jinou kategorii nebo upravit hledání</p>
      </div>
    `;
    return;
  }

  // Generování karet produktů pro dotykové ovládání
  grid.innerHTML = filtered.map(p => {
    return `
      <button onclick="handleProductClick(${p.id})" 
              class="product-card touch-btn p-3 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-400 flex flex-col justify-between items-start text-left relative overflow-hidden group">
        
        <div class="flex items-start justify-between w-full">
          <span class="text-3xl">${p.icon || '📦'}</span>
          <span class="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full font-semibold uppercase tracking-wider">
            ${p.category}
          </span>
        </div>

        <div class="mt-2 w-full">
          <div class="font-bold text-slate-800 text-base leading-snug line-clamp-2">
            ${p.name}
          </div>
          <div class="mt-1 flex items-baseline justify-between w-full">
            <span class="text-xl font-extrabold text-indigo-600 font-mono">
              ${p.price} Kč
            </span>
            <span class="text-xs text-slate-400 font-medium">Přidat +</span>
          </div>
        </div>

      </button>
    `;
  }).join('');
}

/**
 * Kliknutí na kartu produktu přidá položku do košíku
 */
function handleProductClick(productId) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (product) {
    addToCart(product);
  }
}
