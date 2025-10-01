const servicesUrl = 'data/services.json';

const serviceSelect = document.getElementById('serviceSelect');
const stylistSelect = document.getElementById('stylistSelect');
const dateInput = document.getElementById('dateInput');
const timeSelect = document.getElementById('timeSelect');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const summaryBox = document.getElementById('summary');
const form = document.getElementById('bookingForm');

let services = [];
let selectedService = null;

async function loadServices() {
  const res = await fetch(servicesUrl);
  services = await res.json();
  services.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = `${s.name} (${s.durationMin} Min)`;
    serviceSelect.appendChild(opt);
  });
  // Preselect first
  if (services.length) {
    serviceSelect.value = services[0].id;
    updateSelectedService();
  }
}

function updateSelectedService() {
  selectedService = services.find(s => s.id === serviceSelect.value);
  updateSummary();
  generateSlots();
}

function generateSlots() {
  timeSelect.innerHTML = '';
  if (!dateInput.value || !selectedService) return;

  // Demo: Öffnungszeiten 09:00–18:00, 30-Min Raster
  const open = 9, close = 18;
  const step = 30; // min
  const duration = selectedService.durationMin;

  // Demo-"Belegt" aus localStorage laden
  const key = `bookings-${dateInput.value}`;
  const dayBookings = JSON.parse(localStorage.getItem(key) || '[]');

  const pad = n => n.toString().padStart(2,'0');

  for (let h = open; h <= close; h++) {
    for (let m = 0; m < 60; m += step) {
      const startMin = h * 60 + m;
      const endMin = startMin + duration;
      if (endMin > close * 60) continue;

      const slot = `${pad(h)}:${pad(m)}`;
      // Kollision prüfen (Demo, pro Stylist getrennt)
      const stylist = stylistSelect.value || 'ANY';
      const overlaps = dayBookings.some(b =>
        b.stylist === stylist &&
        !(endMin <= b.startMin || startMin >= b.endMin)
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
  summaryBox.innerHTML = `
    <strong>Zusammenfassung</strong><br/>
    Service: ${selectedService.name} (${selectedService.durationMin} Min)<br/>
    Anzahlung: ${selectedService.deposit.toFixed(2)} €<br/>
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

  // Demo-Buchung lokal "blocken"
  const [h, m] = timeSelect.value.split(':').map(Number);
  const startMin = h*60 + m;
  const endMin = startMin + selectedService.durationMin;
  const stylist = stylistSelect.value || 'ANY';
  const key = `bookings-${dateInput.value}`;
  const dayBookings = JSON.parse(localStorage.getItem(key) || '[]');
  dayBookings.push({ stylist, startMin, endMin });
  localStorage.setItem(key, JSON.stringify(dayBookings));

  // Demo-Bestätigungs-Mail via EmailJS
  try {
    await emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
      to_email: emailInput.value,
      customer_name: nameInput.value,
      service_name: selectedService.name,
      service_date: dateInput.value,
      service_time: timeSelect.value,
      deposit_amount: selectedService.deposit + " €"
    });
  } catch (_) {
    // Fürs Demo ok, wenn Mail mal nicht klappt
  }

  // Weiterleitung zur Anzahlung (Payment Link)
  window.location.href = selectedService.paymentLink;
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
