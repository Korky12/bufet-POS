/**
 * app.js
 * Hlavní inicializace aplikace, přepínání záložek pro mobil i tablet/PC,
 * vysouvací panel účtu na telefonu a dotyková kalkulačka pro platbu hotově (Numpad).
 */

// Aktuálně aktivní záložka ('pos' | 'history' | 'admin')
let currentTab = 'pos';

// Stav dotykového vysouvacího účtu na telefonu
let isMobileCartOpen = false;

// Příznak pro přepsání výchozí částky v kalkulačce při prvním stisku numerické klávesnice
let isNumpadFresh = true;

/**
 * Přepínání mezi záložkami (Pokladna, Historie, Správa)
 * Podporuje jak desktop/tablet hlavičku, tak spodní mobilní lištu.
 */
function switchTab(tabName) {
  currentTab = tabName;

  // Zavřeme mobilní účet, pokud byl vysunutý
  if (isMobileCartOpen) {
    toggleMobileCart(false);
  }

  // Skryjeme všechny sekce
  document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));

  // Zobrazíme vybranou sekci
  const activeSection = document.getElementById(`tab-${tabName}`);
  if (activeSection) {
    activeSection.classList.remove('hidden');
  }

  // 1. Aktualizace tlačítek v desktop/tablet navigaci
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isTarget = btn.dataset.tab === tabName;
    if (isTarget) {
      btn.classList.add('bg-slate-700', 'text-white');
      btn.classList.remove('text-slate-300', 'hover:bg-slate-800');
    } else {
      btn.classList.remove('bg-slate-700', 'text-white');
      btn.classList.add('text-slate-300', 'hover:bg-slate-800');
    }
  });

  // 2. Aktualizace tlačítek ve spodní mobilní navigaci
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    const isTarget = btn.dataset.tab === tabName;
    if (isTarget) {
      btn.classList.add('text-indigo-400');
      btn.classList.remove('text-slate-400');
    } else {
      btn.classList.remove('text-indigo-400');
      btn.classList.add('text-slate-400');
    }
  });

  // Překreslíme data pro danou záložku
  if (tabName === 'history') {
    if (typeof fetchOrdersFromServer === 'function') {
      fetchOrdersFromServer();
    }
    renderHistory();
  } else if (tabName === 'admin') {
    renderAdminProducts();
  } else if (tabName === 'pos') {
    renderProductGrid();
    renderCart();
  }
}

/**
 * Otevře nebo zavře výsuvný panel účtu na mobilních zařízeních
 */
function toggleMobileCart(forceState) {
  const panel = document.getElementById('pos-cart-panel');
  const backdrop = document.getElementById('cart-backdrop');
  if (!panel || !backdrop) return;

  if (typeof forceState === 'boolean') {
    isMobileCartOpen = forceState;
  } else {
    isMobileCartOpen = !isMobileCartOpen;
  }

  if (isMobileCartOpen) {
    // Vysunout panel nahoru
    panel.classList.remove('translate-y-full');
    panel.classList.add('translate-y-0');

    // Zobrazit tmavé poloprůhledné pozadí
    backdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
      backdrop.classList.remove('opacity-0', 'pointer-events-none');
      backdrop.classList.add('opacity-100', 'pointer-events-auto');
    });
  } else {
    // Skrýt panel dolů
    panel.classList.add('translate-y-full');
    panel.classList.remove('translate-y-0');

    // Skrýt pozadí
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
      if (!isMobileCartOpen) {
        backdrop.classList.add('hidden');
      }
    }, 200);
  }
}

/**
 * Změna jména přihlášené obsluhy
 */
function changeCashierName() {
  const current = localStorage.getItem(STORAGE_KEYS.CASHIER) || 'Obsluha';
  const name = prompt('Zadej jméno nebo přezdívku obsluhy pokladny:', current);
  if (name && name.trim()) {
    localStorage.setItem(STORAGE_KEYS.CASHIER, name.trim());
    updateCashierDisplay();
    showToast(`👤 Přihlášena obsluha: ${name.trim()}`);
  }
}

function updateCashierDisplay() {
  const name = localStorage.getItem(STORAGE_KEYS.CASHIER) || 'Obsluha';
  const el = document.getElementById('cashier-name-display');
  if (el) {
    el.textContent = name;
  }
}

/**
 * Vyskakovací notifikace (Toast) optimalizovaná i pro dotykové obrazovky
 */
function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 font-semibold text-sm flex items-center gap-2 -translate-y-12 opacity-0 pointer-events-none border border-slate-700 max-w-[90vw] text-center justify-center';
    document.body.appendChild(toast);
  }

  toast.innerHTML = message;
  toast.classList.remove('-translate-y-12', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('-translate-y-12', 'opacity-0', 'pointer-events-none');
  }, 2600);
}

/**
 * Dialog pro platbu hotově (s dotykovým Numpadem a rychlým výpočtem na vrácení peněz)
 */
function openCashModal() {
  const total = getCartTotal();
  if (total <= 0) return;

  const modal = document.getElementById('cash-modal');
  const modalTotal = document.getElementById('cash-modal-total');
  const givenInput = document.getElementById('cash-given-input');

  modalTotal.textContent = `${total} Kč`;
  givenInput.value = total;
  isNumpadFresh = true; // Další stisk čísla přepíše původní částku

  updateCashReturn();

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeCashModal() {
  const modal = document.getElementById('cash-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/**
 * Přepočítá a vizuálně zobrazí částku k vrácení zákazníkovi
 */
function updateCashReturn() {
  const total = getCartTotal();
  const givenInput = document.getElementById('cash-given-input');
  const returnEl = document.getElementById('cash-return-amount');
  const returnContainer = document.getElementById('cash-return-container');
  const returnLabel = document.getElementById('cash-return-label');

  if (!givenInput || !returnEl || !returnContainer) return;

  const given = parseFloat(givenInput.value) || 0;
  const diff = given - total;

  if (diff >= 0) {
    returnEl.textContent = `${diff} Kč`;
    returnEl.className = 'text-2xl sm:text-3xl font-black font-mono text-emerald-600';
    returnContainer.className = 'bg-emerald-50 p-3 sm:p-4 rounded-2xl border border-emerald-200 flex justify-between items-center transition-colors';
    if (returnLabel) {
      returnLabel.textContent = 'Vrátit zákazníkovi:';
      returnLabel.className = 'text-emerald-800 font-bold text-xs sm:text-sm';
    }
  } else {
    returnEl.textContent = `Chybí ${Math.abs(diff)} Kč`;
    returnEl.className = 'text-2xl sm:text-3xl font-black font-mono text-red-500';
    returnContainer.className = 'bg-red-50 p-3 sm:p-4 rounded-2xl border border-red-200 flex justify-between items-center transition-colors';
    if (returnLabel) {
      returnLabel.textContent = 'Nedoplatek:';
      returnLabel.className = 'text-red-800 font-bold text-xs sm:text-sm';
    }
  }
}

/**
 * Tlačítko pro zadání přesné částky jedním kliknutím
 */
function quickCashExact() {
  const total = getCartTotal();
  const givenInput = document.getElementById('cash-given-input');
  if (givenInput) {
    givenInput.value = total;
    isNumpadFresh = true;
    updateCashReturn();
  }
}

/**
 * Rychlá volba konkrétní bankovky (50, 100, 200, 500)
 */
function quickCashValue(amount) {
  const givenInput = document.getElementById('cash-given-input');
  if (givenInput) {
    givenInput.value = amount;
    isNumpadFresh = true;
    updateCashReturn();
  }
}

/**
 * Dotykový vstup čísla z Numpadu (bez nutnosti zobrazovat softwarovou klávesnici mobilu/iPadu)
 */
function numpadInput(digit) {
  const givenInput = document.getElementById('cash-given-input');
  if (!givenInput) return;

  if (isNumpadFresh) {
    givenInput.value = digit;
    isNumpadFresh = false;
  } else {
    // Pokud je hodnota '0' a zadáváme další číslici, nahradíme ji
    if (givenInput.value === '0') {
      givenInput.value = digit;
    } else {
      givenInput.value += digit;
    }
  }

  updateCashReturn();
}

/**
 * Vymaže zadanou částku (tlačítko C)
 */
function numpadClear() {
  const givenInput = document.getElementById('cash-given-input');
  if (givenInput) {
    givenInput.value = '0';
    isNumpadFresh = true;
    updateCashReturn();
  }
}

/**
 * Smaže poslední zadanou číslici (tlačítko ⌫)
 */
function numpadBackspace() {
  const givenInput = document.getElementById('cash-given-input');
  if (!givenInput) return;

  if (isNumpadFresh) {
    givenInput.value = '0';
    isNumpadFresh = true;
  } else {
    const val = givenInput.value.slice(0, -1);
    givenInput.value = val === '' ? '0' : val;
  }

  updateCashReturn();
}

/**
 * Potvrzení platby hotově
 */
function confirmCashPayment() {
  const total = getCartTotal();
  const given = parseFloat(document.getElementById('cash-given-input').value) || 0;

  if (given < total) {
    const ok = confirm(`Částka od zákazníka (${given} Kč) je menší než celkový účet (${total} Kč). Chceš přesto dokončit platbu?`);
    if (!ok) return;
  }

  closeCashModal();

  // Zavřeme vysunovací košík na mobilu
  if (isMobileCartOpen) {
    toggleMobileCart(false);
  }

  completeOrder('cash');
}

/**
 * Spuštění aplikace po načtení DOMu
 */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializace zobrazení obsluhy
  updateCashierDisplay();

  // Vykreslení kategorií a produktů v pokladně
  renderCategories();
  renderProductGrid();
  renderCart();

  // Posluchač pro vyhledávací pole
  const searchInput = document.getElementById('product-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchProducts(e.target.value);
    });
  }

  // Posluchač pro formulář přidání produktu v administraci
  const addForm = document.getElementById('add-product-form');
  if (addForm) {
    addForm.addEventListener('submit', handleAddProduct);
  }

  // Posluchač pro ruční zadání do vstupu v kalkulačce
  const cashInput = document.getElementById('cash-given-input');
  if (cashInput) {
    cashInput.addEventListener('input', () => {
      isNumpadFresh = false;
      updateCashReturn();
    });
  }

  // Automatické přizpůsobení při změně orientace iPadu / změně velikosti okna
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && isMobileCartOpen) {
      toggleMobileCart(false);
    }
  });

  // Zavření modálních oken klávesou Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCashModal();
      if (typeof closeEditOrderModal === 'function') {
        closeEditOrderModal();
      }
    }
  });

  console.log('✅ Školní Bufet POS inicializován (mobil & iPad ready).');
});
