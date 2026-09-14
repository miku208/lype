# Lyppe Store

Toko digital product sederhana. Buyer melihat katalog, membuka detail produk,
lalu membayar **manual** via QRIS atau DANA, dan mengonfirmasi ke admin lewat
WhatsApp. Tidak ada payment gateway otomatis — tidak ada klaim verifikasi
otomatis di mana pun di aplikasi ini.

Stack: **HTML + CSS + Vanilla JavaScript + Supabase** (via CDN). `server.js`
hanyalah static file server untuk development lokal — bukan backend aplikasi.

## 1. Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel seluruh isi `supabase/schema.sql`, lalu **Run**.
   Ini membuat tabel `categories` (legacy, tetap ada), `catalogs` (sistem
   katalog bertingkat: katalog utama + sub-catalog), `products`,
   `store_settings`, `profiles`, RLS policies, dan (jika kamu sudah punya
   data lama) otomatis memigrasikan `categories` yang ada jadi katalog
   utama level 1 tanpa menghapus apa pun. File ini aman dijalankan ulang
   kapan saja (idempotent) — juga dipakai untuk upgrade instalasi lama ke
   sistem katalog bertingkat.
3. Buka **Project Settings → API**, salin **Project URL** dan **anon/public key**.

## 2. Buat user admin (jangan hardcode password!)

1. Buka **Authentication → Users → Add user**, buat akun dengan email + password
   asli milik kamu.
2. Salin **UUID** user tersebut dari tabel Users.
3. Kembali ke **SQL Editor**, jalankan:
   ```sql
   update public.profiles set role = 'admin' where id = '<uuid-kamu>';
   ```
   (Trigger di schema sudah otomatis membuat row `profiles` dengan role
   `'user'` saat user dibuat — baris di atas hanya menaikkan rolenya jadi admin.)

## 3. Masukkan Supabase URL & anon key

Edit `config.js` di root project:

```js
const SUPABASE_CONFIG = {
  url: "https://xxxxx.supabase.co",
  anonKey: "eyJ...",
};
```

Jangan pernah memasukkan `service_role key` ke file ini atau ke file apa pun
di frontend.

## 4. Jalankan secara lokal

```bash
npm run dev
```

Buka:
- Storefront: http://localhost:3000
- Admin: http://localhost:3000/manage-x7k/

## 4b. Katalog bertingkat (Catalog → Sub-Catalog → Produk)

Dari dashboard admin (`Catalog` di sidebar):

1. **Add Catalog** — buat katalog utama (mis. `NOKOS`, `APK PREMIUM`).
2. Di dalam katalog itu, klik **+ Add Sub-Catalog** — buat sub-catalog
   (mis. `NOKOS Indonesia`, `NOKOS Philippines`).
3. Saat **Add Product**, pilih **Catalog** lalu **Sub-Catalog**. Kalau
   sebuah katalog tidak punya sub-catalog sama sekali, produk otomatis
   tersimpan langsung di katalog itu (level 1 jadi leaf) — jadi katalog
   lama/flat tetap berfungsi tanpa harus dibuatkan sub-catalog.

Publik akan melihat: **Etalase → klik Catalog → klik Sub-Catalog → Produk**,
lengkap dengan breadcrumb dan tombol "← Kembali". Produk dari katalog lain
tidak pernah ikut tercampur.

## 5. Deploy sebagai static site

Project ini murni static (HTML/CSS/JS) — `server.js` **tidak** ikut dipakai di
production, dan tidak dibutuhkan sama sekali oleh Vercel/Nginx.

**Vercel**: import repo ini, `vercel.json` sudah disediakan (build `@vercel/static`).
Push ke git lalu deploy seperti biasa — tidak perlu build command.

**Nginx**: arahkan `root` ke folder project ini, aktifkan `try_files $uri $uri/index.html =404;`
supaya `/manage-x7k/` dan `/manage-x7k/dashboard.html` bisa diakses langsung.

## Sebelum production, pastikan:

- RLS aktif dan sudah dites (lihat checklist keamanan di bawah).
- `qris_url`, `dana_number`, `admin_whatsapp`, dan `payment_note` sudah diisi
  dari dashboard admin (Store Settings).
- Provider upload gambar (`config.js` → `IMAGE_CONFIG.provider`) sesuai
  kebutuhan kamu — default memakai host eksternal untuk prototipe; ganti ke
  Supabase Storage kapan pun tanpa mengubah kode pemanggilnya (lihat
  `uploadProductImage()` di `js/admin.js`).
- Tidak ada `service_role key` yang tersimpan di frontend mana pun.

## Struktur project

```
lyppe-store/
├── index.html          Katalog publik (kategori filter + search)
├── product.html         Detail produk
├── payment.html          Pembayaran manual (QRIS / DANA)
├── server.js             Static file server — LOCAL DEV ONLY
├── package.json
├── config.js              Supabase URL + anon key + app config
├── supabase.js             Inisialisasi Supabase client
├── css/
│   ├── style.css           Shared: header, footer, hero, product grid
│   ├── product.css         Halaman detail produk
│   ├── payment.css         Halaman pembayaran
│   └── admin.css           Dashboard admin
├── js/
│   ├── utils.js            Helper bersama (format harga, WA link, toast, dst.)
│   ├── app.js               Katalog + kategori + search
│   ├── product.js           Detail produk
│   ├── payment.js            Metode pembayaran + salin nomor
│   ├── auth.js                Login/guard admin (Supabase Auth)
│   └── admin.js               CRUD produk, kategori, & store settings
├── manage-x7k/                Admin (route tersembunyi, tidak ada di navbar publik)
│   ├── index.html               Login
│   └── dashboard.html            Dashboard
├── assets/
│   └── placeholder.svg
└── supabase/
    └── schema.sql              Skema database + RLS, dari NOL
```

## Checklist keamanan

- [x] Tidak ada `service_role key` di frontend
- [x] RLS aktif di semua tabel (`categories`, `catalogs`, `products`, `store_settings`, `profiles`)
- [x] Admin authorization memakai `profiles.role` + RLS, bukan localStorage
- [x] Public user tidak bisa INSERT/UPDATE/DELETE produk, kategori, atau settings
- [x] `localStorage` tidak pernah dipercaya sebagai sumber otorisasi
- [x] Input user dirender lewat `textContent`/`createElement`, bukan `innerHTML` mentah — payload XSS diperlakukan sebagai teks biasa
- [x] Semua query memakai Supabase query builder (tidak ada string SQL manual dari input user)
- [x] Upload gambar dibatasi tipe MIME (`jpeg`/`png`/`webp`) dan ukuran (5MB)
- [x] URL untuk `href`/`src` (QRIS, image, WhatsApp) tidak menerima skema `javascript:`/`data:` yang berbahaya — hanya ditampilkan sebagai `http(s)` biasa
- [x] Path traversal server dicegah (`safeJoin` di `server.js`)
- [x] Pembayaran 100% manual — tidak ada klaim verifikasi otomatis di mana pun
- [x] QRIS, DANA, WhatsApp admin, payment note, nama & deskripsi toko — semuanya editable dari admin dashboard
- [x] Responsive di 320px–1440px, grid produk 2 kolom di mobile
- [ ] **Kamu perlu memverifikasi sendiri sebelum production**: buat akun bukan-admin lalu coba akses `/manage-x7k/dashboard.html` dan lakukan CRUD langsung lewat Supabase client di console browser — pastikan semuanya ditolak oleh RLS, bukan cuma disembunyikan di UI.
