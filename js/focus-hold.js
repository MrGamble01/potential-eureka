/* Blur and a hidden tab park the live clock. Focus brings it back.
   A pause the player chose is a different flag, so this one does not
   toggle it, and it does not touch the mute setting. */
(function () {
  if (window.EurekaFocus) return;
  var away = false;

  function parkAudio(park) {
    var audio = window.EurekaAudio;
    if (!audio) return;
    try {
      if (park && audio.park) audio.park();
      else if (!park && audio.unpark) audio.unpark();
    } catch (e) { /* the sim still holds if the score cannot */ }
  }

  function setAway(next) {
    if (away === next) return;
    away = next;
    parkAudio(next);
  }

  window.addEventListener('blur', function () { setAway(true); });
  window.addEventListener('focus', function () {
    if (!document.hidden) setAway(false);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) setAway(true);
    else if (document.hasFocus()) setAway(false);
  });

  window.EurekaFocus = {
    held: function () { return away; },
  };
})();
