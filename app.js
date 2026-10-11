
const SUPABASE_URL = "https://adsgjmybppdacdndrqsf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_niEp79PXenQB2MVh7I8zpA_XSDAxIdB";

const supabaseHeaders = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  "Content-Type": "application/json"
};

async function comprobarConexion() {
  try {
    const respuesta = await fetch(
      `${SUPABASE_URL}/auth/v1/settings`,
      { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } }
    );

    if (!respuesta.ok) {
      throw new Error("No se pudo conectar con Supabase.");
    }

    console.log("Conexión con Supabase disponible.");
    return true;
  } catch (error) {
    console.error("Error de conexión:", error.message);
    return false;
  }
}

async function iniciarSesion(email, password) {
  const respuesta = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: supabaseHeaders,
      body: JSON.stringify({ email, password })
    }
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos.msg || datos.message || "No se pudo iniciar sesión.");
  }

  if (!datos.access_token || !datos.refresh_token) {
    throw new Error("Supabase no devolvió una sesión válida.");
  }

  sessionStorage.setItem("ccw_access_token", datos.access_token);
  sessionStorage.setItem("ccw_refresh_token", datos.refresh_token);

  try {
    const perfil = await comprobarPerfilAdmin(datos.access_token);
    return { user: datos.user, perfil };
  } catch (error) {
    cerrarSesion();
    throw error;
  }
}

async function comprobarPerfilAdmin(accessToken) {
  const respuesta = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,full_name,role,active&id=eq.${encodeURIComponent(
      JSON.parse(atob(accessToken.split(".")[1])).sub
    )}`,
    {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!respuesta.ok) {
    throw new Error("No se pudo comprobar el perfil administrativo.");
  }

  const perfiles = await respuesta.json();
  const perfil = perfiles[0];

  if (!perfil || perfil.role !== "admin" || perfil.active !== true) {
    throw new Error("Acceso denegado: se requiere un administrador activo.");
  }

  return perfil;
}

function cerrarSesion() {
  sessionStorage.removeItem("ccw_access_token");
  sessionStorage.removeItem("ccw_refresh_token");
}

async function obtenerSesionAdmin() {
  const accessToken = sessionStorage.getItem("ccw_access_token");

  if (!accessToken) {
    return null;
  }

  const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!respuesta.ok) {
    cerrarSesion();
    return null;
  }

  const perfil = await comprobarPerfilAdmin(accessToken);
  return { perfil, accessToken };
}

async function generarPinLavador(washerId) {
  const accessToken = sessionStorage.getItem("ccw_access_token");

  if (!accessToken) {
    throw new Error("Inicia sesión como administrador primero.");
  }

  const respuesta = await fetch(
    `${SUPABASE_URL}/functions/v1/gestionar-acceso-lavador`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "generate_pin",
        washer_id: washerId
      })
    }
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(datos.error || "No se pudo generar el PIN.");
  }

  return datos;
}

function mostrarLoginAdmin() {
  document.body.innerHTML = `
    <header style="background:#10251d;color:white;padding:24px;text-align:center">
      <h1>EL CAIMAN CAR WASH</h1>
      <p>Acceso administrativo</p>
    </header>
    <main style="max-width:420px;margin:40px auto;padding:24px;font-family:Arial,sans-serif">
      <form id="ccw-login" style="display:grid;gap:14px">
        <label for="ccw-email">Correo de Ana</label>
        <input id="ccw-email" type="email" autocomplete="username" required
          style="padding:12px" />
        <label for="ccw-password">Contraseña</label>
        <input id="ccw-password" type="password" autocomplete="current-password"
          required style="padding:12px" />
        <button type="submit" style="padding:13px;background:#18764e;color:white;border:0;border-radius:8px">
          Iniciar sesión
        </button>
        <p id="ccw-message" role="status"></p>
      </form>
    </main>
  `;

  document.getElementById("ccw-login").addEventListener("submit", async (event) => {
    event.preventDefault();

    const boton = event.currentTarget.querySelector("button");
    const mensaje = document.getElementById("ccw-message");
    const email = document.getElementById("ccw-email").value.trim();
    const password = document.getElementById("ccw-password").value;

    boton.disabled = true;
    mensaje.textContent = "Verificando acceso…";

    try {
      const resultado = await iniciarSesion(email, password);
      mostrarPanelAdmin(resultado.perfil);
    } catch (error) {
      mensaje.textContent = error.message;
    } finally {
      boton.disabled = false;
    }
  });
}

function mostrarPanelAdmin(perfil) {
  document.body.innerHTML = `
    <header style="background:#10251d;color:white;padding:24px;text-align:center">
      <h1>EL CAIMAN CAR WASH</h1>
      <p>Panel administrativo</p>
    </header>
    <main style="max-width:650px;margin:40px auto;padding:24px;font-family:Arial,sans-serif">
      <h2>Bienvenida, ${escaparHTML(perfil.full_name || "Administradora")}</h2>
      <p>Sesión autenticada como administradora.</p>
      <section style="display:grid;gap:12px">
        <label for="ccw-washer">Seleccionar lavador</label>
        <select id="ccw-washer" style="padding:12px">
          <option value="711080b4-ff5a-44f9-88de-e840a93294d5">Pedro</option>
        </select>
        <button id="ccw-generate-pin" style="padding:13px;background:#18764e;color:white;border:0;border-radius:8px">
          Generar PIN de hoy
        </button>
        <p id="ccw-pin-message" role="status"></p>
        <button id="ccw-logout" style="padding:12px">Cerrar sesión</button>
      </section>
    </main>
  `;

  document.getElementById("ccw-generate-pin").addEventListener("click", async () => {
    const boton = document.getElementById("ccw-generate-pin");
    const mensaje = document.getElementById("ccw-pin-message");
    boton.disabled = true;
    mensaje.textContent = "Solicitando PIN…";

    try {
      const resultado = await generarPinLavador(
        document.getElementById("ccw-washer").value
      );
      mensaje.textContent = resultado.pin
        ? `PIN generado: ${resultado.pin}`
        : "La función no devolvió un PIN.";
    } catch (error) {
      mensaje.textContent = error.message;
    } finally {
      boton.disabled = false;
    }
  });

  document.getElementById("ccw-logout").addEventListener("click", () => {
    cerrarSesion();
    location.reload();
  });
}

function escaparHTML(valor) {
  return String(valor).replace(/[&<>"']/g, caracter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caracter]);
}

window.CCW = {
  comprobarConexion,
  iniciarSesion,
  comprobarPerfilAdmin,
  obtenerSesionAdmin,
  generarPinLavador,
  cerrarSesion
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const sesion = await obtenerSesionAdmin();

    if (sesion) {
      mostrarPanelAdmin(sesion.perfil);
    } else {
      mostrarLoginAdmin();
    }
  } catch (error) {
    cerrarSesion();
    mostrarLoginAdmin();
    console.error("No se pudo restaurar la sesión:", error.message);
  }
});
