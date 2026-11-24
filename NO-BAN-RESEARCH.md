# Riset Anti-Ban: Cara Pakai Gemini Secara Programatik Tanpa Risiko Akun Antigravity

Tanggal: 24 Nov 2026. Tujuan: jawab pertanyaan pemilik, "pastikan tidak akan kena ban", buat pemakaian Antigravity secara programatik yang dikendalikan agen lain. Semua klaim di bawah dicek ke sumber primer yang dibaca langsung (ToS resmi, jawaban staf Google di forum resmi, halaman harga dan dokumen resmi Gemini API). Yang tidak terverifikasi ditandai.

## 1. Jawaban singkat

Tidak ada cara yang dijamin bebas ban untuk mengendalikan Antigravity (IDE atau CLI `agy`) secara programatik dari agen pihak ketiga. Jalur bridge MCP ke `agy` melanggar ketentuan consumer Google, dan Google menyatakan pelanggarannya bisa berujung suspensi atau terminasi akun Antigravity dan/atau Gemini CLI. Tidak ada kombinasi mitigasi yang bisa menjamin tidak kena ban, karena larangannya menyasar polanya, bukan seberapa agresif pemakaiannya.

Jalan yang dijamin aman ada, tapi bukan lewat Antigravity. Google sendiri menyediakan agen Antigravity terkelola lewat Gemini API (Interactions API), yang dipanggil dengan API key dan dirancang buat pemakaian programatik. Itu pengganti peran Gemini yang hands-off, tanpa menyentuh akun Antigravity sama sekali. Antigravity IDE tetap dipakai secara interaktif seperti sekarang.

## 2. Apa yang sebenarnya dilarang (kutipan persis)

### 2a. Terms of Service, Section 6 (antigravity.google/terms, dibaca langsung)

> "You must not abuse, harm, interfere with, or disrupt the Service. This includes, but is not limited to, using the Service in connection with products not provided by us. Using third party software, tools, or services to access the Service (e.g. using OpenClaw with Antigravity OAuth) is a breach of this Agreement. Such actions may be grounds for suspension or termination of your Antigravity and/or Gemini CLI accounts."

Yang dilarang: memakai software, tool, atau layanan pihak ketiga buat mengakses Service (Antigravity). Contoh yang disebut adalah OpenClaw dengan Antigravity OAuth, tapi kalimatnya umum, "third party software, tools, or services". Sanksinya: suspensi atau terminasi akun Antigravity dan/atau Gemini CLI.

### 2b. Jawaban staf Google, forum resmi, topik 198889 (dibaca langsung)

Pertanyaan: apakah aplikasi pribadi single-user interaktif yang menjalankan binary resmi `agy acp` (tidak dimodifikasi) dengan login `oauth-personal` diizinkan? Jawaban staf: ya, diizinkan, dengan batasan berikut.

> "Single-User Interactive Use Only: Do not use the client for unattended background automation, multi-user serving, automated account rotation, or wrapping `agy` as a sub-agent inside another third-party coding agent loop."

Jadi yang diizinkan adalah pemakaian interaktif single-user. Yang dilarang secara eksplisit antara lain: otomasi background tanpa pengawasan, dan membungkus `agy` sebagai sub-agent di dalam loop agen coding pihak ketiga. Pola hands-off yang dicari pemilik (Muse mengendalikan Antigravity dari VM) masuk ke dua larangan itu sekaligus.

### 2c. Jawaban staf Google, forum resmi, topik 189905, 16 Okt 2026 (dibaca langsung)

Ini jawaban paling menentukan, karena penanya mengajukan konfigurasi yang hampir identik dengan rencana pemilik (binary resmi tanpa modifikasi, tanpa ekstraksi token, tanpa MCP bridge, tanpa rotasi akun, single-user, frekuensi rendah, pemakaian berurutan), dan staf tetap menjawab tidak.

> "The Antigravity FAQ reflects our current policy for Antigravity CLI headless mode and supersedes earlier forum comments where they differ."

> "Wrapping `agy` Inside Third-Party Coding Agents or Applications (Claude Code, Codex, OpenClaw, OpenCode), Not Supported: No under consumer plans. Even if you invoke the official, unmodified `agy` binary as a local subprocess without extracting OAuth tokens or reverse-engineering internal endpoints, wrapping `agy` inside third-party coding agents or applications, or automating account rotation,is not supported under consumer plans."

> "Using third-party coding agents or tools (such as Claude Code, OpenClaw, or OpenCode) to access Antigravity violates our Terms of Service and can result in account suspension or termination."

Dan alternatif yang direkomendasikan staf:

> "If you want to call Gemini models from a third-party coding agent or external orchestrator, we recommend using a Gemini Enterprise or Google AI Studio API key."

Yang diizinkan di jawaban yang sama: skrip lokal langsung dan CI (`agy -p`) milik pemilik sendiri. Yang tidak diizinkan: `agy` dibungkus di dalam agen coding pihak ketiga.

### 2d. Koreksi atas jawaban forum yang lebih lama

Ada jawaban staf 7 Okt 2026 (topik 186246) yang terkesan membolehkan koordinator lokal meluncurkan `agy`. Jawaban 16 Okt 2026 di atas menyatakan FAQ menggantikan komentar forum sebelumnya kalau ada perbedaan. Jadi bacaan yang berlaku sekarang adalah yang di 2c, bukan yang 7 Okt. Mengandalkan jawaban 7 Okt adalah kesalahan.

### 2e. Batas yang diizinkan, ringkasnya

- Diizinkan: memakai IDE Antigravity secara interaktif; memakai `agy acp` di editor yang didukung (Zed, JetBrains, VS Code, Xcode, Android Studio) secara interaktif single-user; menjalankan `agy -p` dari skrip atau CI milik sendiri.
- Diizinkan dan direkomendasikan: memanggil model Gemini dari agen pihak ketiga memakai Google AI Studio API key atau Gemini Enterprise.
- Tidak diizinkan (consumer plan): agen coding pihak ketiga mengendalikan `agy` atau Antigravity, termasuk lewat MCP bridge, proxy, atau relay. Larangan ini menyasar pola pemakaiannya, bukan soal token diekstrak atau tidak, dan bukan soal frekuensinya.

## 3. Penegakan: apa yang terjadi kalau melanggar

### 3a. Yang dinyatakan resmi

Sanksi yang tertulis di ToS Section 6 dan ditegaskan staf forum: suspensi atau terminasi akun Antigravity dan/atau Gemini CLI. Cakupan sanksinya penting dan menenangkan sebagian: menurut jawaban staf (topik 197131), penegakan berlaku pada akses layanan Antigravity dan/atau Gemini CLI, bukan menonaktifkan seluruh Akun Google. Gmail dan layanan Google lain tidak disebut sebagai sasaran klausul ini. Tapi perlu dicatat: akun Gemini CLI ikut disebut, jadi pelanggaran di Antigravity bisa merembet ke Gemini CLI.

### 3b. Bukti penegakan nyata

Di sini saya harus jujur soal batas bukti. Saya TIDAK menemukan bukti primer (pengumuman resmi Google atau laporan staf) tentang ban yang spesifik menimpa pola MCP-bridge ke `agy`. Yang ada:

- Laporan komunitas (sumber sekunder, tidak terverifikasi ke sumber primer): gelombang suspensi massal Februari 2026 yang dilaporkan blog aihackers.net dan zentor.ai, dan klaim maintainer package PyPI `hermes-antigravity` yang menyatakan pernah mengalami ban akun. Saya tidak bisa memverifikasi klaim-klaim ini ke sumber resmi, jadi jangan jadikan itu fakta.
- Laporan pengguna di forum resmi (topik 189905, komentar Jay10): ia sempat memakai `agy -p` lewat coding assistant, lalu berhenti setelah tahu aturannya dan pindah ke API key. Ia tidak melaporkan kena ban.
- Yang pasti dari sumber primer: aturannya jelas, dan konsekuensi yang dinyatakan adalah suspensi atau terminasi. Tidak adanya laporan ban buat pola ini bukan bukti aman. Google tidak mempublikasikan kebijakan notifikasi atau ambang deteksinya.

Kesimpulan bagian ini: risiko itu nyata dan dinyatakan resmi, tapi probabilitas dan waktu penegakan buat pola ini tidak terdokumentasi secara publik. Jangan menafsirkan "belum kena" sebagai "aman".

## 4. Apakah ada jalur resmi programatik ke Antigravity?

Tidak ada API publik resmi buat IDE atau CLI Antigravity. Yang resmi tersedia adalah: IDE interaktif, ACP di editor yang didukung, dan `agy -p` buat skrip/CI milik sendiri. Buat agen pihak ketiga, Google mengarahkan ke Gemini API key atau Gemini Enterprise.

Tapi ada temuan penting: Google menyediakan **agen Antigravity terkelola** lewat Gemini API. Ini bukan IDE di laptop, melainkan agen dengan harness yang sama seperti IDE Antigravity, yang jalan di sandbox Linux milik Google dan dipanggil lewat satu API call. Dokumen resmi AI Studio (aistudio.google.com/docs/antigravity-agent, dibaca langsung):

> "The Antigravity agent is a general-purpose managed agent on the Gemini API. A single API call gives you an agent that reasons, executes code, manages files, and browses the web inside your own secure Linux sandbox, hosted by Google."

> "It is built with Gemini 4 Hydrogen and uses the same harness as the Antigravity IDE."

Cara pakainya (dari dokumen yang sama): `client.interactions.create(agent="antigravity-preview-09-2026", input="...", environment="remote")`, atau REST `POST https://generativelanguage.googleapis.com/v1beta/interactions` dengan header `x-goog-api-key`. Kemampuannya: eksekusi kode (Bash, Python, Node.js), manajemen file di sandbox, Google Search, fetch URL, context compaction, custom functions, dan MCP server eksternal sebagai tool. Ada kontrol anggaran (`max_total_tokens` di `agent_config`) dan streaming SSE. Statusnya preview, dan harganya pay-as-you-go berdasarkan token model dan tool yang dipakai; proyek free tier mendapat free rate limit dan kuota.

Ini adalah jalur resmi dan programatik buat "Antigravity" sebagai agen, tanpa menyentuh IDE, CLI, atau OAuth consumer sama sekali.

## 5. Alternatif yang aman: Gemini API langsung

### 5a. Kenapa jalur ini bebas risiko ban

Gemini API (Gemini Developer API) adalah produk developer yang dirancang buat pemakaian programatik dengan API key. Staf Google secara eksplisit merekomendasikannya buat agen coding pihak ketiga (lihat 2c). Pemakaian ini tidak menyentuh OAuth Antigravity, tidak memakai langganan Google AI Pro, dan tidak tunduk pada ToS Section 6 Antigravity. Yang berlaku adalah ketentuan Gemini API, yang memang memperbolehkan pemakaian programatik.

### 5b. Yang dibutuhkan

1. Akun Google dan akses ke Google AI Studio (aistudio.google.com).
2. Buat API key di AI Studio (menu Get API key). Tidak perlu billing buat free tier.
3. Key disimpan lewat jalur aman Muse (Secure Vault / connector flow), bukan ditempel di chat. Jangan pernah kirim API key lewat pesan chat.
4. Di VM, Muse memanggil API dengan SDK Python `google-genai` atau curl biasa. Tidak butuh Tailscale, tidak butuh laptop menyala, tidak butuh instalasi di laptop.

### 5c. Model dan biaya (halaman harga resmi aistudio.google.com/docs/pricing, dibaca langsung 24 Nov 2026)

Free tier: token input dan output gratis buat model yang tercantum, tanpa billing. Limitnya diukur per proyek (requests per minute, tokens per minute, requests per day) dan ditampilkan di AI Studio per proyek, bukan tabel publik. Google tidak mempublikasikan angka pastinya. Catatan penting: konten di free tier bisa dipakai Google untuk meningkatkan produknya (dan bisa dibaca human reviewer), jadi jangan kirim PII atau data rahasia di free tier.

Model yang relevan (harga berbayar per 1 juta token, input / output):

- Gemini 3.8 Flash (`gemini-3.8-flash`): free tier gratis. Berbayar $0.75 / $3.75 sampai 31 Des 2026, lalu $1.50 / $7.50 mulai 1 Jan 2027. Model Flash paling pintar saat ini, dibuat buat software engineering dan agen otonom.
- Gemini 2.5 Pro (`gemini-2.5-pro`): free tier gratis, berbayar $1.25 / $10.00 (prompt sampai 200k token). Perhatian: deprecated, dan mulai 1 Des 2026 request otomatis dialihkan ke Gemini 3.8 Flash dengan harga 3.8 Flash. Jangan jadikan ini model utama.
- Gemini 2.5 Flash (`gemini-2.5-flash`): free tier gratis, berbayar $0.30 / $2.50. Juga deprecated, mulai 1 Des 2026 dialihkan ke Gemini 3.5 Flash-Lite.
- Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`): free tier gratis, berbayar $0.30 / $2.50. Pilihan murah buat tugas rutin.
- Gemini 4 Carbon/Argon/Neon dan Gemini 3.1 Pro Preview: berbayar saja, tidak ada free tier.

Paid tier: perlu billing account dan prepay minimal $5. Batch API diskon 50 persen.

Contoh hitungan: satu tugas trio yang memakai 50.000 token input dan 10.000 token output di Gemini 3.8 Flash berbayar: 50.000 x $0.75/1.000.000 = $0,0375, ditambah 10.000 x $3.75/1.000.000 = $0,0375, total sekitar $0,075 per tugas. Di free tier biayanya $0 selama masih dalam limit.

### 5d. Apa yang hilang dibanding IDE Antigravity, dan apakah Muse menutupnya

Yang hilang:

- Akses langsung ke file laptop. Agen API jalan di sandbox Google, bukan di laptop. File harus dikirim sebagai sumber inline atau dikerjakan di sandbox-nya sendiri.
- UI IDE dan pengawasan interaktif pemilik di dalam IDE.
- Kuota langganan Google AI Pro. API memakai tier-nya sendiri (free/paid), bukan kuota Pro.
- Model Claude. Tapi ini bukan kehilangan nyata buat peran ini, karena ACP pun hanya memberi model Gemini di luar IDE resmi.

Yang Muse tutup sendiri:

- Muse sudah punya terminal, file, dan tool di VM. Muse bisa mengirim isi file repo sebagai sumber inline ke agen API, menerima output agen, menerapkannya ke repo, lalu memverifikasi di disk dengan `git diff` dan menjalankan tes.
- Peran implementor dan opini kedua keluarga Gemini tetap terpenuhi, hanya lokasi eksekusinya pindah dari laptop ke sandbox Google.
- Repo git tetap jadi tempat bertemunya semua hasil kerja.

## 6. Mitigasi buat jalur bridge (kalau pemilik tetap mau)

Kalau pemilik tetap ingin membangun MCP bridge ke `agy`, ini mitigasi yang mengurangi risiko praktis, tapi baca penilaian jujurnya setelah daftar ini.

1. Pakai binary resmi tanpa modifikasi, jangan ekstrak atau teruskan token OAuth ke mana pun.
2. Minta persetujuan manusia sebelum setiap pemanggilan, dan batasi ke tugas yang pemilik awasi.
3. Batasi frekuensi dan konkurensi: satu pemanggilan berurutan dalam satu waktu, jangan polling atau loop tanpa pengawasan, jangan jalankan banyak proses `agy` bersamaan.
4. Batasi volume: sedikit tugas per hari, jauh di bawah kuota 5 jam dan mingguan.
5. Pakai hanya buat review atau rencana, bukan implementasi bervolume besar.
6. Jangan pajang ke publik atau multi-user, jangan rotasi akun, jangan lewati rate limit.
7. Siapkan jalan keluar: simpan semua hasil kerja di repo git (sudah begitu), dan siapkan API key Gemini sebagai cadangan supaya kerja tidak berhenti kalau akses Antigravity dicabut.
8. Hentikan pemakaian bridge segera kalau muncul error 403, 429, atau peringatan ToS.

**Penilaian jujur: tidak ada kombinasi mitigasi di atas yang bisa menjamin tidak kena ban.** Alasannya dari sumber primer: staf Google di topik 189905 sudah menjawab konfigurasi yang paling hati-hati sekalipun (binary resmi, tanpa ekstraksi token, tanpa bridge, tanpa rotasi akun, single-user, frekuensi rendah) dengan "not supported" dan "violates our Terms of Service and can result in account suspension or termination". Larangannya menyasar pola pemakaian (agen pihak ketiga mengendalikan `agy`), bukan seberapa agresif pemakaiannya. Mitigasi hanya mengurangi kemungkinan terdeteksi atau kehabisan kuota, bukan mengubah status pelanggarannya.

Satu-satunya "mitigasi" yang benar-benar menghilangkan pelanggaran adalah menghilangkan pengendalinya dari pihak ketiga, yaitu pemilik sendiri yang menjalankan `agy` atau skripnya. Tapi itu justru mengembalikan ke workflow sekarang (pemilik menempel prompt), dan berarti bukan hands-off lagi. Jadi pilihannya biner: patuh dan tidak hands-off lewat Antigravity, atau hands-off lewat Antigravity dan melanggar ketentuan.

## 7. Rekomendasi (satu)

**Jangan bangun MCP bridge ke Antigravity. Ganti peran Gemini hands-off ke Gemini API, terutama agen Antigravity terkelola lewat Interactions API.**

Peran baru trio:

- Muse (koordinator, eksekutor, verifier): tetap. Muse yang memanggil Gemini API langsung dari VM, menerapkan hasilnya ke repo, dan memverifikasi di disk.
- Gemini API, agen Antigravity terkelola (`antigravity-preview-09-2026`): implementor dan opini kedua keluarga Gemini yang hands-off. Dipanggil Muse dengan API key pemilik. Ini pengganti peran Antigravity di jalur hands-off.
- Antigravity IDE (laptop): tetap sebagai implementor interaktif buat tugas yang pemilik kerjakan sendiri di laptop, dengan cara menempel prompt seperti sekarang. Tidak ada yang berubah di sini, dan pemakaian ini diizinkan.
- Kiro (validator, Sonnet 5.5 / Haiku 5.5): tetap lewat browser task oleh Muse, seperti yang sudah disepakati.

Langkah setup:

1. Pemilik buka Google AI Studio (aistudio.google.com), login dengan akun Google, buat satu API key baru. Tidak perlu billing buat mulai (free tier).
2. Simpan API key lewat jalur aman Muse (Secure Vault / connector flow), bukan lewat chat. Parent agent yang mengatur penyimpanannya.
3. Muse menguji satu pemanggilan kecil dari VM (misal `gemini-3.8-flash` menjawab satu kalimat, lalu satu pemanggilan agen Antigravity dengan `max_total_tokens` kecil) dan melaporkan biaya dan hasilnya.
4. Perbarui `PROTOCOL.md` dan `AGENTS.md` di trio-ai-hub: peran implementor hands-off pindah dari "Antigravity IDE via bridge" ke "Gemini API (agen Antigravity terkelola)"; Antigravity IDE dicatat sebagai implementor interaktif saja.
5. Tugas pertama yang memakai jalur baru dicatat sebagai T-001, dengan biaya API dilaporkan per tugas seperti biaya kredit Kiro.

## Sumber

- Google Antigravity Additional Terms of Service, Section 6: https://antigravity.google/terms (dibaca langsung 24 Nov 2026).
- Forum resmi Google, topik 198889, jawaban staf soal `agy acp` interaktif: https://discuss.ai.google.dev/t/personal-app-using-the-official-agy-acp-binary-with-google-ai-pro-permitted/198889 (dibaca langsung).
- Forum resmi Google, topik 189905, jawaban staf soal `agy` di agen pihak ketiga dan FAQ yang menggantikan komentar lama: https://discuss.ai.google.dev/t/clarification-on-consumer-plan-policy-for-invoking-official-agy-via-local-subprocess/189905/1 (dibaca langsung).
- Forum resmi Google, topik 197131, jawaban staf soal cakupan penegakan (akun Antigravity dan/atau Gemini CLI, bukan seluruh Akun Google): https://discuss.ai.google.dev/t/conflicting-guidance-on-using-t3-code-with-personal-google-ai-subscriptions/197131/3 (dibaca dari hasil pencarian).
- Forum resmi Google, topik 186246, jawaban staf 7 Okt 2026 yang sudah digantikan FAQ: https://discuss.ai.google.dev/t/can-a-local-ai-coordinator-launch-the-official-antigravity-cli-with-subscription-sign-in/186246/2 (dibaca dari hasil pencarian).
- Dokumen resmi Antigravity agent, Gemini API: https://aistudio.google.com/docs/antigravity-agent (dibaca langsung).
- Halaman harga resmi Gemini Developer API: https://aistudio.google.com/docs/pricing (dibaca langsung).
- Laporan komunitas soal gelombang suspensi Februari 2026 (sumber sekunder, tidak terverifikasi ke primer): https://aihackers.net/verify/openclaw-google-policy/ dan https://zentor.ai/blog/antigravity-account-suspended-third-party.
