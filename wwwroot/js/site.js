
(function(){
  const datos = window.__NODOS__ || [];
  const rootEl = document.getElementById('orgchart');
  const buscador = document.getElementById('buscador');

  // Mapa de colores por área
  const areaColor = (area) => {
    const a = (area || '').toLowerCase();
    if (a.includes('base de datos')) return getVar('--area-bd');
    if (a.includes('desarrollo'))     return getVar('--area-dev');
    if (a === 't')                    return getVar('--area-t');
    if (a.includes('infra'))          return getVar('--area-infra');
    if (a.includes('operaciones'))    return getVar('--area-ops');
    // TI o default
    return getVar('--area-ti');
  };

  function getVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Indexar por id y armar hijos
  const porId = new Map(datos.map(d => [d.id, {...d, hijos: []}]));
  let raiz = null;
  porId.forEach(node => {
    if (node.jefeId == null) { raiz = node; }
    else {
      const jefe = porId.get(node.jefeId);
      if (jefe) jefe.hijos.push(node);
    }
  });

  // Aux: agrupar por área
  function groupByArea(nodes){
    const map = new Map();
    for (const n of nodes){
      const key = (n.area || '').trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(n);
    }
    return map;
  }

  // Clase por área (para borde superior del grupo)
  const areaClassMap = {
    'TI': 'area-ti',
    'Base de datos': 'area-bd',
    'Desarrollo': 'area-dev',
    'T': 'area-t',
    'Infraestructura': 'area-infra',
    'Operaciones': 'area-ops'
  };
  const areaClass = (areaName) => areaClassMap[areaName] || '';

  // Auto-compactación: si el contenedor overflowea, reduce las cards por niveles 1..3
  function autoCompactChildren(childrenEl){
    const maxLevel = 3;
    let level = 0;
    childrenEl.dataset.compactLevel = '0';
    // Medir y compactar hasta que quepa o alcanzamos el mínimo
    while (level < maxLevel && childrenEl.scrollWidth > childrenEl.clientWidth){
      level++;
      childrenEl.dataset.compactLevel = String(level);
    }
  }

  // Render recursivo de un nodo
  function renderNodo(node){
    const card = document.createElement('div');
    card.className = 'node';
    card.dataset.id = node.id;

    const strip = document.createElement('div');
    strip.className = 'area-strip';
    strip.style.background = areaColor(node.area);

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'avatar-wrap';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    const foto = (node.foto || '').trim();
    if (foto) avatar.style.backgroundImage = `url("${foto}")`;
    else avatar.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(placeholderSVG(node.nombre))}")`;
    avatarWrap.appendChild(avatar);

    const nombre = el('div','nombre', node.nombre);
    const puesto = el('div','puesto', node.puesto);
    const area   = el('div','area',   `Área: ${node.area}`);
    const email  = el('div','email',  node.email);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const btnInfo = document.createElement('button');
    btnInfo.className = 'btn';
    btnInfo.textContent = 'Ver detalle';
    btnInfo.addEventListener('click', () => abrirModal(node));
    actions.appendChild(btnInfo);

    card.append(strip, avatarWrap, nombre, puesto, area, email, actions);

    // Toggle hijos
    if (node.hijos && node.hijos.length){
      const toggle = document.createElement('div');
      toggle.className = 'toggle';
      toggle.textContent = `Mostrar ${node.hijos.length} subordinado(s)`;
      let abierto = false;

      const hijosBox = document.createElement('div');
      hijosBox.className = 'children';
      hijosBox.style.display = 'none';

      // Agrupar por área
      const grupos = groupByArea(node.hijos);
      for (const [areaName, nodesOfArea] of grupos.entries()){
        const groupEl = document.createElement('div');
        groupEl.className = `area-group ${areaClass(areaName)}`;

        // (opcional) título del grupo
        const title = document.createElement('div');
        title.className = 'area-group-title';
        title.textContent = areaName;
        groupEl.appendChild(title);

        // Fila de tarjetas del grupo
        const row = document.createElement('div');
        row.className = 'cards-row';

        // Si el JEFE actual es de área "T" y estos hijos son "Subdirector",
        // fuerza 3 columnas horizontales (se mantiene compacto con auto-compactación global).
        const jefeEsT = (node.area || '').trim() === 'T';
        const hijosSonSubdirectores = nodesOfArea.every(n => (n.puesto || '').toLowerCase().includes('subdirector'));
        if (jefeEsT && hijosSonSubdirectores){
          groupEl.classList.add('area-subdir-group');
        }

        for (const h of nodesOfArea){
          row.appendChild(renderNodo(h));
        }

        groupEl.appendChild(row);
        hijosBox.appendChild(groupEl);
      }

      toggle.addEventListener('click', () => {
        abierto = !abierto;
        hijosBox.style.display = abierto ? '' : 'none';
        toggle.textContent = (abierto ? 'Ocultar' : 'Mostrar') + ` ${node.hijos.length} subordinado(s)`;

        // ⚙️ Cuando se abre, ajustar tamaños si hay muchas áreas en el nivel
        if (abierto){
          // esperar a que el layout se pinte antes de medir
          requestAnimationFrame(() => autoCompactChildren(hijosBox));
        }
      });

      card.appendChild(toggle);
      card.appendChild(hijosBox);
    }

    return card;
  }

  function renderTree(){
    rootEl.innerHTML = '';
    if (!raiz){
      rootEl.textContent = 'No hay datos para mostrar.';
      return;
    }
    const rootBranch = document.createElement('div');
    rootBranch.className = 'branch';
    rootBranch.appendChild(renderNodo(raiz));
    rootEl.appendChild(rootBranch);

    // Si el primer nivel lo deseas abierto por defecto, puedes abrir y compactar:
    // const firstToggle = rootEl.querySelector('.toggle');
    // firstToggle?.click();
  }

  // Re-compactar en resize (solo contenedores visibles)
  window.addEventListener('resize', () => {
    document.querySelectorAll('.children').forEach(el => {
      if (el.style.display !== 'none') autoCompactChildren(el);
    });
  });

  // Búsqueda (resalta coincidencias)
  buscador?.addEventListener('input', (e) => {
    const q = (e.target.value || '').trim().toLowerCase();
    if (!q){
      document.querySelectorAll('.node').forEach(n => n.style.outline = '');
      return;
    }
    document.querySelectorAll('.node').forEach(n => {
      const id = Number(n.dataset.id);
      const d = porId.get(id);
      const texto = [d?.nombre, d?.puesto, d?.area].join(' ').toLowerCase();
      n.style.outline = texto.includes(q) ? `2px solid ${getVar('--accent')}` : '';
    });
  });

  // Modal
  const dialog = document.getElementById('detalleModal');
  const modalNombre = document.getElementById('modalNombre');
  const modalPuesto = document.getElementById('modalPuesto');
  const modalArea   = document.getElementById('modalArea');
  const modalEmail  = document.getElementById('modalEmail');
  const modalAvatar = document.getElementById('modalAvatar');

  function abrirModal(node){
    modalNombre.textContent = node.nombre;
    modalPuesto.textContent = node.puesto;
    modalArea.textContent   = node.area;
    modalEmail.textContent  = node.email;
    const foto = (node.foto || '').trim();
    if (foto) modalAvatar.style.backgroundImage = `url("${foto}")`;
    else modalAvatar.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(placeholderSVG(node.nombre))}")`;
    dialog.showModal();
  }

  // Utilidad: SVG placeholder con iniciales
  function placeholderSVG(nombre = ''){
    const initials = nombre.split(' ')
      .filter(Boolean)
      .map(s => s[0]?.toUpperCase())
      .slice(0,2)
      .join('');
    const bg = '#22242a';
    const fg = '#e9eaee';
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
        <rect width="100%" height="100%" fill="${bg}"/>
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
              font-family="Segoe UI, -apple-system, system-ui" font-size="32" fill="${fg}">${initials}</text>
      </svg>
    `;
  }

  function el(tag, cls, text){
       const d = document.createElement(tag);
    d.className = cls;
    d.textContent = text;
    return d;
  }

  // Inicializar
  renderTree();

})();
