// Cloudflare Worker — JUS Caja Forense scraper
// Deploy en: https://workers.cloudflare.com

const CAJAFORENSE_URL = 'https://www.cajaforense.com/index.php?action=portal/show&id_section=148&mnuId_parent=2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      const res = await fetch(CAJAFORENSE_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JUS-scraper/1.0)' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const html = await res.text();

      // Buscar valor JUS: patrones como "132.863,18" o "132863,18" o "132863.18"
      // La página muestra algo como: $ 132.863,18
      const patrones = [
        /\$\s*([\d\.]+,\d{2})/,           // $ 132.863,18
        /JUS[^$]*\$\s*([\d\.]+,\d{2})/i,  // JUS ... $ 132.863,18
        /valor[^$]*\$\s*([\d\.]+,\d{2})/i,// valor ... $ 132.863,18
        /([\d]{3}[\d\.]*,\d{2})/,          // cualquier número grande con decimales
      ];

      let valorStr = null;
      for (const pat of patrones) {
        const m = html.match(pat);
        if (m) { valorStr = m[1]; break; }
      }

      if (!valorStr) {
        // Devolver el HTML para depuración (primeros 2000 chars)
        return new Response(JSON.stringify({
          error: 'No se pudo parsear el valor JUS',
          html_preview: html.substring(0, 2000),
        }), { status: 422, headers: CORS_HEADERS });
      }

      // Normalizar: "132.863,18" → 132863.18
      const valor = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'));

      // Buscar fecha de publicación
      const fechaMatch = html.match(/(\d{2}\/\d{2}\/\d{4})/);
      const fecha = fechaMatch ? fechaMatch[1] : null;

      // Buscar nombre de tabla
      const tablaMatch = html.match(/Tabla_\w+/i);
      const tabla = tablaMatch ? tablaMatch[0] : null;

      return new Response(JSON.stringify({
        valor,
        fecha,
        tabla,
        fuente: 'Caja Forense Santa Fe',
        timestamp: new Date().toISOString(),
      }), { headers: CORS_HEADERS });

    } catch (err) {
      return new Response(JSON.stringify({
        error: err.message,
      }), { status: 500, headers: CORS_HEADERS });
    }
  },
};
