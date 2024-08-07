function drawGalery(images, type) {
    // Create carousel HTML structure
     $('.carousel').carousel({
            interval: false
        });

        // Start the manual cycling process
        setInterval(function() {
            $('.carousel').carousel('next');
        }, 10000); // 10000 milliseconds = 10 seconds
    const carouselContainer = document.createElement('div');
    carouselContainer.innerHTML = `
        <div class="text-center bg-dark text-light has-height-md middle-items wow fadeIn">
            <h2 class="section-title">${type.replace('Micro', 'Micro ')}</h2>
        </div>
        <div id="galleryCarousel${type}" class="carousel slide" data-ride="carousel">
            <ol class="carousel-indicators"></ol>
            <div class="carousel-inner"></div>
            <a class="carousel-control-prev" href="#galleryCarousel${type}" role="button" data-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="sr-only">Previous</span>
            </a>
            <a class="carousel-control-next" href="#galleryCarousel${type}" role="button" data-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="sr-only">Next</span>
            </a>
        </div>
    `;

    const indicators = carouselContainer.querySelector('.carousel-indicators');
    const inner = carouselContainer.querySelector('.carousel-inner');
    let carouselItem, indicator;

    images.forEach((src, index) => {
        if (index % 4 === 0) { // 4 items per carousel-item
            // Create a new carousel item
            carouselItem = document.createElement('div');
            carouselItem.classList.add('carousel-item');
            if (index === 0) carouselItem.classList.add('active');
            inner.appendChild(carouselItem);

            // Create a new indicator
            indicator = document.createElement('li');
            indicator.setAttribute('data-target', `#galleryCarousel${type}`);
            indicator.setAttribute('data-slide-to', Math.floor(index / 4));
            if (index === 0) indicator.classList.add('active');
            indicators.appendChild(indicator);
        }

        // Add the gallery item to the current carousel item
        const col = document.createElement('div');
        col.classList.add('gallary-item');
        col.innerHTML = `
            <img src="${src}" class="gallary-img">
            <a href="#" class="gallary-overlay">
                <i class="gallary-icon ti-plus"></i>
            </a>
        `;
        carouselItem.appendChild(col);
    });

    document.getElementById('carouselsContainer').appendChild(carouselContainer);
}


document.addEventListener("DOMContentLoaded", function() {
     const imagesCejasFemininas = [
     'assets/imgs/cejasFemininas/cejas_femininas (1).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (2).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (3).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (4).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (5).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (6).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (7).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (8).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (9).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (10).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (11).jpeg',
     'assets/imgs/cejasFemininas/cejas_femininas (12).jpeg',
      ];

      const imagesCejasMasculinas = [
         'assets/imgs/cejasMasculinas/cejas_masculinas (1).jpeg',
         'assets/imgs/cejasMasculinas/cejas_masculinas (2).jpeg',
         'assets/imgs/cejasMasculinas/cejas_masculinas (3).jpeg',
         'assets/imgs/cejasMasculinas/cejas_masculinas (4).jpeg'
      ];
    const imagesMicroCapilar = [
         'assets/imgs/microCapilar/cejas_femininas (1).jpeg',
         'assets/imgs/microCapilar/micro_capilar (2).jpeg',
         'assets/imgs/microCapilar/micro_capilar (3).jpeg',
         'assets/imgs/microCapilar/micro_capilar (4).jpeg',
         'assets/imgs/microCapilar/micro_capilar (5).jpeg',
         'assets/imgs/microCapilar/micro_capilar (6).jpeg',
         'assets/imgs/microCapilar/micro_capilar (7).jpeg',
         'assets/imgs/microCapilar/micro_capilar (8).jpeg'
          ];

    drawGalery(imagesCejasFemininas, 'MicroFeminina');
    drawGalery(imagesMicroCapilar, 'MicroCapilar');
    drawGalery(imagesCejasMasculinas, 'MicroMasculina');
});
