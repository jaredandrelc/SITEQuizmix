const appContainer = document.querySelector('.app-container');
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const restartBtn = document.getElementById('restart-btn');
const libraryBtn = document.getElementById('library-btn');
const nextBtn = document.getElementById('next-btn');
const quizListContainer = document.getElementById('quiz-list');
const qTypeEl = document.getElementById('q-type');
const qTextEl = document.getElementById('q-text');
const qImageEl = document.getElementById('q-image');
const interactionArea = document.getElementById('interaction-area');
const feedbackArea = document.getElementById('feedback-area');
const feedbackMsg = document.getElementById('feedback-msg');
const progressBar = document.getElementById('progress-bar');
const scoreValEl = document.getElementById('score-val');
const scoreBoard = document.getElementById('score-board');
const headerCloseBtn = document.getElementById('header-close-quiz-btn');
const mainSearchContainerGlob = document.getElementById('main-search-container');
const finalScoreVal = document.getElementById('final-score-val');
const courseListEl = document.getElementById('course-list');
const mobileFiltersEl = document.getElementById('mobile-filters');
const courseTitleDisplay = document.getElementById('course-title-display');
let quizLibrary = [];
let activeQuiz = null;
let selectedCourse = 'All Quizzes';
let selectedFilters = [];
let searchQuery = '';
let expandedCourses = new Set();
let justOpenedCourse = null;
let searchSuggestionsPool = [];
let suggestionTypeTimeout = null;
let currentSuggestionIndex = 0;
let isTypingActive = false;
let isInputFocused = false;
let currentIndex = 0;
let score = 0;
let currentQuestionFailed = false;
let sessionResults = [];
let userSettings = {
    showAnswers: true
};

let isInitialLoad = true;

window.addEventListener('DOMContentLoaded', () => {
    // Show Static Skeletons & Spinner Overlay Immediately
    quizListContainer.innerHTML = '';

    // Add the un-selectable, static beating skeletons
    for (let i = 0; i < 6; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'quiz-card skeleton';
        skeleton.innerHTML = `
            <div class="skeleton-title"></div>
            <div class="skeleton-desc"></div>
            <div class="skeleton-tags">
                <div class="skeleton-tag"></div>
                <div class="skeleton-tag"></div>
            </div>
        `;
        quizListContainer.appendChild(skeleton);
    }

    // Inject the CSS circle spinner spinning on top of them
    const spinnerOverlay = document.createElement('div');
    spinnerOverlay.className = 'loading-spinner-overlay';
    spinnerOverlay.innerHTML = '<div class="spinner-ring"></div>';
    quizListContainer.appendChild(spinnerOverlay);

    const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500));

    const fetchQuizzes = Promise.all(QUIZ_INDEX.map(item =>
        fetch(item.url)
            .then(res => {
                if (res.ok) return res.text();
                throw new Error(`Failed to load ${item.url}`);
            })
            .then(text => {
                const name = item.url.split('/').pop().replace('.txt', '');
                const quiz = parseQuiz(text, name);
                quiz.meta.syscat = item.syscat || 'Uncategorized';
                return quiz;
            })
            .catch(err => {
                console.warn(err.message);
                return null;
            })
    )).then(quizzes => {
        quizzes.forEach(quiz => {
            if (quiz) addToLibrary(quiz);
        });
        return true;
    });

    Promise.all([fetchQuizzes, minLoadTime]).then(() => {
        isInitialLoad = false;

        // Populate search suggestion pool & start animation
        const names = quizLibrary.map(q => q.meta.name);
        const categories = quizLibrary.map(q => q.meta.syscat).filter(c => c && c !== 'Uncategorized');
        const coursesList = quizLibrary.map(q => q.meta.course).filter(c => c && c !== 'Uncategorized');
        searchSuggestionsPool = [...new Set([...names, ...categories, ...coursesList])];
        searchSuggestionsPool.sort(() => 0.5 - Math.random());
        startSearchPlaceholderAnimation();

        // Render System Category Filters
        const filterContainer = document.getElementById('filter-options-container');
        if (filterContainer && typeof PRESET_CATEGORIES !== 'undefined') {
            const sysCats = [...PRESET_CATEGORIES];
            const uniqueFilters = [...new Set(sysCats)];

            uniqueFilters.forEach(cat => {
                if (cat === 'All Quizzes') return;
                const label = document.createElement('label');
                label.className = 'filter-option';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = cat;
                label.appendChild(cb);
                label.appendChild(document.createTextNode(' ' + cat));
                filterContainer.appendChild(label);
            });
        }

        // Search Input listener
        const searchInput = document.getElementById('quiz-search-input');
        if (searchInput) {
            searchInput.addEventListener('focus', () => {
                isInputFocused = true;
                searchInput.placeholder = 'Search quizzes...'; // Preemptively clear the active typed frame
            });

            searchInput.addEventListener('blur', () => {
                isInputFocused = false;
                if (searchInput.value.trim() === '') {
                    if (!isTypingActive && searchSuggestionsPool.length > 0) {
                        startSearchPlaceholderAnimation();
                    }
                }
            });

            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.toLowerCase();

                // When actively searching, auto-default to 'All Quizzes' visually and functionally
                if (searchQuery.trim() !== '') {
                    selectedCourse = 'All Quizzes';
                    // Update sidebar active states
                    const allSidebarItems = document.querySelectorAll('.course-item');
                    allSidebarItems.forEach(item => {
                        if (item.dataset.value === 'All Quizzes') {
                            item.classList.add('active');
                        } else {
                            item.classList.remove('active');
                        }
                    });
                }

                renderLibrary();
            });
        }

        // Mobile Search Toggle Logic
        const mobileSearchToggleBtn = document.getElementById('mobile-search-toggle');
        const mainSearchContainer = document.getElementById('main-search-container');
        const mobileSearchIcon = document.getElementById('mobile-search-icon');

        if (mobileSearchToggleBtn && mainSearchContainer && mobileSearchIcon) {
            mobileSearchToggleBtn.addEventListener('click', () => {
                const isActive = mainSearchContainer.classList.toggle('mobile-active');
                if (isActive) {
                    mobileSearchIcon.textContent = 'close';
                    if (searchInput) {
                        // Small timeout to allow css layout to settle before focusing
                        setTimeout(() => searchInput.focus(), 50);
                    }
                } else {
                    mobileSearchIcon.textContent = 'search';
                    if (searchInput) searchInput.blur();
                }
            });
        }

        // Filter Modal Logic
        const filterBtn = document.getElementById('search-filter-btn');
        const filterModal = document.getElementById('filter-modal');
        const closeFilterBtn = document.getElementById('close-filter-btn');
        const applyFiltersBtn = document.getElementById('apply-filters-btn');
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        const filterOverlay = document.querySelector('.filter-overlay');

        if (filterBtn && filterModal) {
            filterBtn.addEventListener('click', () => {
                filterModal.classList.remove('hidden');
            });

            const closeFModal = () => filterModal.classList.add('hidden');
            if (closeFilterBtn) closeFilterBtn.addEventListener('click', closeFModal);

            if (filterOverlay) {
                filterOverlay.addEventListener('click', (e) => {
                    if (e.target === filterModal) closeFModal();
                });
            }

            if (applyFiltersBtn) {
                applyFiltersBtn.addEventListener('click', () => {
                    const cbs = filterContainer.querySelectorAll('input[type="checkbox"]');
                    selectedFilters = Array.from(cbs).filter(c => c.checked).map(c => c.value);
                    renderLibrary();
                    renderSidebar();
                    closeFModal();
                });
            }

            if (clearFiltersBtn) {
                clearFiltersBtn.addEventListener('click', () => {
                    const cbs = filterContainer.querySelectorAll('input[type="checkbox"]');
                    cbs.forEach(c => c.checked = false);
                    selectedFilters = [];
                    renderLibrary();
                    renderSidebar();
                    closeFModal();
                });
            }
        }

        renderSidebar();
        renderLibrary();

        handleRouting();
    });
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const brandLogo = document.querySelector('.logo');
    const exitModal = document.getElementById('exit-modal');
    const modalStayBtn = document.getElementById('modal-stay-btn');
    const modalLeaveBtn = document.getElementById('modal-leave-btn');
    const closeModal = () => {
        exitModal.classList.add('hidden');
    };
    if (brandLogo) {
        brandLogo.style.cursor = 'pointer';
        brandLogo.addEventListener('click', (e) => {
            if (activeQuiz && quizScreen.classList.contains('active')) {
                exitModal.classList.remove('hidden');
            } else {
                // Reset search, filters, and course to original state
                searchQuery = '';
                selectedCourse = 'All Quizzes';
                selectedFilters = [];
                const searchInput = document.getElementById('quiz-search-input');
                if (searchInput) searchInput.value = '';
                // Uncheck all filter checkboxes
                const cbs = document.querySelectorAll('#filter-options-container input[type="checkbox"]');
                cbs.forEach(cb => cb.checked = false);
                // Collapse mobile search if open
                const msc = document.getElementById('main-search-container');
                if (msc) msc.classList.remove('mobile-active');
                const msi = document.getElementById('mobile-search-icon');
                if (msi) msi.textContent = 'search';

                if (activeQuiz) {
                    window.location.hash = '';
                } else if (startScreen.classList.contains('active')) {
                    document.querySelector('.content-area').scrollTop = 0;
                }
                renderSidebar();
                renderLibrary();
            }
        });
    }
    if (modalStayBtn) modalStayBtn.addEventListener('click', closeModal);
    if (modalLeaveBtn) {
        modalLeaveBtn.addEventListener('click', () => {
            closeModal();
            window.location.hash = '';
        });
    }
    if (exitModal) {
        exitModal.onclick = (e) => {
            if (e.target === exitModal) closeModal();
        };
    }
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
    const explanationModal = document.getElementById('explanation-modal');
    const closeExplanationBtn = document.getElementById('close-explanation-btn');
    const closeExplanationActionBtn = document.getElementById('close-explanation-action-btn');
    function closeExplanation() {
        explanationModal.classList.add('hidden');
    }
    if (closeExplanationBtn) closeExplanationBtn.onclick = closeExplanation;
    if (closeExplanationActionBtn) closeExplanationActionBtn.onclick = closeExplanation;
    if (explanationModal) {
        explanationModal.onclick = (e) => {
            if (e.target === explanationModal) closeExplanation();
        };
    }
    let lightboxOverlay = document.getElementById('lightbox-overlay');
    if (!lightboxOverlay) {
        lightboxOverlay = document.createElement('div');
        lightboxOverlay.id = 'lightbox-overlay';
        lightboxOverlay.className = 'lightbox-overlay';
        lightboxOverlay.innerHTML = `
            <button class="lightbox-close">&times;</button>
            <img id="lightbox-img" src="" alt="Zoomed Image">
        `;
        document.body.appendChild(lightboxOverlay);
    }
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = lightboxOverlay.querySelector('.lightbox-close');
    window.openLightbox = function (src) {
        if (!src) return;
        lightboxImg.src = src;
        lightboxOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };
    const closeLB = () => {
        lightboxOverlay.classList.remove('active');
        document.body.style.overflow = '';
        setTimeout(() => { lightboxImg.src = ''; }, 200);
    };
    lightboxClose.addEventListener('click', closeLB);
    lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === lightboxOverlay) closeLB();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightboxOverlay.classList.contains('active')) closeLB();
    });
    function toggleMenu() {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }
    menuBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
});
window.addEventListener('hashchange', handleRouting);
function handleRouting() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const quiz = quizLibrary.find(q => q.meta.id === hash);
        if (quiz) {
            startQuiz(quiz);
        } else {
            console.warn(`Quiz ID ${hash} not found.`);
            returnToLibrary();
        }
    } else {
        returnToLibrary();
    }
}
restartBtn.addEventListener('click', () => {
    if (activeQuiz) {
        startQuiz(activeQuiz);
    }
});
if (libraryBtn) {
    libraryBtn.addEventListener('click', () => {
        window.location.hash = '';
    });
}
if (headerCloseBtn) {
    headerCloseBtn.addEventListener('click', () => {
        const exitModal = document.getElementById('exit-modal');
        if (exitModal) exitModal.classList.remove('hidden');
    });
}
nextBtn.addEventListener('click', () => {
    nextQuestion();
});
function returnToLibrary() {
    activeQuiz = null;
    resultScreen.classList.remove('active');
    quizScreen.classList.remove('active');
    scoreBoard.classList.add('hidden');
    if (headerCloseBtn) headerCloseBtn.classList.add('hidden');
    if (mainSearchContainerGlob) mainSearchContainerGlob.classList.remove('hidden');
    const menuBtnEl = document.getElementById('menu-btn');
    if (menuBtnEl) menuBtnEl.style.display = '';
    const hc = document.querySelector('.header-content');
    if (hc) hc.classList.remove('quiz-active');
    startScreen.classList.add('active');
    renderLibrary();
    if (window.location.hash !== '' && !window.location.hash.includes('#')) {
    }
}
function addToLibrary(quiz) {
    const exists = quizLibrary.find(q => q.meta.name === quiz.meta.name);
    if (!exists) {
        quizLibrary.push(quiz);
    }
}
function renderLibrary() {
    if (isInitialLoad) return; // Skeletons and CSS spinner handle the display

    quizListContainer.innerHTML = '';

    const filtered = quizLibrary.filter(q => {
        // Evaluate Course (Sidebar)
        let matchesCourse = selectedCourse === 'All Quizzes' || q.meta.course === selectedCourse;

        // Evaluate Filter Categories (OR Logic on System Categories)
        let matchesFilter = true;
        if (selectedFilters.length > 0) {
            matchesFilter = selectedFilters.some(filter => q.meta.syscat === filter);
        }

        // Evaluate Search Query
        let matchesSearch = true;
        if (searchQuery.trim() !== '') {
            const sq = searchQuery.toLowerCase();
            const nameMatch = q.meta.name && q.meta.name.toLowerCase().includes(sq);
            const courseMatch = q.meta.course && q.meta.course.toLowerCase().includes(sq);
            const syscatMatch = q.meta.syscat && q.meta.syscat.toLowerCase().includes(sq);
            matchesSearch = nameMatch || courseMatch || syscatMatch;
        }

        return matchesCourse && matchesFilter && matchesSearch;
    });

    const ctd = document.getElementById('course-title-display');
    const std = document.getElementById('search-tags-display');
    if (ctd) {
        ctd.style.display = 'block';

        let labelText = selectedCourse;
        if (searchQuery.trim() !== '') {
            labelText = `Searching ${selectedCourse}`;
        }
        ctd.textContent = labelText;
    }

    // Render filter tags as pill badges underneath the title
    if (std) {
        if (selectedFilters.length > 0) {
            std.classList.remove('hidden');
            const maxShow = 2;
            const visible = selectedFilters.slice(0, maxShow);
            let html = visible.map(f =>
                `<span class="tag">${f}<button class="tag-close" data-filter="${f}" title="Remove filter">&times;</button></span>`
            ).join('');

            if (selectedFilters.length > maxShow) {
                const remaining = selectedFilters.length - maxShow;
                html += `<span class="tag-more">+${remaining} other tag${remaining > 1 ? 's' : ''}</span>`;
            }
            std.innerHTML = html;

            // Wire up close buttons to remove individual filters
            std.querySelectorAll('.tag-close').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const filterVal = btn.dataset.filter;
                    selectedFilters = selectedFilters.filter(f => f !== filterVal);
                    // Uncheck the corresponding checkbox in the filter modal
                    const cb = document.querySelector(`#filter-options-container input[value="${filterVal}"]`);
                    if (cb) cb.checked = false;
                    renderLibrary();
                    renderSidebar();
                });
            });
        } else {
            std.classList.add('hidden');
            std.innerHTML = '';
        }
    }

    if (filtered.length === 0) {
        if (quizLibrary.length === 0) {
            quizListContainer.innerHTML = '<p class="empty-msg">No local quizzes found. Check GitHub for updates.</p>';
        } else {
            quizListContainer.innerHTML = '<p class="empty-msg">No quizzes matching your criteria.</p>';
        }
        return;
    }
    filtered.forEach((quiz, index) => {
        const card = document.createElement('div');
        card.className = 'quiz-card cascade-animate';
        // Stagger entrance with a 60ms delay per card
        card.style.animationDelay = `${index * 0.06}s`;
        const title = document.createElement('h3');
        title.textContent = quiz.meta.name;
        const desc = document.createElement('p');
        desc.textContent = quiz.meta.description || "No description provided.";

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'quiz-tags';

        const courseOpt = quiz.meta.course || 'Uncategorized';
        const syscatOpt = quiz.meta.syscat || 'Uncategorized';

        if (courseOpt !== 'Uncategorized') {
            const courseTag = document.createElement('span');
            courseTag.className = 'quiz-tag course-tag';
            courseTag.textContent = courseOpt;
            tagsContainer.appendChild(courseTag);
        }

        if (syscatOpt !== 'Uncategorized') {
            const syscatTag = document.createElement('span');
            syscatTag.className = 'quiz-tag syscat-tag';
            syscatTag.textContent = syscatOpt;
            tagsContainer.appendChild(syscatTag);
        }

        const lengthTag = document.createElement('span');
        lengthTag.className = 'quiz-tag length-tag';
        lengthTag.textContent = `${quiz.questions.length} Questions`;
        tagsContainer.appendChild(lengthTag);

        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(tagsContainer);
        card.onclick = () => {
            window.location.hash = quiz.meta.id;
        };
        quizListContainer.appendChild(card);
    });
}

function renderSidebar() {
    const courses = new Set(['All Quizzes']);
    const courseData = { 'All Quizzes': { count: quizLibrary.length, syscats: new Set() } };

    quizLibrary.forEach(q => {
        if (q.meta.course && q.meta.course !== 'Uncategorized') {
            courses.add(q.meta.course);
            if (!courseData[q.meta.course]) courseData[q.meta.course] = { count: 0, syscats: new Set() };
            courseData[q.meta.course].count++;

            if (q.meta.syscat && q.meta.syscat !== 'Uncategorized') {
                courseData[q.meta.course].syscats.add(q.meta.syscat);
            }
        }
    });

    courseListEl.innerHTML = '';
    mobileFiltersEl.innerHTML = '';

    // Desktop: Nested Tree Generation
    courses.forEach(course => {
        const createGroup = () => {
            const group = document.createElement('div');
            group.className = 'course-group';

            const item = document.createElement('div');
            const isCourseActive = selectedCourse === course;
            item.className = `course-item ${isCourseActive && selectedFilters.length === 0 ? 'active' : ''}`;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'course-item-content';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = course;

            let childrenContainer = null;
            let expandIcon = null;

            if (course !== 'All Quizzes' && courseData[course].syscats.size > 0) {
                expandIcon = document.createElement('span');
                expandIcon.className = 'material-symbols-rounded expand-icon';
                expandIcon.textContent = expandedCourses.has(course) ? 'folder_open' : 'folder';
                contentDiv.appendChild(expandIcon);

                if (expandedCourses.has(course)) item.classList.add('expanded');

                childrenContainer = document.createElement('div');
                childrenContainer.className = `course-children ${expandedCourses.has(course) ? 'open' : ''}`;
                if (course === justOpenedCourse) {
                    childrenContainer.classList.add('animating');
                }

                courseData[course].syscats.forEach(syscat => {
                    const syscatItem = document.createElement('div');
                    const isActiveSyscat = selectedFilters.includes(syscat) && selectedCourse === course;
                    syscatItem.className = `syscat-item ${isActiveSyscat ? 'active' : ''}`;

                    const syscatName = document.createElement('span');
                    syscatName.textContent = syscat;
                    syscatItem.appendChild(syscatName);

                    // No course-count spans for system categories as per user request

                    syscatItem.onclick = (e) => {
                        e.stopPropagation();
                        selectedCourse = course;
                        selectedFilters = [syscat];

                        // Sync with modal checkboxes
                        const filterContainer = document.getElementById('filter-options-container');
                        if (filterContainer) {
                            const cbs = filterContainer.querySelectorAll('input[type="checkbox"]');
                            cbs.forEach(c => c.checked = (c.value === syscat));
                        }

                        renderLibrary();
                        renderSidebar();
                    };
                    childrenContainer.appendChild(syscatItem);
                });
            }

            contentDiv.appendChild(nameSpan);
            item.appendChild(contentDiv);

            const countSpan = document.createElement('span');
            countSpan.className = 'course-count';
            countSpan.textContent = courseData[course].count;
            item.appendChild(countSpan);

            item.onclick = (e) => {
                e.stopPropagation();
                if (childrenContainer) {
                    if (expandedCourses.has(course)) {
                        expandedCourses.delete(course);
                    } else {
                        expandedCourses.add(course);
                        justOpenedCourse = course;
                    }
                }

                selectedCourse = course;
                selectedFilters = []; // Reset syscat filters when clicking root folder
                const filterContainer = document.getElementById('filter-options-container');
                if (filterContainer) {
                    const cbs = filterContainer.querySelectorAll('input[type="checkbox"]');
                    cbs.forEach(c => c.checked = false);
                }

                renderLibrary();
                renderSidebar();
            };

            group.appendChild(item);
            if (childrenContainer) group.appendChild(childrenContainer);

            return group;
        };

        courseListEl.appendChild(createGroup());
    });

    // Mobile: Simple Tabs (Limit 8) + Hamburger Overlay Trigger
    const coursesArr = Array.from(courses);
    const mobileLimit = Math.min(coursesArr.length, 8);
    for (let i = 0; i < mobileLimit; i++) {
        const course = coursesArr[i];
        const chip = document.createElement('div');
        const isCourseActive = selectedCourse === course;
        chip.className = `course-item ${isCourseActive && selectedFilters.length === 0 ? 'active' : ''}`;

        const chipNameSpan = document.createElement('span');
        chipNameSpan.textContent = course;
        chip.appendChild(chipNameSpan);

        chip.onclick = () => {
            selectedCourse = course;
            selectedFilters = []; // Force clear on generic select
            renderLibrary();
            renderSidebar();
        };
        mobileFiltersEl.appendChild(chip);
    }

    if (coursesArr.length > 8) {
        const moreChip = document.createElement('div');
        moreChip.className = 'course-item';
        moreChip.style.display = 'flex';
        moreChip.style.alignItems = 'center';
        moreChip.style.gap = '5px';

        const moreIcon = document.createElement('span');
        moreIcon.className = 'material-symbols-rounded';
        moreIcon.textContent = 'menu';
        moreIcon.style.fontSize = '1.2rem';
        moreChip.appendChild(moreIcon);

        moreChip.onclick = () => {
            const sidebarBtn = document.getElementById('menu-btn');
            if (sidebarBtn) sidebarBtn.click();
        };
        mobileFiltersEl.appendChild(moreChip);
    }

    justOpenedCourse = null;
}

function selectCourse(course) {
    selectedCourse = course;
    selectedFilters = []; // Force clear on generic select
    renderLibrary();
    renderSidebar();
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            document.querySelector('.sidebar-overlay').classList.remove('active');
        }
    }
}

function parseQuiz(text, filenameFallback) {
    const blocks = text.split('**').map(b => b.trim()).filter(b => b.length > 0);
    let meta = {
        id: filenameFallback,
        name: filenameFallback.replace('.txt', ''),
        description: '',
        course: 'Uncategorized',
        settings: { showAnswers: true }
    };
    let questions = [];
    let startIndex = 0;
    if (blocks[0] && blocks[0].includes('&$NAME:')) {
        const lines = blocks[0].split('\n').map(l => l.trim());
        lines.forEach(line => {
            if (line.startsWith('&$NAME:')) meta.name = line.replace('&$NAME:', '').trim();
            if (line.startsWith('&$COURSE:')) meta.course = line.replace('&$COURSE:', '').trim();
            if (line.startsWith('&$DESC:')) meta.description = line.replace('&$DESC:', '').trim();
            if (line.startsWith('&$SETTING:')) {
                const settingPart = line.replace('&$SETTING:', '').trim();
                if (settingPart.includes('show_answers=false')) meta.settings.showAnswers = false;
            }
        });
        startIndex = 1;
    } else {
    }
    for (let i = startIndex; i < blocks.length; i++) {
        const lines = blocks[i].split('\n').map(l => l.trim()).filter(l => l);
        let type = 'MC';
        let question = '';
        let image = null;
        let explanation = null;
        let options = [];
        lines.forEach(line => {
            if (line.startsWith('&$T:')) {
                type = line.replace('&$T:', '').trim().toUpperCase();
            } else if (line.startsWith('&$Q:')) {
                question = line.replace('&$Q:', '').trim();
            } else if (line.startsWith('&$IMG:')) {
                image = line.replace('&$IMG:', '').trim();
            } else if (line.startsWith('&$O:')) {
                options.push(line.replace('&$O:', '').trim());
            } else if (line.startsWith('&$E:')) {
                explanation = line.replace('&$E:', '').trim();
            }
        });
        if (type === 'MULTIPLE CHOICE') type = 'MC';
        if (type === 'CHECKBOX') type = 'CHECK';
        if (question) {
            questions.push({ type, question, options, image, explanation });
        }
    }
    return { meta, questions };
}
function startQuiz(quizObj) {
    showQuizSplash(quizObj);
}
function showQuizSplash(quizObj) {
    if (!quizObj) return;
    const splashModal = document.getElementById('quiz-splash-modal');
    const splashTitle = document.getElementById('splash-title');
    const splashCourse = document.getElementById('splash-course');
    const splashMeta = document.getElementById('splash-meta');
    const splashDesc = document.getElementById('splash-desc');
    const playBtn = document.getElementById('splash-play-btn');
    const libBtn = document.getElementById('splash-library-btn');
    splashTitle.textContent = quizObj.meta.name;
    splashCourse.textContent = quizObj.meta.course || 'Uncategorized';
    splashMeta.textContent = `${quizObj.questions.length} Questions`;
    const desc = quizObj.meta.description || "No description provided.";
    splashDesc.textContent = desc.length > 150 ? desc.substring(0, 150) + '...' : desc;
    splashModal.classList.remove('hidden');
    playBtn.onclick = () => {
        splashModal.classList.add('hidden');
        startQuizSession(quizObj);
    };
    libBtn.onclick = () => {
        splashModal.classList.add('hidden');
        window.location.hash = '';
        returnToLibrary();
    };
}
function startQuizSession(quizObj) {
    if (!quizObj || quizObj.questions.length === 0) {
        alert("This quiz has no valid questions.");
        return;
    }
    activeQuiz = quizObj;
    userSettings.showAnswers = quizObj.meta.settings.showAnswers;
    startScreen.classList.remove('active');
    quizScreen.classList.add('active');
    scoreBoard.classList.remove('hidden');
    if (headerCloseBtn) headerCloseBtn.classList.remove('hidden');
    if (mainSearchContainerGlob) mainSearchContainerGlob.classList.add('hidden');
    const menuBtnEl = document.getElementById('menu-btn');
    if (menuBtnEl) menuBtnEl.style.display = 'none';
    const hc = document.querySelector('.header-content');
    if (hc) hc.classList.add('quiz-active');
    resultScreen.classList.remove('active');
    currentIndex = 0;
    score = 0;
    currentQuestionFailed = false;
    sessionResults = [];
    scoreValEl.textContent = 0;
    renderQuestion();
}
function renderQuestion() {
    const q = activeQuiz.questions[currentIndex];
    const total = activeQuiz.questions.length;
    qTypeEl.textContent = getTypeName(q.type);
    qTextEl.textContent = q.question;
    const imgContainer = document.getElementById('q-image-container');
    const qImage = document.getElementById('q-image');
    if (q.image) {
        qImage.src = q.image;
        imgContainer.classList.remove('hidden');
        const viewLargerBtn = document.getElementById('view-larger-btn');
        if (viewLargerBtn) {
            viewLargerBtn.onclick = () => openLightbox(q.image);
        }
        qImage.onclick = () => openLightbox(q.image);
    } else {
        imgContainer.classList.add('hidden');
        qImage.src = '';
    }
    progressBar.style.width = `${((currentIndex) / total) * 100}%`;
    interactionArea.innerHTML = '';
    feedbackArea.classList.add('hidden');
    feedbackArea.className = 'feedback-area hidden';
    interactionArea.classList.remove('has-feedback');
    interactionArea.scrollTop = 0;
    const dyns = feedbackArea.querySelectorAll('.why-btn, .answer-reveal');
    dyns.forEach(el => el.remove());
    currentQuestionFailed = false;
    switch (q.type) {
        case 'MC':
            renderMC(q);
            break;
        case 'MATCH':
            renderMatching(q);
            break;
        case 'IDENT':
            renderIdentification(q);
            break;
        case 'BLOCK':
            renderBlock(q);
            break;
        case 'CHECK':
            renderCheckbox(q);
            break;
        default:
            interactionArea.innerHTML = '<p>Unknown Question Type</p>';
    }
}
function getTypeName(type) {
    const map = {
        'MC': 'Multiple Choice',
        'MATCH': 'Matching',
        'IDENT': 'Identification',
        'BLOCK': 'Sentence Assembly',
        'CHECK': 'Checkbox'
    };
    return map[type] || type;
}
function renderMC(q) {
    const opts = q.options.map(opt => {
        const isCorrect = opt.startsWith('*');
        const text = isCorrect ? opt.substring(1) : opt;
        return { text, isCorrect };
    });
    opts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt.text;
        btn.onclick = () => handleMCAnswer(btn, opt, opts);
        interactionArea.appendChild(btn);
    });
}
function renderMatching(q) {
    const container = document.createElement('div');
    container.className = 'matching-container';
    const leftCol = document.createElement('div');
    leftCol.className = 'match-col';
    const rightCol = document.createElement('div');
    rightCol.className = 'match-col';
    let leftItems = [];
    let rightItems = [];
    q.options.forEach((opt, idx) => {
        const [lText, rText] = opt.split('|').map(s => s ? s.trim() : '');
        const pairId = `pair-${idx}`;
        if (lText) leftItems.push({ text: lText, id: pairId, type: 'left' });
        if (rText) rightItems.push({ text: rText, id: pairId, type: 'right' });
    });
    rightItems.sort(() => Math.random() - 0.5);
    const createItem = (item) => {
        const el = document.createElement('div');
        el.className = 'match-item';
        el.textContent = item.text;
        el.dataset.pairId = item.id;
        el.dataset.type = item.type;
        el.onclick = () => handleMatchClick(el);
        return el;
    };
    leftItems.forEach(item => leftCol.appendChild(createItem(item)));
    rightItems.forEach(item => rightCol.appendChild(createItem(item)));
    container.appendChild(leftCol);
    container.appendChild(rightCol);
    interactionArea.appendChild(container);
}
let selectedMatchItem = null;
function handleMatchClick(el) {
    if (el.classList.contains('disabled') || el === selectedMatchItem) return;
    if (selectedMatchItem && selectedMatchItem.dataset.type === el.dataset.type) {
        selectedMatchItem.classList.remove('selected');
        selectedMatchItem = el;
        el.classList.add('selected');
        return;
    }
    if (!selectedMatchItem) {
        selectedMatchItem = el;
        el.classList.add('selected');
    } else {
        const item1 = selectedMatchItem;
        const item2 = el;
        item1.classList.remove('selected');
        selectedMatchItem = null;
        const isMatch = item1.dataset.pairId === item2.dataset.pairId;
        item1.classList.add('disabled');
        item2.classList.add('disabled');
        if (isMatch) {
            item1.classList.add('correct');
            item2.classList.add('correct');
            if (sfx) sfx.correct();
        } else {
            item1.classList.add('wrong');
            item2.classList.add('wrong');
            if (sfx) sfx.wrong();
        }
        checkMatchingCompletion();
    }
}
function checkMatchingCompletion() {
    const allItems = interactionArea.querySelectorAll('.match-item');
    const totalItems = allItems.length;
    const disabledItems = interactionArea.querySelectorAll('.match-item.disabled').length;
    if (disabledItems === totalItems) {
        const wrongs = interactionArea.querySelectorAll('.match-item.wrong').length;
        const isPerfect = wrongs === 0;
        setTimeout(() => showFeedback(isPerfect), 1000);
    }
}
function renderIdentification(q) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ident-input';
    input.placeholder = 'Type your answer here...';
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Submit Answer';
    submitBtn.className = 'primary-btn action-btn';
    submitBtn.style.marginTop = '10px';
    submitBtn.onclick = () => {
        const val = input.value.trim().toLowerCase();
        const isCorrect = q.options.some(opt => opt.toLowerCase() === val);
        showFeedback(isCorrect, q, input.value);
    };
    interactionArea.appendChild(input);
    interactionArea.appendChild(submitBtn);
}
function renderBlock(q) {
    const correctSentence = q.options[0];
    const words = correctSentence.split(' ');
    const shuffledWords = [...words].sort(() => Math.random() - 0.5);
    const sentenceLane = document.createElement('div');
    sentenceLane.className = 'sentence-lane';
    const wordBank = document.createElement('div');
    wordBank.className = 'word-bank';
    shuffledWords.forEach(word => {
        const span = createWordBlock(word, sentenceLane, wordBank);
        wordBank.appendChild(span);
    });
    const checkBtn = document.createElement('button');
    checkBtn.textContent = 'Check';
    checkBtn.className = 'primary-btn action-btn';
    checkBtn.style.marginTop = '20px';
    checkBtn.onclick = () => {
        const formed = Array.from(sentenceLane.children).map(c => c.textContent).join(' ');
        showFeedback(formed === correctSentence, q, formed);
    };
    interactionArea.appendChild(sentenceLane);
    interactionArea.appendChild(wordBank);
    interactionArea.appendChild(checkBtn);
}
function createWordBlock(text, lane, bank) {
    const span = document.createElement('span');
    span.className = 'word-block';
    span.textContent = text;
    span.onclick = () => {
        if (sfx) sfx.click();
        if (span.parentElement === bank) { lane.appendChild(span); }
        else { bank.appendChild(span); }
    };
    return span;
}
function renderCheckbox(q) {
    const opts = q.options.map(opt => {
        const isCorrect = opt.startsWith('*');
        const text = isCorrect ? opt.substring(1) : opt;
        return { text, isCorrect };
    });
    opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'checkbox-btn';
        btn.innerHTML = `<span class="opt-text">${opt.text}</span><div class="check-indicator"></div>`;
        btn.onclick = () => {
            btn.classList.toggle('selected');
        };
        btn.dataset.idx = idx;
        interactionArea.appendChild(btn);
    });
    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Submit Answer';
    submitBtn.className = 'primary-btn action-btn';
    submitBtn.style.marginTop = '20px';
    submitBtn.style.width = '100%';
    submitBtn.onclick = () => {
        const buttons = interactionArea.querySelectorAll('.checkbox-btn');
        let selectedIndices = [];
        buttons.forEach((b, i) => {
            if (b.classList.contains('selected')) selectedIndices.push(i);
            b.disabled = true;
        });
        const correctIndices = opts.reduce((acc, curr, i) => {
            if (curr.isCorrect) acc.push(i);
            return acc;
        }, []);
        selectedIndices.sort();
        correctIndices.sort();
        const isCorrect = JSON.stringify(selectedIndices) === JSON.stringify(correctIndices);
        buttons.forEach((b, i) => {
            if (opts[i].isCorrect) {
                b.classList.add('correct');
                b.classList.add('selected');
            } else if (b.classList.contains('selected') && !opts[i].isCorrect) {
                b.classList.add('wrong');
            }
        });
        showFeedback(isCorrect, q, selectedIndices.map(i => opts[i].text).join(', '));
    };
    interactionArea.appendChild(submitBtn);
}
function handleMCAnswer(btn, chosenOpt, allOpts) {
    const buttons = interactionArea.querySelectorAll('.option-btn');
    buttons.forEach(b => b.disabled = true);
    if (chosenOpt.isCorrect) {
        btn.classList.add('correct');
        showFeedback(true, null, chosenOpt.text);
    } else {
        btn.classList.add('wrong');
        if (userSettings.showAnswers) {
            buttons.forEach(b => {
                if (allOpts.find(o => o.text === b.textContent && o.isCorrect)) {
                    b.classList.add('correct');
                }
            });
        }
        showFeedback(false, null, chosenOpt.text);
    }
}
function showFeedback(isCorrect, qObj = null, userAnswer = null) {
    feedbackArea.classList.remove('hidden');
    interactionArea.classList.add('has-feedback');
    const actionBtns = interactionArea.querySelectorAll('.action-btn');
    actionBtns.forEach(b => b.classList.add('hidden-action'));
    if (activeQuiz && activeQuiz.questions[currentIndex]) {
        sessionResults.push({
            qRef: activeQuiz.questions[currentIndex],
            isCorrect: isCorrect,
            userAnswer: userAnswer
        });
    }
    const addExplanationBtn = () => {
        const header = document.getElementById('feedback-header');
        const existing = header.querySelector('.why-btn');
        if (existing) existing.remove();
        if (activeQuiz && activeQuiz.questions[currentIndex].explanation) {
            const whyBtn = document.createElement('button');
            whyBtn.className = 'why-btn';
            whyBtn.innerHTML = '<span class="icon">?</span> Why';
            whyBtn.onclick = () => showExplanation(activeQuiz.questions[currentIndex].explanation);
            header.appendChild(whyBtn);
        }
    };
    if (isCorrect) {
        score++;
        scoreValEl.textContent = score;
        feedbackArea.classList.add('feedback-correct');
        feedbackMsg.textContent = getRandomPraise();
        if (sfx) sfx.correct();
        addExplanationBtn();
    } else {
        feedbackArea.classList.add('feedback-wrong');
        feedbackMsg.textContent = "Not quite!";
        if (sfx) sfx.wrong();
        if (userSettings.showAnswers && qObj) {
            let answerText = "";
            if (qObj.type === 'IDENT' || qObj.type === 'BLOCK') {
                answerText = `Correct Answer: ${qObj.options[0]}`;
            }
            if (answerText) {
                const hint = document.createElement('p');
                hint.className = 'answer-reveal';
                hint.textContent = answerText;
                feedbackArea.insertBefore(hint, nextBtn);
            }
        }
        addExplanationBtn();
    }
}
function showExplanation(text) {
    if (sfx) sfx.why();
    const modal = document.getElementById('explanation-modal');
    const txt = document.getElementById('explanation-text');
    txt.textContent = text || "No explanation provided.";
    modal.classList.remove('hidden');
}
function getRandomPraise() {
    const phrases = ["Awesome!", "Correct!", "Nailed it!", "Perfect!", "On fire!"];
    return phrases[Math.floor(Math.random() * phrases.length)];
}
function nextQuestion() {
    const reveals = feedbackArea.querySelectorAll('.answer-reveal');
    reveals.forEach(el => el.remove());
    interactionArea.style.pointerEvents = 'auto';
    currentIndex++;
    if (currentIndex < activeQuiz.questions.length) {
        renderQuestion();
    } else {
        endGame();
    }
}
function endGame() {
    quizScreen.classList.remove('active');
    resultScreen.classList.add('active');
    const percentage = score / activeQuiz.questions.length;
    document.getElementById('greeting-msg').textContent = getGreeting(percentage);
    if (percentage > 0.5) triggerConfetti(percentage);
    const fractionText = `${score}/${activeQuiz.questions.length}`;
    const percentInt = Math.round(percentage * 100);
    document.getElementById('final-score-val').textContent = fractionText;
    document.getElementById('score-percent').textContent = `${percentInt}%`;
    const circle = document.getElementById('score-progress');
    if (circle) {
        const radius = 70;
        const circumference = 2 * Math.PI * radius;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = circumference;
        setTimeout(() => {
            const offset = circumference - (percentage * circumference);
            circle.style.strokeDashoffset = offset;
        }, 300);
    }
    if (sfx) {
        if (percentage < 0.3) {
            sfx.scorelow();
        } else {
            sfx.complete();
        }
    }
    renderSummary(false);
    document.getElementById('view-simple-btn').onclick = () => {
        document.getElementById('view-simple-btn').classList.add('active');
        document.getElementById('view-detailed-btn').classList.remove('active');
        renderSummary(false);
    };
    document.getElementById('view-detailed-btn').onclick = () => {
        document.getElementById('view-detailed-btn').classList.add('active');
        document.getElementById('view-simple-btn').classList.remove('active');
        renderSummary(true);
    };
}
function renderSummary(isDetailed) {
    const summaryContainer = document.getElementById('quiz-summary');
    summaryContainer.innerHTML = '';
    if (!isDetailed) {
        sessionResults.forEach((res, idx) => {
            const item = document.createElement('div');
            item.className = `summary-item ${res.isCorrect ? 'correct' : 'wrong'}`;
            const text = document.createElement('div');
            text.className = 'summary-text';
            text.textContent = `${idx + 1}. ${res.qRef.question}`;
            const badge = document.createElement('div');
            badge.className = 'summary-badge';
            badge.textContent = res.isCorrect ? 'Correct' : 'Wrong';
            item.appendChild(text);
            item.appendChild(badge);
            summaryContainer.appendChild(item);
        });
    } else {
        sessionResults.forEach((res, idx) => {
            const card = document.createElement('div');
            card.className = `summary-card-detailed ${res.isCorrect ? 'correct' : 'wrong'}`;
            const header = document.createElement('div');
            header.className = 'det-question-text';
            header.innerHTML = `<span>${idx + 1}. ${res.qRef.question}</span>`;
            const badge = document.createElement('span');
            badge.className = `det-badge ${res.isCorrect ? 'correct' : 'wrong'}`;
            badge.textContent = res.isCorrect ? 'Correct' : 'Wrong';
            header.appendChild(badge);
            card.appendChild(header);
            if (res.qRef.image) {
                const img = document.createElement('img');
                img.src = res.qRef.image;
                img.className = 'det-image';
                card.appendChild(img);
            }
            if (res.qRef.type === 'MC') {
                const optContainer = document.createElement('div');
                optContainer.className = 'det-options';
                res.qRef.options.forEach(rawOpt => {
                    const isCorrectOpt = rawOpt.startsWith('*');
                    const optText = isCorrectOpt ? rawOpt.substring(1) : rawOpt;
                    const optDiv = document.createElement('div');
                    optDiv.className = 'det-opt';
                    let icon = '';
                    if (isCorrectOpt) {
                        optDiv.classList.add('is-correct-answer');
                        icon = '<span class="material-symbols-rounded" style="vertical-align: middle; font-size: 1.2rem;">check</span>';
                    }
                    if (res.userAnswer === optText) {
                        optDiv.classList.add('user-selected');
                        if (!res.isCorrect) {
                            optDiv.classList.add('is-wrong');
                            icon = '<span class="material-symbols-rounded" style="vertical-align: middle; font-size: 1.2rem;">close</span>';
                        }
                    }
                    optDiv.innerHTML = `<span>${icon}</span> <span>${optText}</span>`;
                    optContainer.appendChild(optDiv);
                });
                card.appendChild(optContainer);
            } else {
                const p = document.createElement('p');
                p.style.fontSize = '0.9rem';
                p.style.color = '#ccc';
                p.innerHTML = `Your Answer: <span style="color:${res.isCorrect ? '#00C985' : '#FF3355'}">${res.userAnswer || 'No Answer'}</span>`;
                card.appendChild(p);
            }
            summaryContainer.appendChild(card);
        });
    }
}
function getGreeting(pct) {
    if (pct === 1) return "Legendary! Perfect Score! 🏆";
    if (pct >= 0.8) return "Awesome Job! 🎉";
    if (pct >= 0.5) return "Good Effort! 👍";
    return "Keep Practicing! 💪";
}
function triggerConfetti(intensity) {
    const count = intensity * 200;
    const defaults = {
        origin: { y: 0.7 }
    };
    function fire(particleRatio, opts) {
        confetti(Object.assign({}, defaults, opts, {
            particleCount: Math.floor(count * particleRatio)
        }));
    }
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
}
function animateScore(target, total) {
    const el = document.getElementById('final-score-val');
    let start = 0;
    const duration = 1500;
    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        const currentScore = Math.floor(start + (target - start) * ease);
        el.textContent = `${currentScore} / ${total}`;
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = `${target} / ${total}`;
        }
    }
    requestAnimationFrame(update);
}

// ----------------------------------------------------
// Search Bar Animated Placeholders
// ----------------------------------------------------
function startSearchPlaceholderAnimation() {
    const searchInput = document.getElementById('quiz-search-input');
    const suggestionEl = document.getElementById('search-suggestion-text');
    if (!searchInput || !suggestionEl || searchSuggestionsPool.length === 0) return;

    isTypingActive = true;
    clearTimeout(suggestionTypeTimeout);

    function cycleSuggestion() {
        if (!isTypingActive || isInputFocused || searchInput.value.trim() !== '') {
            suggestionEl.style.display = 'none';
            suggestionEl.className = 'search-suggestion';
            searchInput.placeholder = 'Search quizzes...';
            isTypingActive = false;
            return;
        }

        searchInput.placeholder = '';
        suggestionEl.style.display = 'block';

        const suggestion = searchSuggestionsPool[currentSuggestionIndex % searchSuggestionsPool.length];
        const fullText = `Search '${suggestion}'...`;

        suggestionEl.className = 'search-suggestion';
        void suggestionEl.offsetWidth; // Force Reflow
        suggestionEl.textContent = fullText;
        suggestionEl.classList.add('anim-scroll-in');

        // Suggestion stays visible for 5 seconds
        suggestionTypeTimeout = setTimeout(() => {
            if (!isTypingActive || isInputFocused || searchInput.value.trim() !== '') {
                return cycleSuggestion(); // Instantly exit if aborted
            }

            suggestionEl.classList.remove('anim-scroll-in');
            suggestionEl.classList.add('anim-scroll-out');

            // Wait 500ms for exit animation
            suggestionTypeTimeout = setTimeout(() => {
                currentSuggestionIndex++;
                cycleSuggestion();
            }, 500);
        }, 5000);
    }

    cycleSuggestion();
}
