/**
 * Markup dan gaya kartu "Transkrip" di halaman Media.
 *
 * Dipisah dari markup.js / styles.js supaya perubahan tidak menyentuh dua file besar itu.
 * page.js menyisipkan TRANSCRIBE_MARKUP tepat setelah kartu "Pustaka aset" dan menambahkan
 * TRANSCRIBE_STYLES setelah STYLES.
 *
 * ATURAN (sama dengan markup.js): jangan pakai backtick atau ${ di dalam String.raw, dan tidak boleh
 * ada atribut style="..." (diblokir CSP). Setiap id tr* dipakai oleh client-transcribe.js; ubah
 * bersamaan dan jalankan test/transcribe-ui.test.mjs untuk memeriksa konsistensinya.
 */

export const TRANSCRIBE_MARKUP = String.raw`
      <div class="card" id="trCard">
        <div class="h2-row"><h2 class="h2">Transkrip</h2></div>
        <p class="hint">Mengubah audio yang sudah diunggah menjadi daftar kata beserta waktu mulainya, untuk menyelaraskan teks dan animasi dengan suara. Diproses oleh GitHub Actions (whisper), biasanya beberapa menit.</p>

        <div class="field mt">
          <label for="trAudio">Audio</label>
          <select id="trAudio"></select>
          <p class="hint" id="trAudioHint"></p>
        </div>
        <div class="grid2">
          <div class="field">
            <label for="trLang">Bahasa</label>
            <select id="trLang">
              <option value="id" selected>Indonesia (id)</option>
              <option value="en">Inggris (en)</option>
              <option value="ms">Melayu (ms)</option>
              <option value="jv">Jawa (jv)</option>
              <option value="su">Sunda (su)</option>
              <option value="ar">Arab (ar)</option>
              <option value="zh">Mandarin (zh)</option>
              <option value="ja">Jepang (ja)</option>
              <option value="ko">Korea (ko)</option>
              <option value="hi">Hindi (hi)</option>
              <option value="es">Spanyol (es)</option>
              <option value="fr">Prancis (fr)</option>
              <option value="de">Jerman (de)</option>
            </select>
          </div>
          <div class="field">
            <label for="trModel">Model</label>
            <select id="trModel">
              <option value="small" selected>small (bawaan)</option>
              <option value="medium">medium (lebih akurat, lebih lama)</option>
              <option value="large-v3">large-v3 (paling akurat, paling lama)</option>
              <option value="tiny.en">tiny.en (khusus Inggris)</option>
              <option value="base.en">base.en (khusus Inggris)</option>
              <option value="small.en">small.en (khusus Inggris)</option>
              <option value="medium.en">medium.en (khusus Inggris)</option>
            </select>
          </div>
        </div>
        <p class="hint">Model berakhiran <code>.en</code> hanya untuk bahasa Inggris dan menerjemahkan bahasa lain ke Inggris. Untuk bahasa Indonesia pakai model tanpa <code>.en</code>.</p>
        <div class="actions mt-s">
          <button type="button" class="btn solid" id="trGo"><svg class="i" aria-hidden="true"><use href="#i-music"/></svg>Transkripsi</button>
        </div>
        <div id="trMsg" class="msg" role="alert" hidden></div>

        <div class="mt">
          <h3 class="h2">Riwayat transkrip</h3>
          <ul id="trList" class="rows mt-s"></ul>
          <p id="trEmpty" class="hint mt-s">Belum ada transkrip dari perangkat ini.</p>
        </div>

        <article id="trDetail" class="tr-detail" hidden aria-live="polite">
          <div class="rd-h"><code id="trId"></code><span id="trBadge" class="badge" role="status"></span></div>
          <div class="prog" id="trProg" hidden><span></span></div>
          <p id="trElapsed" class="h-meta"></p>
          <dl class="kv mt-s">
            <div><dt>Audio</dt><dd id="trKAudio">-</dd></div>
            <div><dt>Bahasa</dt><dd id="trKLang">-</dd></div>
            <div><dt>Model</dt><dd id="trKModel">-</dd></div>
            <div><dt>Jumlah kata</dt><dd id="trKWords">-</dd></div>
            <div><dt>Durasi</dt><dd id="trKDur">-</dd></div>
            <div><dt>Dimulai</dt><dd id="trKStart">-</dd></div>
          </dl>
          <div id="trNote" class="msg" hidden></div>
          <div class="actions mt">
            <a id="trLog" class="btn" href="#" target="_blank" rel="noopener noreferrer" hidden><svg class="i" aria-hidden="true"><use href="#i-ext"/></svg>Buka log di GitHub</a>
            <button type="button" class="btn" id="trRetry" hidden><svg class="i" aria-hidden="true"><use href="#i-refresh"/></svg>Coba lagi</button>
            <button type="button" class="btn" id="trReload" hidden><svg class="i" aria-hidden="true"><use href="#i-refresh"/></svg>Muat ulang hasil</button>
            <button type="button" class="btn" id="trStop" hidden><svg class="i" aria-hidden="true"><use href="#i-pause"/></svg>Berhenti memantau</button>
            <button type="button" class="btn" id="trResume" hidden><svg class="i" aria-hidden="true"><use href="#i-play"/></svg>Lanjut memantau</button>
            <button type="button" class="btn danger" id="trRemove"><svg class="i" aria-hidden="true"><use href="#i-trash"/></svg>Hapus dari riwayat</button>
          </div>

          <div id="trResult" hidden>
            <div class="actions mt">
              <button type="button" class="btn solid" id="trCopyT"><svg class="i" aria-hidden="true"><use href="#i-copy"/></svg>Salin objek T</button>
              <button type="button" class="btn" id="trCopyJson"><svg class="i" aria-hidden="true"><use href="#i-copy"/></svg>Salin JSON</button>
            </div>
            <p class="hint mt-s">Objek T memetakan tiap kata ke waktu mulainya (detik), siap ditempel ke skrip komposisi.</p>
            <div class="tr-words-wrap"><ol id="trWords" class="tr-words"></ol></div>
            <p id="trWordsNote" class="hint mt-s" hidden></p>
          </div>
        </article>
      </div>`;

export const TRANSCRIBE_STYLES = String.raw`
/* ============ Transkrip (halaman Media) ============ */
.tr-pick{background:none;border:0;padding:0;margin:0;text-align:left;cursor:pointer;font:inherit;color:inherit}
.tr-detail{margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}
.tr-words-wrap{max-height:320px;overflow:auto;margin-top:12px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface2)}
.tr-words{list-style:none;margin:0;padding:0}
.tr-word{display:flex;align-items:baseline;gap:12px;padding:6px 12px;border-bottom:1px solid var(--line)}
.tr-word:last-child{border-bottom:0}
.tr-t{flex:none;width:76px;font:12.5px var(--mono);color:var(--acc-t);font-variant-numeric:tabular-nums}
.tr-w{min-width:0;overflow-wrap:anywhere}
`;
