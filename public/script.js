const socket = io();
let currentPartner = null;
let escPressCount = 0;
let escTimeout;
let userInterests = new Set();

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const chatScreen = document.getElementById('chat-screen');
const interestInput = document.getElementById('interest-input');
const tagsContainer = document.getElementById('tags');
const currentInterestsContainer = document.getElementById('current-interests');
const startChatButton = document.getElementById('start-chat');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const disconnectButton = document.getElementById('disconnect');
const matchTypeRadios = document.querySelectorAll('input[name="matchType"]');

// Agreement Popup Elements
const agreementPopup = document.getElementById('agreement-popup');
const ageVerifyCheckbox = document.getElementById('age-verify');
const termsAgreeCheckbox = document.getElementById('terms-agree');
const agreeButton = document.getElementById('agree-button');
const cancelButton = document.getElementById('cancel-button');

// Event Listeners for Agreement
ageVerifyCheckbox.addEventListener('change', updateAgreeButton);
termsAgreeCheckbox.addEventListener('change', updateAgreeButton);

agreeButton.addEventListener('click', () => {
    agreementPopup.style.display = 'none';
    proceedWithChat();
});

cancelButton.addEventListener('click', () => {
    agreementPopup.style.display = 'none';
    ageVerifyCheckbox.checked = false;
    termsAgreeCheckbox.checked = false;
    updateAgreeButton();
});

function updateAgreeButton() {
    agreeButton.disabled = !(ageVerifyCheckbox.checked && termsAgreeCheckbox.checked);
}

// Event Listeners
startChatButton.addEventListener('click', () => {
    const selectedMatchType = document.querySelector('input[name="matchType"]:checked').value;
    
    if (selectedMatchType === 'interest' && userInterests.size === 0) {
        alert('Please add at least one interest for interest-based matching');
        return;
    }

    // Show agreement popup
    agreementPopup.style.display = 'flex';
});

sendButton.addEventListener('click', sendMessage);

disconnectButton.addEventListener('click', () => {
    if (currentPartner) {
        socket.emit('disconnectPartner', { partnerId: currentPartner });
        addMessage('You have disconnected from your partner.', 'system');
        currentPartner = null;
        
        // Return to welcome screen after disconnecting
        setTimeout(() => {
            welcomeScreen.classList.remove('hidden');
            chatScreen.classList.add('hidden');
            messagesContainer.innerHTML = '';
        }, 2000);
    }
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

interestInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        e.preventDefault();
        addTag(e.target.value.trim());
        e.target.value = '';
    }
});

// ESC key handling
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (currentPartner) {
            // If connected, disconnect from current partner
            socket.emit('disconnectPartner', { partnerId: currentPartner });
            addMessage('You have disconnected from your partner.', 'system');
            currentPartner = null;
        } else {
            // If not connected, find a new partner
            messagesContainer.innerHTML = '';
            addMessage('Finding a stranger...', 'system');
            socket.emit('findNewPartner');
        }
    }
});

function addTag(tag) {
    if (!userInterests.has(tag)) {
        userInterests.add(tag);
        const tagElement = document.createElement('div');
        tagElement.className = 'tag';
        tagElement.innerHTML = `
            ${tag}
            <span class="remove-tag" onclick="removeTag('${tag}')">×</span>
        `;
        tagsContainer.appendChild(tagElement);
    }
}

function removeTag(tag) {
    userInterests.delete(tag);
    const tagElements = tagsContainer.getElementsByClassName('tag');
    for (let i = 0; i < tagElements.length; i++) {
        if (tagElements[i].textContent.trim() === tag) {
            tagElements[i].remove();
            break;
        }
    }
}

function proceedWithChat() {
    const selectedMatchType = document.querySelector('input[name="matchType"]:checked').value;

    // Display interests in chat header if using interest-based matching
    if (selectedMatchType === 'interest') {
        currentInterestsContainer.innerHTML = '';
        userInterests.forEach(interest => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag';
            tagElement.textContent = interest;
            currentInterestsContainer.appendChild(tagElement);
        });
    } else {
        currentInterestsContainer.innerHTML = '<div class="tag">🎲 Random Matching</div>';
    }

    // Clear chat and show finding message
    messagesContainer.innerHTML = '';
    addMessage('🔍 Finding a stranger...', 'system');

    socket.emit('join', { 
        interests: Array.from(userInterests),
        matchType: selectedMatchType
    });
    welcomeScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && currentPartner) {
        socket.emit('message', {
            message,
            to: currentPartner
        });
        addMessage(message, 'sent');
        messageInput.value = '';
    }
}

function addMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', type);
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Socket Events
socket.on('matched', (data) => {
    currentPartner = data.partnerId;
    let matchMessage = '';
    
    // Clear the chat box when connecting to a new user
    messagesContainer.innerHTML = '';
    
    if (data.matchType === 'interest') {
        const commonInterests = data.commonInterests;
        matchMessage = `✨ You are now connected with a stranger based on shared interests: ${commonInterests.join(', ')} ✨`;
    } else if (data.matchType === 'different') {
        matchMessage = '🌟 No stranger with common interests found. Connected to a stranger with different interests! 🌟';
    } else if (data.matchType === 'random') {
        matchMessage = '🎲 Connected to a random stranger! 🎲';
    } else {
        matchMessage = '👋 You are now connected with a stranger! 👋';
    }
    
    addMessage(matchMessage, 'system');
});

socket.on('noMatchFound', () => {
    messagesContainer.innerHTML = '';
    addMessage('😔 No stranger found. Please try again later. 😔', 'system');
    currentPartner = null;
    
    // Reset the UI
    setTimeout(() => {
        welcomeScreen.classList.remove('hidden');
        chatScreen.classList.add('hidden');
        messagesContainer.innerHTML = '';
    }, 2000);
});

socket.on('message', (data) => {
    addMessage(data.message, 'received');
});

socket.on('partnerDisconnected', () => {
    addMessage('👋 Your partner has disconnected.', 'system');
    currentPartner = null;
    messagesContainer.innerHTML = '';
    addMessage('💫 Stranger disconnected ...Press ESC to find a new stranger... 💫', 'system');
});

socket.on('newPartnerFound', (data) => {
    currentPartner = data.partnerId;
    let matchMessage = '';
    
    if (data.matchType === 'interest') {
        const commonInterests = data.commonInterests;
        matchMessage = `✨ You are now connected with a new stranger based on shared interests: ${commonInterests.join(', ')} ✨`;
    } else {
        matchMessage = '🎲 You are now connected with a new random stranger! 🎲';
    }
    
    addMessage(matchMessage, 'system');
}); 