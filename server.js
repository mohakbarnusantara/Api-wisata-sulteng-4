console.log('HUMAIRA ISLAMI RISYA ADAM  || F5512510006');
console.log('BAGUS ALDY PUTRA           || F5512510009');
console.log('ANDHIN ANGGRAINI BANTULU   || F5512510010');
console.log('CUT SAFIRA                 || F5512510022');
console.log('MOH AKBAR NUSANTARA        || F5512520037');

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { buildSchema, graphql } = require('graphql');

const PORT = 3000;

// Kode 4.8 Konstanta lokasi file data, baris kedua adalah baris baru
const DATA_FILE = path.join(__dirname, 'data', 'destinations.json');
const REGION_FILE = path.join(__dirname, 'data', 'regions.json');
const KEY_FILE = path.join(__dirname, 'data', 'api-keys.json');
const USER_FILE = path.join(__dirname, 'data', 'users.json');
const TOKEN_SECRET = process.env.TOKEN_SECRET;
const MASA_TOKEN = 3600;
const V1_BERAKHIR = '2027-06-30T00:00:00Z';

if (!TOKEN_SECRET) {
 console.error('TOKEN_SECRET belum diatur. Jalankan: node --env-file=.env server.js');
 process.exit(1);
}


//---------- logika destinasi ----------
function bacaToken(token) {
  const bagian = token.split('.');
  if (bagian.length !== 3) {
    throw buatError(401, 'Format token tidak valid');
  }

  const [header, payload, ttd] = bagian;
  if (!samaAman(ttd, tandaTangan(`${header}.${payload}`))) {
    throw buatError(401, 'Tanda tangan token tidak cocok');
  }

  const isi = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (isi.exp < Math.floor(Date.now() / 1000)) {
    throw buatError(401, 'Token sudah kedaluwarsa, silakan login kembali');
  }

  return isi;
}

function bacaPengguna(req) {
  const nilai = req.headers['authorization'];
  if (!nilai || !nilai.startsWith('Bearer ')) {
    return null;
  }
  return bacaToken(nilai.slice(7));
}

function wajibLogin(pengguna) {
  if (!pengguna) {
    throw buatError(401, 'Anda belum login. Kirim token melalui header Authorization');
  }
  return pengguna;
}

function wajibRole(pengguna, roleYangBoleh) {
  wajibLogin(pengguna);
  if (!roleYangBoleh.includes(pengguna.role)) {
    throw buatError(403, `Role ${pengguna.role} tidak berhak melakukan tindakan ini`);
  }
  return pengguna;
}

function samaAman(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function passwordCocok(password, user) {
  const hash = crypto.scryptSync(password, user.salt, 32).toString('hex');
  return samaAman(hash, user.passwordHash);
}

function keBase64Url(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function tandaTangan(teks) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(teks).digest('base64url');
}

function buatToken(user) {
  const header = keBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = keBase64Url({
    sub: String(user.id),
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + MASA_TOKEN
  });
  const ttd = tandaTangan(`${header}.${payload}`);
  return `${header}.${payload}.${ttd}`;
}

async function periksaApiKey(req) {
  const kunci = req.headers['x-api-key'];
  if (!kunci) {
    throw buatError(401, 'API key tidak disertakan. Kirim melalui header x-api-key');
  }
  const isi = await fs.readFile(KEY_FILE, 'utf8');
  const pemilik = JSON.parse(isi).find((k) => k.key === kunci);
  if (!pemilik) {
    throw buatError(401, 'API key tidak dikenal');
  }
  return pemilik;
}


// ---------- helper respons ----------
function kirimJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function kirimError(res, statusCode, pesan) {
  kirimJSON(res, statusCode, { error: pesan });
}

// ---------- helper data ----------
async function bacaData() {
  const isi = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(isi);
}

async function simpanData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}


// Kode 4.9 Fungsi membaca data region
async function bacaRegions() {
  const isi = await fs.readFile(REGION_FILE, 'utf8');
  return JSON.parse(isi);
}

// ---------- helper request ----------

function buatError(statusCode, pesan) {
  const err = new Error(pesan);
  err.statusCode = statusCode;
  return err;
}

function bacaBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (body === '') return resolve(null);
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(buatError(400, 'Body request bukan JSON yang valid'));
      }
    });
    req.on('error', reject);
  });
}


// Kode 4.13 Fungsi pemeriksa dan pembuat destinasi
// ----------- logika destinasi -----------
async function periksaDestinasi(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        throw buatError(400, 'Data destinasi harus berupa object');
    }

    const kurang = ['name', 'category'].filter(
        (field) => typeof input[field] !== 'string' || input[field].trim() === ''
    );
    if (kurang.length > 0) {
        throw buatError(400, `Field wajib belum diisi: ${kurang.join(', ')}`);
    }

    const regionId = Number(input.regionId);
    const regions = await bacaRegions();
    if (!regions.some((r) => r.id === regionId)) {
        throw buatError(400, 'regionId wajib diisi dengan id region yang tersedia');
    }

    return {
        name: input.name.trim(),
        category: input.category.trim(),
        regionId: regionId
    };
}

async function buatDestinasi(input) {
    const bersih = await periksaDestinasi(input);
    const data = await bacaData();
    const idBaru = data.length === 0 ? 1 : Math.max(...data.map((d) => d.id)) + 1;
    const item = { id: idBaru, ...bersih };
    data.push(item);
    await simpanData(data);
    return item;
}

//
// versi
async function bentukKeluar (versi, item) {
  if (versi === 'v2') {
    return item;
  }
  const regions = await bacaRegions();
  const region = regions.find((r) => r.id === item.regionId);
  return {
    id: item.id,
    name: item.name,
    region: region? region.name: null,
    category: item.category
  };
}

async function bentukMasuk (versi, input) {
  if (versi === 'v2' || input === null || typeof input !== 'object') {
    return input;
  }
  const regions = await bacaRegions();
  const region = regions.find((r) => r.name === input.region);
  if (!region) {
    throw buatError (400, 'region wajib diisi dengan nama region yang tersedia');
  }
  return {
    name: input.name,
    category: input.category,
    regionId: region.id
  };
}

// ---------- handler ----------
async function daftarDestinasi (req, res, url, versi) {
  let data = await bacaData();
  const kategori = url.searchParams.get('category');
  if (kategori) {
    data = data.filter((item) => item.category === kategori);
  }
  if (versi === 'v2') {
    const regionIdParam = url.searchParams.get('regionId');
    if (regionIdParam !== null) {
        data = data.filter((item) => item.regionId === Number(regionIdParam));
    }
}   
  const hasil = [];
  for (const item of data) {
    hasil.push(await bentukKeluar (versi, item));
  }
  kirimJSON(res, 200, hasil);
}

async function detailDestinasi (req, res, id, versi) {
  const data = await bacaData();
  const item = data.find((d) => d.id === id);
  if (!item) {
    return kirimError(res, 404, `Destinasi dengan id ${id} tidak ditemukan`);
  }
  kirimJSON(res, 200, await bentukKeluar (versi, item));
}

async function tambahDestinasi (req, res, versi) {
  const input = await bentukMasuk (versi, await bacaBody(req));
  const item = await buatDestinasi (input);
  res.setHeader('Location', `/${versi}/destinations/${item.id}`);
  kirimJSON(res, 201, await bentukKeluar (versi, item));
}

async function ubahDestinasi (req, res, id, versi) {
  const body = await bacaBody (req);
  const data = await bacaData();
  const index = data.findIndex((d) => d.id === id);
  if (index === -1) {
    return kirimError (res, 404, `Destinasi dengan id ${id} tidak ditemukan`);
  }
  const bersih = await periksaDestinasi (await bentukMasuk (versi, body));
  data[index] = { id: id, ...bersih };
  await simpanData (data);
  kirimJSON(res, 200, await bentukKeluar (versi, data[index]));
}

async function hapusDestinasi(req, res, id) {
  const data = await bacaData();
  const index = data.findIndex((d) => d.id === id);
  if (index === -1) {
    return kirimError(res, 404, `Destinasi dengan id ${id} tidak ditemukan`);
  }

  data.splice(index, 1);
  await simpanData(data);
  res.writeHead(204);
  res.end();
}

// Kode 4.10 Handler untuk endpoint regions

async function tanganiRegions(req, res, segmen) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return kirimError(res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
    }

    const regions = await bacaRegions();
    if (segmen.length === 1) {
        return kirimJSON(res, 200, regions);
    }

    const item = regions.find((r) => r.id === Number(segmen[1]));
    if (!item) {
        return kirimError(res, 404, `Region dengan id ${segmen[1]} tidak ditemukan`);
    }
    kirimJSON(res, 200, item);
}
// Menyimpan riwayat percobaan gagal per username
const catatanGagal = {};

async function tanganiLogin(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return kirimError(res, 405, 'Endpoint /login hanya menerima method POST');
  }

  const input = await bacaBody(req);
  const lengkap =
    input !== null &&
    typeof input.username === 'string' &&
    typeof input.password === 'string';

  if (!lengkap) {
    return kirimError(res, 400, 'Body harus memuat username dan password');
  }

  const sekarang = Date.now();
  const dataGagal = catatanGagal[input.username] || { count: 0, lockedUntil: 0 };

  // 1. Periksa apakah username sedang diblokir sementara
  if (dataGagal.lockedUntil > sekarang) {
    const sisaDetik = Math.ceil((dataGagal.lockedUntil - sekarang) / 1000);
    return kirimError(res, 429, `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${sisaDetik} detik`);
  }

  const isi = await fs.readFile(USER_FILE, 'utf8');
  const user = JSON.parse(isi).find((u) => u.username === input.username);

  // 2. Jika username tidak ditemukan atau password salah
  if (!user || !passwordCocok(input.password, user)) {
    dataGagal.count += 1;

    // Jika sudah gagal 3 kali, kunci akun selama 60 detik (60.000 ms)
    if (dataGagal.count >= 3) {
      dataGagal.lockedUntil = sekarang + 60000;
      catatanGagal[input.username] = dataGagal;
      return kirimError(res, 429, 'Terlalu banyak percobaan login gagal. Akses diblokir selama 60 detik');
    }

    catatanGagal[input.username] = dataGagal;
    return kirimError(res, 401, 'Username atau password salah');
  }

  // 3. Jika login berhasil, hapus catatan gagal username tersebut
  delete catatanGagal[input.username];

  kirimJSON(res, 200, {
    token: buatToken(user),
    tokenType: 'Bearer',
    expiresIn: MASA_TOKEN
  });
}

// kode 4.18 Schema pertama
// ---------- graphql: schema ----------
async function tanganiMe(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return kirimError(res, 405, 'Endpoint /me hanya menerima method GET');
  }

  const pengguna = wajibLogin(bacaPengguna(req));
  const sekarang = Math.floor(Date.now() / 1000);
  const sisaDetik = pengguna.exp - sekarang;

  kirimJSON(res, 200, {
    id: pengguna.sub,
    username: pengguna.username,
    role: pengguna.role,
    expiresIn: sisaDetik > 0 ? sisaDetik : 0
  });
}

const schema = buildSchema (`
  type Destination {
    id: ID!
    name: String!
    category: String
    region: Region
  }
  
  type Region {
    id: ID!
    name: String!
    weather: Weather
    destinations: [Destination]
  }

  type Weather {
    temperature: Float
    windSpeed: Float
    time: String
    humidity: Float
  }

  type Query {
    destinations(category: String): [Destination]
    destination(id: ID!): Destination
    regions: [Region]
    region(id: ID!): Region
  }

  type Mutation {
    createDestination(
      name: String!
      category: String!
      regionId: ID!
    ): Destination
    updateDestination(
      id: ID!
      name: String
      category: String
      regionId: ID
): Destination
deleteDestination(id: ID!): Boolean
  }
`);

// ---------- fungsi pelengkap ----------
async function ambilCuaca(region) {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${region.latitude}&longitude=${region.longitude}`
    + '&current=temperature_2m,wind_speed_10m,relative_humidity_2m'
    + '&timezone=Asia/Makassar';

  console.log(` memanggil Open-Meteo untuk: ${region.name}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new Error(`Open-Meteo menjawab dengan status ${res.status}`);
  }

  const hasil = await res.json();
  return {
    temperature: hasil.current.temperature_2m,
    windSpeed: hasil.current.wind_speed_10m,
    time: hasil.current.time,
    humidity: hasil.current.relative_humidity_2m
  };
}

function lengkapiRegion(region) {
  return {
    ...region,
    weather: () => ambilCuaca(region),
    destinations: async () => {
            const destinations = await bacaData();
            const filtered = destinations.filter((d) => d.regionId === region.id);
            return filtered.map(lengkapiDestinasi);
        }
  };
}

function lengkapiDestinasi(item) {
  return {
    ...item,
    region: async () => {
      console.log(` resolver region dijalankan untuk: ${item.name}`);
      const regions = await bacaRegions();
      const region = regions.find((r) => r.id === item.regionId);
      return region ? lengkapiRegion(region) : null;
    }
  };
}


// Kode 4.19 Resolver pertama
// ---------- graphql: resolver ---------- 
const resolver = {};

resolver.destinations = async (args) => { 
  let data = await bacaData(); 
  if (args && args.category) {
    data = data.filter((d) => d.category.toLowerCase() === args.category.toLowerCase());
  }
  return data.map(lengkapiDestinasi);
};

resolver.regions = async () => {
    const regions = await bacaRegions();
    return regions.map(lengkapiRegion);
};
resolver.region = async (args) => {
    const regions = await bacaRegions();
    const item = regions.find((r) => r.id === Number(args.id));
    if (!item) throw new Error(`Region dengan id ${args.id} tidak ditemukan`);
    return lengkapiRegion(item);
};

resolver.destination = async (args) => {
  const data = await bacaData();
  const item = data.find((d) => d.id === Number(args.id));
  if (!item) {
    throw new Error(`Destinasi dengan id ${args.id} tidak ditemukan`);
  }
  return lengkapiDestinasi(item);
};

resolver.createDestination = async (args, context) => {
  wajibRole(context.pengguna, ['admin', 'editor']);
  const item = await buatDestinasi(args);
  return lengkapiDestinasi(item);
};

// Resolver untuk mengubah destinasi (Wajib login: admin atau editor)
resolver.updateDestination = async (args, context) => {
  wajibRole(context.pengguna, ['admin', 'editor']);
  
  const id = Number(args.id);
  const data = await bacaData();
  const index = data.findIndex((d) => d.id === id);
  if (index === -1) {
    throw new Error(`Destinasi dengan id ${id} tidak ditemukan`);
  }

  if (args.name !== undefined) data[index].name = args.name;
  if (args.category !== undefined) data[index].category = args.category;
  if (args.regionId !== undefined) data[index].regionId = args.regionId;

  await simpanData(data);
  return lengkapiDestinasi(data[index]);
};

// Resolver untuk menghapus destinasi (Wajib role admin saja)
resolver.deleteDestination = async (args, context) => {
  wajibRole(context.pengguna, ['admin']);

  const id = Number(args.id);
  const data = await bacaData();
  const index = data.findIndex((d) => d.id === id);
  if (index === -1) {
    throw new Error(`Destinasi dengan id ${id} tidak ditemukan`);
  }

  data.splice(index, 1);
  await simpanData(data);
  return true;
};


// Kode 4.20 Handler untuk endpoint/graphql
// ---------- graphql: handler ---------- 
async function tanganiGraphQL(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return kirimError(res, 405, 'Endpoint /graphql hanya menerima method POST');
  }

  const pengguna = bacaPengguna(req);
  const body = await bacaBody(req);

  if (body === null || typeof body.query !== 'string') {
    return kirimError(res, 400, 'Body harus berupa JSON yang memiliki field query');
  }

  const hasil = await graphql({
    schema: schema,
    source: body.query,
    rootValue: resolver,
    contextValue: { pengguna: pengguna }
  });

  kirimJSON(res, 200, hasil);
}


// Kode 4.11 Bagian awal router setelah alamat regions didaftarkan
// ---------- router ----------
async function router (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const segmen = url.pathname.split('/').filter(Boolean);
  const aplikasi = await periksaApiKey (req);
  console.log(` aplikasi: ${aplikasi.client}`);
  
  if (segmen[0] === 'login' && segmen.length === 1) {
    return tanganiLogin (req, res);
  }
  if (segmen[0] === 'graphql' && segmen.length === 1) {
    return tanganiGraphQL (req, res);
  }
  
// Versi API dapat ditentukan melalui awalan URI (/v1 atau /v2) atau header x-api-version
  let versi;
  let alamat;

  if (segmen[0] === 'v1' || segmen[0] === 'v2') {
    versi = segmen[0];
    alamat = segmen.slice(1);
  } else {
    const headerVersi = req.headers['x-api-version'];
    if (!headerVersi) {
      return kirimError(
        res,
        400,
        'Versi API wajib disebutkan melalui awalan URI (/v1 atau /v2) atau header x-api-version bernilai 1 atau 2'
      );
    }
    if (headerVersi !== '1' && headerVersi !== '2') {
      return kirimError(
        res,
        400,
        'Nilai header x-api-version harus 1 atau 2, atau gunakan awalan URI /v1 atau /v2'
      );
    }
    versi = `v${headerVersi}`;
    alamat = segmen;
  }

  if (versi === 'v1') {
    res.setHeader('Sunset', new Date(V1_BERAKHIR).toUTCString());
  }
  if (versi === 'v2' && alamat[0] === 'regions' && alamat.length <= 2) {
    return tanganiRegions (req, res, alamat);
  }
  if (alamat[0] !== 'destinations' || alamat.length > 2) {
    return kirimError (res, 404, 'Endpoint tidak ditemukan');
  }
  
  // Endpoint koleksi: /v1/destinations dan /v2/destinations
  if (alamat.length === 1) {
    if (req.method === 'GET') return daftarDestinasi (req, res, url, versi);
    if (req.method === 'POST') {
      wajibLogin(bacaPengguna (req));
      return tambahDestinasi (req, res, versi);
    }
    res.setHeader('Allow', 'GET, POST');
    return kirimError (res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
  }
  
  // Endpoint item: /v1/destinations/:id dan /v2/destinations/:id
  const id = Number(alamat[1]);
  if (!Number.isInteger(id) || id < 1) {
    return kirimError (res, 400, 'id harus berupa bilangan bulat positif');
  }
  if (req.method === 'GET') return detailDestinasi (req, res, id, versi);
  if (req.method === 'PUT') {
    wajibLogin(bacaPengguna (req));
    return ubahDestinasi (req, res, id, versi);
  }
  if (req.method === 'DELETE') {
    wajibRole(bacaPengguna (req), ['admin']);
    return hapusDestinasi (req, res, id);
  }
  
  res.setHeader('Allow', 'GET, PUT, DELETE');
  return kirimError (res, 405, `Method ${req.method} tidak didukung pada endpoint ini`);
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  try {
    await router(req, res);
  } catch (err) {
    if (err.statusCode) {
      return kirimError(res, err.statusCode, err.message);
    }
    console.error(err);
    kirimError(res, 500, 'Terjadi kesalahan pada server');
  }
});

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});