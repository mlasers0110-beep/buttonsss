# Aether Tactile Studio

> Interaktywne środowisko projektowania frontendu dotykowego, optyki matowego szkła, syntezy akustyczno-haptycznej `<160 Hz`, architektury ekranów DAG oraz wtyczek międzyaplikacyjnych — z obsługą zapisu na dysku lokalnym i pracy w 100% offline.

**Aether Tactile Studio** łączy wizualne komponowanie interfejsów webowych z fizyką ruchu sprężynowego, proceduralnym dźwiękiem sub-basowym, przestrzennymi podglądami 3D PBR oraz natychmiastowym eksportem gotowego kodu `React + TypeScript + Tailwind CSS` bezpośrednio do repozytorium GitHub lub archiwum `.zip`.

---

## Kluczowe funkcje aplikacji

### 1. Sekcja Startowa: Dysk Lokalny, Obraz Frontendu i Synchronizacja Odcieni
- **Zapis na dysku lokalnym** — wybór katalogu roboczego przez *File System Access API* (lub powiązanie istniejącego folderu) z automatycznym zapisem stanu projektu, obrazów referencyjnych oraz wygenerowanych komponentów `.tsx`.
- **Praca na wgranym obrazie frontendu** — ładowanie makiet i zrzutów ekranu (`PNG`, `JPG`, `WEBP`, wklejanie `Ctrl+V`) z interaktywnym mapowaniem stref układu i automatycznym generowaniem planu ekranów.
- **Wieloodcieniowa kompozycja z synchronizacją na żywo** — każdy komponowany element otrzymuje odrębny odcień z 6-kolorowej palety architektonicznej (*Kobalt*, *Szmaragd*, *Bursztyn*, *Fiolet*, *Koral*, *Cyjan*). Edycja dowolnego elementu natychmiast podświetla ten sam moduł i powiązaną strefę obrazu identycznym kolorem w oknie żywego podglądu.

### 2. Żywy Podgląd Modelu Frontendu i Stałe Okno Kompletnego Promptu
- **Stały dok kreacyjny w każdym pulpicie** — jednoczesna praca nad parametrami studia z podglądem projektowanego ekranu w trybach *Desktop / Tablet / Mobile*, podglądem stref obrazu oraz inspektorem kodu `.tsx`.
- **Multimodalny kreator kompletnych elementów** — stałe okno budowania pełnego promptu łączące załączone grafiki referencyjne z tokenami szkła, cieni, palety i profilu dotykowego w gotowe komponenty React.

### 3. Silnik Haptyczno-Akustyczny (`<160 Hz`) i Oscyloskop Czasu Rzeczywistego
- **Proceduralna synteza Web Audio API** — modelowanie odpowiedzi dotykowej dla czterech profili materiałowych (*Błyszczące szkło*, *Matowe szkło*, *Anodowany metal*, *Miękki zamsz*) z regulacją twardości Shore’a, sprzęgła zwrotnego oraz obwiedni narastania drgań przy przytrzymaniu.
- **Oscyloskop Haptyczny i Eksport Audio** — rysowanie przebiegu fali (częstotliwości i amplitudy) w czasie rzeczywistym z eksportem wygenerowanej fali do plików **WAV** oraz **JSON**.

### 4. Wizualizacje 3D PBR i Kalibracja Kontrolera Obrotowego CNC (270°)
- **Sceny przestrzenne Three.js** — interaktywne wskaźniki 3D reagujące na energię dotyku, wybrany kształt fali oraz nastawy suwaków optycznych.
- **Serwis kalibracji pokrętła CNC** — precyzyjne strojenie progów zapadek (*detents*), rezonansu korpusu i tłumienia dla fizycznych oraz ekranowych enkoderów obrotowych.

### 5. Architektura Ekranów (DAG), Matryca z Pliku i Prototypowanie Drag & Drop
- **Planer mapy ekranów (DAG)** — interaktywne płótno węzłów i połączeń nawigacyjnych z biblioteką 8 fizycznych animacji przejść ekranowych (60 fps) oraz eksportem do **Mermaid.js** i **JSON**.
- **Generator matrycy budowy z plików i GitHub** — tworzenie planu ekranów oraz matrycy budowy strony i aplikacji internetowej na podstawie wgranych dokumentów (`PDF`, obrazów, `Markdown`, `JSON`, `CSV`) lub struktury repozytorium GitHub.
- **Prototypowanie Drag & Drop** — przeciąganie przycisków, suwaków, przełączników dźwigniowych i enkoderów bezpośrednio z biblioteki komponentów na strefy ekranu (`Header`, `Main`, `Footer`).

### 6. Tryb 100% Offline (`.html` + PWA) i System Wtyczek Zewnętrznych
- **Samodzielny plik Offline `.html`** — możliwość wygenerowania i pobrania całej aplikacji w jednym przenośnym pliku `.html` z zachowaniem wszystkich funkcji oraz wbudowanym skarbcem konta lokalnego (PBKDF2 + AES-GCM).
- **Wtyczki do innych aplikacji (`plugins/`)** — wbudowane mostki integracyjne dla **Figma**, **VS Code / Cursor**, **uniwersalnego SDK JS (`postMessage` / `BroadcastChannel`)**, **Storybook 8**, **Webhooków REST** oraz **silników 3D**, wraz z kreatorem własnych wtyczek do dowolnych zewnętrznych systemów.

---

## Stos technologiczny

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Motion (`motion/react`), Lucide Icons
- **Grafika 3D i Dźwięk**: Three.js (WebGL PBR), Web Audio API + OfflineAudioContext (eksport WAV 16-bit PCM)
- **Praca lokalna i Offline**: File System Access API, Service Worker (PWA), Web Crypto API (`PBKDF2` / `AES-GCM`)
- **Backend i Integracje**: Node.js, Express, WebSockets, GitHub REST API (eksport drzewa Git + OAuth / PAT)

---

## Szybki start

```bash
# 1. Sklonuj repozytorium
git clone https://github.com/<twoj-login>/aether-tactile-studio.git
cd aether-tactile-studio

# 2. Zainstaluj zależności
npm install

# 3. Skopiuj plik zmiennych środowiskowych (opcjonalnie dla funkcji serwerowych)
cp .env.example .env

# 4. Uruchom serwer deweloperski (port 3000)
npm run dev
```

### Budowa produkcyjna

```bash
npm run build
npm start
```

---

## Struktura projektu

```text
├── src/
│   ├── components/        # Widoki studia, sekcja startowa, podgląd modelu, oscyloskop, sceny 3D i planer DAG
│   ├── context/           # Centralny stan studia, synchronizacja dysku lokalnego i odcieni elementów
│   ├── lib/               # Silniki Web Audio, eksporter GitHub/.zip, eksporter Offline .html, system wtyczek
│   └── types/             # Definicje typów TypeScript dla architektury ekranów, haptyki i wtyczek
├── server.ts              # Serwer Express + mostki API i eksport repozytoriów GitHub
└── public/                # Manifest PWA, Service Worker oraz zasoby statyczne
```

---

## Licencja

Projekt udostępniany na licencji **Apache-2.0**.
