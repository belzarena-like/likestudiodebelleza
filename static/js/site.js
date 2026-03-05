(function () {
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  var menuToggle = document.querySelector("[data-menu-toggle]");
  var menu = document.querySelector("[data-menu]");
  if (menuToggle && menu) {
    menuToggle.addEventListener("click", function () {
      menu.classList.toggle("is-open");
    });
  }

  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length > 0) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );

    reveals.forEach(function (node) {
      observer.observe(node);
    });
  } else {
    reveals.forEach(function (node) {
      node.classList.add("is-visible");
    });
  }
})();
