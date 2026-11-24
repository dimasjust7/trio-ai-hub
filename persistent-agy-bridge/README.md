# Persistent Agy Bridge — panduan install & jalan (laptop)

Satu proses `agy` yang hidup terus, bukan satu proses baru tiap panggilan.
Gantinya bridge lama (`@trishchuk/antigravity-mcp-server`, yang spawn `agy -p`
baru tiap call, ~30 detik/call). Bridge ini memegang SATU proses
`agy --input-format stream-json --output-format stream-json` dan semua
panggilan `ask-antigravity` dikirim ke proses itu. Perkiraan latensi:
~5-15 detik per panggilan (waktu model saja), bukan ~30 detik.

Tidak ada API baru, tidak ada biaya tambahan. Yang dipakai tetap langganan
Pro akun bodongan (model Neon), laptop, dan Tailscale.

## Cara kerja singkat

- `server.mjs` = MCP server (Node.js, satu file). Pegang satu child process
  `agy` yang hidup terus. Tool `ask-antigravity` (nama dan parameter SAMA
  seperti bridge lama: `prompt`, `model`, `effort`, `resetSession`).
- Dua mode jalan (pilih satu):
  - **HTTP daemon (DIREKOMENDASIKAN).** `node server.mjs --http --port 8999
    --host 0.0.0.0`. Server hidup sebagai daemon; semua koneksi klien berbagi
    SATU proses agy, jadi cold start cuma dibayar sekali saat daemon nyala.
    Endpoint: `POST /mcp` (MCP Streamable HTTP) dan `GET /health`.
  - **stdio + supergateway (cadangan).** `node server.mjs` (tanpa flag),
    dibungkus supergateway seperti bridge lama. Kekurangannya, SUDAH
    DIBUKTIKAN lewat tes: supergateway spawn satu server baru PER SESI
    klien, jadi agy cuma awet di dalam satu sesi. Script VM yang one-shot
    (satu sesi per jalan) tetap kena cold start tiap jalan. Pakai mode ini
    hanya kalau klien memegang satu sesi terbuka untuk banyak panggilan.
- `resetSession: true` = restart proses agy (percakapan baru). Tidak ada
  event "reset" di protokol stream-json agy (sudah dicek di docs resmi),
  jadi restart proses adalah satu-satunya cara bersih.
- Ganti `model` (atau `effort`) di tengah jalan juga restart proses, karena
  model di-pin per proses lewat flag `--model` / `--effort`.
- Kalau agy crash di tengah turn, server lapor error ke pemanggil, lalu
  otomatis spawn ulang sekali. Panggilan berikutnya jalan normal.

## 1. Install (sekali saja, di laptop)

Di PowerShell, dari folder repo trio-ai-hub:

```powershell
cd C:\Users\Admin\.gemini\antigravity\scratch\trio-ai-hub
```

Copy folder `persistent-agy-bridge` dari VM ke folder ini (isinya:
`server.mjs`, `package.json`, `README.md`, `mock-agy.mjs`,
`test-mock.py`, `test-http.py`, `mcp-http-client.py`).
Lalu install satu-satunya dependency (MCP SDK resmi):

```powershell
cd persistent-agy-bridge
npm install
```

Syarat: Node.js 18+ (laptop sudah pakai v24), dan `agy` sudah login
(sudah, akun bodongan). Tidak perlu install lain.

## 2. Stop bridge lama dulu

Gateway lama (supergateway PID 8700, `@trishchuk/antigravity-mcp-server`)
masih jalan di port 8999. Matikan dulu (Ctrl+C di jendela terminalnya),
supaya port 8999 bebas untuk daemon baru. Jangan jalankan dua-duanya di
port yang sama.

## 3. Jalanin daemon (mode yang direkomendasikan)

Di PowerShell, dari folder repo (supaya working directory agy = repo):

```powershell
cd C:\Users\Admin\.gemini\antigravity\scratch\trio-ai-hub
node persistent-agy-bridge\server.mjs --http --port 8999 --host 0.0.0.0
```

Biarkan jendela ini tetap terbuka selama mau dipakai. Daemon akan log
`persistent agy ready (model=Gemini 4 Neon (High))` saat agy sudah siap.
Panggilan pertama tetap butuh waktu (cold start sekali), panggilan
berikutnya lebih cepat.

### Mode cadangan (supergateway, kalau HTTP bermasalah)

```powershell
cd C:\Users\Admin\.gemini\antigravity\scratch\trio-ai-hub
supergateway --stdio "node persistent-agy-bridge\server.mjs" --port 8999 --host 0.0.0.0
```

Ingat: mode ini hanya awet per sesi klien (lihat atas).

## 4. Verifikasi

Dari VM (Muse yang cek):

```bash
curl --proxy "${HTTPS_PROXY%:*}:3130" http://100.127.155.110:8999/health
```

Harus balas JSON dengan `"alive": true` dan `"model": "Gemini 4 Neon (High)"`.

Lalu satu prompt tes dari VM:

```bash
MCP_URL=http://100.127.155.110:8999/mcp ~/.venvs/mcp-remote/bin/python \
  ~/workspace/trio-ai-hub/persistent-agy-bridge/mcp-http-client.py "berapa 2+2?"
```

Harus balas `Hasil dari 2 + 2 adalah 4.` (atau sejenisnya). Panggilan
kedua dari proses klien yang berbeda harus tetap cepat dan tetap pakai
proses agy yang sama (cek lewat `GET /health`: `spawnCount` tetap 1).

## 5. Berhenti / restart

- Berhenti: Ctrl+C di jendela daemon (agy ikut mati dengan bersih).
- Restart: jalankan lagi perintah di langkah 3.
- Kalau ganti model default, set env dulu baru jalanin (lihat bawah), atau
  kirim `model` lain di parameter tool (daemon restart otomatis).

## 6. Cara pakai dari VM (buat Muse)

Tool dan parameter SAMA seperti bridge lama, jadi skrip lama tidak perlu
diubah logikanya, cuma ganti transport:

- Daemon HTTP: pakai `mcp-http-client.py` (Streamable HTTP ke
  `http://100.127.155.110:8999/mcp`). Sudah ada proxy fix Tailscale di
  dalamnya, sama seperti skrip `mcp-*.py` yang lama.
- Supergateway: skrip `mcp-*.py` lama (SSE ke `http://100.127.155.110:8999/sse`)
  tetap jalan tanpa perubahan.

## 7. Env vars (opsional, semua ada default)

| Variabel | Default | Arti |
|---|---|---|
| `AGY_PATH` | `agy` | Path binary agy (kalau tidak di PATH, isi path lengkap). |
| `AGY_MODEL` | `Gemini 4 Neon (High)` | Model default, dikirim verbatim ke `agy --model`. |
| `AGY_MODEL_SLUG` | (kosong) | Kalau diisi, dipakai verbatim sebagai `--model`, lewati `AGY_MODEL`. Isi ini kalau ternyata label display tidak diterima agy (lihat "Pertanyaan terbuka"). |
| `AGY_EFFORT` | (kosong) | Effort default (`low`/`medium`/`high`/`xhigh`/`max`). |
| `AGY_CWD` | folder jalan | Working directory proses agy. |
| `AGY_PRINT_TIMEOUT` | `10m` | Batas waktu per turn (`--print-timeout`). |
| `AGY_TURN_TIMEOUT_MS` | `600000` | Batas tunggu server untuk satu `result` event; kalau lewat, turn dibatalkan dan agy di-restart. |
| `AGY_EXTRA_ARGS` | (kosong) | Flag CLI tambahan, dipisah spasi. Contoh: `--dangerously-skip-permissions` (HATI-HATI: ini auto-approve semua tool call termasuk tulis file; default mati). |

Contoh di PowerShell:

```powershell
$env:AGY_MODEL = "Gemini 4 Neon (High)"
node persistent-agy-bridge\server.mjs --http --port 8999 --host 0.0.0.0
```

## 8. Troubleshooting

- **Port 8999 sudah dipakai.** Berarti gateway lama masih jalan. Matikan
  dulu (langkah 2), baru nyalakan daemon.
- **`/health` tidak balas / timeout.** Cek: daemon masih jalan? Laptop
  masih nyala? Tailscale connect di kedua sisi? Windows Firewall: izinkan
  Node.js / port 8999 kalau diminta. Coba dulu dari laptop sendiri:
  `curl http://127.0.0.1:8999/health`.
- **`agy` gagal start / `authentication required`.** Buka satu sesi `agy`
  interaktif dulu di laptop biar kredensial ke-cache, lalu restart daemon.
- **Error `invalid model selection`.** Berarti label display
  (`Gemini 4 Neon (High)`) tidak diterima sebagai `--model` di laptop.
  Jalankan `agy models`, salin slug yang tepat, lalu set
  `AGY_MODEL_SLUG` ke slug itu dan restart daemon.
- **Daemon jalan tapi panggilan pertama lambat.** Normal: itu cold start
  satu-satunya. Panggilan berikutnya tidak kena lagi.
- **Serena buka tab dashboard tiap panggilan.** Itu dari `agy` yang
  menyalakan Serena. Klik "Disable automatic opening" di dashboard Serena
  sekali, tab tidak muncul lagi. (Tidak ada hubungannya dengan bridge ini.)

## 9. File-file di folder ini

- `server.mjs` — servernya (satu file, Node.js ESM).
- `package.json` — satu dependency: `@modelcontextprotocol/sdk`.
- `mock-agy.mjs` — agy palsu buat tes (jangan dipakai di laptop).
- `test-mock.py` — tes server mode stdio lawan mock (13 cek, lolos semua).
- `test-http.py` — tes server mode HTTP lawan mock (8 cek, lolos semua,
  termasuk bukti satu proses agy dipakai dua sesi klien yang berbeda).
- `mcp-http-client.py` — klien VM buat daemon HTTP (dipakai langkah 4).

## 10. Pertanyaan terbuka (belum bisa dijawab tanpa laptop)

- Apakah `--model "Gemini 4 Neon (High)"` (label display) diterima agy di
  laptop, atau harus slug (mis. `gemini-4-neon-high`)? Bridge lama pakai
  label dan jalan, jadi kemungkinan besar label diterima. Kalau tidak,
  pakai `AGY_MODEL_SLUG` (langkah 8).
- Apakah stream-json menghormati `--effort` yang dikirim terpisah dari
  `--model`? Docs resmi bilang iya (flag `--effort` ada di flag reference),
  tapi belum dites dengan model Neon.
- Berapa latensi nyata per panggilan di laptop (bukan mock)? Perkiraan
  docs: ~5-15 detik untuk prompt pendek. Ukur saat tes pertama.
- Apakah ada batas jumlah turn per sesi stream-json (konteks membesar)?
  Kalau percakapan sudah sangat panjang dan lambat, kirim
  `resetSession: true` sekali untuk mulai dari nol.
