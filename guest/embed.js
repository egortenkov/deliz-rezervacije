/*
 * Deliz — vdelava obrazca za rezervacije v katerokoli stran (WordPress: blok «Custom HTML»).
 *
 *   <div id="deliz-booking"></div>
 *   <script src="https://<uporabnik>.github.io/<repo>/guest/embed.js" data-lang="sl" async></script>
 *
 * data-lang: sl | en | de | it (neobvezno; privzeto jezik brskalnika)
 * data-target: id elementa (neobvezno; privzeto «deliz-booking», sicer se vstavi za skripto)
 */
(function () {
  var script = document.currentScript;
  var base = script.src.replace(/embed\.js(\?.*)?$/, '');
  var lang = script.getAttribute('data-lang');
  var target = document.getElementById(script.getAttribute('data-target') || 'deliz-booking');

  var iframe = document.createElement('iframe');
  iframe.src = base + '?embed=1' + (lang ? '&lang=' + encodeURIComponent(lang) : '');
  iframe.title = 'Deliz — rezervacija mize';
  iframe.loading = 'lazy';
  iframe.style.cssText = 'width:100%;max-width:640px;border:0;display:block;margin:0 auto;height:620px;overflow:hidden;background:transparent;';
  iframe.setAttribute('scrolling', 'no');

  if (target) target.appendChild(iframe);
  else script.parentNode.insertBefore(iframe, script.nextSibling);

  var origin = new URL(base).origin;
  window.addEventListener('message', function (e) {
    if (e.origin !== origin || !e.data || e.data.type !== 'deliz:height') return;
    iframe.style.height = Math.ceil(e.data.height) + 'px';
  });
})();
