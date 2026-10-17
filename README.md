# 🏫 Školní Bufet POS – Klientská Pokladna (Mobil, iPad & PC)

Jednoduchý, přehledný a bleskurychlý pokladní systém navržený speciálně pro dotykové tablety (**iPad**), chytré telefony (**mobil**) i běžné počítače ve školním bufetu. Vzhled a ergonomie jsou inspirovány moderními pokladnami jako **Storyous POS**.

---

## 📱 Nová vylepšení pro Mobil a iPad

1. **Mobilní vysouvací účet (Bottom Sheet):**
   - Na telefonu nezabírá účet drahocenné místo. Celá obrazovka patří nabídce produktů.
   - Ve spodní části plave přehledný proužek s počtem kusů a částkou k úhradě.
   - Klepnutím se plynule vysune kompletní účet s velkými tlačítky pro úpravu množství a dokončení platby.
2. **Přizpůsobení pro iPad (na výšku i na šířku):**
   - Na iPadu je rozložení dvou-sloupcové (produkty vlevo, účet vpravo) s optimálním poměrem šířek a velkými dotykovými kartami.
3. **Dotyková kalkulačka pro platbu hotově (Numpad):**
   - Přímo v dialogu platby je k dispozici velký dotykový numerický blok (1–9, C, 0, ⌫), tlačítko *Přesně* a rychlé bankovky (50, 100, 200, 500 Kč).
   - Obsluha **nemusí čekat na zobrazení systémové klávesnice telefonu/iPadu** a vše vyřídí během 2 vteřin jedním prstem.
4. **Spodní lišta pro telefony:**
   - Na mobilu jsou hlavní záložky (*Pokladna*, *Tržby*, *Ceník*) umístěny dole přímo pod palcem obsluhy, včetně indikátoru počtu položek v košíku.
5. **Ergonomie dotyku & Safe Areas:**
   - Podpora pro výřezy a zaoblené rohy displejů (iOS Safe Areas: `env(safe-area-inset-...)`).
   - Odstraněno 300ms zpoždění dotyku (`touch-action: manipulation`).
   - Všechny ovládací prvky mají minimální dotykovou výšku 44–48 px.

---

## 📁 Rozdělení do souborů a složek

```text
bufet POS/
├── index.html          # Responzivní HTML struktura aplikace (Tailwind CSS CDN)
├── server.js           # Lokální server pro sdílení účtenek v síti (bez externích npm knihoven)
│
├── data/
│   └── orders.json     # Sdílená databáze účtenek na serveru
│
├── css/
│   └── style.css       # Touch styly, safe-areas, animace a velikost tlačítek pro dotykové obrazovky
│
└── js/
    ├── data.js         # Výchozí produkty bufetu, kategorie a ukládání do paměti (localStorage)
    ├── cart.js         # Logika otevřeného účtu (přidání, odebrání, změna ceny, mobilní lišta a indikátory)
    ├── pos.js          # Mřížka produktů, filtry kategorií a rychlé dotykové hledání
    ├── orders.js       # Účtenky: sdílení se serverem v reálném čase (SSE), storno, úpravy a tržby
    ├── admin.js        # Správa ceníku (přidávání nových produktů a mazání)
    └── app.js          # Navigace (desktop i mobil), vysouvací panel a dotykový Numpad kalkulačky
```

---

## 🚀 Jak aplikaci spustit

### Možnost 1: Spuštění přes Node.js server (doporučeno pro provoz v bufetu)
Otevři terminál ve složce projektu a zadej:
```bash
node server.js
```
Server ti do terminálu vypíše adresy:
- **Na počítači:** otevři v prohlížeči `http://localhost:3000`
- **Na iPadu nebo mobilu:** otevři vypsanou IP adresu (např. `http://192.168.1.50:3000`), pokud je zařízení na stejné Wi-Fi.

### Možnost 2: Přímé otevření v prohlížeči
Stačí poklikat na soubor `index.html` a otevře se přímo ve tvém webovém prohlížeči.

---

## 🛠️ Jak si kód upravit sám

### 1. Změna výchozích produktů a cen
V souboru `js/data.js` v poli `DEFAULT_PRODUCTS`:
```javascript
{ id: 1, name: 'Kuřecí bageta', price: 55, category: 'pecivo', icon: '🥖' },
{ id: 2, name: 'Kofola 0.5l', price: 30, category: 'napoje', icon: '🥤' }
```

### 2. Přidání nové kategorie
V souboru `js/data.js` v poli `DEFAULT_CATEGORIES`:
```javascript
{ id: 'teple', name: 'Teplá jídla', icon: '🍲' }
```
