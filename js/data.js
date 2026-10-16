/**
 * data.js
 * Správa dat: výchozí produkty, kategorie a ukládání do localStorage.
 * Uživatel si může data snadno upravit přímo zde v kódu.
 */

// Výchozí kategorie pro filtrování
const DEFAULT_CATEGORIES = [
  { id: 'all', name: 'Vše', icon: '🧺' },
  { id: 'pecivo', name: 'Pečivo', icon: '🥐' },
  { id: 'napoje', name: 'Nápoje', icon: '🥤' },
  { id: 'sladke', name: 'Sladkosti', icon: '🍫' },
  { id: 'slane', name: 'Slané', icon: '🥪' }
];

// Výchozí nabídka bufetu
const DEFAULT_PRODUCTS = [
  { id: 1, name: 'Kuřecí bageta', price: 55, category: 'pecivo', icon: '🥖' },
  { id: 2, name: 'Čerstvý croissant', price: 25, category: 'pecivo', icon: '🥐' },
  { id: 3, name: 'Kobliha s marmeládou', price: 20, category: 'pecivo', icon: '🍩' },
  { id: 4, name: 'Minerálka neperlivá 0.5l', price: 18, category: 'napoje', icon: '💧' },
  { id: 5, name: 'Kofola 0.5l', price: 30, category: 'napoje', icon: '🥤' },
  { id: 6, name: 'Ovocný čaj', price: 15, category: 'napoje', icon: '🧃' },
  { id: 7, name: 'Toast šunka & sýr', price: 42, category: 'slane', icon: '🥪' },
  { id: 8, name: 'Brambůrky solené', price: 28, category: 'slane', icon: '🥔' },
  { id: 9, name: 'Horalka', price: 16, category: 'sladke', icon: '🍫' },
  { id: 10, name: 'Ovocná tyčinka', price: 22, category: 'sladke', icon: '🍎' },
  { id: 11, name: 'Čokoláda mléčná', price: 25, category: 'sladke', icon: '🍫' },
  { id: 12, name: 'Žvýkačky Orbit', price: 18, category: 'sladke', icon: '🍬' }
];

const STORAGE_KEYS = {
  PRODUCTS: 'bufet_pos_products',
  ORDERS: 'bufet_pos_orders',
  CASHIER: 'bufet_pos_cashier'
};

/**
 * Načte produkty z localStorage. Pokud ještě neexistují, použije výchozí.
 */
function getProducts() {
  const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
  if (!saved) {
    saveProducts(DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  }
  try {
    return JSON.parse(saved);
  } catch (e) {
    console.error('Chyba při čtení produktů:', e);
    return DEFAULT_PRODUCTS;
  }
}

/**
 * Uloží pole produktů do localStorage.
 */
function saveProducts(products) {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
}

/**
 * Obnoví produkty na původní výchozí hodnoty.
 */
function resetDefaultProducts() {
  saveProducts(DEFAULT_PRODUCTS);
  return DEFAULT_PRODUCTS;
}

/**
 * Získá seznam kategorií.
 */
function getCategories() {
  return DEFAULT_CATEGORIES;
}
