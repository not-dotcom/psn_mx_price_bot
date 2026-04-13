const { chromium } = require("playwright");
const fs = require("fs").promises; // Importamos File System para guardar el JSON

async function obtenerTasaCambio() {
  try {
    const response = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=MXN",
    );
    const data = await response.json();
    return data.rates.MXN;
  } catch (error) {
    console.error("Error al obtener la tasa de cambio:", error.message);
    return 17.5; // Valor de respaldo por si falla la API
  }
}

async function getPrecio(url, tasaMXN, browser) {
  const IVA = 1.16;
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "Accept-Language": "es-MX,es;q=0.9, en;q=0.8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    await page.locator(".psw-product-tile").first().waitFor();
    const tiles = await page.locator(".psw-product-tile").all();

    let resultados = [];
    const formatter = new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    });

    for (const tile of tiles) {
      const nombre = await tile.locator('[id="product-name"]').textContent();
      const precioRaw = await tile
        .locator('[data-qa$="#display-price"]')
        .first()
        .textContent();

      const precioUSD = parseFloat(precioRaw.replace(/[^0-9.]/g, ""));
      const precioMXN = parseFloat((precioUSD * tasaMXN * IVA).toFixed(2));

      // Guardamos un objeto en lugar de un string
      resultados.push({
        nombre: nombre.trim(),
        precioBaseUSD: precioUSD,
        precioFinalMXN: precioMXN,
        precioFormateado: formatter.format(precioMXN),
      });
    }

    await page.close();
    return resultados;
  } catch (error) {
    console.log(`Error al procesar ${url}:`, error.message);
    await page.close();
    return [];
  }
}

const URL_PAGINA = [
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/1?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/2?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/3?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/4?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/5?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/6?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/7?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/8?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/9?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",
  "https://store.playstation.com/es-mx/category/3f772501-f6f8-49b7-abac-874a88ca4897/10?storeDisplayClassification=FULL_GAME,PREMIUM_EDITION,GAME_BUNDLE",

  // Puedes dejar las demás páginas aquí
];

async function buscarTodos() {
  console.log("Iniciando bot...");
  const tasaCruda = await obtenerTasaCambio();
  const tasaMXN = tasaCruda + 0.2;

  console.log(`Tasa de cambio hoy: $${tasaCruda} MXN`);
  console.log(`Tasa de cambio aplicada: $${tasaMXN} MXN\n`);

  const browser = await chromium.launch({ headless: true });

  // Aquí almacenaremos TODOS los juegos de TODAS las páginas
  let catalogoCompleto = [];

  for (let i = 0; i < URL_PAGINA.length; i++) {
    console.log(`--- Extrayendo Página ${i + 1} ---`);
    const juegosEnPagina = await getPrecio(URL_PAGINA[i], tasaMXN, browser);
    console.log(`Encontrados: ${juegosEnPagina.length} productos\n`);

    // Sumamos los juegos de esta página al catálogo principal
    catalogoCompleto = catalogoCompleto.concat(juegosEnPagina);
  }

  await browser.close();

  catalogoCompleto.sort((a, b) => b.precioFinalMXN - a.precioFinalMXN);

  const output = {
    lastUpdated: new Date().toISOString(),
    juegos: catalogoCompleto,
  };
  await fs.writeFile(
    "juegos_psn.json",
    JSON.stringify(output, null, 2),
    "utf-8",
  );

  console.log("=========================================");
  console.log(`Búsqueda finalizada con éxito.`);
  console.log(
    `Se guardaron un total de ${catalogoCompleto.length} juegos en el archivo "juegos_psn.json".`,
  );
  console.log("=========================================");
}

buscarTodos();
