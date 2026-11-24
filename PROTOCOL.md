# Protokol Hub-and-Spoke Trio AI

## 1. Peran

- **Muse (koordinator).** Satu-satunya yang boleh mengubah `TASKS.md`, `PROTOCOL.md`, dan status tugas. Yang pegang rencana, mecah tugas, delegasi, verifikasi di disk, dan gabungin hasil. Yang ngomong ke Kiro lewat browser dan ke Dimas lewat WhatsApp.
- **Antigravity (implementor).** Kerja di laptop Dimas, di dalam repo ini. Mengerjakan tugas yang ada di folder `handoffs/T-XXX/` sesuai `BRIEF.md`. Menulis hasil ke `RESULT.md` dan commit ke git.
- **Kiro (validator).** Memberi vonis independen atas hasil kerja. Diakses Muse lewat browser (app.kiro.dev), tugas ditempel sebagai teks. Bukan eksekutor, tidak menyentuh file.

## 2. Status tugas

| Status | Arti | Yang boleh mengubah |
|---|---|---|
| `DRAFT` | Brief lagi ditulis Muse | Muse |
| `READY` | Siap dikerjakan Antigravity | Muse |
| `IN_PROGRESS` | Antigravity lagi kerja | Muse (saat Dimas konfirmasi mulai) |
| `RESULT` | Hasil sudah di-commit Antigravity | Muse (saat hasil masuk) |
| `VERIFYING` | Muse lagi verifikasi di disk | Muse |
| `VALIDATING` | Hasil dikirim ke Kiro buat vonis | Muse |
| `DONE` | Selesai, vonis Kiro terima | Muse |
| `REWORK` | Vonis Kiro minta perbaikan, balik ke Antigravity | Muse |

Hanya Muse yang mengubah status. Antigravity tidak mengubah `TASKS.md`. Kiro tidak mengubah file apapun di repo.

## 3. Format folder tugas

Setiap tugas punya folder `handoffs/T-XXX-nama-singkat/` dengan empat file:

- `BRIEF.md` — ditulis Muse sebelum delegasi. Isi: tujuan, ruang lingkup, file yang relevan, kriteria selesai, batasan, output yang diharapkan.
- `CONTEXT.md` — ditulis Muse. Isi file yang relevan ditempel sebagai teks, plus catatan dan link.
- `RESULT.md` — ditulis Antigravity setelah kerja. Isi: apa yang dikerjakan, file yang diubah, hasil tes, masalah yang ketemu.
- `VERDICT.md` — ditulis Muse dari hasil Kiro. Isi: vonis (terima / perbaiki / tolak), model Kiro yang dipakai, biaya kredit, catatan perbaikan.

Nomor tugas urut: T-001, T-002, dan seterusnya. Jangan pakai ulang nomor yang sudah dipakai.

## 4. Aturan verifikasi (wajib)

1. Jangan percaya klaim "file sudah disimpan / sudah diubah" sebelum dicek di disk (`git status`, `git diff`).
2. Tugas kode yang menyentuh logika penting lewat gate Konoha: rencana genin, eksekusi subagent, lalu Kage review wajib. Lapor `konoha savings` setiap selesai.
3. Vonis Kiro harus independen: kirim brief + hasil kerja sebagai teks, jangan kirim kesimpulan Muse sebagai premis.
4. Kalau hasil Antigravity dan vonis Kiro bertentangan, Muse yang memutuskan dan mencatat alasannya di `DECISIONS.md`.

## 5. Aturan Kiro (diadaptasi dari workflow Kiro yang sudah disepakati)

- Akses hanya lewat browser (app.kiro.dev), login akun backup dimasjust77@gmail.com.
- Tempel tugas sebagai teks, jangan lampirkan file (lampiran tidak sampai ke model).
- Sonnet 5.5 buat validasi/review besar, Haiku 5.5 buat tugas rutin. Sebut model yang dipakai di awal pesan.
- Kiro pemberi vonis, bukan eksekutor. Eksekusi dan verifikasi disk tetap di Muse.
- Lapor biaya kredit per tugas ke Dimas (free tier 50 kredit/bulan).
- Kalau Kiro web error dan sesi mundur, kirim ulang brief yang sama persis kata demi kata.

## 6. Aturan Antigravity

- Kerja hanya di dalam folder tugas yang ditugaskan dan file yang disebut di `BRIEF.md`.
- Jangan ubah `TASKS.md`, `PROTOCOL.md`, `README.md`, `AGENTS.md`, atau `DECISIONS.md`.
- Commit dengan pesan yang jelas (`T-XXX: deskripsi singkat`). Jangan commit file yang tidak terkait tugas.
- Jalankan tes yang disebut di brief sebelum mengisi `RESULT.md`. Tulis hasil tes apa adanya, termasuk yang gagal.
- Kalau brief kurang jelas, tulis pertanyaannya di `RESULT.md` bagian "Butuh klarifikasi", jangan menebak.

## 7. Biaya dan batasan

- Kiro: free tier 50 kredit/bulan. Lapor biaya per tugas.
- Antigravity: butuh laptop Dimas menyala dan Antigravity login.
- Muse: pemakaian seperti biasa, lapor `konoha savings` setiap habis pakai Konoha.
- Semua teks yang dibaca manusia: Bahasa Indonesia, tanpa em-dash.

## 8. Perubahan protokol

Perubahan `PROTOCOL.md` hanya boleh diusulkan Muse dan disetujui Dimas. Catat perubahannya di `DECISIONS.md`.
