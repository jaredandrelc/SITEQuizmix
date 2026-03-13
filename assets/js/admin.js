document.addEventListener('DOMContentLoaded', () => {
    // === DOM ELEMENTS ===
    const loginOverlay = document.getElementById('admin-login-overlay');
    const adminContainer = document.getElementById('admin-container');
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('admin-login-btn');
    const loginError = document.getElementById('login-error');

    const jsonEditorArea = document.getElementById('json-editor-area');
    const syncToGuiBtn = document.getElementById('sync-to-gui-btn');
    const syncToJsonBtn = document.getElementById('sync-to-json-btn');
    const guiQuizTitle = document.getElementById('gui-quiz-title');
    const guiQuizCourse = document.getElementById('gui-quiz-course');
    const guiQuizDesc = document.getElementById('gui-quiz-desc');
    const guiQuestionsList = document.getElementById('gui-questions-list');
    const addQuestionBtn = document.getElementById('add-question-btn');

    const uploadBtn = document.getElementById('admin-upload-btn');
    const fileInput = document.getElementById('json-upload-input');
    const exportBtn = document.getElementById('admin-export-btn');

    // Default template for a new quiz
    let currentQuizData = {
        title: "New Quiz",
        course: "COURSE101",
        description: "Description of the new quiz.",
        questions: []
    };

    // === LOGIN SYSTEM ===
    const ADMIN_EMAIL = 'jaredandre.carreon.cics@ust.edu.ph';
    const ADMIN_PASS = 'adminUSITE26!';

    function attemptLogin() {
        // Only trim the email, NOT the password, passwords can have spaces.
        const email = emailInput.value.trim();
        const pass = passwordInput.value;

        if (!email.endsWith('@ust.edu.ph')) {
            showError("Only @ust.edu.ph emails are allowed.");
            return;
        }

        if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
            // Success
            loginOverlay.classList.add('hidden');
            adminContainer.classList.remove('hidden');
            document.body.style.display = 'block'; // reset to normal block display instead of flex-center
            initEditor();
        } else {
            showError("Invalid credentials.");
        }
    }

    function showError(msg) {
        loginError.textContent = msg;
        loginError.classList.remove('hidden');
    }

    loginBtn.addEventListener('click', attemptLogin);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });

    // === EDITOR LOGIC ===
    function initEditor() {
        updateJsonEditor();
        updateGuiEditor();
    }

    function updateJsonEditor() {
        jsonEditorArea.value = JSON.stringify(currentQuizData, null, 4);
    }

    function updateGuiEditor() {
        guiQuizTitle.value = currentQuizData.title || '';
        guiQuizCourse.value = currentQuizData.course || '';
        guiQuizDesc.value = currentQuizData.description || '';

        guiQuestionsList.innerHTML = '';
        if (currentQuizData.questions) {
            currentQuizData.questions.forEach((q, index) => {
                const card = createQuestionCard(q, index);
                guiQuestionsList.appendChild(card);
            });
        }
    }

    function createQuestionCard(q, index) {
        const div = document.createElement('div');
        div.className = 'gui-question-card';
        div.innerHTML = `
            <div class="gui-question-header">
                <strong>Question ${index + 1}</strong>
                <button class="remove-question-btn" data-index="${index}" title="Remove Question">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
            <input type="text" class="admin-input q-text-input" value="${escapeHtml(q.question)}" placeholder="Question Text" data-index="${index}">
            <div class="gui-answers-list">
                ${(q.options || []).map((opt, oIndex) => `
                    <div class="gui-answer-row">
                        <input type="radio" name="correct-ans-${index}" class="is-correct-checkbox" ${q.answer === opt ? 'checked' : ''} value="${escapeHtml(opt)}">
                        <input type="text" class="admin-input q-option-input" value="${escapeHtml(opt)}" data-qindex="${index}" data-oindex="${oIndex}" placeholder="Option ${oIndex + 1}">
                    </div>
                `).join('')}
            </div>
            <textarea class="admin-input q-explanation-input" placeholder="Explanation" data-index="${index}" rows="2">${escapeHtml(q.explanation || '')}</textarea>
        `;

        // Bind delete
        div.querySelector('.remove-question-btn').addEventListener('click', () => {
            currentQuizData.questions.splice(index, 1);
            updateGuiEditor();
            updateJsonEditor();
        });

        // Add event listeners to input fields so we immediately sync to data object
        div.querySelectorAll('.q-text-input').forEach(input => {
            input.addEventListener('input', (e) => {
                currentQuizData.questions[index].question = e.target.value;
                updateJsonEditor();
            });
        });

        div.querySelectorAll('.q-explanation-input').forEach(input => {
            input.addEventListener('input', (e) => {
                currentQuizData.questions[index].explanation = e.target.value;
                updateJsonEditor();
            });
        });

        div.querySelectorAll('.q-option-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const oIdx = parseInt(e.target.dataset.oindex);
                const oldVal = currentQuizData.questions[index].options[oIdx];
                currentQuizData.questions[index].options[oIdx] = e.target.value;
                // If it was the answer, update the answer string too
                if (currentQuizData.questions[index].answer === oldVal) {
                    currentQuizData.questions[index].answer = e.target.value;
                    // Update radio button value
                    const radio = div.querySelector(`input[name="correct-ans-${index}"][value="${escapeHtml(oldVal)}"]`);
                    if (radio) radio.value = e.target.value;
                } else {
                    // Ensure the radio value updates if this option wasn't the current correct answer
                    const radio = div.querySelector(`input[name="correct-ans-${index}"][value="${escapeHtml(oldVal)}"]`);
                    if (radio) radio.value = e.target.value;
                }
                updateJsonEditor();
            });
        });

        div.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    currentQuizData.questions[index].answer = e.target.value;
                    updateJsonEditor();
                }
            });
        });

        return div;
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // SYNC BUTTONS
    syncToGuiBtn.addEventListener('click', () => {
        try {
            const parsed = JSON.parse(jsonEditorArea.value);
            currentQuizData = parsed;
            updateGuiEditor();
        } catch (e) {
            alert("Invalid JSON format. Check for errors before syncing.");
        }
    });

    syncToJsonBtn.addEventListener('click', () => {
        // Collect from Meta
        currentQuizData.title = guiQuizTitle.value;
        currentQuizData.course = guiQuizCourse.value;
        currentQuizData.description = guiQuizDesc.value;
        updateJsonEditor();
    });

    addQuestionBtn.addEventListener('click', () => {
        currentQuizData.questions.push({
            type: "multiple-choice",
            question: "New Question Context?",
            options: ["Option 1", "Option 2", "Option 3", "Option 4"],
            answer: "Option 1",
            explanation: "Explanation goes here."
        });
        updateGuiEditor();
        updateJsonEditor();
    });

    // UPLOAD / LOAD JSON
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const parsed = JSON.parse(event.target.result);
                currentQuizData = parsed;
                updateJsonEditor();
                updateGuiEditor();
            } catch (err) {
                alert("Could not parse file. Ensure it is valid JSON.");
            }
        };
        reader.readAsText(file);
    });

    // EXPORT JSON
    exportBtn.addEventListener('click', () => {
        // Enforce a sync from GUI right before downloading
        syncToJsonBtn.click();

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentQuizData, null, 4));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (currentQuizData.course || "quiz") + ".json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });
});
