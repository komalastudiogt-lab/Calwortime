(function () {
  'use strict';




  var $ = function (id) { return document.getElementById(id); };
  var K = { p: 'calwortime_perfil', s: 'calwortime_turnos' };

  function load(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; }
    catch (e) { return d; }
  }
  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { toast('No se pudo guardar'); }
  }

  var P = Object.assign({ nombre: '', moneda: 'Q', tarifa: 0, festivo: 100 }, load(K.p, {}));
  var S = load(K.s, []);
  if (!Array.isArray(S)) S = [];
  var editId = null, timeTarget = null, onYes = null, chart = null;

  var pad = function (n) { return String(n).padStart(2, '0'); };
  var esc = function (t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function ic(n) { return '<svg class="ic"><use href="#i-' + n + '"/></svg>'; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function money(n) { return P.moneda + ' ' + n.toFixed(2); }
  function toast(m) {
    var t = $('toast');
    t.textContent = m;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------- Cálculo: cruza medianoche, pausas y recargo festivo ---------- */
  function calc(s) {
    var a = new Date(s.date + 'T' + s.start);
    var b = new Date(s.date + 'T' + s.end);
    if (b <= a) b = new Date(b.getTime() + 864e5);
    var total = (b - a) / 6e4;
    var mid = new Date(a); mid.setHours(24, 0, 0, 0);
    var f = 0;
    if (s.fest === 'all') f = total;
    else if (s.fest === 'start') f = Math.min(total, (mid - a) / 6e4);
    else if (s.fest === 'end') f = Math.max(0, (b - mid) / 6e4);
    var net = Math.max(0, total - (+s.pause || 0));
    f = Math.min(f, net);
    var h = net / 60, fh = f / 60;
    return { h: h, fh: fh, pay: h * P.tarifa + fh * P.tarifa * P.festivo / 100 };
  }
  function sorted() {
    return S.slice().sort(function (x, y) { return (y.date + y.start).localeCompare(x.date + x.start); });
  }

  /* ---------- Inicio ---------- */
  function row(s) {
    var c = calc(s);
    return '<div class="row"><div class="acts">' +
      '<button data-a="edit" data-id="' + s.id + '">' + ic('edit') + '</button>' +
      '<button data-a="del" data-id="' + s.id + '" class="d">' + ic('trash') + '</button></div>' +
      '<div class="item"><div><b>' + s.date + '</b><small>' + s.start + ' - ' + s.end +
      (s.notes ? ' · ' + esc(s.notes) : '') + '</small></div>' +
      '<div class="r"><span class="lime">' + money(c.pay) + '</span><small>' + c.h.toFixed(2) + ' h</small>' +
      '<button data-a="pay" data-id="' + s.id + '" class="bd ' + (s.paid ? 'ok' : '') + '">' +
      (s.paid ? 'Pagado' : 'Por cobrar') + '</button></div></div></div>';
  }
  function renderHome() {
    var h = 0, m = 0;
    S.forEach(function (s) { var c = calc(s); h += c.h; m += c.pay; });
    $('tot-h').textContent = h.toFixed(2) + ' hrs acumuladas';
    $('tot-m').textContent = money(m);
    $('fecha').textContent = new Date().toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
    var l = sorted().slice(0, 15);
    $('lista').innerHTML = l.length ? l.map(row).join('') : '<p class="empty">No hay jornadas registradas. Toca "Nuevo turno" para empezar.</p>';
    open = null;
  }

  /* ---------- Deslizar para opciones (sin bloquear el scroll) ---------- */
  var sx = 0, cur = null, open = null, W = 110;
  var L = $('lista');
  L.addEventListener('touchstart', function (e) {
    var it = e.target.closest('.item');
    if (!it) return;
    cur = it; sx = e.touches[0].clientX; it.style.transition = 'none';
  }, { passive: true });
  L.addEventListener('touchmove', function (e) {
    if (!cur) return;
    var dx = e.touches[0].clientX - sx + (cur.dataset.o === '1' ? -W : 0);
    cur.style.transform = 'translateX(' + Math.max(-W, Math.min(0, dx)) + 'px)';
  }, { passive: true });
  function endSwipe() {
    if (!cur) return;
    var x = new DOMMatrix(getComputedStyle(cur).transform).m41;
    var o = x < -W / 2;
    cur.style.transition = '';
    cur.style.transform = o ? 'translateX(-' + W + 'px)' : '';
    cur.dataset.o = o ? '1' : '0';
    if (o && open && open !== cur) { open.style.transform = ''; open.dataset.o = '0'; }
    open = o ? cur : null;
    cur = null;
  }
  L.addEventListener('touchend', endSwipe);
  L.addEventListener('touchcancel', endSwipe);

  /* ---------- Informes ---------- */
  function block(titulo, arr) {
    var m = 0, h = 0;
    arr.forEach(function (s) { var c = calc(s); m += c.pay; h += c.h; });
    var html = '<h4><span class="t">' + titulo + '</span><span class="lime">' + money(m) + '</span></h4><small>' +
      h.toFixed(2) + ' hrs · ' + arr.length + ' turnos</small>';
    if (!arr.length) return html + '<p class="empty">Sin registros</p>';
    return html + arr.map(function (s) {
      var c = calc(s);
      return '<div class="rr"><span>' + s.date + ' ' + s.start + '-' + s.end +
        (s.notes ? '<br><small>' + esc(s.notes) + '</small>' : '') + '</span>' +
        '<span>' + c.h.toFixed(2) + ' h<br><b class="lime">' + money(c.pay) + '</b></span>' +
        '<button class="x" data-a="del" data-id="' + s.id + '" aria-label="Eliminar">' + ic('x') + '</button></div>';
    }).join('');
  }
  function renderReport() {
    var f = $('filtro').value;
    var from = f === 'all' ? null : new Date(Date.now() - (+f) * 864e5);
    var list = sorted().filter(function (s) { return !from || new Date(s.date + 'T00:00') >= from; });
    $('rep-perfil').textContent = (P.nombre || 'Trabajador') + ' · Tarifa ' + money(P.tarifa) + '/h';
    $('rep-por').innerHTML = block(ic('clock') + 'Por Cobrar', list.filter(function (s) { return !s.paid; }));
    $('rep-pag').innerHTML = block(ic('check') + 'Pagados (Cobrados)', list.filter(function (s) { return s.paid; }));
    drawChart(list);
  }
  function drawChart(list) {
    if (!window.Chart) return;
    var by = {};
    list.forEach(function (s) { by[s.date] = (by[s.date] || 0) + calc(s).pay; });
    var k = Object.keys(by).sort();
    if (chart) chart.destroy();
    chart = new Chart($('grafica'), {
      type: 'bar',
      data: {
        labels: k.map(function (d) { return d.slice(5); }),
        datasets: [{ data: k.map(function (d) { return +by[d].toFixed(2); }),
          backgroundColor: '#1558C9', borderColor: '#D4FF24', borderWidth: 1, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#7f8aa3' }, grid: { display: false } },
          y: { ticks: { color: '#7f8aa3' }, grid: { color: 'rgba(21,88,201,.15)' } }
        }
      }
    });
  }

  /* ---------- Navegación ---------- */
  function go(v) {
    document.querySelectorAll('.screen').forEach(function (e) { e.classList.toggle('active', e.id === 'v-' + v); });
    document.querySelectorAll('.nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.v === v); });
    $('main').scrollTop = 0;
    if (v === 'inicio') renderHome();
    if (v === 'informes') renderReport();
    if (v === 'perfil') fillProfile();
    if (v === 'registro' && !editId && !$('j-fecha').value) $('j-fecha').value = today();
  }
  function refresh() {
    renderHome();
    if ($('v-informes').classList.contains('active')) renderReport();
  }

  /* ---------- Modales ---------- */
  function openM(id) { $(id).classList.add('open'); }
  function closeM() { document.querySelectorAll('.modal').forEach(function (m) { m.classList.remove('open'); }); }
  function ask(msg, fn) { $('b-msg').textContent = msg; onYes = fn; openM('m-borrar'); }

  /* ---------- Ruedas de hora y calendario propios ---------- */
  var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var cal = { y: 0, m: 0, sel: '' };
  function buildWheel(id, n) {
    var h = '';
    for (var i = 0; i < n; i++) h += '<div class="wi" data-i="' + i + '">' + pad(i) + '</div>';
    $(id).innerHTML = h;
  }
  function wheelVal(id) {
    var c = $(id);
    return Math.max(0, Math.min(Math.round(c.scrollTop / 44), c.children.length - 1));
  }
  function wheelMark(id) {
    var v = wheelVal(id);
    Array.prototype.forEach.call($(id).children, function (e, i) { e.classList.toggle('sel', i === v); });
  }
  function wheelSet(id, i, smooth) {
    $(id).scrollTo({ top: i * 44, behavior: smooth ? 'smooth' : 'auto' });
    wheelMark(id);
  }
  function openTime(id) {
    timeTarget = id;
    var v = $(id).value || '08:00';
    openM('m-hora');
    wheelSet('w-h', +v.slice(0, 2));
    wheelSet('w-m', +v.slice(3, 5));
  }
  function drawCal(dir) {
    $('c-titulo').textContent = MESES[cal.m] + ' ' + cal.y;
    var first = new Date(cal.y, cal.m, 1).getDay();
    var days = new Date(cal.y, cal.m + 1, 0).getDate();
    var t = today(), h = '', i;
    for (i = 0; i < first; i++) h += '<span></span>';
    for (i = 1; i <= days; i++) {
      var ds = cal.y + '-' + pad(cal.m + 1) + '-' + pad(i);
      h += '<button type="button" class="day' + (ds === cal.sel ? ' sel' : '') + (ds === t ? ' hoy' : '') +
        '" data-d="' + ds + '">' + i + '</button>';
    }
    var g = $('c-grid');
    g.innerHTML = h;
    g.classList.remove('l', 'r');
    void g.offsetWidth;
    if (dir) g.classList.add(dir > 0 ? 'r' : 'l');
  }
  function openCal() {
    var v = $('j-fecha').value || today();
    var p = v.split('-');
    cal.y = +p[0]; cal.m = +p[1] - 1; cal.sel = v;
    drawCal(0);
    openM('m-fecha');
  }

  /* ---------- Formulario de jornada ---------- */
  function resetForm() {
    editId = null;
    $('f-jor').reset();
    setFest('none');
    $('j-fecha').value = today();
    $('j-pausa').value = 0;
    $('form-titulo').textContent = 'Registrar jornada';
    $('btn-guardar').textContent = 'Guardar jornada';
    $('btn-cancelar').hidden = true;
  }
  function setNow() {
    var d = new Date();
    $('j-fecha').value = today();
    $('j-ini').value = pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function startEdit(id) {
    var s = S.find(function (x) { return x.id === id; });
    if (!s) return;
    editId = id;
    $('j-fecha').value = s.date; $('j-ini').value = s.start; $('j-fin').value = s.end;
    $('j-pausa').value = s.pause; setFest(s.fest); $('j-notas').value = s.notes || '';
    $('form-titulo').textContent = 'Editar jornada';
    $('btn-guardar').textContent = 'Guardar cambios';
    $('btn-cancelar').hidden = false;
    go('registro');
  }

  /* ---------- Perfil ---------- */
  function fillProfile() {
    $('p-nombre').value = P.nombre; $('p-moneda').value = P.moneda;
    $('p-tarifa').value = P.tarifa || ''; $('p-festivo').value = P.festivo;
  }

  /* ---------- Respaldos y PDF ---------- */
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function exportar() {
    var json = JSON.stringify({ app: 'Calwortime', version: 1, perfil: P, turnos: S }, null, 2);
    var name = 'calwortime-respaldo-' + today() + '.json';
    closeM();
    if (window.NativeSaveJSON) {
      window.NativeSaveJSON(json, name).catch(function () { toast('No se pudo exportar'); });
    } else {
      download(new Blob([json], { type: 'application/json' }), name);
    }
  }
  function importar(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d || typeof d.perfil !== 'object' || !Array.isArray(d.turnos)) throw new Error('formato');
        var ok = d.turnos.filter(function (s) { return s && s.date && s.start && s.end; }).map(function (s, i) {
          return { id: s.id || (Date.now().toString(36) + i), date: s.date, start: s.start, end: s.end,
            pause: +s.pause || 0, fest: s.fest || 'none', notes: s.notes || '', paid: !!s.paid };
        });
        P = Object.assign({ nombre: '', moneda: 'Q', tarifa: 0, festivo: 100 }, d.perfil);
        S = ok;
        save(K.p, P); save(K.s, S);
        closeM(); refresh(); toast('Respaldo restaurado: ' + ok.length + ' turnos');
      } catch (e) { toast('El archivo no es un respaldo válido'); }
    };
    r.onerror = function () { toast('No se pudo leer el archivo'); };
    r.readAsText(file);
  }
  function pdf() {
    if (!window.html2pdf) return toast('El PDF no está disponible');
    document.body.classList.add('pdf');
    var name = 'calwortime-reporte-' + today() + '.pdf';
    window.html2pdf()
      .set({ margin: 8, filename: name, html2canvas: { scale: 2, backgroundColor: '#030407' },
        jsPDF: { unit: 'mm', format: 'a4' } })
      .from($('rep')).outputPdf('datauristring')
      .then(function (uri) {
        var b64 = uri.split(',')[1];
        if (window.NativeShare) return window.NativeShare(b64, name);
        var bin = atob(b64), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        download(new Blob([arr], { type: 'application/pdf' }), name);
      })
      .catch(function () { toast('No se pudo crear el PDF'); })
      .then(function () { document.body.classList.remove('pdf'); });
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]');
    if (b) {
      var id = b.dataset.id, a = b.dataset.a;
      if (a === 'pay') {
        var s = S.find(function (x) { return x.id === id; });
        if (s) { s.paid = !s.paid; save(K.s, S); refresh(); }
      } else if (a === 'del') {
        ask('¿Eliminar esta jornada?', function () {
          S = S.filter(function (x) { return x.id !== id; });
          save(K.s, S); refresh(); toast('Jornada eliminada');
        });
      } else if (a === 'edit') startEdit(id);
      return;
    }
    var g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    var n = e.target.closest('.nav button'); if (n) return go(n.dataset.v);
    if (e.target.closest('[data-close]') || e.target.classList.contains('modal')) closeM();
  });

  $('btn-menu').addEventListener('click', function () { openM('m-menu'); });
  $('btn-perfil').addEventListener('click', function () { go('perfil'); });
  $('btn-ahora').addEventListener('click', setNow);
  $('j-ini').addEventListener('click', function () { openTime('j-ini'); });
  $('j-fin').addEventListener('click', function () { openTime('j-fin'); });
  ['w-h', 'w-m'].forEach(function (id) {
    var t = 0;
    $(id).addEventListener('scroll', function () {
      if (t) return;
      t = requestAnimationFrame(function () { t = 0; wheelMark(id); });
    }, { passive: true });
    $(id).addEventListener('click', function (e) {
      if (e.target.dataset.i) wheelSet(id, +e.target.dataset.i, true);
    });
  });
  $('t-ok').addEventListener('click', function () {
    $(timeTarget).value = pad(wheelVal('w-h')) + ':' + pad(wheelVal('w-m'));
    closeM();
  });
  $('j-fecha').addEventListener('click', openCal);
  $('c-prev').addEventListener('click', function () { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } drawCal(-1); });
  $('c-next').addEventListener('click', function () { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } drawCal(1); });
  $('c-grid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-d]');
    if (!b) return;
    cal.sel = b.dataset.d;
    Array.prototype.forEach.call(this.querySelectorAll('.day'), function (x) { x.classList.toggle('sel', x === b); });
  });
  $('c-hoy').addEventListener('click', function () {
    var p = today().split('-');
    cal.y = +p[0]; cal.m = +p[1] - 1; cal.sel = today();
    drawCal(0);
  });
  $('c-ok').addEventListener('click', function () { $('j-fecha').value = cal.sel; closeM(); });
  $('b-ok').addEventListener('click', function () { var f = onYes; onYes = null; closeM(); if (f) f(); });
  $('btn-cancelar').addEventListener('click', function () { resetForm(); go('inicio'); });
  $('btn-pdf').addEventListener('click', pdf);
  $('btn-export').addEventListener('click', exportar);
  $('btn-import').addEventListener('click', function () { $('file-import').click(); });
  $('file-import').addEventListener('change', function (e) {
    if (e.target.files[0]) importar(e.target.files[0]);
    e.target.value = '';
  });

  $('f-jor').addEventListener('submit', function (e) {
    e.preventDefault();
    var s = { id: editId || Date.now().toString(36), date: $('j-fecha').value, start: $('j-ini').value,
      end: $('j-fin').value, pause: +$('j-pausa').value || 0, fest: $('j-fest').value,
      notes: $('j-notas').value.trim(), paid: false };
    if (!s.date || !s.start || !s.end) return toast('Completa la fecha y las horas');
    if (editId) {
      var old = S.find(function (x) { return x.id === editId; });
      s.paid = old ? old.paid : false;
      S = S.map(function (x) { return x.id === editId ? s : x; });
    } else S.push(s);
    save(K.s, S);
    resetForm();
    toast(P.tarifa > 0 ? 'Jornada guardada' : 'Guardada. Configura tu tarifa en Perfil');
    go('inicio');
  });

  $('f-perfil').addEventListener('submit', function (e) {
    e.preventDefault();
    P = { nombre: $('p-nombre').value.trim(), moneda: $('p-moneda').value.trim() || 'Q',
      tarifa: Math.max(0, parseFloat($('p-tarifa').value) || 0),
      festivo: Math.max(0, parseFloat($('p-festivo').value) || 0) };
    save(K.p, P);
    toast('Perfil guardado');
    go('inicio');
  });

  /* ---------- Selector de opciones propio ---------- */
  var FEST = [['none', 'Día normal (sin recargo)'], ['all', 'Todo el turno es festivo'],
    ['start', 'Solo entrada (antes de medianoche)'], ['end', 'Solo salida (después de medianoche)']];
  var FILT = [['15', '15 días'], ['30', '30 días'], ['all', 'Todo']];
  var pickCb = null;
  function lbl(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1];
    return list[0][1];
  }
  function setFest(v) { $('j-fest').value = v; $('j-fest-t').value = lbl(FEST, v); }
  function setFilt(v) { $('filtro').value = v; $('filtro-t').textContent = lbl(FILT, v); }
  function pick(title, opts, cur, cb) {
    $('pk-t').textContent = title;
    $('pk-l').innerHTML = opts.map(function (o) {
      return '<button type="button" class="opt' + (o[0] === cur ? ' sel' : '') + '" data-v="' + o[0] + '"><span>' + o[1] + '</span>' + ic('tick') + '</button>';
    }).join('');
    pickCb = cb;
    openM('m-pick');
  }
  $('pk-l').addEventListener('click', function (e) {
    var b = e.target.closest('[data-v]');
    if (!b) return;
    var f = pickCb; pickCb = null; closeM();
    if (f) f(b.dataset.v);
  });
  $('j-fest-t').addEventListener('click', function () { pick('Recargo festivo', FEST, $('j-fest').value, setFest); });
  $('filtro-b').addEventListener('click', function () {
    pick('Periodo', FILT, $('filtro').value, function (v) { setFilt(v); renderReport(); });
  });

  /* ---------- Inicio de la app ---------- */
  buildWheel('w-h', 24);
  buildWheel('w-m', 60);
  resetForm();
  go('inicio');
})();
      
