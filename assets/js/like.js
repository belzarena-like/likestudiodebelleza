/*!
=========================================================
* FoodHut Landing page
=========================================================

* Copyright: 2019 DevCRUD (https://devcrud.com)
* Licensed: (https://devcrud.com/licenses)
* Coded by www.devcrud.com

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

// smooth scroll
$(document).ready(function(){
    $(".navbar .nav-link").on('click', function(event) {

        if (this.hash !== "") {

            event.preventDefault();

            var hash = this.hash;

            $('html, body').animate({
                scrollTop: $(hash).offset().top
            }, 700, function(){
                window.location.hash = hash;
            });
        } 
    });
});

new WOW().init();

function initMap() {
    var uluru = {lat: 37.227837, lng: -95.700513};
    var map = new google.maps.Map(document.getElementById('map'), {
      zoom: 8,
      center: uluru
    });
    var marker = new google.maps.Marker({
      position: uluru,
      map: map
    });
 }


function initMap() {
  var uluru = {
    lat: parseFloat(document.getElementById('mapcoords').getAttribute("data-lat")),
    lng: parseFloat(document.getElementById('mapcoords').getAttribute("data-lng"))
  };
  var map = new google.maps.Map(document.getElementById('map'), {
    zoom: parseInt(document.getElementById('mapcoords').getAttribute("data-zoom")),
    center: uluru
  });
  var marker = new google.maps.Marker({
    position: uluru,
    map: map
  });
}

var lastHeight = 0;

function resizeIframe(height) {
    var iframe = document.getElementById('i_servicios');
    iframe.style.height = height + 'px';
}
window.addEventListener('message', function(event) {
    if (event.data && event.data.height && !event.origin.includes('timify')) {
          resizeIframe(event.data.height);
    }
}, false);
