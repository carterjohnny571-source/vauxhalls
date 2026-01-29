/*
==========================================
THE VAUXHALLS - CHAT ROOM (THE GARAGE)
==========================================
Anonymous real-time chat with Firebase
Features: Multiple channels, rate limiting, moderation
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
        STORAGE_MESSAGES: 'vauxhalls_messages_',

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
    // STATE MANAGEMENT
    // ==========================================

    const state = {
        username: null,
        currentChannel: 'general',
        lastMessageTime: 0,
        isRateLimited: false,
        onlineCount: 1,
        messages: {}
    };

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

    // Firebase configuration placeholder
    // Replace with your own Firebase config
    const firebaseConfig = {
        // IMPORTANT: Replace these with your Firebase project credentials
        // Get these from: https://console.firebase.google.com/
        // Project Settings > General > Your apps > Firebase SDK snippet

        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    let firebaseInitialized = false;
    let database = null;

    function initFirebase() {
        // Check if Firebase SDK is loaded
        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK not loaded. Using localStorage fallback.');
            return false;
        }

        // Check if config is set
        if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
            console.warn('Firebase not configured. Using localStorage fallback.');
            console.log('To enable real-time chat, add your Firebase config in js/chat.js');
            return false;
        }

        try {
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            database = firebase.database();
            firebaseInitialized = true;
            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase initialization error:', error);
            return false;
        }
    }

    // ==========================================
    // LOCAL STORAGE FALLBACK
    // For demo/development without Firebase
    // ==========================================

    function getLocalMessages(channel) {
        const key = CONFIG.STORAGE_MESSAGES + channel;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    }

    function saveLocalMessage(channel, message) {
        const key = CONFIG.STORAGE_MESSAGES + channel;
        const messages = getLocalMessages(channel);
        messages.push(message);

        // Keep only last N messages
        if (messages.length > CONFIG.MAX_MESSAGES_DISPLAY) {
            messages.splice(0, messages.length - CONFIG.MAX_MESSAGES_DISPLAY);
        }

        localStorage.setItem(key, JSON.stringify(messages));
    }

    function clearLocalMessages(channel) {
        const key = CONFIG.STORAGE_MESSAGES + channel;
        localStorage.removeItem(key);
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
            return { valid: false, error: `Username must be at least ${CONFIG.MIN_USERNAME_LENGTH} characters` };
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
        emitUserOnline();
        showToast(`Welcome to The Garage, ${validation.username}!`, 'success');
    }

    // ==========================================
    // CHANNEL MANAGEMENT
    // ==========================================

    function switchChannel(channelId) {
        if (!CONFIG.CHANNELS[channelId]) return;

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
        if (message.type === 'announcement') {
            div.classList.add('announcement');
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
        if (firebaseInitialized && database) {
            // Load from Firebase
            const messagesRef = database.ref(`messages/${state.currentChannel}`);
            messagesRef.orderByChild('timestamp').limitToLast(CONFIG.MESSAGES_PER_LOAD).on('child_added', (snapshot) => {
                const message = snapshot.val();
                addMessageToDisplay(message);
            });
        } else {
            // Load from localStorage
            const messages = getLocalMessages(state.currentChannel);
            messages.forEach(message => {
                addMessageToDisplay(message);
            });
        }
    }

    function sendMessage(text) {
        if (!text || !state.username) return false;

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
            timestamp: now,
            channel: state.currentChannel
        };

        // Save message
        if (firebaseInitialized && database) {
            const messagesRef = database.ref(`messages/${state.currentChannel}`);
            messagesRef.push(message);
        } else if (socket) {
            // Use socket.io for real-time broadcast
            socket.emit('chat-message', {
                message: trimmedText,
                channel: state.currentChannel
            });
            // Also save locally
            saveLocalMessage(state.currentChannel, message);
        } else {
            // localStorage fallback only
            saveLocalMessage(state.currentChannel, message);
            addMessageToDisplay(message);
        }

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

        // Clear local messages
        if (elements.clearLocalBtn) {
            elements.clearLocalBtn.addEventListener('click', () => {
                if (confirm('Clear all messages from this channel? (This only affects your local view)')) {
                    clearLocalMessages(state.currentChannel);
                    clearMessagesDisplay();
                    showToast('Local messages cleared', 'success');
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
    }

    // ==========================================
    // SOCKET.IO CONNECTION
    // ==========================================

    let socket = null;

    function initSocketIO() {
        if (typeof io === 'undefined') {
            console.warn('Socket.io not available');
            return;
        }

        socket = io();

        // Get real online count from server
        socket.on('online-count', function(count) {
            if (elements.onlineCount) {
                elements.onlineCount.textContent = count;
            }
        });

        // Real-time chat messages
        socket.on('chat-message', function(data) {
            if (data.channel === state.currentChannel) {
                addMessageToDisplay({
                    username: data.username,
                    text: data.message,
                    timestamp: new Date(data.timestamp).getTime()
                });
            }
        });

        // User joined notification
        socket.on('user-joined', function(data) {
            addMessageToDisplay({
                username: 'System',
                text: data.username + ' joined The Garage',
                timestamp: Date.now(),
                type: 'system'
            });
        });

        // User left notification
        socket.on('user-left', function(data) {
            addMessageToDisplay({
                username: 'System',
                text: data.username + ' left The Garage',
                timestamp: Date.now(),
                type: 'system'
            });
        });
    }

    function emitUserOnline() {
        // Check if user is registered via server system
        const serverUser = JSON.parse(localStorage.getItem('vauxhalls_user') || 'null');
        if (socket && serverUser) {
            socket.emit('user-online', { odekicId: serverUser.odekicId, username: serverUser.username });
        } else if (socket && state.username) {
            // Fallback to local username
            socket.emit('user-online', { odekicId: 'local_' + Date.now(), username: state.username });
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================

    function init() {
        // Initialize Socket.io for real-time features
        initSocketIO();

        // Initialize Firebase (or fallback to localStorage)
        initFirebase();

        // Check for server-registered user first
        const serverUser = JSON.parse(localStorage.getItem('vauxhalls_user') || 'null');
        if (serverUser && serverUser.username) {
            setUsername(serverUser.username);
            hideUsernameModal();
            loadMessages();
            emitUserOnline();
        } else {
            // Fall back to old localStorage username
            const storedUsername = getStoredUsername();
            if (storedUsername) {
                const validation = validateUsername(storedUsername);
                if (validation.valid) {
                    setUsername(validation.username);
                    hideUsernameModal();
                    loadMessages();
                    emitUserOnline();
                } else {
                    showUsernameModal();
                }
            } else {
                showUsernameModal();
            }
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
        console.log('Firebase:', firebaseInitialized ? 'Connected' : 'Using localStorage fallback');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
