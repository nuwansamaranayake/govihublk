(function () {
  "use strict";

  var EN_TO_SI = {
    "/": "/si",
    "/index.html": "/si.html",
    "/about": "/about-si",
    "/about.html": "/about-si.html",
    "/contact": "/contact-si",
    "/contact.html": "/contact-si.html"
  };
  var SI_TO_EN = {
    "/si": "/",
    "/si.html": "/index.html",
    "/about-si": "/about",
    "/about-si.html": "/about.html",
    "/contact-si": "/contact",
    "/contact-si.html": "/contact.html"
  };

  function setLang(lang) {
    try {
      localStorage.setItem("govihub-lang", lang);
    } catch (_) {}
  }

  function toggleTo(target, pathMap) {
    var current = window.location.pathname;
    var next = pathMap[current];
    if (next) {
      setLang(target);
      window.location.href = next;
    } else {
      setLang(target);
      window.location.href = target === "si" ? "/si" : "/";
    }
  }

  function wire() {
    var en = document.querySelector('[data-lang="en"]');
    var si = document.querySelector('[data-lang="si"]');
    if (en) {
      en.addEventListener("click", function (e) {
        e.preventDefault();
        toggleTo("en", SI_TO_EN);
      });
    }
    if (si) {
      si.addEventListener("click", function (e) {
        e.preventDefault();
        toggleTo("si", EN_TO_SI);
      });
    }
  }

  function autoRedirectOnFirstVisit() {
    try {
      var saved = localStorage.getItem("govihub-lang");
      if (!saved) return;
      var path = window.location.pathname;
      var onEn = path === "/" || path === "/index.html" || path === "/about" || path === "/about.html" || path === "/contact" || path === "/contact.html";
      var onSi = path === "/si" || path === "/si.html" || path === "/about-si" || path === "/about-si.html" || path === "/contact-si" || path === "/contact-si.html";
      if (saved === "si" && onEn && EN_TO_SI[path]) {
        window.location.replace(EN_TO_SI[path]);
      } else if (saved === "en" && onSi && SI_TO_EN[path]) {
        window.location.replace(SI_TO_EN[path]);
      }
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
  autoRedirectOnFirstVisit();
})();
