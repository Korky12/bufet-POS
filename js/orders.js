/**
 * orders.js
 * Dokončování objednávek (platby hotově / kartou), ukládání historie a výpočet tržeb.
 */

/**
 * Načte historii objednávek z localStorage
 */
function getOrders() {
  const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch (e) {
    console.error('Chyba při čtení objednávek:', e);
    return [];
  }
}

/**
 * Uloží pole objednávek do localStorage
 */
function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
}

/**
 * Dokončí objednávku a uloží ji do historie
 */
function completeOrder(paymentMethod) {
  if (cart.length === 0) {
    alert('Účet je prázdný, nelze provést platbu.');
    return;
  }

  const cashierName = localStorage.getItem(STORAGE_KEYS.CASHIER) || 'Obsluha';
  const total = getCartTotal();

  const newOrder = {
    id: Date.now(),
    date: new Date().toISOString(),
    formattedTime: new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    formattedDate: new Date().toLocaleDateString('cs-CZ'),
    paymentMethod: paymentMethod, // 'cash' | 'card'
    cashier: cashierName,
    items: [...cart],
    totalPrice: total
  };

  const orders = getOrders();
  orders.unshift(newOrder); // Nové objednávky nahoru
  saveOrders(orders);

  // Zvukový nebo vizuální efekt
  const methodLabel = paymentMethod === 'cash' ? 'HOTOVĚ' : 'KARTOU';
  
  // Vyčistíme košík bez nutnosti potvrzení
  clearCart(false);

  // Informační zpráva o úspěšném zaplacení
  showToast(`✅ Objednávka za ${total} Kč zaplacena (${methodLabel})`);

  // Pokud je otevřená záložka s historií, překreslíme ji
  renderHistory();
}

/**
 * Spočítá celkovou tržbu (celkem, hotově, kartou)
 */
function calculateStats() {
  const orders = getOrders();

  let cashTotal = 0;
  let cardTotal = 0;

  orders.forEach(order => {
    if (order.paymentMethod === 'cash') {
      cashTotal += order.totalPrice;
    } else if (order.paymentMethod === 'card') {
      cardTotal += order.totalPrice;
    }
  });

  return {
    orderCount: orders.length,
    cashTotal,
    cardTotal,
    grandTotal: cashTotal + cardTotal
  };
}

/**
 * Vykreslí přehled tržeb a historii účtenek
 */
function renderHistory() {
  const statsContainer = document.getElementById('history-stats');
  const listContainer = document.getElementById('orders-list');
  if (!statsContainer || !listContainer) return;

  const stats = calculateStats();
  const orders = getOrders();

  // 1. Zobrazení souhrnných statistik v kartách
  statsContainer.innerHTML = `
    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div>
        <p class="text-xs uppercase font-semibold text-slate-500">Celkový obrat</p>
        <p class="text-2xl font-black text-slate-900 font-mono mt-1">${stats.grandTotal} Kč</p>
      </div>
      <span class="text-3xl bg-indigo-50 p-3 rounded-xl">💰</span>
    </div>

    <div class="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
      <div>
        <p class="text-xs uppercase font-semibold text-emerald-600">Tržba Hotovost</p>
        <p class="text-2xl font-black text-emerald-600 font-mono mt-1">${stats.cashTotal} Kč</p>
      </div>
      <span class="text-3xl bg-emerald-50 p-3 rounded-xl">💵</span>
    </div>

    <div class="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
      <div>
        <p class="text-xs uppercase font-semibold text-blue-600">Tržba Kartou</p>
        <p class="text-2xl font-black text-blue-600 font-mono mt-1">${stats.cardTotal} Kč</p>
      </div>
      <span class="text-3xl bg-blue-50 p-3 rounded-xl">💳</span>
    </div>

    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div>
        <p class="text-xs uppercase font-semibold text-slate-500">Objednávek celkem</p>
        <p class="text-2xl font-black text-slate-700 font-mono mt-1">${stats.orderCount}</p>
      </div>
      <span class="text-3xl bg-slate-50 p-3 rounded-xl">🧾</span>
    </div>
  `;

  // 2. Seznam účtenek
  if (orders.length === 0) {
    listContainer.innerHTML = `
      <div class="p-8 text-center text-slate-400">
        <span class="text-4xl block mb-2">📜</span>
        <p class="font-medium">Zatím nebyly provedeny žádné prodeje</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = orders.map(order => {
    const isCash = order.paymentMethod === 'cash';
    const badgeClass = isCash 
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
      : 'bg-blue-100 text-blue-800 border-blue-300';
    const methodText = isCash ? 'Hotově 💵' : 'Karta 💳';

    const itemsSummary = order.items
      .map(i => `${i.quantity}× ${i.name}`)
      .join(', ');

    return `
      <div class="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-bold text-slate-800">Účtenka #${order.id.toString().slice(-4)}</span>
            <span class="text-xs px-2 py-0.5 rounded-full font-bold border ${badgeClass}">
              ${methodText}
            </span>
            <span class="text-xs text-slate-400">${order.formattedDate} v ${order.formattedTime}</span>
          </div>
          <p class="text-sm text-slate-600 line-clamp-1">${itemsSummary}</p>
          <p class="text-xs text-slate-400 mt-0.5">Obsluha: ${order.cashier || 'Neznámý'}</p>
        </div>

        <div class="text-right flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
          <div class="text-xl font-black text-slate-900 font-mono">${order.totalPrice} Kč</div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Vynuluje celou historii tržeb (pro nový den/směnu)
 */
function resetHistory() {
  const ok = confirm('Opravdu chceš vymazat historii prodejů a začít novou směnu/den?');
  if (ok) {
    saveOrders([]);
    renderHistory();
    showToast('Historie tržeb byla vynulována.');
  }
}
