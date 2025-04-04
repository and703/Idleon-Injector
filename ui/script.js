document.addEventListener('DOMContentLoaded', () => {
    const cheatListDiv = document.getElementById('cheat-list');
    const statusMessageDiv = document.getElementById('status-message');
    let cheatsNeedingConfirmation = []; // Store cheats that need a value

    // Function to display status messages
    function showStatus(message, isError = false) {
        statusMessageDiv.textContent = message;
        statusMessageDiv.className = isError ? 'status-error' : 'status-success';
        // Clear message after a few seconds
        setTimeout(() => {
            statusMessageDiv.textContent = '';
            statusMessageDiv.className = '';
        }, 5000);
    }

    // Function to toggle a cheat via the API
    async function toggleCheat(action) {
        try {
            const response = await fetch('/api/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: action }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.details || data.error || `HTTP error! status: ${response.status}`);
            }

            showStatus(`Executed '${action}': ${data.result || 'Success'}`);
            console.log(`Executed '${action}':`, data);

        } catch (error) {
            console.error('Error toggling cheat:', error);
            showStatus(`Error executing '${action}': ${error.message}`, true);
        }
    }

    // Function to fetch cheats, group them, and display them
    async function loadCheats() {
        try {
            // Fetch both cheats and the list needing confirmation
            const [cheatsResponse, confirmationResponse] = await Promise.all([
                fetch('/api/cheats'),
                fetch('/api/needs-confirmation') // Fetch the new list
            ]);

            if (!cheatsResponse.ok) {
                throw new Error(`HTTP error fetching cheats! status: ${cheatsResponse.status}`);
            }
            if (!confirmationResponse.ok) {
                // Log error but don't necessarily block rendering
                console.error(`HTTP error fetching confirmation list! status: ${confirmationResponse.status}`);
                showStatus(`Warning: Could not load value requirement list. Input fields may not appear.`, true);
            }

            const cheats = await cheatsResponse.json(); // Expecting array of { message: "...", value: "..." }
            cheatsNeedingConfirmation = confirmationResponse.ok ? await confirmationResponse.json() : []; // Store the list

            cheatListDiv.innerHTML = ''; // Clear loading message

            if (!cheats || cheats.length === 0) {
                cheatListDiv.innerHTML = '<p>No cheats found or unable to load.</p>';
                return;
            }

            // --- Grouping Logic ---
            const groupedCheats = { 'General': [] };
            const categoryHeaders = new Set();

            // 1. Identify single-word commands as category headers
            cheats.forEach(cheat => {
                const cheatValue = typeof cheat === 'object' ? cheat.value : cheat;
                if (cheatValue && !cheatValue.includes(' ')) {
                    categoryHeaders.add(cheatValue);
                }
            });

            // 2. Group cheats
            cheats.forEach(cheat => {
                const cheatValue = typeof cheat === 'object' ? cheat.value : cheat;
                const cheatName = typeof cheat === 'object' ? cheat.message : cheat; // Use message for display

                if (!cheatValue) return; // Skip if no value

                const parts = cheatValue.split(' ');
                let category = 'General';

                if (parts.length > 1 && categoryHeaders.has(parts[0])) {
                    category = parts[0];
                }

                if (!groupedCheats[category]) {
                    groupedCheats[category] = [];
                }
                // Store the full cheat object for rendering
                // Store the full cheat object for rendering
                // Also store the base command (first word) for confirmation check
                const baseCommand = cheatValue.split(' ')[0];
                groupedCheats[category].push({ message: cheatName, value: cheatValue, baseCommand: baseCommand });
            });


            // --- Rendering Logic ---
            const sortedCategories = Object.keys(groupedCheats).sort((a, b) => {
                if (a === 'General') return 1; // Put General last
                if (b === 'General') return -1;
                return a.localeCompare(b); // Sort others alphabetically
            });

            sortedCategories.forEach(category => {
                if (groupedCheats[category].length === 0) return; // Skip empty categories

                const details = document.createElement('details');
                details.className = 'cheat-category';
                // Optionally open General by default, or specific categories
                // if (category === 'General') {
                //     details.open = true;
                // }

                const summary = document.createElement('summary');
                // Capitalize first letter for display
                summary.textContent = category.charAt(0).toUpperCase() + category.slice(1);
                details.appendChild(summary);

                const categoryContent = document.createElement('div');
                categoryContent.className = 'cheat-category-content';

                groupedCheats[category].forEach(cheat => {
                    const button = document.createElement('button');
                    button.textContent = cheat.message; // Use the message for button text
                    const container = document.createElement('div'); // Container for button and input
                    container.className = 'cheat-item-container';

                    button.className = 'cheat-button';
                    button.dataset.action = cheat.value; // Store the action value

                    // Check if this cheat (or its base command) needs confirmation/value
                    const needsValue = cheatsNeedingConfirmation.some(confirmCmd =>
                        cheat.value.startsWith(confirmCmd)
                    );

                    let inputField = null;
                    if (needsValue) {
                        inputField = document.createElement('input');
                        inputField.type = 'text';
                        inputField.className = 'cheat-input';
                        // Use a unique ID based on the action value for easy retrieval
                        inputField.id = `input-${cheat.value.replace(/\s+/g, '-')}`;
                        inputField.placeholder = 'Value'; // Placeholder text
                        container.appendChild(inputField); // Add input before button
                    }

                    container.appendChild(button); // Add button to container

                    button.addEventListener('click', () => {
                        let actionToSend = cheat.value;
                        if (needsValue && inputField) {
                            const inputValue = inputField.value.trim();
                            if (inputValue) { // Only append if value is provided
                                actionToSend = `${cheat.value} ${inputValue}`;
                            } else {
                                // Optional: Show a warning or prevent execution if value is required but empty
                                showStatus(`Warning: Value required for '${cheat.message}'. Executing without value.`, true);
                                // Or: return; // to prevent execution
                            }
                        }
                        toggleCheat(actionToSend);
                    });

                    categoryContent.appendChild(container); // Add container to category content
                });

                details.appendChild(categoryContent);
                cheatListDiv.appendChild(details);
            });

        } catch (error) {
            console.error('Error loading or processing cheats:', error);
            cheatListDiv.innerHTML = `<p class="status-error">Error loading cheats: ${error.message}</p>`;
        }
    }

    // Initial load
    loadCheats();
});
