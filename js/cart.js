/**
 * cart.js
 * Logika nákupního košíku / otevřeného účtu.
 * Přizpůsobeno pro snadné dotykové ovládání na mobilu i iPadu s velkými tlačítky.
 */

// Aktuální stav košíku v paměti
let cart = [];

/**
 * Získá celkový počet kusů v košíku
 */
function getCartItemCount() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

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

  // Zvýraznění plovoucí lišty na mobilu při přidání položky
  const bar = document.getElementById('mobile-cart-bar');
  if (bar) {
    bar.classList.add('cart-bump');
    setTimeout(() => bar.classList.remove('cart-bump'), 250);
  }
}

/**
 * Změní množství položky o +1 nebo -1 s velkými dotykovými tlačítky
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
      alert('Zadej platné nezáporné číslo pro cenu.');
    }
  }
}

/**
 * Vyprázdní celý košík (s potvrzením předcházejícím chybě obsluhy)
 */
function clearCart(confirmFirst = true) {
  if (cart.length === 0) return;

  if (confirmFirst) {
    const ok = confirm('Opravdu chceš stornovat a vyprázdnit celý aktuální účet?');
    if (!ok) return;
  }

  cart = [];
  renderCart();

  // Pokud je otevřený vysunovací košík na mobilu a účet byl vyprázdněn, zavřeme ho
  if (window.innerWidth < 768 && typeof toggleMobileCart === 'function') {
    toggleMobileCart(false);
  }
}

/**
 * Spočítá celkovou částku za všechny položky v košíku
 */
function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

/**
 * Vykreslí položky v panelu účtu a aktualizuje mobilní indikátory
 */
function renderCart() {
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const countLabel = document.getElementById('cart-items-count-label');
  const payCashBtn = document.getElementById('pay-cash-btn');
  const payCardBtn = document.getElementById('pay-card-btn');
  const clearCartBtn = document.getElementById('clear-cart-btn');

  // Mobilní komponenty
  const mobileBar = document.getElementById('mobile-cart-bar');
  const mobileBarCount = document.getElementById('mobile-bar-count');
  const mobileBarTotal = document.getElementById('mobile-bar-total');
  const headerCartTotal = document.getElementById('header-cart-total');
  const mobileBadge = document.getElementById('mobile-cart-badge');

  if (!container) return;

  const total = getCartTotal();
  const count = getCartItemCount();

  // Aktualizace počtu a částek v hlavičce a mobilních indikátorech
  if (headerCartTotal) headerCartTotal.textContent = `${total} Kč`;
  if (mobileBadge) {
    if (count > 0) {
      mobileBadge.textContent = count > 99 ? '99+' : count;
      mobileBadge.classList.remove('hidden');
    } else {
      mobileBadge.classList.add('hidden');
    }
  }

  if (countLabel) {
    countLabel.textContent = count === 0 
      ? '0 položek' 
      : `${count} ${count === 1 ? 'položka' : (count < 5 ? 'položky' : 'položek')}`;
  }

  // Případ prázdného účtu
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-slate-400 py-12 px-4 text-center">
        <span class="text-4xl sm:text-5xl mb-2">🧾</span>
        <p class="font-bold text-slate-700 text-base">Účet je prázdný</p>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">Kliknutím na produkty v nabídce přidáš položky</p>
      </div>
    `;
    if (totalEl) totalEl.textContent = '0 Kč';
    if (payCashBtn) payCashBtn.disabled = true;
    if (payCardBtn) payCardBtn.disabled = true;
    if (clearCartBtn) clearCartBtn.disabled = true;

    // Skrytí mobilní spodní lišty
    if (mobileBar) {
      mobileBar.classList.add('translate-y-28', 'opacity-0', 'pointer-events-none');
      mobileBar.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
    }
    return;
  }

  // Povolíme tlačítka platby a storna
  if (payCashBtn) payCashBtn.disabled = false;
  if (payCardBtn) payCardBtn.disabled = false;
  if (clearCartBtn) clearCartBtn.disabled = false;

  // Zobrazení a aktualizace mobilního plovoucího proužku
  if (mobileBar) {
    if (mobileBarCount) mobileBarCount.textContent = `${count} ks`;
    if (mobileBarTotal) mobileBarTotal.textContent = `${total} Kč`;
    mobileBar.classList.remove('translate-y-28', 'opacity-0', 'pointer-events-none');
    mobileBar.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
  }

  // Vygenerujeme HTML pro jednotlivé položky s velkými dotykovými tlačítky
  container.innerHTML = cart.map(item => {
    const itemTotal = item.price * item.quantity;
    return `
      <div class="flex items-center justify-between p-2.5 sm:p-3 bg-white rounded-xl border border-slate-200 shadow-xs gap-2">
        
        <!-- Název a cena za kus -->
        <div class="flex-1 min-w-0 pr-1">
          <div class="font-bold text-slate-800 text-xs sm:text-sm truncate leading-tight">${item.name}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">
            <button onclick="editItemPrice(${item.id})" 
                    class="text-indigo-600 hover:text-indigo-800 font-mono font-medium underline inline-flex items-center gap-0.5 py-0.5" 
                    title="Klikni pro úpravu ceny">
              <span>${item.price} Kč/ks</span>
              <span>✏️</span>
            </button>
          </div>
        </div>

        <!-- Dotyková tlačítka pro změnu množství (minimální velikost 40x40px) -->
        <div class="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
          <button onclick="changeQuantity(${item.id}, -1)" 
                  class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white text-slate-800 font-black hover:bg-slate-200 active:scale-90 flex items-center justify-center shadow-xs text-lg transition touch-btn min-h-0"
                  aria-label="Odebrat jeden kus">
            −
          </button>
          <span class="w-8 text-center font-black text-slate-900 text-sm sm:text-base font-mono">${item.quantity}</span>
          <button onclick="changeQuantity(${item.id}, 1)" 
                  class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white text-slate-800 font-black hover:bg-slate-200 active:scale-90 flex items-center justify-center shadow-xs text-lg transition touch-btn min-h-0"
                  aria-label="Přidat jeden kus">
            +
          </button>
        </div>

        <!-- Celková cena za položku a smazání -->
        <div class="text-right pl-1 flex items-center gap-2">
          <div class="font-black text-slate-900 font-mono text-sm sm:text-base whitespace-nowrap min-w-[50px]">
            ${itemTotal} Kč
          </div>
          <button onclick="removeItem(${item.id})" 
                  class="w-8 h-8 rounded-lg text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 active:scale-90 flex items-center justify-center transition"
                  title="Odstranit položku z účtu"
                  aria-label="Smazat">
            🗑️
          </button>
        </div>

      </div>
    `;
  }).join('');

  if (totalEl) totalEl.textContent = `${total} Kč`;
}
