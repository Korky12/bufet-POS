/**
 * pos.js
 * Vykreslování mřížky produktů, filtry kategorií a vyhledávání.
 * Optimalizováno pro dotykové ovládání na mobilních telefonech a iPadech.
 */

let activeCategory = 'all';
let searchQuery = '';

/**
 * Vykreslí horní lištu kategorií (tlačítka pro rychlé dotykové filtrování)
 */
function renderCategories() {
  const container = document.getElementById('category-pills');
  if (!container) return;

  const categories = getCategories();

  container.innerHTML = categories.map(cat => {
    const isActive = cat.id === activeCategory;
    const activeClasses = isActive 
      ? 'bg-slate-800 text-white shadow-md border-slate-800 ring-2 ring-slate-800/20' 
      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200';

    return `
      <button onclick="setCategory('${cat.id}')" 
              class="touch-btn px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shadow-xs active:scale-95 ${activeClasses}">
        <span class="text-base sm:text-lg">${cat.icon}</span>
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
 * Vyhledávání v produktech s podporou tlačítka smazání
 */
function searchProducts(query) {
  searchQuery = query.toLowerCase().trim();
  
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) {
    if (searchQuery.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  renderProductGrid();
}

/**
 * Vymaže vyhledávací pole jedním dotykem
 */
function clearSearch() {
  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  searchProducts('');
}

/**
 * Vykreslí mřížku karet produktů (dotykově vstřícné rozvržení pro mobil i iPad)
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
      <div class="col-span-full py-12 sm:py-16 text-center text-slate-400">
        <span class="text-4xl sm:text-5xl block mb-2 sm:mb-3">🔍</span>
        <p class="text-base sm:text-lg font-medium text-slate-600">Nebyly nalezeny žádné produkty</p>
        <p class="text-xs sm:text-sm mt-1">Zkus zvolit jinou kategorii nebo upravit hledání</p>
      </div>
    `;
    return;
  }

  // Generování karet produktů pro dotykové ovládání (prsty na mobilu a tabletu)
  grid.innerHTML = filtered.map(p => {
    return `
      <button onclick="handleProductClick(${p.id}, this)" 
              class="product-card touch-btn p-2.5 sm:p-3 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-400 flex flex-col justify-between items-start text-left relative overflow-hidden group w-full cursor-pointer">
        
        <div class="flex items-start justify-between w-full">
          <span class="text-2xl sm:text-3xl">${p.icon || '📦'}</span>
          <span class="bg-indigo-50 text-indigo-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
            ${p.category}
          </span>
        </div>

        <div class="mt-2 w-full">
          <div class="font-bold text-slate-800 text-xs sm:text-sm md:text-base leading-tight line-clamp-2">
            ${p.name}
          </div>
          <div class="mt-1 flex items-baseline justify-between w-full">
            <span class="text-base sm:text-lg md:text-xl font-extrabold text-indigo-600 font-mono">
              ${p.price} Kč
            </span>
            <span class="text-[11px] sm:text-xs text-indigo-500 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded-md group-hover:bg-indigo-100 transition">
              + Přidat
            </span>
          </div>
        </div>

      </button>
    `;
  }).join('');
}

/**
 * Kliknutí na kartu produktu přidá položku do košíku a poskytne jemnou vizuální odezvu
 */
function handleProductClick(productId, btnElement) {
  const products = getProducts();
  const product = products.find(p => p.id === productId);
  if (product) {
    addToCart(product);

    // Haptický/vizuální efekt na tlačítku produktu
    if (btnElement) {
      btnElement.classList.add('cart-bump');
      setTimeout(() => btnElement.classList.remove('cart-bump'), 250);
    }
  }
}
