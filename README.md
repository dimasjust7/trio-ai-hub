# Trio AI Hub: Muse + Antigravity + Kiro

Sistem kerja bareng tiga AI dengan pola **hub-and-spoke**. Muse jadi koordinator di tengah, Antigravity dan Kiro jadi spoke, dan ketiganya ketemu di repo ini.

## Tiga agen, tiga peran

| Agen | Peran | Di mana | Cara ngomong |
|---|---|---|---|
| **Muse (bro alex)** | Koordinator + eksekutor + verifier | VM cloud (Linux) | Langsung sama Dimas via WhatsApp |
| **Antigravity** | Implementor + opini kedua (model Gemini) | Laptop Windows Dimas | Lewat repo ini (git) |
| **Kiro** | Validator / pemberi vonis (Sonnet 5.5 / Haiku 5.5) | Web (app.kiro.dev, browser) | Lewat Muse, ditempelin teks |

Aturan peran ini mengikat. Antigravity tidak memberi vonis akhir, Kiro tidak mengeksekusi file, Muse tidak mendelegasikan verifikasi akhir ke agen lain.

## Alur satu tugas (8 langkah)

1. Dimas kasih tugas ke Muse.
2. Muse pecah jadi rencana, tulis brief ke `handoffs/T-XXX/`.
3. Muse delegasi implementasi ke Antigravity (Dimas jalanin prompt di laptop, atau nanti lewat MCP bridge).
4. Antigravity kerja, commit hasilnya ke repo, isi `RESULT.md`.
5. Muse verifikasi hasilnya di disk (jangan percaya klaim file kesimpen sebelum dicek).
6. Muse kirim hasil + rencana awal ke Kiro lewat browser buat vonis independen.
7. Kiro kasih vonis, Muse tulis ke `VERDICT.md`.
8. Muse gabungin, benerin yang bermasalah, lapor ke Dimas lengkap dengan kontribusi ketiganya.

## Isi repo ini

- `PROTOCOL.md` — aturan main lengkap (status tugas, format file, larangan).
- `AGENTS.md` — kartu peran tiap agen.
- `TASKS.md` — papan tugas (antrian, status, siapa yang pegang).
- `DECISIONS.md` — log keputusan.
- `handoffs/` — satu folder per tugas (`T-001`, `T-002`, ...). Tiap folder berisi `BRIEF.md`, `CONTEXT.md`, `RESULT.md`, `VERDICT.md`.
- `handoffs/TEMPLATE/` — template kosong buat tugas baru.
- `handoffs/T-000-CONTOH/` — contoh tugas yang udah jalan penuh, biar alurnya kelihatan.
- `prompts/` — prompt siap tempel buat Antigravity dan Kiro.
- `SETUP-LAPTOP.md` — cara setup di laptop Windows Dimas.

## Aturan gaya (berlaku buat semua agen)

- Bahasa manusia: Bahasa Indonesia, santai, singkat. Jangan pakai em-dash (—) di teks apapun.
- Kode dan komentar kode: Bahasa Inggris.
- Jangan pernah percaya klaim "file udah kesimpen" sebelum dicek di disk (git status / git diff).
- Setiap habis pakai Konoha, lapor `konoha savings` (calls / KB / % / token).
- Setiap habis pakai Kiro, lapor biaya kredit per tugas (free tier 50 kredit/bulan).

## Mulai dari mana

Baca `SETUP-LAPTOP.md` dulu, terus jalanin tugas pertama dari `TASKS.md`.
