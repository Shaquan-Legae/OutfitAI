document.addEventListener('DOMContentLoaded', () => {
    // =======================
    // --- ELEMENT REFERENCES ---
    // =======================
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const previewArea = document.getElementById('preview-area');
    const imagePreview = document.getElementById('image-preview');
    const itemDetailsForm = document.getElementById('item-details-form');
    const itemNameInput = document.getElementById('item-name');
    const itemCategorySelect = document.getElementById('item-category');
    const laundryCheckbox = document.getElementById('in-laundry-checkbox');
    const submitButton = document.getElementById('submit-button');
    const cancelPreviewButton = document.getElementById('cancel-preview');
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');

    const galleryContainer = document.getElementById('gallery-container');
    const galleryLoading = document.getElementById('gallery-loading');
    const galleryEmpty = document.getElementById('gallery-empty');
    const categoryFiltersContainer = document.getElementById('category-filters');

    // Note: Ensure your HTML ID matches this. 
    // If you used the previous HTML I provided, this might be 'laundry-carousel'
    const laundryItemsCarousel = document.getElementById('laundry-items-carousel') || document.getElementById('laundry-carousel');
    const laundryEmptyMessage = document.getElementById('laundry-empty');
    const laundryCountBadge = document.getElementById('laundry-count');
    const laundryScrollLeftBtn = document.getElementById('laundry-scroll-left');
    const laundryScrollRightBtn = document.getElementById('laundry-scroll-right');

    // Selection Mode Elements
    const toggleSelectionBtn = document.getElementById('toggle-selection-btn');
    const selectionBar = document.getElementById('selection-bar');
    const selectedCountSpan = document.getElementById('selected-count');
    const selectAllRadio = document.getElementById('select-all-radio'); // New Radio Button
    const cancelSelectionBtn = document.getElementById('cancel-selection-btn');
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    const batchWashBtn = document.getElementById('batch-wash-btn');

    let fileToUpload = null;
    let selectionMode = false;
    let selectedItems = new Set(); // Stores filenames
    let allItemsData = []; // Store fetched data globally for "Select All" logic

    // =======================
    // --- CAROUSEL LOGIC ---
    // =======================
    function updateNavVisibility(carousel, leftBtn, rightBtn) {
        if (!carousel || !leftBtn || !rightBtn) return;
        // Small delay to ensure layout is calculated
        setTimeout(() => {
            // If content is smaller than container, hide buttons
            if (carousel.scrollWidth <= carousel.clientWidth) {
                leftBtn.style.opacity = '0';
                rightBtn.style.opacity = '0';
                return;
            }

            const maxScroll = carousel.scrollWidth - carousel.clientWidth;
            leftBtn.disabled = carousel.scrollLeft <= 5;
            rightBtn.disabled = carousel.scrollLeft >= maxScroll - 5;

            leftBtn.style.opacity = leftBtn.disabled ? '0' : '1';
            rightBtn.style.opacity = rightBtn.disabled ? '0' : '1';
        }, 100);
    }

    function setupCarouselNav(carousel, leftBtn, rightBtn) {
        if (!carousel) return;
        // Scroll amount matches item width + gap (approx 128px + 12px)
        const scrollAmount = 140;

        if (leftBtn) {
            leftBtn.onclick = (e) => {
                e.preventDefault();
                carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            };
        }

        if (rightBtn) {
            rightBtn.onclick = (e) => {
                e.preventDefault();
                carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            };
        }

        carousel.addEventListener('scroll', () => updateNavVisibility(carousel, leftBtn, rightBtn));
        window.addEventListener('resize', () => updateNavVisibility(carousel, leftBtn, rightBtn));

        // Initial check
        updateNavVisibility(carousel, leftBtn, rightBtn);
    }

    // =======================
    // --- UPLOAD LOGIC ---
    // =======================
    function handleFile(file) {
        fileToUpload = file;
        const reader = new FileReader();
        reader.onload = (e) => { imagePreview.src = e.target.result; };
        reader.readAsDataURL(file);

        dropZone.classList.add('hidden');
        previewArea.classList.remove('hidden');
        itemDetailsForm.classList.remove('hidden');
        submitButton.disabled = false;
        validateForm();
    }

    function validateForm() {
        const nameFilled = itemNameInput.value.trim() !== '';
        const categorySelected = itemCategorySelect.value !== '';
        const imageSelected = fileToUpload !== null;
        submitButton.disabled = !(nameFilled && categorySelected && imageSelected);
    }

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary', 'bg-indigo-50');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-primary', 'bg-indigo-50');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-indigo-50');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });
    itemNameInput.addEventListener('input', validateForm);
    itemCategorySelect.addEventListener('change', validateForm);

    cancelPreviewButton.addEventListener('click', resetUploadForm);

    function resetUploadForm() {
        fileToUpload = null; fileInput.value = '';
        dropZone.classList.remove('hidden');
        previewArea.classList.add('hidden');
        itemDetailsForm.classList.add('hidden');
        itemNameInput.value = ''; itemCategorySelect.value = '';
        laundryCheckbox.checked = false;
        submitButton.disabled = true;
        uploadStatus.textContent = '';
    }

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!fileToUpload || submitButton.disabled) return;

        uploadStatus.textContent = 'Uploading...';
        uploadStatus.className = 'text-center text-[10px] mt-2 font-bold text-indigo-600';
        submitButton.disabled = true;

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('item_name', itemNameInput.value.trim());
        formData.append('item_category', itemCategorySelect.value);
        formData.append('in_laundry', laundryCheckbox.checked ? 'true' : 'false');

        try {
            const response = await fetch('/api/wardrobe/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Upload failed');

            uploadStatus.textContent = 'Success!';
            uploadStatus.className = 'text-center text-[10px] mt-2 font-bold text-green-600';

            setTimeout(() => {
                resetUploadForm();
                loadWardrobe(); // Reactive update
            }, 1000);

        } catch (error) {
            uploadStatus.textContent = `Error: ${error.message}`;
            uploadStatus.className = 'text-center text-[10px] mt-2 font-bold text-red-600';
            submitButton.disabled = false;
        }
    });

    // =======================
    // --- ITEM CARD LOGIC ---
    // =======================
    function createItemCard(item) {
        const card = document.createElement('div');
        // Tailwind classes: ensure .item-card in CSS/HTML head handles the 'w-32 h-40' sizing
        card.className = `item-card ${item.in_laundry ? 'is-laundry' : ''} ${selectedItems.has(item.filename) ? 'selected' : ''}`;
        card.dataset.filename = item.filename;

        // Image
        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.name;
        img.loading = "lazy";
        img.onerror = () => { img.src = 'https://placehold.co/144x192/f1f5f9/64748b?text=Error'; };

        // Overlay Container
        const overlay = document.createElement('div');
        overlay.className = 'item-card-overlay';
        overlay.innerHTML = `
            <h4 class="item-name">${item.name}</h4>
            <p class="text-[9px] text-white/80">${item.category}</p>
        `;

        // Selection Checkbox (Visual only, logic handled by card click)
        const checkbox = document.createElement('div');
        checkbox.className = 'select-checkbox';
        checkbox.innerHTML = '<i class="fa-solid fa-check text-[10px] text-white"></i>';

        // Wash Button (Appears on hover)
        const washBtn = document.createElement('button');
        washBtn.className = 'wash-btn';
        washBtn.title = item.in_laundry ? 'Mark Clean' : 'Add to Laundry';
        washBtn.innerHTML = item.in_laundry
            ? '<i class="fa-solid fa-shirt text-xs"></i>'
            : '<i class="fa-solid fa-jug-detergent text-xs"></i>';

        // Click Logic
        card.onclick = (e) => {
            if (selectionMode) {
                e.stopPropagation();
                toggleItemSelection(item.filename, card);
            }
        };

        // Wash logic
        washBtn.onclick = (e) => {
            e.stopPropagation();
            toggleLaundryStatus(item, card);
        };

        card.appendChild(checkbox);
        card.appendChild(washBtn);
        card.appendChild(img);
        card.appendChild(overlay);
        return card;
    }

    async function toggleLaundryStatus(item, card) {
        const newStatus = !item.in_laundry;
        try {
            // Optimistic UI update
            card.style.opacity = '0.5';

            const response = await fetch('/api/wardrobe/toggle_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: item.filename, in_laundry: newStatus })
            });

            if (!response.ok) throw new Error('Status update failed');

            // Reactive Refresh
            loadWardrobe();

        } catch (error) {
            card.style.opacity = '1';
            console.error(error);
            alert('Connection failed');
        }
    }

    // =======================
    // --- SELECTION LOGIC ---
    // =======================
    toggleSelectionBtn.addEventListener('click', () => {
        selectionMode = !selectionMode;
        document.body.classList.toggle('selection-mode', selectionMode);

        if (selectionMode) {
            toggleSelectionBtn.classList.add('bg-slate-800', 'text-white', 'border-transparent');
            toggleSelectionBtn.classList.remove('btn-secondary');
            toggleSelectionBtn.innerHTML = '<i class="fa-solid fa-xmark mr-2"></i> Cancel';
            selectionBar.classList.remove('hidden');
        } else {
            exitSelectionMode();
        }
    });

    cancelSelectionBtn.addEventListener('click', exitSelectionMode);

    function exitSelectionMode() {
        selectionMode = false;
        selectedItems.clear();
        document.body.classList.remove('selection-mode');
        toggleSelectionBtn.classList.remove('bg-slate-800', 'text-white', 'border-transparent');
        toggleSelectionBtn.classList.add('btn-secondary');
        toggleSelectionBtn.innerHTML = '<i class="fa-regular fa-square-check mr-2"></i> Select Items';
        selectionBar.classList.add('hidden');

        // Reset Radio Button
        if (selectAllRadio) selectAllRadio.checked = false;

        updateSelectionUI();
    }

    function toggleItemSelection(filename, card) {
        if (selectedItems.has(filename)) {
            selectedItems.delete(filename);
            card.classList.remove('selected');
        } else {
            selectedItems.add(filename);
            card.classList.add('selected');
        }

        // If we manually uncheck something, uncheck the master radio
        if (!selectedItems.has(filename) && selectAllRadio) {
            selectAllRadio.checked = false;
        }

        updateSelectionUI();
    }

    // --- NEW: Radio Button Select All Logic ---
    if (selectAllRadio) {
        selectAllRadio.addEventListener('change', (e) => {
            const isChecked = e.target.checked;

            if (isChecked) {
                // Select all items currently in the allItemsData
                // (You can optionally filter this to only 'wardrobe' items if preferred)
                const itemsToSelect = allItemsData.filter(i => !i.in_laundry); // Assuming we select visible wardrobe
                itemsToSelect.forEach(item => selectedItems.add(item.filename));
            } else {
                selectedItems.clear();
            }
            updateSelectionUI();
        });
    }

    function updateSelectionUI() {
        selectedCountSpan.textContent = selectedItems.size;

        // Refresh selection visual state on all cards
        const allCards = document.querySelectorAll('.item-card');
        allCards.forEach(c => {
            if (selectedItems.has(c.dataset.filename)) c.classList.add('selected');
            else c.classList.remove('selected');
        });
    }

    // Batch Delete
    batchDeleteBtn.addEventListener('click', async () => {
        if (selectedItems.size === 0) return;
        if (!confirm(`Delete ${selectedItems.size} items permanently?`)) return;

        try {
            const promises = Array.from(selectedItems).map(filename =>
                fetch('/api/wardrobe/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename })
                })
            );

            await Promise.all(promises);
            exitSelectionMode();
            loadWardrobe();
        } catch (error) {
            alert('Error deleting items');
        }
    });

    // Batch Wash
    batchWashBtn.addEventListener('click', async () => {
        if (selectedItems.size === 0) return;

        // Toggle all selected items
        const updates = [];
        // We use allItemsData to find the current state of selected items
        Array.from(selectedItems).forEach(filename => {
            const item = allItemsData.find(i => i.filename === filename);
            if (item) {
                updates.push(fetch('/api/wardrobe/toggle_status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: filename, in_laundry: !item.in_laundry })
                }));
            }
        });

        try {
            await Promise.all(updates);
            exitSelectionMode();
            loadWardrobe();
        } catch (e) {
            alert("Batch update failed");
        }
    });

    // =======================
    // --- LOAD & RENDER ---
    // =======================
    async function loadWardrobe() {
        try {
            const response = await fetch('/api/wardrobe');
            allItemsData = await response.json(); // Update global data

            // Clear UI Containers
            galleryContainer.innerHTML = '';
            laundryItemsCarousel.innerHTML = '';
            categoryFiltersContainer.innerHTML = '';

            // Split Data
            const laundryItems = allItemsData.filter(i => i.in_laundry);
            const availableItems = allItemsData.filter(i => !i.in_laundry);

            // 1. Render Laundry Basket
            laundryCountBadge.textContent = laundryItems.length;
            if (laundryItems.length > 0) {
                laundryEmptyMessage.classList.add('hidden');
                laundryItems.forEach(item => {
                    laundryItemsCarousel.appendChild(createItemCard(item));
                });
            } else {
                laundryEmptyMessage.classList.remove('hidden');
            }
            setupCarouselNav(laundryItemsCarousel, laundryScrollLeftBtn, laundryScrollRightBtn);

            // 2. Render Gallery Filters & Carousels
            if (availableItems.length === 0) {
                galleryEmpty.classList.remove('hidden');
            } else {
                galleryEmpty.classList.add('hidden');

                // Create Filters
                const categories = ['All', ...new Set(availableItems.map(i => i.category || 'Other'))].sort();

                categories.forEach(cat => {
                    const btn = document.createElement('button');
                    btn.textContent = cat;
                    btn.className = `filter-btn ${cat === 'All' ? 'active' : 'inactive'}`;
                    btn.onclick = () => filterGallery(cat, availableItems);
                    categoryFiltersContainer.appendChild(btn);
                });

                // Initial Render
                filterGallery('All', availableItems);
            }

            galleryLoading.classList.add('hidden');

            // Re-apply selections if mode is active (useful after laundry toggle)
            if (selectionMode) updateSelectionUI();

        } catch (error) {
            console.error(error);
            galleryLoading.innerHTML = `<span class="text-red-500">Error loading data. Is the API running?</span>`;
        }
    }

    function filterGallery(selectedCategory, allItems) {
        // Update Filter UI
        const buttons = categoryFiltersContainer.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            if (btn.textContent === selectedCategory) {
                btn.classList.remove('inactive');
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
                btn.classList.add('inactive');
            }
        });

        galleryContainer.innerHTML = '';

        // Group Items
        const groups = {};
        allItems.forEach(item => {
            const cat = item.category || 'Other';
            if (selectedCategory === 'All' || cat === selectedCategory) {
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push(item);
            }
        });

        // Render Category Sections (Carousels)
        const sortedCategories = Object.keys(groups).sort();

        sortedCategories.forEach(category => {
            const section = document.createElement('div');
            section.className = 'category-section mb-8 animate-fade-in';

            // Section Header
            const header = document.createElement('div');
            header.className = 'flex items-center gap-2 mb-3 px-1';
            header.innerHTML = `
                <div class="w-1 h-5 bg-primary rounded-full"></div>
                <h3 class="text-sm font-bold text-slate-900 uppercase tracking-wide">${category}</h3>
                <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">${groups[category].length}</span>
            `;
            section.appendChild(header);

            // Carousel Wrapper
            const carouselWrapper = document.createElement('div');
            carouselWrapper.className = 'relative group/slider';

            // Left Nav Button
            const leftBtn = document.createElement('button');
            leftBtn.className = 'absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/90 backdrop-blur shadow-sm rounded-full flex items-center justify-center text-slate-600 hover:text-primary -ml-3 opacity-0 group-hover/slider:opacity-100 transition-all disabled:opacity-0 cursor-pointer border border-slate-100';
            leftBtn.innerHTML = '<i class="fa-solid fa-chevron-left text-xs"></i>';

            // Right Nav Button
            const rightBtn = document.createElement('button');
            rightBtn.className = 'absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/90 backdrop-blur shadow-sm rounded-full flex items-center justify-center text-slate-600 hover:text-primary -mr-3 opacity-0 group-hover/slider:opacity-100 transition-all disabled:opacity-0 cursor-pointer border border-slate-100';
            rightBtn.innerHTML = '<i class="fa-solid fa-chevron-right text-xs"></i>';

            // Carousel Container
            const carousel = document.createElement('div');
            carousel.className = 'flex gap-3 overflow-x-auto hide-scroll pb-4 snap-x scroll-smooth px-1';

            // Add Cards
            groups[category].forEach(item => {
                carousel.appendChild(createItemCard(item));
            });

            carouselWrapper.appendChild(leftBtn);
            carouselWrapper.appendChild(carousel);
            carouselWrapper.appendChild(rightBtn);
            section.appendChild(carouselWrapper);
            galleryContainer.appendChild(section);

            // Activate Scroll Logic
            setupCarouselNav(carousel, leftBtn, rightBtn);
        });
    }

    // --- INIT ---
    loadWardrobe();
});