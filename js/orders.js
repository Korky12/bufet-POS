/**
 * orders.js
 * Dokončování objednávek (platby hotově / kartou), ukládání historie a výpočet tržeb.
 * Umožňuje sdílení účtenek na serveru v reálném čase mezi všemi zařízeními (mobily, tablety, PC).
 * Podporuje stornování po jedné, obnovení, trvalé mazání i úpravy účtenek.
 * Žádné externí knihovny – čistý nativní JavaScript (Fetch API + Server-Sent Events).
 */

// Aktuální filtr zobrazení účtenek v historii ('all' | 'valid' | 'cancelled')
let currentHistoryFilter = 'all';

// Právě upravovaná účtenka v modálním okně
let currentEditingOrder = null;

// Mezipaměť objednávek v paměti pro okamžité vykreslení
let cachedOrders = null;

// Příznak stavu spojení se serverem
let isServerOnline = false;

// Instance SSE pro real-time odběr změn ze serveru
let sseClient = null;

// Ochrana proti zacyklení synchronizace
let isSyncingToServer = false;

/**
 * Načte historii objednávek (z paměti / localStorage)
 */
function getOrders() {
  if (cachedOrders !== null) {
    return cachedOrders;
  }
  const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
  if (!saved) {
    cachedOrders = [];
    return cachedOrders;
  }
  try {
    cachedOrders = JSON.parse(saved);
    return cachedOrders;
  } catch (e) {
    console.error('Chyba při čtení objednávek z localStorage:', e);
    cachedOrders = [];
    return cachedOrders;
  }
}

/**
 * Uloží pole objednávek do paměti, localStorage a synchronizuje se serverem
 */
function saveOrders(orders, syncWithServer = true) {
  cachedOrders = orders;
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

  if (syncWithServer) {
    pushOrdersToServer(orders);
  }
}

/* ========================================================= */
/* SYNCHRONIZACE SE SERVEREM (Sdílení mezi mobily, tablety, PC) */
/* ========================================================= */

/**
 * Vrátí základní URL serverového API.
 * Pokud aplikace běží přes http/https, použije relativní cestu.
 * Pokud byla otevřena přímo jako soubor (file:///), zkusí lokální server na portu 3000.
 */
function getApiBaseUrl() {
  if (window.location.protocol.startsWith('http')) {
    return '';
  }
  return 'http://localhost:3000';
}

/**
 * Načte aktuální seznam účtenek ze serveru přes REST API
 */
async function fetchOrdersFromServer() {
  if (isSyncingToServer) return;

  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/orders`, {
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const serverOrders = await res.json();

    if (!Array.isArray(serverOrders)) return;

    updateServerStatus(true);

    // Pokud je server prázdný, ale v lokální paměti již máme existující účtenky, nahrajeme je na server
    const localOrders = getOrders();
    if (serverOrders.length === 0 && localOrders.length > 0) {
      await pushOrdersToServer(localOrders);
      return;
    }

    applyServerOrders(serverOrders);
  } catch (err) {
    updateServerStatus(false);
  }
}

/**
 * Aplikuje účtenky přijaté ze serveru do lokálního stavu
 */
function applyServerOrders(serverOrders) {
  const currentOrders = getOrders();
  const currentStr = JSON.stringify(currentOrders);
  const serverStr = JSON.stringify(serverOrders);

  if (currentStr !== serverStr) {
    const hadCount = currentOrders.length;
    const newCount = serverOrders.length;

    cachedOrders = serverOrders;
    localStorage.setItem(STORAGE_KEYS.ORDERS, serverStr);

    // Pokud je uživatel uprostřed editace účtenky, nepřerušujeme mu rozepsaný formulář
    if (currentEditingOrder) {
      return;
    }

    // Upozornění obsluhy, pokud mezitím přibyla nová účtenka z jiného zařízení
    if (newCount > hadCount && hadCount > 0) {
      showToast('📥 Nová účtenka z jiného zařízení');
    }

    renderHistory();
  }
}

/**
 * Odešle aktuální stav účtenek na server k uložení do data/orders.json
 */
async function pushOrdersToServer(orders) {
  const baseUrl = getApiBaseUrl();

  try {
    isSyncingToServer = true;
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orders)
    });

    if (res.ok) {
      updateServerStatus(true);
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    updateServerStatus(false);
    console.warn('Uložení na server selhalo, data uložena lokálně:', err.message);
  } finally {
    isSyncingToServer = false;
  }
}

/**
 * Inicializuje obousměrnou synchronizaci se serverem v reálném čase (SSE + polling fallback)
 */
function initOrdersServerSync() {
  // Prvotní stažení dat ze serveru
  fetchOrdersFromServer();

  const baseUrl = getApiBaseUrl();

  // 1. Reálný čas přes Server-Sent Events (SSE)
  if (window.EventSource) {
    try {
      if (sseClient) {
        sseClient.close();
      }
      sseClient = new EventSource(`${baseUrl}/api/orders/events`);

      sseClient.onopen = () => {
        updateServerStatus(true);
      };

      sseClient.onmessage = (event) => {
        if (!event.data) return;
        try {
          const serverOrders = JSON.parse(event.data);
          if (Array.isArray(serverOrders)) {
            updateServerStatus(true);
            applyServerOrders(serverOrders);
          }
        } catch (e) {
          console.error('Chyba při čtení SSE zprávy:', e);
        }
      };

      sseClient.onerror = () => {
        // Dočasný výpadek spojení, EventSource zkouší automatický reconnect
        updateServerStatus(false);
      };
    } catch (err) {
      console.warn('Inicializace SSE selhala, poběží záložní polling:', err);
    }
  }

  // 2. Záložní periodická kontrola každých 4 vteřiny
  setInterval(fetchOrdersFromServer, 4000);

  // 3. Okamžitá kontrola při návratu do okna (probuzení telefonu / iPadu ze spánku)
  window.addEventListener('focus', fetchOrdersFromServer);
  window.addEventListener('online', fetchOrdersFromServer);
}

/**
 * Zobrazí podrobnosti o stavu serveru a návod pro připojení po kliknutí na indikátor
 */
function showServerStatusInfo() {
  if (isServerOnline) {
    alert(
      '🟢 SERVER JE AKTIVNÍ A PŘIPOJEN\n\n' +
      '• Účtenky se ukládají na serveru do souboru data/orders.json.\n' +
      '• Veškeré změny (nové účtenky, storno, úpravy) se v reálném čase přenášejí na všechny připojené mobily, tablety a PC.\n\n' +
      'Pro připojení dalších zařízení (iPad, mobil) otevři v jejich prohlížeči IP adresu vypsanou v terminálu po spuštění node server.js.'
    );
  } else {
    const tryAgain = confirm(
      '🟠 POKLADNA JE V LOKÁLNÍM REŽIMU\n\n' +
      'Účtenky se nyní ukládají pouze v paměti tohoto zařízení.\n\n' +
      'Proč je pokladna v lokálním režimu?\n' +
      '1. Na počítači nebyl spuštěn server (v terminálu zadej: node server.js)\n' +
      '2. Pokud máš soubor otevřen přímo ze složky (file:///), otevři raději v prohlížeči adresu: http://localhost:3000\n' +
      '3. Na mobilu či tabletu zkontroluj připojení ke stejné Wi-Fi a správnou IP adresu serveru.\n\n' +
      'Chceš zkusit navázat spojení se serverem znovu?'
    );
    if (tryAgain) {
      fetchOrdersFromServer();
    }
  }
}

/**
 * Aktualizuje indikátory propojení se serverem v horní liště i v kartě Tržby
 */
function updateServerStatus(online) {
  isServerOnline = online;

  const pill = document.getElementById('server-status-pill');
  if (pill) {
    pill.onclick = showServerStatusInfo;
    pill.style.cursor = 'pointer';

    if (online) {
      pill.className = 'cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800 transition shadow-xs hover:bg-emerald-900 active:scale-95';
      pill.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span class="hidden xs:inline">Sdíleno</span>';
      pill.title = '🟢 Server aktivní – účtenky jsou v reálném čase sdíleny (klikni pro info)';
    } else {
      pill.className = 'cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-800 transition shadow-xs hover:bg-amber-900 active:scale-95';
      pill.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span><span class="hidden xs:inline">Lokálně</span>';
      pill.title = '🟠 Server nedostupný – klikni pro nápovědu';
    }
  }

  const historySync = document.getElementById('history-sync-status');
  if (historySync) {
    historySync.onclick = showServerStatusInfo;
    historySync.style.cursor = 'pointer';

    if (online) {
      historySync.innerHTML = '<button type="button" class="cursor-pointer inline-flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200 transition"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span><span>Sdíleno v síti</span></button>';
    } else {
      historySync.innerHTML = '<button type="button" class="cursor-pointer inline-flex items-center gap-1.5 text-[11px] text-amber-700 font-semibold bg-amber-50 hover:bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200 transition"><span>Lokální režim ℹ️</span></button>';
    }
  }
}

/* ========================================================= */
/* DOKONČENÍ A SPRÁVA OBJEDNÁVEK                            */
/* ========================================================= */

/**
 * Dokončí objednávku a uloží ji do historie i na server
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
    totalPrice: total,
    cancelled: false,
    cancelledAt: null,
    updatedAt: null
  };

  const orders = getOrders();
  orders.unshift(newOrder); // Nové objednávky nahoru
  saveOrders(orders, true); // Uloží lokálně a odešle na server

  const methodLabel = paymentMethod === 'cash' ? 'HOTOVĚ' : 'KARTOU';
  
  // Vyčistíme košík bez nutnosti potvrzení
  clearCart(false);

  // Zavřeme mobilní účet, pokud byl otevřen
  if (typeof toggleMobileCart === 'function') {
    toggleMobileCart(false);
  }

  // Informační zpráva o úspěšném zaplacení
  showToast(`✅ Účet za ${total} Kč zaplacen (${methodLabel})`);

  // Pokud je otevřená záložka s historií, překreslíme ji
  renderHistory();
}

/**
 * Spočítá celkovou tržbu (celkem, hotově, kartou).
 * Stornované účtenky jsou ze součtu tržeb vyloučeny!
 */
function calculateStats() {
  const orders = getOrders();

  let cashTotal = 0;
  let cardTotal = 0;
  let cancelledTotal = 0;
  let validCount = 0;
  let cancelledCount = 0;

  orders.forEach(order => {
    const isCancelled = Boolean(order.cancelled);
    const price = Number(order.totalPrice) || 0;

    if (isCancelled) {
      cancelledCount += 1;
      cancelledTotal += price;
    } else {
      validCount += 1;
      if (order.paymentMethod === 'cash') {
        cashTotal += price;
      } else if (order.paymentMethod === 'card') {
        cardTotal += price;
      }
    }
  });

  return {
    orderCount: orders.length,
    validCount,
    cancelledCount,
    cancelledTotal,
    cashTotal,
    cardTotal,
    grandTotal: cashTotal + cardTotal
  };
}

/**
 * Změna filtru výpisu účtenek ('all' | 'valid' | 'cancelled')
 */
function setHistoryFilter(filter) {
  currentHistoryFilter = filter;
  renderHistory();
}

/**
 * Stornuje konkrétní účtenku podle ID a synchronizuje se všemi zařízeními
 */
function cancelOrder(orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const orderNum = order.id.toString().slice(-4);
  const ok = confirm(`Opravdu si přeješ STORNOVAT účtenku #${orderNum} v hodnotě ${order.totalPrice} Kč?\n\nTato částka bude odečtena z celkové tržby.`);
  if (!ok) return;

  order.cancelled = true;
  order.cancelledAt = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  saveOrders(orders, true);

  renderHistory();
  showToast(`🚫 Účtenka #${orderNum} byla stornována (-${order.totalPrice} Kč)`);
}

/**
 * Obnoví dříve stornovanou účtenku zpět do platných a synchronizuje
 */
function restoreOrder(orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const orderNum = order.id.toString().slice(-4);
  order.cancelled = false;
  order.cancelledAt = null;
  saveOrders(orders, true);

  renderHistory();
  showToast(`↩️ Účtenka #${orderNum} byla obnovena jako platná (+${order.totalPrice} Kč)`);
}

/**
 * Trvale smaže účtenku z historie na všech zařízeních
 */
async function deleteOrderPermanently(orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  const orderNum = order.id.toString().slice(-4);
  const ok = confirm(`Trvale smazat účtenku #${orderNum} ze serveru i všech zařízení?\n\nTuto akci již nelze vzít zpět.`);
  if (!ok) return;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Lokálně vymažeme okamžitě
    const filtered = orders.filter(o => o.id !== orderId);
    cachedOrders = filtered;
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(filtered));

    renderHistory();
    showToast(`🗑️ Účtenka #${orderNum} byla trvale smazána`);
  } catch (err) {
    console.error('Chyba při mazání účtenky:', err);
    showToast('❌ Nepodařilo se smazat účtenku na serveru');
  }
}

/**
 * Vykreslí přehled tržeb a historii účtenek
 */
function renderHistory() {
  const statsContainer = document.getElementById('history-stats');
  const listContainer = document.getElementById('orders-list');
  const filterBadge = document.getElementById('history-filter-badge');
  if (!statsContainer || !listContainer) return;

  const stats = calculateStats();
  const orders = getOrders();

  // 1. Zobrazení souhrnných statistik v responzivních kartách (2x2 na mobilu, 4x1 na tabletu/PC)
  statsContainer.innerHTML = `
    <div class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
      <div>
        <p class="text-[10px] sm:text-xs uppercase font-semibold text-slate-500">Celkový obrat</p>
        <p class="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">${stats.grandTotal} Kč</p>
        <p class="text-[11px] text-slate-400 mt-0.5">${stats.validCount} ${stats.validCount === 1 ? 'platný prodej' : (stats.validCount < 5 && stats.validCount > 1 ? 'platné prodeje' : 'platných prodejů')}</p>
      </div>
      <span class="text-2xl sm:text-3xl bg-indigo-50 p-2 sm:p-2.5 rounded-xl">💰</span>
    </div>

    <div class="bg-white p-3 sm:p-4 rounded-2xl border border-emerald-100 shadow-xs flex items-center justify-between">
      <div>
        <p class="text-[10px] sm:text-xs uppercase font-semibold text-emerald-600">Tržba Hotově</p>
        <p class="text-xl sm:text-2xl font-black text-emerald-600 font-mono mt-0.5">${stats.cashTotal} Kč</p>
        <p class="text-[11px] text-emerald-600/70 mt-0.5">V pokladní zásuvce</p>
      </div>
      <span class="text-2xl sm:text-3xl bg-emerald-50 p-2 sm:p-2.5 rounded-xl">💵</span>
    </div>

    <div class="bg-white p-3 sm:p-4 rounded-2xl border border-blue-100 shadow-xs flex items-center justify-between">
      <div>
        <p class="text-[10px] sm:text-xs uppercase font-semibold text-blue-600">Tržba Kartou</p>
        <p class="text-xl sm:text-2xl font-black text-blue-600 font-mono mt-0.5">${stats.cardTotal} Kč</p>
        <p class="text-[11px] text-blue-600/70 mt-0.5">Na bankovním účtu</p>
      </div>
      <span class="text-2xl sm:text-3xl bg-blue-50 p-2 sm:p-2.5 rounded-xl">💳</span>
    </div>

    <div class="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
      <div>
        <p class="text-[10px] sm:text-xs uppercase font-semibold text-slate-500">Účtenek celkem</p>
        <p class="text-xl sm:text-2xl font-black text-slate-700 font-mono mt-0.5">${stats.validCount}</p>
        ${stats.cancelledCount > 0 
          ? `<p class="text-[11px] text-red-500 font-semibold mt-0.5">+ ${stats.cancelledCount} storno (${stats.cancelledTotal} Kč)</p>`
          : `<p class="text-[11px] text-slate-400 mt-0.5">Bez storen</p>`
        }
      </div>
      <span class="text-2xl sm:text-3xl bg-slate-50 p-2 sm:p-2.5 rounded-xl">🧾</span>
    </div>
  `;

  // 2. Aktualizace tlačítek filtru (Všechny, Platné, Stornované)
  const btnAll = document.getElementById('filter-btn-all');
  const btnValid = document.getElementById('filter-btn-valid');
  const btnCancelled = document.getElementById('filter-btn-cancelled');

  const filterBtns = [
    { btn: btnAll, id: 'all' },
    { btn: btnValid, id: 'valid' },
    { btn: btnCancelled, id: 'cancelled' }
  ];

  filterBtns.forEach(item => {
    if (!item.btn) return;
    if (item.id === currentHistoryFilter) {
      item.btn.className = 'px-2.5 py-1 font-bold rounded-lg transition bg-white text-slate-900 shadow-xs';
    } else {
      item.btn.className = 'px-2.5 py-1 font-bold rounded-lg transition text-slate-600 hover:text-slate-900';
    }
  });

  // Filtrování podle zvolené záložky
  let filteredOrders = orders;
  if (currentHistoryFilter === 'valid') {
    filteredOrders = orders.filter(o => !o.cancelled);
  } else if (currentHistoryFilter === 'cancelled') {
    filteredOrders = orders.filter(o => Boolean(o.cancelled));
  }

  if (filterBadge) {
    filterBadge.textContent = `${filteredOrders.length} ${filteredOrders.length === 1 ? 'účtenka' : (filteredOrders.length < 5 && filteredOrders.length > 1 ? 'účtenky' : 'účtenek')}`;
  }

  // 3. Seznam účtenek
  if (orders.length === 0) {
    listContainer.innerHTML = `
      <div class="p-8 sm:p-12 text-center text-slate-400">
        <span class="text-4xl sm:text-5xl block mb-2">📜</span>
        <p class="font-bold text-slate-700 text-base">Zatím nebyly provedeny žádné prodeje</p>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">Po zaplacení prvního účtu v pokladně se zde zobrazí výpis pro všechna zařízení</p>
      </div>
    `;
    return;
  }

  if (filteredOrders.length === 0) {
    listContainer.innerHTML = `
      <div class="p-8 sm:p-10 text-center text-slate-400">
        <span class="text-3xl sm:text-4xl block mb-2">🔍</span>
        <p class="font-bold text-slate-700 text-sm sm:text-base">Žádné účtenky neodpovídají vybranému filtru</p>
        <button onclick="setHistoryFilter('all')" class="mt-2 text-indigo-600 hover:text-indigo-800 text-xs sm:text-sm font-semibold underline">
          Zobrazit všechny účtenky (${orders.length})
        </button>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filteredOrders.map(order => {
    const isCash = order.paymentMethod === 'cash';
    const isCancelled = Boolean(order.cancelled);

    const badgeClass = isCash 
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
      : 'bg-blue-100 text-blue-800 border-blue-300';
    const methodText = isCash ? 'Hotově 💵' : 'Karta 💳';

    const itemsSummary = (order.items || [])
      .map(i => `${i.quantity}× ${i.name}`)
      .join(', ') || 'Žádné položky';

    const orderNum = order.id.toString().slice(-4);

    // Stornovaná účtenka
    if (isCancelled) {
      return `
        <div class="p-3 sm:p-4 bg-red-50/30 rounded-xl border border-red-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <span class="font-black text-slate-800 text-sm sm:text-base">Účtenka #${orderNum}</span>
              <span class="text-[11px] px-2 py-0.5 rounded-full font-bold border ${badgeClass} opacity-70">
                ${methodText}
              </span>
              <span class="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
                <span>🚫</span> <span>STORNOVÁNO</span>
              </span>
              ${order.cancelledAt ? `<span class="text-[11px] text-red-500 font-semibold">(${order.cancelledAt})</span>` : ''}
              <span class="text-xs text-slate-400 ml-auto md:ml-0">${order.formattedDate} v ${order.formattedTime}</span>
            </div>
            <p class="text-xs sm:text-sm text-slate-400 line-through line-clamp-2">${itemsSummary}</p>
            <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
              <span>Obsluha: ${order.cashier || 'Obsluha'}</span>
              ${order.updatedAt ? `<span class="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">✏️ Upraveno v ${order.updatedAt}</span>` : ''}
            </div>
          </div>

          <div class="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-2.5 md:pt-0">
            <div class="text-left md:text-right">
              <div class="text-xs text-slate-400 line-through font-mono leading-none">${order.totalPrice} Kč</div>
              <div class="text-base sm:text-lg font-black text-red-600 font-mono mt-0.5">0 Kč</div>
            </div>
            
            <div class="flex items-center gap-1.5">
              <button onclick="restoreOrder(${order.id})" 
                      class="touch-btn px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      title="Obnovit stornovanou účtenku do platných">
                <span>↩️</span>
                <span>Obnovit</span>
              </button>
              <button onclick="openEditOrderModal(${order.id})" 
                      class="touch-btn px-2.5 py-1.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      title="Upravit položky, platbu nebo obsluhu">
                <span>✏️</span>
                <span>Upravit</span>
              </button>
              <button onclick="deleteOrderPermanently(${order.id})" 
                      class="touch-btn px-2.5 py-1.5 bg-white hover:bg-red-50 active:bg-red-100 text-slate-400 hover:text-red-600 border border-slate-200 rounded-xl text-xs font-bold transition"
                      title="Trvale odstranit z databáze">
                <span>🗑️</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Platná (aktivní) účtenka
    return `
      <div class="p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
            <span class="font-black text-slate-800 text-sm sm:text-base">Účtenka #${orderNum}</span>
            <span class="text-[11px] px-2 py-0.5 rounded-full font-bold border ${badgeClass}">
              ${methodText}
            </span>
            ${order.updatedAt ? `<span class="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-semibold">✏️ Upraveno v ${order.updatedAt}</span>` : ''}
            <span class="text-xs text-slate-400 ml-auto md:ml-0">${order.formattedDate} v ${order.formattedTime}</span>
          </div>
          <p class="text-xs sm:text-sm text-slate-600 line-clamp-2">${itemsSummary}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Obsluha: ${order.cashier || 'Obsluha'}</p>
        </div>

        <div class="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-2.5 md:pt-0">
          <div class="text-lg sm:text-xl font-black text-slate-900 font-mono">${order.totalPrice} Kč</div>
          
          <div class="flex items-center gap-1.5">
            <button onclick="openEditOrderModal(${order.id})" 
                    class="touch-btn px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    title="Upravit položky, cenu, platbu nebo obsluhu">
              <span>✏️</span>
              <span>Upravit</span>
            </button>
            <button onclick="cancelOrder(${order.id})" 
                    class="touch-btn px-2.5 py-1.5 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    title="Stornovat tuto účtenku">
              <span>🚫</span>
              <span>Stornovat</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Vynuluje celou historii tržeb (pro nový den/směnu) a vymaže ji ze serveru
 */
async function resetHistory() {
  const ok = confirm('Opravdu chceš vymazat historii prodejů a začít novou směnu/den?\n\nHistorie bude vynulována na všech připojených zařízeních.');
  if (!ok) return;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Lokálně vyčistíme okamžitě pro rychlou odezvu
    cachedOrders = [];
    localStorage.setItem(STORAGE_KEYS.ORDERS, '[]');

    renderHistory();
    showToast('Historie tržeb byla vynulována na serveru i zařízeních.');
  } catch (err) {
    console.error('Chyba při vynulování historie:', err);
    showToast('❌ Nepodařilo se vynulovat historii na serveru');
    // Fallback: lokální vymazání
    saveOrders([], false);
    renderHistory();
  }
}


/* ========================================================= */
/* MODÁLNÍ OKNO: ÚPRAVA ÚČTENKY (Edit Order Modal)           */
/* ========================================================= */

/**
 * Otevře editační okno pro vybranou účtenku
 */
function openEditOrderModal(orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  // Hluboká kopie do dočasné proměnné pro úpravy
  currentEditingOrder = JSON.parse(JSON.stringify(order));
  // Zajištění výchozího stavu
  currentEditingOrder.cancelled = Boolean(currentEditingOrder.cancelled);
  if (!Array.isArray(currentEditingOrder.items)) {
    currentEditingOrder.items = [];
  }

  // Hlavička modálu
  const titleEl = document.getElementById('edit-modal-title');
  const subtitleEl = document.getElementById('edit-modal-subtitle');
  if (titleEl) {
    titleEl.innerHTML = `<span>🧾</span> Úprava účtenky #${currentEditingOrder.id.toString().slice(-4)}`;
  }
  if (subtitleEl) {
    subtitleEl.textContent = `${currentEditingOrder.formattedDate} v ${currentEditingOrder.formattedTime}`;
  }

  // Obsluha
  const cashierInput = document.getElementById('edit-order-cashier');
  if (cashierInput) {
    cashierInput.value = currentEditingOrder.cashier || 'Obsluha';
  }

  // Nastavení prvků modálu
  updateEditModalStatusBanner();
  updateEditModalPaymentButtons();
  populateEditProductSelect();
  renderEditOrderItems();

  // Zobrazení modálu
  const modal = document.getElementById('edit-order-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

/**
 * Zavře editační okno bez uložení změn
 */
function closeEditOrderModal() {
  currentEditingOrder = null;
  const modal = document.getElementById('edit-order-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

/**
 * Obsluha kliknutí na pozadí (backdrop) pro zavření modálu
 */
function handleEditModalBackdrop(event) {
  if (event.target && event.target.id === 'edit-order-modal') {
    closeEditOrderModal();
  }
}

/**
 * Aktualizuje stavový pruh účtenky v editačním modálu (Platná vs Stornováno)
 */
function updateEditModalStatusBanner() {
  const banner = document.getElementById('edit-modal-status-banner');
  if (!banner || !currentEditingOrder) return;

  if (currentEditingOrder.cancelled) {
    banner.className = 'p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-2';
    banner.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xl">🚫</span>
        <div>
          <span class="font-bold text-red-800 text-xs sm:text-sm block leading-tight">Účtenka je STORNOVANÁ</span>
          <span class="text-[11px] text-red-600 block">Nezapočítává se do tržeb</span>
        </div>
      </div>
      <button type="button" onclick="toggleEditOrderStatus()" 
              class="touch-btn px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold rounded-xl shrink-0 shadow-xs transition">
        ↩️ Obnovit platnost
      </button>
    `;
  } else {
    banner.className = 'p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2';
    banner.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xl">✅</span>
        <div>
          <span class="font-bold text-emerald-800 text-xs sm:text-sm block leading-tight">Platná účtenka</span>
          <span class="text-[11px] text-emerald-600 block">Započítává se do celkových tržeb</span>
        </div>
      </div>
      <button type="button" onclick="toggleEditOrderStatus()" 
              class="touch-btn px-3 py-1.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl shrink-0 shadow-xs transition">
        🚫 Označit jako Storno
      </button>
    `;
  }
}

/**
 * Přepne stav účtenky (Platná / Storno) přímo v editačním modálu
 */
function toggleEditOrderStatus() {
  if (!currentEditingOrder) return;

  currentEditingOrder.cancelled = !currentEditingOrder.cancelled;
  if (currentEditingOrder.cancelled) {
    currentEditingOrder.cancelledAt = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  } else {
    currentEditingOrder.cancelledAt = null;
  }

  updateEditModalStatusBanner();
  updateEditModalTotalDisplay();
}

/**
 * Zvýrazní tlačítko vybrané metody platby v editačním modálu
 */
function updateEditModalPaymentButtons() {
  const cashBtn = document.getElementById('edit-pay-cash');
  const cardBtn = document.getElementById('edit-pay-card');
  if (!cashBtn || !cardBtn || !currentEditingOrder) return;

  const isCash = currentEditingOrder.paymentMethod === 'cash';
  if (isCash) {
    cashBtn.className = 'touch-btn py-2.5 px-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-800 text-sm font-bold flex items-center justify-center gap-2 transition shadow-xs';
    cardBtn.className = 'touch-btn py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-semibold flex items-center justify-center gap-2 transition';
  } else {
    cashBtn.className = 'touch-btn py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-semibold flex items-center justify-center gap-2 transition';
    cardBtn.className = 'touch-btn py-2.5 px-3 rounded-xl border-2 border-indigo-600 bg-indigo-50 text-indigo-800 text-sm font-bold flex items-center justify-center gap-2 transition shadow-xs';
  }
}

/**
 * Nastaví způsob platby pro upravovanou účtenku
 */
function setEditPaymentMethod(method) {
  if (!currentEditingOrder) return;
  currentEditingOrder.paymentMethod = method;
  updateEditModalPaymentButtons();
}

/**
 * Naplní výběrový seznam produktů z aktuálního ceníku
 */
function populateEditProductSelect() {
  const select = document.getElementById('edit-order-product-select');
  if (!select) return;

  const products = getProducts();
  if (products.length === 0) {
    select.innerHTML = '<option value="">Žádné produkty v ceníku</option>';
    return;
  }

  select.innerHTML = products.map(p => `
    <option value="${p.id}">${p.icon || '📦'} ${p.name} (${p.price} Kč)</option>
  `).join('');
}

/**
 * Přidá vybraný produkt z ceníku do upravované účtenky
 */
function addSelectedProductToEditOrder() {
  if (!currentEditingOrder) return;
  const select = document.getElementById('edit-order-product-select');
  if (!select) return;

  const prodId = Number(select.value);
  const products = getProducts();
  const product = products.find(p => p.id === prodId);
  if (!product) return;

  if (!Array.isArray(currentEditingOrder.items)) {
    currentEditingOrder.items = [];
  }

  const existing = currentEditingOrder.items.find(i => i.id === product.id);
  if (existing) {
    existing.quantity = (Number(existing.quantity) || 0) + 1;
  } else {
    currentEditingOrder.items.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      quantity: 1,
      category: product.category || 'all'
    });
  }

  renderEditOrderItems();
}

/**
 * Vykreslí seznam položek v editačním modálu
 */
function renderEditOrderItems() {
  const container = document.getElementById('edit-order-items-list');
  const countLabel = document.getElementById('edit-order-items-count');
  if (!container || !currentEditingOrder) return;

  const items = currentEditingOrder.items || [];
  const count = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  if (countLabel) {
    countLabel.textContent = `${count} ${count === 1 ? 'položka' : (count < 5 && count > 1 ? 'položky' : 'položek')}`;
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
        <p class="text-xs sm:text-sm font-bold text-slate-600">Účtenka nemá žádné položky</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Vyber produkt níže a klikni na „Přidat“, nebo účtenku označ jako storno</p>
      </div>
    `;
    updateEditModalTotalDisplay();
    return;
  }

  container.innerHTML = items.map((item, index) => {
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 0;
    const itemTotal = itemPrice * itemQty;

    return `
      <div class="p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
        <div class="flex-1 min-w-0">
          <input type="text" value="${item.name}" 
                 onchange="updateEditItemName(${index}, this.value)"
                 class="w-full text-xs sm:text-sm font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 hover:border-slate-500 focus:border-indigo-500 focus:outline-none py-0.5" 
                 title="Upravit název položky">
          <div class="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
            <span>Cena za ks:</span>
            <input type="number" min="0" step="1" value="${itemPrice}" 
                   oninput="updateEditItemPrice(${index}, this.value)"
                   class="w-16 px-1.5 py-0.5 text-right font-mono font-bold bg-white border border-slate-300 rounded focus:border-indigo-500 focus:outline-none">
            <span>Kč</span>
          </div>
        </div>

        <!-- Množství (- / +) -->
        <div class="flex items-center bg-white rounded-lg p-0.5 border border-slate-200 shrink-0">
          <button type="button" onclick="changeEditItemQty(${index}, -1)" 
                  class="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold flex items-center justify-center text-sm transition"
                  title="Odebrat jeden kus">
            −
          </button>
          <span class="w-7 text-center font-bold text-slate-900 text-xs sm:text-sm font-mono">${itemQty}</span>
          <button type="button" onclick="changeEditItemQty(${index}, 1)" 
                  class="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold flex items-center justify-center text-sm transition"
                  title="Přidat jeden kus">
            +
          </button>
        </div>

        <!-- Celková cena za položku a smazání -->
        <div class="text-right flex items-center gap-1.5 shrink-0">
          <div id="edit-item-row-total-${index}" class="text-xs sm:text-sm font-black text-slate-900 font-mono whitespace-nowrap min-w-[50px] text-right">
            ${itemTotal} Kč
          </div>
          <button type="button" onclick="removeEditItem(${index})" 
                  class="w-7 h-7 rounded text-red-500 hover:text-red-700 hover:bg-red-50 active:scale-95 flex items-center justify-center transition"
                  title="Odstranit položku z účtenky">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateEditModalTotalDisplay();
}

/**
 * Změna množství položky v editačním modálu
 */
function changeEditItemQty(index, delta) {
  if (!currentEditingOrder || !currentEditingOrder.items[index]) return;
  currentEditingOrder.items[index].quantity = (Number(currentEditingOrder.items[index].quantity) || 0) + delta;
  if (currentEditingOrder.items[index].quantity <= 0) {
    currentEditingOrder.items.splice(index, 1);
  }
  renderEditOrderItems();
}

/**
 * Změna ceny položky v editačním modálu bez ztráty focusu inputu
 */
function updateEditItemPrice(index, value) {
  if (!currentEditingOrder || !currentEditingOrder.items[index]) return;
  const num = parseFloat(value);
  const cleanPrice = isNaN(num) ? 0 : Math.max(0, num);
  currentEditingOrder.items[index].price = cleanPrice;

  // Aktualizace řádkového součtu
  const rowTotalEl = document.getElementById(`edit-item-row-total-${index}`);
  if (rowTotalEl) {
    const itemQty = Number(currentEditingOrder.items[index].quantity) || 0;
    rowTotalEl.textContent = `${cleanPrice * itemQty} Kč`;
  }

  updateEditModalTotalDisplay();
}

/**
 * Změna názvu položky v editačním modálu
 */
function updateEditItemName(index, value) {
  if (!currentEditingOrder || !currentEditingOrder.items[index]) return;
  const name = value.trim();
  if (name) {
    currentEditingOrder.items[index].name = name;
  }
}

/**
 * Odstranění položky z upravované účtenky
 */
function removeEditItem(index) {
  if (!currentEditingOrder || !currentEditingOrder.items[index]) return;
  currentEditingOrder.items.splice(index, 1);
  renderEditOrderItems();
}

/**
 * Aktualizuje celkovou částku v zápatí editačního modálu
 */
function updateEditModalTotalDisplay() {
  const totalDisplay = document.getElementById('edit-modal-total-display');
  const origTotalDisplay = document.getElementById('edit-modal-orig-total');
  if (!totalDisplay || !currentEditingOrder) return;

  const currentTotal = (currentEditingOrder.items || []).reduce((sum, i) => {
    return sum + ((Number(i.price) || 0) * (Number(i.quantity) || 0));
  }, 0);

  if (currentEditingOrder.cancelled) {
    totalDisplay.innerHTML = `<span class="line-through text-slate-400 text-lg mr-2">${currentTotal} Kč</span><span class="text-red-400">0 Kč</span>`;
  } else {
    totalDisplay.textContent = `${currentTotal} Kč`;
  }

  // Zobrazení původní částky pro porovnání
  const orders = getOrders();
  const origOrder = orders.find(o => o.id === currentEditingOrder.id);
  if (origTotalDisplay) {
    if (origOrder && origOrder.totalPrice !== currentTotal) {
      origTotalDisplay.textContent = `(Původní částka: ${origOrder.totalPrice} Kč)`;
    } else {
      origTotalDisplay.textContent = '';
    }
  }
}

/**
 * Uloží upravenou účtenku zpět do localStorage, na server a aktualizuje zobrazení
 */
function saveEditedOrder() {
  if (!currentEditingOrder) return;

  const cashierInput = document.getElementById('edit-order-cashier');
  if (cashierInput) {
    currentEditingOrder.cashier = cashierInput.value.trim() || 'Obsluha';
  }

  const items = currentEditingOrder.items || [];
  if (items.length === 0 && !currentEditingOrder.cancelled) {
    const cancelNow = confirm('Účtenka neobsahuje žádné položky.\n\nChceš ji označit jako STORNOVANOU a uložit?');
    if (cancelNow) {
      currentEditingOrder.cancelled = true;
      currentEditingOrder.cancelledAt = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    } else {
      return;
    }
  }

  // Přepočítání finální celkové ceny
  const newTotal = items.reduce((sum, i) => sum + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0);
  currentEditingOrder.totalPrice = newTotal;
  currentEditingOrder.updatedAt = new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

  // Uložení do pole objednávek a odeslání na server
  const orders = getOrders();
  const index = orders.findIndex(o => o.id === currentEditingOrder.id);
  if (index !== -1) {
    orders[index] = currentEditingOrder;
    saveOrders(orders, true);
  }

  const orderNum = currentEditingOrder.id.toString().slice(-4);
  closeEditOrderModal();
  renderHistory();
  showToast(`✅ Účtenka #${orderNum} byla úspěšně upravena a uložena`);
}

// Spustíme synchronizaci se serverem po načtení dokumentu
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOrdersServerSync);
} else {
  initOrdersServerSync();
}
