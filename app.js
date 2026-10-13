
const SUPABASE_URL = "https://adsgjmybppdacdndrqsf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_niEp79PXenQB2MVh7I8zpA_XSDAxIdB";
const WASHER_ID = "711080b4-ff5a-44f9-88de-e840a93294d5";
const ACCESS_FUNCTION = `${SUPABASE_URL}/functions/v1/gestionar-acceso-lavador`;

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

async function generarPinLavador(washerId) {
  const token = sessionStorage.getItem("ccw_access_token");
  if (!token) throw new Error("Inicia sesión como administradora primero.");

  const response = await fetch(ACCESS_FUNCTION, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ action: "generate_pin", washer_id: washerId })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo generar el PIN.");
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
          <label>Nombre completo<input id="ccw-customer-name" name="customer_name" required minlength="2" maxlength="120" autocomplete="name" style="display:block;width:100%;padding:12px;margin-top:5px"></label>
          <label>Teléfono<input id="ccw-customer-phone" name="customer_phone" required minlength="7" maxlength="30" autocomplete="tel" style="display:block;width:100%;padding:12px;margin-top:5px"></label>
          <label>Correo (opcional)<input id="ccw-customer-email" name="customer_email" type="email" maxlength="254" autocomplete="email" style="display:block;width:100%;padding:12px;margin-top:5px"></label>
          <label>Número de casa y dirección exacta (obligatorio)
            <input id="ccw-customer-address" name="customer_address" required minlength="2" maxlength="250" autocomplete="street-address"
              style="display:block;width:100%;padding:12px;margin-top:5px"
              placeholder="Ej.: Casa 12, calle principal, portón negro, junto a…">
          </label>
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
                <option value="pick_up">Pickup</option>
                <option value="busito">Busito</option>
                <option value="camioneta">Camioneta</option>
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
          <label>Hora solicitada<select id="ccw-booking-time" required style="display:block;width:100%;padding:12px;margin-top:5px"><option value="">Selecciona una fecha primero</option></select></label>
          <label>Notas (opcional)<textarea id="ccw-booking-notes" maxlength="500" rows="3" style="display:block;width:100%;padding:12px;margin-top:5px"></textarea></label>
          <p class="notice">Horario de atención publicado: 8:00 a. m. a 6:00 p. m. El descanso del personal es de 1:00 p. m. a 2:00 p. m. El horario final depende de la disponibilidad real.</p>
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
  const message = document.getElementById("ccw-booking-message");
  const submit = document.getElementById("ccw-submit-booking");
  const success = document.getElementById("ccw-booking-success");
  const validVehicleTypes = new Set(["sedan", "suv", "4x4", "busito", "camioneta", "pick_up"]);
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
    if (/interior/.test(text)) return "interior";
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
    selectedCategory = categorySelect.value;
    selectedService = null;
    limpiarSelect(serviceSelect, selectedCategory ? "Selecciona un servicio" : "Selecciona primero la categoría");
    limpiarSelect(tariffSelect, "Selecciona un servicio primero");
    serviceSelect.disabled = !selectedCategory;
    tariffSelect.disabled = true;
    priceLabel.textContent = "";
    actualizarVisibilidadVehiculo();

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
      let label = service.name;
      label = service.name;
      serviceSelect.add(new Option(label, service.id));
    });

    if (!matchingServices.length) {
      serviceSelect.add(new Option("Opciones pendientes de configurar", ""));
      serviceSelect.disabled = true;
      serviceHelp.textContent = "Esta categoría aparece en las instrucciones de Excel, pero todavía no se encuentra vinculada a un servicio activo del catálogo de Supabase. No hemos inventado precios.";
    }
  }

  function actualizarTarifasServicio() {
    selectedService = catalogServices.find(s => String(s.id) === serviceSelect.value) || null;
    limpiarSelect(tariffSelect, selectedService ? "Selecciona tamaño o tarifa" : "Selecciona un servicio primero");
    tariffSelect.disabled = !selectedService;
    priceLabel.textContent = "";
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
      if (vehicleCategory) return vehicleType && t.tipo_vehiculo === vehicleType;
      return !validVehicleTypes.has(t.tipo_vehiculo);
    });

    matching.forEach(t => {
      const index = allTariffs.push({
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        variant: t.variante || "estandar",
        vehicleType: t.tipo_vehiculo,
        price: Number(t.precio),
        isVehicle: vehicleCategory
      }) - 1;
      const vehicleLabel = vehicleCategory ? ` · ${vehicleType.toUpperCase().replace("PICK_UP", "PICKUP")}` : "";
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

  function actualizarHoras() {
    const date = dateInput.value;
    timeSelect.innerHTML = "";
    if (!date) {
      timeSelect.add(new Option("Selecciona una fecha primero", ""));
      return;
    }
    // Horas solicitables cada 30 minutos. La función SQL valida disponibilidad
    // real y puede rechazar un horario ocupado o sin plan publicado.
    timeSelect.add(new Option("Selecciona una hora", ""));
    for (let minutes = 8 * 60; minutes <= 16 * 60 + 30; minutes += 30) {
      const h = String(Math.floor(minutes / 60)).padStart(2, "0");
      const m = String(minutes % 60).padStart(2, "0");
      const value = `${h}:${m}`;
      if (date === panamaToday) {
        const nowParts = new Intl.DateTimeFormat("en-GB", {
          timeZone: "America/Panama", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
        }).format(new Date()).split(":").map(Number);
        if (minutes <= nowParts[0] * 60 + nowParts[1]) continue;
      }
      if (minutes >= 13 * 60 && minutes < 14 * 60) continue;
      timeSelect.add(new Option(value, value));
    }
  }

  dateInput.addEventListener("change", actualizarHoras);
  tariffSelect.addEventListener("change", actualizarPrecio);
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
      if (!tariff.isVehicle) throw new Error("Este servicio no se puede reservar en línea todavía. Consulta a la Administradora para confirmar la cita.");
      if (!vehicleTypeSelect.value) throw new Error("Selecciona el tipo de vehículo.");
      if (!plateInput.value.trim()) throw new Error("La placa es obligatoria.");
      if (!dateInput.value || !timeSelect.value) throw new Error("Selecciona fecha y hora.");

      const booking = {
        customer_name: document.getElementById("ccw-customer-name").value.trim(),
        customer_phone: document.getElementById("ccw-customer-phone").value.trim(),
        customer_email: document.getElementById("ccw-customer-email").value.trim() || null,
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
      if (!response.ok || data.ok !== true || data.reserva?.ok !== true) {
        throw new Error(data.error || data.reserva?.error || "No se pudo confirmar la cita. Prueba otra hora o fecha.");
      }

      // Nunca mostrar ni guardar lookup_secret en la página.
      form.hidden = true;
      success.hidden = false;
      success.innerHTML = `
        <h3 style="margin-top:0">¡Solicitud confirmada!</h3>
        <p>Tu código de reserva es:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:1px">${escaparHTML(data.reserva.booking_code || "")}</p>
        <p>Fecha: ${escaparHTML(data.reserva.appointment_date || booking.appointment_date)}</p>
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

function mostrarReservasAdmin(reservas) {
  const container = document.getElementById("ccw-reservas-lista");
  if (!container) return;
  if (!reservas.length) {
    container.innerHTML = '<p class="notice">No hay reservas registradas.</p>';
    return;
  }
  container.innerHTML = reservas.map(r => `
    <article style="background:#fff;border:1px solid #d7e1da;border-radius:12px;padding:15px;display:grid;gap:7px;overflow-wrap:anywhere">
      <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;align-items:center">
        <strong style="font-size:18px">${escaparHTML(r.booking_code || "Sin código")}</strong>
        <span style="background:#eaf4ed;padding:5px 9px;border-radius:20px">${escaparHTML(r.status || "sin estado")}</span>
      </div>
      <div><strong>Cliente:</strong> ${escaparHTML(r.customer_name || "—")}</div>
      <div><strong>Teléfono:</strong> ${escaparHTML(r.customer_phone || "—")}</div>
      <div><strong>Número de casa / dirección:</strong> ${escaparHTML(r.customer_address || r.house_number || r.address || "No registrado en la reserva")}</div>
      <div><strong>Fecha:</strong> ${escaparHTML(r.appointment_date || "—")}</div>
      <div><strong>Hora solicitada:</strong> ${escaparHTML(r.requested_start_time || "—")}</div>
      ${Array.isArray(r.vehicles) ? r.vehicles.map(v => `
        <div style="border-top:1px solid #e3e9e5;padding-top:8px;margin-top:4px">
          <div><strong>Servicio:</strong> ${escaparHTML(v.service_name || "Servicio")}</div>
          <div><strong>Horario asignado:</strong> ${escaparHTML(v.scheduled_start || "Pendiente")} – ${escaparHTML(v.scheduled_end || "Pendiente")}</div>
          <div><strong>Lavador:</strong> ${escaparHTML(v.washer_name || "Sin asignar")}</div>
          <div><strong>Vehículo:</strong> ${escaparHTML([v.vehicle_type, v.make, v.model, v.license_plate].filter(Boolean).join(" · ") || "—")}</div>
          <div><strong>Precio:</strong> ${v.price == null ? "Pendiente" : escaparHTML(formatoPrecio(Number(v.price)))}</div>
        </div>`).join("") : ""}
    </article>`).join("");
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

function mostrarPanelAdmin(profile) {
  estiloBase();
  document.body.innerHTML = `
    ${cabecera("Panel administrativo")}
    <main style="max-width:620px;margin:32px auto;padding:20px;display:grid;gap:14px">
      <h2>Bienvenida, ${escaparHTML(profile.full_name || "Administradora")}</h2>
      <p>Sesión autenticada como administradora.</p>
      <section style="display:grid;gap:12px;background:#edf5ef;border-radius:12px;padding:16px">
        <h3 style="margin:0">Reservas de clientes</h3>
        <p style="margin:0">Consulta los datos del cliente, el código, el servicio, el precio y el horario asignado.</p>
        <button id="ccw-reservas-refresh" type="button" style="padding:12px;background:#18764e;color:white;border:0;border-radius:8px;font-weight:bold">Actualizar reservas</button>
        <p id="ccw-reservas-message" role="status" style="margin:0">Pulsa Actualizar reservas para consultar las citas.</p>
        <div id="ccw-reservas-lista" style="display:grid;gap:10px"></div>
      </section>
      <label for="ccw-washer">Seleccionar lavador</label>
      <select id="ccw-washer" style="padding:12px">
        <option value="${WASHER_ID}">Pedro</option>
      </select>
      ${boton("Generar PIN de hoy", "ccw-generate-pin")}
      <p id="ccw-pin-message" role="status"></p>
      <button id="ccw-logout" type="button" style="padding:12px">Cerrar sesión</button>
      <button id="ccw-home" type="button" style="padding:12px">Volver al inicio</button>
    </main>`;

  document.getElementById("ccw-reservas-refresh").onclick = actualizarReservasAdmin;
  actualizarReservasAdmin();

  document.getElementById("ccw-generate-pin").onclick = async event => {
    const button = event.currentTarget;
    const message = document.getElementById("ccw-pin-message");
    button.disabled = true;
    message.textContent = "Solicitando PIN…";
    try {
      const result = await generarPinLavador(document.getElementById("ccw-washer").value);
      message.textContent = result.pin
        ? `PIN generado: ${result.pin}. Entrégalo al lavador de forma privada.`
        : "La función no devolvió un PIN.";
    } catch (error) {
      message.textContent = error.message;
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
        <p>Introduce el PIN diario que te entregó la administración.</p>
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
      const result = await llamarFuncion({
        action: "validate_pin",
        washer_id: WASHER_ID,
        pin
      });
      if (!result.session_token || !result.expires_at) {
        throw new Error("El servidor no devolvió una sesión válida.");
      }
      guardarSesionLavador(result.session_token, result.expires_at, result.washer_name);
      await cargarTrabajosLavador();
    } catch (error) {
      output.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
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
      <button id="ccw-refresh-jobs" type="button" style="padding:12px">Actualizar trabajos</button>
      <button id="ccw-washer-logout" type="button" style="padding:12px">Cerrar sesión</button>
    </main>`;

  document.getElementById("ccw-refresh-jobs").onclick = cargarTrabajosLavador;
  document.getElementById("ccw-washer-logout").onclick = () => {
    borrarSesionLavador();
    mostrarInicio();
  };

  try {
    const result = await llamarFuncion({ action: "my_jobs", session_token: token });
    const jobs = Array.isArray(result.jobs) ? result.jobs : [];
    const container = document.getElementById("ccw-jobs");
    document.getElementById("ccw-jobs-message").textContent =
      jobs.length ? `Tienes ${jobs.length} trabajo(s) asignado(s).`
                  : "Todavía no tienes servicios asignados.";

    container.innerHTML = jobs.map(job => `
      <article style="background:white;border:1px solid #d7e1da;border-radius:10px;padding:14px">
        <strong>Servicio asignado</strong>
        <p>Estado: ${escaparHTML(job.status || "asignado")}</p>
        <p>Inicio programado: ${escaparHTML(job.scheduled_start || "Pendiente")}</p>
        <p>Fin programado: ${escaparHTML(job.scheduled_end || "Pendiente")}</p>
        <p style="font-size:12px;color:#52655a">Referencia del vehículo: ${escaparHTML(job.appointment_vehicle_id)}</p>
      </article>
    `).join("");
  } catch (error) {
    document.getElementById("ccw-jobs-message").textContent = error.message;
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
