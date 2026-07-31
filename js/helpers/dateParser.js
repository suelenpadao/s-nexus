// helpers/dateParser.js
// Converte datas em formato brasileiro (dd/mm/aaaa, dd-mm-aaaa, "10 de março de 2026") pra ISO (YYYY-MM-DD).

const MONTHS_PT = {
  janeiro:1, fevereiro:2, março:3, marco:3, abril:4, maio:5, junho:6,
  julho:7, agosto:8, setembro:9, outubro:10, novembro:11, dezembro:12
};

export function parseBRDate(str) {
  if (!str) return null;
  str = str.trim();

  // dd/mm/aaaa ou dd-mm-aaaa ou dd.mm.aaaa
  let m = str.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    const iso = `${y.padStart(4,'0')}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
    return isValidISO(iso) ? iso : null;
  }

  // "10 de março de 2026"
  m = str.toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
  if (m) {
    const [, d, monthName, y] = m;
    const mo = MONTHS_PT[monthName];
    if (mo) {
      const iso = `${y}-${String(mo).padStart(2,'0')}-${d.padStart(2,'0')}`;
      return isValidISO(iso) ? iso : null;
    }
  }

  // já está em ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return isValidISO(str) ? str : null;

  return null;
}

function isValidISO(iso) {
  const d = new Date(iso + 'T00:00:00');
  return !isNaN(d.getTime());
}

export function findAllDatesBR(text) {
  const found = text.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/g) || [];
  return found.map(parseBRDate).filter(Boolean);
}
