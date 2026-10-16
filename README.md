# 🏫 Školní Bufet POS – Klientská Pokladna

Jednoduchý, přehledný a rychlý pokladní systém navržený pro dotykové tablety, mobily a počítače ve školním bufetu. Inspirováno rozhraním **Storyous POS**.

---

## 📁 Rozdělení do souborů a složek

Kód je rozdělený tak, aby byl co nejjednodušší a snadno upravitelný:

```text
bufet POS/
├── index.html          # Hlavní HTML struktura aplikace (Storyous vzhled, Tailwind CSS)
├── server.js           # Lokální server pro spuštění na počítači i tabletu v síti (bez instalace npm balíčků)
│
├── css/
│   └── style.css       # Vlastní styly, animace a velikost tlačítek pro dotykové obrazovky
│
└── js/
    ├── data.js         # Výchozí produkty bufetu, kategorie a ukládání do paměti (localStorage)
    ├── cart.js         # Logika otevřeného účtu (přidání, odebrání, změna ceny, mezisoučet)
    ├── pos.js          # Vykreslování mřížky produktů, filtry kategorií a hledání
    ├── orders.js       # Dokončení objednávky (hotově / kartou), historie účtenek a tržby
    ├── admin.js        # Jednoduchá správa ceníku (přidávání nových produktů a mazání)
    └── app.js          # Hlavní spuštění, navigace mezi záložkami a kalkulačka na vrácení peněz
```

---

## 🚀 Jak aplikaci spustit

Máš **dvě velmi snadné možnosti**:

### Možnost 1: Spuštění přes Node.js server (doporučeno pro tablet v bufetu)
Otevři terminál ve složce projektu a zadej:
```bash
node server.js
```
Server ti do terminálu vypíše adresy:
- **Na počítači:** otevři v prohlížeči `http://localhost:3000`
- **Na tabletu nebo mobilu:** otevři vypsanou IP adresu (např. `http://192.168.1.50:3000`), pokud je tablet na stejné Wi-Fi.

### Možnost 2: Přímé otevření v prohlížeči
Stačí poklikat na soubor `index.html` a otevře se přímo ve tvém webovém prohlížeči (nevyžaduje spuštěný server).

---

## 🛠️ Jak si kód upravit sám

### 1. Změna výchozích produktů a cen
Otevři soubor `js/data.js`. Na začátku najdeš pole `DEFAULT_PRODUCTS`:
```javascript
{ id: 1, name: 'Kuřecí bageta', price: 55, category: 'pecivo', icon: '🥖' },
{ id: 2, name: 'Kofola 0.5l', price: 30, category: 'napoje', icon: '🥤' }
```
Zde můžeš změnit názvy, výchozí ceny i emoji ikony.

### 2. Přidání nové kategorie
V souboru `js/data.js` v poli `DEFAULT_CATEGORIES` můžeš přidat další kategorii:
```javascript
{ id: 'teple', name: 'Teplá jídla', icon: '🍲' }
```

### 3. Úprava vzhledu a barev
- V `index.html` jsou použity třídy Tailwind CSS (např. `bg-slate-900`, `bg-emerald-600` pro hotovost, `bg-indigo-600` pro kartu).
- V `css/style.css` můžeš upravovat minimální výšku tlačítek (`min-height: 48px`), stíny nebo efekty stisknutí.

---

## ✨ Klíčové funkce v tomto základu
1. **Dotykové rozhraní:** Velká tlačítka (min. 48px), rychlé reakce bez zpoždění.
2. **Kalkulačka na vrácení:** Při platbě hotově stačí kliknout na bankovku (100, 200, 500 Kč) a systém ihned spočítá, kolik vrátit zákazníkovi.
3. **Úprava ceny IRL:** Kliknutím na cenu položky v otevřeném účtu lze částku rychle upravit (např. pro slevu).
4. **Tržby & Historie:** Statistiky tržeb rozdělené na hotovost a kartu s možností vynulování pro nový den.
5. **Správa produktů:** Možnost přidávat nové produkty přímo v rozhraní i bez sahání do kódu.
