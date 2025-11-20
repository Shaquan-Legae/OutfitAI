document.addEventListener('DOMContentLoaded', () => {
    // =======================
    // --- ELEMENT REFERENCES ---
    // =======================
    
    // Upload Elements
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

    // Gallery Elements
    const galleryContainer = document.getElementById('gallery-container');
    const galleryLoading = document.getElementById('gallery-loading');
    const galleryEmpty = document.getElementById('gallery-empty');
    
    // Laundry Elements
    const laundryItemsCarousel = document.getElementById('laundry-items-carousel');
    const laundryEmptyMessage = document.getElementById('laundry-empty');
    const laundryScrollLeftBtn = document.getElementById('laundry-scroll-left');
    const laundryScrollRightBtn = document.getElementById('laundry-scroll-right');
    const LAUNDRY_CONTAINER_ID = 'laundry-basket-card'; 

    // Modal Elements
    const deleteModal = document.getElementById('delete-modal');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');

    let fileToUpload = null;
    let itemToDelete = { filename: null, cardElement: null, containerId: null };

    // =======================
    // --- CAROUSEL NAVIGATION LOGIC ---
    // =======================

    function updateNavButtonVisibility(carousel, leftBtn, rightBtn) {
        if (!carousel || !leftBtn || !rightBtn) return;

        // Small delay to allow DOM to update scrollWidth
        setTimeout(() => {
            const hasScroll = carousel.scrollWidth > carousel.clientWidth;
            // Tolerance of 10px for float calculation issues
            const isAtStart = carousel.scrollLeft < 10;
            const isAtEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 10;

            if (hasScroll) {
                leftBtn.disabled = isAtStart;
                rightBtn.disabled = isAtEnd;
                
                // Tailwind opacity handling for disabled state is done via CSS classes/attributes
                leftBtn.style.opacity = isAtStart ? '0' : '1';
                rightBtn.style.opacity = isAtEnd ? '0' : '1';
            } else {
                leftBtn.disabled = true;
                rightBtn.disabled = true;
                leftBtn.style.opacity = '0';
                rightBtn.style.opacity = '0';
            }
        }, 100);
    }

    function setupCarouselNavigation(carousel, leftBtn, rightBtn) {
        if (!carousel || !leftBtn || !rightBtn) return;

        const scrollDistance = 200; // Scroll by approx one card width

        leftBtn.onclick = (e) => {
            e.preventDefault();
            carousel.scrollBy({ left: -scrollDistance, behavior: 'smooth' });
        };

        rightBtn.onclick = (e) => {
            e.preventDefault();
            carousel.scrollBy({ left: scrollDistance, behavior: 'smooth' });
        };

        carousel.onscroll = () => updateNavButtonVisibility(carousel, leftBtn, rightBtn);
        window.addEventListener('resize', () => updateNavButtonVisibility(carousel, leftBtn, rightBtn));

        updateNavButtonVisibility(carousel, leftBtn, rightBtn);
    }

    // =======================
    // --- UTILITY FUNCTIONS ---
    // =======================

    /**
     * Checks a parent container after an item is removed.
     * Removes the category container if empty.
     */
    function checkAndRemoveEmptyContainers(containerId) {
        const container = document.getElementById(containerId);

        if (containerId === LAUNDRY_CONTAINER_ID) {
            // Laundry Logic: check children of the carousel div
            if (laundryItemsCarousel.childElementCount === 0) {
                laundryEmptyMessage.style.display = 'block';
            }
            updateNavButtonVisibility(laundryItemsCarousel, laundryScrollLeftBtn, laundryScrollRightBtn);
        }
        else if (container) {
            // Category Logic: container is the wrapper <div>. 
            // Look for the carousel inside it.
            const carousel = container.querySelector('.item-carousel');
            if (carousel && carousel.childElementCount === 0) {
                container.remove(); // Remove the whole row (Header + Carousel)
            }
        }

        // Final check: Is the main gallery empty?
        // We count category sections inside galleryContainer
        const remainingCategories = galleryContainer.querySelectorAll('.category-section').length;
        if (remainingCategories === 0) {
             galleryEmpty.classList.remove('hidden');
        } else {
             galleryEmpty.classList.add('hidden');
        }
        
        galleryLoading.classList.add('hidden');
    }


    // --- File Handling and Preview ---
    function handleFile(file) {
        fileToUpload = file;
        const reader = new FileReader();
        reader.onload = (e) => { imagePreview.src = e.target.result; };
        reader.readAsDataURL(file);

        // Toggle visibility classes
        dropZone.classList.add('hidden');
        previewArea.classList.remove('hidden');
        itemDetailsForm.classList.remove('hidden');
        submitButton.disabled = false; 
        
        validateForm();
        uploadStatus.textContent = '';
    }

    // --- Form Validation ---
    function validateForm() {
        const nameFilled = itemNameInput.value.trim() !== '';
        const categorySelected = itemCategorySelect.value !== '';
        const imageSelected = fileToUpload !== null;
        submitButton.disabled = !(nameFilled && categorySelected && imageSelected);
    }

    itemNameInput.addEventListener('input', validateForm);
    itemCategorySelect.addEventListener('change', validateForm);

    // --- Drag/Drop/Browse Logic ---
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Visual feedback for Drag & Drop using Tailwind Utility Classes
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

    cancelPreviewButton.addEventListener('click', resetUploadForm);

    // --- Upload Form Submission ---
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!fileToUpload || submitButton.disabled) return;

        uploadStatus.textContent = 'Uploading & Classifying...';
        uploadStatus.className = 'text-center text-sm mt-3 font-medium text-indigo-600';
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

            uploadStatus.textContent = 'Upload successful!';
            uploadStatus.className = 'text-center text-sm mt-3 font-medium text-green-600';

            // Add new card to UI
            addCardToGallery(result);

            resetUploadForm();

        } catch (error) {
            uploadStatus.textContent = `Error: ${error.message}`;
            uploadStatus.className = 'text-center text-sm mt-3 font-medium text-red-600';
        } finally {
            validateForm();
            setTimeout(() => { uploadStatus.textContent = ''; }, 3000);
        }
    });

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

    // --- Laundry Status Toggler ---
    async function toggleLaundryStatus(item, cardElement) {
        const newStatus = !item.in_laundry;
        const currentContainer = cardElement.closest('.category-section') || cardElement.closest('.laundry-card'); // .laundry-card is likely the ID container
        const sourceContainerId = currentContainer ? currentContainer.id : null;

        try {
            const response = await fetch('/api/wardrobe/toggle_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: item.filename,
                    in_laundry: newStatus
                })
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to update status.');
            }

            // Update local data
            item.in_laundry = newStatus;

            // Animation
            cardElement.style.transition = 'opacity 0.3s, transform 0.3s';
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'scale(0.9)';

            setTimeout(() => {
                cardElement.remove();
                addCardToGallery(item); // Re-render in new location

                // Cleanup old container if empty
                if (sourceContainerId) {
                    checkAndRemoveEmptyContainers(sourceContainerId);
                }
            }, 300);

        } catch (error) {
            console.error('Status update failed:', error);
            alert(`Error: ${error.message}`);
        }
    }

    // --- Gallery Card Creator ---
    function createItemCard(item) {
        const card = document.createElement('div');
        // The class 'item-card' is defined in the HTML <style> block with @apply
        card.className = `item-card ${item.in_laundry ? 'is-laundry' : ''}`;
        card.dataset.filename = item.filename;

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.name || item.filename;
        // Handle broken images
        img.onerror = () => { img.src = 'https://placehold.co/160x192/f1f5f9/64748b?text=Image+Error'; };

        // Delete Button (Using FontAwesome)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-button';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent bubbling
            const container = card.closest('.category-section') || document.getElementById(LAUNDRY_CONTAINER_ID);
            const containerId = container ? container.id : null;
            openDeleteModal(item.filename, card, containerId);
        };

        // Status Button (Using FontAwesome)
        const statusBtn = document.createElement('button');
        statusBtn.className = 'status-toggle-button';
        // Icon changes based on state
        statusBtn.innerHTML = item.in_laundry 
            ? '<i class="fa-solid fa-shirt"></i> Clean' 
            : '<i class="fa-solid fa-jug-detergent"></i> Wash';
        
        statusBtn.onclick = (e) => {
            e.stopPropagation();
            toggleLaundryStatus(item, card);
        };

        card.appendChild(img);
        card.appendChild(deleteBtn);
        card.appendChild(statusBtn);
        return card;
    }

    // --- RENDER FUNCTION (Modified for Tailwind) ---
    function addCardToGallery(item) {
        const category = item.category || 'Other';
        const newCard = createItemCard(item);

        if (item.in_laundry) {
            // Add to Laundry Carousel
            laundryItemsCarousel.prepend(newCard);
            laundryEmptyMessage.style.display = 'none';
        } else {
            // Add to Main Gallery (Grouped by Category)
            const categoryId = `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            let categorySection = document.getElementById(categoryId);
            let carousel;

            if (!categorySection) {
                // Create a new category row if it doesn't exist
                categorySection = document.createElement('div');
                categorySection.className = 'category-section mb-8 animate-fade-in-down'; // Tailwind classes
                categorySection.id = categoryId;

                // Category Header
                const heading = document.createElement('h3');
                heading.className = 'text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2 capitalize';
                heading.innerHTML = `<span class="w-2 h-6 bg-primary rounded-full inline-block"></span>${category}`;
                categorySection.appendChild(heading);

                // Carousel Container (Tailwind classes)
                carousel = document.createElement('div');
                // flex gap-4 overflow-x-auto hide-scroll pb-4 snap-x
                carousel.className = 'item-carousel flex gap-4 overflow-x-auto hide-scroll pb-4 snap-x scroll-smooth';
                
                categorySection.appendChild(carousel);
                
                // Append to the Main Grid Container (which we are treating as a flex col wrapper in the JS logic)
                // Note: We need to ensure the HTML #gallery-container is not a grid if we are doing rows.
                // If #gallery-container has 'grid' class in HTML, we might want to remove it via JS or change logic.
                // Assuming we want rows of carousels:
                galleryContainer.classList.remove('grid', 'grid-cols-2', 'sm:grid-cols-3', 'xl:grid-cols-4');
                galleryContainer.classList.add('flex', 'flex-col', 'gap-2');
                
                galleryContainer.appendChild(categorySection);
            } else {
                carousel = categorySection.querySelector('.item-carousel');
            }

            carousel.prepend(newCard);
            galleryEmpty.classList.add('hidden');
        }

        galleryLoading.classList.add('hidden');

        // Update nav
        updateNavButtonVisibility(laundryItemsCarousel, laundryScrollLeftBtn, laundryScrollRightBtn);
    }

    // --- Load Wardrobe ---
    async function loadWardrobe() {
        try {
            const response = await fetch('/api/wardrobe');
            if (!response.ok) throw new Error('Could not fetch wardrobe.');

            const items = await response.json();

            // Reset containers
            galleryContainer.innerHTML = '';
            laundryItemsCarousel.innerHTML = '';

            let availableCount = 0;
            // Group items for display
            const groupedAvailableItems = {};

            items.forEach(item => {
                if (item.in_laundry) {
                    laundryEmptyMessage.style.display = 'none';
                    laundryItemsCarousel.appendChild(createItemCard(item));
                } else {
                    availableCount++;
                    const category = item.category || 'Other';
                    if (!groupedAvailableItems[category]) { groupedAvailableItems[category] = []; }
                    groupedAvailableItems[category].push(item);
                }
            });

            if (availableCount === 0) {
                galleryEmpty.classList.remove('hidden');
            } else {
                galleryEmpty.classList.add('hidden');
                
                // Sort categories alphabetically
                const sortedCategories = Object.keys(groupedAvailableItems).sort();

                sortedCategories.forEach(category => {
                    // Manually call addCard logic or construct the section
                    // We can reuse the logic from addCardToGallery but passing a specific loop
                    // Simplified: Just construct the section here
                    
                    const categoryId = `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                    const categorySection = document.createElement('div');
                    categorySection.className = 'category-section mb-8';
                    categorySection.id = categoryId;

                    const heading = document.createElement('h3');
                    heading.className = 'text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2 capitalize';
                    heading.innerHTML = `<span class="w-2 h-6 bg-primary rounded-full inline-block"></span>${category}`;
                    categorySection.appendChild(heading);

                    const carousel = document.createElement('div');
                    carousel.className = 'item-carousel flex gap-4 overflow-x-auto hide-scroll pb-4 snap-x scroll-smooth';
                    
                    groupedAvailableItems[category].forEach(item => {
                        carousel.appendChild(createItemCard(item));
                    });

                    categorySection.appendChild(carousel);
                    
                    // Ensure container is column layout
                    galleryContainer.classList.remove('grid', 'grid-cols-2', 'sm:grid-cols-3', 'xl:grid-cols-4');
                    galleryContainer.classList.add('flex', 'flex-col', 'gap-2');
                    
                    galleryContainer.appendChild(categorySection);
                });
            }

            // Final cleanup
            checkAndRemoveEmptyContainers(LAUNDRY_CONTAINER_ID);
            galleryLoading.classList.add('hidden');

            setupCarouselNavigation(laundryItemsCarousel, laundryScrollLeftBtn, laundryScrollRightBtn);

        } catch (error) {
            galleryLoading.innerHTML = `<span class="text-red-500">Error: ${error.message}</span>`;
        }
    }

    // --- Delete Logic (Modal) ---
    modalConfirm.addEventListener('click', async () => {
        if (!itemToDelete.filename) return;

        try {
            const response = await fetch('/api/wardrobe/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: itemToDelete.filename })
            });
            const result = await response.json();
            if (!response.ok && response.status !== 404) throw new Error(result.error || 'Delete failed');

            // Animate removal
            itemToDelete.cardElement.style.transition = 'all 0.3s ease';
            itemToDelete.cardElement.style.transform = 'scale(0.0)';
            itemToDelete.cardElement.style.opacity = '0';

            const deletedContainerId = itemToDelete.containerId;

            setTimeout(() => {
                itemToDelete.cardElement.remove();
                if (deletedContainerId) {
                    checkAndRemoveEmptyContainers(deletedContainerId);
                }
            }, 300);

        } catch (error) {
            console.error('Delete error:', error);
            alert(`Error: ${error.message}`);
        } finally {
            closeModal();
        }
    });

    function openDeleteModal(filename, cardElement, containerId) {
        itemToDelete.filename = filename;
        itemToDelete.cardElement = cardElement;
        itemToDelete.containerId = containerId;
        deleteModal.classList.remove('hidden');
    }

    function closeModal() {
        itemToDelete = { filename: null, cardElement: null, containerId: null };
        deleteModal.classList.add('hidden');
    }

    modalCancel.addEventListener('click', closeModal);
    deleteModal.addEventListener('click', (e) => { 
        // Check if clicking the backdrop (not the inner modal content)
        // The HTML structure: #delete-modal > backdrop div > wrapper > modal content
        // If the user clicks the background overlay
        if (e.target === deleteModal || e.target.classList.contains('bg-slate-900/50')) {
             closeModal();
        }
    });

    // --- Initial Load ---
    loadWardrobe();
});