# Lyppe Store

Katalog produk digital. Prototype production-minded: static HTML + CSS +
Vanilla JavaScript + Supabase, dites di VPS, dirancang agar mudah
dimigrasikan ke **Next.js + TypeScript + Tailwind CSS + Supabase + Vercel**.

Tidak ada backend Node.js persistent, tidak ada `app.listen()`, tidak ada
database lokal. Semua data (produk, pengaturan toko) hidup di Supabase.

---

## 1. Struktur Project

```
lyppe-store/
├── index.html            # katalog publik
├── product.html           # detail produk
├── manage-x7k/             # admin (route tersembunyi, lihat §3)
│   ├── index.html          # login admin
│   └── dashboard.html      # dashboard admin
├── css/
│   ├── style.css           # styling publik
│   └── admin.css           # styling admin
├── js/
│   ├── utils.js             # helper bersama (format harga, meta tag, dll)
│   ├── app.js                # logic homepage
│   ├── product.js            # logic detail produk
│   ├── auth.js                # login + session guard admin
│   └── admin.js               # CRUD produk, settings, upload gambar, dev test
├── assets/
│   ├── favicon.svg / favicon-16x16.png / favicon-32x32.png
│   ├── apple-touch-icon.png
│   └── og-default.png
├── config.js               # konfigurasi terpusat (Supabase, admin path, dll)
├── schema.sql               # schema database + RLS policy
├── server.js                # static file server untuk localhost (dev only)
├── package.json              # hanya untuk "npm start" menjalankan server.js
└── README.md
```

---

## 2. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan seluruh isi `schema.sql`.
3. Buka **Authentication → Users**, buat satu user (email + password)
   untuk admin pertama.
4. Kembali ke **SQL Editor**, jalankan:
   ```sql
   update public.profiles set role = 'admin' where id = '<user-uuid>';
   ```
   (UUID user bisa dilihat di halaman Authentication → Users.)
5. Buka **Project Settings → API**, salin:
   - `Project URL` → `SUPABASE_CONFIG.url`
   - `anon public` key → `SUPABASE_CONFIG.anonKey`

   **JANGAN PERNAH** menyalin `service_role` key ke frontend.

6. Tempel kedua nilai itu ke `config.js`.

> **Sudah pernah setup sebelumnya?** Versi UI terbaru menambahkan kolom
> banner toko. Jalankan migrasi kecil ini di SQL Editor supaya kolomnya
> ada tanpa perlu drop/recreate tabel:
> ```sql
> alter table public.store_settings add column if not exists banner_url text;
> ```

---

## 3. Admin Route

Route admin sengaja tidak tampil di navbar publik dan menggunakan nama
folder yang tidak generik: `manage-x7k/` (bukan `/admin/`). Nama ini
**bukan mekanisme keamanan utama** — hanya mengurangi noise dari bot yang
menebak-nebak `/admin`. Ganti nama folder ini sesuai selera, lalu perbarui
`APP_CONFIG.adminPath` di `config.js` supaya konsisten.

Keamanan sesungguhnya berasal dari:
- Supabase Auth (login admin)
- Validasi session di setiap load halaman dashboard
- RLS (Row Level Security) di database — lihat `schema.sql`

Bahkan jika seseorang menemukan URL admin, mereka tetap tidak bisa
login atau melakukan CRUD tanpa akun ber-role `admin` yang sah.

---

## 4. Menjalankan di Localhost (Development)

Untuk testing di komputer sendiri sebelum upload ke VPS, project ini
menyertakan `server.js` — server static file sederhana berbasis modul
bawaan Node.js (tanpa dependency, tanpa Express). Ini **bukan** backend
aplikasi; fungsinya cuma menyajikan file HTML/CSS/JS lewat `http://`
supaya `fetch`/Supabase client bisa berjalan normal (browser membatasi
banyak hal saat dibuka langsung via `file://`).

```bash
node server.js
# atau custom port:
node server.js 8080
# atau:
npm start
```

Lalu buka:
- Katalog: `http://localhost:3000/`
- Admin: `http://localhost:3000/manage-x7k/`

Isi `config.js` dengan kredensial Supabase-mu terlebih dahulu (lihat §2)
supaya data produk & login admin berfungsi. Jangan jalankan `server.js`
dengan PM2 atau proses manager lain di production — di VPS gunakan
Nginx/Apache seperti dijelaskan di §5.

## 5. Menjalankan di VPS (Nginx)

Project ini murni file statis, jadi tidak butuh proses Node yang berjalan
terus-menerus.

1. Upload seluruh folder `lyppe-store/` ke VPS, misalnya ke
   `/var/www/lyppe-store`.
2. Buat konfigurasi Nginx, contoh minimal:

   ```nginx
   server {
       listen 80;
       server_name example.com;
       root /var/www/lyppe-store;
       index index.html;

       location / {
           try_files $uri $uri/ =404;
       }
   }
   ```
3. `nginx -t && systemctl reload nginx`.
4. Arahkan DNS domain ke IP VPS, lalu pasang HTTPS (mis. Certbot/Let's
   Encrypt) — **wajib untuk production**.
5. Isi `config.js` dengan kredensial Supabase (lihat §2).
6. Jalankan `schema.sql` di Supabase SQL Editor (kalau belum).
7. Buat user admin & set role (lihat §2 langkah 3–4).
8. Buka `https://example.com/` → pastikan katalog tampil.
9. Buka `https://example.com/manage-x7k/` → login dengan akun admin.
10. Test CRUD produk, upload gambar, image URL, QRIS, dan responsive
    (lihat checklist di §7).

---

## 6. Upload Gambar

Prototype menggunakan **Catbox** (`IMAGE_CONFIG.provider = "catbox"`)
sebagai contoh image host gratis untuk development. Semua kode
memanggil satu fungsi abstraksi:

```js
async function uploadProductImage(file) {
  // provider ditentukan oleh IMAGE_CONFIG.provider
  // mengembalikan public URL, bukan binary
}
```

Untuk pindah provider (mis. Supabase Storage saat production), cukup
tambahkan branch baru di `uploadProductImage()` (`js/admin.js`) tanpa
mengubah kode pemanggilnya. Database hanya pernah menyimpan `image_url`
(text), tidak pernah binary image.

---

## 7. Migrasi ke Next.js + Vercel

Arsitektur ini sengaja dijaga agar migrasinya lurus:

| Sekarang (static)        | Nanti (Next.js)                          |
|---------------------------|-------------------------------------------|
| `index.html`, `product.html` | `app/page.tsx`, `app/product/[slug]/page.tsx` |
| Vanilla JS (`js/*.js`)     | React components + hooks                  |
| `config.js`                | Environment variables (`NEXT_PUBLIC_...`) |
| Supabase JS via CDN         | `@supabase/supabase-js` + `@supabase/ssr` |
| Meta tag di-update via JS   | `generateMetadata()` per halaman           |
| Nginx static hosting         | Deploy ke Vercel                           |

Supabase (schema, RLS, Auth) **tidak berubah** — hanya cara frontend
mengaksesnya yang berubah.

### Catatan penting soal SEO prototype ini

Karena data produk dimuat client-side, tag `<meta>` Open Graph/Twitter
di-update lewat JavaScript setelah halaman dimuat. Crawler media sosial
yang tidak menjalankan JavaScript (sebagian bot) mungkin melihat versi
fallback, bukan versi spesifik produk. Ini limitasi yang disengaja untuk
prototype — begitu pindah ke Next.js, gunakan `generateMetadata()` agar
metadata dirender di server dan akurat untuk semua crawler.

---

## 8. Checklist Fungsional

- [ ] Homepage tampil
- [ ] Products load
- [ ] Product detail load
- [ ] Product not found ditangani
- [ ] Admin login
- [ ] Admin logout
- [ ] Add product
- [ ] Edit product
- [ ] Delete product
- [ ] Toggle active
- [ ] Upload image
- [ ] Image URL
- [ ] QRIS URL
- [ ] Store settings
- [ ] Tombol WhatsApp
- [ ] Responsive mobile
- [ ] Responsive desktop
- [ ] Favicon
- [ ] Meta description
- [ ] Open Graph
- [ ] Twitter Card

## 9. Checklist Keamanan

- [ ] Tidak ada `service_role` key di frontend
- [ ] Supabase RLS aktif
- [ ] Admin authorization tidak bergantung pada localStorage
- [ ] Public hanya membaca produk aktif (`is_active = true`)
- [ ] Admin CRUD dilindungi RLS
- [ ] Input tidak dieksekusi sebagai HTML (pakai `textContent`)
- [ ] Image upload divalidasi (MIME type + ukuran)
- [ ] File tidak disimpan sebagai executable di VPS
- [ ] Query Supabase menggunakan query builder (bukan string SQL manual)
- [ ] Error internal tidak ditampilkan ke user
- [ ] Admin route tidak dianggap sebagai security utama
- [ ] HTTPS digunakan di production

### Manual security test (butuh akses langsung)

Dashboard admin sengaja tidak menyertakan panel test bawaan lagi (dulu
ada, sudah dihapus supaya tidak berisiko salah pencet di depan client).
Untuk verifikasi keamanan, jalankan test manual berikut:

| Test | Cara | Expected |
|------|------|----------|
| Akses dashboard tanpa login | Buka `/manage-x7k/dashboard.html` di mode incognito | Redirect ke login |
| Session expired | Hapus session Supabase dari devtools, reload dashboard | Redirect ke login |
| Manipulasi role di client | Ubah variabel role di console lalu coba CRUD | Tetap ditolak (role dibaca ulang dari DB via RLS) |
| Direct request ke Supabase | Panggil REST API Supabase langsung dengan anon key, tanpa login | RLS tetap menolak insert/update |
| XSS di nama/deskripsi produk | Masukkan `<script>alert(1)</script>` sebagai nama produk lalu simpan | Tampil sebagai teks biasa di katalog, tidak dieksekusi (rendering pakai `textContent`) |

---

## 10. Batasan yang Disengaja (Tidak Overengineering)

Sesuai scope prototype, project ini **tidak** menyertakan: payment
gateway, shopping cart, order management, analytics, coupon system,
notifikasi, live chat, atau statistik palsu di dashboard. Pembayaran
cukup QRIS (URL gambar) + kontak WhatsApp admin.


## 11. Cara membuat Akun admin

do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'admin@miku.com',
    crypt('mikuhost', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    new_user_id,
    new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', 'admin@miku.com'),
    'email',
    now(), now(), now()
  );

  insert into public.profiles (id, role)
  values (new_user_id, 'admin')
  on conflict (id) do update set role = 'admin';
end $$;

//////////

Salin kode di atas dan sesuaikan email, username admin dan atur url untuk login admin tersembunyi 