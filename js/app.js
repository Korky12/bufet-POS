/**
 * app.js
 * Hlavní inicializace aplikace, přepínání záložek, dialog platby hotově s výpočtem vrácení peněz.
 */

// Aktuálně aktivní záložka ('pos' | 'history' | 'admin')
let currentTab = 'pos';

/**
 * Přepínání mezi záložkami (Pokladna, Historie, Správa)
 */
function switchTab(tabName) {
  currentTab = tabName;

  // Skryjeme všechny sekce
  document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));

  // Zobrazíme vybranou
  const activeSection = document.getElementById(`tab-${tabName}`);
  if (activeSection) {
    activeSection.classList.remove('hidden');
  }

  // Aktualizujeme stav tlačítek v navigaci
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

  // Překreslíme data pro danou záložku
  if (tabName === 'history') {
    renderHistory();
  } else if (tabName === 'admin') {
    renderAdminProducts();
  } else if (tabName === 'pos') {
    renderProductGrid();
    renderCart();
  }
}

/**
 * Změna jména přihlášené obsluhy
 */
function changeCashierName() {
  const current = localStorage.getItem(STORAGE_KEYS.CASHIER) || 'Obsluha';
  const name = prompt('Zadej jméno nebo přezdívku obsluhy:', current);
  if (name && name.trim()) {
    localStorage.setItem(STORAGE_KEYS.CASHIER, name.trim());
    updateCashierDisplay();
    showToast(`Přihlášen(a): ${name.trim()}`);
  }
}

function updateCashierDisplay() {
  const name = localStorage.getItem(STORAGE_KEYS.CASHIER) || 'Jakub (Obsluha)';
  const el = document.getElementById('cashier-name-display');
  if (el) {
    el.textContent = name;
  }
}

/**
 * Vyskakovací notifikace (Toast)
 */
function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl transition-all duration-300 font-medium text-sm flex items-center gap-2 transform translate-y-10 opacity-0 pointer-events-none';
    document.body.appendChild(toast);
  }

  toast.innerHTML = message;
  toast.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');

  setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
  }, 2600);
}

/**
 * Dialog pro platbu hotově (s rychlým výpočtem na vrácení peněz)
 */
function openCashModal() {
  const total = getCartTotal();
  if (total <= 0) return;

  const modal = document.getElementById('cash-modal');
  const modalTotal = document.getElementById('cash-modal-total');
  const givenInput = document.getElementById('cash-given-input');
  const returnAmount = document.getElementById('cash-return-amount');

  modalTotal.textContent = `${total} Kč`;
  givenInput.value = total;
  returnAmount.textContent = '0 Kč';

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Automaticky zaostřit vstup
  setTimeout(() => givenInput.focus(), 100);
}

function closeCashModal() {
  const modal = document.getElementById('cash-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function updateCashReturn() {
  const total = getCartTotal();
  const given = parseFloat(document.getElementById('cash-given-input').value) || 0;
  const returnEl = document.getElementById('cash-return-amount');
  const diff = given - total;

  if (diff >= 0) {
    returnEl.textContent = `${diff} Kč`;
    returnEl.className = 'text-2xl font-black font-mono text-emerald-600';
  } else {
    returnEl.textContent = `Chybí ${Math.abs(diff)} Kč`;
    returnEl.className = 'text-2xl font-black font-mono text-red-500';
  }
}

function quickCashValue(amount) {
  const givenInput = document.getElementById('cash-given-input');
  givenInput.value = amount;
  updateCashReturn();
}

function confirmCashPayment() {
  const total = getCartTotal();
  const given = parseFloat(document.getElementById('cash-given-input').value) || 0;

  if (given < total) {
    const ok = confirm(`Částka od zákazníka (${given} Kč) je menší než účet (${total} Kč). Chceš přesto pokračovat?`);
    if (!ok) return;
  }

  closeCashModal();
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

  // Posluchač pro vstup v kalkulačce vrácení peněz
  const cashInput = document.getElementById('cash-given-input');
  if (cashInput) {
    cashInput.addEventListener('input', updateCashReturn);
  }

  console.log('✅ Školní Bufet POS inicializován.');
});
