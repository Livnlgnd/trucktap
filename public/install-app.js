(function () {
  var standalone =
    (window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  var mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(
    window.navigator.userAgent || '',
  );

  if (standalone) {
    window.location.replace('/app/');
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  if (!mobile) return;

  document.addEventListener('click', function (event) {
    var link =
      event.target && event.target.closest
        ? event.target.closest('a[href]')
        : null;
    if (!link) return;

    var href = link.getAttribute('href') || '';
    if (/(^|\/)app\.html(?:[?#].*)?$/.test(href)) {
      event.preventDefault();
      window.location.href = '/app/';
    }
  });

  window.addEventListener('appinstalled', function () {
    window.location.href = '/app/';
  });
})();
