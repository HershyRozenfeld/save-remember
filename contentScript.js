document.addEventListener('dblclick', (event) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const isEnglishWord = /^[a-zA-Z]+$/.test(selectedText);

    if (isEnglishWord && selectedText.length > 0) {
        chrome.storage.local.get({ words: [] }, (result) => {
            const words = result.words.map(entry => entry.word.toLowerCase());
            const wordExists = words.includes(selectedText.toLowerCase());

            // Remove any existing toolbar
            const existingToolbar = document.getElementById('wordToolbar');
            if (existingToolbar) {
                existingToolbar.remove();
            }

            // Create toolbar
            const toolbar = document.createElement('div');
            toolbar.id = 'wordToolbar';
            toolbar.style.position = 'absolute';
            toolbar.style.display = 'flex';
            toolbar.style.alignItems = 'center';
            toolbar.style.background = 'white';
            toolbar.style.border = '1px solid #d1d8e0';
            toolbar.style.borderRadius = '10px';
            toolbar.style.padding = '6px';
            toolbar.style.boxShadow = '0 3px 6px rgba(0, 0, 0, 0.15)';
            toolbar.style.zIndex = '1000';
            toolbar.style.userSelect = 'none';

            // Get the position of the selected text
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            toolbar.style.left = `${window.scrollX + rect.right}px`;
            toolbar.style.top = `${window.scrollY + rect.top}px`;

            // Play button
            const playBtn = document.createElement('img');
            playBtn.src = chrome.runtime.getURL('play.png');
            playBtn.style.width = '24px';
            playBtn.style.height = '24px';
            playBtn.style.cursor = 'pointer';
            playBtn.style.marginRight = '5px';
            playBtn.addEventListener('click', () => {
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(selectedText);
                    utterance.lang = 'en-US';
                    utterance.rate = '0.9';
                    utterance.pitch = '1';
                    speechSynthesis.cancel();
                    speechSynthesis.speak(utterance);
                }
            });
            playBtn.onerror = () => {
                console.error('Failed to load play.png');
            };

            // Translate button
            const translateBtn = document.createElement('img');
            translateBtn.src = chrome.runtime.getURL('translate.png');
            translateBtn.style.width = '24px';
            translateBtn.style.height = '24px';
            translateBtn.style.cursor = 'pointer';
            translateBtn.style.marginRight = '5px';
            translateBtn.addEventListener('click', async () => {
                console.log('Translate button clicked for word:', selectedText);
                try {
                    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=he&dt=t&q=${encodeURI(selectedText)}`;
                    console.log('Fetching translation from:', url);
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    console.log('Translation data:', data);
                    const translation = data[0][0][0];
                    console.log('Translation received:', translation);
                    showTranslationPopup(selectedText, translation, toolbar);
                } catch (error) {
                    console.error('Translation failed:', error);
                    showErrorPopup(`שגיאה בתרגום: ${error.message}`);
                }
            });

            // Add/Delete button
            const actionBtn = document.createElement('img');
            actionBtn.style.width = '24px';
            actionBtn.style.height = '24px';
            actionBtn.style.cursor = 'pointer';
            if (wordExists) {
                actionBtn.src = chrome.runtime.getURL('trash.png');
                actionBtn.addEventListener('click', () => {
                    chrome.storage.local.get({ words: [] }, (result) => {
                        const words = result.words;
                        const index = words.findIndex(entry => entry.word.toLowerCase() === selectedText.toLowerCase());
                        if (index !== -1) {
                            words.splice(index, 1);
                            chrome.storage.local.set({ words }, () => {
                                toolbar.remove();
                            });
                        }
                    });
                });
            } else {
                actionBtn.src = chrome.runtime.getURL('plus.png');
                actionBtn.addEventListener('click', () => {
                    chrome.storage.local.get({ words: [] }, (result) => {
                        const words = result.words;
                        words.push({ word: selectedText, date: new Date().toLocaleDateString(), reviewed: false });
                        chrome.storage.local.set({ words }, () => {
                            toolbar.remove();
                        });
                    });
                });
            }

            // Append buttons to toolbar
            toolbar.appendChild(playBtn);
            toolbar.appendChild(translateBtn);
            toolbar.appendChild(actionBtn);

            // Add toolbar to the document
            document.body.appendChild(toolbar);
            console.log('Toolbar added to DOM:', toolbar);

            // Remove toolbar after 5 seconds
            setTimeout(() => {
                if (toolbar) {
                    toolbar.remove();
                }
            }, 5000);

            // Remove toolbar on click elsewhere
            document.addEventListener('click', (e) => {
                if (!toolbar.contains(e.target)) {
                    toolbar.remove();
                }
            }, { once: true });
        });
    }
});

// Translation popup function (updated to stick to toolbar with scroll compensation)
function showTranslationPopup(word, translation, toolbar) {
    // Remove any existing popup
    const existingPopup = document.querySelector('.translation-popup');
    if (existingPopup) {
        existingPopup.remove();
        console.log('Removed existing translation popup');
    }

    const popup = document.createElement('div');
    popup.className = 'translation-popup';
    popup.style.position = 'absolute';
    popup.style.background = 'white';
    popup.style.padding = '20px';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    popup.style.zIndex = '10000'; // High z-index to avoid overlap
    popup.style.textAlign = 'center';
    popup.style.opacity = '1 !important'; // Force visibility
    popup.style.minWidth = '150px';
    popup.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px;">${word}</div>
        <div style="font-size: 16px; color: #666;">${translation}</div>
    `;

    // Add popup to the document
    document.body.appendChild(popup);
    console.log('Translation popup added to DOM:', popup);

    // Get toolbar position and scroll offsets
    const toolbarRect = toolbar.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    console.log('Toolbar rect:', toolbarRect);
    console.log('Popup rect:', popupRect);
    console.log('Scroll offsets:', { scrollX, scrollY });
    console.log('Viewport:', { width: viewportWidth, height: viewportHeight });

    // Calculate absolute position to stick to toolbar
    let left = toolbarRect.left + scrollX + (toolbarRect.width - popupRect.width) / 2;
    let top;

    // Check if there's enough space above the toolbar in the viewport
    if (toolbarRect.top > popupRect.height + 10) {
        // Position above toolbar
        top = toolbarRect.top + scrollY - popupRect.height - 5; // 5px gap
        popup.dataset.position = 'above';
    } else {
        // Position below toolbar
        top = toolbarRect.bottom + scrollY + 5; // 5px gap
        popup.dataset.position = 'below';
    }

    // Ensure popup stays within viewport horizontally
    if (left < scrollX + 10) {
        left = scrollX + 10; // Prevent overflow on left
    }
    if (left + popupRect.width > scrollX + viewportWidth - 10) {
        left = scrollX + viewportWidth - popupRect.width - 10; // Prevent overflow on right
    }

    // Apply position
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    console.log('Popup positioned:', {
        left: popup.style.left,
        top: popup.style.top,
        position: popup.dataset.position
    });

    // Check visibility
    const computedStyle = window.getComputedStyle(popup);
    console.log('Popup visibility:', {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity
    });

    setTimeout(() => {
        popup.remove();
        console.log('Translation popup removed after timeout');
    }, 3000);
}

// Error popup function
function showErrorPopup(message) {
    const existingPopup = document.querySelector('.error-popup');
    if (existingPopup) {
        existingPopup.remove();
        console.log('Removed existing error popup');
    }

    const popup = document.createElement('div');
    popup.className = 'error-popup';
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.background = 'white';
    popup.style.padding = '10px';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    popup.style.zIndex = '10000'; // High z-index to avoid overlap
    popup.style.textAlign = 'center';
    popup.style.maxWidth = '300px';
    popup.style.fontSize = '14px';
    popup.style.color = '#d32f2f';
    popup.textContent = message;

    document.body.appendChild(popup);
    console.log('Error popup added to DOM:', popup);

    setTimeout(() => {
        popup.remove();
        console.log('Error popup removed after timeout');
    }, 4000);
}
