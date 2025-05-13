document.addEventListener('dblclick', (event) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const isEnglishWord = /^[a-zA-Z]+$/.test(selectedText);

    if (isEnglishWord && selectedText.length > 0) {
        chrome.storage.local.get({ words: [] }, (result) => {
            const words = result.words.map(entry => entry.word.toLowerCase());
            const wordExists = words.includes(selectedText.toLowerCase());

            // Remove existing toolbar
            const existingToolbar = document.getElementById('wordToolbar');
            if (existingToolbar) existingToolbar.remove();

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

            // Position toolbar
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

            // Translate button
            const translateBtn = document.createElement('img');
            translateBtn.src = chrome.runtime.getURL('translate.png');
            translateBtn.style.width = '24px';
            translateBtn.style.height = '24px';
            translateBtn.style.cursor = 'pointer';
            translateBtn.style.marginRight = '5px';
            translateBtn.addEventListener('click', async () => {
                try {
                    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=he&dt=t&q=${encodeURI(selectedText)}`;
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    const translation = data[0][0][0];
                    showTranslationPopup(selectedText, translation, toolbar);
                } catch (error) {
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
                            chrome.storage.local.set({ words }, () => toolbar.remove());
                        }
                    });
                });
            } else {
                actionBtn.src = chrome.runtime.getURL('plus.png');
                actionBtn.addEventListener('click', () => {
                    chrome.storage.local.get({ words: [] }, (result) => {
                        const words = result.words;
                        words.push({ word: selectedText, date: new Date().toLocaleDateString(), reviewed: false });
                        chrome.storage.local.set({ words }, () => toolbar.remove());
                    });
                });
            }

            // Append buttons to toolbar
            toolbar.appendChild(playBtn);
            toolbar.appendChild(translateBtn);
            toolbar.appendChild(actionBtn);
            document.body.appendChild(toolbar);

            // Remove toolbar after 5 seconds
            setTimeout(() => toolbar.remove(), 5000);

            // Remove toolbar on click elsewhere
            document.addEventListener('click', (e) => {
                if (!toolbar.contains(e.target)) toolbar.remove();
            }, { once: true });
        });
    }
});

// Translation popup
function showTranslationPopup(word, translation, toolbar) {
    const existingPopup = document.querySelector('.translation-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'translation-popup';
    popup.style.position = 'absolute';
    popup.style.background = 'white';
    popup.style.padding = '20px';
    popup.style.borderRadius = '8px';
    popup.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    popup.style.zIndex = '10000';
    popup.style.textAlign = 'center';
    popup.style.minWidth = '150px';
    popup.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; color: #333; margin-bottom: 10px;">${word}</div>
        <div style="font-size: 16px; color: #666;">${translation}</div>
    `;

    document.body.appendChild(popup);

    // Position popup relative to toolbar
    const toolbarRect = toolbar.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let left = toolbarRect.left + scrollX + (toolbarRect.width - popupRect.width) / 2;
    let top;

    if (toolbarRect.top > popupRect.height + 10) {
        top = toolbarRect.top + scrollY - popupRect.height - 5;
        popup.dataset.position = 'above';
    } else {
        top = toolbarRect.bottom + scrollY + 5;
        popup.dataset.position = 'below';
    }

    if (left < scrollX + 10) left = scrollX + 10;
    if (left + popupRect.width > scrollX + viewportWidth - 10) left = scrollX + viewportWidth - popupRect.width - 10;

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    setTimeout(() => popup.remove(), 3000);
}

// Error popup
function showErrorPopup(message) {
    const existingPopup = document.querySelector('.error-popup');
    if (existingPopup) existingPopup.remove();

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
    popup.style.zIndex = '10000';
    popup.style.textAlign = 'center';
    popup.style.maxWidth = '300px';
    popup.style.fontSize = '14px';
    popup.style.color = '#d32f2f';
    popup.textContent = message;

    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 4000);
}