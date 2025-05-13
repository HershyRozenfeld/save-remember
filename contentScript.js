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
            playBtn.title = 'השמע את המילה';
            playBtn.style.cursor = 'pointer';
            playBtn.addEventListener('click', () => {
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(selectedText);
                    utterance.lang = 'en-US';
                    utterance.rate = '0.9';
                    utterance.pitch = '1';
                    speechSynthesis.cancel();
                    speechSynthesis.speak(utterance);
                    
                    // אנימציה כשלוחצים על כפתור
                    playBtn.style.transform = 'scale(0.9)';
                    setTimeout(() => playBtn.style.transform = '', 200);
                }
            });

            // Translate button
            const translateBtn = document.createElement('img');
            translateBtn.src = chrome.runtime.getURL('translate.png');
            translateBtn.title = 'תרגם את המילה';
            translateBtn.style.cursor = 'pointer';
            translateBtn.addEventListener('click', async () => {
                try {
                    // אנימציה כשלוחצים על כפתור
                    translateBtn.style.transform = 'scale(0.9)';
                    setTimeout(() => translateBtn.style.transform = '', 200);
                    
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
            actionBtn.style.cursor = 'pointer';
            if (wordExists) {
                actionBtn.src = chrome.runtime.getURL('trash.png');
                actionBtn.title = 'הסר מילה מהרשימה';
                actionBtn.addEventListener('click', () => {
                    // אנימציה כשלוחצים על כפתור
                    actionBtn.style.transform = 'scale(0.9)';
                    setTimeout(() => actionBtn.style.transform = '', 200);
                    
                    chrome.storage.local.get({ words: [] }, (result) => {
                        const words = result.words;
                        const index = words.findIndex(entry => entry.word.toLowerCase() === selectedText.toLowerCase());
                        if (index !== -1) {
                            words.splice(index, 1);
                            chrome.storage.local.set({ words }, () => {
                                // הוספת הנפשה לסרגל כשמסירים מילה
                                toolbar.style.animation = 'fadeInUp 0.3s reverse forwards';
                                setTimeout(() => toolbar.remove(), 300);
                            });
                        }
                    });
                });
            } else {
                actionBtn.src = chrome.runtime.getURL('plus.png');
                actionBtn.title = 'הוסף מילה לרשימה';
                actionBtn.addEventListener('click', () => {
                    // אנימציה כשלוחצים על כפתור
                    actionBtn.style.transform = 'scale(0.9)';
                    setTimeout(() => actionBtn.style.transform = '', 200);
                    
                    chrome.storage.local.get({ words: [] }, (result) => {
                        const words = result.words;
                        words.push({ word: selectedText, date: new Date().toLocaleDateString(), reviewed: false });
                        chrome.storage.local.set({ words }, () => {
                            // הנפשה לסרגל כשמוסיפים מילה
                            actionBtn.src = chrome.runtime.getURL('check.png');
                            setTimeout(() => {
                                toolbar.style.animation = 'fadeInUp 0.3s reverse forwards';
                                setTimeout(() => toolbar.remove(), 300);
                            }, 500);
                        });
                    });
                });
            }

            // Append buttons to toolbar
            toolbar.appendChild(playBtn);
            toolbar.appendChild(translateBtn);
            toolbar.appendChild(actionBtn);
            document.body.appendChild(toolbar);

            // הנפשת כניסה לסרגל
            toolbar.style.opacity = '0';
            toolbar.style.transform = 'translateY(10px)';
            setTimeout(() => {
                toolbar.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                toolbar.style.opacity = '1';
                toolbar.style.transform = 'translateY(0)';
            }, 10);

            // Handle toolbar timeout
            let timeoutId;
            const setToolbarTimeout = (duration) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    toolbar.style.opacity = '0';
                    toolbar.style.transform = 'translateY(10px)';
                    setTimeout(() => toolbar.remove(), 300);
                }, duration);
            };

            // Initial timeout
            setToolbarTimeout(6000);

            // Extend timeout on hover
            toolbar.addEventListener('mouseenter', () => {
                clearTimeout(timeoutId);
            });

            toolbar.addEventListener('mouseleave', () => {
                setToolbarTimeout(6000);
            });

            // Extend timeout on button clicks
            [playBtn, translateBtn].forEach(btn => {
                btn.addEventListener('click', () => {
                    setToolbarTimeout(10000); // Longer timeout after interaction
                });
            });

            // Remove toolbar on click elsewhere
            document.addEventListener('click', (e) => {
                if (!toolbar.contains(e.target)) {
                    toolbar.style.opacity = '0';
                    toolbar.style.transform = 'translateY(10px)';
                    setTimeout(() => toolbar.remove(), 300);
                }
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
    popup.style.zIndex = '10000';

    // שיפור מבנה הפופאפ עם שני חלקים - כותרת ותוכן
    const headerDiv = document.createElement('div');
    headerDiv.textContent = word;
    
    const contentDiv = document.createElement('div');
    contentDiv.textContent = translation;
    
    popup.appendChild(headerDiv);
    popup.appendChild(contentDiv);

    document.body.appendChild(popup);

    // Position popup relative to toolbar
    const toolbarRect = toolbar.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportWidth = window.innerWidth;
    
    // יש להמתין ליצירת הפופאפ לפני חישוב הגדלים
    setTimeout(() => {
        const popupRect = popup.getBoundingClientRect();
        
        let left = toolbarRect.left + scrollX + (toolbarRect.width - popupRect.width) / 2;
        let top;

        if (toolbarRect.top > popupRect.height + 20) {
            top = toolbarRect.top + scrollY - popupRect.height - 10;
            popup.dataset.position = 'above';
        } else {
            top = toolbarRect.bottom + scrollY + 10;
            popup.dataset.position = 'below';
        }

        if (left < scrollX + 10) left = scrollX + 10;
        if (left + popupRect.width > scrollX + viewportWidth - 10) 
            left = scrollX + viewportWidth - popupRect.width - 10;

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
    }, 10);

    // סגירת הפופאפ עם אנימציה אחרי 3 שניות
    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(10px)';
        setTimeout(() => popup.remove(), 300);
    }, 3000);
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
    popup.style.zIndex = '10000';
    popup.textContent = message;

    document.body.appendChild(popup);
    
    // סגירת הפופאפ עם אנימציה
    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translate(-50%, -50%) translateY(10px)';
        setTimeout(() => popup.remove(), 300);
    }, 4000);
}