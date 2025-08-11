// server.js
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Helper: parse Kandilli lst9 text (önemsiz başlıkları atar, pre içindeki satırları işler)
function parseKandilliLst(text) {
  // Kandilli sayfalarında deprem listesi genelde <pre> ... </pre> içinde satır satır olur.
  // Satırlardan tarih, saat, enlem, boylam, derinlik, büyüklük, yer bilgisi gibi veriler çıkarılmaya çalışılır.
  // Formatlar değişebilir; burası esnek split ile çalışır.

  // 1) pre kısmını al
  const preMatch = text.match(/<pre[\s\S]*?>([\s\S]*?)<\/pre>/i);
  const body = preMatch ? preMatch[1] : text;

  const lines = body.split('\n').map(l => l.trim()).filter(l => l && !/^(-+|SIRA|No:|Tarih|#)/i.test(l));
  const events = [];

  lines.forEach(line => {
    // Normalize birden fazla boşluğu tek boşluk yap
    const cols = line.replace(/\s+/g, ' ').split(' ');

    // Farklı formatlar olabilir — örnek 1:
    // "2025/08/10 12:34:56  38.123N  27.456E  10.0  4.5  SOMEPLACE"
    // veya "10/08/2025 12:34:56 38.123 27.456 10.0 4.5 SOME PLACE"
    // Mantıklı bir parse denemesi yapalım:
    try {
      // find first token that looks like date (yyyy/mm/dd or dd/mm/yyyy)
      let dateToken = cols[0];
      let timeToken = cols[1];
      let latToken = cols[2];
      let lonToken = cols[3];
      let depthToken = cols[4];
      let magToken = cols[5];
      let placeTokens = cols.slice(6);

      // If date is in dd/mm/yyyy, convert to yyyy-mm-dd
      if (/\d{2}\/\d{2}\/\d{4}/.test(dateToken)) {
        const [d,m,y] = dateToken.split('/');
        dateToken = `${y}-${m}-${d}`;
      } else if (/\d{4}\/\d{2}\/\d{2}/.test(dateToken)) {
        dateToken = dateToken.replace(/\//g, '-');
      }

      // lat/lon may have N/E letters or sign, convert to float
      const lat = parseFloat(latToken.replace(/[^\d\.\-]/g, '')) * (/[NS]/i.test(latToken) ? (/[S]/i.test(latToken) ? -1 : 1) : 1);
      const lon = parseFloat(lonToken.replace(/[^\d\.\-]/g, '')) * (/[EW]/i.test(lonToken) ? (/[W]/i.test(lonToken) ? -1 : 1) : 1);
      const depth = parseFloat(depthToken);
      const mag = parseFloat(magToken);

      const place = placeTokens.join(' ').trim();

      // Build ISO timestamp if possible
      let iso = null;
      if (timeToken && dateToken) {
        iso = new Date(`${dateToken}T${timeToken}Z`);
        if (isNaN(iso.getTime())) iso = null;
      }

      events.push({
        source: 'kandilli',
        raw: line,
        date: dateToken,
        time: timeToken,
        datetime: iso ? iso.toISOString() : null,
        lat: isFinite(lat) ? lat : null,
        lon: isFinite(lon) ? lon : null,
        depth: isFinite(depth) ? depth : null,
        mag: isFinite(mag) ? mag : null,
        place: place || null
      });
    } catch (err) {
      // parsing devam etsin
    }
  });

  return events;
}

// Proxy endpoint for Kandilli (lst9.asp)
app.get('/api/kandilli', async (req, res) => {
  try {
    const url = 'http://www.koeri.boun.edu.tr/scripts/lst9.asp';
    const resp = await fetch(url, { timeout: 10000 });
    const text = await resp.text();

    const parsed = parseKandilliLst(text);

    res.json({ ok: true, count: parsed.length, events: parsed });
  } catch (err) {
    console.error('Kandilli proxy error:', err.message || err);
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

// Simple health
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (proxy for Kandilli)`);
});
