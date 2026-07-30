window.addEventListener('load', function() {

  var rangeslider = document.getElementById("sliderRange");

  var images = document.getElementById("sliderImages");

  rangeslider.addEventListener('input', function() {
    for (var i = 0; i < images.children.length; i++) {
      images.children[i].style.display = 'none';
    }
    i = Number(this.value) - 1;
    images.children[i].style.display = 'block';
  });

});
