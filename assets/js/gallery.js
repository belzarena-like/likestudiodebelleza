  const galleries = [
            {
                title: "Microblading",
                images: [
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
                    'assets/imgs/cejasFemininas/cejas_femininas (12).jpeg'
                ]
            },
            {
                title: "Micro Capilar",
                images: [
                    'assets/imgs/microCapilar/micro_capilar (2).jpeg',
                    'assets/imgs/microCapilar/micro_capilar (3).jpeg',
                    'assets/imgs/microCapilar/micro_capilar (4).jpeg',
                    'assets/imgs/microCapilar/micro_capilar (5).jpeg',
                    'assets/imgs/microCapilar/micro_capilar (6).jpeg',
                    'assets/imgs/microCapilar/micro_capilar (7).jpeg',
                    'assets/imgs/microCapilar/micro_capilar (8).jpeg'
                ]
            },
            {
                title: "Micropigmentación Masculina",
                images: [
                    'assets/imgs/cejasMasculinas/cejas_masculinas (1).jpeg',
                    'assets/imgs/cejasMasculinas/cejas_masculinas (2).jpeg',
                    'assets/imgs/cejasMasculinas/cejas_masculinas (3).jpeg',
                    'assets/imgs/cejasMasculinas/cejas_masculinas (4).jpeg'
                ]
            }
        ];

        const container = document.getElementById('galleriesContainer');
        let allImages = [];
        let currentImageIndex = 0;
        let carousels = [];

        // Build galleries
        galleries.forEach((gallery, galleryIndex) => {
            const section = document.createElement('div');
            section.className = 'gallery-section';

            const header = document.createElement('div');
            header.className = 'section-header';
            header.innerHTML = `<h2>${gallery.title}</h2>`;

            const carouselContainer = document.createElement('div');
            carouselContainer.className = 'carousel-container';

            const track = document.createElement('div');
            track.className = 'carousel-track';
            track.dataset.gallery = galleryIndex;

            gallery.images.forEach((imgSrc, index) => {
                const globalIndex = allImages.length;
                allImages.push(imgSrc);

                const item = document.createElement('div');
                item.className = 'carousel-item';
                item.innerHTML = `
                    <img src="${imgSrc}" class="carousel-img" alt="${gallery.title} ${index + 1}">
                    <div class="carousel-overlay">
                        <div class="carousel-icon">+</div>
                    </div>
                `;

                item.addEventListener('click', () => openLightbox(globalIndex));
                track.appendChild(item);
            });

            // Navigation buttons
            const prevBtn = document.createElement('button');
            prevBtn.className = 'carousel-nav carousel-prev';
            prevBtn.innerHTML = '‹';
            prevBtn.addEventListener('click', () => moveCarousel(galleryIndex, -1));

            const nextBtn = document.createElement('button');
            nextBtn.className = 'carousel-nav carousel-next';
            nextBtn.innerHTML = '›';
            nextBtn.addEventListener('click', () => moveCarousel(galleryIndex, 1));

            carouselContainer.appendChild(prevBtn);
            carouselContainer.appendChild(track);
            carouselContainer.appendChild(nextBtn);

            // Indicators
            const itemsPerView = window.innerWidth <= 480 ? 1 : window.innerWidth <= 768 ? 2 : window.innerWidth <= 1024 ? 3 : 4;
            const totalPages = Math.ceil(gallery.images.length / itemsPerView);

            const indicators = document.createElement('div');
            indicators.className = 'carousel-indicators';

            for (let i = 0; i < totalPages; i++) {
                const indicator = document.createElement('button');
                indicator.className = 'indicator';
                if (i === 0) indicator.classList.add('active');
                indicator.addEventListener('click', () => goToPage(galleryIndex, i));
                indicators.appendChild(indicator);
            }

            section.appendChild(header);
            section.appendChild(carouselContainer);
            section.appendChild(indicators);
            container.appendChild(section);

            // Store carousel state
            carousels.push({
                track: track,
                currentPage: 0,
                totalPages: totalPages,
                indicators: indicators,
                itemsPerView: itemsPerView,
                autoPlayInterval: null
            });

            // Start auto-play
            startAutoPlay(galleryIndex);
        });

        function moveCarousel(galleryIndex, direction) {
            const carousel = carousels[galleryIndex];
            carousel.currentPage = (carousel.currentPage + direction + carousel.totalPages) % carousel.totalPages;
            updateCarousel(galleryIndex);
            resetAutoPlay(galleryIndex);
        }

        function goToPage(galleryIndex, page) {
            const carousel = carousels[galleryIndex];
            carousel.currentPage = page;
            updateCarousel(galleryIndex);
            resetAutoPlay(galleryIndex);
        }

        function updateCarousel(galleryIndex) {
            const carousel = carousels[galleryIndex];
            const itemWidth = carousel.track.querySelector('.carousel-item').offsetWidth;
            const gap = 24; // 1.5rem
            const offset = -(carousel.currentPage * carousel.itemsPerView * (itemWidth + gap));
            carousel.track.style.transform = `translateX(${offset}px)`;

            // Update indicators
            const indicators = carousel.indicators.querySelectorAll('.indicator');
            indicators.forEach((indicator, index) => {
                indicator.classList.toggle('active', index === carousel.currentPage);
            });
        }

        function startAutoPlay(galleryIndex) {
            const carousel = carousels[galleryIndex];
            carousel.autoPlayInterval = setInterval(() => {
                moveCarousel(galleryIndex, 1);
            }, 5000); // Auto-advance every 5 seconds
        }

        function resetAutoPlay(galleryIndex) {
            const carousel = carousels[galleryIndex];
            clearInterval(carousel.autoPlayInterval);
            startAutoPlay(galleryIndex);
        }

        // Lightbox functionality
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightboxImg');
        const lightboxClose = document.getElementById('lightboxClose');
        const lightboxPrev = document.getElementById('lightboxPrev');
        const lightboxNext = document.getElementById('lightboxNext');

        function openLightbox(index) {
            currentImageIndex = index;
            lightboxImg.src = allImages[currentImageIndex];
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
            lightbox.classList.remove('active');
            document.body.style.overflow = 'auto';
        }

        function showNextImage() {
            currentImageIndex = (currentImageIndex + 1) % allImages.length;
            lightboxImg.src = allImages[currentImageIndex];
        }

        function showPrevImage() {
            currentImageIndex = (currentImageIndex - 1 + allImages.length) % allImages.length;
            lightboxImg.src = allImages[currentImageIndex];
        }

        lightboxClose.addEventListener('click', closeLightbox);
        lightboxNext.addEventListener('click', showNextImage);
        lightboxPrev.addEventListener('click', showPrevImage);

        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });

        document.addEventListener('keydown', (e) => {
            if (!lightbox.classList.contains('active')) return;

            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') showNextImage();
            if (e.key === 'ArrowLeft') showPrevImage();
        });

        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                carousels.forEach((carousel, index) => {
                    const newItemsPerView = window.innerWidth <= 480 ? 1 : window.innerWidth <= 768 ? 2 : window.innerWidth <= 1024 ? 3 : 4;
                    carousel.itemsPerView = newItemsPerView;
                    carousel.totalPages = Math.ceil(galleries[index].images.length / newItemsPerView);
                    carousel.currentPage = 0;
                    updateCarousel(index);
                });
            }, 250);
        });