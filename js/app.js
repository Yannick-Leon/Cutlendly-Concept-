/* Cutlendly – Kunden-UI (statisch / GitHub Pages)
 * Features:
 * - Geschlossen: Sonntag (0) & Montag (1)
 * - Seed-Buchungen (einmalig) für die nächsten Tage
 * - Warteliste (localStorage)
 */

const servicesUrl = 'data/services.json';
const OV_KEY = 'nnz-services-overrides'; // bleibt so für Kompatibilität

// Elemente
const serviceSelect = document.getElementById('serviceSelect');
const stylistSelect = document.getElementById('stylistSelect');
const dateInput = document.getElementById('dateInput');
const timeSelect = document.getElementById('timeSelect');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const summaryBox = document.getElementById('summary');
const form = document.getElementById('bookingForm');
const submitBtn = form.querySelector('button[type="submit"]');

// Konfiguration
const CLOSED_DAYS = [0, 1]; // 0=So, 1=Mo
const OPEN_HOUR = 9;        // 09:00
const CLOSE_HOUR = 18;      // 18:00
const STEP_MIN = 30;

// State
let services = [];
let overrides = {};
let selectedService = null;

// ---------- Utils ----------

function refreshSubmitState() {
  // Wenn keine Auswahl möglich ist (nur Platzhalter/disabled Option), Button sperren
  const noRealOption = !timeSelect.options.length || timeSelect.options[0].disabled;
  submitBtn.disabled = noRealOption || isClosed(dateInput.value);
}

function loadOverrides(){
  try { overrides = JSON.parse(localStorage.getItem(OV_KEY) || '{}'); }
  catch { overrides = {}; }
}
function mergedServiceById(id){
  const base = services.find(s => s.id === id);
  const ov = overrides[id] || {};
  return { ...base, ...ov };
}
function pad(n){ return n.toString().padStart(2,'0'); }
function ymd(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function isClosed(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  return CLOSED_DAYS.includes(dow);
}

// ---------- Seed-Buchungen (einmalig) ----------
function seedBookingsOnce(){
  if (localStorage.getItem('cutlendly-seeded')) return;

  // seed für die nächsten 5 Kalendertage (außer So/Mo): blocke je 10:00 und 14:00 (Stylist ANY)
  const today = new Date();
  for (let i=0; i<5; i++){
    const d = new Date(today);
    d.setDate(today.getDate()+i);
    const key = `bookings-${ymd(d)}`;
    if (isClosed(ymd(d))) continue;

    const durationFallback = 30; // falls Service noch nicht geladen ist, nehmen wir 30 Min
    const base = JSON.parse(localStorage.getItem(key) || '[]');
    // 10:00
    base.push({ stylist: 'ANY', startMin: 10*60, endMin: 10*60 + durationFallback, seed:true });
    // 14:00
    base.push({ stylist: 'ANY', startMin: 14*60, endMin: 14*60 + durationFallback, seed:true });

    localStorage.setItem(key, JSON.stringify(base));
  }
  localStorage.setItem('cutlendly-seeded', '1');
}

// ---------- Slots ----------
function generateSlots() {
  timeSelect.innerHTML = '';
  if (!dateInput.value || !selectedService) return;

  // geschlossen-Handling
  if (isClosed(dateInput.value)) {
    const opt = document.createElement('option');
    opt.textContent = 'Geschlossen (Sonntag/Montag)';
    opt.disabled = true;
    timeSelect.appendChild(opt);
    submitBtn.disabled = true;
    updateSummary(); // zeigt "geschlossen"
    return;
  } else {
    submitBtn.disabled = false;
  }

  const duration = selectedService.durationMin;
  const key = `bookings-${dateInput.value}`;
  const dayBookings = JSON.parse(localStorage.getItem(key) || '[]');
  const stylist = stylistSelect.value || 'ANY';

  for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
    for (let m = 0; m < 60; m += STEP_MIN) {
      const startMin = h * 60 + m;
      const endMin = startMin + duration;
      if (endMin > CLOSE_HOUR * 60) continue;

      // Kollision prüfen
      const overlaps = dayBookings.some(b =>
        b.stylist === stylist && !(endMin <= b.startMin || startMin >= b.endMin)
      );
      if (!overlaps) {
        const opt = document.createElement('option');
        opt.value = `${pad(h)}:${pad(m)}`;
        opt.textContent = opt.value;
        timeSelect.appendChild(opt);
      }
    }
  }

  if (!timeSelect.options.length) {
    const opt = document.createElement('option');
    opt.textContent = 'Keine freien Slots – Warteliste möglich';
    opt.disabled = true;
    timeSelect.appendChild(opt);
  }
  refreshSubmitState();
}

// ---------- Summary ----------
function updateSummary() {
  if (!selectedService) { summaryBox.textContent = ''; return; }

  const closedMsg = isClosed(dateInput.value) ? ' (geschlossen)' : '';
  const dep = selectedService.requireDeposit
    ? ((selectedService.deposit ?? 0) + ' €')
    : 'Keine';

  summaryBox.innerHTML = `
    <strong>Zusammenfassung</strong><br/>
    Service: ${selectedService.name} (${selectedService.durationMin} Min)<br/>
    Anzahlung: ${dep}<br/>
    Friseur: ${stylistSelect.value || 'egal'}<br/>
    Datum/Uhrzeit: ${dateInput.value || '-'} ${timeSelect.value || ''} ${closedMsg}
  `;
}

function updateSubmitButton(ms){
  if (ms.requireDeposit) {
    submitBtn.textContent = 'Jetzt mit Anzahlung reservieren';
  } else {
    submitBtn.textContent = 'Termin kostenlos reservieren';
  }
}

// ---------- Warteliste ----------
function ensureWaitlistUI(){
  // Button nur einmal hinzufügen
  if (document.getElementById('waitlistBtn')) return;

  const wlBtn = document.createElement('button');
  wlBtn.type = 'button';
  wlBtn.id = 'waitlistBtn';
  wlBtn.className = 'primary';
  wlBtn.style.marginTop = '8px';
  wlBtn.textContent = 'Auf Warteliste setzen';
  form.appendChild(wlBtn);

  const info = document.createElement('p');
  info.className = 'note';
  info.textContent = 'Wir informieren dich, wenn ein Platz frei wird (gleicher Tag & Service).';
  form.appendChild(info);

  wlBtn.addEventListener('click', () => {
    if (!selectedService || !dateInput.value || !nameInput.value || !emailInput.value) {
      alert('Bitte Service, Datum, Name & E-Mail ausfüllen.');
      return;
    }
    const key = `waitlist-${dateInput.value}`;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.push({
      createdAt: new Date().toISOString(),
      name: nameInput.value,
      email: emailInput.value,
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      stylist: stylistSelect.value || 'ANY'
    });
    localStorage.setItem(key, JSON.stringify(list));
    alert('Du stehst jetzt auf der Warteliste für diesen Tag. Wir melden uns, sobald ein Slot frei wird.');
  });
}

// ---------- Events & Flow ----------
function updateSelectedService() {
  selectedService = mergedServiceById(serviceSelect.value);
  updateSubmitButton(selectedService);
  updateSummary();
  generateSlots();
}

serviceSelect.addEventListener('change', () => { updateSelectedService(); generateSlots(); refreshSubmitState(); });
stylistSelect.addEventListener('change', () => { updateSummary(); generateSlots(); refreshSubmitState(); });
dateInput.addEventListener('change', () => { generateSlots(); updateSummary(); refreshSubmitState(); });
timeSelect.addEventListener('change', () => { updateSummary(); refreshSubmitState(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedService) return;

  // geschlossen blocken
  if (isClosed(dateInput.value)) {
    alert('An diesem Tag ist der Salon geschlossen.');
    return;
  }

  if (!timeSelect.value || timeSelect.options[0].disabled) {
    alert('Kein Slot ausgewählt. Du kannst die Warteliste nutzen.');
    return;
  }

  // Slot erneut prüfen (Race-Condition in echter App)
  const [h, m] = timeSelect.value.split(':').map(Number);
  const startMin = h*60 + m;
  const endMin = startMin + selectedService.durationMin;
  const stylist = stylistSelect.value || 'ANY';
  const key = `bookings-${dateInput.value}`;
  const dayBookings = JSON.parse(localStorage.getItem(key) || '[]');

  const overlaps = dayBookings.some(b =>
    b.stylist === stylist && !(endMin <= b.startMin || startMin >= b.endMin)
  );
  if (overlaps) {
    alert('Dieser Slot ist soeben belegt worden. Bitte anderen Slot wählen oder Warteliste nutzen.');
    generateSlots();
    return;
  }

  // Belegen (Demo, lokal)
  dayBookings.push({ stylist, startMin, endMin });
  localStorage.setItem(key, JSON.stringify(dayBookings));

  // E-Mail (optional, Demo) – falls eingebaut
  try {
    await emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
      to_email: emailInput.value,
      customer_name: nameInput.value,
      service_name: selectedService.name,
      service_date: dateInput.value,
      service_time: timeSelect.value,
      deposit_amount: selectedService.requireDeposit ? (selectedService.deposit ?? 0) + " €" : "0 €",
      salon_name: "Salon"
    });
  } catch (_) {}

  // Payment-Flow abhängig von requireDeposit
  if (selectedService.requireDeposit && selectedService.paymentLink) {
    window.location.href = selectedService.paymentLink;
  } else {
    window.location.href = 'thanks.html';
  }
});

// ---------- Init ----------
(async function init(){
  // heutiges Datum + min setzen, außerdem auf nächsten offenen Tag springen
  const today = new Date();
  const minYmd = ymd(today);
  dateInput.min = minYmd;

  // auf heute oder nächsten offenen Tag setzen
  let cur = new Date(today);
  while (isClosed(ymd(cur))) {
    cur.setDate(cur.getDate()+1);
  }
  dateInput.value = ymd(cur);

  seedBookingsOnce(); // vor dem Laden der Services ok (nutzt 30-Min-Dummy)

  loadOverrides();
  const res = await fetch(servicesUrl);
  services = await res.json();

  // Defaults für requireDeposit aus paymentLink ableiten
  services.forEach(s => {
    if (!overrides[s.id] || typeof overrides[s.id].requireDeposit === 'undefined'){
      const def = Boolean(s.paymentLink);
      overrides[s.id] = { ...(overrides[s.id]||{}), requireDeposit: def };
    }
  });

  // Dropdown füllen
  services.forEach(s => {
    const ms = { ...s, ...(overrides[s.id]||{}) };
    const opt = document.createElement('option');
    opt.value = s.id;
    const depTxt = ms.requireDeposit ? ` – Anz. ${ms.deposit ?? s.deposit ?? 0}€` : ' – keine Anzahlung';
    opt.textContent = `${s.name} (${ms.durationMin} Min${depTxt ? '' : ''})`;
    serviceSelect.appendChild(opt);
  });

  if (services.length) {
    serviceSelect.value = services[0].id;
    updateSelectedService();
  }

  ensureWaitlistUI();
})();

// Warteliste-Eintrag Demo für morgen 14:00
(function seedWaitlist(){
  const d = new Date();
  d.setDate(d.getDate() + 1); // morgen
  const dateStr = d.toISOString().split('T')[0];
  const key = `waitlist-${dateStr}`;
  const entry = {
    createdAt: new Date().toISOString(),
    name: "Max Mustermann",
    email: "max@example.com",
    serviceId: "cut-men-30",
    serviceName: "Herrenhaarschnitt",
    stylist: "ANY"
  };
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push(entry);
  localStorage.setItem(key, JSON.stringify(list));
  console.log("Warteliste-Eintrag angelegt für", dateStr, "14:00");
})();
