const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const campos = [
  ['nombre', 'Nombre completo', 'text', true],
  ['fecha_nacimiento', 'Fecha de nacimiento', 'date'],
  ['lugar_nacimiento', 'Lugar de nacimiento', 'text'],
  ['padre', 'Padre', 'text'],
  ['madre', 'Madre', 'text'],
  ['padrinos', 'Padrinos', 'text'],
  ['testigos', 'Testigos', 'text'],
  ['fecha_bautizo', 'Fecha de bautizo', 'date'],
  ['fecha_registro', 'Fecha de registro', 'date'],
  ['libro', 'Libro', 'text'],
  ['folio', 'Folio', 'text'],
  ['partida', 'Partida', 'text']
];

const roles = { admin: 'Administrador', editor: 'Editor', lector: 'Lector' };
const permitidos = ['image/jpeg', 'image/png', 'application/pdf'];

const e = {
  cliente: null, sesion: null, activo: null, rol: null, canal: null,
  actas: new Map(), urls: new Map(), filtro: '',
  adminSetupEnabled: false,
  mobileToken: null, mobileTimer: null,
  colaArchivos: [], enLote: false, procesandoLote: false,
  imagenRecorte: null, urlRecorte: null, urlVista: null, archivoOriginal: null, puntosRecorte: null, interaccionRecorte: null,
  ruta: null, confianza: null, editando: null,
  flujo: null, reloj: null, caja: { x1: 0.06, y1: 0.06, x2: 0.94, y2: 0.94 }
};

const puedeEditar = () => e.rol === 'admin' || e.rol === 'editor';

const aviso = (mensaje, tipo = 'ok') => {
  const nodo = document.createElement('div');
  nodo.className = `aviso ${tipo}`;
  nodo.textContent = mensaje;
  $('#avisos').append(nodo);
  setTimeout(() => nodo.classList.add('sale'), 3600);
  setTimeout(() => nodo.remove(), 4000);
};

const api = async (ruta, opciones = {}) => {
  const { json, ...resto } = opciones;
  const respuesta = await fetch(ruta, {
    ...resto,
    headers: { ...(json ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${e.sesion.access_token}` },
    body: json ? JSON.stringify(json) : resto.body
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.error || 'Error del servidor');
  return datos;
};

const fecha = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

const escena3D = () => {
  try {
    const lienzo = $('#fondo');
    const r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    const s = new THREE.Scene();
    const c = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    c.position.z = 9;
    const oro = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.65, roughness: 0.28 });
    const cruz = new THREE.Group();
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.6, 0.55), oro);
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 0.55), oro);
    horizontal.position.y = 0.75;
    cruz.add(vertical, horizontal);
    const materialAro = new THREE.MeshBasicMaterial({ color: 0x7fa3d1, transparent: true, opacity: 0.55 });
    const aro = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.025, 16, 120), materialAro);
    const aro2 = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.018, 16, 120), materialAro);
    aro2.rotation.x = 1.2;
    const grupo = new THREE.Group();
    grupo.add(cruz, aro, aro2);
    s.add(grupo);
    s.add(new THREE.AmbientLight(0xffffff, 0.75));
    const luz = new THREE.DirectionalLight(0xfff1c9, 1.4);
    luz.position.set(4, 5, 6);
    s.add(luz);
    const luzAzul = new THREE.PointLight(0x9bbbe6, 1.2, 30);
    luzAzul.position.set(-5, -2, 4);
    s.add(luzAzul);
    const n = 420;
    const posiciones = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) posiciones[i] = (Math.random() - 0.5) * 22;
    const geoParticulas = new THREE.BufferGeometry();
    geoParticulas.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    const particulas = new THREE.Points(geoParticulas, new THREE.PointsMaterial({ color: 0xc9a227, size: 0.05, transparent: true, opacity: 0.8 }));
    s.add(particulas);

    const ajustar = () => {
      const ancho = innerWidth;
      const alto = innerHeight;
      r.setSize(ancho, alto, false);
      c.aspect = ancho / alto;
      c.updateProjectionMatrix();
      const grande = ancho > 900;
      grupo.position.set(grande ? 3.6 : 0, grande ? 0 : 2.4, 0);
      grupo.scale.setScalar(grande ? 1 : 0.65);
    };
    ajustar();
    addEventListener('resize', ajustar);

    let mx = 0;
    let my = 0;
    addEventListener('pointermove', (ev) => {
      mx = ev.clientX / innerWidth - 0.5;
      my = ev.clientY / innerHeight - 0.5;
    });
    const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bucle = (t) => {
      const k = t / 1000;
      if (!reducir) {
        cruz.rotation.y = Math.sin(k * 0.4) * 0.6 + mx * 0.9;
        cruz.rotation.x = my * 0.45;
        aro.rotation.z = k * 0.15;
        aro2.rotation.z = k * 0.1;
        particulas.rotation.y = k * 0.02;
        particulas.position.y = Math.sin(k * 0.3) * 0.3;
      }
      r.render(s, c);
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
  } catch (fallo) {
    $('#fondo').remove();
  }
};

const construirFormulario = () => {
  $('#campos').innerHTML = campos.map(([n, t, tipo, ancho]) => `<label class="campo${ancho ? ' ancho' : ''}"><span>${t}</span><input name="${n}" type="${tipo}" autocomplete="off"></label>`).join('');
};

const llenar = (datos = {}, ia = false) => {
  campos.forEach(([n]) => {
    const entrada = $(`[name="${n}"]`);
    const valor = datos[n] ?? '';
    entrada.value = valor;
    entrada.classList.toggle('ia', ia && valor !== '');
  });
};

const detenerCamara = () => {
  clearInterval(e.reloj);
  e.flujo?.getTracks().forEach((p) => p.stop());
  e.flujo = null;
  $('#camara').hidden = true;
};

const reiniciar = () => {
  detenerCamara();
  e.ruta = null;
  e.confianza = null;
  e.editando = null;
  $('#formulario').reset();
  llenar();
  $('#vista').hidden = true;
  $('#vista').innerHTML = '';
  if (e.urlVista) URL.revokeObjectURL(e.urlVista);
  e.urlVista = null;
  $('#estadoIA').textContent = '';
  $('#estadoIA').classList.remove('estado-inseguro');
  $('#omitirImagen').hidden = true;
  $('#archivo').value = '';
  $('#controlesRecorte').hidden = true;
  e.imagenRecorte = null;
  if (e.urlRecorte) URL.revokeObjectURL(e.urlRecorte);
  e.urlRecorte = null;
  e.archivoOriginal = null;
  e.puntosRecorte = null;
  e.interaccionRecorte = null;
  e.colaArchivos = [];
  e.enLote = false;
  e.procesandoLote = false;
  $('#tituloForm').textContent = 'Digitalizar acta';
  $('#cancelar').hidden = true;
};

const mostrarVista = (archivo) => {
  const v = $('#vista');
  v.innerHTML = '';
  if (e.urlVista) URL.revokeObjectURL(e.urlVista);
  e.urlVista = null;
  $('#controlesRecorte').hidden = true;
  if (archivo.type === 'application/pdf') {
    v.innerHTML = '<div class="pdf">Documento PDF</div>';
  } else {
    const imagen = new Image();
    imagen.alt = 'Vista previa del acta';
    e.urlVista = URL.createObjectURL(archivo);
    imagen.src = e.urlVista;
    v.append(imagen);
  }
  v.hidden = false;
};

const dibujarCajaRecorte = () => {
  const svg = $('#contornoRecorte');
  if (!svg || !e.puntosRecorte) return;
  const coordenadas = e.puntosRecorte.map(([x, y]) => `${x * 1000},${y * 1000}`).join(' ');
  const ruta = `M0 0H1000V1000H0Z ${coordenadas.split(' ').map((p, i) => `${i ? 'L' : 'M'}${p}`).join(' ')}Z`;
  svg.innerHTML = `<path d="${ruta}" fill="rgba(13,21,34,.5)" fill-rule="evenodd"></path><polygon points="${coordenadas}" class="poligono-recorte"></polygon>${e.puntosRecorte.map(([x, y], i) => `<circle cx="${x * 1000}" cy="${y * 1000}" r="13" class="punto-recorte" data-punto="${i}"><title>Mover punto ${i + 1}</title></circle>`).join('')}`;
};

const mostrarEditorRecorte = (archivo) => {
  if (e.urlRecorte) URL.revokeObjectURL(e.urlRecorte);
  if (e.urlVista) URL.revokeObjectURL(e.urlVista);
  e.urlVista = null;
  $('#vista').innerHTML = '';
  $('#vista').hidden = true;
  $('#controlesRecorte').hidden = true;
  e.archivoOriginal = archivo;
  const imagen = new Image();
  e.imagenRecorte = imagen;
  imagen.alt = 'Foto del acta: arrastra el marco para elegir el área';
  imagen.onload = () => {
    if (e.imagenRecorte !== imagen) return;
    e.puntosRecorte = [[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98]];
    const vista = $('#vista');
    vista.innerHTML = '<div id="lienzoRecorte" class="lienzo-recorte"><img id="imagenRecorte" alt="Vista previa del acta"><svg id="contornoRecorte" class="contorno-recorte" viewBox="0 0 1000 1000" preserveAspectRatio="none" role="group" aria-label="Contorno de recorte editable"></svg></div>';
    $('#imagenRecorte').src = imagen.src;
    vista.hidden = false;
    $('#controlesRecorte').hidden = false;
    dibujarCajaRecorte();
  };
  imagen.onerror = () => {
    if (e.imagenRecorte === imagen) aviso('No se pudo abrir la imagen seleccionada', 'error');
  };
  e.urlRecorte = URL.createObjectURL(archivo);
  imagen.src = e.urlRecorte;
};

const analizarArchivo = async (archivo) => {
  mostrarVista(archivo);
  const v = $('#vista');
  v.classList.add('analizando');
  $('#estadoIA').classList.remove('estado-inseguro');
  llenar();
  $('#estadoIA').textContent = 'Leyendo el acta con inteligencia artificial';
  const cuerpo = new FormData();
  cuerpo.append('archivo', archivo);
  try {
    const r = await api('/api/extract', { method: 'POST', body: cuerpo });
    e.ruta = r.ruta;
    const lecturaSegura = r.datos
      && r.datos.legible !== false
      && Boolean(r.datos.nombre?.trim())
      && Number(r.datos.confianza) >= 0.55;
    if (lecturaSegura) {
      e.confianza = r.datos.confianza ?? null;
      llenar(r.datos, true);
      $('#estadoIA').textContent = 'Campos completados. Revisa los resaltados antes de guardar.';
      aviso('Datos extraídos del acta');
    } else {
      $('#estadoIA').textContent = 'No es seguro el contenido: el texto es ilegible, no corresponde a un acta o hay varios registros mezclados. No guardaremos datos automáticos; revisa la imagen y completa los campos manualmente o pasa a la siguiente.';
      $('#estadoIA').classList.add('estado-inseguro');
      aviso('No es seguro el contenido. Revisa la imagen antes de guardar.', 'error');
    }
  } catch (fallo) {
    $('#estadoIA').textContent = 'No se pudo verificar el contenido. No es seguro usar datos automáticos; revisa la imagen y completa los campos manualmente o pasa a la siguiente.';
    $('#estadoIA').classList.add('estado-inseguro');
    aviso(fallo.message, 'error');
  } finally {
    v.classList.remove('analizando');
  }
};

const procesar = async (archivo) => {
  if (!permitidos.includes(archivo.type)) return aviso('Usa un archivo JPG, PNG o PDF', 'error');
  if (archivo.size > 15 * 1024 * 1024) return aviso('El archivo supera los 15 MB', 'error');
  detenerCamara();
  e.ruta = null;
  e.confianza = null;
  llenar();
  if (e.urlRecorte) URL.revokeObjectURL(e.urlRecorte);
  e.urlRecorte = null;
  e.imagenRecorte = null;
  e.archivoOriginal = null;
  e.puntosRecorte = null;
  e.interaccionRecorte = null;
  if (archivo.type === 'application/pdf') return analizarArchivo(archivo);
  mostrarEditorRecorte(archivo);
};

const procesarSeleccion = (archivos) => {
  const seleccion = [...archivos];
  if (!seleccion.length) return;
  const validos = seleccion.filter((archivo) => {
    if (!permitidos.includes(archivo.type)) {
      aviso(`${archivo.name}: usa JPG, PNG o PDF`, 'error');
      return false;
    }
    if (archivo.size > 15 * 1024 * 1024) {
      aviso(`${archivo.name}: el archivo supera los 15 MB`, 'error');
      return false;
    }
    return true;
  });
  if (!validos.length) return;
  const cantidadActual = validos.length + e.colaArchivos.length + (e.procesandoLote ? 1 : 0);
  if (cantidadActual > 10) return aviso('Puedes procesar hasta 10 imágenes por lote', 'error');
  if (e.procesandoLote) {
    e.colaArchivos.push(...validos);
    aviso(`${validos.length} ${validos.length === 1 ? 'imagen añadida' : 'imágenes añadidas'} a la cola`);
    return;
  }
  e.colaArchivos = validos;
  e.enLote = true;
  procesarSiguienteLote();
};

const procesarSiguienteLote = () => {
  const archivo = e.colaArchivos.shift();
  if (!archivo) {
    e.enLote = false;
    e.procesandoLote = false;
    $('#omitirImagen').hidden = true;
    return;
  }
  e.procesandoLote = true;
  $('#omitirImagen').hidden = false;
  $('#estadoIA').textContent = `Preparando ${archivo.name}. Quedan ${e.colaArchivos.length} ${e.colaArchivos.length === 1 ? 'imagen' : 'imágenes'} en la cola.`;
  procesar(archivo);
};

const confirmarRecorte = () => {
  if (!e.imagenRecorte || !e.puntosRecorte || e.puntosRecorte.length < 3) return;
  const boton = $('#confirmarRecorte');
  boton.disabled = true;
  const xs = e.puntosRecorte.map(([x]) => x);
  const ys = e.puntosRecorte.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  if (right <= x || bottom <= y) {
    boton.disabled = false;
    return aviso('Amplía la selección para que incluya un área de la imagen', 'error');
  }
  const sw = Math.max(1, Math.round((right - x) * e.imagenRecorte.naturalWidth));
  const sh = Math.max(1, Math.round((bottom - y) * e.imagenRecorte.naturalHeight));
  const sx = Math.round(x * e.imagenRecorte.naturalWidth);
  const sy = Math.round(y * e.imagenRecorte.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const contexto = canvas.getContext('2d');
  if (!contexto) {
    boton.disabled = false;
    return aviso('No se pudo preparar el recorte de la imagen', 'error');
  }
  contexto.fillStyle = '#fff';
  contexto.fillRect(0, 0, sw, sh);
  contexto.beginPath();
  e.puntosRecorte.forEach(([px, py], i) => {
    const cx = ((px - x) / (right - x)) * sw;
    const cy = ((py - y) / (bottom - y)) * sh;
    if (i === 0) contexto.moveTo(cx, cy);
    else contexto.lineTo(cx, cy);
  });
  contexto.closePath();
  contexto.clip();
  contexto.drawImage(e.imagenRecorte, sx, sy, sw, sh, 0, 0, sw, sh);
  canvas.toBlob((blob) => {
    boton.disabled = false;
    if (!blob) return aviso('No se pudo recortar la imagen', 'error');
    const nombre = e.archivoOriginal?.name.replace(/\.[^.]+$/, '') || 'acta';
    const recorte = new File([blob], `${nombre}-recorte.jpg`, { type: 'image/jpeg' });
    e.puntosRecorte = null;
    e.imagenRecorte = null;
    e.archivoOriginal = null;
    if (e.urlRecorte) URL.revokeObjectURL(e.urlRecorte);
    e.urlRecorte = null;
    $('#controlesRecorte').hidden = true;
    analizarArchivo(recorte);
  }, 'image/jpeg', 0.95);
};

const iniciarInteraccionRecorte = (ev) => {
  const lienzo = $('#lienzoRecorte');
  if (!lienzo || !e.puntosRecorte) return;
  ev.preventDefault();
  const limites = lienzo.getBoundingClientRect();
  const px = Math.max(0, Math.min(1, (ev.clientX - limites.left) / limites.width));
  const py = Math.max(0, Math.min(1, (ev.clientY - limites.top) / limites.height));
  const indice = Number(ev.target.closest('[data-punto]')?.dataset.punto);
  const esPunto = Number.isInteger(indice) && ev.target.closest('[data-punto]');
  let puntos = e.puntosRecorte;
  const distancia = (a, b) => Math.hypot((a[0] - b[0]) * limites.width, (a[1] - b[1]) * limites.height);
  let arista = -1;
  let distanciaArista = Infinity;
  puntos.forEach((punto, i) => {
    const siguiente = puntos[(i + 1) % puntos.length];
    const dx = siguiente[0] - punto[0];
    const dy = siguiente[1] - punto[1];
    const largo2 = dx * dx + dy * dy;
    const t = largo2 ? Math.max(0, Math.min(1, ((px - punto[0]) * dx + (py - punto[1]) * dy) / largo2)) : 0;
    const d = distancia([px, py], [punto[0] + t * dx, punto[1] + t * dy]);
    if (d < distanciaArista) {
      distanciaArista = d;
      arista = i;
    }
  });
  let modo = 'crear';
  let puntoActivo = null;
  if (esPunto) {
    modo = 'punto';
    puntoActivo = indice;
  } else if (distanciaArista < 0.035) {
    modo = 'punto';
    puntoActivo = arista + 1;
    puntos.splice(puntoActivo, 0, [px, py]);
  } else {
    const dentro = puntos.reduce((valor, punto, i) => {
      const siguiente = puntos[(i + 1) % puntos.length];
      const cruza = (punto[1] > py) !== (siguiente[1] > py)
        && px < ((siguiente[0] - punto[0]) * (py - punto[1])) / (siguiente[1] - punto[1]) + punto[0];
      return cruza ? !valor : valor;
    }, false);
    if (dentro) modo = 'mover';
    else {
      e.puntosRecorte = [[px, py], [px, py], [px, py], [px, py]];
      puntos = e.puntosRecorte;
      puntoActivo = 2;
      modo = 'crear';
    }
  }
  e.interaccionRecorte = {
    modo,
    puntoActivo,
    px,
    py,
    puntos: puntos.map((punto) => [...punto])
  };
  dibujarCajaRecorte();
  lienzo.setPointerCapture(ev.pointerId);
};

const actualizarInteraccionRecorte = (ev) => {
  if (!e.interaccionRecorte) return;
  const lienzo = $('#lienzoRecorte');
  const limites = lienzo.getBoundingClientRect();
  const px = Math.max(0, Math.min(1, (ev.clientX - limites.left) / limites.width));
  const py = Math.max(0, Math.min(1, (ev.clientY - limites.top) / limites.height));
  const inicio = e.interaccionRecorte;
  const dx = px - inicio.px;
  const dy = py - inicio.py;
  if (inicio.modo === 'punto') {
    e.puntosRecorte = inicio.puntos.map(([x, y], i) => i === inicio.puntoActivo ? [px, py] : [x, y]);
  } else if (inicio.modo === 'mover') {
    const minX = Math.min(...inicio.puntos.map(([x]) => x));
    const maxX = Math.max(...inicio.puntos.map(([x]) => x));
    const minY = Math.min(...inicio.puntos.map(([, y]) => y));
    const maxY = Math.max(...inicio.puntos.map(([, y]) => y));
    const moverX = Math.max(-minX, Math.min(1 - maxX, dx));
    const moverY = Math.max(-minY, Math.min(1 - maxY, dy));
    e.puntosRecorte = inicio.puntos.map(([x, y]) => [x + moverX, y + moverY]);
  } else {
    e.puntosRecorte[0] = [inicio.px, inicio.py];
    e.puntosRecorte[1] = [px, inicio.py];
    e.puntosRecorte[2] = [px, py];
    e.puntosRecorte[3] = [inicio.px, py];
  }
  dibujarCajaRecorte();
};

const terminarInteraccionRecorte = () => {
  e.interaccionRecorte = null;
};

const agregarPuntoRecorte = () => {
  if (!e.puntosRecorte) return;
  if (e.puntosRecorte.length >= 32) return aviso('La selección admite hasta 32 puntos', 'error');
  const lienzo = $('#lienzoRecorte');
  const limites = lienzo.getBoundingClientRect();
  const puntos = e.puntosRecorte;
  let mejorArista = 0;
  let mejorDistancia = -1;
  puntos.forEach((punto, i) => {
    const siguiente = puntos[(i + 1) % puntos.length];
    const dx = (siguiente[0] - punto[0]) * limites.width;
    const dy = (siguiente[1] - punto[1]) * limites.height;
    const distancia = dx * dx + dy * dy;
    if (distancia > mejorDistancia) {
      mejorDistancia = distancia;
      mejorArista = i;
    }
  });
  const siguiente = puntos[(mejorArista + 1) % puntos.length];
  puntos.splice(mejorArista + 1, 0, [(puntos[mejorArista][0] + siguiente[0]) / 2, (puntos[mejorArista][1] + siguiente[1]) / 2]);
  dibujarCajaRecorte();
};

const reiniciarPuntosRecorte = () => {
  if (!e.imagenRecorte) return;
  e.puntosRecorte = [[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98]];
  dibujarCajaRecorte();
};

const detectar = () => {
  const video = $('#video');
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w) return;
  const dw = 160;
  const dh = Math.round((dw * h) / w);
  const mini = detectar.mini || (detectar.mini = document.createElement('canvas'));
  mini.width = dw;
  mini.height = dh;
  const mctx = mini.getContext('2d', { willReadFrequently: true });
  mctx.drawImage(video, 0, 0, dw, dh);
  const px = mctx.getImageData(0, 0, dw, dh).data;
  const gris = new Float32Array(dw * dh);
  for (let i = 0; i < gris.length; i++) gris[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
  const col = new Float32Array(dw);
  const fil = new Float32Array(dh);
  for (let y = 1; y < dh - 1; y++) {
    for (let x = 1; x < dw - 1; x++) {
      const gx = gris[y * dw + x + 1] - gris[y * dw + x - 1];
      const gy = gris[(y + 1) * dw + x] - gris[(y - 1) * dw + x];
      if (Math.abs(gx) + Math.abs(gy) > 40) {
        col[x]++;
        fil[y]++;
      }
    }
  }
  const rango = (v, total, umbral) => {
    let a = v.findIndex((q) => q > umbral);
    let b = v.length - 1 - [...v].reverse().findIndex((q) => q > umbral);
    if (a < 0) a = 0;
    if (b >= v.length) b = v.length - 1;
    return [a / total, b / total];
  };
  const [x1, x2] = rango(col, dw, dh * 0.1);
  const [y1, y2] = rango(fil, dh, dw * 0.1);
  const area = (x2 - x1) * (y2 - y1);
  const objetivo = area > 0.25 && area < 0.97 ? { x1, y1, x2, y2 } : { x1: 0.06, y1: 0.06, x2: 0.94, y2: 0.94 };
  Object.keys(e.caja).forEach((k) => {
    e.caja[k] += (objetivo[k] - e.caja[k]) * 0.4;
  });
  dibujarGuia(w, h);
};

const dibujarGuia = (w, h) => {
  const guia = $('#guia');
  if (guia.width !== w) {
    guia.width = w;
    guia.height = h;
  }
  const g = guia.getContext('2d');
  const { x1, y1, x2, y2 } = e.caja;
  const X1 = x1 * w;
  const Y1 = y1 * h;
  const X2 = x2 * w;
  const Y2 = y2 * h;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(13,21,34,.45)';
  g.fillRect(0, 0, w, h);
  g.clearRect(X1, Y1, X2 - X1, Y2 - Y1);
  g.strokeStyle = '#e9cf85';
  g.lineWidth = Math.max(3, w / 400);
  const l = Math.min(X2 - X1, Y2 - Y1) * 0.12;
  g.beginPath();
  [[X1, Y1, 1, 1], [X2, Y1, -1, 1], [X1, Y2, 1, -1], [X2, Y2, -1, -1]].forEach(([x, y, dx, dy]) => {
    g.moveTo(x + dx * l, y);
    g.lineTo(x, y);
    g.lineTo(x, y + dy * l);
  });
  g.stroke();
};

const abrirCamara = async () => {
  try {
    e.flujo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
  } catch (fallo) {
    return aviso('No se pudo acceder a la cámara. Revisa los permisos del navegador', 'error');
  }
  const video = $('#video');
  video.srcObject = e.flujo;
  await video.play();
  $('#marco').style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
  $('#camara').hidden = false;
  clearInterval(e.reloj);
  e.reloj = setInterval(detectar, 300);
};

const capturar = () => {
  const video = $('#video');
  const w = video.videoWidth;
  const h = video.videoHeight;
  const { x1, y1, x2, y2 } = e.caja;
  const sx = x1 * w;
  const sy = y1 * h;
  const sw = (x2 - x1) * w;
  const sh = (y2 - y1) * h;
  const escala = Math.min(1, 2000 / sw);
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(sw * escala);
  lienzo.height = Math.round(sh * escala);
  lienzo.getContext('2d').drawImage(video, sx, sy, sw, sh, 0, 0, lienzo.width, lienzo.height);
  const marco = $('#marco');
  marco.classList.add('flash');
  setTimeout(() => marco.classList.remove('flash'), 350);
  lienzo.toBlob((blob) => {
    if (!blob) return aviso('No se pudo capturar la imagen', 'error');
    procesarSeleccion([new File([blob], `acta-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
  }, 'image/jpeg', 0.92);
};

const urlFirmada = async (ruta) => {
  if (e.urls.has(ruta)) return e.urls.get(ruta);
  const { data } = await e.cliente.storage.from('actas').createSignedUrl(ruta, 21600);
  if (data) e.urls.set(ruta, data.signedUrl);
  return data?.signedUrl;
};

const detenerTransferenciaMovil = () => {
  clearTimeout(e.mobileTimer);
  e.mobileTimer = null;
  const token = e.mobileToken;
  e.mobileToken = null;
  if (token) api(`/api/mobile/sessions/${token}`, { method: 'DELETE' }).catch((fallo) => console.error('No se pudo cerrar la sesión QR:', fallo.message));
};

const descargarFotosMovil = async (token, cantidad) => Promise.all(Array.from({ length: cantidad }, async (_, indice) => {
  const respuesta = await fetch(`/api/mobile/sessions/${token}/file/${indice}`, {
    headers: { Authorization: `Bearer ${e.sesion.access_token}` }
  });
  if (!respuesta.ok) {
    const fallo = await respuesta.json().catch(() => ({}));
    throw new Error(fallo.error || `No se pudo recibir la foto ${indice + 1} del celular`);
  }
  const blob = await respuesta.blob();
  const tipo = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return new File([blob], `acta-celular-${indice + 1}.${tipo === 'image/png' ? 'png' : 'jpg'}`, { type: tipo });
}));

const revisarTransferenciaMovil = async () => {
  const token = e.mobileToken;
  if (!token) return;
  try {
    const { estado, cantidad } = await api(`/api/mobile/sessions/${token}`);
    if (e.mobileToken !== token) return;
    if (estado === 'completado' && Number.isInteger(cantidad) && cantidad > 0) {
      if (cantidad > 10) throw new Error('La cantidad de fotos recibida supera el límite permitido.');
      $('#estadoQR').textContent = `Recibiendo ${cantidad} ${cantidad === 1 ? 'foto' : 'fotos'}...`;
      const archivos = await descargarFotosMovil(token, cantidad);
      $('#estadoQR').textContent = `${cantidad} fotos recibidas. Se analizarán por separado.`;
      aviso(`${cantidad} ${cantidad === 1 ? 'foto recibida' : 'fotos recibidas'} desde el celular`);
      detenerTransferenciaMovil();
      $('#dialogQR').close();
      procesarSeleccion(archivos);
      return;
    }
    if (estado === 'completado') {
      const respuesta = await fetch(`/api/mobile/sessions/${token}/file`, {
        headers: { Authorization: `Bearer ${e.sesion.access_token}` }
      });
      if (!respuesta.ok) {
        const fallo = await respuesta.json().catch(() => ({}));
        throw new Error(fallo.error || 'No se pudo recibir la foto del celular');
      }
      const blob = await respuesta.blob();
      const tipo = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const archivo = new File([blob], `acta-celular.${tipo === 'image/png' ? 'png' : 'jpg'}`, { type: tipo });
      $('#estadoQR').textContent = 'Foto recibida. Selecciona la parte que quieres utilizar.';
      aviso('Foto recibida desde el celular');
      detenerTransferenciaMovil();
      $('#dialogQR').close();
      procesar(archivo);
      return;
    }
    $('#estadoQR').textContent = estado === 'procesando'
      ? 'Foto recibida; procesando...'
      : 'Esperando que envíes la foto desde el celular...';
    e.mobileTimer = setTimeout(revisarTransferenciaMovil, 1800);
  } catch (fallo) {
    $('#estadoQR').textContent = fallo.message;
    detenerTransferenciaMovil();
    aviso(fallo.message, 'error');
  }
};

const abrirTransferenciaMovil = async () => {
  try {
    detenerTransferenciaMovil();
    const { token, qr } = await api('/api/mobile/sessions', { method: 'POST', json: {} });
    e.mobileToken = token;
    $('#codigoQR').src = qr;
    $('#estadoQR').textContent = 'Esperando que envíes la foto desde el celular...';
    $('#dialogQR').showModal();
    revisarTransferenciaMovil();
  } catch (fallo) {
    aviso(fallo.message, 'error');
  }
};

const coincide = (a) => {
  const q = e.filtro.trim().toLowerCase();
  return !q || [a.nombre, a.padre, a.madre, a.libro, a.folio, a.partida].some((v) => (v || '').toLowerCase().includes(q));
};

const pintarDashboard = () => {
  const ahora = new Date();
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1);
  const haceTreintaDias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fechas = [...e.actas.values()]
    .map((acta) => acta.created_at ? new Date(acta.created_at) : null)
    .filter(Boolean)
    .filter((fechaCreacion) => !Number.isNaN(fechaCreacion.getTime()));
  const esteAnio = fechas.filter((fechaCreacion) => fechaCreacion >= inicioAnio && fechaCreacion <= ahora).length;
  const ultimosTreinta = fechas.filter((fechaCreacion) => fechaCreacion >= haceTreintaDias && fechaCreacion <= ahora).length;
  const rolEditor = puedeEditar();

  $('#dashboardTitulo').textContent = `Bienvenido${e.sesion?.user?.user_metadata?.name ? `, ${e.sesion.user.user_metadata.name}` : ''}`;
  $('#dashboardDescripcion').textContent = rolEditor
    ? 'Digitaliza nuevas actas y mantén el registro organizado y al día.'
    : 'Consulta las actas de la parroquia y encuentra un registro rápidamente.';
  $('#dashboardRol').textContent = roles[e.rol] || 'Lector';
  $('#dashboardAccion').textContent = rolEditor ? 'Digitalizar una nueva acta' : 'Explorar registros';

  const estadisticas = [
    { etiqueta: 'Actas en el registro', valor: e.actas.size, detalle: 'Total disponible para consulta' },
    { etiqueta: 'Registradas este año', valor: esteAnio, detalle: ahora.getFullYear().toString() },
    { etiqueta: 'Últimos 30 días', valor: ultimosTreinta, detalle: 'Actividad reciente' }
  ];
  $('#dashboardEstadisticas').innerHTML = estadisticas.map((dato) => `<article class="estadistica"><span class="estadistica-etiqueta">${dato.etiqueta}</span><strong class="estadistica-valor">${dato.valor.toLocaleString('es')}</strong><span class="estadistica-detalle">${dato.detalle}</span></article>`).join('');

  const meses = Array.from({ length: 6 }, (_, indice) => new Date(ahora.getFullYear(), ahora.getMonth() - 5 + indice, 1));
  const conteos = meses.map((mes) => fechas.filter((fechaCreacion) =>
    fechaCreacion.getFullYear() === mes.getFullYear() && fechaCreacion.getMonth() === mes.getMonth()
  ).length);
  const maximo = Math.max(1, ...conteos);
  const formatoMes = new Intl.DateTimeFormat('es', { month: 'short' });
  const etiquetas = meses.map((mes) => formatoMes.format(mes).replace('.', ''));
  const grafico = $('#graficoActividad');
  grafico.innerHTML = '';
  grafico.setAttribute('aria-label', `Actas registradas en los últimos seis meses: ${conteos.map((cantidad, indice) => `${etiquetas[indice]} ${cantidad}`).join(', ')}`);
  meses.forEach((mes, indice) => {
    const columna = document.createElement('div');
    columna.className = `actividad-mes${indice === meses.length - 1 ? ' actual' : ''}`;
    const cantidad = document.createElement('span');
    cantidad.className = 'actividad-cantidad';
    cantidad.textContent = conteos[indice].toLocaleString('es');
    const area = document.createElement('div');
    area.className = 'actividad-columna';
    const barra = document.createElement('span');
    barra.className = 'actividad-barra';
    barra.style.height = `${Math.max(5, (conteos[indice] / maximo) * 100)}%`;
    barra.title = `${etiquetas[indice]}: ${conteos[indice]} ${conteos[indice] === 1 ? 'acta' : 'actas'}`;
    area.append(barra);
    const etiqueta = document.createElement('span');
    etiqueta.className = 'actividad-etiqueta';
    etiqueta.textContent = etiquetas[indice];
    columna.append(cantidad, area, etiqueta);
    grafico.append(columna);
  });
  const totalPeriodo = conteos.reduce((suma, cantidad) => suma + cantidad, 0);
  $('#resumenActividad').textContent = `${totalPeriodo.toLocaleString('es')} ${totalPeriodo === 1 ? 'acta nueva' : 'actas nuevas'}`;
  const anioInicial = meses[0].getFullYear();
  const anioFinal = meses[meses.length - 1].getFullYear();
  $('#periodoActividad').textContent = `${etiquetas[0]} ${anioInicial} – ${etiquetas[etiquetas.length - 1]} ${anioFinal}`;
};

const tarjeta = (a) => {
  const pdf = (a.imagen_path || '').endsWith('.pdf');
  const url = e.urls.get(a.imagen_path);
  const media = !a.imagen_path
    ? '<div class="sin">Sin imagen</div>'
    : pdf
      ? '<div class="sin">Documento PDF</div>'
      : `<img alt="Acta de ${esc(a.nombre)}" data-ruta="${esc(a.imagen_path)}"${url ? ` src="${esc(url)}"` : ''}>`;
  const sello = a.confianza != null ? `<span class="sello">IA ${Math.round(a.confianza * 100)} %</span>` : '';
  const registro = [a.libro && `Libro ${a.libro}`, a.folio && `Folio ${a.folio}`, a.partida && `Partida ${a.partida}`].filter(Boolean).join(', ') || '—';
  return `<article class="tarjeta" data-id="${esc(a.id)}">
    <button class="miniatura" data-acc="ver" aria-label="Ver acta de ${esc(a.nombre)}">${media}${sello}</button>
    <div class="cuerpo">
      <h3>${esc(a.nombre)}</h3>
      <dl><dt>Nació</dt><dd>${esc(fecha(a.fecha_nacimiento))}</dd><dt>Padres</dt><dd>${esc([a.padre, a.madre].filter(Boolean).join(' y ') || '—')}</dd><dt>Bautizo</dt><dd>${esc(fecha(a.fecha_bautizo))}</dd><dt>Registro</dt><dd>${esc(registro)}</dd></dl>
      <div class="acciones">
        <button class="secundario" data-acc="ver">Ver</button>
        ${puedeEditar() ? '<button class="secundario" data-acc="editar">Editar</button>' : ''}
        ${e.rol === 'admin' ? '<button class="secundario peligro" data-acc="borrar">Eliminar</button>' : ''}
      </div>
    </div>
  </article>`;
};

const cargarMiniatura = async (img) => {
  if (img.getAttribute('src')) return;
  const url = await urlFirmada(img.dataset.ruta);
  if (url) img.src = url;
};

const pintar = (nuevaId) => {
  pintarDashboard();
  const lista = [...e.actas.values()].filter(coincide).sort((a, b) => b.created_at.localeCompare(a.created_at));
  $('#contador').textContent = `${lista.length} ${lista.length === 1 ? 'acta' : 'actas'}`;
  const vacio = e.actas.size
    ? 'Ninguna acta coincide con la búsqueda.'
    : puedeEditar() ? 'Aún no hay actas registradas. Escanea la primera con la cámara o elige un archivo.' : 'Aún no hay actas registradas.';
  $('#rejilla').innerHTML = lista.length ? lista.map(tarjeta).join('') : `<p class="vacio">${vacio}</p>`;
  $$('#rejilla img[data-ruta]').forEach(cargarMiniatura);
  if (nuevaId) $(`.tarjeta[data-id="${nuevaId}"]`)?.classList.add('nueva');
};

const abrirVisor = async (id) => {
  const a = e.actas.get(id);
  const url = a.imagen_path ? await urlFirmada(a.imagen_path) : null;
  const pdf = (a.imagen_path || '').endsWith('.pdf');
  $('#visorMedia').innerHTML = !url ? '<div class="sin">Sin imagen</div>' : pdf ? `<iframe src="${esc(url)}" title="Acta de ${esc(a.nombre)}"></iframe>` : `<img src="${esc(url)}" alt="Acta de ${esc(a.nombre)}">`;
  $('#visorDatos').innerHTML = `<h2>${esc(a.nombre)}</h2><dl>${campos.slice(1).map(([n, t, tipo]) => `<div><dt>${t}</dt><dd>${esc(tipo === 'date' ? fecha(a[n]) : a[n] || '—')}</dd></div>`).join('')}</dl>`;
  $('#visor').showModal();
};

const editar = (a) => {
  reiniciar();
  e.editando = a.id;
  llenar(a);
  $('#tituloForm').textContent = 'Editar acta';
  $('#cancelar').hidden = false;
  $('#captura').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const alRecibir = (p) => {
  if (p.eventType === 'DELETE') {
    e.actas.delete(p.old.id);
    return pintar();
  }
  const fila = p.new;
  e.actas.set(fila.id, fila);
  const esNueva = p.eventType === 'INSERT';
  if (esNueva && fila.creado_por !== e.activo) aviso(`Nueva acta registrada: ${fila.nombre}`, 'nuevo');
  pintar(esNueva ? fila.id : null);
};

const suscribir = () => {
  e.canal = e.cliente.channel('actas-en-vivo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'actas' }, alRecibir)
    .subscribe((estado) => {
      const vivo = estado === 'SUBSCRIBED';
      $('#punto').classList.toggle('vivo', vivo);
      $('#conexion').textContent = vivo ? 'En vivo' : 'Reconectando';
    });
};

const entrar = async () => {
  const { data: perfil } = await e.cliente.from('perfiles').select('nombre,rol').eq('id', e.sesion.user.id).single();
  e.rol = perfil?.rol || 'lector';
  $('#usuario').textContent = perfil?.nombre || e.sesion.user.email;
  $('#rol').textContent = roles[e.rol];
  $('#gestionarRoles').hidden = e.rol !== 'admin';
  $('#activarAdmin').hidden = !e.adminSetupEnabled || e.rol === 'admin';
  $('#acceso').hidden = true;
  $('#app').hidden = false;
  document.body.classList.add('dentro');
  $('#captura').hidden = !puedeEditar();
  $('#contenido').classList.toggle('solo-lectura', !puedeEditar());
  const { data: filas, error } = await e.cliente.from('actas').select('*').order('created_at', { ascending: false });
  if (error) aviso('No se pudieron cargar las actas', 'error');
  e.actas = new Map((filas || []).map((a) => [a.id, a]));
  pintar();
  suscribir();
};

const salir = () => {
  if (e.canal) e.cliente.removeChannel(e.canal);
  e.canal = null;
  e.actas.clear();
  e.urls.clear();
  reiniciar();
  $('#app').hidden = true;
  $('#acceso').hidden = false;
  document.body.classList.remove('dentro');
};

const eventos = () => {
  let esperandoCodigoRegistro = false;
  let correoPendiente = '';

  const mostrarCodigoRegistro = (correo) => {
    esperandoCodigoRegistro = true;
    correoPendiente = correo;
    $('#datosRegistro').hidden = true;
    $('#ayudaCodigoCuenta').textContent = `Escribe el código de 6 dígitos que enviamos a ${correo}.`;
    $('#ayudaCodigoCuenta').hidden = false;
    $('#campoCodigoCuenta').hidden = false;
    $('#codigoCuenta').required = true;
    $('#enviarRegistro').textContent = 'Verificar código';
    $('#reenviarCodigoCuenta').hidden = false;
    $('#volverRegistro').hidden = false;
    $('#preguntaCuenta').hidden = true;
    $('#modoAccesoRegistro').hidden = true;
    $('#codigoCuenta').focus({ preventScroll: true });
  };

  const volverADatosRegistro = () => {
    esperandoCodigoRegistro = false;
    correoPendiente = '';
    $('#datosRegistro').hidden = false;
    $('#ayudaCodigoCuenta').hidden = true;
    $('#campoCodigoCuenta').hidden = true;
    $('#codigoCuenta').required = false;
    $('#codigoCuenta').value = '';
    $('#enviarRegistro').textContent = 'Registrarme';
    $('#reenviarCodigoCuenta').hidden = true;
    $('#volverRegistro').hidden = true;
    $('#preguntaCuenta').hidden = false;
    $('#modoAccesoRegistro').hidden = false;
  };

  const cambiarModoAcceso = (modo) => {
    const creando = modo === 'crear';
    if (!creando) volverADatosRegistro();
    const tarjeta = $('#tarjetaAcceso');
    const inicio = $('#formAcceso');
    const registro = $('#formRegistro');
    tarjeta.classList.toggle('creando', creando);
    inicio.inert = creando;
    inicio.setAttribute('aria-hidden', String(creando));
    registro.inert = !creando;
    registro.setAttribute('aria-hidden', String(!creando));
    (creando ? $('#nombreCuenta') : $('#correo')).focus({ preventScroll: true });
  };

  $$('[data-modo]').forEach((boton) => {
    boton.addEventListener('click', () => cambiarModoAcceso(boton.dataset.modo));
  });

  $('#formAcceso').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const { error } = await e.cliente.auth.signInWithPassword({ email: $('#correo').value, password: $('#clave').value });
      if (error) aviso(error.message, 'error');
    } catch (fallo) {
      aviso(`No se pudo iniciar sesión: ${fallo.message}`, 'error');
    }
  });

  $('#confirmarClave').addEventListener('input', () => $('#confirmarClave').setCustomValidity(''));
  $('#formRegistro').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (esperandoCodigoRegistro) {
      try {
        const { error } = await e.cliente.auth.verifyOtp({
          email: correoPendiente,
          token: $('#codigoCuenta').value.trim(),
          type: 'signup'
        });
        if (error) return aviso(error.message, 'error');
        aviso('Correo verificado. Tu cuenta está lista.');
      } catch (fallo) {
        aviso(`No se pudo verificar el código: ${fallo.message}`, 'error');
      }
      return;
    }

    const clave = $('#claveCuenta').value;
    const confirmar = $('#confirmarClave');
    if (clave !== confirmar.value) {
      confirmar.setCustomValidity('Las contraseñas no coinciden.');
      confirmar.reportValidity();
      return;
    }
    try {
      const { data, error } = await e.cliente.auth.signUp({
        email: $('#correoCuenta').value,
        password: clave,
        options: { data: { nombre: $('#nombreCuenta').value.trim() } }
      });
      if (error) return aviso(error.message, 'error');
      if (data.session) {
        aviso('Cuenta creada');
        return;
      }
      if (!data.user) throw new Error('Supabase no devolvió la cuenta creada. Inténtalo de nuevo.');
      if (data.user.identities?.length === 0) {
        const correo = $('#correoCuenta').value.trim();
        const { error: resendError } = await e.cliente.auth.resend({ type: 'signup', email: correo });
        if (resendError) throw resendError;
        mostrarCodigoRegistro(correo);
        return aviso('Ese correo ya tiene una cuenta pendiente. Te enviamos otro código para verificarla.');
      }
      mostrarCodigoRegistro($('#correoCuenta').value.trim());
      aviso('Te enviamos un código de un solo uso por correo.');
    } catch (fallo) {
      aviso(`No se pudo crear la cuenta: ${fallo.message}`, 'error');
    }
  });

  $('#reenviarCodigoCuenta').addEventListener('click', async () => {
    const boton = $('#reenviarCodigoCuenta');
    boton.disabled = true;
    try {
      const { error } = await e.cliente.auth.resend({ type: 'signup', email: correoPendiente });
      if (error) throw error;
      aviso('Enviamos otro código de un solo uso.');
    } catch (fallo) {
      aviso(`No se pudo reenviar el código: ${fallo.message}`, 'error');
    } finally {
      boton.disabled = false;
    }
  });

  $('#volverRegistro').addEventListener('click', volverADatosRegistro);

  $('#salir').addEventListener('click', () => e.cliente.auth.signOut());
  $('#dashboardAccion').addEventListener('click', () => {
    if (puedeEditar()) {
      $('#archivo').value = '';
      $('#archivo').click();
    } else {
      $('#buscar').focus();
      $('.registro').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  $('#enviarDesdeCelular').addEventListener('click', abrirTransferenciaMovil);
  $('#cerrarQR').addEventListener('click', () => $('#dialogQR').close());
  $('#dialogQR').addEventListener('close', detenerTransferenciaMovil);
  $('#activarAdmin').addEventListener('click', () => $('#dialogAdmin').showModal());
  $('#cerrarAdmin').addEventListener('click', () => $('#dialogAdmin').close());
  $('#gestionarRoles').addEventListener('click', () => $('#dialogRoles').showModal());
  $('#cerrarRoles').addEventListener('click', () => $('#dialogRoles').close());
  $('#formRoles').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const boton = $('#guardarRol');
    boton.disabled = true;
    try {
      const resultado = await api('/api/admin/users/role', {
        method: 'POST',
        json: { email: $('#correoRol').value, role: $('#nuevoRol').value }
      });
      $('#dialogRoles').close();
      ev.target.reset();
      aviso(`Rol actualizado para ${resultado.email}: ${roles[resultado.role]}`);
    } catch (fallo) {
      aviso(fallo.message, 'error');
    } finally {
      boton.disabled = false;
    }
  });
  $('#formAdmin').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const boton = $('#confirmarAdmin');
    boton.disabled = true;
    try {
      await api('/api/admin/claim', { method: 'POST', json: { code: $('#codigoAdmin').value } });
      e.rol = 'admin';
      $('#rol').textContent = roles.admin;
      $('#gestionarRoles').hidden = false;
      $('#activarAdmin').hidden = true;
      $('#captura').hidden = false;
      $('#contenido').classList.remove('solo-lectura');
      $('#dialogAdmin').close();
      ev.target.reset();
      pintar();
      aviso('Ahora tienes el rol de administrador');
    } catch (fallo) {
      aviso(fallo.message, 'error');
    } finally {
      boton.disabled = false;
    }
  });
  $('#abrirCamara').addEventListener('click', abrirCamara);
  $('#cerrarCamara').addEventListener('click', detenerCamara);
  $('#capturar').addEventListener('click', capturar);
  $('#elegir').addEventListener('click', () => {
    $('#archivo').value = '';
    $('#archivo').click();
  });
  $('#archivo').addEventListener('change', (ev) => procesarSeleccion(ev.target.files));
  $('#vista').addEventListener('pointerdown', iniciarInteraccionRecorte);
  $('#vista').addEventListener('pointermove', actualizarInteraccionRecorte);
  $('#vista').addEventListener('pointerup', terminarInteraccionRecorte);
  $('#vista').addEventListener('pointercancel', terminarInteraccionRecorte);
  $('#confirmarRecorte').addEventListener('click', confirmarRecorte);
  $('#agregarPuntoRecorte').addEventListener('click', agregarPuntoRecorte);
  $('#reiniciarPuntosRecorte').addEventListener('click', reiniciarPuntosRecorte);
  $('#otraImagen').addEventListener('click', () => {
    $('#archivo').value = '';
    $('#archivo').click();
  });
  $('#omitirImagen').addEventListener('click', () => {
    const pendientes = e.colaArchivos;
    const continuar = e.enLote;
    reiniciar();
    if (continuar && pendientes.length) {
      e.colaArchivos = pendientes;
      e.enLote = true;
      procesarSiguienteLote();
    } else {
      aviso('Imagen omitida');
    }
  });
  $('#cancelar').addEventListener('click', reiniciar);
  $('#cerrarVisor').addEventListener('click', () => $('#visor').close());
  $('#visor').addEventListener('click', (ev) => ev.target === $('#visor') && $('#visor').close());
  $('#buscar').addEventListener('input', (ev) => {
    e.filtro = ev.target.value;
    pintar();
  });

  const panel = $('#captura');
  ['dragenter', 'dragover'].forEach((n) => panel.addEventListener(n, (ev) => {
    ev.preventDefault();
    panel.classList.add('arrastre');
  }));
  ['dragleave', 'drop'].forEach((n) => panel.addEventListener(n, (ev) => {
    ev.preventDefault();
    panel.classList.remove('arrastre');
  }));
  panel.addEventListener('drop', (ev) => procesarSeleccion(ev.dataTransfer.files));

  $('#formulario').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const cuerpo = Object.fromEntries(new FormData(ev.target));
    if (!cuerpo.nombre.trim()) return aviso('Escribe el nombre del inscrito', 'error');
    if (e.ruta) cuerpo.imagen_path = e.ruta;
    if (e.confianza != null) cuerpo.confianza = e.confianza;
    const edicion = Boolean(e.editando);
    try {
      const fila = await api(edicion ? `/api/actas/${e.editando}` : '/api/actas', { method: edicion ? 'PATCH' : 'POST', json: cuerpo });
      e.actas.set(fila.id, fila);
      pintar(edicion ? null : fila.id);
      aviso(edicion ? 'Acta actualizada' : 'Acta guardada');
      const pendientes = e.colaArchivos;
      const continuarLote = e.enLote;
      reiniciar();
      if (continuarLote && pendientes.length) {
        e.colaArchivos = pendientes;
        e.enLote = true;
        procesarSiguienteLote();
      }
    } catch (fallo) {
      aviso(fallo.message, 'error');
    }
  });

  $('#rejilla').addEventListener('click', async (ev) => {
    const boton = ev.target.closest('[data-acc]');
    if (!boton) return;
    const id = boton.closest('.tarjeta').dataset.id;
    const acta = e.actas.get(id);
    if (boton.dataset.acc === 'ver') return abrirVisor(id);
    if (boton.dataset.acc === 'editar') return editar(acta);
    if (boton.dataset.acc === 'borrar' && confirm(`¿Eliminar el acta de ${acta.nombre}? Esta acción no se puede deshacer.`)) {
      try {
        await api(`/api/actas/${id}`, { method: 'DELETE' });
        e.actas.delete(id);
        pintar();
        aviso('Acta eliminada');
      } catch (fallo) {
        aviso(fallo.message, 'error');
      }
    }
  });
};

const iniciar = async () => {
  escena3D();
  construirFormulario();
  eventos();
  try {
    const respuesta = await fetch('/api/config');
    const tipo = respuesta.headers.get('content-type') || '';
    if (!tipo.includes('application/json')) {
      throw new Error('Estás abriendo la página con Live Server, que no ejecuta la API. En la carpeta del proyecto ejecuta "npm install" y luego "npm start"; después abre http://localhost:3000.');
    }
    const config = await respuesta.json();
    if (!respuesta.ok) throw new Error(config.error || 'No se pudo cargar la configuración de Supabase');
    if (!config.url || !config.anonKey) throw new Error('Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en .env');
    e.adminSetupEnabled = Boolean(config.adminSetupEnabled);
    e.cliente = window.supabase.createClient(config.url, config.anonKey);
    e.cliente.auth.onAuthStateChange((evento, sesion) => {
      e.sesion = sesion;
      setTimeout(() => {
        if (sesion && e.activo !== sesion.user.id) {
          e.activo = sesion.user.id;
          entrar();
        }
        if (!sesion && e.activo) {
          e.activo = null;
          salir();
        }
      });
    });
  } catch (fallo) {
    aviso(`No se pudo conectar con Supabase: ${fallo.message}`, 'error');
  }
};

iniciar();
