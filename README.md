# API Wisata Sulawesi Tengah (`v2.1.0`)

Layanan **REST API** dan **GraphQL** berbasis Node.js untuk mengelola data destinasi wisata serta menampilkan informasi cuaca wilayah (kabupaten/kota) di Provinsi Sulawesi Tengah.

---

## 1. Struktur Repository

```text
Api-wisata-sulteng-4/
├── data/
│   ├── destinations.json   # Data destinasi wisata Sulawesi Tengah
│   ├── regions.json        # Data wilayah kabupaten/kota & koordinat cuaca
│   ├── users.json          # [Buat sendiri] Data akun pengguna (diabaikan Git)
│   └── api-keys.json       # [Buat sendiri] Daftar API key klien (diabaikan Git)
├── postman/                # Koleksi request & environment Postman
├── .env                    # [Buat sendiri] Konfigurasi TOKEN_SECRET (diabaikan Git)
├── .gitignore              # Daftar file sensitif & folder yang tidak diunggah ke Git
├── bedah-token.js          # Utilitas untuk memeriksa isi payload token JWT
├── buat-user.js            # Skrip pembuat akun pengguna (data/users.json)
├── package.json            # Metadata proyek & daftar dependensi (graphql)
├── package-lock.json       # Pengunci versi dependensi npm
└── server.js               # Kode utama server HTTP (REST v1, REST v2, & GraphQL)
```

---

## 2. Cara Menjalankan Proyek dari Repository yang Baru Disalin

Ikuti langkah-langkah berikut setelah Anda menyalin (*clone*) repository ini ke komputer lokal:

1. **Clone repository dan masuk ke direktori proyek:**
   ```bash
   git clone https://github.com/mohakbarnusantara/Api-wisata-sulteng-4.git
   cd Api-wisata-sulteng-4
   ```

2. **Pasang dependensi (`node_modules/`):**
   ```bash
   npm install
   ```
   > **Catatan (Windows PowerShell):** Jika muncul error kebijakan eksekusi skrip (`PSSecurityException`), jalankan `npm.cmd install` atau gunakan terminal Command Prompt / Git Bash.

3. **Buat file konfigurasi lokal yang wajib disiapkan sendiri** (lihat panduan lengkap pada **Bagian 3** di bawah).

4. **Jalankan server lokal:**
   ```bash
   node --watch --env-file=.env server.js
   ```
   Jika berhasil, server akan aktif di `http://localhost:3000`.

---

## 3. File yang Harus Dibuat Sendiri

Berdasarkan isi file `.gitignore`, folder `node_modules/` dan **tiga file kredensial** berikut sengaja tidak disertakan di dalam repository GitHub demi keamanan. Anda **wajib** membuat ketiganya terlebih dahulu sebelum menjalankan server:

### A. File `.env`
Buat file bernama `.env` di folder utama proyek (sejajar dengan `server.js`), lalu isi dengan kunci rahasia penandatanganan token JWT:
```env
TOKEN_SECRET="xxxxxxxxxxxxxxxxxxxx"
```

### B. File `data/users.json`
File ini menyimpan daftar akun pengguna beserta *role* (`admin`, `editor`, `viewer`) untuk autentikasi pada endpoint `POST /login`. Buat file ini secara otomatis dengan menjalankan skrip bawaan:
```bash
node buat-user.js
```

### C. File `data/api-keys.json`
Buat file bernama `api-keys.json` di dalam folder `data/` untuk mendaftarkan API key klien yang diizinkan mengakses server melalui header `x-api-key`:
```json
[
  {
    "key": "xxxxxxxxxxxxxxxxxxxxxx",
    "client": "xxxxxxxxxxxxxxxxxxxxxxx"
  }
]
```

---

## 4. Daftar Versi API yang Tersedia & Tanggal Berakhirnya `v1`

Server ini menyediakan **dua versi REST API (`v1` dan `v2`)** serta satu antarmuka **GraphQL (`/graphql`)**.

| Versi / Antarmuka | Status | Tanggal Berakhir (*Sunset*) | Penjelasan & Fitur Utama |
| :--- | :--- | :--- | :--- |
| **REST API `v1`** | *Deprecated* (Akan Dihentikan) | **30 Juni 2027** (`Wed, 30 Jun 2027 00:00:00 GMT`) | Format lama yang menyimpan nama wilayah sebagai teks (`"region": "Poso"`). Setiap respons `v1` otomatis menyertakan header HTTP `Sunset`. |
| **REST API `v2`** | **Aktif (Direkomendasikan)** | Tidak ada (Versi aktif utama) | Format terbaru dengan relasi ID wilayah (`"regionId": 2`), mendukung filter `?regionId=<id>` pada `/v2/destinations`, serta menyediakan endpoint `/v2/regions`. |
| **GraphQL (`/graphql`)** | **Aktif** | — | Menyediakan query relasional `Region`, `Destination`, dan `Weather` (Open-Meteo). Field `windSpeed` ditandai `@deprecated` dan digantikan oleh `windSpeedKmh`. |

### Informasi Masa Berlaku (`Sunset`) Versi `v1`
- Dukungan untuk **API versi `v1`** akan dihentikan secara resmi pada tanggal **30 Juni 2027** (`2027-06-30T00:00:00Z`).
- Sebagai pemberitahuan migrasi bagi klien, setiap respons dari endpoint `v1` secara otomatis menyertakan header:
  ```http
  Sunset: Wed, 30 Jun 2027 00:00:00 GMT
  ```
- Seluruh pengguna baru maupun klien lama disarankan segera bermigrasi ke **API `v2`**.

### Cara Menentukan Versi pada Request REST
Klien dapat memilih versi API menggunakan salah satu dari dua metode berikut:
1. **URI Versioning (Awalan Alamat):**
   - `GET /v1/destinations/1`
   - `GET /v2/destinations/1`
2. **Header Versioning (`x-api-version`):**
   - Mengakses alamat tanpa awalan versi (contoh: `GET /destinations/1`) dengan menyertakan header `x-api-version: 1` atau `x-api-version: 2`.
3. **Validasi Kesalahan:**
   - Request REST yang tidak mencantumkan awalan URI (`/v1`/`/v2`) sekaligus tidak menyertakan header `x-api-version` yang valid (`1` atau `2`) akan ditolak dengan status **`400 Bad Request`** beserta pesan panduan penyebutan versi.

---

## 5. Autentikasi & Daftar Endpoint Utama

### Header Autentikasi
- **`x-api-key` (Wajib di semua endpoint):** Harus cocok dengan salah satu nilai `"key"` di `data/api-keys.json`.
- **`Authorization: Bearer <token>` (Wajib untuk operasi tulis):** Token JWT diperoleh dari `POST /login` dan digunakan untuk endpoint `POST`, `PUT`, dan `DELETE` sesuai hak akses (*role*).

### Endpoint REST
| Method | Endpoint | Autentikasi | Keterangan |
| :--- | :--- | :--- | :--- |
| `POST` | `/login` | API Key | Login pengguna untuk mendapatkan token JWT |
| `GET` | `/v1/destinations` | API Key | Daftar destinasi format `v1` (disertai header `Sunset`) |
| `GET` | `/v1/destinations/:id` | API Key | Detail satu destinasi format `v1` (disertai header `Sunset`) |
| `GET` | `/v2/destinations` | API Key | Daftar destinasi format `v2` (mendukung filter `?regionId=<id>`) |
| `GET` | `/v2/destinations/:id` | API Key | Detail satu destinasi format `v2` |
| `POST` | `/v2/destinations` | API Key + JWT | Menambah destinasi baru (`editor` / `admin`) |
| `PUT` | `/v2/destinations/:id` | API Key + JWT | Mengubah data destinasi (`editor` / `admin`) |
| `DELETE` | `/v2/destinations/:id` | API Key + JWT | Menghapus data destinasi (`admin`) |
| `GET` | `/v2/regions` | API Key | Daftar kabupaten/kota di Sulawesi Tengah |
| `GET` | `/v2/regions/:id` | API Key | Detail satu wilayah berdasarkan ID |

### Endpoint GraphQL (`POST /graphql`)
Contoh query untuk mengambil data wilayah beserta cuaca terkini dari Open-Meteo:
```graphql
query {
  region(id: 1) {
    name
    weather {
      temperature
      windSpeedKmh
    }
  }
}
```
> **Evolusi Schema (`@deprecated`):** Field `windSpeed` pada `type Weather` ditandai `@deprecated(reason: "Gunakan windSpeedKmh sebagai pengganti")`, namun tetap dipertahankan agar query klien lama tidak rusak.

---

## 6. Utilitas & Pengujian Tambahan
- **Koleksi Postman:** Tersedia di dalam folder `postman/collections/` untuk membantu pengujian endpoint.
- **Memeriksa Token JWT:** Jalankan `node bedah-token.js <token_jwt>` di terminal untuk melihat isi *header* dan *payload* token yang didapat dari `/login`.