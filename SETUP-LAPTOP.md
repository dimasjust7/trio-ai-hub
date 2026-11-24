# Setup Laptop (Windows) — Trio AI Hub

## Yang dibutuhkan

- Git terinstall.
- Antigravity terinstall dan login.
- Akun GitHub (buat repo bersama) atau Google Drive.
- Kiro sudah bisa diakses lewat browser (akun backup dimasjust77@gmail.com).

## Langkah 1: Clone repo ini

Buka terminal (PowerShell atau Git Bash) di laptop, lalu:

```
git clone [URL repo GitHub kamu]
cd trio-ai-hub
```

URL repo diisi setelah Dimas membuat repo GitHub dan push dari VM. Kalau belum ada repo GitHub, repo ini juga bisa disinkronkan lewat Google Drive, tapi git lebih rapi buat kerja bareng.

## Langkah 2: Buka di Antigravity

Buka folder `trio-ai-hub` di Antigravity. Pastikan Antigravity login dan bisa membaca file di folder itu.

## Langkah 3: Jalankan tugas pertama

1. Di `TASKS.md`, lihat tugas berstatus `READY`.
2. Buka folder tugasnya di `handoffs/T-XXX/`, baca `BRIEF.md` dan `CONTEXT.md`.
3. Tempel prompt dari `prompts/prompt-antigravity.md` ke Antigravity (ganti nomor tugasnya).
4. Antigravity kerja, isi `RESULT.md`, lalu commit dan push:
   ```
   git add handoffs/T-XXX/
   git commit -m "T-XXX: deskripsi singkat"
   git push
   ```
5. Kabari Muse (lewat Dimas) kalau hasilnya sudah di-push. Muse akan verifikasi dan kirim ke Kiro.

## Langkah 4 (opsional, nanti): jembatan MCP + Tailscale

Kalau mau loop yang lebih ketat (Muse manggil Antigravity langsung tanpa Dimas jadi perantara tempel prompt), langkahnya:

1. Install Tailscale di laptop dan di VM (VM sudah punya konektor Tailscale), gabung ke network yang sama.
2. Install MCP server Antigravity di laptop (misal `qiansexingqiu/antigravity-mcp`), jalankan mode SSE.
3. Muse memanggil server itu sebagai MCP client.

Ini langkah lanjutan, bukan syarat buat mulai. Pola repo + tempel prompt di atas sudah cukup buat jalan.

## Kalau ada yang error

- Antigravity tidak bisa baca file: pastikan folder repo yang dibuka adalah folder yang sama dengan hasil `git clone`, bukan copy lain.
- Push ditolak: `git pull` dulu, selesaikan conflict kalau ada, baru `git push` lagi.
- Kiro web error: kirim ulang brief yang sama persis kata demi kata.
