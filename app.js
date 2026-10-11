
const SUPABASE_URL = "https://adsgjmybppdacdndrqsf.supabase.co";

// Pega aquí tu clave pública sb_publishable_...
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_niEp79PXenQB2MVh7I8zpA_XSDAxIdB";

async function comprobarConexion() {
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY
      }
    });

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

window.CCW = {
  comprobarConexion
};
