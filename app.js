
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
    <header style="background:#10251d;color:white;padding:25px 16px;text-align:center">
      <h1 style="margin:0 0 8px">EL CAIMAN CAR WASH</h1>
      <p style="margin:0">${subtitulo}</p>
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

function mostrarCliente() {
  estiloBase();
  document.body.innerHTML = `
    ${cabecera("Reservas para clientes")}
    <main style="max-width:520px;margin:32px auto;padding:20px">
      <h2>Reserva tu lavado</h2>
      <p>Reserva en línea: próximamente.</p>
      <p><strong>Las citas todavía no se pueden confirmar desde esta pantalla.</strong> No queremos mostrarte horarios que no estén realmente disponibles ni crear reservas duplicadas.</p>
      <p>Cuando se habiliten las reservas, el pago será al llegar: efectivo, Yappy o transferencia.</p>
      ${boton("Volver al inicio", "ccw-back")}
    </main>`;
  document.getElementById("ccw-back").onclick = () => mostrarInicio();
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

function mostrarPanelAdmin(profile) {
  estiloBase();
  document.body.innerHTML = `
    ${cabecera("Panel administrativo")}
    <main style="max-width:620px;margin:32px auto;padding:20px;display:grid;gap:14px">
      <h2>Bienvenida, ${escaparHTML(profile.full_name || "Administradora")}</h2>
      <p>Sesión autenticada como administradora.</p>
      <label for="ccw-washer">Seleccionar lavador</label>
      <select id="ccw-washer" style="padding:12px">
        <option value="${WASHER_ID}">Pedro</option>
      </select>
      ${boton("Generar PIN de hoy", "ccw-generate-pin")}
      <p id="ccw-pin-message" role="status"></p>
      <button id="ccw-logout" type="button" style="padding:12px">Cerrar sesión</button>
      <button id="ccw-home" type="button" style="padding:12px">Volver al inicio</button>
    </main>`;

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
