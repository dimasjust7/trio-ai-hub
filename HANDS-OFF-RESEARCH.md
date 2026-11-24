# Riset Hands-Off: Muse mengendalikan Antigravity dan Kiro langsung

Tanggal: 24 Nov 2026. Tujuan: cari cara supaya Muse bisa mengendalikan Antigravity (laptop Windows) dan Kiro (web) secara langsung, tanpa pemilik menempel prompt manual. Semua klaim di bawah dicek ke sumber primer (README repo, dokumen resmi, atau tool itu sendiri). Yang tidak terverifikasi ditandai.

## Ringkasan dan rekomendasi

**Pemenang teknis: Tailscale + bridge MCP trishchuk (`agy`) + gateway stdio-ke-SSE + client MCP Python di VM.**

Rangkaiannya: di laptop, install `agy` CLI resmi dan package npm `@trishchuk/antigravity-mcp-server`, jalankan server MCP itu di balik gateway (supergateway atau mcp-proxy) supaya bisa diakses lewat HTTP/SSE di alamat Tailscale laptop. Di VM, Muse memakai client MCP Python (SDK `mcp`) untuk memanggil tool `ask-antigravity` / `delegate-antigravity` lewat Tailscale. Kiro tetap lewat browser task seperti sekarang, karena jalur itu sudah cukup dan tidak perlu diubah.

**Tapi ada satu peringatan besar yang harus dibaca dulu.** Jawaban resmi Google di forum Antigravity menyatakan batas pemakaian `agy`: hanya untuk pemakaian interaktif single-user, dan melarang "unattended background automation" serta "wrapping `agy` as a sub-agent inside another third-party coding agent loop". Mengendalikan Antigravity secara hands-off dari Muse persis masuk ke pola yang dilarang itu. Jadi jalur ini secara teknis bisa dibangun, tapi membawa risiko melanggar ketentuan Antigravity. Versi yang paling dekat dan tetap aman adalah workflow repo git yang sudah berjalan sekarang (pemilik menempel prompt, Antigravity bekerja interaktif di IDE-nya sendiri). Keputusan memakai bridge atau tidak ada di tangan pemilik.

## 1. Kendali langsung Antigravity

### 1a. trishchuk/antigravity-mcp-server (pemenang)

- **Sumber terverifikasi:** package npm `@trishchuk/antigravity-mcp-server` v0.3.0, lisensi MIT, deskripsi dan daftar tool dibaca dari README di dalam tarball npm. Koreksi penting: repo GitHub `trishchuk/antigravity-mcp-server` mengembalikan 404 (dicek langsung). Repo yang benar menurut `package.json` adalah `github.com/x51xxx/antigravity-mcp-server`. Distribusi kanoniknya adalah npm, bukan GitHub.
- **Cara kerja:** server MCP (Node.js >= 18) yang menjalankan Antigravity CLI (`agy`) sebagai subprocess dalam mode print (`agy -p`). `agy -p` adalah mode non-interaktif resmi: menjalankan satu prompt dan mencetak jawaban.
- **Tool yang diekspos:** `ask-antigravity`, `plan-antigravity`, `review-changes`, `brainstorm`, `digest-antigravity`, `batch-antigravity`, `bg-antigravity`, `delegate-antigravity` (tugas panjang di git worktree terpisah, model Orchestrator), `list-sessions`, `list-models`, `health`, plus `ping`, `version`, `metrics`. `delegate-antigravity` paling cocok buat peran implementor: mengembalikan status, menerima follow-up, dan mengembalikan laporan akhir plus diff.
- **Yang harus ada di laptop:** Node.js >= 18, `agy` CLI terinstall dan sudah login (jalankan `agy` sekali secara interaktif, sign in akun Google), dan git (untuk worktree). `agy` resmi tersedia untuk Windows (installer PowerShell dan CMD, terverifikasi di dokumen resmi Antigravity).
- **Transport:** stdio saja (dijalankan lewat npx). Server ini tidak membuka port. Supaya bisa dijangkau dari jarak jauh, harus ditaruh di balik gateway stdio-ke-SSE/HTTP (lihat bagian 1d).
- **Windows:** README tidak menyebut Windows sama sekali. Kompatibilitas Windows belum terverifikasi dan harus dites di laptop. Dependensi `cross-spawn` membantu spawn lintas platform, tapi penghentian process group memakai SIGTERM/SIGKILL (sinyal Unix) yang perilakunya berbeda di Windows.

### 1b. qiansexingqiu/antigravity-mcp (cadangan, macOS saja)

- **Sumber terverifikasi:** README dan `server.py` lengkap dibaca dari repo (branch main, MIT, terakhir update 2026-10-02).
- **Cara kerja:** menemukan language server Antigravity yang sedang jalan, lalu mengendalikannya lewat binary `~/.gemini/antigravity/bin/agentapi` (`new-conversation` / `send-message`), dan membaca jawaban dari file transcript di `~/.gemini/antigravity/brain/`. Satu tool: `ask_antigravity` (prompt, model flash/pro/flash_lite, `conversation_id` buat multi-turn).
- **Transport:** punya mode SSE bawaan (`server.py --sse --port=8999`, bind 127.0.0.1 saja). Remote lewat SSH `RemoteForward`.
- **Kenapa bukan pemenang:** README menyatakan eksplisit "Requires macOS". Discovery-nya memakai `ps -eo pid,args` dan `lsof` (keduanya tidak ada di Windows, diverifikasi dari isi `server.py`). Ada jalan pintas env var (`ANTIGRAVITY_LS_ADDRESS` dan `ANTIGRAVITY_CSRF_TOKEN`) yang melewati discovery, tapi pemilik harus mencari port dan token secara manual setiap aplikasi restart. Folder `~/.gemini/antigravity` memang ada di laptop pemilik, tapi binary `agentapi` versi Windows belum terverifikasi. Jadi bridge ini butuh ubahan kode buat Windows. Tidak direkomendasikan buat laptop ini.

### 1c. Server ACP resmi (`agy acp`)

- **Sumber terverifikasi:** dokumen resmi Antigravity. `agy acp` menjalankan server Agent Client Protocol, JSON-RPC lewat stdin/stdout. Editor meluncurkannya sebagai subprocess. Autentikasi memakai kredensial yang di-cache (`agy acp --login`). Model Gemini tersedia di semua client.
- **Penilaian:** ACP adalah stdio lokal, bukan network, jadi tetap butuh jembatan buat dijangkau dari jarak jauh. Lebih penting, jawaban resmi Google di forum (diverifikasi langsung dari halaman forum) menetapkan batas: "Single-User Interactive Use Only: Do not use the client for unattended background automation, multi-user serving, automated account rotation, or wrapping `agy` as a sub-agent inside another third-party coding agent loop." Itu persis pola yang dicari di riset ini. Jadi rute ACP/agy membawa risiko ketentuan, bukan cuma soal teknis.
- **Catatan:** `agy --remote-agent` (v1.5.2) menjalankan percakapan di remote agent, arahnya terbalik (agy yang mendelegasikan ke luar, bukan dikendalikan dari luar). Tidak dikejar lebih jauh.

### 1d. Gateway stdio-ke-SSE (bagian yang menutup celah transport)

Server trishchuk hanya bicara stdio, jadi butuh gateway di laptop yang mengeksposnya lewat HTTP/SSE. Dua package npm terverifikasi ada dan cocok:

- `supergateway` v4.2.4: "Run MCP stdio servers over SSE, Streamable HTTP or visa versa".
- `mcp-proxy` v6.11.0: "A TypeScript SSE proxy for MCP servers that use stdio transport".

Pola jalan: `supergateway --stdio "npx -y @trishchuk/antigravity-mcp-server" --port 8999 --host 0.0.0.0` (perintah persisnya dicek saat setup, belum dijalankan di sini). Gateway harus bind ke alamat Tailscale laptop (0.0.0.0), bukan loopback saja, supaya VM bisa menjangkaunya.

## 2. Jalur network VM ke laptop: Tailscale (pemenang)

- **Sumber terverifikasi:** dokumen konektor Tailscale di VM dan status langsung (`/opt/hatch/bin/tailscale status` mengembalikan "Not connected", login server controlplane.tailscale.com).
- **Cara kerja di VM:** client Tailscale bawaan hanya bisa koneksi TCP keluar, tidak menerima koneksi masuk dan tidak me-host apapun. Service di tailnet dijangkau lewat proxy runtime dengan port diubah ke 3130, contoh: `curl --proxy "${HTTPS_PROXY%:*}:3130" "http://<alamat-tailnet>:<port>/<path>"`. Networking biasa tidak mencapai tailnet.
- **Setup:** (1) di VM jalankan `/opt/hatch/bin/tailscale up`, pemilik menyetujui link yang muncul; (2) di laptop install Tailscale for Windows, login dengan akun yang sama, gabung ke tailnet yang sama; (3) VM memanggil alamat Tailscale laptop (100.x) lewat proxy port 3130. Request pertama ke tiap alamat butuh persetujuan pemilik.
- **Alternatif yang kalah:**
  - SSH `RemoteForward` (cara yang disarankan README qian): butuh VM yang menjalankan SSH server dan bisa dijangkau laptop. VM ini tidak punya endpoint SSH publik. Tidak viable tanpa infrastruktur tambahan.
  - ngrok / Cloudflare Tunnel: bisa mengekspos port MCP laptop ke internet publik, tapi server SSE qian tidak punya autentikasi sama sekali, jadi itu sama dengan membuka eksekusi kode jarak jauh tanpa kunci. Berbahaya. Tailscale menang karena privat dan terautentikasi, tanpa eksposur publik.

## 3. Client MCP di VM

- **Keadaan sekarang (terverifikasi dari isi file):** client di `~/workspace/custom-connectors/custom.konoha/bin/client.py` hanya stdio, raw JSON-RPC newline-delimited, protocol version 2025-03-26. Client itu men-spawn server sebagai child process, jadi tidak bisa bicara ke server jarak jauh.
- **Yang dibutuhkan buat SSE jarak jauh:** package Python SDK resmi `mcp` (terverifikasi tersedia di PyPI, versi terbaru 2.3.0, butuh Python >= 3.10; Python VM adalah 3.12.3, terverifikasi). SDK ini menyediakan `mcp.client.sse.sse_client` dan `mcp.client.streamable_http.streamablehttp_client` plus `ClientSession`. SDK ini belum terinstall di VM (dicek: `No module named 'mcp'`), begitu juga `httpx` dan `sseclient`.
- **Bentuk client-nya (feasibility, bukan kode jadi):** install `mcp` di venv (`pip install mcp`), lalu skrip sekitar 40 baris: buka `sse_client` ke URL SSE lewat proxy Tailscale, `initialize`, `tools/list`, `tools/call` dengan nama tool dan argumen, lalu tutup. Alurnya sama dengan `client.py` yang sudah ada, hanya transportnya HTTP/SSE, bukan stdio. Raw HTTP + JSON-RPC juga mungkin (handshake SSE: GET /sse mengembalikan URL endpoint, lalu POST JSON-RPC ke sana), tapi SDK adalah jalan yang wajar. Client lengkap tidak ditulis di riset ini sesuai penugasan.

## 4. MausBot sebagai host alternatif

- **Fakta terverifikasi:** MausBot bisa menjalankan Antigravity sebagai engine (lewat server ACP resmi). Perintah `openmausbot mcp` mengekspos MCP control plane stdio lokal yang bicara ke server MausBot di `http://127.0.0.1:8799`. Agen luar bisa list bot, kirim pesan, ganti model, menunggu balasan, dan menginterupsi turn. Kontrol berisiko tinggi (approval, ubah kredensial, hapus) sengaja dikunci dari MCP.
- **Penilaian:** lebih buruk daripada bridge langsung. Alasannya: (1) control plane-nya lokal saja (127.0.0.1:8799, menolak plain HTTP di host non-privat), jadi tetap butuh Tailscale, masalah network yang sama; (2) menambah satu lapis penuh (aplikasi MausBot + harness + model approval-nya sendiri) di atas Antigravity; (3) Muse tetap tidak bisa berjalan di dalam MausBot; (4) tidak menghilangkan masalah ketentuan (tetap agen lain yang mengendalikan Antigravity). Tidak direkomendasikan.

## 5. Rencana tes end-to-end (checklist berurutan)

Laptop (Windows, pemilik):

1. Install `agy` CLI resmi untuk Windows, jalankan `agy --version`, lalu `agy` sekali secara interaktif dan sign in akun Google. Verifikasi: `agy --version` mencetak versi.
2. Install Node.js >= 18. Verifikasi: `node --version`.
3. Install bridge: `npm install -g @trishchuk/antigravity-mcp-server`. Verifikasi: `antigravity-mcp --help` atau `npx -y @trishchuk/antigravity-mcp-server --help` merespons (belum dijalankan di sini).
4. Tes lokal dulu: jalankan server MCP secara stdio dan panggil `health` atau `ask-antigravity` dengan prompt kecil dari client MCP lokal. Verifikasi: jawaban kembali. Langkah ini membuktikan bridge jalan di Windows sebelum network dilibatkan. Belum terverifikasi.
5. Install gateway: `npm install -g supergateway` (atau mcp-proxy). Jalankan gateway dengan host 0.0.0.0 dan port 8999, membungkus server trishchuk. Verifikasi: `curl http://127.0.0.1:8999/sse` dari laptop merespons stream SSE. Belum terverifikasi.
6. Install Tailscale for Windows, login akun yang sama, catat alamat Tailscale laptop (100.x).

VM:

7. Jalankan `/opt/hatch/bin/tailscale up`, pemilik menyetujui link. Verifikasi: `/opt/hatch/bin/tailscale status` menampilkan laptop.
8. Tes konektivitas: `curl --proxy "${HTTPS_PROXY%:*}:3130" "http://<alamat-tailnet-laptop>:8999/sse"`. Verifikasi: merespons stream SSE. Pemilik menyetujui request pertama ke alamat itu.
9. Buat venv dan install SDK: `python3 -m venv ~/.venvs/mcp-remote && ~/.venvs/mcp-remote/bin/pip install mcp`. Verifikasi: `python3 -c "from mcp.client.sse import sse_client"` tidak error.
10. Tulis client MCP SSE kecil (initialize, tools/list, tools/call `ask-antigravity` dengan prompt "jawab dengan satu kalimat: berapa 2+2?"). Jalankan dari VM. Verifikasi: jawaban Antigravity kembali lewat Tailscale. Ini bukti end-to-end.
11. Kalau langkah 10 lolos, ulangi dengan `delegate-antigravity` untuk tugas kecil di repo trio-ai-hub, lalu verifikasi hasilnya lewat `git pull` di VM.

## 6. Blocker dan batas jujur

- **Ketentuan Antigravity (blocker terbesar, non-teknis).** Jawaban resmi Google melarang pemakaian `agy` buat "unattended background automation" dan "wrapping `agy` as a sub-agent inside another third-party coding agent loop". Rencana hands-off ini masuk ke kedua pola itu. Jalur ini bisa dibangun secara teknis, tapi pemilik harus sadar dan menerima risiko ketentuan tersebut. Workflow repo git yang sudah berjalan tidak melanggar ini, karena Antigravity bekerja interaktif di IDE-nya sendiri atas file yang pemilik buka.
- **Windows belum terverifikasi.** Bridge qian eksplisit macOS saja. Bridge trishchuk tidak menyebut Windows dan belum pernah dites di laptop ini. Ada kemungkinan butuh penyesuaian kecil (path, sinyal proses, cara spawn `agy`).
- **Transport trishchuk.** Servernya stdio saja, jadi butuh gateway tambahan (supergateway/mcp-proxy) yang juga harus dipasang dan dijaga tetap jalan di laptop.
- **Yang tetap butuh pemilik:** install Node.js, `agy`, bridge, gateway, dan Tailscale di laptop; sign in Antigravity dan Tailscale; menyetujui join Tailscale dan request pertama ke alamat laptop; laptop harus menyala dan Antigravity/bridge/gateway harus jalan setiap kali Muse mau memanggil. Tidak ada jalan yang menghilangkan semua ini.
- **Kiro: sudah cukup lewat browser task, tidak perlu didesain ulang.** Jalur yang sudah disepakati (Muse memakai browser task, login, menempel tugas sebagai teks, Kiro memberi vonis, Muse verifikasi di disk) sudah memadai buat Muse menangani Kiro sepenuhnya tanpa pemilik. Yang bisa menghambat hanya hal operasional: sesi login Google kedaluwarsa, 2FA, atau Kiro web error sehingga brief harus dikirim ulang kata demi kata. Browser task menangani login ulang lewat login tersimpan atau kartu entri aman. Satu catatan jujur: eksekusi browser Kiro end-to-end belum pernah dijalankan dalam sesi ini, jadi kelancaran login pertama masih berstatus belum terverifikasi.
- **Apakah hands-off penuh bisa dicapai?** Tidak penuh. Versi terdekat yang bisa dicapai: Muse mengendalikan Antigravity lewat bridge + Tailscale (teknis bisa, Windows belum terverifikasi, risiko ketentuan), dan Muse menangani Kiro lewat browser task (sudah siap). Pemilik tetap harus instalasi awal, menjaga laptop menyala, dan menyetujui akses network. Kalau ketentuan dan beban setup itu tidak diterima, versi terdekat yang patuh adalah workflow sekarang: repo git + pemilik menempel prompt ke Antigravity, sementara Kiro tetap dipegang Muse lewat browser.

## Sumber

- README dan `package.json` `@trishchuk/antigravity-mcp-server` v0.3.0 (npm registry, dibaca dari tarball). Repo GitHub `trishchuk/antigravity-mcp-server` 404; repo benar menurut package.json: `github.com/x51xxx/antigravity-mcp-server`.
- README dan `server.py` `qiansexingqiu/antigravity-mcp` (branch main, MIT).
- Dokumen resmi Antigravity: ACP (`antigravity.google/docs/cli/acp/`), get started CLI (`antigravity.google/docs/getting-started?tab=cli`, installer Windows terkonfirmasi).
- Jawaban forum resmi Google soal batas pemakaian `agy acp` (discuss.ai.google.dev, topik 198889).
- Dokumen konektor Tailscale (`/opt/hatch/connectors/tailscale/CONNECTOR.md`) dan status langsung di VM.
- PyPI `mcp` 2.3.0 (dicek lewat API JSON, tanpa install).
- npm `supergateway` 4.2.4 dan `mcp-proxy` 6.11.0 (dicek lewat registry).
- Dokumen dan ulasan MausBot soal `openmausbot mcp` (control plane stdio, server lokal 127.0.0.1:8799).
