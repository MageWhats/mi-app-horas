// Puente entre el widget de Turnstile y la app nativa (ver public/turnstile.html).
(function () {
  var params = new URLSearchParams(window.location.search);
  var widgetId = null;

  function enviar(mensaje) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(mensaje));
  }

  // La app pide un token nuevo después de usar el anterior (cada token sirve para una sola verificación)
  window.reiniciarTurnstile = function () {
    if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
  };

  window.iniciarTurnstile = function () {
    widgetId = window.turnstile.render('#widget', {
      sitekey: params.get('sitekey'),
      theme: params.get('tema') === 'claro' ? 'light' : 'dark',
      language: 'es',
      callback: function (token) { enviar({ tipo: 'token', token: token }); },
      'expired-callback': function () { enviar({ tipo: 'expirado' }); },
      'error-callback': function () { enviar({ tipo: 'error' }); },
    });
  };
})();
