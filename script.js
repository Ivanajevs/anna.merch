/* ═══════════════════════════════════════════════════════════════════
   St. Anna Merch Shop – script.js
   ▶ E-Mail-Versand: Brevo Transactional API (kein eigener Server nötig)
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────
   ① BREVO KONFIGURATION
   ▶ API-Key: Brevo Dashboard → „Mein Konto" → SMTP & API → API-Keys
      Lege dort einen Key mit NUR der Berechtigung „Transactional emails"
      an. Dieser Key erlaubt ausschließlich das Versenden von E-Mails –
      kein Zugriff auf Kontaktlisten, Statistiken o. Ä.
   ▶ Template-IDs: Brevo Dashboard → Templates → jeweilige ID rechts
   ───────────────────────────────────────────────────────────────────── */
const BREVO_API_KEY          = "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";   // ← ersetzen
const BREVO_ADMIN_TEMPLATE   = 4;   // ← Template-ID „Neue Bestellung (Admin)"
const BREVO_USER_TEMPLATE    = 3;   // ← Template-ID „Bestellbestätigung (Kunde)"
const ADMIN_EMAIL            = "bestellung@merch.st-anna.de";

/* ─────────────────────────────────────────────────────────────────────
   ② SUPABASE KONFIGURATION
   ─────────────────────────────────────────────────────────────────── */
const SUPABASE_URL      = "https://daidxdpsyncqedsixvwm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_wm01ffHn7eXfeJaAiXrGdA_b-VJntmy";

const { createClient } = supabase;
const supabaseClient   = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─────────────────────────────────────────────────────────────────────
   ③ PRODUKTDATEN
   ─────────────────────────────────────────────────────────────────── */
const products = [
  {
    id: 1,
    name: "Polo Shirt",
    price: "24,99 €",
    desc: "Unser in der EU gefertigter Polo-Klassiker aus 100 % Baumwolle.",
    badge: "First edition",
    img: "polo.jpeg",
    colors: [
      { hex: "#000670", name: "Blau" },
      { hex: "#ffffff", name: "Weiß" },
      { hex: "#000000", name: "Schwarz" },
    ],
  },
  {
    id: 2,
    name: "T-Shirt",
    price: "19,99 €",
    desc: "Leichtes 100 % Baumwoll-Shirt für jeden Tag.",
    badge: "NEU",
    img: "tshirt.jpeg",
    colors: [
      { hex: "#000564", name: "Blau" },
      { hex: "#ffffff", name: "Weiß" },
      { hex: "#000000", name: "Schwarz" },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────────────
   ④ STATE
   ─────────────────────────────────────────────────────────────────── */
let currentProduct = null;

/* ─────────────────────────────────────────────────────────────────────
   ⑤ BESTELL-ID GENERIEREN
   Format: SA-<Zeitstempel Base36>-<4 Zufallszeichen>   Bsp: SA-LR8K2A-F3TQ
   ─────────────────────────────────────────────────────────────────── */
function generateOrderId() {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `SA-${ts}-${rand}`;
}

/* ─────────────────────────────────────────────────────────────────────
   ⑥ BREVO HELPER – sendet eine Template-Mail
   ▶ toEmail   – Empfänger-Adresse
   ▶ toName    – Empfänger-Name (für Anrede im Template)
   ▶ templateId – Integer, z. B. BREVO_ADMIN_TEMPLATE
   ▶ params    – Objekt mit Template-Variablen  {{ params.KEY }}
   ─────────────────────────────────────────────────────────────────── */
async function sendBrevoEmail(toEmail, toName, templateId, params) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      to: [{ email: toEmail, name: toName }],
      templateId: templateId,
      params: params,
      /* replyTo lässt den Admin direkt auf Kunden-Mails antworten */
      replyTo: { email: params.customer_email || ADMIN_EMAIL },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Brevo ${response.status}: ${err.message || response.statusText}`);
  }

  return response.json();
}

/* ─────────────────────────────────────────────────────────────────────
   ⑦ PRODUKTE RENDERN
   ─────────────────────────────────────────────────────────────────── */
function renderProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = "";

  products.forEach((p, idx) => {
    const colorDots = p.colors
      .map(c => `<span class="color-dot" style="background:${c.hex}" title="${c.name}"
                   ${c.hex === "#ffffff" ? 'style="background:#fff;border-color:#bbb"' : ""}></span>`)
      .join("");

    const badgeHTML = p.badge
      ? `<span class="card-badge">${p.badge}</span>`
      : "";

    const card = document.createElement("article");
    card.className = "product-card";
    card.style.animationDelay = `${idx * 0.07}s`;
    card.setAttribute("data-id", p.id);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${p.name} bestellen`);

    card.innerHTML = `
      <div class="card-img-wrap">
        ${badgeHTML}
        <img src="${p.img}" alt="${p.name}" loading="lazy"
             onerror="this.src='https://placehold.co/400x400/12131f/e8a020?text=${encodeURIComponent(p.name)}'">
      </div>
      <div class="card-body">
        <h3 class="card-name">${p.name}</h3>
        <p class="card-desc">${p.desc}</p>
        <div class="card-colors">${colorDots}</div>
        <div class="card-footer">
          <span class="card-price">${p.price}</span>
          <button class="card-btn">Bestellen</button>
        </div>
      </div>`;

    card.addEventListener("click", () => openModal(p));
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") openModal(p);
    });

    grid.appendChild(card);
  });
}

/* ─────────────────────────────────────────────────────────────────────
   ⑧ FARB-PICKER
   ─────────────────────────────────────────────────────────────────── */
function buildColorPicker(colors) {
  const row    = document.getElementById("colorSwatchRow");
  const hidden = document.getElementById("fieldColor");
  const label  = document.getElementById("colorSelectedLabel");

  row.innerHTML = "";
  hidden.value  = "";
  label.textContent = "";

  colors.forEach(c => {
    const btn = document.createElement("button");
    btn.type  = "button";
    btn.className = "color-swatch";
    btn.setAttribute("aria-label", c.name);
    btn.setAttribute("title", c.name);
    btn.style.setProperty("--swatch-color", c.hex);
    if (c.hex === "#ffffff" || c.hex === "#fff") {
      btn.classList.add("color-swatch--light");
    }

    btn.addEventListener("click", () => {
      row.querySelectorAll(".color-swatch").forEach(b => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      hidden.value      = c.name;
      label.textContent = c.name;
    });

    row.appendChild(btn);
  });
}

/* ─────────────────────────────────────────────────────────────────────
   ⑨ MODAL – ÖFFNEN / SCHLIESSEN
   ─────────────────────────────────────────────────────────────────── */
function openModal(product) {
  currentProduct = product;

  const img = document.getElementById("modalImg");
  img.src   = product.img;
  img.alt   = product.name;
  img.onerror = function () {
    this.src = `https://placehold.co/100x100/12131f/e8a020?text=${encodeURIComponent(product.name)}`;
  };
  document.getElementById("modalTitle").textContent = product.name;
  document.getElementById("modalPrice").textContent  = product.price;

  buildColorPicker(product.colors);

  document.getElementById("orderForm").reset();
  document.getElementById("fieldColor").value = "";
  document.getElementById("colorSelectedLabel").textContent = "";
  document.getElementById("colorSwatchRow")
    .querySelectorAll(".color-swatch")
    .forEach(b => b.classList.remove("is-selected"));

  document.getElementById("orderForm").hidden   = false;
  document.getElementById("modalSuccess").hidden = true;
  document.getElementById("formError").textContent = "";
  document.getElementById("submitLabel").textContent = "Bestellung absenden";
  document.getElementById("submitSpinner").hidden    = true;
  document.getElementById("submitBtn").disabled      = false;

  document.getElementById("modalOverlay").classList.add("active");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("modalClose").focus(), 350);
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("active");
  document.body.style.overflow = "";
  currentProduct = null;
}

document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalOverlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});
document.getElementById("successClose").addEventListener("click", closeModal);

/* ─────────────────────────────────────────────────────────────────────
   ⑩ FORMULAR-VALIDIERUNG
   ─────────────────────────────────────────────────────────────────── */
function validateForm() {
  const fields = [
    { id: "fieldSize",        label: "Größe" },
    { id: "fieldColor",       label: "Farbe" },
    { id: "fieldGender",      label: "Geschlecht" },
    { id: "fieldClassLevel",  label: "Klassenstufe" },
    { id: "fieldClassLetter", label: "Klassenbuchstabe" },
    { id: "fieldName",        label: "Vollständiger Name" },
    { id: "fieldEmail",       label: "E-Mail" },
  ];

  for (const f of fields) {
    const el = document.getElementById(f.id);
    if (!el.value.trim()) return `Bitte das Feld „${f.label}" ausfüllen.`;
  }

  const email = document.getElementById("fieldEmail").value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Bitte eine gültige E-Mail-Adresse eingeben.";
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────────
   ⑪ BESTELLUNG ABSENDEN
   Ablauf:
     1. Bestell-ID generieren
     2. Daten in Supabase speichern
     3. Admin-Mail via Brevo (Template BREVO_ADMIN_TEMPLATE)
     4. Kunden-Bestätigungsmail via Brevo (Template BREVO_USER_TEMPLATE)
   ─────────────────────────────────────────────────────────────────── */
document.getElementById("orderForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const error = validateForm();
  if (error) {
    document.getElementById("formError").textContent = error;
    return;
  }
  document.getElementById("formError").textContent = "";

  // UI: Lade-Status
  document.getElementById("submitLabel").textContent = "Wird gesendet…";
  document.getElementById("submitSpinner").hidden    = false;
  document.getElementById("submitBtn").disabled      = true;

  // ── Bestell-ID ─────────────────────────────────────────────────────
  const orderId = generateOrderId();

  // ── Daten sammeln ───────────────────────────────────────────────────
  const orderData = {
    order_id:       orderId,
    product_name:   currentProduct.name,
    product_price:  currentProduct.price,
    product_img:    window.location.origin + "/" + currentProduct.img,
    size:           document.getElementById("fieldSize").value,
    color:          document.getElementById("fieldColor").value,
    gender:         document.getElementById("fieldGender").value,
    class_level:    document.getElementById("fieldClassLevel").value,
    class_letter:   document.getElementById("fieldClassLetter").value,
    customer_name:  document.getElementById("fieldName").value.trim(),
    customer_email: document.getElementById("fieldEmail").value.trim(),
    note:           document.getElementById("fieldNote").value.trim() || "—",
    order_date:     new Date().toLocaleDateString("de-DE", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    }),
  };

  try {
    // ── Schritt 1: In Supabase speichern ─────────────────────────────
    const { error: dbError } = await supabaseClient
      .from("orders")
      .insert({
        order_id:       orderData.order_id,
        product_name:   orderData.product_name,
        product_price:  orderData.product_price,
        size:           orderData.size,
        color:          orderData.color,
        gender:         orderData.gender,
        class_level:    orderData.class_level,
        class_letter:   orderData.class_letter,
        customer_name:  orderData.customer_name,
        customer_email: orderData.customer_email,
        note:           orderData.note,
      });

    if (dbError) throw new Error("Supabase: " + dbError.message);

    // ── Schritt 2: Admin-Mail ─────────────────────────────────────────
    // Alle orderData-Felder werden als {{ params.KEY }} im Template genutzt.
    await sendBrevoEmail(
      ADMIN_EMAIL,
      "St. Anna Merch Team",
      BREVO_ADMIN_TEMPLATE,
      orderData
    );

    // ── Schritt 3: Bestätigungsmail an den Käufer ─────────────────────
    await sendBrevoEmail(
      orderData.customer_email,
      orderData.customer_name,
      BREVO_USER_TEMPLATE,
      orderData
    );

    // ── Erfolg anzeigen ───────────────────────────────────────────────
    const successPanel = document.getElementById("modalSuccess");
    const existingId   = successPanel.querySelector(".success-order-id");
    if (!existingId) {
      const idEl = document.createElement("p");
      idEl.className = "success-order-id";
      idEl.innerHTML = `Deine Bestell-ID: <strong>${orderId}</strong>`;
      successPanel.insertBefore(idEl, successPanel.querySelector(".success-note"));
    } else {
      existingId.innerHTML = `Deine Bestell-ID: <strong>${orderId}</strong>`;
    }

    document.getElementById("orderForm").hidden    = true;
    document.getElementById("modalSuccess").hidden = false;

  } catch (err) {
    console.error("Fehler:", err);
    document.getElementById("formError").textContent =
      "Beim Senden ist ein Fehler aufgetreten. Bitte versuche es erneut oder schreibe uns direkt an bestellung@merch.st-anna.de";
    document.getElementById("submitLabel").textContent = "Bestellung absenden";
    document.getElementById("submitSpinner").hidden    = true;
    document.getElementById("submitBtn").disabled      = false;
  }
});

/* ─────────────────────────────────────────────────────────────────────
   ⑫ APP STARTEN
   ─────────────────────────────────────────────────────────────────── */
(function init() {
  renderProducts();
})();
