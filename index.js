import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const editores = ['admin', 'editor'];
const tipos = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const campos = ['nombre', 'fecha_nacimiento', 'lugar_nacimiento', 'padre', 'madre', 'padrinos', 'testigos', 'fecha_bautizo', 'fecha_registro', 'libro', 'folio', 'partida', 'confianza', 'imagen_path'];
const faltantes = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((nombre) => !process.env[nombre]);
const codigoAdmin = process.env.ADMIN_SETUP_CODE || '';
const puerto = process.env.PORT || 3000;
const sesionesMovil = new Map();

const supabase = faltantes.length ? null : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, archivo, cb) => cb(null, archivo.mimetype in tipos)
});

const texto = (descripcion) => ({ type: 'STRING', nullable: true, description: descripcion });

const esquema = {
  type: 'OBJECT',
  properties: {
    nombre: texto('Nombre completo del inscrito'),
    fecha_nacimiento: texto('Fecha de nacimiento en formato AAAA-MM-DD'),
    lugar_nacimiento: texto('Lugar de nacimiento'),
    padre: texto('Nombre completo del padre'),
    madre: texto('Nombre completo de la madre'),
    padrinos: texto('Padrinos separados por coma'),
    testigos: texto('Testigos separados por coma'),
    fecha_bautizo: texto('Fecha de bautizo en formato AAAA-MM-DD'),
    fecha_registro: texto('Fecha de registro o asiento en formato AAAA-MM-DD'),
    libro: texto('Número de libro'),
    folio: texto('Número de folio'),
    partida: texto('Número de partida o acta'),
    confianza: { type: 'NUMBER', description: 'Confianza global de la lectura entre 0 y 1' },
    legible: { type: 'BOOLEAN', description: 'Indica si el texto de un único registro se puede leer con seguridad' }
  },
  required: ['confianza', 'legible']
};

const instruccion = 'Eres un transcriptor experto de actas de nacimiento y bautizo eclesiásticas. Analiza una sola imagen/archivo a la vez y extrae los datos de un único registro exactamente como aparecen escritos, respetando la ortografía de los nombres propios. Normaliza todas las fechas a AAAA-MM-DD. Si un dato no aparece o es ilegible devuelve null. Marca legible=false y confianza baja si el texto no se puede leer con seguridad, si la imagen no es un acta, o si aparecen varios registros y no se puede determinar cuál corresponde. No combines datos de secciones o registros distintos y no inventes información.';

const extraer = async (archivo) => {
  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const respuesta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: instruccion },
          { inline_data: { mime_type: archivo.mimetype, data: archivo.buffer.toString('base64') } }
        ]
      }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: esquema, temperature: 0 }
    })
  });
  if (!respuesta.ok) throw new Error(await respuesta.text());
  const cuerpo = await respuesta.json();
  return JSON.parse(cuerpo.candidates[0].content.parts[0].text);
};

const guardarArchivo = async (usuarioId, archivo) => {
  const ruta = `${usuarioId}/${crypto.randomUUID()}.${tipos[archivo.mimetype]}`;
  const { error } = await supabase.storage.from('actas').upload(ruta, archivo.buffer, { contentType: archivo.mimetype });
  if (error) throw error;
  try {
    return { ruta, datos: await extraer(archivo) };
  } catch (fallo) {
    console.error('No se pudo extraer información del acta:', fallo.message);
    return { ruta, datos: null };
  }
};

const ipLocal = () => {
  if (process.env.LAN_HOST) return process.env.LAN_HOST;
  const direcciones = Object.values(os.networkInterfaces()).flat().filter(
    (interfaz) => interfaz && interfaz.family === 'IPv4' && !interfaz.internal && !interfaz.address.startsWith('169.254.')
  );
  const redesLocales = direcciones.filter((interfaz) =>
    interfaz.address.startsWith('192.168.') || interfaz.address.startsWith('10.') || interfaz.address.startsWith('172.')
  );
  const interfazWifi = Object.entries(os.networkInterfaces())
    .filter(([nombre]) => /(wi-?fi|wireless|wlan)/i.test(nombre))
    .flatMap(([, interfaces]) => interfaces || [])
    .find((interfaz) => interfaz && interfaz.family === 'IPv4' && !interfaz.internal && !interfaz.address.startsWith('169.254.'));
  return interfazWifi?.address
    || redesLocales.find((interfaz) => interfaz.address.startsWith('192.168.'))?.address
    || redesLocales[0]?.address
    || direcciones[0]?.address
    || null;
};

const obtenerSesionMovil = (token) => {
  if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
  const sesion = sesionesMovil.get(token);
  if (!sesion) return null;
  if (sesion.expira <= Date.now()) {
    sesionesMovil.delete(token);
    return null;
  }
  return sesion;
};

const limpiarSesionesMovil = setInterval(() => {
  for (const [token, sesion] of sesionesMovil) {
    if (sesion.expira <= Date.now()) sesionesMovil.delete(token);
  }
}, 60_000);
limpiarSesionesMovil.unref();

const autenticar = (roles) => async (req, res, next) => {
  if (!supabase) {
    return res.status(503).json({ error: 'El servidor no está configurado. Añade SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel.' });
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Sesión no válida' });
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', data.user.id).single();
  if (!perfil || !roles.includes(perfil.rol)) return res.status(403).json({ error: 'Permisos insuficientes' });
  req.usuario = data.user;
  req.rol = perfil.rol;
  next();
};

const limpiar = (cuerpo) => Object.fromEntries(
  campos.filter((c) => c in cuerpo).map((c) => [c, cuerpo[c] === '' ? null : cuerpo[c]])
);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.get('/', (req, res) => res.sendFile(path.join(raiz, 'index.html')));
app.get('/app.js', (req, res) => res.sendFile(path.join(raiz, 'app.js')));
app.get('/styles.css', (req, res) => res.sendFile(path.join(raiz, 'styles.css')));
app.get('/mobile.css', (req, res) => res.sendFile(path.join(raiz, 'mobile.css')));
app.get('/mobile', (req, res) => {
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(raiz, 'mobile.html'));
});

app.get('/api/config', (req, res) => {
  if (faltantes.length) {
    return res.status(503).json({ error: `Faltan variables de entorno en Vercel: ${faltantes.join(', ')}.` });
  }
  res.json({ url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY, adminSetupEnabled: Boolean(codigoAdmin) });
});

app.post('/api/admin/claim', autenticar(['admin', 'editor', 'lector']), async (req, res) => {
  if (!codigoAdmin) return res.status(503).json({ error: 'La activación de administrador no está configurada en el servidor' });
  if (codigoAdmin.length < 32) return res.status(503).json({ error: 'ADMIN_SETUP_CODE debe tener al menos 32 caracteres' });
  const codigoIngresado = Buffer.from(typeof req.body?.code === 'string' ? req.body.code : '');
  const codigoEsperado = Buffer.from(codigoAdmin);
  if (codigoIngresado.length !== codigoEsperado.length || !crypto.timingSafeEqual(codigoIngresado, codigoEsperado)) {
    return res.status(403).json({ error: 'Código de activación incorrecto' });
  }
  const { data, error } = await supabase.rpc('reclamar_primer_admin', { usuario_id: req.usuario.id });
  if (error) {
    console.error('No se pudo activar el primer administrador:', error.message);
    return res.status(500).json({ error: 'No se pudo activar el administrador. Verifica que la función SQL esté instalada.' });
  }
  if (!data) return res.status(409).json({ error: 'Ya existe un administrador. El código solo sirve para configurar el primero.' });
  res.json({ ok: true });
});

app.post('/api/mobile/sessions', autenticar(editores), async (req, res) => {
  const host = ipLocal();
  if (!host) return res.status(503).json({ error: 'No se encontró la dirección Wi-Fi de esta computadora' });
  for (const [token, sesion] of sesionesMovil) {
    if (sesion.expira <= Date.now() || sesion.usuarioId === req.usuario.id) sesionesMovil.delete(token);
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expira = Date.now() + 10 * 60 * 1000;
  const url = `http://${host}:${puerto}/mobile?token=${token}`;
  const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 280 });
  sesionesMovil.set(token, { usuarioId: req.usuario.id, expira, estado: 'esperando', resultado: null });
  res.status(201).json({ token, qr, expira });
});

app.get('/api/mobile/sessions/:token', autenticar(editores), (req, res) => {
  const sesion = obtenerSesionMovil(req.params.token);
  if (!sesion || sesion.usuarioId !== req.usuario.id) return res.status(404).json({ error: 'La sesión QR expiró o ya no existe' });
  res.json({ estado: sesion.estado, cantidad: sesion.archivos?.length || 0 });
});

app.get('/api/mobile/sessions/:token/file/:indice', autenticar(editores), (req, res) => {
  const sesion = obtenerSesionMovil(req.params.token);
  const archivo = sesion?.archivos?.[Number(req.params.indice)];
  if (!sesion || sesion.usuarioId !== req.usuario.id || sesion.estado !== 'completado' || !archivo) {
    return res.status(404).json({ error: 'La foto no está disponible; genera otro QR e inténtalo de nuevo.' });
  }
  res.set('Cache-Control', 'no-store');
  res.type(archivo.mimetype).send(archivo.buffer);
});

app.get('/api/mobile/sessions/:token/file', autenticar(editores), (req, res) => {
  const sesion = obtenerSesionMovil(req.params.token);
  const archivo = sesion?.archivos?.[0];
  if (!sesion || sesion.usuarioId !== req.usuario.id || sesion.estado !== 'completado' || !archivo) {
    return res.status(404).json({ error: 'La foto no está disponible; genera otro QR e inténtalo de nuevo.' });
  }
  res.set('Cache-Control', 'no-store');
  res.type(archivo.mimetype).send(archivo.buffer);
});

app.delete('/api/mobile/sessions/:token', autenticar(editores), (req, res) => {
  const sesion = obtenerSesionMovil(req.params.token);
  if (sesion?.usuarioId === req.usuario.id) sesionesMovil.delete(req.params.token);
  res.status(204).end();
});

app.post('/api/mobile/upload/:token', subida.array('archivos', 10), async (req, res) => {
  const sesion = obtenerSesionMovil(req.params.token);
  if (!sesion) return res.status(404).json({ error: 'Este QR expiró. Genera uno nuevo desde la computadora.' });
  if (sesion.estado !== 'esperando') return res.status(409).json({ error: 'Este QR ya fue usado o la carga está en curso.' });
  const archivos = req.files || [];
  if (!archivos.length || archivos.some((archivo) => !['image/jpeg', 'image/png'].includes(archivo.mimetype))) {
    return res.status(400).json({ error: 'Selecciona entre 1 y 10 fotos JPG o PNG de hasta 15 MB cada una.' });
  }
  sesion.archivos = archivos;
  sesion.estado = 'completado';
  sesion.expira = Date.now() + 10 * 60 * 1000;
  res.json({ ok: true, cantidad: archivos.length });
});

app.post('/api/extract', autenticar(editores), subida.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo no válido. Usa JPG, PNG o PDF de hasta 15 MB' });
  try {
    res.json(await guardarArchivo(req.usuario.id, req.file));
  } catch (fallo) {
    res.status(500).json({ error: fallo.message });
  }
});

app.post('/api/actas', autenticar(editores), async (req, res) => {
  const fila = limpiar(req.body);
  if (!fila.nombre || !String(fila.nombre).trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const { data, error } = await supabase.from('actas').insert({ ...fila, creado_por: req.usuario.id }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

app.patch('/api/actas/:id', autenticar(editores), async (req, res) => {
  const fila = limpiar(req.body);
  if ('nombre' in fila && !fila.nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const { data, error } = await supabase.from('actas').update(fila).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete('/api/actas/:id', autenticar(['admin']), async (req, res) => {
  const { data: acta } = await supabase.from('actas').select('imagen_path').eq('id', req.params.id).single();
  const { error } = await supabase.from('actas').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  if (acta?.imagen_path) await supabase.storage.from('actas').remove([acta.imagen_path]);
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

if (process.env.VERCEL !== '1') {
  app.listen(puerto, '0.0.0.0', () => {
    const host = ipLocal();
    console.log(`Servidor en http://localhost:${puerto}`);
    if (host) console.log(`Acceso desde el celular (misma Wi-Fi): http://${host}:${puerto}`);
    else console.warn('No se detectó una IP Wi-Fi; configura LAN_HOST en .env si la computadora tiene varias redes.');
  });
}

export default app;
