
const SUPABASE_URL = "https://adsgjmybppdacdndrqsf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_niEp79PXenQB2MVh7I8zpA_XSDAxIdB";
const VAPID_PUBLIC_KEY = "BKgvzZqkP_yEyQTUkVzDac6I2dZVIai3FTvxbTVjp-thttnSxfk65arLDAmSKZjKwLutlfaZ4oNF7c54pjoJcU4";
const ACCESS_FUNCTION = `${SUPABASE_URL}/functions/v1/gestionar-acceso-lavador`;
let ccwWashersAdminCache = [];

const headers = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  "Content-Type": "application/json"
};

async function llamarFuncion(body) {
  const response = await fetch(ACCESS_FUNCTION, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

async function iniciarSesion(email, password) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password })
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg || data.message || "No se pudo iniciar sesión.");
  }
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Supabase no devolvió una sesión válida.");
  }

  sessionStorage.setItem("ccw_access_token", data.access_token);
  sessionStorage.setItem("ccw_refresh_token", data.refresh_token);

  try {
    const profile = await comprobarPerfilAdmin(data.access_token);
    return { user: data.user, perfil: profile };
  } catch (error) {
    cerrarSesion();
    throw error;
  }
}

async function comprobarPerfilAdmin(token) {
  const userId = JSON.parse(atob(token.split(".")[1])).sub;
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,role,active&id=eq.${encodeURIComponent(userId)}`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) throw new Error("No se pudo comprobar el perfil administrativo.");
  const profiles = await response.json();
  const profile = profiles[0];

  if (!profile || profile.role !== "admin" || profile.active !== true) {
    throw new Error("Acceso denegado: se requiere un administrador activo.");
  }
  return profile;
}

function cerrarSesion() {
  sessionStorage.removeItem("ccw_access_token");
  sessionStorage.removeItem("ccw_refresh_token");
}

async function obtenerSesionAdmin() {
  const token = sessionStorage.getItem("ccw_access_token");
  if (!token) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    cerrarSesion();
    return null;
  }
  return { perfil: await comprobarPerfilAdmin(token), accessToken: token };
}

async function generarPinLavador(washerId, planDate) {
  const token = sessionStorage.getItem("ccw_access_token");
  if (!token) throw new Error("Inicia sesión como administradora primero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate || "")) {
    throw new Error("Selecciona una fecha válida para el PIN.");
  }

  const response = await fetch(ACCESS_FUNCTION, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ action: "generate_pin", washer_id: washerId, plan_date: planDate })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo generar el PIN.");
  return data;
}


async function llamarAdminLavador(body) {
  const token = sessionStorage.getItem("ccw_access_token");
  if (!token) throw new Error("Inicia sesión como administradora primero.");
  const response = await fetch(ACCESS_FUNCTION, { method: "POST", headers: { ...headers, Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

function escaparHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function estiloBase() {
  document.body.style.cssText =
    "margin:0;background:#f4f7f5;color:#183126;font-family:Arial,sans-serif";
}

function cabecera(subtitulo) {
  return `
    <header style="
      background:#10251d;
      color:white;
      padding:18px 12px;
      text-align:center;
      width:100%;
      overflow:hidden;
    ">
      <img
        src="./logo.png?v=2"
        alt="Logo de EL CAIMAN CAR WASH"
        width="1200"
        height="800"
        style="
          display:block;
          width:min(85%,260px);
          height:auto;
          max-height:210px;
          object-fit:contain;
          margin:0 auto 12px;
          border:0;
          border-radius:10px;
        "
      >
      <h1 style="
        margin:0 0 8px;
        font-size:clamp(20px,4vw,28px);
        line-height:1.2;
        overflow-wrap:anywhere;
      ">EL CAIMAN CAR WASH</h1>
      <p style="margin:0;line-height:1.4">${subtitulo}</p>
    </header>`;
}

function boton(text, id) {
  return `<button id="${id}" type="button"
    style="padding:14px;background:#18764e;color:white;border:0;border-radius:8px;font-size:16px;cursor:pointer">${text}</button>`;
}

function mostrarInicio(mensaje = "") {
  estiloBase();
  document.body.innerHTML = `
    ${cabecera("Lavado profesional · Reservas y atención")}
    <main style="max-width:520px;margin:32px auto;padding:20px;display:grid;gap:16px">
      <h2 style="text-align:center">Bienvenido</h2>
      <p style="text-align:center">Selecciona cómo deseas ingresar.</p>
      ${boton("Soy cliente · Reservar lavado", "ccw-cliente")}
      ${boton("Administración", "ccw-admin")}
      ${boton("Acceso del lavador", "ccw-lavador")}
      <p id="ccw-home-message" role="status">${escaparHTML(mensaje)}</p>
    </main>`;

  document.getElementById("ccw-cliente").onclick = () => mostrarCliente();
  document.getElementById("ccw-admin").onclick = async () => {
    try {
      const session = await obtenerSesionAdmin();
      if (session) mostrarPanelAdmin(session.perfil);
      else mostrarLoginAdmin();
    } catch {
      cerrarSesion();
      mostrarLoginAdmin();
    }
  };
  document.getElementById("ccw-lavador").onclick = () => mostrarLoginLavador();
}

async function cargarCatalogoPublico() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gestionar-reservas`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "catalogo" })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    throw new Error(data.error || `No se pudo cargar el catálogo (HTTP ${response.status}).`);
  }
  return Array.isArray(data.catalogo) ? data.catalogo : [];
}

function formatoPrecio(precio) {
  return new Intl.NumberFormat("es-PA", {
    style: "currency", currency: "USD", maximumFractionDigits: 2
  }).format(precio);
}

function mostrarTarifasServicio(servicio) {
  const tarifas = Array.isArray(servicio.tarifas) ? servicio.tarifas : [];
  const confirmadas = tarifas.filter(t =>
    t.reservable === true && Number.isFinite(Number(t.precio))
  );
  const lista = confirmadas.length
    ? `<ul style="padding-left:20px;margin:10px 0">${confirmadas.map(t => {
        const variante = t.variante && t.variante !== "estandar" ? `${t.variante} · ` : "";
        const vehiculo = t.tipo_vehiculo && !["no_aplica", "no_definido"].includes(t.tipo_vehiculo)
          ? `${t.tipo_vehiculo.toUpperCase()} · ` : "";
        return `<li>${escaparHTML(variante + vehiculo)}${escaparHTML(formatoPrecio(Number(t.precio)))}</li>`;
      }).join("")}</ul>`
    : `<p style="margin:10px 0"><strong>Consultar a la Administradora</strong></p>`;
  const pendientes = tarifas.some(t => t.reservable !== true);
  const aviso = pendientes && confirmadas.length
    ? `<p style="color:#805500;font-size:14px">Otras variantes: consultar a la Administradora.</p>`
    : "";
  return `${lista}${aviso}`;
}

async function mostrarCliente() {
  estiloBase();
  document.body.innerHTML = `
    ${cabecera("Agendar una cita")}
    <main style="max-width:760px;margin:24px auto;padding:16px;display:grid;gap:14px">
      <section style="background:white;border:1px solid #d7e1da;border-radius:12px;padding:20px;display:grid;gap:12px">
        <h2 style="margin:0">Reserva tu lavado</h2>
        <p style="margin:0;color:#52655a">Selecciona una tarifa confirmada y solicita el horario. La cita solo queda confirmada si el sistema encuentra disponibilidad.</p>
        <form id="ccw-booking-form" style="display:grid;gap:12px">
          <section aria-labelledby="ccw-catalog-title" style="display:grid;gap:10px">
            <h3 id="ccw-catalog-title" style="margin:4px 0">Catálogo de servicios</h3>
            <label>1. Categoría del servicio
              <select id="ccw-service-category" required style="display:block;width:100%;padding:12px;margin-top:5px">
                <option value="">Selecciona una categoría</option>
                <option value="colchones">Lavado de colchones</option>
                <option value="autos">Limpieza de autos</option>
                <option value="muebles">Limpieza de muebles</option>
                <option value="motor">Lavado de motor</option>
                <option value="interior">Lavado de interior</option>
                <option value="lluvia">Tratamiento de lluvia ácida</option>
              </select>
            </label>
            <label id="ccw-car-type-wrap" hidden>2. Tipo de vehículo
              <select id="ccw-car-type" style="display:block;width:100%;padding:12px;margin-top:5px">
                <option value="">Selecciona el tipo de vehículo</option>
                <option value="sedan">Sedán</option>
                <option value="suv">SUV</option>
                <option value="4x4">4x4</option>
                <option value="pickup">Pickup</option>
                <option value="busito">Busito</option>
              </select>
            </label>
            <label>Servicio
              <select id="ccw-service-option" required style="display:block;width:100%;padding:12px;margin-top:5px" disabled>
                <option value="">Selecciona primero la categoría</option>
              </select>
            </label>
            <label>3. Tamaño / tipo de lavado / tarifa
              <select id="ccw-booking-tariff" required style="display:block;width:100%;padding:12px;margin-top:5px" disabled>
                <option value="">Selecciona un servicio primero</option>
              </select>
            </label>
            <p id="ccw-booking-price" style="margin:0;font-weight:bold"></p>
            <p id="ccw-service-help" style="margin:0;color:#52655a" role="status">Elige una categoría para ver sus opciones.</p>
          </section>
          <div id="ccw-vehicle-fields" style="display:grid;gap:12px">
            <label id="ccw-car-plate-wrap">Placa (obligatoria)
              <input id="ccw-car-plate" name="license_plate" maxlength="30" autocomplete="off"
                style="display:block;width:100%;padding:12px;margin-top:5px"
                placeholder="Ej.: ABC123">
            </label>
          </div>
          <label>Fecha solicitada<input id="ccw-booking-date" type="date" required style="display:block;width:100%;padding:12px;margin-top:5px"></label>
          <label>Hora disponible<select id="ccw-booking-time" required style="display:block;width:100%;padding:12px;margin-top:5px"><option value="">Selecciona primero servicio y fecha</option></select></label>
          <p id="ccw-availability-message" class="notice" role="status" aria-live="polite">Selecciona un servicio y una fecha para consultar los cupos reales.</p>
          <label>Notas (opcional)<textarea id="ccw-booking-notes" maxlength="500" rows="3" style="display:block;width:100%;padding:12px;margin-top:5px"></textarea></label>
          <p class="notice">Los horarios se calculan según la jornada publicada, los lavadores disponibles, la duración del servicio y las reservas existentes. La disponibilidad puede cambiar hasta que se confirme la reserva.</p>
          <fieldset id="ccw-customer-details" hidden disabled style="display:none;border:1px solid #d7e1da;border-radius:10px;padding:14px;gap:12px">
            <legend style="font-weight:700;padding:0 6px">Tus datos para confirmar la reserva</legend>
          <label>Nombre completo<input id="ccw-customer-name" name="customer_name" required minlength="2" maxlength="120" autocomplete="name" style="display:block;width:100%;padding:12px;margin-top:5px"></label>
          <label>Teléfono<input id="ccw-customer-phone" name="customer_phone" required minlength="7" maxlength="30" autocomplete="tel" style="display:block;width:100%;padding:12px;margin-top:5px"></label>
          
<label>Correo electrónico (obligatorio)
  <input
    id="ccw-customer-email"
    name="customer_email"
    type="email"
    required
    maxlength="254"
    autocomplete="email"
    style="display:block;width:100%;padding:12px;margin-top:5px"
  >
</label>
          <label>Número de casa y dirección exacta (obligatorio)
            <input id="ccw-customer-address" name="customer_address" required minlength="2" maxlength="250" autocomplete="street-address"
              style="display:block;width:100%;padding:12px;margin-top:5px"
              placeholder="Ej.: Casa 12, calle principal, portón negro, junto a…">
          </label>
<label for="ccw-payment-method" style="display:block;font-weight:600">
  Método de pago (obligatorio)
  <select
    id="ccw-payment-method"
    name="payment_method"
    required
    style="display:block;width:100%;padding:12px;margin-top:5px"
  >
    <option value="">Selecciona un método de pago</option>
    <option value="yappy">Yappy</option>
    <option value="ach">ACH</option>
    <option value="efectivo">Efectivo</option>
  </select>
</label>
          </fieldset>


          <button id="ccw-submit-booking" class="button" type="submit" style="margin-top:0">Solicitar cita</button>
          <p id="ccw-booking-message" role="status" aria-live="polite"></p>
        </form>
        <div id="ccw-booking-success" hidden style="background:#edf5ef;border-radius:10px;padding:16px"></div>
        <button class="button secondary" id="ccw-client-back" type="button">Volver al inicio</button>
      </section>
    </main>`;

  document.getElementById("ccw-client-back").onclick = () => mostrarInicio();

  const form = document.getElementById("ccw-booking-form");
  const tariffSelect = document.getElementById("ccw-booking-tariff");
  const priceLabel = document.getElementById("ccw-booking-price");
  const dateInput = document.getElementById("ccw-booking-date");
  const timeSelect = document.getElementById("ccw-booking-time");
  const availabilityMessage = document.getElementById("ccw-availability-message");
  const customerDetails = document.getElementById("ccw-customer-details");
  const message = document.getElementById("ccw-booking-message");
  const submit = document.getElementById("ccw-submit-booking");
  let availabilityRequestId = 0;
  submit.disabled = true;
  const success = document.getElementById("ccw-booking-success");
  const validVehicleTypes = new Set(["sedan", "suv", "4x4", "busito", "pickup"]);
  const vehicleTypeSelect = document.getElementById("ccw-car-type");
  const categorySelect = document.getElementById("ccw-service-category");
  const serviceSelect = document.getElementById("ccw-service-option");
  const vehicleTypeWrap = document.getElementById("ccw-car-type-wrap");
  const plateWrap = document.getElementById("ccw-car-plate-wrap");
  const plateInput = document.getElementById("ccw-car-plate");
  const serviceHelp = document.getElementById("ccw-service-help");
  let reservableTariffs = [];
  let catalogServices = [];
  let allTariffs = [];
  let selectedService = null;
  let selectedCategory = "";

  // Usa fecha local de Panamá para evitar ofrecer fechas pasadas.
  const panamaToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  dateInput.min = panamaToday;

  function categoriaDeServicio(service) {
    const text = `${service.name || ""} ${service.description || service.descripcion || ""} ${service.category || ""}`
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/colchon/.test(text)) return "colchones";
    if (/mueble|sillon|sofa|tapizad/.test(text)) return "muebles";
    if (/motor/.test(text)) return "motor";
    if (/lluvia acida|lluvia/.test(text)) return "lluvia";
    const serviceName = String(service.name || "")
      .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
    if (/interior/.test(serviceName)) return "interior";
    if (/auto|vehiculo|car wash|lavado de autos|limpieza de autos/.test(text)) return "autos";
    // El campo category de Supabase puede clasificar servicios de autos con nombres propios.
    const cat = String(service.category || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

if (/auto|vehiculo|car/.test(cat)) return "autos";
if (cat === "vehiculos") return "autos";
    return "";
  }

  function esCategoriaDeVehiculo(category) {
    return ["autos", "motor", "interior", "lluvia"].includes(category);
  }

  function actualizarPrecio() {
    const selected = tariffSelect.value === "" ? null : allTariffs[Number(tariffSelect.value)];
    priceLabel.textContent = selected
      ? `Precio del catálogo: ${formatoPrecio(Number(selected.price))} · ${selected.serviceName}${selected.variant && selected.variant !== "estandar" ? ` · ${selected.variant}` : ""}`
      : "";
  }

  function limpiarSelect(select, placeholder) {
    select.innerHTML = "";
    select.add(new Option(placeholder, ""));
  }

  function actualizarVisibilidadVehiculo() {
    const vehicleCategory = esCategoriaDeVehiculo(categorySelect.value);
    vehicleTypeWrap.hidden = !vehicleCategory;
    plateWrap.hidden = !vehicleCategory;
    vehicleTypeSelect.required = vehicleCategory;
    plateInput.required = vehicleCategory;
    if (!vehicleCategory) {
      vehicleTypeSelect.value = "";
      plateInput.value = "";
    }
  }

  function actualizarServiciosPorCategoria() {
    availabilityRequestId++;
    selectedCategory = categorySelect.value;
    selectedService = null;
    limpiarSelect(serviceSelect, selectedCategory ? "Selecciona un servicio" : "Selecciona primero la categoría");
    limpiarSelect(tariffSelect, "Selecciona un servicio primero");
    serviceSelect.disabled = !selectedCategory;
    tariffSelect.disabled = true;
    priceLabel.textContent = "";
    actualizarVisibilidadVehiculo();
    timeSelect.innerHTML = "";
    timeSelect.add(new Option("Selecciona servicio y fecha", ""));
    timeSelect.disabled = true;
    mostrarDatosCliente(false);
    if (availabilityMessage) availabilityMessage.textContent = "Selecciona una tarifa y una fecha para consultar los cupos reales.";

    if (!selectedCategory) {
      serviceHelp.textContent = "Elige una categoría para ver sus opciones.";
      return;
    }

    const vehicleCategory = esCategoriaDeVehiculo(selectedCategory);
    if (vehicleCategory && !vehicleTypeSelect.value) {
      serviceHelp.textContent = "Selecciona el tipo de vehículo para mostrar las tarifas compatibles.";
    } else {
      serviceHelp.textContent = "";
    }

    // Catálogo público aprobado: no mostrar combos, POLISH ni servicios sin tarifas confirmadas.
    // No se borran registros históricos; el bloqueo se aplica en la web y en el catálogo de la función.
    let matchingServices = catalogServices.filter(s => {
      if (categoriaDeServicio(s) !== selectedCategory) return false;
      const text = `${s.name || ""} ${s.description || s.descripcion || ""}`
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (/combo\s*#?\s*\d+|polish|pulimento|encerado/.test(text)) return false;
      const tariffs = Array.isArray(s.tarifas) ? s.tarifas : [];
return tariffs.some(t => {
  const status = String(
    t.estado_precio || t.price_status || ""
  ).toLowerCase();

  const confirmed =
    status === "confirmado" || status === "confirmed";

  const hasValidPrice =
    t.precio !== null &&
    t.precio !== undefined &&
    Number.isFinite(Number(t.precio)) &&
    Number(t.precio) >= 0;

  return hasValidPrice && (t.reservable === true || confirmed);
});
    });
console.log("SERVICIOS MOSTRADOS:", selectedCategory, matchingServices.map(s => s.name));
    matchingServices.forEach(service => {
      const description = String(service.description || service.descripcion || "").trim();
      const label = service.name;
      serviceSelect.add(new Option(label, service.id));
    });

    if (!matchingServices.length) {
      serviceSelect.add(new Option("Opciones pendientes de configurar", ""));
      serviceSelect.disabled = true;
      serviceHelp.textContent = "Esta categoría aparece en las instrucciones de Excel, pero todavía no se encuentra vinculada a un servicio activo del catálogo de Supabase. No hemos inventado precios.";
    }
  }

  function actualizarTarifasServicio() {
    availabilityRequestId++;
    selectedService = catalogServices.find(s => String(s.id) === serviceSelect.value) || null;
    limpiarSelect(tariffSelect, selectedService ? "Selecciona tamaño o tarifa" : "Selecciona un servicio primero");
    tariffSelect.disabled = !selectedService;
    priceLabel.textContent = "";
    timeSelect.innerHTML = "";
    timeSelect.add(new Option("Selecciona una tarifa y fecha", ""));
    timeSelect.disabled = true;
    mostrarDatosCliente(false);
    if (availabilityMessage) availabilityMessage.textContent = "Selecciona una tarifa y una fecha para consultar los cupos reales.";
    if (!selectedService) return;

    const vehicleCategory = esCategoriaDeVehiculo(selectedCategory);
    const vehicleType = vehicleTypeSelect.value;
    const excelExpectedPrice = (category, vehicle) => {
      const vehicleKey = String(vehicle || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const prices = {
        motor: { sedan: 15, suv: 18, "4x4": 20, pick_up: 20, pickup: 20 },
        interior: { sedan: 60, suv: 70, "4x4": 90, pick_up: 80, pickup: 80 },
        lluvia: { sedan: 15, suv: 15, "4x4": 15, pick_up: 15, pickup: 15, busito: 15, camioneta: 15 }
      };
      return prices[category]?.[vehicleKey];
    };
    const rawTariffs = (selectedService.tarifas || []).filter(t => {
      const valid = t.reservable === true && t.precio !== null &&
        Number.isFinite(Number(t.precio)) && Number(t.precio) >= 0;
      if (!valid) return false;
      // No mostrar una tarifa de Supabase que contradiga el Excel.
      if (["motor", "interior", "lluvia"].includes(selectedCategory)) {
        const expected = excelExpectedPrice(selectedCategory, t.tipo_vehiculo || vehicleTypeSelect.value);
        return expected !== undefined && Number(t.precio) === expected;
      }
      return true;
    });
    allTariffs = [];

    const matching = rawTariffs.filter(t => {
      if (vehicleCategory) {
        const catalogVehicleType = String(t.tipo_vehiculo || "").toLowerCase();
        const canonicalCatalogType = catalogVehicleType === "pick_up" ? "pickup" : catalogVehicleType;
        return vehicleType && canonicalCatalogType === vehicleType;
      }
      return !validVehicleTypes.has(t.tipo_vehiculo);
    });

    matching.forEach(t => {
      const index = allTariffs.push({
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        variant: t.variante || "estandar",
        vehicleType: (String(t.tipo_vehiculo || "").toLowerCase() === "pick_up" ? "pickup" : String(t.tipo_vehiculo || "").toLowerCase()),
        price: Number(t.precio),
        isVehicle: vehicleCategory
      }) - 1;
      const vehicleLabel = vehicleCategory ? ` · ${vehicleType.toUpperCase()}` : "";
      const variantLabel = t.variante && t.variante !== "estandar" ? `${t.variante}` : selectedService.name;
      tariffSelect.add(new Option(`${variantLabel}${vehicleLabel} · ${formatoPrecio(Number(t.precio))}`, String(index)));
    });

    if (!matching.length) {
      serviceHelp.textContent = ["motor", "interior", "lluvia"].includes(selectedCategory)
        ? "La tarifa de Supabase todavía no coincide con el Excel o no está confirmada. No mostraremos un precio incorrecto; debe ajustarse el catálogo antes de reservar."
        : vehicleCategory
          ? "No hay tarifa confirmada para este servicio y tipo de vehículo. Consulta a la Administradora."
          : "No hay tarifa reservable confirmada para esta opción en Supabase. Consulta a la Administradora.";
      tariffSelect.add(new Option("Consultar a la Administradora", ""));
      tariffSelect.disabled = true;
      return;
    }

    if (!vehicleCategory) {
      serviceHelp.textContent = "Esta opción no requiere placa ni datos de vehículo. Importante: el sistema de reservas todavía necesita una adaptación en Supabase para confirmar estos servicios; puedes revisar la tarifa, pero no enviar la reserva en línea todavía.";
      return;
    }
    serviceHelp.textContent = "Selecciona la tarifa confirmada para continuar.";
  }

  function mostrarDatosCliente(visible) {
    customerDetails.hidden = !visible;
    customerDetails.style.display = visible ? "grid" : "none";
    customerDetails.disabled = !visible;
    submit.disabled = !visible;
  }

  async function actualizarHoras() {
    const requestId = ++availabilityRequestId;
    const date = dateInput.value;
    const selectedTariff = tariffSelect.value === "" ? null : allTariffs[Number(tariffSelect.value)];
    timeSelect.innerHTML = "";
    timeSelect.add(new Option("Consultando disponibilidad…", ""));
    timeSelect.disabled = true;
    mostrarDatosCliente(false);
    if (!date || !selectedTariff) {
      timeSelect.innerHTML = "";
      timeSelect.add(new Option("Selecciona servicio y fecha", ""));
      if (availabilityMessage) availabilityMessage.textContent = "Selecciona una tarifa y una fecha para consultar los cupos reales.";
      return;
    }
    if (!selectedTariff.isVehicle) {
      timeSelect.innerHTML = "";
      timeSelect.add(new Option("Servicio no reservable en línea", ""));
      if (availabilityMessage) availabilityMessage.textContent = "Este servicio todavía requiere confirmación de la Administradora y no tiene reserva en línea.";
      return;
    }
    if (date < panamaToday) {
      timeSelect.innerHTML = "";
      timeSelect.add(new Option("Selecciona una fecha válida", ""));
      if (availabilityMessage) availabilityMessage.textContent = "No puedes reservar una fecha pasada.";
      return;
    }
    if (availabilityMessage) availabilityMessage.textContent = "Consultando jornada publicada, lavadores disponibles y reservas existentes…";
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gestionar-reservas`, {
        method: "POST",
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disponibilidad",
          appointment_date: date,
          service_id: selectedTariff.serviceId,
          vehicle_type: selectedTariff.vehicleType
        })
      });
      const data = await response.json().catch(() => ({}));
      if (requestId !== availabilityRequestId) return;
      if (!response.ok || data.ok !== true) throw new Error(data.error || "No se pudo consultar la disponibilidad real.");
      timeSelect.innerHTML = "";
      timeSelect.add(new Option("Selecciona un horario disponible", ""));
      const slots = Array.isArray(data.slots) ? data.slots : [];
      slots.forEach(slot => {
        const label = slot.capacity > 1 ? `${slot.time} · ${slot.capacity} cupos` : `${slot.time} · ${slot.capacity} cupo`;
        timeSelect.add(new Option(label, slot.time));
      });
      timeSelect.disabled = slots.length === 0;
      if (availabilityMessage) {
        availabilityMessage.textContent = slots.length
          ? `Disponibilidad consultada para ${date}. Se muestran solo horas con capacidad real para este servicio (${data.duration_minutes || 90} minutos). La reserva se vuelve a validar al enviarla.`
          : (data.message || "No hay cupos disponibles para este servicio en esa fecha. Prueba otra fecha.");
      }
    } catch (error) {
      if (requestId !== availabilityRequestId) return;
      timeSelect.innerHTML = "";
      timeSelect.add(new Option("Disponibilidad no disponible", ""));
      timeSelect.disabled = true;
      if (availabilityMessage) availabilityMessage.textContent = error.message || "No se pudo consultar la disponibilidad.";
    }
  }

  timeSelect.addEventListener("change", () => {
    const validSelection = Boolean(timeSelect.value) && !timeSelect.disabled;
    mostrarDatosCliente(validSelection);
    if (availabilityMessage && validSelection) availabilityMessage.textContent += " Completa tus datos para continuar.";
  });
  dateInput.addEventListener("change", actualizarHoras);
  tariffSelect.addEventListener("change", () => { actualizarPrecio(); actualizarHoras(); });
  categorySelect.addEventListener("change", actualizarServiciosPorCategoria);
  serviceSelect.addEventListener("change", actualizarTarifasServicio);
  vehicleTypeSelect.addEventListener("change", () => {
    if (selectedCategory && esCategoriaDeVehiculo(selectedCategory)) {
      actualizarServiciosPorCategoria();
    }
  });

  try {
    message.textContent = "Cargando servicios y tarifas…";
    catalogServices = await cargarCatalogoPublico();
    // Guardamos las tarifas confirmadas en un índice estable para las opciones desplegables.
    allTariffs = [];
    message.textContent = catalogServices.length
      ? "Selecciona la categoría y después el servicio y la tarifa."
      : "No hay servicios activos disponibles. Consulta a la Administradora.";
    actualizarVisibilidadVehiculo();
    actualizarHoras();
  } catch (error) {
    message.textContent = error.message || "No se pudo cargar el catálogo.";
    submit.disabled = true;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    success.hidden = true;
    message.textContent = "Enviando solicitud y comprobando disponibilidad…";
    submit.disabled = true;
    try {
      const tariff = tariffSelect.value === "" ? null : allTariffs[Number(tariffSelect.value)];
      if (!tariff) throw new Error("Selecciona un servicio y una tarifa confirmada.");  
const customerEmail = document.getElementById("ccw-customer-email").value.trim();      
const paymentMethod = document
  .getElementById("ccw-payment-method")
  .value
  .trim()
  .toLowerCase();
if (!["yappy", "ach", "efectivo"].includes(paymentMethod)) {
  throw new Error("Selecciona un método de pago válido.");
}
if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
  throw new Error("Introduce un correo electrónico válido.");
}
      if (!tariff.isVehicle) throw new Error("Este servicio no se puede reservar en línea todavía. Consulta a la Administradora para confirmar la cita.");
      if (!vehicleTypeSelect.value) throw new Error("Selecciona el tipo de vehículo.");
      if (!plateInput.value.trim()) throw new Error("La placa es obligatoria.");
      if (!dateInput.value || !timeSelect.value) throw new Error("Selecciona fecha y hora.");

      const booking = {
        customer_name: document.getElementById("ccw-customer-name").value.trim(),
        customer_phone: document.getElementById("ccw-customer-phone").value.trim(),
        customer_email: customerEmail,
        payment_method: paymentMethod,
        customer_address: document.getElementById("ccw-customer-address").value.trim(),
        appointment_date: dateInput.value,
        requested_start_time: timeSelect.value,
        customer_notes: document.getElementById("ccw-booking-notes").value.trim() || null,
        vehicles: [{
          service_id: tariff.serviceId,
          variant: tariff.variant,
          vehicle_type: tariff.vehicleType,
          // Se conservan las claves antiguas como null por compatibilidad con el backend.
          make: null,
          model: null,
          color: null,
          license_plate: plateInput.value.trim(),
          customer_notes: null
        }]
      };

      const response = await fetch(`${SUPABASE_URL}/functions/v1/gestionar-reservas`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "crear_reserva", reserva: booking })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) {
        throw new Error(data.error || "No se pudo confirmar la cita. Prueba otra hora o fecha.");
      }

      // Nunca mostrar ni guardar lookup_secret en la página.
      form.hidden = true;
      success.hidden = false;
      success.innerHTML = `
        <h3 style="margin-top:0">¡Solicitud confirmada!</h3>
        <p>Tu código de reserva es:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:1px">${escaparHTML(data.booking_code || "")}</p>
        <p>Fecha: ${escaparHTML(data.appointment_date || booking.appointment_date)}</p>
        <p>Hora solicitada: ${escaparHTML(booking.requested_start_time)}</p>
        <p>Servicio: ${escaparHTML(tariff.serviceName)}</p>
        <p>Precio confirmado: ${escaparHTML(formatoPrecio(tariff.price))}</p>
        <p>Guarda tu código para futuras consultas.</p>`;
      message.textContent = "";
    } catch (error) {
      message.textContent = error.message || "Ocurrió un error al solicitar la cita.";
    } finally {
      submit.disabled = false;
    }
  });
}

function mostrarLoginAdmin() {
  estiloBase();
  document.body.innerHTML = `
    ${cabecera("Acceso administrativo")}
    <main style="max-width:420px;margin:35px auto;padding:22px">
      <form id="ccw-login" style="display:grid;gap:14px">
        <label for="ccw-email">Correo de administración</label>
        <input id="ccw-email" type="email" autocomplete="username" required style="padding:12px">
        <label for="ccw-password">Contraseña</label>
        <input id="ccw-password" type="password" autocomplete="current-password" required style="padding:12px">
        <button type="submit" style="padding:13px;background:#18764e;color:white;border:0;border-radius:8px">Iniciar sesión</button>
        <p id="ccw-message" role="status"></p>
        <button id="ccw-back" type="button">Volver al inicio</button>
      </form>
    </main>`;

  document.getElementById("ccw-back").onclick = () => mostrarInicio();
  document.getElementById("ccw-login").onsubmit = async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const message = document.getElementById("ccw-message");
    button.disabled = true;
    message.textContent = "Verificando acceso…";
    try {
      const result = await iniciarSesion(
        document.getElementById("ccw-email").value.trim(),
        document.getElementById("ccw-password").value
      );
      mostrarPanelAdmin(result.perfil);
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}

async function cargarReservasAdmin() {
  const token = sessionStorage.getItem("ccw_access_token");
  if (!token) throw new Error("La sesión administrativa venció. Inicia sesión nuevamente.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gestionar-reservas`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "listar_reservas" })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) throw new Error(data.error || "No se pudieron cargar las reservas.");
  return Array.isArray(data.reservas) ? data.reservas : [];
}

let ccwReservasCache = [];
let ccwReservasPagina = 1;

function renderReservasAdmin(reservas) {
  const container = document.getElementById("ccw-reservas-lista");
  if (!container) return;
  if (!reservas.length) {
    container.innerHTML = '<p class="notice">No hay reservas registradas.</p>';
    return;
  }
  const estadoVisible = r => {
    const statuses = (Array.isArray(r.vehicles) ? r.vehicles : [])
      .map(v => String(v.assignment_status || v.status || "").toLowerCase());
    if (statuses.length && statuses.every(s => ["terminada", "terminado", "completada", "completado"].includes(s))) return "terminada";
    if (statuses.some(s => ["en_proceso", "en proceso"].includes(s))) return "en proceso";
    return r.status || "sin estado";
  };
  const metodoPagoVisible = value => ({
    yappy: "Yappy",
    ach: "ACH",
    efectivo: "Efectivo"
  })[String(value || "").trim().toLowerCase()] || "No registrado";
  const estadoPagoVisible = value => ({
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    pagado: "Pagado",
    rechazado: "Rechazado",
    cancelado: "Cancelado",
    reembolsado: "Reembolsado"
  })[String(value || "").trim().toLowerCase()] || (value ? String(value) : "No registrado");
  container.innerHTML = reservas.map(r => {
    const address = r.customer_address || r.house_number || r.address || "No registrado";
    const vehicles = Array.isArray(r.vehicles) ? r.vehicles : [];
    const status = estadoVisible(r);
    const done = status.toLowerCase() === "terminada";
    const paymentMethod = metodoPagoVisible(r.payment_method);
    const paymentStatus = estadoPagoVisible(r.payment_status);
    const paymentAmount = r.payment_amount ?? r.amount;
    return `
      <details style="background:#fff;border:1px solid #d8e2dc;border-radius:8px;padding:0 12px;margin:0 0 8px;overflow-wrap:anywhere;box-shadow:none;font-size:13px;line-height:1.35">
        <summary style="list-style:none;cursor:pointer;padding:10px 0;display:grid;gap:5px">
          <span style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <strong style="font-size:13px;color:#173b2c">${escaparHTML(r.booking_code || "Reserva")}</strong>
            <span style="background:${done ? "#e2f4e8" : "#edf5ef"};color:${done ? "#17633d" : "#24563d"};padding:3px 7px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap">${escaparHTML(status)}</span>
          </span>
          <span style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3px 12px">
            <span><strong>Casa:</strong> ${escaparHTML(address)}</span>
            <span><strong>Hora:</strong> ${escaparHTML(r.requested_start_time || "—")}</span>
            <span style="grid-column:1/-1"><strong>Cliente:</strong> ${escaparHTML(r.customer_name || "—")}</span>
            <span style="grid-column:1/-1"><strong>Teléfono:</strong> ${escaparHTML(r.customer_phone || "—")}</span>
          </span>
          <span style="font-size:11px;color:#28724f;font-weight:700;padding-top:2px">＋ Ver ficha completa</span>
        </summary>
        <div style="border-top:1px solid #e5ece7;padding:9px 0 11px;display:grid;gap:6px">
          <div><strong>Fecha de la reserva:</strong> ${escaparHTML(r.appointment_date || "—")}</div>
          <div><strong>Dirección completa:</strong> ${escaparHTML(address)}</div>
          <section style="border:1px solid #d8e2dc;background:#f7faf8;border-radius:8px;padding:10px;display:grid;gap:5px;margin:4px 0">
            <strong>Información de pago</strong>
            <div><strong>Método de pago:</strong> ${escaparHTML(paymentMethod)}</div>
            <div><strong>Estado del pago:</strong> ${escaparHTML(paymentStatus)}</div>
            ${paymentAmount != null ? `<div><strong>Importe registrado:</strong> ${escaparHTML(formatoPrecio(Number(paymentAmount)))}</div>` : ""}
            ${String(r.payment_status || "").toLowerCase() === "pendiente" && r.payment_id ? `<button type="button" data-confirm-payment="${escaparHTML(r.payment_id)}" data-payment-booking="${escaparHTML(r.booking_code || "")}" style="margin-top:5px;padding:10px;background:#18764e;color:white;border:0;border-radius:7px;font-weight:700;cursor:pointer">Confirmar recepción del pago</button><p data-payment-message="${escaparHTML(r.payment_id)}" role="status" style="margin:0;font-size:12px"></p>` : ""}
          </section>
          ${vehicles.length ? vehicles.map(v => {
            const assignmentStatus = String(v.assignment_status || "").toLowerCase();
            const serviceDone = ["terminada", "terminado", "completada", "completado"].includes(assignmentStatus);
            const beforeUrl = v.before_photo_url || "";
            const afterUrl = v.after_photo_url || "";
            const photos = `
              <div style="border-top:1px solid #edf1ee;padding-top:8px;margin-top:3px;display:grid;gap:8px">
                <strong>Fotografías del lavado</strong>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
                  <div style="border:1px solid #d8e2dc;border-radius:7px;padding:8px;display:grid;gap:5px">
                    <strong>Antes</strong>
                    ${beforeUrl ? `<a href="${escaparHTML(beforeUrl)}" target="_blank" rel="noopener"><img src="${escaparHTML(beforeUrl)}" alt="Foto antes del lavado" loading="lazy" style="width:100%;max-height:220px;object-fit:contain;border-radius:5px"></a>` : '<span style="color:#65756c">No hay foto guardada.</span>'}
                  </div>
                  <div style="border:1px solid #d8e2dc;border-radius:7px;padding:8px;display:grid;gap:5px">
                    <strong>Después</strong>
                    ${afterUrl ? `<a href="${escaparHTML(afterUrl)}" target="_blank" rel="noopener"><img src="${escaparHTML(afterUrl)}" alt="Foto después del lavado" loading="lazy" style="width:100%;max-height:220px;object-fit:contain;border-radius:5px"></a>` : '<span style="color:#65756c">No hay foto guardada.</span>'}
                  </div>
                </div>
              </div>`;
            return `
            <section style="border-top:1px solid #edf1ee;padding-top:7px;margin-top:2px;display:grid;gap:4px">
              <div><strong>Servicio:</strong> ${escaparHTML(v.service_name || "Servicio")}</div>
              <div><strong>Estado del lavado:</strong> ${escaparHTML(v.assignment_status || "Sin asignación")}</div>
              <div><strong>Horario asignado:</strong> ${escaparHTML(v.scheduled_start || "Pendiente")} – ${escaparHTML(v.scheduled_end || "Pendiente")}</div>
              ${v.actual_start ? `<div><strong>Inicio real:</strong> ${escaparHTML(v.actual_start)}</div>` : ""}
              ${v.actual_end ? `<div><strong>Finalizado:</strong> ${escaparHTML(v.actual_end)}</div>` : ""}
              <div><strong>Lavador asignado:</strong> ${escaparHTML(v.washer_name || "Sin asignar")}</div>
              ${serviceDone ? '<div style="color:#17633d;font-weight:700">✓ Lavado terminado</div>' : `
              <label style="display:grid;gap:5px;font-weight:700">Cambiar lavador
                <select data-assign-washer="${escaparHTML(v.vehicle_id || "")}" style="width:100%;box-sizing:border-box;padding:9px;border:1px solid #b9c9bf;border-radius:6px">
                  <option value="">Selecciona un lavador activo</option>
                  ${ccwWashersAdminCache.filter(w => w.status === "activo").map(w => `<option value="${escaparHTML(w.id)}" ${w.id === v.washer_id ? "selected" : ""}>${escaparHTML(w.full_name)}</option>`).join("")}
                </select>
              </label>
              <button type="button" data-save-assignment="${escaparHTML(v.vehicle_id || "")}" style="padding:9px;background:#18764e;color:white;border:0;border-radius:6px;font-weight:700">Guardar asignación</button>
              <p data-assignment-message="${escaparHTML(v.vehicle_id || "")}" role="status" style="margin:0;font-size:12px"></p>`}
              <div><strong>Vehículo:</strong> ${escaparHTML([v.vehicle_type, v.make, v.model, v.license_plate].filter(Boolean).join(" · ") || "—")}</div>
              <div><strong>Precio:</strong> ${v.price == null ? "Pendiente" : escaparHTML(formatoPrecio(Number(v.price)))}</div>
              ${photos}
            </section>`;
          }).join("") : '<div>Detalles de servicio no disponibles.</div>'}
          <div style="font-size:11px;color:#28724f;font-weight:700;padding-top:2px">− Cerrar ficha</div>
        </div>
      </details>`;
  }).join("");
  container.querySelectorAll("[data-confirm-payment]").forEach(button => {
    button.onclick = async () => {
      const paymentId = button.dataset.confirmPayment;
      const bookingCode = button.dataset.paymentBooking || "esta reserva";
      const msg = container.querySelector(`[data-payment-message="${paymentId}"]`);
      if (!paymentId) { if (msg) msg.textContent = "No se encontró el identificador del pago."; return; }
      if (!confirm(`¿Confirmas que recibiste el pago de ${bookingCode}? Verifica primero el ingreso en Yappy, ACH o efectivo.`)) return;
      button.disabled = true;
      if (msg) msg.textContent = "Confirmando pago en Supabase…";
      try {
        const token = sessionStorage.getItem("ccw_access_token");
        if (!token) throw new Error("La sesión administrativa venció. Inicia sesión nuevamente.");
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gestionar-reservas`, {
          method: "POST",
          headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirmar_pago", payment_id: paymentId })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok !== true) throw new Error(data.error || "No se pudo confirmar el pago.");
        if (msg) msg.textContent = "Pago confirmado y guardado en Supabase.";
        await actualizarReservasAdmin();
      } catch (error) {
        if (msg) msg.textContent = error.message || "No se pudo confirmar el pago.";
        button.disabled = false;
      }
    };
  });
  container.querySelectorAll("[data-save-assignment]").forEach(button => {
    button.onclick = async () => {
      const vehicleId = button.dataset.saveAssignment;
      const select = container.querySelector(`[data-assign-washer="${vehicleId}"]`);
      const msg = container.querySelector(`[data-assignment-message="${vehicleId}"]`);
      if (!vehicleId || !select?.value) { if (msg) msg.textContent = "Selecciona un lavador activo."; return; }
      button.disabled = true;
      if (msg) msg.textContent = "Validando disponibilidad y guardando…";
      try {
        const token = sessionStorage.getItem("ccw_access_token");
        if (!token) throw new Error("La sesión administrativa venció. Inicia sesión nuevamente.");
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gestionar-reservas`, {
          method: "POST",
          headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reasignar_lavador", vehicle_id: vehicleId, washer_id: select.value })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok !== true) throw new Error(data.error || "No se pudo guardar la asignación.");
        if (msg) msg.textContent = data.message || "Asignación guardada.";
        await actualizarReservasAdmin();
      } catch (error) {
        if (msg) msg.textContent = error.message || "No se pudo guardar la asignación.";
      } finally { button.disabled = false; }
    };
  });
}
function mostrarReservasAdmin(reservas) {
  ccwReservasCache = Array.isArray(reservas) ? reservas : [];
  const search = document.getElementById("ccw-reservas-search");
  const status = document.getElementById("ccw-reservas-filter");
  const pageSizeEl = document.getElementById("ccw-reservas-page-size");
  const query = String(search?.value || "").trim().toLowerCase();
  const selectedStatus = String(status?.value || "todos").toLowerCase();
  const pageSize = Math.max(1, Number(pageSizeEl?.value || 10));
  const filtered = ccwReservasCache.filter(r => {
    const vehicles = Array.isArray(r.vehicles) ? r.vehicles : [];
    const text = [r.booking_code, r.customer_name, r.customer_phone, r.customer_email, r.customer_address, r.house_number, ...vehicles.flatMap(v => [v.license_plate, v.service_name, v.washer_name])].filter(Boolean).join(" ").toLowerCase();
    const statuses = vehicles.map(v => String(v.assignment_status || v.status || "").toLowerCase());
    const done = statuses.length && statuses.every(x => ["terminada","terminado","completada","completado"].includes(x));
    const cancelled = /cancel/.test(String(r.status || "").toLowerCase()) || statuses.some(x => /cancel/.test(x));
    const matchesStatus = selectedStatus === "todos" || (selectedStatus === "completadas" && done) || (selectedStatus === "canceladas" && cancelled) || (selectedStatus === "pendientes" && !done && !cancelled);
    return text.includes(query) && matchesStatus;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  ccwReservasPagina = Math.min(ccwReservasPagina, pages);
  const start = (ccwReservasPagina - 1) * pageSize;
  renderReservasAdmin(filtered.slice(start, start + pageSize));
  const info = document.getElementById("ccw-reservas-pagination-info");
  if (info) info.textContent = filtered.length ? `Mostrando ${start + 1}–${Math.min(start + pageSize, filtered.length)} de ${filtered.length} reservas` : "No hay reservas que coincidan con la búsqueda.";
  const prev = document.getElementById("ccw-reservas-prev");
  const next = document.getElementById("ccw-reservas-next");
  const page = document.getElementById("ccw-reservas-page");
  if (prev) prev.disabled = ccwReservasPagina <= 1;
  if (next) next.disabled = ccwReservasPagina >= pages;
  if (page) page.textContent = `Página ${ccwReservasPagina} de ${pages}`;
}

async function actualizarReservasAdmin() {
  const message = document.getElementById("ccw-reservas-message");
  const button = document.getElementById("ccw-reservas-refresh");
  if (button) button.disabled = true;
  if (message) message.textContent = "Cargando reservas…";
  try {
    const reservas = await cargarReservasAdmin();
    mostrarReservasAdmin(reservas);
    if (message) message.textContent = `Reservas encontradas: ${reservas.length}.`;
  } catch (error) {
    if (message) message.textContent = error.message;
    const container = document.getElementById("ccw-reservas-lista");
    if (container) container.innerHTML = '<p class="notice">No se pudieron mostrar las reservas. Revisa el mensaje anterior.</p>';
  } finally {
    if (button) button.disabled = false;
  }
}

function base64UrlToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

async function cargarComisionesAdmin() {
  const token = sessionStorage.getItem("ccw_access_token");
  if (!token) throw new Error("La sesión administrativa venció. Inicia sesión nuevamente.");
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gestionar-reservas`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "listar_comisiones" })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) throw new Error(data.error || "No se pudieron consultar las comisiones.");
  return Array.isArray(data.commissions) ? data.commissions : [];
}

async function actualizarComisionesAdmin() {
  const msg = document.getElementById("ccw-commissions-message");
  const summary = document.getElementById("ccw-commissions-summary");
  const list = document.getElementById("ccw-commissions-list");
  const button = document.getElementById("ccw-commissions-refresh");
  if (button) button.disabled = true;
  if (msg) msg.textContent = "Consultando comisiones…";
  try {
    const rows = await cargarComisionesAdmin();
    const money = n => formatoPrecio(Number(n) || 0);
    const sum = status => rows.filter(c => c.status === status).reduce((s,c) => s + Number(c.commission_amount || 0), 0);
    if (summary) summary.innerHTML = `<div><strong>Pendiente del pago del cliente:</strong> ${money(sum("pendiente_pago_cliente"))}</div><div><strong>A pagar:</strong> ${money(sum("a_pagar"))}</div><div><strong>Pagado históricamente:</strong> ${money(sum("pagada"))}</div>`;
    if (list) list.innerHTML = rows.map(c => `<article style="border:1px solid #d8e2dc;border-radius:8px;padding:10px;display:grid;gap:5px"><strong>${escaparHTML(c.washer_name)} · ${money(c.commission_amount)}</strong><div>Servicio: ${escaparHTML(c.service_name)}</div><div>Base: ${money(c.service_price)} · Comisión: ${Number(c.commission_rate)}%</div><div>Estado: <strong>${({pendiente_revision:"Pendiente de revisión",pendiente_pago_cliente:"Pendiente del pago del cliente",a_pagar:"A pagar",pagada:"Pagada"})[c.status] || escaparHTML(c.status)}</strong></div>${c.paid_at ? `<div>Pagada: ${escaparHTML(new Date(c.paid_at).toLocaleString("es-PA",{timeZone:"America/Panama"}))}</div>` : ""}${c.status === "a_pagar" ? `<label>Nota del pago (opcional)<input data-commission-note="${escaparHTML(c.id)}" maxlength="1000" style="display:block;width:100%;box-sizing:border-box;padding:8px;margin-top:4px"></label><button type="button" data-pay-commission="${escaparHTML(c.id)}" style="padding:10px;background:#18764e;color:white;border:0;border-radius:7px;font-weight:bold">Registrar pago al lavador</button><p data-commission-msg="${escaparHTML(c.id)}" role="status" style="margin:0"></p>` : c.status === "pagada" && c.payment_notes ? `<div>Nota: ${escaparHTML(c.payment_notes)}</div>` : ""}</article>`).join("") || '<p>No hay comisiones registradas todavía.</p>';
    list?.querySelectorAll("[data-pay-commission]").forEach(btn => btn.onclick = async () => {
      const id = btn.dataset.payCommission;
      const output = list.querySelector(`[data-commission-msg="${id}"]`);
      const note = list.querySelector(`[data-commission-note="${id}"]`)?.value || "";
      if (!confirm("¿Confirmas que ya pagaste esta comisión al lavador? Esta acción quedará registrada en el historial.")) return;
      btn.disabled = true;
      try {
        const token = sessionStorage.getItem("ccw_access_token");
        const response = await fetch(`${SUPABASE_URL}/functions/v1/gestionar-reservas`, { method:"POST", headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`,"Content-Type":"application/json"}, body:JSON.stringify({action:"pagar_comision",commission_id:id,payment_notes:note}) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok !== true) throw new Error(data.error || "No se pudo registrar el pago.");
        if (output) output.textContent = "Pago registrado.";
        await actualizarComisionesAdmin();
      } catch (e) { if (output) output.textContent = e.message || "Error al registrar el pago."; btn.disabled = false; }
    });
    if (msg) msg.textContent = `Comisiones consultadas: ${rows.length}.`;
  } catch (e) { if (msg) msg.textContent = e.message || "No se pudieron consultar las comisiones."; }
  finally { if (button) button.disabled = false; }
}

async function activarNotificacionesAdmin() {
  const output = document.getElementById("ccw-push-message");
  const button = document.getElementById("ccw-push-enable");
  button.disabled = true;
  output.textContent = "Activando notificaciones…";
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Este navegador no admite notificaciones push. En iPhone, abre la app desde su icono de la pantalla de inicio.");
    }
    if (!window.isSecureContext) throw new Error("Abre el sitio mediante HTTPS.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("No se concedió permiso para notificaciones.");
    const registration = await navigator.serviceWorker.register("./sw.js");
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const token = sessionStorage.getItem("ccw_access_token");
    if (!token) throw new Error("La sesión caducó. Cierra sesión y vuelve a entrar.");
    const response = await fetch(`${SUPABASE_URL}/functions/v1/notificaciones`, {
      method: "POST",
      headers: { ...headers, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "registrar_dispositivo", subscription: subscription.toJSON() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo registrar este iPhone en Supabase.");
    output.textContent = "Notificaciones activadas en este dispositivo.";
  } catch (error) {
    output.textContent = error.message || "No se pudieron activar las notificaciones.";
  } finally {
    button.disabled = false;
  }
}

async function cargarLavadoresAdmin() {
  const msg = document.getElementById("ccw-washers-message");
  const list = document.getElementById("ccw-washers-list");
  try {
    const result = await llamarAdminLavador({ action: "list_washers" });
    const washers = result.washers || [];
    ccwWashersAdminCache = washers;
    list.innerHTML = washers.map(w => `<div style="border:1px solid #d8e4dc;border-radius:8px;padding:10px;display:grid;gap:6px"><strong>${escaparHTML(w.full_name)}</strong><span>Estado: ${escaparHTML(w.status)} · Ingreso: ${escaparHTML(w.hired_at || "—")}</span>${w.deactivated_at ? `<span>Desactivado: ${escaparHTML(w.deactivated_at)}</span>` : `<button type="button" data-deactivate-washer="${escaparHTML(w.id)}" style="padding:8px">Desactivar conservando historial</button>`}</div>`).join("") || "No hay lavadores registrados.";
    list.querySelectorAll("[data-deactivate-washer]").forEach(btn => btn.onclick = async () => { if (!confirm("¿Desactivar este lavador? Su historial se conservará.")) return; try { await llamarAdminLavador({ action: "deactivate_washer", washer_id: btn.dataset.deactivateWasher }); msg.textContent = "Lavador desactivado."; await cargarLavadoresAdmin(); } catch(e) { msg.textContent = e.message; } });
    const active = washers.filter(w => w.status === "activo");
    const selector = document.getElementById("ccw-washer");
    const previous = selector.value;
    selector.innerHTML = active.map(w => `<option value="${escaparHTML(w.id)}">${escaparHTML(w.full_name)}</option>`).join("");
    if (active.some(w => w.id === previous)) selector.value = previous;
    const planList = document.getElementById("ccw-plan-washer-list");
    // Renderiza el formulario; luego carga el estado real guardado para la fecha elegida.
    planList.innerHTML = active.map(w => `<div style="border:1px solid #d8e4dc;border-radius:8px;padding:10px;display:grid;gap:8px"><label><input type="checkbox" data-plan-washer="${escaparHTML(w.id)}" checked> ${escaparHTML(w.full_name)} disponible</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Desde<input type="time" data-plan-start="${escaparHTML(w.id)}" value="07:00" style="display:block;width:100%;box-sizing:border-box;padding:8px"></label><label>Hasta<input type="time" data-plan-end="${escaparHTML(w.id)}" value="18:00" style="display:block;width:100%;box-sizing:border-box;padding:8px"></label></div></div>`).join("") || "Registra primero un lavador.";
    msg.textContent = `${washers.length} lavador(es) registrados.`;
    await cargarDisponibilidadJornadaAdmin();
    if (document.getElementById("ccw-reservas-lista")) await actualizarReservasAdmin();
  } catch(e) { msg.textContent = e.message; }
}

async function cargarDisponibilidadJornadaAdmin() {
  const msg = document.getElementById("ccw-plan-message");
  const dateInput = document.getElementById("ccw-plan-date");
  const planList = document.getElementById("ccw-plan-washer-list");
  const openingInput = document.getElementById("ccw-plan-open");
  const closingInput = document.getElementById("ccw-plan-close");
  const notesInput = document.getElementById("ccw-plan-notes");
  const planDate = dateInput?.value;
  if (!planDate || !planList) return;

  try {
    const result = await llamarAdminLavador({ action: "get_plan_availability", plan_date: planDate });

    if (!result || result.success !== true) {
      throw new Error(result?.error || "El servidor no confirmó la consulta de disponibilidad.");
    }

    if (!result.plan) {
      // Fecha nueva: no reutilizar el horario ni las notas de otra jornada.
      if (openingInput) openingInput.value = "07:00";
      if (closingInput) closingInput.value = "18:00";
      if (notesInput) notesInput.value = "";
      for (const box of planList.querySelectorAll("[data-plan-washer]")) {
        box.checked = true;
        const washerId = box.dataset.planWasher;
        const start = planList.querySelector(`[data-plan-start="${washerId}"]`);
        const end = planList.querySelector(`[data-plan-end="${washerId}"]`);
        if (start) start.value = "07:00";
        if (end) end.value = "18:00";
      }
      if (msg) msg.textContent = "Fecha sin jornada guardada. Se muestran los valores iniciales; confirma la disponibilidad antes de publicar.";
      return;
    }

    // Recupera también el horario general y las notas de la jornada existente.
    if (openingInput && result.plan.opening_time) {
      openingInput.value = String(result.plan.opening_time).slice(0, 5);
    }
    if (closingInput && result.plan.closing_time) {
      closingInput.value = String(result.plan.closing_time).slice(0, 5);
    }
    if (notesInput) notesInput.value = result.plan.notes || "";

    const saved = new Map((Array.isArray(result.availability) ? result.availability : [])
      .map(row => [row.washer_id, row]));

    for (const box of planList.querySelectorAll("[data-plan-washer]")) {
      const washerId = box.dataset.planWasher;
      const row = saved.get(washerId);
      const start = planList.querySelector(`[data-plan-start="${washerId}"]`);
      const end = planList.querySelector(`[data-plan-end="${washerId}"]`);

      if (!row) {
        box.checked = false;
        // Mantiene horas válidas para que la API pueda validar también a los no disponibles.
        if (start && !start.value) start.value = "07:00";
        if (end && !end.value) end.value = "18:00";
        continue;
      }

      box.checked = row.available === true;
      if (start && row.start_time) start.value = String(row.start_time).slice(0, 5);
      if (end && row.end_time) end.value = String(row.end_time).slice(0, 5);
    }
    if (msg) msg.textContent = `Jornada existente cargada para ${planDate}. Revisa los horarios y la disponibilidad antes de publicar.`;
  } catch (error) {
    if (msg) msg.textContent = `No se pudo cargar la disponibilidad guardada: ${error.message}. No publiques hasta verificarla.`;
    // Evita presentar como confirmados datos que no se pudieron recuperar.
    for (const box of planList.querySelectorAll("[data-plan-washer]")) box.checked = false;
  }
}

async function publicarJornadaAdmin() {
  const msg = document.getElementById("ccw-plan-message");
  const button = document.getElementById("ccw-publish-plan");
  const dateInput = document.getElementById("ccw-plan-date");
  const openingInput = document.getElementById("ccw-plan-open");
  const closingInput = document.getElementById("ccw-plan-close");
  const notesInput = document.getElementById("ccw-plan-notes");
  const planList = document.getElementById("ccw-plan-washer-list");

  if (!msg || !button || !dateInput || !openingInput || !closingInput || !notesInput || !planList) {
    console.error("No se pudo publicar la jornada: faltan elementos del formulario administrativo.");
    return;
  }

  button.disabled = true;
  msg.textContent = "Validando jornada y disponibilidad…";

  try {
    const planDate = dateInput.value;
    const openingTime = openingInput.value;
    const closingTime = closingInput.value;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate || "")) {
      throw new Error("Selecciona una fecha válida para la jornada.");
    }
    if (!openingTime || !closingTime || openingTime >= closingTime) {
      throw new Error("El horario general de apertura y cierre no es válido.");
    }

    const availability = [...planList.querySelectorAll("[data-plan-washer]")].map(box => {
      const washerId = box.dataset.planWasher;
      const startInput = planList.querySelector(`[data-plan-start="${washerId}"]`);
      const endInput = planList.querySelector(`[data-plan-end="${washerId}"]`);

      if (!washerId || !startInput || !endInput) {
        throw new Error("Falta el identificador o el horario de uno de los lavadores. Actualiza la lista e inténtalo de nuevo.");
      }
      if (!startInput.value || !endInput.value || startInput.value >= endInput.value) {
        throw new Error(`Revisa el horario individual del lavador ${washerId}.`);
      }

      return {
        washer_id: washerId,
        available: box.checked,
        start_time: startInput.value,
        end_time: endInput.value,
        absence_reason: box.checked ? null : "No disponible"
      };
    });

    if (!availability.length) {
      throw new Error("No hay lavadores en la lista. Registra o actualiza los lavadores antes de publicar.");
    }
    if (!availability.some(item => item.available)) {
      throw new Error("Selecciona al menos un lavador disponible.");
    }

    const result = await llamarAdminLavador({
      action: "publish_plan",
      plan_date: planDate,
      opening_time: openingTime,
      closing_time: closingTime,
      notes: notesInput.value,
      availability
    });

    // No mostrar éxito si el servidor no confirma que publicó la jornada.
    if (result?.success !== true || !result.plan?.published_at || !result.plan?.published_by) {
      throw new Error(result?.error || "El servidor no confirmó la publicación de la jornada.");
    }

    await cargarJornadasAdmin();
    msg.textContent = `Jornada del ${planDate} publicada correctamente.`;
  } catch (error) {
    msg.textContent = error.message || "No se pudo publicar la jornada.";
  } finally {
    button.disabled = false;
  }
}

async function cargarJornadasAdmin() {
  const list = document.getElementById("ccw-plans-list");
  const msg = document.getElementById("ccw-plan-message");
  if (!list) return;

  try {
    const result = await llamarAdminLavador({ action: "list_plans" });
    if (!result || result.success !== true) {
      throw new Error(result?.error || "El servidor no confirmó la consulta de jornadas.");
    }
    list.innerHTML = (result.plans || []).map(p => `<div style="border:1px solid #d8e4dc;border-radius:8px;padding:10px"><strong>${escaparHTML(p.plan_date)}</strong><div>${escaparHTML(String(p.opening_time).slice(0,5))}–${escaparHTML(String(p.closing_time).slice(0,5))}</div><div>${p.published_at ? "Publicada" : "Borrador"}</div>${p.notes ? `<small>${escaparHTML(p.notes)}</small>` : ""}</div>`).join("") || "No hay jornadas registradas.";
  } catch (error) {
    if (msg) msg.textContent = error.message || "No se pudieron consultar las jornadas.";
  }
}

function mostrarPanelAdmin(profile) {
  estiloBase();
  document.body.innerHTML = `
    ${cabecera("Panel administrativo")}
    <style>
      .ccw-admin-layout{max-width:1440px;margin:0 auto;padding:20px;display:grid;grid-template-columns:245px minmax(0,1fr);gap:20px;align-items:start}
      .ccw-admin-sidebar{position:sticky;top:12px;background:#10251d;color:white;border-radius:14px;padding:14px;display:grid;gap:7px}
      .ccw-admin-nav{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:12px;border:0;border-radius:8px;background:transparent;color:white;font-size:14px;font-weight:700;cursor:pointer}
      .ccw-admin-nav[aria-current="page"]{background:#18764e}
      .ccw-admin-content{min-width:0;display:grid;gap:14px}
      .ccw-admin-section{min-width:0}
      @media(max-width:760px){.ccw-admin-layout{grid-template-columns:1fr;padding:12px}.ccw-admin-sidebar{position:static}.ccw-admin-nav-wrap{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.ccw-admin-nav{font-size:12px;padding:10px 8px}.ccw-admin-content{gap:12px}}
      </style>
      <div class="ccw-admin-layout">
      <aside class="ccw-admin-sidebar"><strong style="padding:8px 10px;font-size:16px">MENÚ ADMINISTRATIVO</strong><nav class="ccw-admin-nav-wrap" style="display:grid;gap:5px">
      <button class="ccw-admin-nav" data-admin-section="reservas" aria-current="page">▦ Reservas de clientes</button>
      <button class="ccw-admin-nav" data-admin-section="comisiones">＄ Comisiones</button>
      <button class="ccw-admin-nav" data-admin-section="lavadores">♙ Registro de lavadores</button>
      <button class="ccw-admin-nav" data-admin-section="jornadas">◷ Jornada y disponibilidad</button>
      <button class="ccw-admin-nav" data-admin-section="pin">⚿ Generar PIN</button>
      <button class="ccw-admin-nav" data-admin-section="notificaciones">♧ Notificaciones</button>
      </nav><button id="ccw-logout" type="button" style="padding:11px;border:1px solid #739080;border-radius:8px;background:transparent;color:white;font-weight:bold;cursor:pointer">Cerrar sesión</button><button id="ccw-home" type="button" style="padding:11px;border:0;border-radius:8px;background:#e8f2ec;color:#183126;font-weight:bold;cursor:pointer">Volver al inicio</button></aside>
      <main class="ccw-admin-content">
      <header style="background:white;border:1px solid #d8e2dc;border-radius:12px;padding:16px"><h2 style="margin:0 0 6px">Bienvenida, ${escaparHTML(profile.full_name || "Administradora")}</h2><p style="margin:0">Sesión autenticada como administradora.</p></header>
      <section id="ccw-admin-notificaciones" class="ccw-admin-section" style="display:grid;gap:10px;background:#fff8e8;border-radius:12px;padding:16px">
        <h3 style="margin:0">Notificaciones en este iPhone</h3>
        <p style="margin:0">Activa las alertas de nuevas reservas en este dispositivo.</p>
        <button id="ccw-push-enable" type="button" style="padding:12px;background:#18764e;color:white;border:0;border-radius:8px;font-weight:bold">Activar notificaciones</button>
        <p id="ccw-push-message" role="status" style="margin:0"></p>
      </section>
      <section id="ccw-admin-comisiones" class="ccw-admin-section" style="display:grid;gap:10px;background:#fff;border:1px solid #d8e2dc;border-radius:12px;padding:16px">
        <h3 style="margin:0">Comisiones de lavadores · 40 %</h3>
        <p style="margin:0">Las comisiones se generan al terminar el servicio. Solo pasan a «A pagar» cuando el pago confirmado cubre el total de la reserva.</p>
        <button id="ccw-commissions-refresh" type="button" style="padding:12px;background:#18764e;color:white;border:0;border-radius:8px;font-weight:bold">Actualizar comisiones</button>
        <p id="ccw-commissions-message" role="status" style="margin:0"></p>
        <div id="ccw-commissions-summary" style="display:grid;gap:6px"></div>
        <div id="ccw-commissions-list" style="display:grid;gap:8px"></div>
      </section>
      <section id="ccw-admin-reservas" class="ccw-admin-section" style="display:grid;gap:12px;background:#edf5ef;border-radius:12px;padding:16px">
        <h3 style="margin:0">Reservas de clientes</h3>
        <p style="margin:0">Consulta los datos del cliente, el código, el servicio, el precio y el horario asignado.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">
          <input id="ccw-reservas-search" type="search" placeholder="Buscar código, cliente o placa" style="padding:11px;border:1px solid #b9c9bf;border-radius:8px;min-width:0">
          <select id="ccw-reservas-filter" style="padding:11px;border:1px solid #b9c9bf;border-radius:8px"><option value="todos">Todos los estados</option><option value="pendientes">Pendientes</option><option value="completadas">Completadas</option><option value="canceladas">Canceladas</option></select>
          <select id="ccw-reservas-page-size" style="padding:11px;border:1px solid #b9c9bf;border-radius:8px"><option value="10">10 por página</option><option value="20">20 por página</option><option value="50">50 por página</option></select>
        </div>
        <button id="ccw-reservas-refresh" type="button" style="padding:12px;background:#18764e;color:white;border:0;border-radius:8px;font-weight:bold">Actualizar reservas</button>
        <p id="ccw-reservas-message" role="status" style="margin:0">Pulsa Actualizar reservas para consultar las citas.</p>
        <div id="ccw-reservas-lista" style="display:grid;gap:10px"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><small id="ccw-reservas-pagination-info" role="status"></small><div style="display:flex;align-items:center;gap:8px"><button id="ccw-reservas-prev" type="button" style="padding:9px 12px" disabled>Anterior</button><strong id="ccw-reservas-page" style="font-size:12px">Página 1</strong><button id="ccw-reservas-next" type="button" style="padding:9px 12px">Siguiente</button></div></div>
      </section>
      <section id="ccw-admin-lavadores" class="ccw-admin-section" style="display:grid;gap:10px;background:#fff;border-radius:12px;padding:16px">
        <h3 style="margin:0">Registro de lavadores</h3>
        <label>Nombre completo<input id="ccw-new-washer-name" maxlength="120" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px"></label>
        <label>Fecha de ingreso<input id="ccw-new-washer-date" type="date" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px"></label>
        <label>Observaciones<textarea id="ccw-new-washer-notes" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px"></textarea></label>
        <button id="ccw-create-washer" type="button" style="padding:12px;background:#18764e;color:white;border:0;border-radius:8px;font-weight:bold">Registrar lavador</button>
        <button id="ccw-refresh-washers" type="button" style="padding:12px">Actualizar lista de lavadores</button>
        <p id="ccw-washers-message" role="status"></p><div id="ccw-washers-list" style="display:grid;gap:8px"></div>
      </section>
      <section id="ccw-admin-jornadas" class="ccw-admin-section" style="display:grid;gap:10px;background:#fff;border-radius:12px;padding:16px">
        <h3 style="margin:0">Jornadas y disponibilidad</h3>
        <label>Fecha de la jornada<input id="ccw-plan-date" type="date" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>Apertura<input id="ccw-plan-open" type="time" value="07:00" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px"></label><label>Cierre<input id="ccw-plan-close" type="time" value="18:00" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px"></label></div>
        <label>Notas<textarea id="ccw-plan-notes" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px"></textarea></label>
        <p>Marca los lavadores disponibles y establece su horario individual.</p><div id="ccw-plan-washer-list" style="display:grid;gap:10px"></div>
        <button id="ccw-publish-plan" type="button" style="padding:12px;background:#18764e;color:white;border:0;border-radius:8px;font-weight:bold">Publicar jornada</button>
        <p id="ccw-plan-message" role="status"></p><button id="ccw-refresh-plans" type="button" style="padding:12px">Consultar jornadas publicadas</button><div id="ccw-plans-list" style="display:grid;gap:8px"></div>
      </section>
      <section id="ccw-admin-pin" class="ccw-admin-section" style="display:grid;gap:10px;background:white;border:1px solid #d8e2dc;border-radius:12px;padding:16px"><h3 style="margin:0">Generar PIN</h3>
      <label for="ccw-washer">Seleccionar lavador</label>
      <select id="ccw-washer" style="padding:12px">
        <option value="">Cargando lavadores…</option>
      </select>
      <label for="ccw-pin-date">Fecha de la jornada para el PIN
        <input id="ccw-pin-date" type="date" required style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px">
      </label>
      ${boton("Generar PIN para esta fecha", "ccw-generate-pin")}
      <button id="ccw-revoke-pin" type="button" style="padding:12px;background:#a52828;color:white;border:0;border-radius:8px;font-weight:bold">Revocar PIN de esta fecha</button>
      <p id="ccw-pin-message" role="status"></p></section>
      </main></div>`;

  const adminSectionIds = { reservas: "ccw-admin-reservas", comisiones: "ccw-admin-comisiones", lavadores: "ccw-admin-lavadores", jornadas: "ccw-admin-jornadas", pin: "ccw-admin-pin", notificaciones: "ccw-admin-notificaciones" };
  function seleccionarSeccionAdmin(key) {
    Object.entries(adminSectionIds).forEach(([name, id]) => { const section = document.getElementById(id); if (section) section.style.display = name === key ? "grid" : "none"; });
    document.querySelectorAll("[data-admin-section]").forEach(btn => { if (btn.dataset.adminSection === key) btn.setAttribute("aria-current", "page"); else btn.removeAttribute("aria-current"); });
  }
  document.querySelectorAll("[data-admin-section]").forEach(btn => btn.addEventListener("click", () => seleccionarSeccionAdmin(btn.dataset.adminSection)));
  document.getElementById("ccw-reservas-search").addEventListener("input", () => { ccwReservasPagina = 1; mostrarReservasAdmin(ccwReservasCache); });
  document.getElementById("ccw-reservas-filter").addEventListener("change", () => { ccwReservasPagina = 1; mostrarReservasAdmin(ccwReservasCache); });
  document.getElementById("ccw-reservas-page-size").addEventListener("change", () => { ccwReservasPagina = 1; mostrarReservasAdmin(ccwReservasCache); });
  document.getElementById("ccw-reservas-prev").onclick = () => { ccwReservasPagina = Math.max(1, ccwReservasPagina - 1); mostrarReservasAdmin(ccwReservasCache); };
  document.getElementById("ccw-reservas-next").onclick = () => { ccwReservasPagina++; mostrarReservasAdmin(ccwReservasCache); };
  seleccionarSeccionAdmin("reservas");

  const partesFechaPanama = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Panama", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const partesHoy = Object.fromEntries(partesFechaPanama.map(parte => [parte.type, parte.value]));
  const fechaLocal = `${partesHoy.year}-${partesHoy.month}-${partesHoy.day}`;
  document.getElementById("ccw-new-washer-date").value = fechaLocal;
  document.getElementById("ccw-plan-date").value = fechaLocal;
  document.getElementById("ccw-pin-date").value = fechaLocal;
  document.getElementById("ccw-create-washer").onclick = async () => {
    const msg = document.getElementById("ccw-washers-message");
    const name = document.getElementById("ccw-new-washer-name").value.trim();
    if (!name) { msg.textContent = "Escribe el nombre del lavador."; return; }
    try { await llamarAdminLavador({ action: "create_washer", full_name: name, hired_at: document.getElementById("ccw-new-washer-date").value || fechaLocal, notes: document.getElementById("ccw-new-washer-notes").value }); document.getElementById("ccw-new-washer-name").value = ""; document.getElementById("ccw-new-washer-notes").value = ""; msg.textContent = "Lavador registrado."; await cargarLavadoresAdmin(); } catch(e) { msg.textContent = e.message; }
  };
  document.getElementById("ccw-refresh-washers").onclick = cargarLavadoresAdmin;
  document.getElementById("ccw-publish-plan").onclick = publicarJornadaAdmin;
  document.getElementById("ccw-refresh-plans").onclick = cargarJornadasAdmin;
  document.getElementById("ccw-plan-date").addEventListener("change", cargarDisponibilidadJornadaAdmin);
  cargarLavadoresAdmin(); cargarJornadasAdmin();

  document.getElementById("ccw-push-enable").onclick = activarNotificacionesAdmin;
  document.getElementById("ccw-reservas-refresh").onclick = actualizarReservasAdmin;
  document.getElementById("ccw-commissions-refresh").onclick = actualizarComisionesAdmin;
  actualizarComisionesAdmin();
  actualizarReservasAdmin();

  document.getElementById("ccw-generate-pin").onclick = async event => {
    const button = event.currentTarget;
    const message = document.getElementById("ccw-pin-message");
    button.disabled = true;
    message.textContent = "Solicitando PIN…";
    try {
      const planDate = document.getElementById("ccw-pin-date").value;
      if (!planDate) throw new Error("Selecciona la fecha para la que deseas generar el PIN.");
      const result = await generarPinLavador(document.getElementById("ccw-washer").value, planDate);
      message.textContent = result.pin
        ? `PIN generado para ${result.pin_date || planDate}: ${result.pin}. Entrégalo al lavador de forma privada.`
        : "La función no devolvió un PIN.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };

  document.getElementById("ccw-revoke-pin").onclick = async event => {
    const button = event.currentTarget;
    const washerId = document.getElementById("ccw-washer").value;
    const selector = document.getElementById("ccw-washer");
    const washerName = selector.options[selector.selectedIndex]?.text || "el lavador seleccionado";
    const message = document.getElementById("ccw-pin-message");
    if (!washerId) {
      message.textContent = "Selecciona un lavador activo.";
      return;
    }
    const planDate = document.getElementById("ccw-pin-date").value;
    if (!planDate) {
      message.textContent = "Selecciona la fecha del PIN que deseas revocar.";
      return;
    }
    if (!confirm(`¿Revocar el PIN de ${washerName} para la fecha ${planDate}? También se cerrarán sus sesiones de esa fecha.`)) return;
    button.disabled = true;
    message.textContent = "Revocando PIN…";
    try {
      const result = await llamarAdminLavador({ action: "revoke_pin", washer_id: washerId, plan_date: planDate });
      message.textContent = result.message || `PIN de ${planDate} revocado. Para permitir otro acceso, genera un PIN nuevo para esa fecha.`;
    } catch (error) {
      message.textContent = error.message || "No se pudo revocar el PIN.";
    } finally {
      button.disabled = false;
    }
  };

  document.getElementById("ccw-logout").onclick = () => {
    cerrarSesion();
    mostrarInicio();
  };
  document.getElementById("ccw-home").onclick = () => mostrarInicio();
}

function guardarSesionLavador(token, expiresAt, name) {
  sessionStorage.setItem("ccw_washer_session", token);
  sessionStorage.setItem("ccw_washer_expiry", expiresAt);
  sessionStorage.setItem("ccw_washer_name", name || "Lavador");
}

function borrarSesionLavador() {
  sessionStorage.removeItem("ccw_washer_session");
  sessionStorage.removeItem("ccw_washer_expiry");
  sessionStorage.removeItem("ccw_washer_name");
}

function mostrarLoginLavador(message = "") {
  estiloBase();
  borrarSesionLavador();
  document.body.innerHTML = `
    ${cabecera("Acceso del lavador")}
    <main style="max-width:420px;margin:35px auto;padding:22px">
      <form id="ccw-pin-form" style="display:grid;gap:14px">
        <p>Introduce únicamente el PIN diario que te entregó la administración.</p>
        <label for="ccw-pin">PIN de 4 dígitos</label>
        <input id="ccw-pin" type="password" inputmode="numeric" pattern="[0-9]{4}"
          maxlength="4" autocomplete="one-time-code" required
          style="padding:14px;font-size:24px;letter-spacing:8px;text-align:center">
        <button type="submit" style="padding:13px;background:#18764e;color:white;border:0;border-radius:8px">Entrar</button>
        <p id="ccw-washer-message" role="status">${escaparHTML(message)}</p>
        <button id="ccw-washer-back" type="button">Volver al inicio</button>
      </form>
    </main>`;

  document.getElementById("ccw-washer-back").onclick = () => mostrarInicio();
  document.getElementById("ccw-pin-form").onsubmit = async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const output = document.getElementById("ccw-washer-message");
    const pin = document.getElementById("ccw-pin").value.trim();
    if (!/^\d{4}$/.test(pin)) {
      output.textContent = "Introduce exactamente 4 dígitos.";
      return;
    }
    button.disabled = true;
    output.textContent = "Validando PIN…";
    try {
      const result = await llamarFuncion({ action: "validate_pin", pin });
      if (!result.session_token || !result.expires_at) {
        throw new Error("El servidor no devolvió una sesión válida.");
      }
      guardarSesionLavador(result.session_token, result.expires_at, result.washer_name);
      await cargarTrabajosLavador();
    } catch (error) {
      output.textContent = error.message || "No se pudo validar el PIN.";
    } finally {
      button.disabled = false;
    }
  };
}

function leerArchivoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la fotografía."));
    reader.readAsDataURL(file);
  });
}

async function comprimirFoto(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("No se pudo abrir la fotografía."));
  });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la fotografía.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressed = canvas.toDataURL("image/jpeg", 0.78);
  if (compressed.length > 2_000_000) throw new Error("La fotografía sigue siendo demasiado grande. Toma otra con menor resolución.");
  return compressed;
}

async function cargarTrabajosLavador() {
  const token = sessionStorage.getItem("ccw_washer_session");
  const expiry = sessionStorage.getItem("ccw_washer_expiry");
  const name = sessionStorage.getItem("ccw_washer_name") || "Lavador";

  if (!token || !expiry || Date.parse(expiry) <= Date.now()) {
    borrarSesionLavador();
    mostrarLoginLavador("La sesión venció. Introduce el PIN diario nuevamente.");
    return;
  }

  estiloBase();
  document.body.innerHTML = `
    ${cabecera("Mis trabajos")}
    <main style="max-width:620px;margin:32px auto;padding:20px;display:grid;gap:14px">
      <h2>Hola, ${escaparHTML(name)}</h2>
      <p id="ccw-jobs-message" role="status">Consultando tus trabajos…</p>
      <section id="ccw-jobs" style="display:grid;gap:12px"></section>
      <h3>Mis comisiones</h3>
<section id="ccw-commissions" style="display:grid;gap:12px">
  <p>Consultando tus comisiones…</p>
</section>
<button id="ccw-refresh-commissions" type="button" style="padding:12px">
  Actualizar comisiones
</button>
      <button id="ccw-refresh-jobs" type="button" style="padding:12px">Actualizar trabajos</button>
      <button id="ccw-washer-logout" type="button" style="padding:12px">Cerrar sesión</button>
    </main>`;

  document.getElementById("ccw-refresh-jobs").onclick = cargarTrabajosLavador;

  // Conectar el botón después de crear el panel del lavador.
  const botonComisiones = document.getElementById("ccw-refresh-commissions");
  if (botonComisiones) botonComisiones.onclick = cargarComisionesLavador;
  // Consultar las comisiones al abrir o actualizar el panel.
  cargarComisionesLavador();

  document.getElementById("ccw-washer-logout").onclick = () => {
    borrarSesionLavador();
    mostrarInicio();
  };

  try {
    
    const result = await llamarFuncion({ action: "my_jobs", session_token: token });
    const jobs = Array.isArray(result.jobs) ? result.jobs : [];
    const container = document.getElementById("ccw-jobs");
    document.getElementById("ccw-jobs-message").textContent =
      jobs.length ? `Tienes ${jobs.length} trabajo(s) pendiente(s).`
                  : "No tienes trabajos pendientes. Los servicios terminados se conservan en el historial administrativo.";

    container.innerHTML = jobs.map(job => {
      const beforeUrl = job.before_photo_url || "";
      const afterUrl = job.after_photo_url || "";
      const beforeDone = Boolean(job.before_photo_path);
      const afterDone = Boolean(job.after_photo_path);
      const canComplete = beforeDone && afterDone;
      const assignmentId = escaparHTML(job.id);
      return `
      <article data-job-id="${assignmentId}" style="background:white;border:1px solid #d7e1da;border-radius:12px;padding:16px;display:grid;gap:10px">
        <strong style="font-size:18px">${escaparHTML(job.service_name || "Servicio asignado")}</strong>
        <p style="margin:0">Estado: <strong>${escaparHTML(job.status || "asignado")}</strong></p>
        <p style="margin:0">Inicio programado: ${escaparHTML(job.scheduled_start || "Pendiente")}</p>
        <p style="margin:0">Fin programado: ${escaparHTML(job.scheduled_end || "Pendiente")}</p>
        <div style="background:#f4f7f5;border-radius:8px;padding:12px;display:grid;gap:6px">
          <strong>Datos del cliente y ubicación</strong>
          <p style="margin:0"><strong>Cliente:</strong> ${escaparHTML(job.customer_name || "No registrado")}</p>
          <p style="margin:0"><strong>Dirección:</strong> ${escaparHTML(job.customer_address || "No registrada; consulta con administración antes de salir")}</p>
          <p style="margin:0"><strong>Teléfono:</strong> ${escaparHTML(job.customer_phone || "No registrado")}</p>
          <p style="margin:0"><strong>Servicio:</strong> ${escaparHTML(job.service_name || "Servicio")}</p>
          <p style="margin:0"><strong>Vehículo:</strong> ${escaparHTML([job.vehicle_type, job.make, job.model, job.color].filter(Boolean).join(" · ") || "No especificado")}</p>
          <p style="margin:0"><strong>Placa:</strong> ${escaparHTML(job.license_plate || "No registrada")}</p>
          ${job.booking_code ? `<p style="margin:0"><strong>Código de reserva:</strong> ${escaparHTML(job.booking_code)}</p>` : ""}
          ${job.customer_notes ? `<p style="margin:0"><strong>Indicaciones:</strong> ${escaparHTML(job.customer_notes)}</p>` : ""}
          ${job.customer_address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.customer_address)}" target="_blank" rel="noopener" style="display:inline-block;padding:10px;background:#18764e;color:white;text-align:center;border-radius:7px;text-decoration:none;font-weight:bold">Abrir dirección en el mapa</a>` : ""}
        </div>
        <p style="font-size:12px;color:#52655a;margin:0">Referencia del servicio: ${escaparHTML(job.appointment_vehicle_id)}</p>
        <div style="border-top:1px solid #e2e9e4;padding-top:12px">
          <strong>Fotografías del servicio</strong>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-top:10px">
            <section style="border:1px solid #d7e1da;border-radius:9px;padding:10px;display:grid;gap:8px">
              <strong>Antes del lavado ${beforeDone ? "✓" : "(obligatoria)"}</strong>
              ${beforeUrl ? `<a href="${escaparHTML(beforeUrl)}" target="_blank" rel="noopener"><img src="${escaparHTML(beforeUrl)}" alt="Fotografía antes del lavado" style="width:100%;max-height:220px;object-fit:contain;border-radius:6px"></a>` : `<p style="margin:0;color:#64756c;font-size:13px">Todavía no hay fotografía.</p>`}
              <input type="file" id="ccw-before-${assignmentId}" accept="image/*" capture="environment" aria-label="Tomar fotografía antes del lavado" style="display:none">
              <button type="button" data-open-camera="before" data-job-id="${assignmentId}" style="padding:10px;border:1px solid #b9c9bf;border-radius:7px;background:white;color:#183126">📷 Tomar foto del antes</button>
              <span id="ccw-before-file-${assignmentId}" style="font-size:12px;color:#52655a">En teléfono, este botón abre la cámara; en computadora permite elegir una imagen.</span>
              <button type="button" data-photo-type="before" data-job-id="${assignmentId}" style="padding:10px;border:0;border-radius:7px;background:#e9f2ec;color:#183126">${beforeDone ? "Cambiar foto del antes" : "Guardar foto del antes"}</button>
            </section>
            <section style="border:1px solid #d7e1da;border-radius:9px;padding:10px;display:grid;gap:8px">
              <strong>Después del lavado ${afterDone ? "✓" : "(obligatoria)"}</strong>
              ${afterUrl ? `<a href="${escaparHTML(afterUrl)}" target="_blank" rel="noopener"><img src="${escaparHTML(afterUrl)}" alt="Fotografía después del lavado" style="width:100%;max-height:220px;object-fit:contain;border-radius:6px"></a>` : `<p style="margin:0;color:#64756c;font-size:13px">Todavía no hay fotografía.</p>`}
              <input type="file" id="ccw-after-${assignmentId}" accept="image/*" capture="environment" aria-label="Tomar fotografía después del lavado" style="display:none">
              <button type="button" data-open-camera="after" data-job-id="${assignmentId}" style="padding:10px;border:1px solid #b9c9bf;border-radius:7px;background:white;color:#183126">📷 Tomar foto del después</button>
              <span id="ccw-after-file-${assignmentId}" style="font-size:12px;color:#52655a">En teléfono, este botón abre la cámara; en computadora permite elegir una imagen.</span>
              <button type="button" data-photo-type="after" data-job-id="${assignmentId}" style="padding:10px;border:0;border-radius:7px;background:#e9f2ec;color:#183126">${afterDone ? "Cambiar foto del después" : "Guardar foto del después"}</button>
            </section>
          </div>
        </div>
        <button type="button" data-complete-job="${assignmentId}" ${canComplete ? "" : "disabled"} style="padding:13px;border:0;border-radius:8px;background:${canComplete ? "#18764e" : "#aebbb3"};color:white;font-weight:bold;cursor:${canComplete ? "pointer" : "not-allowed"}">${canComplete ? "Marcar trabajo como terminado" : "Guarda las dos fotografías para finalizar"}</button>
        <p id="ccw-job-message-${assignmentId}" role="status" style="margin:0;font-size:13px"></p>
      </article>`;
    }).join("");

    container.querySelectorAll("button[data-open-camera]").forEach(button => {
      button.addEventListener("click", () => {
        const jobId = button.dataset.jobId;
        const type = button.dataset.openCamera;
        const input = document.getElementById(`ccw-${type}-${jobId}`);
        if (input) input.click();
      });
    });
    container.querySelectorAll('input[type="file"][id^="ccw-before-"], input[type="file"][id^="ccw-after-"]').forEach(input => {
      input.addEventListener("change", () => {
        const match = input.id.match(/^ccw-(before|after)-(.+)$/);
        if (!match) return;
        const [, type, jobId] = match;
        const label = document.getElementById(`ccw-${type}-file-${jobId}`);
        if (label) label.textContent = input.files?.[0]?.name ? `Seleccionada: ${input.files[0].name}` : "No se seleccionó fotografía.";
      });
    });

    container.querySelectorAll("button[data-photo-type]").forEach(button => {
      button.addEventListener("click", async () => {
        const jobId = button.dataset.jobId;
        const type = button.dataset.photoType;
        const input = document.getElementById(`ccw-${type}-${jobId}`);
        const message = document.getElementById(`ccw-job-message-${jobId}`);
        const file = input?.files?.[0];
        if (!file) { message.textContent = `Selecciona o toma primero la fotografía de ${type === "before" ? "antes" : "después"}.`; return; }
        if (!file.type.startsWith("image/")) { message.textContent = "El archivo debe ser una fotografía."; return; }
        button.disabled = true;
        message.textContent = "Preparando y guardando la fotografía…";
        try {
          const rawDataUrl = await leerArchivoDataUrl(file);
          const dataUrl = await comprimirFoto(rawDataUrl);
          await llamarFuncion({ action: "upload_job_photo", session_token: token, assignment_id: jobId, photo_type: type, photo_data_url: dataUrl });
          message.textContent = "Fotografía guardada correctamente.";
          await cargarTrabajosLavador();
        } catch (error) {
          message.textContent = error.message || "No se pudo guardar la fotografía.";
        } finally { button.disabled = false; }
      });
    });

    container.querySelectorAll("button[data-complete-job]").forEach(button => {
      button.addEventListener("click", async () => {
        const jobId = button.dataset.completeJob;
        const message = document.getElementById(`ccw-job-message-${jobId}`);
        if (!confirm("¿Confirmas que este servicio está terminado? Se retirará de pendientes y quedará conservado en el historial.")) return;
        button.disabled = true;
        message.textContent = "Registrando finalización…";
        try {
          await llamarFuncion({ action: "complete_job", session_token: token, assignment_id: jobId });
          await cargarTrabajosLavador();
        } catch (error) {
          message.textContent = error.message || "No se pudo finalizar el trabajo.";
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    document.getElementById("ccw-jobs-message").textContent = error.message;
  }
}

async function cargarComisionesLavador() {
  const token = sessionStorage.getItem("ccw_washer_session");
  const container = document.getElementById("ccw-commissions");
  const button = document.getElementById("ccw-refresh-commissions");

  if (!container || !token) return;

  if (button) button.disabled = true;
  container.innerHTML = "<p>Consultando tus comisiones…</p>";

  try {
    const result = await llamarFuncion({
      action: "my_commissions",
      session_token: token
    });

    if (result.success !== true) {
      throw new Error(result.error || "No se pudieron consultar las comisiones.");
    }

    const resumen = result.resumen || {};
    const comisiones = Array.isArray(result.comisiones)
      ? result.comisiones
      : [];

    const dinero = valor => formatoPrecio(Number(valor) || 0);

    container.innerHTML = `
      <article style="background:#edf5ef;border-radius:10px;padding:14px;display:grid;gap:8px">
        <strong>Resumen de tus comisiones</strong>
        <div>Pendiente del pago del cliente: <strong>${dinero(resumen.pendiente_pago_cliente)}</strong></div>
        <div>Disponible para cobrar: <strong>${dinero(resumen.disponible)}</strong></div>
        <div>Total pagado históricamente: <strong>${dinero(resumen.pagado)}</strong></div>
      </article>
      <h4 style="margin:4px 0">Historial de comisiones</h4>
      ${
        comisiones.length
          ? comisiones.map(c => `
            <article style="background:white;border:1px solid #d7e1da;border-radius:10px;padding:12px;display:grid;gap:6px">
              <strong>${dinero(c.commission_amount)}</strong>
              <div>Base del servicio: ${dinero(c.service_price)}</div>
              <div>Porcentaje: ${Number(c.commission_rate) || 0}%</div>
              <div>Estado: ${
                ({
                  pendiente_revision: "Pendiente de revisión",
                  pendiente_pago_cliente: "Pendiente del pago del cliente",
                  a_pagar: "Disponible para cobrar",
                  pagada: "Pagada"
                })[c.status] || escaparHTML(c.status || "Sin estado")
              }</div>
              <div>Fecha: ${c.created_at
                ? escaparHTML(new Date(c.created_at).toLocaleString("es-PA", {
                    timeZone: "America/Panama"
                  }))
                : "No disponible"}</div>
              ${c.paid_at
                ? `<div>Pago registrado: ${escaparHTML(new Date(c.paid_at).toLocaleString("es-PA", {
                    timeZone: "America/Panama"
                  }))}</div>`
                : ""}
              ${c.payment_notes
                ? `<div>Nota: ${escaparHTML(c.payment_notes)}</div>`
                : ""}
            </article>
          `).join("")
          : "<p>Todavía no tienes comisiones registradas.</p>"
      }
    `;
  } catch (error) {
    container.innerHTML = `
      <p role="status">${escaparHTML(
        error.message || "No se pudieron consultar tus comisiones."
      )}</p>
    `;
  } finally {
    if (button) button.disabled = false;
  }
}

window.CCW = {
  iniciarSesion,
  comprobarPerfilAdmin,
  obtenerSesionAdmin,
  generarPinLavador,
  cerrarSesion,
  cargarTrabajosLavador
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const session = await obtenerSesionAdmin();
    if (session) {
      mostrarInicio();
    } else if (sessionStorage.getItem("ccw_washer_session")) {
      await cargarTrabajosLavador();
    } else {
      mostrarInicio();
    }
  } catch (error) {
    cerrarSesion();
    console.error("No se pudo restaurar la sesión:", error.message);
    mostrarInicio();
  }
});