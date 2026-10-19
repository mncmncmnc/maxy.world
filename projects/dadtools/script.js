(function () {
  var link = document.getElementById("music");
  var albums = [];
  var last = -1;

  function ios() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  link.addEventListener("click", function () {
    if (!albums.length) return;

    var index = Math.floor(Math.random() * albums.length);
    if (albums.length > 1) {
      while (index === last) {
        index = Math.floor(Math.random() * albums.length);
      }
    }
    last = index;

    var url = albums[index].url;
    link.href = ios() ? url.replace(/^https:\/\//, "itmss://") : url;
  });

  fetch("albums.json")
    .then(function (response) {
      if (!response.ok) throw new Error("Could not load albums");
      return response.json();
    })
    .then(function (data) {
      albums = data;
    });
})();
