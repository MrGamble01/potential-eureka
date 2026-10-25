(function () {
  var btn = document.querySelector(".menu-btn");
  var panel = document.querySelector(".studio-menu");
  if (btn && panel) {
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      panel.hidden = open;
    });
  }

  var art = document.querySelector(".hero-art");
  if (!art || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  if (window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", function (e) {
      var x = (e.clientX / window.innerWidth - 0.5) * 18;
      var y = (e.clientY / window.innerHeight - 0.5) * 12;
      art.style.setProperty("--px", x.toFixed(2) + "px");
      art.style.setProperty("--py", y.toFixed(2) + "px");
    });
  }

  window.addEventListener("scroll", function () {
    art.style.setProperty("--sy", (window.scrollY * 0.2).toFixed(1) + "px");
  }, { passive: true });
})();
