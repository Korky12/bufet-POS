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

// Verze výchozích produktů – zvyš při změně struktury nebo obsahu DEFAULT_PRODUCTS,
// aby se uživatelům automaticky načetla nová verze místo staré z localStorage
const DEFAULT_PRODUCTS_VERSION = 2;

// Výchozí nabídka bufetu
const DEFAULT_PRODUCTS = [
  { id: 1, name: 'Perlivá voda', price: 15, category: 'napoje', icon: '🥖' },
  { id: 2, name: 'Neperlivá voda', price: 15, category: 'napoje', icon: '🥐' },
  { id: 3, name: 'Coca-cola', price: 35, category: 'napoje', icon: '🍩' },
  { id: 4, name: 'Coca-cola zero', price: 35, category: 'napoje', icon: '💧' },
  { id: 5, name: 'Kofola', price: 35, category: 'napoje', icon: '🥤' },
  { id: 6, name: 'Capri-sun', price: 18, category: 'napoje', icon: '🧃' },
  { id: 7, name: 'Sprite', price: 35, category: 'napoje', icon: '�' },
  { id: 8, name: 'Horalka', price: 15, category: 'sladke', icon: '🥔' },
  { id: 9, name: 'Kinder Bueno', price: 25, category: 'sladke', icon: '🍫' },
  { id: 10, name: 'Kit Kat', price: 20, category: 'sladke', icon: '🍎' },
  { id: 11, name: 'Corny tyčinky', price: 18, category: 'sladke', icon: '🍫' },
  { id: 12, name: 'Žvýkačky Orbit', price: 20, category: 'sladke', icon: '🍬' },
  { id: 13, name: 'Emco sušenky', price: 25, category: 'sladke', icon: '🥨' },
  { id: 14, name: 'Delisa kokos', price: 15, category: 'sladke', icon: '🥔' },
  { id: 15, name: 'Brambůrky', price: 20, category: 'slane', icon: '🍫' },
  { id: 16, name: 'Ondrášovka', price: 20, category: 'napoje', icon: '🥨' },
  { id: 17, name: 'domácí limonády', price: 55, category: 'napoje', icon: '🥖' },
  { id: 18, name: 'Ledový čaj', price: 30, category: 'napoje', icon: '🥐' },
  { id: 19, name: 'Kapesníky', price: 5, category: 'all', icon: '🍩' },
  { id: 20, name: 'Fidorky', price: 18, category: 'sladke', icon: '💧' },
  { id: 21, name: 'brambůrky', price: 20, category: 'slane', icon: '🥤' },
  { id: 22, name: 'preclíky', price: 20, category: 'slane', icon: '🧃' },
  { id: 23, name: 'TUC Sušenky', price: 20, category: 'slane', icon: '' },
  { id: 24, name: 'Tyčinky', price: 25, category: 'slane', icon: '🥤' },
];

const STORAGE_KEYS = {
  PRODUCTS: 'bufet_pos_products',
  PRODUCTS_VERSION: 'bufet_pos_products_version',
  ORDERS: 'bufet_pos_orders',
  CASHIER: 'bufet_pos_cashier',
  TOKEN: 'bufet_pos_token'
};

/**
 * Načte produkty z localStorage. Pokud ještě neexistují nebo je stará verze,
 * použije výchozí a uloží novou verzi.
 */
function getProducts() {
  const savedVersion = localStorage.getItem(STORAGE_KEYS.PRODUCTS_VERSION);
  const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);

  // Pokud verze neodpovídá nebo data chybí, použij výchozí
  if (!saved || !savedVersion || parseInt(savedVersion, 10) !== DEFAULT_PRODUCTS_VERSION) {
    saveProducts(DEFAULT_PRODUCTS);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, String(DEFAULT_PRODUCTS_VERSION));
    return DEFAULT_PRODUCTS;
  }

  try {
    return JSON.parse(saved);
  } catch (e) {
    console.error('Chyba při čtení produktů:', e);
    saveProducts(DEFAULT_PRODUCTS);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, String(DEFAULT_PRODUCTS_VERSION));
    return DEFAULT_PRODUCTS;
  }
}

/**
 * Uloží pole produktů do localStorage spolu s aktuální verzí.
 */
function saveProducts(products) {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  localStorage.setItem(STORAGE_KEYS.PRODUCTS_VERSION, String(DEFAULT_PRODUCTS_VERSION));
}

/**
 * Obnoví produkty na původní výchozí hodnoty.
 */
function resetDefaultProducts() {
  saveProducts(DEFAULT_PRODUCTS);
  // Verze se nastaví uvnitř saveProducts
  return DEFAULT_PRODUCTS;
}

/**
 * Získá seznam kategorií.
 */
function getCategories() {
  return DEFAULT_CATEGORIES;
}
