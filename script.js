// Inisialisasi ikon Lucide
lucide.createIcons();

// =========================================
// KONFIGURASI BACKEND (SUPABASE)
// =========================================
const SUPABASE_URL = 'https://trwqslvgzrlbgrxwvwku.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-ekA2cfO7k7j9Qtygg0T7A_Uor1zt-o';
const LETTERS_ENDPOINT = `${SUPABASE_URL}/rest/v1/letters`;

const SUPABASE_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  'Content-Type': 'application/json'
};

const SAMPLE_SPOTIFY_LINKS = [
  'https://open.spotify.com/track/0tgVpDi06FyKpA1z0VMD4v',
  'https://open.spotify.com/track/1dGr1c8CrMLDpV6mPbImSI',
  'https://open.spotify.com/track/3U4isOIWM3VvDubwSI3y7a',
  'https://open.spotify.com/track/5uCax9HTNlzGybIStD3vDh'
];

const PREVIEW_PLACEHOLDER_MESSAGE = '"Setiap kali lagu ini terputar, entah kenapa selalu wajahmu yang pertama kali terlintas di kepalaku. Semoga harimu selalu baik..."';

// =========================================
// STATE APLIKASI
// =========================================
let letters = [];
let selectedTheme = 'pink';
let selectedFont = 'handwriting';
let currentFilter = 'all';
let searchQuery = '';
let activeModalLetterId = null;

// =========================================
// REFERENSI ELEMEN DOM
// =========================================
const recipientInput = document.getElementById('recipientInput');
const messageInput = document.getElementById('messageInput');
const spotifyInput = document.getElementById('spotifyInput');
const spotifyStatus = document.getElementById('spotifyStatus');
const charCount = document.getElementById('charCount');
const sampleLinkBtn = document.getElementById('sampleLinkBtn');
const letterForm = document.getElementById('letterForm');

const previewCard = document.getElementById('previewCard');
const previewRecipient = document.getElementById('previewRecipient');
const previewMessage = document.getElementById('previewMessage');
const previewSpotifyContainer = document.getElementById('previewSpotifyContainer');

const lettersGrid = document.getElementById('lettersGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');

// Elemen Modal & Toast
const letterModal = document.getElementById('letterModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalCard = document.getElementById('modalCard');
const modalRecipient = document.getElementById('modalRecipient');
const modalMessage = document.getElementById('modalMessage');
const modalSpotify = document.getElementById('modalSpotify');
const modalDate = document.getElementById('modalDate');
const copyShareBtn = document.getElementById('copyShareBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// =========================================
// FUNGSI PARSER LINK SPOTIFY
// =========================================
function extractSpotifyTrackId(url) {
  if (!url) return null;
  const trimmed = url.trim();

  // Mendukung format URL web/share Spotify & URI Spotify
  const webRegex = /open\.spotify\.com\/(?:intl-[a-zA-Z-]+\/)?track\/([a-zA-Z0-9]{22})/;
  const uriRegex = /spotify:track:([a-zA-Z0-9]{22})/;

  const webMatch = trimmed.match(webRegex);
  if (webMatch && webMatch[1]) return webMatch[1];

  const uriMatch = trimmed.match(uriRegex);
  if (uriMatch && uriMatch[1]) return uriMatch[1];

  return null;
}

function createSpotifyEmbedHTML(trackId) {
  return `<iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0" width="100%" height="80" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}

// =========================================
// KOMUNIKASI DENGAN DATABASE (SUPABASE)
// =========================================
function mapRowToLetter(row) {
  return {
    id: row.id,
    recipient: row.recipient,
    message: row.message,
    trackId: row.track_id,
    theme: row.theme,
    fontStyle: row.font_style,
    createdAt: row.created_at
  };
}

async function fetchLetters() {
  const res = await fetch(`${LETTERS_ENDPOINT}?select=*&order=created_at.desc`, {
    headers: SUPABASE_HEADERS
  });
  if (!res.ok) throw new Error('Gagal memuat surat');
  const rows = await res.json();
  return rows.map(mapRowToLetter);
}

async function insertLetter(letter) {
  const res = await fetch(LETTERS_ENDPOINT, {
    method: 'POST',
    headers: { ...SUPABASE_HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: letter.id,
      recipient: letter.recipient,
      message: letter.message,
      track_id: letter.trackId,
      theme: letter.theme,
      font_style: letter.fontStyle
    })
  });
  if (!res.ok) throw new Error('Gagal menyimpan surat');
}

async function loadLetters() {
  try {
    letters = await fetchLetters();
  } catch (err) {
    console.error(err);
    letters = [];
    showToast('Gagal memuat arsip surat. Periksa koneksi internetmu.');
  }
  renderLetters();
}

// Waktu relatif dihitung dari waktu asli di database, jadi sama untuk semua orang
function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const menit = Math.floor(diffMs / 60000);
  if (menit < 1) return 'Baru saja';
  if (menit < 60) return `${menit} menit yang lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam yang lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 30) return `${hari} hari yang lalu`;
  return new Date(isoString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// =========================================
// LIVE PREVIEW & EVENT FORM
// =========================================
recipientInput.addEventListener('input', (e) => {
  previewRecipient.textContent = e.target.value.trim() || 'Seseorang yang Spesial';
});

messageInput.addEventListener('input', (e) => {
  const val = e.target.value;
  charCount.textContent = `${val.length} / 450`;
  previewMessage.textContent = val.trim()
    ? `"${val}"`
    : PREVIEW_PLACEHOLDER_MESSAGE;
});

spotifyInput.addEventListener('input', (e) => {
  const trackId = extractSpotifyTrackId(e.target.value);
  if (trackId) {
    spotifyStatus.textContent = '✓ Tautan lagu Spotify valid dan siap diputar!';
    spotifyStatus.className = 'status-text valid';
    previewSpotifyContainer.innerHTML = createSpotifyEmbedHTML(trackId);
  } else if (e.target.value.trim() === '') {
    spotifyStatus.textContent = 'Buka Spotify → Klik Bagikan (Share) → Salin Link Lagu → Tempel di sini.';
    spotifyStatus.className = 'status-text';
    previewSpotifyContainer.innerHTML = createSpotifyEmbedHTML('0tgVpDi06FyKpA1z0VMD4v');
  } else {
    spotifyStatus.textContent = '⚠ Link tidak dikenali. Pastikan menyalin link lagu (track) dari Spotify.';
    spotifyStatus.className = 'status-text invalid';
    previewSpotifyContainer.innerHTML = `<div class="spotify-placeholder">Menunggu tautan lagu Spotify yang valid...</div>`;
  }
});

// Tombol Isi Contoh Lagu Spotify
sampleLinkBtn.addEventListener('click', () => {
  const randomLink = SAMPLE_SPOTIFY_LINKS[Math.floor(Math.random() * SAMPLE_SPOTIFY_LINKS.length)];
  spotifyInput.value = randomLink;
  spotifyInput.dispatchEvent(new Event('input'));
});

// Pemilih Gaya Tulisan (Font)
document.querySelectorAll('#fontSelector .font-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#fontSelector .font-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFont = btn.dataset.font;

    previewMessage.classList.remove('font-handwriting', 'font-serif-classic');
    previewMessage.classList.add(selectedFont === 'handwriting' ? 'font-handwriting' : 'font-serif-classic');
  });
});

// Pemilih Tema Kertas
document.querySelectorAll('#themeSelector .theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#themeSelector .theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTheme = btn.dataset.theme;

    previewCard.classList.remove('theme-pink', 'theme-cream', 'theme-lavender', 'theme-sage');
    previewCard.classList.add(`theme-${selectedTheme}`);
  });
});

// Submit Form Surat Baru (disimpan ke database, bukan localStorage)
letterForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const recipient = recipientInput.value.trim();
  const message = messageInput.value.trim();
  const trackId = extractSpotifyTrackId(spotifyInput.value);

  if (!trackId) {
    showToast('Harap masukkan link lagu Spotify yang valid terlebih dahulu.');
    spotifyInput.focus();
    return;
  }

  const newLetter = {
    id: 'tk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    recipient,
    message,
    trackId,
    theme: selectedTheme,
    fontStyle: selectedFont
  };

  const submitBtn = letterForm.querySelector('.btn-submit');
  submitBtn.disabled = true;

  try {
    await insertLetter(newLetter);
  } catch (err) {
    console.error(err);
    submitBtn.disabled = false;
    showToast('Gagal mengirim surat. Coba lagi sebentar.');
    return;
  }

  submitBtn.disabled = false;

  // Reset Form
  letterForm.reset();
  charCount.textContent = '0 / 450';
  spotifyStatus.textContent = 'Buka Spotify → Klik Bagikan (Share) → Salin Link Lagu → Tempel di sini.';
  spotifyStatus.className = 'status-text';
  previewRecipient.textContent = 'Seseorang yang Spesial';
  previewMessage.textContent = PREVIEW_PLACEHOLDER_MESSAGE;
  previewSpotifyContainer.innerHTML = createSpotifyEmbedHTML('0tgVpDi06FyKpA1z0VMD4v');

  // Muat ulang dari database supaya surat baru terlihat oleh semua orang
  await loadLetters();
  showToast('Surat anonim & lagumu berhasil diterbitkan!');
  document.getElementById('arsip-surat').scrollIntoView({ behavior: 'smooth' });
});

// =========================================
// RENDER ARSIP SURAT & PENCARIAN
// =========================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLetters() {
  const filtered = letters.filter(item => {
    const matchesTheme = currentFilter === 'all' || item.theme === currentFilter;
    const matchesSearch =
      item.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTheme && matchesSearch;
  });

  lettersGrid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(letter => {
    const card = document.createElement('article');
    const fontClass = letter.fontStyle === 'serif' ? 'font-serif-classic' : 'font-handwriting';
    card.className = `letter-card archive-card theme-${letter.theme}`;

    card.innerHTML = `
      <div>
        <div class="card-top">
          <div>
            <span class="card-label">Untuk:</span>
            <h3 class="card-recipient">${escapeHTML(letter.recipient)}</h3>
          </div>
          <span class="anon-badge">
            <i data-lucide="eye-off" class="icon-xs"></i> Anonim
          </span>
        </div>

        <div class="card-body">
          <p class="card-message ${fontClass} line-clamp-4">"${escapeHTML(letter.message)}"</p>
        </div>
      </div>

      <div>
        <div class="spotify-box" onclick="event.stopPropagation()">
          ${createSpotifyEmbedHTML(letter.trackId)}
        </div>
        <div class="card-footer">
          <span class="brand-mini">
            <svg class="mini-svg" viewBox="0 0 120 110" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M32 45L34 15C34.3 12 37.5 11 39.5 13L50 24H70L80.5 13C82.5 11 85.7 12 86 15L88 45H32Z" fill="#0A1931"/>
              <circle cx="48" cy="36" r="5.5" fill="#F97316"/>
              <circle cx="72" cy="36" r="5.5" fill="#F97316"/>
              <path d="M27 52H93L106 66C108 68 106.5 71 103.5 71H93V93C93 97.4 89.4 101 85 101H35C30.6 101 27 97.4 27 93V71H16.5C13.5 71 12 68 14 66L27 52Z" fill="#F97316"/>
              <path d="M27 72H43C48 72 51 69 54 65L60 56L66 65C69 69 72 72 77 72H93V80H77C70 80 65 76 60 68C55 76 50 80 43 80H27V72Z" fill="#0A1931"/>
            </svg>
            Tell<span class="brand-amp">&amp;</span>Kiss
          </span>
          <span>${timeAgo(letter.createdAt)}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openLetterModal(letter));
    lettersGrid.appendChild(card);
  });

  lucide.createIcons();
}

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderLetters();
});

document.querySelectorAll('#filterBar .filter-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filterBar .filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderLetters();
  });
});

// =========================================
// MODAL BACA SURAT & TOAST NOTIFIKASI
// =========================================
function openLetterModal(letter) {
  activeModalLetterId = letter.id;

  modalCard.classList.remove('theme-pink', 'theme-cream', 'theme-lavender', 'theme-sage');
  modalCard.classList.add(`theme-${letter.theme}`);

  modalMessage.classList.remove('font-handwriting', 'font-serif-classic');
  modalMessage.classList.add(letter.fontStyle === 'serif' ? 'font-serif-classic' : 'font-handwriting');

  modalRecipient.textContent = letter.recipient;
  modalMessage.textContent = `"${letter.message}"`;
  modalSpotify.innerHTML = createSpotifyEmbedHTML(letter.trackId);
  modalDate.textContent = `Dikirim ${timeAgo(letter.createdAt)}`;

  letterModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  letterModal.classList.add('hidden');
  modalSpotify.innerHTML = '';
  activeModalLetterId = null;
  document.body.style.overflow = '';
}

closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

// Tautan berbagi langsung menuju surat tertentu
copyShareBtn.addEventListener('click', async () => {
  if (!activeModalLetterId) return;
  const shareUrl = `${window.location.href.split('#')[0]}#surat-${activeModalLetterId}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('Tautan surat disalin! Bagikan ke dia sekarang.');
  } catch (err) {
    showToast('Gagal menyalin tautan. Silakan coba lagi.');
  }
});

// Jika halaman dibuka dari tautan surat (#surat-ID), langsung tampilkan suratnya
function openLetterFromHash() {
  const match = window.location.hash.match(/^#surat-(.+)$/);
  if (!match) return;
  const letter = letters.find(l => l.id === match[1]);
  if (!letter) return;
  document.getElementById('arsip-surat').scrollIntoView();
  openLetterModal(letter);
}

function showToast(msg) {
  toastMessage.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3200);
}

// =========================================
// INISIALISASI
// =========================================
async function init() {
  await loadLetters();
  openLetterFromHash();
}

init();
