/**
 * Markup HyperFrames Studio: shell (sidebar / tab bar / toast / dialog) + 5 halaman.
 *
 * Penanda yang diganti oleh page.js:
 *   __CSS__            isi stylesheet (ui/styles.js)
 *   __JS__             skrip klien (ui/client.js)
 *   __NONCE__          nonce CSP acak per respons (diganti per request)
 *
 * ATURAN: jangan pakai backtick atau ${ di sini (String.raw). Tidak boleh ada atribut style="..."
 * (diblokir CSP). Setiap id di bawah dipakai oleh skrip klien: ubah bersamaan, dan jalankan
 * cloudflare-free/worker/test/ui-smoke.mjs untuk memeriksa konsistensinya.
 */

const ICONS = String.raw`<svg class="sprite" aria-hidden="true" focusable="false"><defs>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></symbol>
<symbol id="i-film" viewBox="0 0 24 24"><rect x="2.5" y="3" width="19" height="18" rx="2"/><path d="M7 3v18M17 3v18M2.5 8H7M2.5 12H7M2.5 16H7M17 8h4.5M17 12h4.5M17 16h4.5"/></symbol>
<symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2.5"/><circle cx="9" cy="12" r="2.5"/><circle cx="17" cy="18" r="2.5"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></symbol>
<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></symbol>
<symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V4M7 8l5-5 5 5M4 21h16"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/></symbol>
<symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1"/></symbol>
<symbol id="i-ext" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></symbol>
<symbol id="i-music" viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></symbol>
<symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></symbol>
<symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></symbol>
<symbol id="i-key" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/></symbol>
<symbol id="i-save" viewBox="0 0 24 24"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></symbol>
<symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
<symbol id="i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></symbol>
</defs></svg>`;

const LOGO = String.raw`<svg class="logo" viewBox="0 0 32 32" role="img" aria-label="HyperFrames">
  <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8aff"/><stop offset="1" stop-color="#246BFD"/></linearGradient></defs>
  <rect width="32" height="32" rx="9" fill="url(#lg)"/>
  <rect x="7" y="8" width="18" height="16" rx="3" fill="none" stroke="#fff" stroke-width="1.8" opacity=".95"/>
  <path d="M14 12.2v7.6l6-3.8z" fill="#fff"/>
</svg>`;

const SHELL_TOP =
  String.raw`<a class="skip" href="#main">Lewati ke konten</a>
<div class="app">
<aside class="side" aria-label="Navigasi utama">
  <a class="brand" href="#/dashboard" aria-label="HyperFrames Studio, ke Dashboard">` +
  LOGO +
  String.raw`<span><b>HyperFrames</b><small>Studio</small></span></a>
  <nav class="nav" aria-label="Menu">
    <a class="nav-new" data-route="create" href="#/create"><svg class="i" aria-hidden="true"><use href="#i-plus"/></svg><span>Buat video</span></a>
    <a data-route="dashboard" href="#/dashboard"><svg class="i" aria-hidden="true"><use href="#i-home"/></svg><span>Dashboard</span></a>
    <a data-route="media" href="#/media"><svg class="i" aria-hidden="true"><use href="#i-image"/></svg><span>Media</span></a>
    <a data-route="renders" href="#/renders"><svg class="i" aria-hidden="true"><use href="#i-film"/></svg><span>Render Center</span><span class="nbadge" hidden></span></a>
    <a data-route="settings" href="#/settings"><svg class="i" aria-hidden="true"><use href="#i-sliders"/></svg><span>Pengaturan</span></a>
  </nav>
  <div class="side-foot">Cloudflare Free &middot; GitHub Actions &middot; R2<br>Riwayat tersimpan di perangkat ini.</div>
</aside>
<div class="col">
<header class="mtop">` + LOGO + String.raw`<b>HyperFrames</b><span class="sep" aria-hidden="true">/</span><span class="mt-title" id="mTitle">Dashboard</span></header>
<main id="main" tabindex="-1">
<noscript><div class="msg err">Halaman ini membutuhkan JavaScript. API tetap bisa dipakai lewat curl (lihat <code>/api</code>).</div></noscript>`;

const DASHBOARD = String.raw`
<section id="v-dashboard" class="view" aria-labelledby="h-dashboard">
  <div class="view-h">
    <div><h1 id="h-dashboard">Dashboard</h1><p class="sub">Ringkasan proyek render di perangkat ini.</p></div>
    <a class="btn solid lg" href="#/create"><svg class="i" aria-hidden="true"><use href="#i-plus"/></svg>Buat video baru</a>
  </div>

  <div id="onboard" class="card onboard" hidden>
    <div class="h2-row"><h2 class="h2">Mulai dalam 3 langkah</h2>
      <button type="button" class="btn ghost sm icon" id="onboardClose" aria-label="Tutup panduan" title="Tutup panduan"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></button></div>
    <ol class="steps">
      <li data-step="key"><span class="stepn">1</span><div><b>Pasang API key</b><p>Kunci dari secret <code>API_KEY</code> Worker. Hanya disimpan di tab ini bila Anda memilihnya.</p><a href="#/settings">Buka Pengaturan</a></div></li>
      <li data-step="comp"><span class="stepn">2</span><div><b>Siapkan komposisi</b><p>Pilih komposisi di repo, tempel HTML, atau unggah file. Aset (video avatar, gambar, audio) diunggah di Media.</p><a href="#/create">Buat video</a></div></li>
      <li data-step="render"><span class="stepn">3</span><div><b>Render &amp; unduh</b><p>GitHub Actions merender; hasil MP4 bisa diputar, disalin tautannya, dan diunduh.</p><a href="#/renders">Render Center</a></div></li>
    </ol>
  </div>

  <div class="stats" aria-label="Ringkasan">
    <div class="stat"><span>Total</span><b id="sTotal">0</b></div>
    <div class="stat"><span>Selesai</span><b id="sDone">0</b></div>
    <div class="stat"><span>Diproses</span><b id="sRun">0</b></div>
    <div class="stat"><span>Gagal</span><b id="sFail">0</b></div>
  </div>

  <div class="qa" aria-label="Aksi cepat">
    <a class="btn" href="#/create"><svg class="i" aria-hidden="true"><use href="#i-plus"/></svg>Buat video</a>
    <a class="btn" href="#/media"><svg class="i" aria-hidden="true"><use href="#i-upload"/></svg>Unggah media</a>
    <a class="btn" href="#/renders"><svg class="i" aria-hidden="true"><use href="#i-film"/></svg>Render Center</a>
    <button type="button" class="btn" id="qaMonitor"><svg class="i" aria-hidden="true"><use href="#i-search"/></svg>Pantau ID</button>
  </div>

  <div class="card">
    <div class="h2-row"><h2 class="h2">Proyek terbaru</h2></div>
    <div class="toolbar">
      <div class="search"><svg class="i" aria-hidden="true"><use href="#i-search"/></svg><input id="dSearch" type="search" placeholder="Cari ID atau komposisi" aria-label="Cari proyek" autocomplete="off" spellcheck="false"></div>
      <div class="chips" id="dFilter" role="group" aria-label="Filter status">
        <button type="button" data-value="all" aria-pressed="true">Semua</button>
        <button type="button" data-value="pending" aria-pressed="false">Diproses</button>
        <button type="button" data-value="done" aria-pressed="false">Selesai</button>
        <button type="button" data-value="bad" aria-pressed="false">Gagal</button>
      </div>
    </div>
    <div id="dGrid" class="pgrid"></div>
    <div id="dEmpty" class="empty-state" hidden>
      <svg class="i" aria-hidden="true"><use href="#i-film"/></svg>
      <b id="dEmptyTitle">Belum ada proyek</b>
      <p id="dEmptyText">Mulai dengan komposisi contoh, atau tulis komposisi HTML sendiri.</p>
      <a class="btn solid" id="dEmptyCta" href="#/create">Buat video pertama</a>
    </div>
  </div>

  <div class="card">
    <div class="h2-row"><h2 class="h2">Draf</h2></div>
    <ul id="dDrafts" class="rows"></ul>
    <p id="dDraftsEmpty" class="hint">Belum ada draf. Simpan komposisi yang belum selesai dari halaman Buat video.</p>
  </div>
</section>`;

const CREATE = String.raw`
<section id="v-create" class="view" hidden aria-labelledby="h-create">
  <div class="view-h"><div><h1 id="h-create">Buat video</h1><p class="sub">Pilih komposisi, atur kualitas, lalu mulai render.</p></div></div>
  <div class="keybar" id="keyBarC"><svg class="i" aria-hidden="true"><use href="#i-key"/></svg><span class="kb-t"></span><a class="btn sm" href="#/settings">Pengaturan</a></div>

  <section class="card prompt-studio" aria-labelledby="jtPromptTitle">
    <div class="prompt-head">
      <div>
        <div class="prompt-eyebrow">JALUR TAROT · CREATIVE WORKSPACE</div>
        <h2 id="jtPromptTitle" class="h2">Cinematic Prompt Studio</h2>
        <p class="hint">Susun brief video, lalu salin master prompt lengkap untuk AI coding agent. Prompt ini menghasilkan HTML komposisi; bukan dikirim langsung ke mesin render.</p>
      </div>
      <span class="prompt-mark" aria-hidden="true">✦</span>
    </div>
    <div class="prompt-fields">
      <div class="field">
        <label for="jtTheme">Jenis konten</label>
        <select id="jtTheme">
          <option>Pesan Semesta</option><option>Tarot Reading</option><option>Numerologi</option>
          <option>Asmara &amp; Hubungan</option><option>Keuangan &amp; Rezeki</option><option>Karier</option>
          <option>Pick a Card</option><option>Pesan Harian</option>
        </select>
      </div>
      <div class="field">
        <label for="jtTitle">Judul / hook video</label>
        <input id="jtTitle" type="text" maxlength="120" placeholder="Contoh: Pesan Semesta Hari Ini">
      </div>
      <div class="field prompt-wide">
        <label for="jtMessage">Pesan utama / materi narasi</label>
        <textarea id="jtMessage" class="prompt-input" rows="3" placeholder="Tuliskan inti pesan yang ingin disampaikan kepada penonton..."></textarea>
      </div>
      <div class="field">
        <label for="jtCards">Kartu tarot (opsional)</label>
        <input id="jtCards" type="text" maxlength="180" placeholder="Contoh: The Magician, The Star">
      </div>
      <div class="field">
        <label for="jtMood">Emosi / nuansa</label>
        <select id="jtMood">
          <option>Misterius, penasaran, inspiratif</option><option>Romantis, hangat, emosional</option>
          <option>Dramatis, intens, penuh harapan</option><option>Tenang, spiritual, reflektif</option>
          <option>Optimistis, energik, penuh peluang</option>
        </select>
      </div>
      <div class="field">
        <label for="jtDuration">Durasi video</label>
        <select id="jtDuration"><option value="24">24 detik</option><option value="30">30 detik</option><option value="45">45 detik</option><option value="60">60 detik</option></select>
      </div>
      <div class="field">
        <label for="jtVisual">Arah visual</label>
        <select id="jtVisual">
          <option>Dark mystical, ungu kerajaan dan emas</option><option>Celestial gold, kosmik dan elegan</option>
          <option>Gothic tarot, gelap dan dramatis</option><option>Ethereal purple, lembut dan magis</option>
        </select>
      </div>
      <div class="field prompt-wide">
        <label for="jtCta">Call to action</label>
        <input id="jtCta" type="text" maxlength="120" value="Follow @jalurtarot untuk pesan berikutnya">
      </div>
    </div>
    <div class="prompt-actions">
      <button type="button" class="btn solid" id="jtBuildPrompt">Buat prompt lengkap</button>
      <button type="button" class="btn" id="jtCopyPrompt">Salin prompt lengkap</button>
      <button type="button" class="btn" id="jtCopyBrief">Salin brief saja</button>
    </div>
    <details class="prompt-preview" id="jtPromptDetails">
      <summary>Pratinjau prompt untuk AI coding agent</summary>
      <textarea id="jtPromptOutput" rows="12" readonly aria-label="Pratinjau prompt lengkap" placeholder="Isi brief lalu tekan Buat prompt lengkap."></textarea>
      <p class="hint">Salin hasil ini ke BYGA AI atau coding agent yang mengerjakan komposisi HyperFrames.</p>
    </details>
    <div id="jtPromptMsg" class="prompt-feedback" role="status" aria-live="polite">Isi brief di atas. Prompt akan menggabungkan arahan artistik JalurTarot dan kontrak teknis HyperFrames.</div>
  </section>
  <div class="two">
    <form id="form" class="card" autocomplete="off" novalidate>
      <div class="field">
        <span class="lbl" id="lbl-mode">Sumber komposisi</span>
        <div class="seg" id="segMode" role="group" aria-labelledby="lbl-mode">
          <button type="button" data-value="existing" aria-pressed="true">Sudah ada di repo</button>
          <button type="button" data-value="new" aria-pressed="false">Tulis baru</button>
        </div>
      </div>

      <div id="newBox" hidden>
        <div class="field">
          <label for="newName">Nama komposisi (opsional)</label>
          <input id="newName" type="text" maxlength="64" autocapitalize="off" spellcheck="false" placeholder="kosongkan untuk web-ID otomatis">
          <p class="hint">Disimpan di <code>cloudflare-free/compositions/&lt;nama&gt;/index.html</code>. Bila nama sudah ada, permintaan ditolak dan file lama tidak ditimpa. Nama ini juga menentukan folder aset (<code>assets/</code>).</p>
        </div>
        <div class="field">
          <span class="lbl">Unggah file komposisi (.html)</span>
          <label class="drop" id="htmlDrop">
            <svg class="i" aria-hidden="true"><use href="#i-upload"/></svg>
            <b>Seret file .html ke sini atau pilih</b>
            <span class="hint">Isi dimuat ke kotak di bawah (belum dikirim), jadi bisa dicek dulu. Maks 256 KB.</span>
            <input id="htmlFile" class="sr-only" type="file" accept=".html,.htm,text/html">
          </label>
          <div id="htmlFileMsg" class="msg" role="alert" hidden></div>
        </div>
        <div class="field">
          <div class="lbl-row">
            <label for="html">Isi komposisi (index.html)</label>
            <button type="button" id="tplBtn" class="btn sm">Isi dari contoh</button>
          </div>
          <textarea id="html" spellcheck="false" autocapitalize="off" wrap="off"></textarea>
          <div class="lbl-row"><p class="hint">Maks 256 KB.</p><span id="htmlCount" class="count">0 B / 256 KB</span></div>
        </div>
      </div>

      <div class="grid2">
        <div class="field" id="fieldComp">
          <label for="composition">Komposisi</label>
          <input id="composition" type="text" value="contoh" maxlength="64" list="compList" autocapitalize="off" spellcheck="false" required>
          <p class="hint">Nama folder di <code>cloudflare-free/compositions/</code></p>
        </div>
        <div class="field">
          <span class="lbl" id="lbl-q">Kualitas</span>
          <div class="seg" id="segQuality" role="group" aria-labelledby="lbl-q">
            <button type="button" data-value="draft" aria-pressed="false">Draft</button>
            <button type="button" data-value="standard" aria-pressed="true">Standard</button>
            <button type="button" data-value="high" aria-pressed="false">High</button>
          </div>
          <p class="hint">Draft tercepat, High paling lama.</p>
        </div>
        <div class="field">
          <label for="rid">ID output (opsional)</label>
          <input id="rid" type="text" maxlength="64" autocapitalize="off" spellcheck="false" placeholder="kosongkan untuk UUID acak">
          <p class="hint">Huruf, angka, <code>_</code> dan <code>-</code>, maks 64. Status &amp; video bersifat publik, jadi ID acak lebih aman.</p>
        </div>
      </div>

      <div class="actions">
        <button class="btn solid lg" type="submit" id="submit">Mulai render</button>
        <button class="btn lg" type="button" id="saveDraft" hidden><svg class="i" aria-hidden="true"><use href="#i-save"/></svg>Simpan draf</button>
      </div>
      <div id="formMsg" class="msg" role="alert" hidden></div>
    </form>

    <div>
      <div class="card">
        <h2 class="h2">Draf</h2>
        <p class="hint">Tersimpan di perangkat ini saja.</p>
        <ul id="cDrafts" class="rows mt-s"></ul>
        <p id="cDraftsEmpty" class="hint mt-s">Belum ada draf.</p>
      </div>
      <div class="card">
        <h2 class="h2">Perlu diketahui</h2>
        <ul class="hint">
          <li>Render dijalankan GitHub Actions; biasanya beberapa menit.</li>
          <li>Isi komposisi dijalankan sebagai kode di Chrome pada runner. Tempel hanya kode yang Anda percaya.</li>
          <li>Setiap render dengan komposisi baru menambah satu commit di branch utama repo.</li>
          <li>Pratinjau langsung belum ada di halaman ini; coba kualitas Draft untuk hasil cepat.</li>
        </ul>
      </div>
    </div>
  </div>
</section>`;

const MEDIA = String.raw`
<section id="v-media" class="view" hidden aria-labelledby="h-media">
  <div class="view-h"><div><h1 id="h-media">Media</h1><p class="sub">Unggah gambar, video, avatar, dan audio ke folder aset komposisi.</p></div></div>
  <div class="keybar" id="keyBarM"><svg class="i" aria-hidden="true"><use href="#i-key"/></svg><span class="kb-t"></span><a class="btn sm" href="#/settings">Pengaturan</a></div>
  <div class="two">
    <div>
      <div class="card">
        <h2 class="h2">Unggah aset</h2>
        <p class="hint">Diunggah sebagai commit ke <code>cloudflare-free/compositions/&lt;komposisi&gt;/assets/&lt;file&gt;</code>. Unggah <strong>sebelum</strong> merender komposisi yang memakainya.</p>
        <div class="grid2 mt">
          <div class="field">
            <label for="mComp">Komposisi tujuan</label>
            <input id="mComp" type="text" maxlength="64" list="compList" autocapitalize="off" spellcheck="false" placeholder="mis. contoh">
          </div>
          <div class="field">
            <label for="mCat">Kategori</label>
            <select id="mCat">
              <option value="auto">Otomatis</option>
              <option value="avatar">Avatar (video)</option>
              <option value="video">Video</option>
              <option value="image">Gambar</option>
              <option value="audio">Audio</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
        </div>
        <label class="drop" id="mDrop">
          <svg class="i" aria-hidden="true"><use href="#i-upload"/></svg>
          <b>Seret file ke sini atau pilih dari perangkat</b>
          <span class="hint">Maks 8 MB per file. Boleh lebih dari satu.</span>
          <input id="mFile" class="sr-only" type="file" multiple>
        </label>
        <div id="mMsg" class="msg" role="alert" hidden></div>
        <ul id="mQueue" class="rows mt"></ul>
      </div>

      <div class="card">
        <div class="h2-row"><h2 class="h2">Pustaka aset</h2></div>
        <p class="hint">Daftar unggahan dari perangkat ini. File sebenarnya ada di repo GitHub.</p>
        <div class="toolbar mt-s">
          <div class="search"><svg class="i" aria-hidden="true"><use href="#i-search"/></svg><input id="mSearch" type="search" placeholder="Cari nama file atau komposisi" aria-label="Cari aset" autocomplete="off" spellcheck="false"></div>
          <div class="chips" id="mFilter" role="group" aria-label="Filter kategori">
            <button type="button" data-value="all" aria-pressed="true">Semua</button>
            <button type="button" data-value="avatar" aria-pressed="false">Avatar</button>
            <button type="button" data-value="video" aria-pressed="false">Video</button>
            <button type="button" data-value="image" aria-pressed="false">Gambar</button>
            <button type="button" data-value="audio" aria-pressed="false">Audio</button>
            <button type="button" data-value="other" aria-pressed="false">Lainnya</button>
          </div>
        </div>
        <ul id="mList" class="rows"></ul>
        <div id="mEmpty" class="empty-state" hidden>
          <svg class="i" aria-hidden="true"><use href="#i-image"/></svg>
          <b id="mEmptyTitle">Belum ada aset</b>
          <p id="mEmptyText">Unggah video avatar, gambar, atau audio di atas.</p>
        </div>
      </div>
    </div>

    <div>
      <div class="card">
        <h2 class="h2">Avatar &amp; suara</h2>
        <ol class="hint">
          <li>Buat video avatar atau rekaman suara di alat lain (mis. HeyGen), lalu unduh filenya.</li>
          <li>Unggah di sini dengan kategori <em>Avatar</em> atau <em>Audio</em>.</li>
          <li>Pakai tombol <em>Pakai di komposisi</em> untuk menyisipkan tag ke komposisi baru.</li>
          <li>Sesuaikan <code>data-start</code>, <code>data-duration</code>, dan posisi, lalu render.</li>
        </ol>
        <p class="hint mt-s">HyperFrames Render <strong>tidak</strong> membuat avatar AI, kloning suara, atau teks-ke-suara. Hanya file yang Anda unggah yang dipakai.</p>
      </div>
      <div class="card">
        <h2 class="h2">Panduan aset</h2>
        <ul class="hint">
          <li>Path di komposisi: <code>assets/nama-file</code> (tanpa awalan <code>/</code>).</li>
          <li>Mengunggah ulang nama yang sama menimpa aset lama.</li>
          <li>Video harus <code>muted</code> kecuali memakai <code>data-has-audio="true"</code>; suara terpisah memakai <code>&lt;audio&gt;</code> ber-<code>id</code>.</li>
          <li>Batas 8 MB per file; setiap unggahan menambah satu commit di repo.</li>
        </ul>
      </div>
    </div>
  </div>
  <datalist id="compList"></datalist>
</section>`;

const RENDERS = String.raw`
<section id="v-renders" class="view" hidden aria-labelledby="h-renders">
  <div class="view-h"><div><h1 id="h-renders">Render Center</h1><p class="sub">Antrean, riwayat, dan hasil render.</p></div>
    <a class="btn solid" href="#/create"><svg class="i" aria-hidden="true"><use href="#i-plus"/></svg>Render baru</a></div>
  <div class="rc" id="rc">
    <div class="rc-list card">
      <div class="toolbar">
        <div class="search"><svg class="i" aria-hidden="true"><use href="#i-search"/></svg><input id="rSearch" type="search" placeholder="Cari ID atau komposisi" aria-label="Cari render" autocomplete="off" spellcheck="false"></div>
        <div class="chips" id="rFilter" role="group" aria-label="Filter status">
          <button type="button" data-value="all" aria-pressed="true">Semua</button>
          <button type="button" data-value="pending" aria-pressed="false">Diproses</button>
          <button type="button" data-value="done" aria-pressed="false">Selesai</button>
          <button type="button" data-value="bad" aria-pressed="false">Gagal</button>
        </div>
      </div>
      <ul id="rList" class="rows"></ul>
      <div id="rEmpty" class="empty-state" hidden>
        <svg class="i" aria-hidden="true"><use href="#i-film"/></svg>
        <b id="rEmptyTitle">Belum ada render</b>
        <p id="rEmptyText">Render yang Anda mulai akan muncul di sini beserta statusnya.</p>
      </div>
      <details>
        <summary>Pantau ID yang sudah ada</summary>
        <div class="row-in mt-s">
          <input id="manualId" type="text" maxlength="64" autocapitalize="off" spellcheck="false" placeholder="ID render" aria-label="ID render">
          <button type="button" class="btn" id="manualGo">Pantau</button>
        </div>
        <p class="hint">Tidak butuh API key. Cukup untuk memutar atau mengunduh hasil yang sudah selesai.</p>
      </details>
      <div class="actions mt"><button type="button" class="btn sm danger" id="rClear" hidden><svg class="i" aria-hidden="true"><use href="#i-trash"/></svg>Hapus riwayat</button></div>
    </div>

    <div class="rc-detail">
      <div id="rdEmpty" class="card empty-state">
        <svg class="i" aria-hidden="true"><use href="#i-play"/></svg>
        <b>Pilih sebuah render</b>
        <p>Detail status, pemutar video, dan tombol unduh tampil di sini.</p>
      </div>
      <article id="rd" class="card" hidden aria-live="polite">
        <a class="back" href="#/renders"><svg class="i" aria-hidden="true"><use href="#i-back"/></svg>Semua render</a>
        <div class="rd-h"><code id="rdId"></code><span id="rdBadge" class="badge" role="status"></span></div>
        <div class="prog" id="rdProg" hidden><span></span></div>
        <p id="rdElapsed" class="h-meta"></p>
        <div class="vid mt-s">
          <video id="rdVideo" controls preload="metadata" playsinline hidden></video>
          <div class="ph" id="rdPh"><svg class="i" aria-hidden="true"><use href="#i-film"/></svg><span id="rdPhText">Menunggu hasil render</span></div>
        </div>
        <dl class="kv">
          <div><dt>Komposisi</dt><dd id="rdComp">-</dd></div>
          <div><dt>Kualitas</dt><dd id="rdQual">-</dd></div>
          <div><dt>Ukuran</dt><dd id="rdSize">-</dd></div>
          <div><dt>Resolusi</dt><dd id="rdRes">-</dd></div>
          <div><dt>Durasi</dt><dd id="rdDur">-</dd></div>
          <div><dt>Dimulai</dt><dd id="rdStart">-</dd></div>
        </dl>
        <div id="rdNote" class="msg" hidden></div>
        <div class="actions mt">
          <a id="rdDl" class="btn solid" href="#" download hidden><svg class="i" aria-hidden="true"><use href="#i-download"/></svg>Unduh MP4</a>
          <button type="button" class="btn" id="rdCopyVideo" hidden><svg class="i" aria-hidden="true"><use href="#i-copy"/></svg>Salin URL video</button>
          <button type="button" class="btn" id="rdCopyPage" hidden><svg class="i" aria-hidden="true"><use href="#i-link"/></svg>Salin tautan halaman</button>
          <a id="rdLog" class="btn" href="#" target="_blank" rel="noopener noreferrer" hidden><svg class="i" aria-hidden="true"><use href="#i-ext"/></svg>Buka log di GitHub</a>
          <button type="button" class="btn" id="rdRetry" hidden><svg class="i" aria-hidden="true"><use href="#i-refresh"/></svg>Coba lagi</button>
          <button type="button" class="btn" id="rdStop" hidden><svg class="i" aria-hidden="true"><use href="#i-pause"/></svg>Berhenti memantau</button>
          <button type="button" class="btn" id="rdResume" hidden><svg class="i" aria-hidden="true"><use href="#i-play"/></svg>Lanjut memantau</button>
          <button type="button" class="btn danger" id="rdRemove"><svg class="i" aria-hidden="true"><use href="#i-trash"/></svg>Hapus dari riwayat</button>
        </div>
        <p class="hint mt-s" id="rdHint" hidden>Render yang sedang berjalan tidak bisa dibatalkan dari sini (API belum punya endpoint pembatalan). Batalkan lewat tab Actions di GitHub; halaman ini akan menandainya sebagai Dibatalkan.</p>
      </article>
    </div>
  </div>
</section>`;

const SETTINGS = String.raw`
<section id="v-settings" class="view" hidden aria-labelledby="h-settings">
  <div class="view-h"><div><h1 id="h-settings">Pengaturan</h1><p class="sub">Tampilan, akses API, penyimpanan, dan pintasan.</p></div></div>
  <div class="set-grid">
    <div>
      <div class="card">
        <h2 class="h2">Akses API</h2>
        <p class="hint">Dipakai untuk merender dan mengunggah aset. Tidak pernah ditulis ke log atau URL.</p>
        <div class="field mt">
          <label for="setKey">API key</label>
          <div class="row-in">
            <input id="setKey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false">
            <button type="button" class="btn" id="setKeyToggle" aria-controls="setKey" aria-pressed="false">Tampilkan</button>
          </div>
        </div>
        <label class="check"><input type="checkbox" id="setRemember"><span>Ingat API key hanya di tab ini (hilang saat tab ditutup)</span></label>
        <div class="actions">
          <button type="button" class="btn" id="setKeyTest">Uji API key</button>
          <button type="button" class="btn" id="setConn">Tes koneksi server</button>
        </div>
        <div id="setMsg" class="msg" role="status" hidden></div>
        <table class="mt" aria-label="Endpoint API">
          <thead><tr><th>Endpoint</th><th>Auth</th></tr></thead>
          <tbody>
            <tr><td><code>POST /render</code></td><td>x-api-key</td></tr>
            <tr><td><code>POST /asset</code></td><td>x-api-key</td></tr>
            <tr><td><code>GET /status/:id</code></td><td>publik</td></tr>
            <tr><td><code>GET /video/:id</code></td><td>publik</td></tr>
          </tbody>
        </table>
        <p class="hint mt-s">Origin: <code id="setOrigin"></code></p>
      </div>

      <div class="card">
        <h2 class="h2">Tampilan</h2>
        <div class="field mt">
          <span class="lbl" id="lbl-theme">Tema</span>
          <div class="seg" id="segTheme" role="group" aria-labelledby="lbl-theme">
            <button type="button" data-value="auto" aria-pressed="true">Otomatis</button>
            <button type="button" data-value="dark" aria-pressed="false">Gelap</button>
            <button type="button" data-value="light" aria-pressed="false">Terang</button>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="h2">Preferensi render</h2>
        <div class="field mt">
          <span class="lbl" id="lbl-dq">Kualitas bawaan</span>
          <div class="seg" id="segDefQuality" role="group" aria-labelledby="lbl-dq">
            <button type="button" data-value="draft" aria-pressed="false">Draft</button>
            <button type="button" data-value="standard" aria-pressed="true">Standard</button>
            <button type="button" data-value="high" aria-pressed="false">High</button>
          </div>
        </div>
        <div class="field">
          <label for="setComp">Komposisi bawaan</label>
          <input id="setComp" type="text" maxlength="64" autocapitalize="off" spellcheck="false" list="compList">
          <p class="hint">Terisi otomatis di form Buat video.</p>
        </div>
      </div>
    </div>

    <div>
      <div class="card">
        <h2 class="h2">Penyimpanan di perangkat ini</h2>
        <p class="hint">Semua data ini hanya ada di browser Anda. Video dan aset di server tidak ikut terhapus.</p>
        <div class="stor mt-s"><span>Riwayat render: <b id="stHist">0</b></span><button type="button" class="btn sm danger" id="clrHist">Hapus</button></div>
        <div class="stor"><span>Draf komposisi: <b id="stDrafts">0</b></span><button type="button" class="btn sm danger" id="clrDrafts">Hapus</button></div>
        <div class="stor"><span>Daftar aset: <b id="stAssets">0</b></span><button type="button" class="btn sm danger" id="clrAssets">Hapus</button></div>
        <div class="actions mt"><button type="button" class="btn danger" id="clrAll">Hapus semua data lokal</button></div>
      </div>

      <div class="card">
        <h2 class="h2">Pintasan keyboard</h2>
        <table class="mt-s" aria-label="Pintasan keyboard">
          <tbody>
            <tr><td><span class="kbd">g</span> lalu <span class="kbd">d</span></td><td>Dashboard</td></tr>
            <tr><td><span class="kbd">g</span> lalu <span class="kbd">c</span> atau <span class="kbd">n</span></td><td>Buat video</td></tr>
            <tr><td><span class="kbd">g</span> lalu <span class="kbd">m</span></td><td>Media</td></tr>
            <tr><td><span class="kbd">g</span> lalu <span class="kbd">r</span></td><td>Render Center</td></tr>
            <tr><td><span class="kbd">g</span> lalu <span class="kbd">s</span></td><td>Pengaturan</td></tr>
            <tr><td><span class="kbd">/</span></td><td>Fokus ke kotak cari</td></tr>
            <tr><td><span class="kbd">Esc</span></td><td>Tutup dialog</td></tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2 class="h2">Tentang HyperFrames Render</h2>
        <p class="hint mt-s">Layanan render video tanpa server berbayar: Cloudflare Workers Free (API), R2 (penyimpanan hasil), dan GitHub Actions (mesin render). Tampilan ini satu file tanpa dependensi eksternal dan dilindungi CSP ketat.</p>
        <div class="actions mt"><a class="btn" href="/api">Info API (JSON)</a></div>
      </div>
    </div>
  </div>
</section>`;

const SHELL_BOTTOM = String.raw`
<footer>Render yang gagal atau dibatalkan ditandai otomatis oleh workflow. Bila status tak kunjung berubah, cek log workflow <em>Render video</em> di tab Actions GitHub.</footer>
</main>
</div>
</div>

<nav class="tabbar" aria-label="Menu">
  <a data-route="dashboard" href="#/dashboard"><svg class="i" aria-hidden="true"><use href="#i-home"/></svg><span>Dashboard</span></a>
  <a data-route="media" href="#/media"><svg class="i" aria-hidden="true"><use href="#i-image"/></svg><span>Media</span></a>
  <a class="tab-new" data-route="create" href="#/create"><span class="tabi"><svg class="i" aria-hidden="true"><use href="#i-plus"/></svg></span><span>Buat</span></a>
  <a data-route="renders" href="#/renders"><svg class="i" aria-hidden="true"><use href="#i-film"/></svg><span>Render</span><span class="nbadge" hidden></span></a>
  <a data-route="settings" href="#/settings"><svg class="i" aria-hidden="true"><use href="#i-sliders"/></svg><span>Pengaturan</span></a>
</nav>

<div id="toasts" class="toasts" aria-live="polite"></div>

<dialog id="dlg" class="dlg" aria-labelledby="dlgTitle" aria-describedby="dlgText">
  <h2 id="dlgTitle"></h2>
  <p id="dlgText"></p>
  <div class="dlg-act">
    <button type="button" class="btn" id="dlgCancel">Batal</button>
    <button type="button" class="btn solid" id="dlgOk">Ya</button>
  </div>
</dialog>

<dialog id="pvDlg" class="dlg wide" aria-labelledby="pvTitle">
  <div class="dlg-h"><h2 id="pvTitle">Pratinjau</h2>
    <button type="button" class="btn ghost sm icon" id="pvClose" aria-label="Tutup pratinjau" title="Tutup"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></button></div>
  <div class="pv" id="pvBody"></div>
</dialog>`;

export const MARKUP =
  String.raw`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#080D19" id="metaTheme">
<meta name="robots" content="noindex">
<title>HyperFrames Studio</title>
<script nonce="__NONCE__">try{var t=localStorage.getItem('hf_theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<style nonce="__NONCE__">__CSS__</style>
</head>
<body>
` +
  ICONS +
  "\n" +
  SHELL_TOP +
  DASHBOARD +
  CREATE +
  MEDIA +
  RENDERS +
  SETTINGS +
  SHELL_BOTTOM +
  String.raw`
<script nonce="__NONCE__">__JS__</script>
</body>
</html>
`;