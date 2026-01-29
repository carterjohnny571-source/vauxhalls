/*
==========================================
THE VAUXHALLS - CHAT ROOM (THE GARAGE)
==========================================
Real-time chat with Firebase
Features: Multiple channels, presence detection, visitor tracking
==========================================
*/

(function() {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================

    const CONFIG = {
        // Rate limiting
        MESSAGE_COOLDOWN: 2000, // 2 seconds between messages
        MAX_MESSAGE_LENGTH: 500,
        MAX_USERNAME_LENGTH: 20,
        MIN_USERNAME_LENGTH: 1,

        // Message limits
        MAX_MESSAGES_DISPLAY: 100,
        MESSAGES_PER_LOAD: 50,

        // LocalStorage keys
        STORAGE_USERNAME: 'vauxhalls_username',
        STORAGE_VISITOR_ID: 'vauxhalls_visitor_id',

        // Channel definitions
        CHANNELS: {
            general: {
                name: '# General Chat',
                description: 'Chat with other fans and bands'
            },
            announcements: {
                name: '# Show Announcements',
                description: 'Official show and tour announcements'
            },
            recommendations: {
                name: '# Recommendations',
                description: 'Share and discover new music and shows'
            }
        }
    };

    // ==========================================
    // FIREBASE CONFIGURATION
    // ==========================================

    // IMPORTANT: Replace with your Firebase project credentials
    // Get these from: https://console.firebase.google.com/
    // Project Settings > General > Your apps > Firebase SDK snippet
    const firebaseConfig = {
        apiKey: "AIzaSyAdb-5ZAJlWjTX1Q2JKZeJaKfyiHSqJKQs",
        authDomain: "vauxhalls.firebaseapp.com",
        databaseURL: "https://vauxhalls-default-rtdb.firebaseio.com",
        projectId: "vauxhalls",
        storageBucket: "vauxhalls.firebasestorage.app",
        messagingSenderId: "691217822844",
        appId: "1:691217822844:web:fa91fae4fb7e41229805f9"
    };

    // ==========================================
    // STATE MANAGEMENT
    // ==========================================

    const state = {
        username: null,
        visitorId: null,
        currentChannel: 'general',
        lastMessageTime: 0,
        isRateLimited: false,
        onlineCount: 0,
        totalVisitors: 0,
        firebaseReady: false,
        messageListeners: {}
    };

    let database = null;
    let presenceRef = null;
    let connectedRef = null;

    // ==========================================
    // DOM ELEMENTS
    // ==========================================

    const elements = {
        // Modal
        usernameModal: document.getElementById('usernameModal'),
        usernameForm: document.getElementById('usernameForm'),
        usernameInput: document.getElementById('usernameInput'),
        charCount: document.getElementById('charCount'),

        // Chat container
        chatContainer: document.getElementById('chatContainer'),

        // Sidebar
        chatSidebar: document.getElementById('chatSidebar'),
        sidebarToggle: document.getElementById('sidebarToggle'),
        channelButtons: document.querySelectorAll('.channel-btn'),

        // User info
        userAvatar: document.getElementById('userAvatar'),
        currentUserName: document.getElementById('currentUserName'),
        changeNameBtn: document.getElementById('changeNameBtn'),
        onlineCount: document.getElementById('onlineCount'),
        totalVisitors: document.getElementById('totalVisitors'),

        // Chat header
        currentChannelName: document.getElementById('currentChannelName'),
        channelDescription: document.getElementById('channelDescription'),
        clearLocalBtn: document.getElementById('clearLocalBtn'),

        // Messages
        messagesContainer: document.getElementById('messagesContainer'),
        messagesList: document.getElementById('messagesList'),

        // Message input
        messageForm: document.getElementById('messageForm'),
        messageInput: document.getElementById('messageInput'),
        messageCharCount: document.getElementById('messageCharCount'),
        sendBtn: document.getElementById('sendBtn'),
        rateLimitWarning: document.getElementById('rateLimitWarning'),

        // Toast
        toastContainer: document.getElementById('toastContainer')
    };

    // ==========================================
    // FIREBASE INITIALIZATION
    // ==========================================

    function initFirebase() {
        // Check if Firebase SDK is loaded
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded');
            showToast('Chat service unavailable. Please refresh the page.', 'error');
            return false;
        }

        // Check if config is set
        if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
            console.warn('Firebase not configured. Please add your Firebase config.');
            showToast('Chat not configured. Contact site admin.', 'error');
            return false;
        }

        try {
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            database = firebase.database();
            state.firebaseReady = true;
            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase initialization error:', error);
            showToast('Failed to connect to chat service.', 'error');
            return false;
        }
    }

    // ==========================================
    // VISITOR ID MANAGEMENT
    // ==========================================

    function getOrCreateVisitorId() {
        let visitorId = localStorage.getItem(CONFIG.STORAGE_VISITOR_ID);
        if (!visitorId) {
            // Generate a unique visitor ID
            visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(CONFIG.STORAGE_VISITOR_ID, visitorId);
        }
        return visitorId;
    }

    // ==========================================
    // PRESENCE SYSTEM (Live User Count)
    // ==========================================

    function initPresence() {
        if (!state.firebaseReady || !database) return;

        state.visitorId = getOrCreateVisitorId();

        // Reference to the presence list
        presenceRef = database.ref('presence/' + state.visitorId);

        // Reference to .info/connected which is true when connected
        connectedRef = database.ref('.info/connected');

        connectedRef.on('value', (snapshot) => {
            if (snapshot.val() === true) {
                // We're connected (or reconnected)

                // Set our presence data
                presenceRef.set({
                    username: state.username || 'Anonymous',
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });

                // Remove presence data when we disconnect
                presenceRef.onDisconnect().remove();
            }
        });

        // Listen to all presence changes to get online count
        database.ref('presence').on('value', (snapshot) => {
            const presenceData = snapshot.val();
            const count = presenceData ? Object.keys(presenceData).length : 0;
            state.onlineCount = count;
            updateOnlineCount(count);
        });
    }

    function updatePresenceUsername() {
        if (presenceRef && state.username) {
            presenceRef.update({
                username: state.username,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }
    }

    function updateOnlineCount(count) {
        if (elements.onlineCount) {
            elements.onlineCount.textContent = count;
        }
    }

    // ==========================================
    // TOTAL VISITOR TRACKING
    // ==========================================

    function initVisitorTracking() {
        if (!state.firebaseReady || !database) return;

        const visitorId = getOrCreateVisitorId();
        const visitorsRef = database.ref('visitors');
        const thisVisitorRef = database.ref('visitors/' + visitorId);

        // Check if this visitor has been counted before
        thisVisitorRef.once('value', (snapshot) => {
            if (!snapshot.exists()) {
                // New visitor - add them and increment counter
                thisVisitorRef.set({
                    firstVisit: firebase.database.ServerValue.TIMESTAMP,
                    lastVisit: firebase.database.ServerValue.TIMESTAMP
                });

                // Increment total visitor count
                database.ref('stats/totalVisitors').transaction((current) => {
                    return (current || 0) + 1;
                });
            } else {
                // Returning visitor - just update last visit
                thisVisitorRef.update({
                    lastVisit: firebase.database.ServerValue.TIMESTAMP
                });
            }
        });

        // Listen to total visitor count changes
        database.ref('stats/totalVisitors').on('value', (snapshot) => {
            const total = snapshot.val() || 0;
            state.totalVisitors = total;
            updateTotalVisitors(total);
        });
    }

    function updateTotalVisitors(count) {
        if (elements.totalVisitors) {
            elements.totalVisitors.textContent = count.toLocaleString();
        }
    }

    // ==========================================
    // USERNAME MANAGEMENT
    // ==========================================

    function getStoredUsername() {
        return localStorage.getItem(CONFIG.STORAGE_USERNAME);
    }

    function setStoredUsername(username) {
        localStorage.setItem(CONFIG.STORAGE_USERNAME, username);
    }

    function validateUsername(username) {
        if (!username || typeof username !== 'string') {
            return { valid: false, error: 'Please enter a username' };
        }

        const trimmed = username.trim();

        if (trimmed.length < CONFIG.MIN_USERNAME_LENGTH) {
            return { valid: false, error: `Username must be at least ${CONFIG.MIN_USERNAME_LENGTH} character` };
        }

        if (trimmed.length > CONFIG.MAX_USERNAME_LENGTH) {
            return { valid: false, error: `Username must be ${CONFIG.MAX_USERNAME_LENGTH} characters or less` };
        }

        // Basic sanitization - allow alphanumeric, spaces, underscores, hyphens
        const sanitized = trimmed.replace(/[^a-zA-Z0-9\s_-]/g, '');
        if (sanitized !== trimmed) {
            return { valid: false, error: 'Username can only contain letters, numbers, spaces, underscores, and hyphens' };
        }

        return { valid: true, username: sanitized };
    }

    function setUsername(username) {
        state.username = username;
        setStoredUsername(username);
        updateUserDisplay();
        updatePresenceUsername();
    }

    function updateUserDisplay() {
        if (elements.userAvatar) {
            elements.userAvatar.textContent = state.username ? state.username.charAt(0).toUpperCase() : '?';
        }
        if (elements.currentUserName) {
            elements.currentUserName.textContent = state.username || 'Anonymous';
        }
    }

    // ==========================================
    // MODAL HANDLING
    // ==========================================

    function showUsernameModal() {
        if (elements.usernameModal) {
            elements.usernameModal.classList.remove('hidden');
        }
        if (elements.chatContainer) {
            elements.chatContainer.classList.remove('active');
        }
    }

    function hideUsernameModal() {
        if (elements.usernameModal) {
            elements.usernameModal.classList.add('hidden');
        }
        if (elements.chatContainer) {
            elements.chatContainer.classList.add('active');
        }
    }

    function handleUsernameSubmit(e) {
        e.preventDefault();

        const input = elements.usernameInput;
        if (!input) return;

        const validation = validateUsername(input.value);

        if (!validation.valid) {
            showToast(validation.error, 'error');
            input.focus();
            return;
        }

        setUsername(validation.username);
        hideUsernameModal();
        loadMessages();
        showToast(`Welcome to The Garage, ${validation.username}!`, 'success');
    }

    // ==========================================
    // CHANNEL MANAGEMENT
    // ==========================================

    function switchChannel(channelId) {
        if (!CONFIG.CHANNELS[channelId]) return;

        // Detach old listener
        if (state.messageListeners[state.currentChannel]) {
            database.ref(`messages/${state.currentChannel}`).off('child_added', state.messageListeners[state.currentChannel]);
        }

        state.currentChannel = channelId;

        // Update UI
        elements.channelButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.channel === channelId);
        });

        if (elements.currentChannelName) {
            elements.currentChannelName.textContent = CONFIG.CHANNELS[channelId].name;
        }
        if (elements.channelDescription) {
            elements.channelDescription.textContent = CONFIG.CHANNELS[channelId].description;
        }

        // Clear and reload messages
        clearMessagesDisplay();
        loadMessages();

        // Close mobile sidebar
        if (elements.chatSidebar) {
            elements.chatSidebar.classList.remove('active');
        }
    }

    // ==========================================
    // MESSAGE HANDLING
    // ==========================================

    function createMessageElement(message, isOwnMessage = false) {
        const div = document.createElement('div');
        div.className = `message${isOwnMessage ? ' own-message' : ''}`;

        if (message.type === 'system') {
            div.classList.add('system-message');
            div.innerHTML = `
                <div class="message-content">
                    <p class="message-text">${escapeHtml(message.text)}</p>
                </div>
            `;
            return div;
        }

        const avatarInitial = message.username ? message.username.charAt(0).toUpperCase() : '?';
        const time = formatTime(message.timestamp);

        div.innerHTML = `
            <div class="message-avatar">${escapeHtml(avatarInitial)}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${escapeHtml(message.username)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <p class="message-text">${escapeHtml(message.text)}</p>
            </div>
        `;

        return div;
    }

    function addMessageToDisplay(message) {
        const isOwnMessage = message.username === state.username;
        const messageElement = createMessageElement(message, isOwnMessage);

        // Remove welcome message if present
        const welcomeMessage = elements.messagesList.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        elements.messagesList.appendChild(messageElement);

        // Limit displayed messages
        const messages = elements.messagesList.querySelectorAll('.message');
        if (messages.length > CONFIG.MAX_MESSAGES_DISPLAY) {
            messages[0].remove();
        }

        // Scroll to bottom
        scrollToBottom();
    }

    function clearMessagesDisplay() {
        if (elements.messagesList) {
            elements.messagesList.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9,22 9,12 15,12 15,22"/>
                        </svg>
                    </div>
                    <h4>Welcome to ${CONFIG.CHANNELS[state.currentChannel].name}!</h4>
                    <p>${CONFIG.CHANNELS[state.currentChannel].description}</p>
                </div>
            `;
        }
    }

    function loadMessages() {
        if (!state.firebaseReady || !database) {
            console.warn('Firebase not ready, cannot load messages');
            return;
        }

        const messagesRef = database.ref(`messages/${state.currentChannel}`);

        // First, load existing messages
        messagesRef.orderByChild('timestamp').limitToLast(CONFIG.MESSAGES_PER_LOAD).once('value', (snapshot) => {
            const messages = [];
            snapshot.forEach((child) => {
                messages.push(child.val());
            });

            // Sort by timestamp and display
            messages.sort((a, b) => a.timestamp - b.timestamp);
            messages.forEach(message => {
                addMessageToDisplay(message);
            });

            // Then listen for new messages
            const listener = messagesRef.orderByChild('timestamp').startAt(Date.now()).on('child_added', (snapshot) => {
                const message = snapshot.val();
                addMessageToDisplay(message);
            });

            state.messageListeners[state.currentChannel] = listener;
        });
    }

    function sendMessage(text) {
        if (!text) {
            showToast('Please enter a message', 'error');
            return false;
        }
        if (!state.username) {
            showToast('Please set a username first', 'error');
            showUsernameModal();
            return false;
        }
        if (!state.firebaseReady || !database) {
            showToast('Chat service not connected', 'error');
            return false;
        }

        // Rate limiting check
        const now = Date.now();
        if (now - state.lastMessageTime < CONFIG.MESSAGE_COOLDOWN) {
            showRateLimitWarning();
            return false;
        }

        // Validate message
        const trimmedText = text.trim();
        if (trimmedText.length === 0 || trimmedText.length > CONFIG.MAX_MESSAGE_LENGTH) {
            return false;
        }

        const message = {
            username: state.username,
            text: trimmedText,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            channel: state.currentChannel
        };

        // Push message to Firebase
        const messagesRef = database.ref(`messages/${state.currentChannel}`);
        messagesRef.push(message)
            .then(() => {
                console.log('Message sent successfully');
            })
            .catch((error) => {
                console.error('Error sending message:', error);
                showToast('Failed to send message: ' + error.message, 'error');
            });

        state.lastMessageTime = now;
        return true;
    }

    function handleMessageSubmit(e) {
        e.preventDefault();

        const input = elements.messageInput;
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        if (sendMessage(text)) {
            input.value = '';
            updateMessageCharCount();
            updateSendButton();
        }
    }

    // ==========================================
    // RATE LIMITING
    // ==========================================

    function showRateLimitWarning() {
        if (elements.rateLimitWarning) {
            elements.rateLimitWarning.classList.add('visible');
            state.isRateLimited = true;

            setTimeout(() => {
                elements.rateLimitWarning.classList.remove('visible');
                state.isRateLimited = false;
            }, CONFIG.MESSAGE_COOLDOWN);
        }
    }

    // ==========================================
    // UI UPDATES
    // ==========================================

    function updateMessageCharCount() {
        if (!elements.messageInput || !elements.messageCharCount) return;

        const count = elements.messageInput.value.length;
        elements.messageCharCount.textContent = count;

        // Update counter color
        elements.messageCharCount.parentElement.classList.remove('warning', 'error');
        if (count > CONFIG.MAX_MESSAGE_LENGTH * 0.9) {
            elements.messageCharCount.parentElement.classList.add('error');
        } else if (count > CONFIG.MAX_MESSAGE_LENGTH * 0.75) {
            elements.messageCharCount.parentElement.classList.add('warning');
        }
    }

    function updateUsernameCharCount() {
        if (!elements.usernameInput || !elements.charCount) return;
        elements.charCount.textContent = elements.usernameInput.value.length;
    }

    function updateSendButton() {
        if (!elements.sendBtn || !elements.messageInput) return;

        const hasText = elements.messageInput.value.trim().length > 0;
        const withinLimit = elements.messageInput.value.length <= CONFIG.MAX_MESSAGE_LENGTH;

        elements.sendBtn.disabled = !hasText || !withinLimit || state.isRateLimited;
    }

    function scrollToBottom() {
        if (elements.messagesContainer) {
            elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
        }
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================

    function showToast(message, type = 'info') {
        if (!elements.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;

        // Close button handler
        toast.querySelector('.toast-close').addEventListener('click', () => {
            removeToast(toast);
        });

        elements.toastContainer.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            removeToast(toast);
        }, 5000);
    }

    function removeToast(toast) {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================

    function initEventListeners() {
        // Username form
        if (elements.usernameForm) {
            elements.usernameForm.addEventListener('submit', handleUsernameSubmit);
        }

        // Username input character count
        if (elements.usernameInput) {
            elements.usernameInput.addEventListener('input', updateUsernameCharCount);
        }

        // Change name button
        if (elements.changeNameBtn) {
            elements.changeNameBtn.addEventListener('click', () => {
                showUsernameModal();
                if (elements.usernameInput) {
                    elements.usernameInput.value = state.username || '';
                    updateUsernameCharCount();
                }
            });
        }

        // Channel buttons
        elements.channelButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                switchChannel(btn.dataset.channel);
            });
        });

        // Sidebar toggle (mobile)
        if (elements.sidebarToggle) {
            elements.sidebarToggle.addEventListener('click', () => {
                if (elements.chatSidebar) {
                    elements.chatSidebar.classList.toggle('active');
                }
            });
        }

        // Message form
        if (elements.messageForm) {
            elements.messageForm.addEventListener('submit', handleMessageSubmit);
        }

        // Message input
        if (elements.messageInput) {
            elements.messageInput.addEventListener('input', () => {
                updateMessageCharCount();
                updateSendButton();
            });

            elements.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleMessageSubmit(e);
                }
            });
        }

        // Clear local messages (now clears view only, not Firebase)
        if (elements.clearLocalBtn) {
            elements.clearLocalBtn.addEventListener('click', () => {
                if (confirm('Clear messages from your view? (Messages will reappear on refresh)')) {
                    clearMessagesDisplay();
                    showToast('View cleared', 'success');
                }
            });
        }

        // Close sidebar when clicking outside (mobile)
        document.addEventListener('click', (e) => {
            if (elements.chatSidebar &&
                elements.chatSidebar.classList.contains('active') &&
                !elements.chatSidebar.contains(e.target) &&
                !elements.sidebarToggle.contains(e.target)) {
                elements.chatSidebar.classList.remove('active');
            }
        });

        // Handle page visibility for presence
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && presenceRef) {
                presenceRef.update({
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            }
        });

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            if (presenceRef) {
                presenceRef.remove();
            }
        });
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function init() {
        // Initialize Firebase first
        const firebaseOk = initFirebase();

        if (firebaseOk) {
            // Initialize presence system
            initPresence();

            // Initialize visitor tracking
            initVisitorTracking();
        }

        // Check for stored username (also check old format for returning users)
        let storedUsername = getStoredUsername();

        // Check old localStorage format from previous version
        if (!storedUsername) {
            const oldUser = localStorage.getItem('vauxhalls_user');
            if (oldUser) {
                try {
                    const parsed = JSON.parse(oldUser);
                    if (parsed && parsed.username) {
                        storedUsername = parsed.username;
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }

        if (storedUsername) {
            const validation = validateUsername(storedUsername);
            if (validation.valid) {
                setUsername(validation.username);
                hideUsernameModal();
                if (firebaseOk) {
                    loadMessages();
                }
            } else {
                showUsernameModal();
            }
        } else {
            showUsernameModal();
        }

        // Initialize event listeners
        initEventListeners();

        // Set initial channel display
        if (elements.currentChannelName) {
            elements.currentChannelName.textContent = CONFIG.CHANNELS[state.currentChannel].name;
        }
        if (elements.channelDescription) {
            elements.channelDescription.textContent = CONFIG.CHANNELS[state.currentChannel].description;
        }

        console.log('The Garage - Chat initialized');
        console.log('Firebase:', state.firebaseReady ? 'Connected' : 'Not connected');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
