# Školní Bufet POS – Specifikace projektu

## 1. Přehled projektu (Overview)
Jednoduchý webový pokladní systém (POS) určený výhradně pro obsluhu školního bufetu (studenti/spolužáci). 
Cílem systému je nahradit papírové bloky digitální pokladnou, zrychlit odbavení při přestávkách a udržovat přehled o tržbách.

**Design & UI Inspirace:** Storyous POS (tmavá/moderní lišta, přehledná mřížka produktů vlevo, účet/košík vpravo s velkými tlačítky pro dotykové ovládání).

---

## 2. Klíčové funkce (Core Features)

### A. Pokladní rozhraní (POS)
- Mřížka s kartami produktů (velký text, cena, kategorie).
- Rychlé filtrování podle kategorií (Nápoje, Pečivo, Sladkosti atd.).
- Pravý panel účtu:
  - Přidávání a odebírání položek ($+ / -$).
  - Výpočet celkové částky v real-time.
  - Tlačítka rychlé platby: **"HOTOVĚ"** a **"KARTOU"**.
  - Vyprázdnění / storno účtu.
  - Případné upravení ceny IRL pro potřeby

### B. Přehled tržeb & Historie
- Přehled všech dokončených objednávek.
- Souhrnné statistiky:
  - Celková tržba hotovost.
  - Celková tržba karta.
  - Celkový obrat celkem.
- Detailní výpis účtenek (čas, typ platby, seznam položek, cena).

### C. Správa Menu & Ceníku (Administrace)
- Přidávání nových produktů (Název, Cena, Kategorie).
- Úprava cen a mazání položek.
- Správa kategorií.

### D. Uživatelé & Přihlášení
- Přihlašovací obrazovka pro obsluhu.
- Jednoduchá role (Obsluha / Správce).

---

## 3. Technický Stack (Tech Stack)

- **Frontend:** HTML5, Tailwind CSS (via CDN nebo PostCSS), Vanilla JavaScript / Alpine.js (rychlá a lehká reakce).
- **Backend:** Node.js (Express.js) nebo Python (FastAPI/Flask) – *vyber dle preferencí*.
- **Databáze:** Vsechno se uklada na supabase. com.
- **Architektura:** REST API pro komunikaci frontendu s backendem.

---

## 4. Datový model (Database Schema)

### Products (Produkty)
- `id` (INTEGER, PRIMARY KEY)
- `name` (TEXT)
- `price` (REAL)
- `category` (TEXT)
- `is_active` (BOOLEAN, default 1)

### Orders (Objednávky)
- `id` (INTEGER, PRIMARY KEY)
- `created_at` (TIMESTAMP, default CURRENT_TIMESTAMP)
- `payment_method` (TEXT - 'cash' / 'card')
- `total_price` (REAL)
- `user_name` (TEXT)

### OrderItems (Položky objednávky)
- `id` (INTEGER, PRIMARY KEY)
- `order_id` (INTEGER, FOREIGN KEY)
- `product_id` (INTEGER, FOREIGN KEY)
- `product_name` (TEXT) -- záloha názvu v čase prodeje
- `quantity` (INTEGER)
- `unit_price` (REAL)

---

## 5. UI & Pravidla designu
1. **Dotykovost:** Velká tlačítka (minimum 48px na výšku) vhodná pro tablet nebo dotykový monitor.
2. **Kontrast:** Tmavá horní lišta (slate-800), jasně rozlišená tlačítka plateb (zelená pro hotovost, fialová/modrá pro kartu).
3. **Předcházení chybám:** Potvrzení před stornováním nebo vymazáním celého účtu.
4. Aplikace je hlavně určená pro mobil a tablet