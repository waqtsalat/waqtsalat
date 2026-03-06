/**
 * Fetch golden master dataset from Al Adhan API (method=21, MOROCCO).
 * Fetches 8+ cities × 12 months for year 2025.
 * Stores results in tests/data/golden-master.json
 */
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'tests', 'data', 'golden-master.json');

const YEAR = 2025;
const METHOD = 21; // MOROCCO: Fajr 19°, Isha 17°

// 8 representative cities across Morocco
const CITIES = [
  { id: 'rabat', name: 'Rabat', lat: 34.0209, lng: -6.8416 },
  { id: 'casablanca', name: 'Casablanca', lat: 33.5731, lng: -7.5898 },
  { id: 'fes', name: 'Fes', lat: 34.0331, lng: -5.0003 },
  { id: 'marrakech', name: 'Marrakech', lat: 31.6295, lng: -7.9811 },
  { id: 'tanger', name: 'Tanger', lat: 35.7595, lng: -5.834 },
  { id: 'agadir', name: 'Agadir', lat: 30.4278, lng: -9.5981 },
  { id: 'oujda', name: 'Oujda', lat: 34.6814, lng: -1.9086 },
  { id: 'laayoune', name: 'Laayoune', lat: 27.1536, lng: -13.2033 },
];

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === retries) throw e;
      const delay = 1000 * (2 ** i);
      console.log(`  Retry ${i + 1} in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function fetchCityMonth(city, month) {
  const url = `https://api.aladhan.com/v1/calendar/${YEAR}/${month}?latitude=${city.lat}&longitude=${city.lng}&method=${METHOD}`;
  console.log(`  Fetching ${city.name} ${YEAR}/${month}...`);
  const data = await fetchWithRetry(url);

  if (data.code !== 200 || !data.data) {
    throw new Error(`API error for ${city.name} ${month}: ${JSON.stringify(data)}`);
  }

  return data.data.map(day => ({
    date: day.date.gregorian.date, // DD-MM-YYYY
    fajr: day.timings.Fajr.replace(/ \(.*\)/, ''),
    sunrise: day.timings.Sunrise.replace(/ \(.*\)/, ''),
    dhuhr: day.timings.Dhuhr.replace(/ \(.*\)/, ''),
    asr: day.timings.Asr.replace(/ \(.*\)/, ''),
    maghrib: day.timings.Maghrib.replace(/ \(.*\)/, ''),
    isha: day.timings.Isha.replace(/ \(.*\)/, ''),
  }));
}

async function main() {
  // Resume from partial data if exists
  let dataset = {};
  if (existsSync(OUTPUT_PATH)) {
    try {
      dataset = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
      console.log('Resuming from existing dataset...');
    } catch { /* start fresh */ }
  }

  for (const city of CITIES) {
    if (!dataset[city.id]) {
      dataset[city.id] = {
        id: city.id,
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        months: {},
      };
    }

    for (let month = 1; month <= 12; month++) {
      const key = String(month);
      if (dataset[city.id].months[key]) {
        console.log(`  Skipping ${city.name} ${YEAR}/${month} (already fetched)`);
        continue;
      }

      try {
        const days = await fetchCityMonth(city, month);
        dataset[city.id].months[key] = days;

        // Save incrementally
        writeFileSync(OUTPUT_PATH, JSON.stringify(dataset, null, 2));

        // Rate limit: be polite to the API
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`  ERROR for ${city.name} ${month}: ${e.message}`);
      }
    }
  }

  console.log(`\nDataset saved to ${OUTPUT_PATH}`);
  console.log(`Cities: ${Object.keys(dataset).length}`);
  const totalDays = Object.values(dataset).reduce((sum, city) =>
    sum + Object.values(city.months).reduce((s, m) => s + m.length, 0), 0);
  console.log(`Total days: ${totalDays}`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
