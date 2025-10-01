const servicesUrl = 'data/services.json';
const OV_KEY = 'nnz-services-overrides';

const serviceSelect = document.getElementById('serviceSelect');
const stylistSelect = document.getElementById('stylistSelect');
const dateInput = document.getElementById('dateInput');
const timeSelect = document.getElementById('timeSelect');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const summaryBox = document.getElementById('summary');
const form = document.getElementById('bookingForm');
const submitBtn = form.querySelector('button[type="submit"]');

let services = [];
let overrides = {};
let selectedService = null;

function loadOverrides(){
  try {
    overrides = JSON.parse(localStorage.getItem(OV_KEY) || '{}');
  } catch { overrides = {}; }
}

function mergedServiceById(id){
  const base = services.find(s => s.id === id);
  const ov = overrides[id] || {};
  return { ...base, ...ov };
}

async function loadServices() {
  loadOverrides();
  const res = await fetch(servicesUrl);
  services = await res.json();

  // Falls requireDeposit im Override fehlt, sinnvoll vorbelegen
  services.forEach(s => {
    if (!overrides[s.id] || typeof overrides[s.id].requireDeposit === 'undefined'){
      const def = Boolean(s.paymentLink);
      overrides[s.id] = { ...(overrides[s.id]||{}), requireDeposit: def };
    }
  });

  // Dropdown
  services.forEach(s => {
    const ms = { ...s, ...(overrides[s.id]||{}) };
    const opt = document.createElement('option');
    opt.value = s.id;
    const dep = ms.requireDeposit ? ` – Anz. ${ms.deposit ?? s.deposit ?? 0}€` : ' – keine Anzahlung';
    opt.textContent = `${s.name} (${ms.durationMin} Min${dep ? '' : ''})`;
    serviceSelect.appendChild(opt);
  });

  if (services.length) {
    serviceSelect.value = services[0].id;
    updateSelectedService();
  }
}

function updateSubmitButton(ms){
  if (ms.requireDeposit) {
    submitBtn.textContent = 'Jetzt mit Anzahlung reservieren';
  } else {
    submitBtn.textContent = 'Termin kostenlos reservieren';
  }
}

function updateSelectedService() {
  selectedService = mergedServiceById(serviceSelect.value);
  updateSubmitButton(selectedService);
  updateSummary();
  generateSlots();
}

function generateSlots() {
  timeSelect.innerHTML = '';
  if (!dateInput.value || !selectedService) return;

  // Demo Öffnungszeiten 09–18 Uhr, 30-Min Raster
  const open = 9, close = 18;
  const step = 30;
  const duration = selectedService.durationMin;

  const key = `bookings-${dateInput.value}`;
  const dayBookings = JSON.parse(localStorage.getItem(key) || '[]');
  const pad = n => n.toString().padStart(2,'0');

  for (let h = open; h <= close; h++) {
    for (let m = 0; m < 60; m += step) {
      const startMin = h * 60 + m;
      const endMin = startMin + duration;
      if (endMin > close * 60) continue;

      const slot = `${pad(h)}:${pad(m)}`;
      const stylist = stylistSelect.value || 'ANY';
      const overlaps = dayBookings.some(b =>
        b.stylist === stylist && !(endMin <= b.startMin || startMin >= b.endMin)
      );
      if (!overlaps) {
        const opt = document.createElement('option');
        opt.value = slot;
        opt.textContent = slot;
        timeSelect.appendChild(opt);
      }
    }
  }

  if (!timeSelect.options.length) {
    const opt = document.createElement('option');
    opt.textContent = 'Keine freien Slots';
    opt.disabled = true;
    timeSelect.appendChild(opt);
  }
}

function updateSummary() {
  if (!selectedService) { summaryBox.textContent = ''; return; }
  const dep = selectedService.requireDeposit
    ? (selectedService.deposit ?? selectedService.deposit ?? 0) + ' €'
    : 'Keine';

  summaryBox.innerHTML = `
    <strong>Zusammenfassung</strong><br/>
    Service: ${selectedService.name} (${selectedService.durationMin} Min)<br/>
    Anzahlung: ${dep}<br/>
    Friseur: ${stylistSelect.value || 'egal'}<br/>
    Datum/Uhrzeit: ${dateInput.value || '-'} ${timeSelect.value || ''}
  `;
}

// Events
serviceSelect.addEventListener('change', () => { updateSelectedService(); generateSlots(); });
stylistSelect.addEventListener('change', () => { updateSummary(); generateSlots(); });
dateInput.addEventListener('change', () => { generateSlots(); updateSummary(); });
timeSelect.addEventListener('change', updateSummary);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedService || !timeSelect.value) return;

  // Belegen (Demo, lokal)
  const [h, m] = timeSelect.value.split(':').map(Number);
  const startMin = h*60 + m;
  const endMin = startMin + selectedService.durationMin;
  const stylist = stylistSelect.value || 'ANY';
  const key = `bookings-${dateInput.value}`;
  const dayBookings = JSON.parse(localStorage.getItem(key) || '[]');
  dayBookings.push({ stylist, startMin, endMin });
  localStorage.setItem(key, JSON.stringify(dayBookings));

  // E-Mail (optional, Demo)
  try {
    await emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
      to_email: emailInput.value,
      customer_name: nameInput.value,
      service_name: selectedService.name,
      service_date: dateInput.value,
      service_time: timeSelect.value,
      deposit_amount: selectedService.requireDeposit ? (selectedService.deposit ?? 0) + " €" : "0 €",
      salon_name: "Salon Nunzio"
    });
  } catch (_) {}

  // Payment-Flow abhängig von requireDeposit
  if (selectedService.requireDeposit && selectedService.paymentLink) {
    window.location.href = selectedService.paymentLink;
  } else {
    window.location.href = 'thanks.html';
  }
});

// Init defaults
(function initDefaults(){
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
})();
loadServices().then(generateSlots);
