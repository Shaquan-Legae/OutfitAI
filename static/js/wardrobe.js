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
    const laundryItemsCarousel = document.getElementById('laundry-items-carousel');
    const laundryEmptyMessage = document.getElementById('laundry-empty');
    const laundryScrollLeftBtn = document.getElementById('laundry-scroll-left');
    const laundryScrollRightBtn = document.getElementById('laundry-scroll-right');
    const LAUNDRY_CONTAINER_ID = 'laundry-basket-card'; // ID of the parent card for laundry

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

        setTimeout(() => {
            const hasScroll = carousel.scrollWidth > carousel.clientWidth;
            const isAtStart = carousel.scrollLeft < 10;
            const isAtEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 10;

            if (hasScroll) {
                leftBtn.disabled = isAtStart;
                rightBtn.disabled = isAtEnd;
            } else {
                leftBtn.disabled = true;
                rightBtn.disabled = true;
            }
        }, 100);
    }

    function setupCarouselNavigation(carousel, leftBtn, rightBtn) {
        if (!carousel || !leftBtn || !rightBtn) return;

        const scrollDistance = 180; // Scroll by one item width

        leftBtn.onclick = () => {
            carousel.scrollBy({ left: -scrollDistance, behavior: 'smooth' });
        };

        rightBtn.onclick = () => {
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
     * Checks a parent container after an item is removed and removes the container
     * if it is now empty. This prevents empty category headings/carousels.
     * @param {string} containerId - ID of the container parent (e.g., 'category-tops' or 'laundry-basket-card')
     */
    function checkAndRemoveEmptyContainers(containerId) {
        const container = document.getElementById(containerId);

        if (containerId === LAUNDRY_CONTAINER_ID) {
            // Special handling for laundry: check the carousel inside the card
            const carousel = container.querySelector('.item-carousel');
            if (!carousel || carousel.childElementCount === 0) {
                laundryEmptyMessage.style.display = 'block';
            }
            updateNavButtonVisibility(laundryItemsCarousel, laundryScrollLeftBtn, laundryScrollRightBtn);
        }
        else if (container) {
            // Standard category section: check the carousel inside the section
            const carousel = container.querySelector('.item-carousel');
            if (carousel && carousel.childElementCount === 0) {
                container.remove(); // Remove the entire category-section div
            }
        }

        // Final check to see if the main gallery is empty
        const allItemsCount = galleryContainer.querySelectorAll('.item-card').length + laundryItemsCarousel.childElementCount;
        galleryEmpty.style.display = allItemsCount === 0 ? 'block' : 'none';
        galleryLoading.style.display = 'none';
    }


    // --- File Handling and Preview ---
    function handleFile(file) {
        fileToUpload = file;
        const reader = new FileReader();
        reader.onload = (e) => { imagePreview.src = e.target.result; };
        reader.readAsDataURL(file);

        dropZone.style.display = 'none';
        previewArea.style.display = 'block';
        itemDetailsForm.style.display = 'block';
        submitButton.style.display = 'block';
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

    // Add listeners to validate on input change
    itemNameInput.addEventListener('input', validateForm);
    itemCategorySelect.addEventListener('change', validateForm);

    // --- Drag/Drop/Browse Logic ---
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
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
        uploadStatus.className = 'status-info';
        submitButton.disabled = true;

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('item_name', itemNameInput.value.trim());
        formData.append('item_category', itemCategorySelect.value);
        // Send laundry status
        formData.append('in_laundry', laundryCheckbox.checked ? 'true' : 'false');

        try {
            const response = await fetch('/api/wardrobe/upload', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Upload failed');

            uploadStatus.textContent = 'Upload successful!';
            uploadStatus.className = 'status-success';

            // Add new card to the correct carousel
            addCardToGallery(result);

            resetUploadForm();

        } catch (error) {
            uploadStatus.textContent = `Error: ${error.message}`;
            uploadStatus.className = 'status-error';
        } finally {
            validateForm();
            setTimeout(() => { uploadStatus.textContent = ''; }, 3000);
        }
    });

    function resetUploadForm() {
        fileToUpload = null; fileInput.value = '';
        dropZone.style.display = 'block'; previewArea.style.display = 'none';
        itemDetailsForm.style.display = 'none';
        itemNameInput.value = ''; itemCategorySelect.value = '';
        laundryCheckbox.checked = false; // Reset checkbox
        submitButton.style.display = 'none'; submitButton.disabled = true;
        uploadStatus.textContent = '';
    }

    // --- Laundry Status Toggler (MODIFIED) ---
    async function toggleLaundryStatus(item, cardElement) {
        const newStatus = !item.in_laundry;
        // Determine the ID of the section the card is currently in *before* the move
        const currentContainer = cardElement.closest('.category-section') || cardElement.closest('.laundry-card');
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

            // Update item data in memory
            item.in_laundry = newStatus;

            // Animate card removal
            cardElement.style.transition = 'opacity 0.5s, transform 0.5s';
            cardElement.style.opacity = '0.5';

            setTimeout(() => {
                cardElement.remove();
                addCardToGallery(item); // Re-render the card in its new section

                // CRITICAL FIX: Check if the source container is now empty
                if (sourceContainerId) {
                    checkAndRemoveEmptyContainers(sourceContainerId);
                }

                // Check general empty state is handled within checkAndRemoveEmptyContainers
            }, 500);

        } catch (error) {
            console.error('Status update failed:', error);
            alert(`Error updating item status: ${error.message}`);
        }
    }

    // --- Gallery Card Creator ---
    function createItemCard(item) {
        const card = document.createElement('div');
        card.className = `item-card ${item.in_laundry ? 'is-laundry' : 'is-available'}`;
        card.dataset.filename = item.filename;

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = item.name || item.filename;
        img.onerror = () => { img.src = 'https://placehold.co/160x192/e0e0e0/777?text=Error'; };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-button';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = () => {
            const container = card.closest('.category-section') || card.closest('.laundry-card');
            const containerId = container ? container.id : null;
            openDeleteModal(item.filename, card, containerId);
        };

        // Status Toggle Button
        const statusBtn = document.createElement('button');
        statusBtn.className = 'status-toggle-button';
        statusBtn.innerHTML = item.in_laundry ? '🧺' : '🧺';
        statusBtn.title = item.in_laundry ? 'Mark as Available' : 'Send to Laundry';
        statusBtn.onclick = () => {
            toggleLaundryStatus(item, card);
        };

        card.appendChild(img);
        card.appendChild(deleteBtn);
        card.appendChild(statusBtn);
        return card;
    }

    // --- RENDER FUNCTION ---
    function addCardToGallery(item) {
        const category = item.category || 'Other';
        const newCard = createItemCard(item);

        if (item.in_laundry) {
            // Add to Laundry Basket
            laundryItemsCarousel.prepend(newCard);
            laundryEmptyMessage.style.display = 'none';
        } else {
            // Add to Category Carousel (Available Items)
            const categoryId = `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            let categorySection = document.getElementById(categoryId);
            let carousel;

            if (!categorySection) {
                // Create section if it doesn't exist
                categorySection = document.createElement('div');
                categorySection.className = 'category-section';
                categorySection.id = categoryId;

                const heading = document.createElement('h3');
                heading.textContent = category;
                categorySection.appendChild(heading);

                carousel = document.createElement('div');
                carousel.className = 'item-carousel';
                categorySection.appendChild(carousel);
                galleryContainer.appendChild(categorySection);
            } else {
                carousel = categorySection.querySelector('.item-carousel');
            }

            carousel.prepend(newCard);
            galleryEmpty.style.display = 'none';
        }

        // Ensure initial loading state is cleared
        galleryLoading.style.display = 'none';

        // Update laundry nav visibility after adding/moving items
        updateNavButtonVisibility(laundryItemsCarousel, laundryScrollLeftBtn, laundryScrollRightBtn);
    }

    // --- Load Wardrobe and Group ---
    async function loadWardrobe() {
        try {
            const response = await fetch('/api/wardrobe');
            if (!response.ok) throw new Error('Could not fetch wardrobe.');

            const items = await response.json();

            // Clear containers before rendering
            galleryContainer.innerHTML = '';
            laundryItemsCarousel.innerHTML = '';

            let availableCount = 0;
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

            // Render Available Items (and their sections)
            if (availableCount === 0) {
                galleryEmpty.style.display = 'block';
            } else {
                galleryEmpty.style.display = 'none';
                const sortedCategories = Object.keys(groupedAvailableItems).sort();

                sortedCategories.forEach(category => {
                    const categoryId = `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                    const categorySection = document.createElement('div');
                    categorySection.className = 'category-section';
                    categorySection.id = categoryId;

                    const heading = document.createElement('h3');
                    heading.textContent = category;
                    categorySection.appendChild(heading);

                    const carousel = document.createElement('div');
                    carousel.className = 'item-carousel';
                    groupedAvailableItems[category].forEach(item => {
                        carousel.appendChild(createItemCard(item));
                    });
                    categorySection.appendChild(carousel);
                    galleryContainer.appendChild(categorySection);
                });
            }

            // Final state cleanup
            checkAndRemoveEmptyContainers(LAUNDRY_CONTAINER_ID); // Check laundry basket state
            galleryLoading.style.display = 'none';

            // Setup and update navigation for the laundry carousel
            setupCarouselNavigation(laundryItemsCarousel, laundryScrollLeftBtn, laundryScrollRightBtn);


        } catch (error) {
            galleryLoading.textContent = `Error: ${error.message}`;
            galleryLoading.style.color = 'red';
            galleryEmpty.style.display = 'none';
        }
    }

    // --- Delete Logic & Modal (MODIFIED) ---
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

            // Animate card removal
            itemToDelete.cardElement.style.transition = 'all 0.3s ease';
            itemToDelete.cardElement.style.transform = 'scale(0.8)';
            itemToDelete.cardElement.style.opacity = '0';

            const deletedContainerId = itemToDelete.containerId; // Capture ID before cleanup

            setTimeout(() => {
                itemToDelete.cardElement.remove();

                // CRITICAL FIX: Check the container that lost the item
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
        itemToDelete.containerId = containerId; // Store container ID
        deleteModal.style.display = 'flex';
    }

    function closeModal() {
        itemToDelete = { filename: null, cardElement: null, containerId: null };
        deleteModal.style.display = 'none';
    }

    modalCancel.addEventListener('click', closeModal);
    deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeModal(); });


    // --- Initial Load ---
    loadWardrobe();
});