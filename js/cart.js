/**
 * cart.js
 * Logika nákupního košíku / otevřeného účtu.
 * Stará se o přidávání položek, změnu počtu, výpočet součtu a vykreslení účtenky.
 */

// Aktuální stav košíku v paměti
let cart = [];

/**
 * Přidá produkt do košíku nebo navýší počet kusů
 */
function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1,
      category: product.category
    });
  }

  renderCart();
}

/**
 * Změní množství položky o +1 nebo -1
 */
function changeQuantity(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;

  // Pokud je počet 0 nebo méně, položku odstraníme
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id !== productId);
  }

  renderCart();
}

/**
 * Úplně odstraní položku z košíku
 */
function removeItem(productId) {
  cart = cart.filter(i => i.id !== productId);
  renderCart();
}

/**
 * Umožňuje rychlou úpravu ceny položky pro speciální případy (např. sleva nebo akce)
 */
function editItemPrice(productId) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  const input = prompt(`Zadej novou cenu pro "${item.name}" (Kč):`, item.price);
  if (input !== null) {
    const newPrice = parseFloat(input);
    if (!isNaN(newPrice) && newPrice >= 0) {
      item.price = newPrice;
      renderCart();
    } else {
      alert('Zadej platné číslo pro cenu.');
    }
  }
}

/**
 * Vyprázdní celý košík (s potvrzením předcházejícím chybě)
 */
function clearCart(confirmFirst = true) {
  if (cart.length === 0) return;

  if (confirmFirst) {
    const ok = confirm('Opravdu chceš stornovat a vyprázdnit celý účet?');
    if (!ok) return;
  }

  cart = [];
  renderCart();
}

/**
 * Spočítá celkovou částku za všechny položky v košíku
 */
function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

/**
 * Vykreslí položky v pravém panelu účtu
 */
function renderCart() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const payCashBtn = document.getElementById('pay-cash-btn');
  const payCardBtn = document.getElementById('pay-card-btn');
  const clearCartBtn = document.getElementById('clear-cart-btn');

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-slate-400 py-12">
        <span class="text-4xl mb-2">🧾</span>
        <p class="font-medium">Účet je prázdný</p>
        <p class="text-sm">Kliknutím na produkt vlevo přidáš položku</p>
      </div>
    `;
    totalEl.textContent = '0 Kč';
    if (payCashBtn) payCashBtn.disabled = true;
    if (payCardBtn) payCardBtn.disabled = true;
    if (clearCartBtn) clearCartBtn.disabled = true;
    return;
  }

  // Povolíme tlačítka platby a storna
  if (payCashBtn) payCashBtn.disabled = false;
  if (payCardBtn) payCardBtn.disabled = false;
  if (clearCartBtn) clearCartBtn.disabled = false;

  // Vygenerujeme HTML pro jednotlivé položky
  container.innerHTML = cart.map(item => {
    const itemTotal = item.price * item.quantity;
    return `
      <div class="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 shadow-sm gap-2">
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-slate-800 truncate">${item.name}</div>
          <div class="text-xs text-slate-500 flex items-center gap-1">
            <button onclick="editItemPrice(${item.id})" class="text-indigo-600 hover:underline font-mono" title="Klikni pro změnu ceny">
              ${item.price} Kč / ks ✏️
            </button>
          </div>
        </div>

        <!-- Tlačítka pro změnu množství -->
        <div class="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
          <button onclick="changeQuantity(${item.id}, -1)" 
                  class="w-8 h-8 rounded-md bg-white text-slate-700 font-bold hover:bg-slate-200 flex items-center justify-center shadow-sm text-lg active:scale-95 transition">
            -
          </button>
          <span class="w-8 text-center font-bold text-slate-800 text-base">${item.quantity}</span>
          <button onclick="changeQuantity(${item.id}, 1)" 
                  class="w-8 h-8 rounded-md bg-white text-slate-700 font-bold hover:bg-slate-200 flex items-center justify-center shadow-sm text-lg active:scale-95 transition">
            +
          </button>
        </div>

        <!-- Celková cena za položku a smazání -->
        <div class="text-right pl-2">
          <div class="font-bold text-slate-800 font-mono text-base whitespace-nowrap">${itemTotal} Kč</div>
          <button onclick="removeItem(${item.id})" class="text-xs text-red-500 hover:text-red-700 mt-0.5">
            smazat
          </button>
        </div>
      </div>
    `;
  }).join('');

  totalEl.textContent = `${getCartTotal()} Kč`;
}
