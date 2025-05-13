// הוספת סגנונות דינמיים
const style = document.createElement('style');
style.textContent = `
    .translation-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: fadeIn 0.3s ease-out;
    }

    .translation-content {
        text-align: center;
    }

    .translation-popup .word {
        font-size: 18px;
        font-weight: bold;
        color: #333;
        margin-bottom: 10px;
    }

    .translation-popup .translation {
        font-size: 16px;
        color: #666;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -60%); }
        to { opacity: 1; transform: translate(-50%, -50%); }
    }

    .score-animation {
        position: absolute;
        top: -20px;
        right: 10px;
        color: #4CAF50;
        font-weight: bold;
        animation: floatUp 1s ease-out forwards;
    }

    @keyframes floatUp {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
    }

    .level-up-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        animation: fadeIn 0.3s ease-out;
    }

    .level-up-content {
        background: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
    }

    .error-message {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ff5252;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        animation: fadeIn 0.3s ease-out;
    }

    .success-message {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        animation: fadeIn 0.3s ease-out;
    }
`;
document.head.appendChild(style);

// Word management and display functions
function displayWords(isDailyReview = false) {
    chrome.storage.local.get({ words: [], score: 0, level: 1 }, (result) => {
        const wordList = document.getElementById(isDailyReview ? 'dailyWordList' : 'wordList');
        wordList.innerHTML = '';

        let wordsToDisplay = result.words;
        if (isDailyReview) {
            wordsToDisplay = wordsToDisplay.sort(() => 0.5 - Math.random()).slice(0, 10);
        } else {
            const today = new Date(), yesterday = new Date(), lastWeek = new Date();
            yesterday.setDate(today.getDate() - 1);
            lastWeek.setDate(today.getDate() - 7);
            const groups = { "Today": [], "Yesterday": [], "Previous 7 Days": [], olderWords: {} };

            wordsToDisplay.forEach((entry, index) => {
                entry.originalIndex = index;
                const wordDate = new Date(entry.date);
                const wordMonthYear = `${wordDate.getMonth() + 1}/${wordDate.getFullYear()}`;
                if (isSameDay(wordDate, today)) groups["Today"].push(entry);
                else if (isSameDay(wordDate, yesterday)) groups["Yesterday"].push(entry);
                else if (wordDate >= lastWeek) groups["Previous 7 Days"].push(entry);
                else {
                    if (!groups.olderWords[wordMonthYear]) groups.olderWords[wordMonthYear] = [];
                    groups.olderWords[wordMonthYear].push(entry);
                }
            });

            Object.entries(groups).forEach(([title, words]) => {
                if (title === 'olderWords') {
                    Object.keys(words).sort().reverse().forEach(monthYear =>
                        createWordGroup(`${monthYear}`, words[monthYear], wordList));
                } else {
                    createWordGroup(title, words.reverse(), wordList);
                }
            });
        }

        if (isDailyReview) {
            createWordGroup('Daily Review Words', wordsToDisplay, wordList);
            launchCelebrationEffects();
        }

        addEventListeners(wordList, isDailyReview ? displayDailyReview : displayWords);
        displayScore(result.score);
        displayLevel(result.level);
    });
}

function createWordGroup(title, words, container) {
    if (words.length > 0) {
        const groupTitle = document.createElement('h3');
        groupTitle.className = 'section-header';
        groupTitle.innerHTML = `<i class="fas fa-folder"></i> ${title}`;
        container.appendChild(groupTitle);

        words.forEach(entry => {
            const li = document.createElement('li');
            li.className = 'word-item';
            li.innerHTML = `
                <span class="word-text">${entry.word}</span>
                <div class="word-actions">
                    <button class="word-btn translate" data-word="${entry.word}">
                        <i class="fas fa-language"></i>
                    </button>
                    <button class="word-btn speak" data-word="${entry.word}">
                        <i class="fas fa-volume-up"></i>
                    </button>
                    <button class="word-btn delete" data-index="${entry.originalIndex}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(li);
        });
    }
}

// Event listeners and interaction handlers
function addEventListeners(wordList, refreshFn) {
    wordList.querySelectorAll('.speak').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const word = e.currentTarget.dataset.word;
            speakWord(word);
            animateButton(e.currentTarget);
        });
    });

    wordList.querySelectorAll('.delete').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = e.currentTarget.dataset.index;
            const wordItem = e.currentTarget.closest('.word-item');

            wordItem.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                chrome.storage.local.get({ words: [] }, (result) => {
                    const words = result.words;
                    words.splice(index, 1);
                    chrome.storage.local.set({ words }, () => {
                        refreshFn();
                    });
                });
            }, 300);
        });
    });

    wordList.querySelectorAll('.translate').forEach(button => {
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const word = e.currentTarget.dataset.word;
            animateButton(e.currentTarget);
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=he&dt=t&q=${encodeURI(word)}`;
                const response = await fetch(url);
                const data = await response.json();
                const translation = data[0][0][0];

                showTranslationPopup(word, translation);
                markWordAsReviewed(word);
            } catch (error) {
                showError('Translation failed. Please try again.');
            }
        });
    });
}

// Copy all words to clipboard
function copyAllWords() {
    chrome.storage.local.get({ words: [] }, (result) => {
        const words = result.words.map(entry => entry.word).join('\n');
        if (words.length === 0) {
            showError('אין מילים להעתקה.');
            return;
        }
        navigator.clipboard.writeText(words).then(() => {
            showSuccess('כל המילים הועתקו בהצלחה!');
        }).catch(err => {
            showError('שגיאה בהעתקה: ' + err);
        });
    });
}

// Add new word
function addNewWord() {
    const newWordInput = document.getElementById('newWordInput');
    const wordInputMessage = document.getElementById('wordInputMessage');
    const newWord = newWordInput.value.trim();
    const isEnglishWord = /^[a-zA-Z]+$/.test(newWord);

    console.log('addNewWord called with word:', newWord); // Log for debugging

    if (!newWord) {
        console.log('Empty word entered');
        wordInputMessage.textContent = 'אנא הזן מילה.';
        wordInputMessage.className = 'error-message';
        setTimeout(() => {
            wordInputMessage.textContent = '';
            wordInputMessage.className = '';
            console.log('Cleared error message');
        }, 3000);
        return;
    }

    if (!isEnglishWord) {
        console.log('Non-English word entered:', newWord);
        wordInputMessage.textContent = 'אנא הזן מילה באנגלית בלבד.';
        wordInputMessage.className = 'error-message';
        setTimeout(() => {
            wordInputMessage.textContent = '';
            wordInputMessage.className = '';
            console.log('Cleared error message');
        }, 3000);
        return;
    }

    chrome.storage.local.get({ words: [] }, (result) => {
        const words = result.words;
        if (words.some(entry => entry.word.toLowerCase() === newWord.toLowerCase())) {
            console.log('Word already exists:', newWord);
            wordInputMessage.textContent = 'המילה כבר קיימת ברשימה.';
            wordInputMessage.className = 'error-message';
            setTimeout(() => {
                wordInputMessage.textContent = '';
                wordInputMessage.className = '';
                console.log('Cleared error message');
            }, 3000);
            return;
        }

        words.push({ word: newWord, date: new Date().toLocaleDateString(), reviewed: false });
        chrome.storage.local.set({ words }, () => {
            console.log('Word added successfully:', newWord);
            wordInputMessage.textContent = 'המילה נוספה בהצלחה!';
            wordInputMessage.className = 'success-message';
            newWordInput.value = '';
            displayWords();
            setTimeout(() => {
                wordInputMessage.textContent = '';
                wordInputMessage.className = '';
                console.log('Cleared success message');
            }, 3000);
        });
    });
}

// Score and Level Management
function updateScore(points) {
    chrome.storage.local.get({ score: 0 }, (result) => {
        const newScore = result.score + points;
        chrome.storage.local.set({ score: newScore }, () => {
            displayScore(newScore);
            checkLevel(newScore);
            showScoreAnimation(points);
        });
    });
}

function displayScore(score) {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = `ניקוד: ${score}`;
    }
}

function checkLevel(score) {
    const newLevel = Math.floor(score / 100) + 1;
    chrome.storage.local.get({ level: 1 }, (result) => {
        if (newLevel > result.level) {
            chrome.storage.local.set({ level: newLevel }, () => {
                displayLevel(newLevel);
                showLevelUpAnimation(newLevel);
            });
        }
    });
}

function displayLevel(level) {
    const levelElement = document.getElementById('level');
    if (levelElement) {
        levelElement.textContent = `שלב: ${level}`;
    }
}

// Word Actions
function speakWord(word) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1;

        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
        markWordAsReviewed(word);
    } else {
        showError('Speech synthesis is not supported in your browser.');
    }
}

function markWordAsReviewed(word) {
    chrome.storage.local.get({ words: [], score: 0 }, (result) => {
        const words = result.words.map(w => {
            if (w.word === word && !w.reviewed) {
                w.reviewed = true;
                updateScore(1);
            }
            return w;
        });
        chrome.storage.local.set({ words });
    });
}

// UI Feedback and Animations
function showTranslationPopup(word, translation) {
    const popup = document.createElement('div');
    popup.className = 'translation-popup';
    popup.innerHTML = `
        <div class="translation-content">
            <div class="word">${word}</div>
            <div class="arrow">→</div>
            <div class="translation">${translation}</div>
        </div>
    `;
    document.body.appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 3000);
}

function showScoreAnimation(points) {
    const animation = document.createElement('div');
    animation.className = 'score-animation';
    animation.textContent = `+${points}`;
    document.getElementById('scoreContainer').appendChild(animation);

    setTimeout(() => {
        animation.remove();
    }, 1000);
}

function showLevelUpAnimation(level) {
    const overlay = document.createElement('div');
    overlay.className = 'level-up-overlay';
    overlay.innerHTML = `
        <div class="level-up-content">
            <i class="fas fa-trophy"></i>
            <h2>Level Up!</h2>
            <p>You've reached Level ${level}</p>
        </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.remove();
    }, 3000);
}

function showError(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    document.body.appendChild(error);

    setTimeout(() => {
        error.remove();
    }, 3000);
}

function showSuccess(message) {
    const success = document.createElement('div');
    success.className = 'success-message';
    success.textContent = message;
    document.body.appendChild(success);

    setTimeout(() => {
        success.remove();
    }, 3000);
}

function animateButton(button) {
    button.classList.add('active');
    setTimeout(() => button.classList.remove('active'), 200);
}

// View Management
function toggleView(show, hide, showBtn, hideBtn, displayFn) {
    document.getElementById(hide).style.display = 'none';
    document.getElementById(show).style.display = 'block';
    document.getElementById(hideBtn).style.display = 'none';
    document.getElementById(showBtn).style.display = 'inline-block';
    displayFn(true);
}

function displayDailyReview() {
    displayWords(true);
    chrome.runtime.sendMessage({ action: 'launchBubbles' });
}

// Utility Functions
function isSameDay(d1, d2) {
    return d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();
}

function launchCelebrationEffects() {
    chrome.runtime.sendMessage({ action: 'launchBubbles' });
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    displayWords();

    document.getElementById('dailyReviewBtn').addEventListener('click', () => {
        toggleView('dailyReview', 'wordListSection', 'wordListBtn', 'dailyReviewBtn', displayDailyReview);
    });

    document.getElementById('wordListBtn').addEventListener('click', () => {
        toggleView('wordListSection', 'dailyReview', 'dailyReviewBtn', 'wordListBtn', displayWords);
    });

    // Add event listener for adding new word
    document.getElementById('addWordButton').addEventListener('click', addNewWord);

    // Add event listener for copying all words
    document.getElementById('copyWordsBtn').addEventListener('click', () => {
        copyAllWords();
        animateButton(document.getElementById('copyWordsBtn'));
    });
});

// Daily Notification
function dailyNotification() {
    chrome.storage.local.get({ lastNotification: 0 }, (result) => {
        const currentTime = Date.now();
        const lastNotification = result.lastNotification;
        const oneDay = 24 * 60 * 60 * 1000;

        if (currentTime - lastNotification > oneDay) {
            chrome.notifications.create('dailyReview', {
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'Time for Daily Review!',
                message: 'Keep your vocabulary strong - review your words now!',
                priority: 2
            });
            chrome.storage.local.set({ lastNotification: currentTime });
        }
    });
}

chrome.runtime.onStartup.addListener(dailyNotification);