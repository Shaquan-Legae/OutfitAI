/**
 * OutfitAI — Wardrobe Management & AI Vision Recognition
 * Wardrobe Studio Interface Logic
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // Taxonomy Hierarchy
  // =========================================================================
  const CLOTHING_TAXONOMY = {
    "Tops": ["T-Shirt", "Polo", "Shirt", "Blouse", "Tank Top", "Crop Top", "Hoodie", "Sweatshirt", "Sweater", "Cardigan", "Long Sleeve Top", "Jersey"],
    "Bottoms": ["Jeans", "Trousers", "Chinos", "Cargo Pants", "Sweatpants", "Shorts", "Skirt", "Leggings"],
    "Dresses": ["Mini Dress", "Midi Dress", "Maxi Dress", "Bodycon Dress", "Shirt Dress", "Casual Dress", "Formal Dress"],
    "Outerwear": ["Jacket", "Denim Jacket", "Bomber Jacket", "Leather Jacket", "Blazer", "Coat", "Trench Coat", "Puffer Jacket", "Windbreaker"],
    "Shoes": ["Sneakers", "Running Shoes", "Boots", "Chelsea Boots", "Loafers", "Formal Shoes", "Sandals", "Slides", "Heels", "Flats"],
    "Accessories": ["Cap", "Hat", "Beanie", "Bag", "Backpack", "Belt", "Watch", "Sunglasses", "Scarf", "Jewellery"],
    "Activewear": ["Sports Bra", "Gym Tops", "Gym Shorts", "Leggings", "Tracksuit", "Compression Wear", "Football Jersey"],
    "Formalwear": ["Suit", "Tuxedo", "Evening Gown", "Tailored Trousers", "Waistcoat"],
    "Swimwear": ["Swimsuit", "Swim Shorts", "Bikini", "Cover-up"]
  };

  // Color Swatch Hex Colors (for visual dots)
  const COLOR_HEX_MAP = {
    'Black': '#181715',
    'White': '#FFFFFF',
    'Blue': '#2563EB',
    'Navy': '#1E293B',
    'Light Blue': '#93C5FD',
    'Grey': '#6B7280',
    'Beige': '#D7C4B7',
    'Brown': '#78350F',
    'Green': '#15803D',
    'Red': '#DC2626',
    'Yellow': '#EAB308',
    'Pink': '#EC4899',
    'Purple': '#7E22CE',
    'Orange': '#EA580C',
    'Silver': '#E2E8F0',
    'Gold': '#F59E0B'
  };

  // =========================================================================
  // DOM References
  // =========================================================================
  // Header & Drawer Toggles
  const toggleUploadDrawerBtn = document.getElementById('toggle-upload-drawer-btn');
  const closeUploadDrawerBtn = document.getElementById('close-upload-drawer-btn');
  const uploadStudioSection = document.getElementById('upload-studio-section');

  // Upload Views
  const dropzoneView = document.getElementById('dropzone-view');
  const scanningView = document.getElementById('scanning-view');
  const reviewView = document.getElementById('review-view');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  // Scanning Elements
  const scanningPreviewImg = document.getElementById('scanning-preview-img');
  const scanningStatusTitle = document.getElementById('scanning-status-title');
  const scanningStatusSubtitle = document.getElementById('scanning-status-subtitle');

  // Review Elements
  const reviewPreviewImg = document.getElementById('review-preview-img');
  const reviewRetakeBtn = document.getElementById('review-retake-btn');
  const reviewConfidenceBadge = document.getElementById('review-confidence-badge');
  const reviewConfidenceText = document.getElementById('review-confidence-text');
  const reviewItemName = document.getElementById('review-item-name');
  const reviewCategory = document.getElementById('review-category');
  const reviewSubcategory = document.getElementById('review-subcategory');
  const reviewColorsContainer = document.getElementById('review-colors-container');
  const addColorInput = document.getElementById('add-color-input');
  const addColorBtn = document.getElementById('add-color-btn');
  const reviewPattern = document.getElementById('review-pattern');
  const reviewFit = document.getElementById('review-fit');
  const reviewMaterial = document.getElementById('review-material');
  const reviewStylesChips = document.getElementById('review-styles-chips');
  const reviewSeasonsChips = document.getElementById('review-seasons-chips');
  const reviewLaundryCheckbox = document.getElementById('review-laundry-checkbox');
  const confirmSaveBtn = document.getElementById('confirm-save-btn');
  const cancelUploadBtn = document.getElementById('cancel-upload-btn');
  const saveStatusMsg = document.getElementById('save-status-msg');

  // Navigation & Controls
  const categoryFilterNav = document.getElementById('category-filter-nav');
  const wardrobeSearchInput = document.getElementById('wardrobe-search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const filterModalTrigger = document.getElementById('filter-modal-trigger');
  const activeFilterBadge = document.getElementById('active-filter-badge');
  const wardrobeSortSelect = document.getElementById('wardrobe-sort-select');
  const laundryFilterBtn = document.getElementById('laundry-filter-btn');
  const laundryFilterLabel = document.getElementById('laundry-filter-label');
  const activeFiltersChipsStrip = document.getElementById('active-filters-chips-strip');
  const filterChipsList = document.getElementById('filter-chips-list');
  const clearAllFiltersBtn = document.getElementById('clear-all-filters-btn');

  // Clothing Grid & States
  const clothingGrid = document.getElementById('clothing-grid');
  const wardrobeLoading = document.getElementById('wardrobe-loading');
  const wardrobeEmptyState = document.getElementById('wardrobe-empty-state');
  const wardrobeNoResultsState = document.getElementById('wardrobe-no-results-state');
  const resetSearchFiltersBtn = document.getElementById('reset-search-filters-btn');

  // Laundry Archive
  const laundryArchiveSection = document.getElementById('laundry-archive-section');
  const laundryArchiveToggleBtn = document.getElementById('laundry-archive-toggle-btn');
  const laundryGrid = document.getElementById('laundry-grid');
  const cleanAllLaundryBtn = document.getElementById('clean-all-laundry-btn');

  // Batch Selection
  const toggleSelectionBtn = document.getElementById('toggle-selection-btn');
  const selectBtnText = document.getElementById('select-btn-text');
  const batchDock = document.getElementById('batch-dock');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const selectedItemsCount = document.getElementById('selected-items-count');
  const batchWashBtn = document.getElementById('batch-wash-btn');
  const batchDeleteBtn = document.getElementById('batch-delete-btn');
  const exitSelectionBtn = document.getElementById('exit-selection-btn');

  // Filter Modal
  const filterModal = document.getElementById('filter-modal');
  const closeFilterModalBtn = document.getElementById('close-filter-modal-btn');
  const filterColorOptions = document.getElementById('filter-color-options');
  const filterStyleOptions = document.getElementById('filter-style-options');
  const filterSeasonOptions = document.getElementById('filter-season-options');
  const filterFitOptions = document.getElementById('filter-fit-options');
  const modalClearFiltersBtn = document.getElementById('modal-clear-filters-btn');
  const applyFiltersBtn = document.getElementById('apply-filters-btn');

  // Edit Item Modal
  const itemEditModal = document.getElementById('item-edit-modal');
  const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  const editItemForm = document.getElementById('edit-item-form');
  const editItemId = document.getElementById('edit-item-id');
  const editItemFilename = document.getElementById('edit-item-filename');
  const editItemName = document.getElementById('edit-item-name');
  const editItemCategory = document.getElementById('edit-item-category');
  const editItemSubcategory = document.getElementById('edit-item-subcategory');
  const editItemColors = document.getElementById('edit-item-colors');
  const editItemFit = document.getElementById('edit-item-fit');
  const editItemMaterial = document.getElementById('edit-item-material');
  const editItemPattern = document.getElementById('edit-item-pattern');
  const editItemLaundry = document.getElementById('edit-item-laundry');

  // Stats Counters
  const statTotalItems = document.getElementById('stat-total-items');
  const statTops = document.getElementById('stat-tops');
  const statBottoms = document.getElementById('stat-bottoms');
  const statOuterwear = document.getElementById('stat-outerwear');
  const statShoes = document.getElementById('stat-shoes');
  const statAccessories = document.getElementById('stat-accessories');
  const statLaundry = document.getElementById('stat-laundry');

  // =========================================================================
  // State Management
  // =========================================================================
  let wardrobeData = [];            // Authoritative list of items from API
  let currentFile = null;           // File object currently being analyzed/saved
  let currentFileDataUrl = null;    // Data URL for immediate preview
  let currentAIAnalysis = null;     // Extracted AI attributes
  let selectedColors = new Set();   // Colors currently in the review panel

  // Active Filters & Sorting
  let activeCategory = 'All';
  let activeSearchQuery = '';
  let activeLaundryFilter = 'all';  // 'all' | 'clean' | 'laundry'
  let activeSort = 'newest';
  let activeFilters = {
    colors: new Set(),
    styles: new Set(),
    seasons: new Set(),
    fits: new Set()
  };

  // Selection Mode
  let isSelectionMode = false;
  let selectedItemIds = new Set();

  // Scanning Text Timers
  let scanningInterval = null;

  // =========================================================================
  // 1. Initial Load & Fetching
  // =========================================================================
  async function loadWardrobe() {
    try {
      wardrobeLoading.classList.remove('hidden');
      wardrobeEmptyState.classList.add('hidden');
      wardrobeNoResultsState.classList.add('hidden');
      clothingGrid.innerHTML = '';

      const res = await fetch('/api/wardrobe');
      if (!res.ok) throw new Error('Failed to load wardrobe data');
      wardrobeData = await res.json();

      updateStatistics();
      populateDynamicFilterOptions();
      renderWardrobe();

    } catch (err) {
      console.error('Error loading wardrobe:', err);
      clothingGrid.innerHTML = `
        <div class="col-span-full py-16 text-center text-[#DC2626]">
          <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
          <p class="font-bold">Could not load wardrobe items</p>
          <p class="text-xs text-[#6C6860] mt-1">${err.message}</p>
          <button onclick="loadWardrobe()" class="btn-atelier btn-atelier-secondary mt-4 text-xs">Retry</button>
        </div>
      `;
    } finally {
      wardrobeLoading.classList.add('hidden');
    }
  }

  // =========================================================================
  // 2. Statistics & Dynamic Counts
  // =========================================================================
  function updateStatistics() {
    const total = wardrobeData.length;
    let tops = 0, bottoms = 0, outerwear = 0, shoes = 0, accessories = 0, dresses = 0, activewear = 0, formalwear = 0, inLaundry = 0;

    wardrobeData.forEach(item => {
      const cat = item.category || 'Tops';
      if (cat === 'Tops') tops++;
      else if (cat === 'Bottoms') bottoms++;
      else if (cat === 'Outerwear') outerwear++;
      else if (cat === 'Shoes') shoes++;
      else if (cat === 'Accessories') accessories++;
      else if (cat === 'Dresses') dresses++;
      else if (cat === 'Activewear') activewear++;
      else if (cat === 'Formalwear') formalwear++;

      if (item.in_laundry) inLaundry++;
    });

    if (statTotalItems) statTotalItems.textContent = total;
    if (statTops) statTops.textContent = tops;
    if (statBottoms) statBottoms.textContent = bottoms;
    if (statOuterwear) statOuterwear.textContent = outerwear;
    if (statShoes) statShoes.textContent = shoes;
    if (statAccessories) statAccessories.textContent = accessories;
    if (statLaundry) statLaundry.textContent = inLaundry;

    // Update Category Pill Badges
    const updateCount = (cat, count) => {
      const el = document.getElementById(`count-${cat}`);
      if (el) el.textContent = count;
    };
    updateCount('All', total);
    updateCount('Tops', tops);
    updateCount('Bottoms', bottoms);
    updateCount('Outerwear', outerwear);
    updateCount('Shoes', shoes);
    updateCount('Dresses', dresses);
    updateCount('Accessories', accessories);
    updateCount('Activewear', activewear);
    updateCount('Formalwear', formalwear);
  }

  // =========================================================================
  // 3. Upload & AI Recognition Flow
  // =========================================================================
  function setupUploadHandlers() {
    // Toggle drawer button
    if (toggleUploadDrawerBtn) {
      toggleUploadDrawerBtn.addEventListener('click', () => {
        const isHidden = uploadStudioSection.classList.contains('hidden');
        if (isHidden) {
          uploadStudioSection.classList.remove('hidden');
          uploadStudioSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          toggleUploadDrawerBtn.setAttribute('aria-expanded', 'true');
        } else {
          uploadStudioSection.classList.add('hidden');
          toggleUploadDrawerBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (closeUploadDrawerBtn) {
      closeUploadDrawerBtn.addEventListener('click', () => {
        uploadStudioSection.classList.add('hidden');
        resetUploadForm();
      });
    }

    // Dropzone Click
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag & Drop Events
    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0 && files[0].type.startsWith('image/')) {
        handleImageSelection(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleImageSelection(e.target.files[0]);
      }
    });

    // Retake / Replace
    if (reviewRetakeBtn) {
      reviewRetakeBtn.addEventListener('click', () => {
        resetUploadForm();
      });
    }

    if (cancelUploadBtn) {
      cancelUploadBtn.addEventListener('click', () => {
        uploadStudioSection.classList.add('hidden');
        resetUploadForm();
      });
    }

    // Category Selector Cascade in Review Form
    reviewCategory.addEventListener('change', () => {
      populateSubcategories(reviewCategory.value, reviewSubcategory);
    });

    // Add Color input
    if (addColorBtn && addColorInput) {
      const addColorHandler = () => {
        const val = addColorInput.value.trim();
        if (val) {
          selectedColors.add(val.charAt(0).toUpperCase() + val.slice(1));
          renderReviewColors();
          addColorInput.value = '';
        }
      };
      addColorBtn.addEventListener('click', addColorHandler);
      addColorInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addColorHandler();
        }
      });
    }

    // Style & Season Chips in Review Form
    [reviewStylesChips, reviewSeasonsChips].forEach(container => {
      if (container) {
        container.addEventListener('click', (e) => {
          const chip = e.target.closest('.chip-toggle');
          if (chip) {
            chip.classList.toggle('selected');
          }
        });
      }
    });

    // Save to Wardrobe Button
    confirmSaveBtn.addEventListener('click', handleSaveItem);
  }

  function handleImageSelection(file) {
    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      currentFileDataUrl = e.target.result;
      scanningPreviewImg.src = currentFileDataUrl;
      reviewPreviewImg.src = currentFileDataUrl;
      startAIScanning(file);
    };
    reader.readAsDataURL(file);
  }

  function startAIScanning(file) {
    // Switch to scanning view
    dropzoneView.classList.add('hidden');
    reviewView.classList.add('hidden');
    scanningView.classList.remove('hidden');

    // Progressive status messages
    const messages = [
      { title: "Reading your item...", sub: "Extracting garment silhouette and color profiles..." },
      { title: "Identifying garment...", sub: "Evaluating fabric weaves, pattern, and design details..." },
      { title: "Building wardrobe details...", sub: "Finalizing taxonomy classification and styling tags..." }
    ];
    let msgIdx = 0;
    scanningStatusTitle.textContent = messages[0].title;
    scanningStatusSubtitle.textContent = messages[0].sub;

    if (scanningInterval) clearInterval(scanningInterval);
    scanningInterval = setInterval(() => {
      msgIdx++;
      if (msgIdx < messages.length) {
        scanningStatusTitle.textContent = messages[msgIdx].title;
        scanningStatusSubtitle.textContent = messages[msgIdx].sub;
      }
    }, 1400);

    // Call /api/wardrobe/analyze
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/wardrobe/analyze', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      clearInterval(scanningInterval);
      currentAIAnalysis = data;
      populateReviewPanel(data);
    })
    .catch(err => {
      console.warn('AI analysis request issue, falling back to manual entry:', err);
      clearInterval(scanningInterval);
      const fallback = {
        name: "New Wardrobe Garment",
        category: "Tops",
        subcategory: "T-Shirt",
        colors: ["Black"],
        pattern: "Solid",
        material: "Unknown",
        fit: "Regular",
        styles: ["Casual"],
        seasons: ["All Season"],
        confidence: 0.50,
        notice: "We couldn't confidently identify this item. You can enter the details manually."
      };
      currentAIAnalysis = fallback;
      populateReviewPanel(fallback);
    });
  }

  function populateReviewPanel(data) {
    scanningView.classList.add('hidden');
    reviewView.classList.remove('hidden');

    // Set Name
    reviewItemName.value = data.name || "New Garment";

    // Set Category & Subcategory
    const category = data.category || "Tops";
    reviewCategory.value = category;
    populateSubcategories(category, reviewSubcategory, data.subcategory);

    // Colors
    selectedColors.clear();
    const colors = Array.isArray(data.colors) ? data.colors : [data.colors || "Black"];
    colors.forEach(c => selectedColors.add(c.charAt(0).toUpperCase() + c.slice(1)));
    renderReviewColors();

    // Pattern & Fit & Material
    if (reviewPattern) reviewPattern.value = data.pattern || "Solid";
    if (reviewFit) reviewFit.value = data.fit || "Regular";
    if (reviewMaterial) reviewMaterial.value = data.material || "Cotton";

    // Style Chips
    const styles = Array.isArray(data.styles) ? data.styles.map(s => s.toLowerCase()) : ["casual"];
    reviewStylesChips.querySelectorAll('.chip-toggle').forEach(chip => {
      const val = chip.getAttribute('data-val').toLowerCase();
      if (styles.includes(val)) {
        chip.classList.add('selected');
      } else {
        chip.classList.remove('selected');
      }
    });

    // Seasons Chips
    const seasons = Array.isArray(data.seasons) ? data.seasons.map(s => s.toLowerCase()) : ["all season"];
    reviewSeasonsChips.querySelectorAll('.chip-toggle').forEach(chip => {
      const val = chip.getAttribute('data-val').toLowerCase();
      if (seasons.includes(val) || seasons.includes('all season')) {
        chip.classList.add('selected');
      } else {
        chip.classList.remove('selected');
      }
    });

    // Confidence badge
    const confVal = Math.round((data.confidence || 0.94) * 100);
    reviewConfidenceText.textContent = `${confVal}% Match`;

    // Laundry default false
    reviewLaundryCheckbox.checked = false;
    saveStatusMsg.textContent = '';
  }

  function renderReviewColors() {
    reviewColorsContainer.innerHTML = '';
    selectedColors.forEach(color => {
      const chip = document.createElement('span');
      chip.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFFFFF] border border-[#E8E5DD] shadow-2xs';
      
      const dot = document.createElement('span');
      dot.className = 'color-dot';
      dot.style.backgroundColor = COLOR_HEX_MAP[color] || '#D8D4CA';

      const label = document.createElement('span');
      label.textContent = color;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'text-[#99958C] hover:text-[#DC2626] ml-0.5';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = () => {
        selectedColors.delete(color);
        renderReviewColors();
      };

      chip.appendChild(dot);
      chip.appendChild(label);
      chip.appendChild(removeBtn);
      reviewColorsContainer.appendChild(chip);
    });
  }

  function populateSubcategories(category, selectEl, selectedSub = null) {
    selectEl.innerHTML = '';
    const subs = CLOTHING_TAXONOMY[category] || ["Item"];
    subs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (selectedSub && s.toLowerCase() === selectedSub.toLowerCase()) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  async function handleSaveItem() {
    if (!currentFile) {
      alert('Please upload an image first.');
      return;
    }

    const name = reviewItemName.value.trim();
    if (!name) {
      alert('Please enter an item name.');
      reviewItemName.focus();
      return;
    }

    confirmSaveBtn.disabled = true;
    confirmSaveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Saving to Archive...';
    saveStatusMsg.textContent = 'Saving item and uploading image to storage...';
    saveStatusMsg.className = 'text-xs text-center font-bold text-[#BA512A] h-4';

    // Collect selected styles
    const styles = [];
    reviewStylesChips.querySelectorAll('.chip-toggle.selected').forEach(c => styles.push(c.getAttribute('data-val')));

    // Collect selected seasons
    const seasons = [];
    reviewSeasonsChips.querySelectorAll('.chip-toggle.selected').forEach(c => seasons.push(c.getAttribute('data-val')));

    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('item_name', name);
    formData.append('item_category', reviewCategory.value);
    formData.append('item_subcategory', reviewSubcategory.value);
    formData.append('colors', JSON.stringify(Array.from(selectedColors)));
    formData.append('pattern', reviewPattern.value);
    formData.append('fit', reviewFit.value);
    formData.append('material', reviewMaterial.value.trim() || 'Unknown');
    formData.append('styles', JSON.stringify(styles.length ? styles : ['Casual']));
    formData.append('seasons', JSON.stringify(seasons.length ? seasons : ['All Season']));
    formData.append('in_laundry', reviewLaundryCheckbox.checked ? 'true' : 'false');
    formData.append('confidence', currentAIAnalysis ? currentAIAnalysis.confidence : '0.94');

    try {
      const res = await fetch('/api/wardrobe/upload', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save item');

      saveStatusMsg.textContent = 'Successfully added to wardrobe archive!';
      saveStatusMsg.className = 'text-xs text-center font-bold text-emerald-600 h-4';

      setTimeout(() => {
        uploadStudioSection.classList.add('hidden');
        resetUploadForm();
        loadWardrobe(); // Re-fetch items
      }, 900);

    } catch (err) {
      console.error('Save error:', err);
      saveStatusMsg.textContent = `Error: ${err.message}`;
      saveStatusMsg.className = 'text-xs text-center font-bold text-[#DC2626] h-4';
      confirmSaveBtn.disabled = false;
      confirmSaveBtn.innerHTML = '<i class="fa-solid fa-check mr-1.5"></i> Add to Wardrobe';
    }
  }

  function resetUploadForm() {
    currentFile = null;
    currentFileDataUrl = null;
    currentAIAnalysis = null;
    fileInput.value = '';
    selectedColors.clear();

    dropzoneView.classList.remove('hidden');
    scanningView.classList.add('hidden');
    reviewView.classList.add('hidden');

    confirmSaveBtn.disabled = false;
    confirmSaveBtn.innerHTML = '<i class="fa-solid fa-check mr-1.5"></i> Add to Wardrobe';
    saveStatusMsg.textContent = '';
  }

  // =========================================================================
  // 4. Wardrobe Cards Creation & Grid Rendering
  // =========================================================================
  function renderWardrobe() {
    clothingGrid.innerHTML = '';
    laundryGrid.innerHTML = '';

    const filteredItems = getFilteredAndSortedItems();

    // Check overall empty state
    if (wardrobeData.length === 0) {
      wardrobeEmptyState.classList.remove('hidden');
      wardrobeNoResultsState.classList.add('hidden');
      return;
    }
    wardrobeEmptyState.classList.add('hidden');

    // Check filtered results empty state
    if (filteredItems.length === 0) {
      wardrobeNoResultsState.classList.remove('hidden');
      return;
    }
    wardrobeNoResultsState.classList.add('hidden');

    // Render Clothing Cards in Main Grid
    filteredItems.forEach(item => {
      const card = createClothingCard(item);
      clothingGrid.appendChild(card);
    });

    // Also populate Laundry Section if visible
    const laundryItems = wardrobeData.filter(i => i.in_laundry);
    if (laundryItems.length > 0) {
      laundryItems.forEach(item => {
        laundryGrid.appendChild(createLaundryCompactCard(item));
      });
    }
  }

  function createClothingCard(item) {
    const card = document.createElement('article');
    const isSelected = selectedItemIds.has(item.id || item.filename);
    card.className = `clothing-card group ${item.in_laundry ? 'in-laundry' : ''} ${isSelected ? 'selected' : ''}`;
    card.dataset.id = item.id || item.filename;
    card.dataset.filename = item.filename;

    // Selection checkbox
    const checkbox = document.createElement('div');
    checkbox.className = 'card-select-checkbox';
    checkbox.innerHTML = '<i class="fa-solid fa-check"></i>';
    checkbox.onclick = (e) => {
      e.stopPropagation();
      toggleItemSelection(item.id || item.filename);
    };

    // Quick Action Buttons
    const quickActions = document.createElement('div');
    quickActions.className = 'card-quick-actions';

    // Wash toggle button
    const washBtn = document.createElement('button');
    washBtn.className = `action-icon-btn ${item.in_laundry ? 'is-active-laundry' : ''}`;
    washBtn.title = item.in_laundry ? 'Mark clean' : 'Send to laundry';
    washBtn.setAttribute('aria-label', washBtn.title);
    washBtn.innerHTML = item.in_laundry
      ? '<i class="fa-solid fa-shirt"></i>'
      : '<i class="fa-solid fa-jug-detergent"></i>';
    washBtn.onclick = (e) => {
      e.stopPropagation();
      toggleLaundryStatus(item);
    };

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'action-icon-btn';
    editBtn.title = 'Edit details';
    editBtn.setAttribute('aria-label', 'Edit garment details');
    editBtn.innerHTML = '<i class="fa-solid fa-pen text-[10px]"></i>';
    editBtn.onclick = (e) => {
      e.stopPropagation();
      openEditModal(item);
    };

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-icon-btn hover:!bg-[#DC2626] hover:!text-white';
    deleteBtn.title = 'Delete item';
    deleteBtn.setAttribute('aria-label', 'Delete item');
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can text-[10px]"></i>';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      confirmDeleteItem(item);
    };

    quickActions.appendChild(washBtn);
    quickActions.appendChild(editBtn);
    quickActions.appendChild(deleteBtn);

    // Studio Canvas with image
    const studio = document.createElement('div');
    studio.className = 'clothing-card-studio';

    const img = document.createElement('img');
    img.src = item.imageUrl || item.url;
    img.alt = item.name;
    img.loading = 'lazy';
    img.onerror = () => {
      img.src = 'https://placehold.co/400x500/F3F1EC/99958C?text=Photo+Unavailable';
    };

    studio.appendChild(img);

    // Laundry Pill Badge
    if (item.in_laundry) {
      const laundryPill = document.createElement('div');
      laundryPill.className = 'laundry-pill-badge';
      laundryPill.innerHTML = '<i class="fa-solid fa-jug-detergent text-[9px]"></i><span>Laundry</span>';
      studio.appendChild(laundryPill);
    }

    // Card Details Info
    const info = document.createElement('div');
    info.className = 'clothing-card-info';

    const name = document.createElement('h3');
    name.className = 'clothing-card-name';
    name.textContent = item.name;
    name.title = item.name;

    const sub = document.createElement('div');
    sub.className = 'clothing-card-sub';
    sub.innerHTML = `
      <span>${item.subcategory || 'Garment'}</span>
      <span class="text-[#D8D4CA]">•</span>
      <span class="text-[#99958C]">${item.category}</span>
    `;

    // Micro tags
    const tagsRow = document.createElement('div');
    tagsRow.className = 'clothing-card-tags';

    const firstColor = Array.isArray(item.colors) && item.colors.length ? item.colors[0] : null;
    if (firstColor) {
      const colorTag = document.createElement('span');
      colorTag.className = 'micro-tag';
      colorTag.innerHTML = `
        <span class="color-dot" style="background-color: ${COLOR_HEX_MAP[firstColor] || '#D8D4CA'}"></span>
        <span>${firstColor}</span>
      `;
      tagsRow.appendChild(colorTag);
    }

    if (item.fit && item.fit !== 'Unknown') {
      const fitTag = document.createElement('span');
      fitTag.className = 'micro-tag';
      fitTag.textContent = item.fit;
      tagsRow.appendChild(fitTag);
    }

    info.appendChild(name);
    info.appendChild(sub);
    info.appendChild(tagsRow);

    // Card Click: In selection mode, toggles selection; otherwise opens edit modal
    card.onclick = () => {
      if (isSelectionMode) {
        toggleItemSelection(item.id || item.filename);
      } else {
        openEditModal(item);
      }
    };

    card.appendChild(checkbox);
    card.appendChild(quickActions);
    card.appendChild(studio);
    card.appendChild(info);
    return card;
  }

  function createLaundryCompactCard(item) {
    const card = document.createElement('div');
    card.className = 'relative flex flex-col bg-white border border-[#FDE68A] rounded-xl overflow-hidden shadow-2xs group';

    const imgContainer = document.createElement('div');
    imgContainer.className = 'w-full aspect-square bg-[#FAF5EA] p-2 flex items-center justify-center';

    const img = document.createElement('img');
    img.src = item.imageUrl || item.url;
    img.alt = item.name;
    img.className = 'w-full h-full object-contain grayscale opacity-75';

    imgContainer.appendChild(img);

    const body = document.createElement('div');
    body.className = 'p-2 flex flex-col gap-1';

    const title = document.createElement('p');
    title.className = 'text-xs font-bold text-[#181715] truncate';
    title.textContent = item.name;

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn-atelier btn-atelier-secondary py-1 text-[11px] w-full text-amber-700 hover:bg-amber-100 hover:border-amber-300';
    restoreBtn.innerHTML = '<i class="fa-solid fa-shirt mr-1"></i> Clean';
    restoreBtn.onclick = (e) => {
      e.stopPropagation();
      toggleLaundryStatus(item);
    };

    body.appendChild(title);
    body.appendChild(restoreBtn);

    card.appendChild(imgContainer);
    card.appendChild(body);
    return card;
  }

  // =========================================================================
  // 5. Laundry Toggling & Batch Operations
  // =========================================================================
  async function toggleLaundryStatus(item) {
    const newStatus = !item.in_laundry;
    try {
      // Optimistic update
      item.in_laundry = newStatus;
      renderWardrobe();
      updateStatistics();

      const res = await fetch('/api/wardrobe/toggle_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          filename: item.filename,
          in_laundry: newStatus
        })
      });

      if (!res.ok) throw new Error('Status update failed');

    } catch (err) {
      console.error('Laundry toggle error:', err);
      // Rollback
      item.in_laundry = !newStatus;
      renderWardrobe();
      updateStatistics();
      alert('Could not update laundry status. Please try again.');
    }
  }

  async function confirmDeleteItem(item) {
    if (!confirm(`Delete "${item.name}" permanently from your wardrobe?`)) return;

    try {
      const res = await fetch('/api/wardrobe/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          filename: item.filename
        })
      });

      if (!res.ok) throw new Error('Delete failed');

      // Remove locally
      wardrobeData = wardrobeData.filter(i => (i.id || i.filename) !== (item.id || item.filename));
      selectedItemIds.delete(item.id || item.filename);
      updateStatistics();
      renderWardrobe();

    } catch (err) {
      console.error('Delete error:', err);
      alert('Could not delete item. Please check your connection.');
    }
  }

  // Laundry Archive Drawer Toggle
  if (laundryArchiveToggleBtn) {
    laundryArchiveToggleBtn.addEventListener('click', () => {
      const isHidden = laundryArchiveSection.classList.contains('hidden');
      if (isHidden) {
        laundryArchiveSection.classList.remove('hidden');
        laundryArchiveSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        laundryArchiveSection.classList.add('hidden');
      }
    });
  }

  // Clean all laundry button
  if (cleanAllLaundryBtn) {
    cleanAllLaundryBtn.addEventListener('click', async () => {
      const laundryItems = wardrobeData.filter(i => i.in_laundry);
      if (laundryItems.length === 0) return;

      cleanAllLaundryBtn.disabled = true;
      try {
        const promises = laundryItems.map(item =>
          fetch('/api/wardrobe/toggle_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, filename: item.filename, in_laundry: false })
          })
        );
        await Promise.all(promises);
        laundryItems.forEach(i => i.in_laundry = false);
        updateStatistics();
        renderWardrobe();
      } catch (err) {
        alert('Failed to update all laundry items.');
      } finally {
        cleanAllLaundryBtn.disabled = false;
      }
    });
  }

  // =========================================================================
  // 6. Selection & Batch Mode
  // =========================================================================
  function setupSelectionMode() {
    if (toggleSelectionBtn) {
      toggleSelectionBtn.addEventListener('click', () => {
        isSelectionMode = !isSelectionMode;
        document.body.classList.toggle('selection-active', isSelectionMode);

        if (isSelectionMode) {
          selectBtnText.textContent = 'Cancel Selection';
          toggleSelectionBtn.classList.add('bg-[#181715]', 'text-white');
          batchDock.classList.remove('hidden');
        } else {
          exitSelectionMode();
        }
      });
    }

    if (exitSelectionBtn) {
      exitSelectionBtn.addEventListener('click', exitSelectionMode);
    }

    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const visibleItems = getFilteredAndSortedItems();
        if (checked) {
          visibleItems.forEach(i => selectedItemIds.add(i.id || i.filename));
        } else {
          selectedItemIds.clear();
        }
        updateSelectionUI();
      });
    }

    // Batch Wash
    if (batchWashBtn) {
      batchWashBtn.addEventListener('click', async () => {
        if (selectedItemIds.size === 0) return;
        const itemsToUpdate = wardrobeData.filter(i => selectedItemIds.has(i.id || i.filename));
        
        try {
          const promises = itemsToUpdate.map(item =>
            fetch('/api/wardrobe/toggle_status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: item.id, filename: item.filename, in_laundry: !item.in_laundry })
            })
          );
          await Promise.all(promises);
          itemsToUpdate.forEach(i => i.in_laundry = !i.in_laundry);
          exitSelectionMode();
          updateStatistics();
          renderWardrobe();
        } catch (err) {
          alert('Batch laundry toggle failed.');
        }
      });
    }

    // Batch Delete
    if (batchDeleteBtn) {
      batchDeleteBtn.addEventListener('click', async () => {
        if (selectedItemIds.size === 0) return;
        if (!confirm(`Permanently delete ${selectedItemIds.size} selected items?`)) return;

        try {
          const promises = Array.from(selectedItemIds).map(itemId => {
            const item = wardrobeData.find(i => (i.id || i.filename) === itemId);
            return fetch('/api/wardrobe/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: item ? item.id : itemId, filename: item ? item.filename : itemId })
            });
          });

          await Promise.all(promises);
          wardrobeData = wardrobeData.filter(i => !selectedItemIds.has(i.id || i.filename));
          exitSelectionMode();
          updateStatistics();
          renderWardrobe();
        } catch (err) {
          alert('Batch delete failed.');
        }
      });
    }
  }

  function toggleItemSelection(itemId) {
    if (selectedItemIds.has(itemId)) {
      selectedItemIds.delete(itemId);
    } else {
      selectedItemIds.add(itemId);
    }
    updateSelectionUI();
  }

  function updateSelectionUI() {
    selectedItemsCount.textContent = selectedItemIds.size;

    // Update cards visual state
    document.querySelectorAll('.clothing-card').forEach(card => {
      const id = card.dataset.id;
      if (selectedItemIds.has(id)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  function exitSelectionMode() {
    isSelectionMode = false;
    selectedItemIds.clear();
    document.body.classList.remove('selection-active');
    selectBtnText.textContent = 'Select Items';
    toggleSelectionBtn.classList.remove('bg-[#181715]', 'text-white');
    batchDock.classList.add('hidden');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateSelectionUI();
  }

  // =========================================================================
  // 7. Search, Filtering & Sorting
  // =========================================================================
  function setupFiltersAndSearch() {
    // Primary Category Tabs
    if (categoryFilterNav) {
      categoryFilterNav.addEventListener('click', (e) => {
        const pill = e.target.closest('.cat-pill');
        if (pill) {
          const cat = pill.getAttribute('data-category');
          selectCategoryFilter(cat);
        }
      });
    }

    // Live Search
    if (wardrobeSearchInput) {
      wardrobeSearchInput.addEventListener('input', () => {
        activeSearchQuery = wardrobeSearchInput.value.trim().toLowerCase();
        if (activeSearchQuery.length > 0) {
          clearSearchBtn.classList.remove('hidden');
        } else {
          clearSearchBtn.classList.add('hidden');
        }
        renderWardrobe();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        wardrobeSearchInput.value = '';
        activeSearchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderWardrobe();
      });
    }

    // Sort Dropdown
    if (wardrobeSortSelect) {
      wardrobeSortSelect.addEventListener('change', () => {
        activeSort = wardrobeSortSelect.value;
        renderWardrobe();
      });
    }

    // Laundry Filter Button
    if (laundryFilterBtn) {
      laundryFilterBtn.addEventListener('click', () => {
        if (activeLaundryFilter === 'all') {
          activeLaundryFilter = 'clean';
          laundryFilterLabel.textContent = 'Clean Only';
        } else if (activeLaundryFilter === 'clean') {
          activeLaundryFilter = 'laundry';
          laundryFilterLabel.textContent = 'Laundry Only';
        } else {
          activeLaundryFilter = 'all';
          laundryFilterLabel.textContent = 'All Items';
        }
        renderWardrobe();
        updateActiveFilterChips();
      });
    }

    // Reset Search & Filters Button
    if (resetSearchFiltersBtn) {
      resetSearchFiltersBtn.addEventListener('click', () => {
        resetAllFilters();
      });
    }

    if (clearAllFiltersBtn) {
      clearAllFiltersBtn.addEventListener('click', () => {
        resetAllFilters();
      });
    }

    // Filter Modal Triggers
    if (filterModalTrigger) {
      filterModalTrigger.addEventListener('click', () => {
        filterModal.classList.remove('hidden');
      });
    }

    if (closeFilterModalBtn) {
      closeFilterModalBtn.addEventListener('click', () => {
        filterModal.classList.add('hidden');
      });
    }

    if (modalClearFiltersBtn) {
      modalClearFiltersBtn.addEventListener('click', () => {
        activeFilters.colors.clear();
        activeFilters.styles.clear();
        activeFilters.seasons.clear();
        activeFilters.fits.clear();
        document.querySelectorAll('#filter-modal .chip-toggle').forEach(c => c.classList.remove('selected'));
        updateActiveFilterChips();
        renderWardrobe();
      });
    }

    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', () => {
        filterModal.classList.add('hidden');
        renderWardrobe();
        updateActiveFilterChips();
      });
    }

    // Filter Modal Chip Clicks
    filterModal.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip-toggle');
      if (chip) {
        chip.classList.toggle('selected');
        const filterType = chip.getAttribute('data-filter');
        const val = chip.getAttribute('data-val');

        const targetSet = filterType === 'color' ? activeFilters.colors
          : filterType === 'style' ? activeFilters.styles
          : filterType === 'season' ? activeFilters.seasons
          : activeFilters.fits;

        if (chip.classList.contains('selected')) {
          targetSet.add(val);
        } else {
          targetSet.delete(val);
        }
      }
    });
  }

  function selectCategoryFilter(category) {
    activeCategory = category;
    document.querySelectorAll('.cat-pill').forEach(btn => {
      if (btn.getAttribute('data-category') === category) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });
    renderWardrobe();
  }
  // Expose to window for inline onclick in stats strip
  window.selectCategoryFilter = selectCategoryFilter;

  function populateDynamicFilterOptions() {
    // Collect all available colors and styles from actual wardrobe
    const allColors = new Set();
    const allStyles = new Set();

    wardrobeData.forEach(item => {
      if (Array.isArray(item.colors)) {
        item.colors.forEach(c => allColors.add(c));
      }
      if (Array.isArray(item.styles)) {
        item.styles.forEach(s => allStyles.add(s));
      }
    });

    // Populate Color Options in Modal
    if (filterColorOptions) {
      filterColorOptions.innerHTML = '';
      const sortedColors = Array.from(allColors).sort();
      sortedColors.forEach(color => {
        const chip = document.createElement('span');
        chip.className = `chip-toggle ${activeFilters.colors.has(color) ? 'selected' : ''}`;
        chip.setAttribute('data-filter', 'color');
        chip.setAttribute('data-val', color);
        chip.innerHTML = `
          <span class="color-dot" style="background-color: ${COLOR_HEX_MAP[color] || '#D8D4CA'}"></span>
          <span>${color}</span>
        `;
        filterColorOptions.appendChild(chip);
      });
    }

    // Populate Style Options in Modal
    if (filterStyleOptions) {
      filterStyleOptions.innerHTML = '';
      const sortedStyles = Array.from(allStyles).sort();
      sortedStyles.forEach(style => {
        const chip = document.createElement('span');
        chip.className = `chip-toggle ${activeFilters.styles.has(style) ? 'selected' : ''}`;
        chip.setAttribute('data-filter', 'style');
        chip.setAttribute('data-val', style);
        chip.textContent = style;
        filterStyleOptions.appendChild(chip);
      });
    }
  }

  function getFilteredAndSortedItems() {
    return wardrobeData.filter(item => {
      // 1. Category Filter
      if (activeCategory !== 'All' && (item.category || '').toLowerCase() !== activeCategory.toLowerCase()) {
        return false;
      }

      // 2. Laundry Filter
      if (activeLaundryFilter === 'clean' && item.in_laundry) return false;
      if (activeLaundryFilter === 'laundry' && !item.in_laundry) return false;

      // 3. Search Query Filter (matches across name, category, subcategory, colors, styles, fit, fabric)
      if (activeSearchQuery) {
        const matchString = [
          item.name || '',
          item.category || '',
          item.subcategory || '',
          Array.isArray(item.colors) ? item.colors.join(' ') : (item.colors || ''),
          Array.isArray(item.styles) ? item.styles.join(' ') : (item.styles || ''),
          item.pattern || '',
          item.fit || '',
          item.material || '',
          Array.isArray(item.seasons) ? item.seasons.join(' ') : (item.seasons || '')
        ].join(' ').toLowerCase();

        if (!matchString.includes(activeSearchQuery)) {
          return false;
        }
      }

      // 4. Modal Attribute Filters
      if (activeFilters.colors.size > 0) {
        const itemColors = Array.isArray(item.colors) ? item.colors : [item.colors];
        const hasColor = itemColors.some(c => activeFilters.colors.has(c));
        if (!hasColor) return false;
      }

      if (activeFilters.styles.size > 0) {
        const itemStyles = Array.isArray(item.styles) ? item.styles : [item.styles];
        const hasStyle = itemStyles.some(s => activeFilters.styles.has(s));
        if (!hasStyle) return false;
      }

      if (activeFilters.seasons.size > 0) {
        const itemSeasons = Array.isArray(item.seasons) ? item.seasons : [item.seasons];
        const hasSeason = itemSeasons.some(s => activeFilters.seasons.has(s) || s === 'All Season');
        if (!hasSeason) return false;
      }

      if (activeFilters.fits.size > 0) {
        if (!activeFilters.fits.has(item.fit)) return false;
      }

      return true;

    }).sort((a, b) => {
      // Sorting
      if (activeSort === 'newest') {
        return new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0);
      }
      if (activeSort === 'oldest') {
        return new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0);
      }
      if (activeSort === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (activeSort === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      if (activeSort === 'category') {
        return (a.category || '').localeCompare(b.category || '');
      }
      return 0;
    });
  }

  function updateActiveFilterChips() {
    filterChipsList.innerHTML = '';
    let totalCount = 0;

    // Helper to add chip
    const addChip = (label, onRemove) => {
      totalCount++;
      const chip = document.createElement('span');
      chip.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#181715] text-white text-[11px] font-semibold';
      chip.innerHTML = `<span>${label}</span>`;
      
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'hover:text-[#BA512A] font-bold text-xs ml-0.5';
      rm.innerHTML = '&times;';
      rm.onclick = onRemove;

      chip.appendChild(rm);
      filterChipsList.appendChild(chip);
    };

    activeFilters.colors.forEach(c => addChip(`Color: ${c}`, () => { activeFilters.colors.delete(c); updateActiveFilterChips(); renderWardrobe(); }));
    activeFilters.styles.forEach(s => addChip(`Style: ${s}`, () => { activeFilters.styles.delete(s); updateActiveFilterChips(); renderWardrobe(); }));
    activeFilters.seasons.forEach(s => addChip(`Season: ${s}`, () => { activeFilters.seasons.delete(s); updateActiveFilterChips(); renderWardrobe(); }));
    activeFilters.fits.forEach(f => addChip(`Fit: ${f}`, () => { activeFilters.fits.delete(f); updateActiveFilterChips(); renderWardrobe(); }));

    if (totalCount > 0) {
      activeFiltersChipsStrip.classList.remove('hidden');
      activeFilterBadge.classList.remove('hidden');
      activeFilterBadge.textContent = totalCount;
    } else {
      activeFiltersChipsStrip.classList.add('hidden');
      activeFilterBadge.classList.add('hidden');
    }
  }

  function resetAllFilters() {
    activeCategory = 'All';
    selectCategoryFilter('All');
    activeSearchQuery = '';
    wardrobeSearchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    activeLaundryFilter = 'all';
    laundryFilterLabel.textContent = 'All Items';
    activeFilters.colors.clear();
    activeFilters.styles.clear();
    activeFilters.seasons.clear();
    activeFilters.fits.clear();
    document.querySelectorAll('#filter-modal .chip-toggle').forEach(c => c.classList.remove('selected'));
    updateActiveFilterChips();
    renderWardrobe();
  }

  // =========================================================================
  // 8. Edit Existing Item Modal Handlers
  // =========================================================================
  function setupEditModal() {
    if (closeEditModalBtn) {
      closeEditModalBtn.addEventListener('click', () => itemEditModal.classList.add('hidden'));
    }
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => itemEditModal.classList.add('hidden'));
    }

    editItemCategory.addEventListener('change', () => {
      populateSubcategories(editItemCategory.value, editItemSubcategory);
    });

    editItemForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const itemId = editItemId.value;
      const filename = editItemFilename.value;
      const colorsArr = editItemColors.value.split(',').map(s => s.trim().charAt(0).toUpperCase() + s.trim().slice(1)).filter(Boolean);

      const updates = {
        id: itemId,
        filename: filename,
        name: editItemName.value.trim(),
        category: editItemCategory.value,
        subcategory: editItemSubcategory.value,
        colors: colorsArr.length ? colorsArr : ['Multi-color'],
        fit: editItemFit.value,
        material: editItemMaterial.value.trim() || 'Unknown',
        pattern: editItemPattern.value,
        in_laundry: editItemLaundry.checked
      };

      try {
        const res = await fetch('/api/wardrobe/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });

        if (!res.ok) throw new Error('Update failed');

        // Update local object
        const item = wardrobeData.find(i => (i.id || i.filename) === itemId);
        if (item) {
          Object.assign(item, updates);
        }

        itemEditModal.classList.add('hidden');
        updateStatistics();
        renderWardrobe();

      } catch (err) {
        console.error('Update item error:', err);
        alert('Could not update item details.');
      }
    });
  }

  function openEditModal(item) {
    editItemId.value = item.id || item.filename;
    editItemFilename.value = item.filename;
    editItemName.value = item.name;
    editItemCategory.value = item.category || 'Tops';
    populateSubcategories(editItemCategory.value, editItemSubcategory, item.subcategory);

    editItemColors.value = Array.isArray(item.colors) ? item.colors.join(', ') : (item.colors || '');
    editItemFit.value = item.fit || 'Regular';
    editItemMaterial.value = item.material || 'Cotton';
    editItemPattern.value = item.pattern || 'Solid';
    editItemLaundry.checked = Boolean(item.in_laundry);

    itemEditModal.classList.remove('hidden');
  }

  // =========================================================================
  // Init
  // =========================================================================
  setupUploadHandlers();
  setupSelectionMode();
  setupFiltersAndSearch();
  setupEditModal();
  loadWardrobe();

});