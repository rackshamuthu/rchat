/**
 * Rchat by Sumis - Frontend Application Logic
 * Full WhatsApp Re-engineering with Real-Time Messaging & Media Sharing
 */

(function () {
  'use strict';

  // State Management
  const state = {
    currentUser: null,
    activeChat: null,
    contacts: [],
    messages: [],
    statuses: [],
    calls: [],
    eventSource: null,
    activeTab: 'tab-content-chats',
    soundEnabled: true,
    isRecordingVoice: false,
    mediaRecorder: null,
    audioChunks: []
  };

  // Sound effects using Web Audio API synthesis (Zero external audio file dependency!)
  function playSound(type) {
    if (!state.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'send') {
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'receive') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1050, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch (e) {
      // AudioContext not allowed or muted
    }
  }

  // Double Checkmark SVGs (WhatsApp style)
  const TICKS = {
    sent: `<span class="bubble-tick sent" title="Sent"><svg viewBox="0 0 16 15" width="16" height="15"><path fill="currentColor" d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879 2.08 7.394a.366.366 0 0 0-.518 0l-.417.418a.366.366 0 0 0 0 .517l3.056 3.056a.366.366 0 0 0 .54-.027l5.688-7.533a.365.365 0 0 0-.419-.509z"/></svg></span>`,
    delivered: `<span class="bubble-tick delivered" title="Delivered"><svg viewBox="0 0 16 15" width="16" height="15"><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879 6.18 7.394a.366.366 0 0 0-.518 0l-.417.418a.366.366 0 0 0 0 .517l3.056 3.056a.366.366 0 0 0 .54-.027l5.688-7.533a.365.365 0 0 0-.419-.509zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879 2.08 7.394a.366.366 0 0 0-.518 0l-.417.418a.366.366 0 0 0 0 .517l3.056 3.056a.366.366 0 0 0 .54-.027l5.688-7.533a.365.365 0 0 0-.419-.509z"/></svg></span>`,
    read: `<span class="bubble-tick read" title="Read"><svg viewBox="0 0 16 15" width="16" height="15"><path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879 6.18 7.394a.366.366 0 0 0-.518 0l-.417.418a.366.366 0 0 0 0 .517l3.056 3.056a.366.366 0 0 0 .54-.027l5.688-7.533a.365.365 0 0 0-.419-.509zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879 2.08 7.394a.366.366 0 0 0-.518 0l-.417.418a.366.366 0 0 0 0 .517l3.056 3.056a.366.366 0 0 0 .54-.027l5.688-7.533a.365.365 0 0 0-.419-.509z"/></svg></span>`
  };

  // DOM Elements
  const el = {
    screenWelcome: document.getElementById('screen-welcome'),
    screenPhone: document.getElementById('screen-phone'),
    screenOtp: document.getElementById('screen-otp'),
    screenProfile: document.getElementById('screen-profile'),
    screenMain: document.getElementById('screen-main'),
    screenChat: document.getElementById('screen-chat'),

    // Test bar
    currentUserBadge: document.getElementById('current-user-badge'),
    btnQuickUserA: document.getElementById('btn-quick-user-a'),
    btnQuickUserB: document.getElementById('btn-quick-user-b'),
    btnOpenNewWindow: document.getElementById('btn-open-new-window'),

    // Welcome & Phone
    btnAgreeContinue: document.getElementById('btn-agree-continue'),
    btnBackToWelcome: document.getElementById('btn-back-to-welcome'),
    inputPhone: document.getElementById('input-phone'),
    btnSendOtp: document.getElementById('btn-send-otp'),

    // OTP
    btnBackToPhone: document.getElementById('btn-back-to-phone'),
    otpPhoneDisplay: document.getElementById('otp-phone-display'),
    otpBoxes: [
      document.getElementById('otp-box-1'),
      document.getElementById('otp-box-2'),
      document.getElementById('otp-box-3'),
      document.getElementById('otp-box-4'),
      document.getElementById('otp-box-5'),
      document.getElementById('otp-box-6')
    ],
    demoOtpCode: document.getElementById('demo-otp-code'),
    btnAutoFillOtp: document.getElementById('btn-auto-fill-otp'),
    btnVerifyOtp: document.getElementById('btn-verify-otp'),

    // Profile Setup
    btnPickAvatar: document.getElementById('btn-pick-avatar'),
    fileAvatarInput: document.getElementById('file-avatar-input'),
    profileAvatarImg: document.getElementById('profile-avatar-img'),
    profileAvatarPlaceholder: document.getElementById('profile-avatar-placeholder'),
    inputProfileName: document.getElementById('input-profile-name'),
    inputBusinessCategory: document.getElementById('input-business-category'),
    inputProfileAbout: document.getElementById('input-profile-about'),
    btnSaveProfile: document.getElementById('btn-save-profile'),

    // Main Dashboard
    btnMainMenu: document.getElementById('btn-main-menu'),
    mainDropdownMenu: document.getElementById('main-dropdown-menu'),
    chatsList: document.getElementById('chats-list'),
    chatsEmptyState: document.getElementById('chats-empty-state'),
    badgeTotalUnread: document.getElementById('badge-total-unread'),
    fabNewChat: document.getElementById('fab-new-chat'),
    tabs: document.querySelectorAll('.whatsapp-tabs .tab-item'),
    tabPages: document.querySelectorAll('.tabs-body .tab-page'),

    // Chat Room
    btnChatBack: document.getElementById('btn-chat-back'),
    chatTargetAvatar: document.getElementById('chat-target-avatar'),
    chatTargetName: document.getElementById('chat-target-name'),
    chatTargetStatus: document.getElementById('chat-target-status'),
    chatMessagesContainer: document.getElementById('chat-messages-container'),
    messagesStream: document.getElementById('messages-stream'),
    inputMessageText: document.getElementById('input-message-text'),
    btnChatSend: document.getElementById('btn-chat-send'),
    iconMic: document.getElementById('icon-mic'),
    iconSend: document.getElementById('icon-send'),
    btnAttachmentToggle: document.getElementById('btn-attachment-toggle'),
    attachmentTray: document.getElementById('attachment-tray'),
    btnAttachGallery: document.getElementById('btn-attach-gallery'),
    btnAttachDoc: document.getElementById('btn-attach-document'),
    btnAttachAudio: document.getElementById('btn-attach-audio'),
    fileGalleryPicker: document.getElementById('file-gallery-picker'),
    fileDocPicker: document.getElementById('file-doc-picker'),
    fileAudioPicker: document.getElementById('file-audio-picker'),
    btnChatVoiceCall: document.getElementById('btn-chat-voice-call'),
    btnChatVideoCall: document.getElementById('btn-chat-video-call'),

    // Modals
    modalNewChat: document.getElementById('modal-new-chat'),
    btnCloseNewChat: document.getElementById('btn-close-new-chat'),
    inputDirectPhone: document.getElementById('input-direct-phone'),
    btnStartDirectChat: document.getElementById('btn-start-direct-chat'),
    modalContactsList: document.getElementById('modal-contacts-list'),

    modalSettings: document.getElementById('modal-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    settingsAvatarImg: document.getElementById('settings-avatar-img'),
    settingsNameDisplay: document.getElementById('settings-name-display'),
    settingsAboutDisplay: document.getElementById('settings-about-display'),

    modalLightbox: document.getElementById('modal-lightbox'),
    btnCloseLightbox: document.getElementById('btn-close-lightbox'),
    lightboxImg: document.getElementById('lightbox-img'),

    modalCallScreen: document.getElementById('modal-call-screen'),
    callAvatar: document.getElementById('call-avatar'),
    callName: document.getElementById('call-name'),
    callStatus: document.getElementById('call-status'),
    btnEndCall: document.getElementById('btn-end-call')
  };

  // Helper: Switch Screens
  function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  // Format timestamp (e.g. 10:45 AM or Yesterday)
  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Check URL parameters (e.g. ?user=B for instant dual testing)
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user');
    if (userParam === 'A' || userParam === 'a') {
      quickLogin('9876543210');
      return true;
    }
    if (userParam === 'B' || userParam === 'b') {
      quickLogin('9123456789');
      return true;
    }
    return false;
  }

  // =========================================================================
  // AUTHENTICATION FLOW
  // =========================================================================

  // Step 1: Welcome Screen -> Phone Input
  el.btnAgreeContinue.addEventListener('click', () => {
    showScreen(el.screenPhone);
    el.inputPhone.focus();
  });

  el.btnBackToWelcome.addEventListener('click', () => {
    showScreen(el.screenWelcome);
  });

  // Quick chips for demo numbers
  document.querySelectorAll('.quick-phone-chips .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      el.inputPhone.value = btn.dataset.phone;
      sendOtp();
    });
  });

  // Step 2: Request OTP
  async function sendOtp() {
    const phone = el.inputPhone.value.trim().replace(/\D/g, '');
    if (phone.length < 5) {
      alert('Please enter a valid phone number (minimum 5 digits)');
      return;
    }

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();

      if (data.success) {
        sessionStorage.setItem('rchat_temp_phone', phone);
        el.otpPhoneDisplay.textContent = '+91 ' + phone;
        el.demoOtpCode.textContent = data.debugOtp || '123456';
        showScreen(el.screenOtp);
        el.otpBoxes[0].focus();
      } else {
        alert(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  }
  el.btnSendOtp.addEventListener('click', sendOtp);

  // Auto-focus OTP boxes
  el.otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      if (box.value.length === 1 && idx < el.otpBoxes.length - 1) {
        el.otpBoxes[idx + 1].focus();
      }
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        el.otpBoxes[idx - 1].focus();
      }
    });
  });

  el.btnBackToPhone.addEventListener('click', () => {
    showScreen(el.screenPhone);
  });

  el.btnAutoFillOtp.addEventListener('click', () => {
    const code = el.demoOtpCode.textContent.trim() || '123456';
    for (let i = 0; i < 6; i++) {
      el.otpBoxes[i].value = code[i] || '';
    }
    verifyOtp();
  });

  const btnSkipOtp = document.getElementById('btn-skip-otp');
  if (btnSkipOtp) {
    btnSkipOtp.addEventListener('click', () => {
      const code = '123456';
      for (let i = 0; i < 6; i++) {
        el.otpBoxes[i].value = code[i] || '';
      }
      verifyOtp();
    });
  }

  const linkWrongNumber = document.getElementById('link-wrong-number');
  if (linkWrongNumber) {
    linkWrongNumber.addEventListener('click', (e) => {
      e.preventDefault();
      showScreen(el.screenPhone);
    });
  }

  // Step 3: Verify OTP
  async function verifyOtp() {
    const phone = sessionStorage.getItem('rchat_temp_phone');
    let otp = '';
    el.otpBoxes.forEach(b => otp += b.value.trim());

    if (otp.length < 6) {
      alert('Please enter complete 6-digit OTP');
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = await res.json();

      if (data.success) {
        state.currentUser = data.user;
        localStorage.setItem('rchat_user', JSON.stringify(data.user));
        updateTestBanner();

        if (data.isNewUser) {
          // Open profile creation screen
          el.inputProfileName.value = data.user.name || '';
          el.inputBusinessCategory.value = data.user.businessCategory || '';
          el.inputProfileAbout.value = data.user.about || '';
          showScreen(el.screenProfile);
        } else {
          // Profile exists, enter main chat dashboard
          initUserSession();
        }
      } else {
        alert(data.error || 'Verification failed');
      }
    } catch (err) {
      alert('Error verifying OTP: ' + err.message);
    }
  }
  el.btnVerifyOtp.addEventListener('click', verifyOtp);

  // Step 4: Save Profile
  el.btnSaveProfile.addEventListener('click', async () => {
    const name = el.inputProfileName.value.trim();
    if (!name) {
      alert('Please provide your name');
      return;
    }

    const payload = {
      phone: state.currentUser.phone,
      name: name,
      avatar: state.currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      about: el.inputProfileAbout.value.trim() || 'Hey there! I am using Rchat by Sumis.',
      businessCategory: el.inputBusinessCategory.value.trim() || 'General Business',
      isBusiness: !!el.inputBusinessCategory.value.trim()
    };

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        state.currentUser = data.user;
        localStorage.setItem('rchat_user', JSON.stringify(data.user));
        initUserSession();
      }
    } catch (err) {
      alert('Failed to save profile: ' + err.message);
    }
  });

  // Avatar upload
  el.btnPickAvatar.addEventListener('click', () => el.fileAvatarInput.click());
  el.fileAvatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target.result;
      const res = await uploadFile(base64, file.name, file.type);
      if (res && res.url) {
        state.currentUser.avatar = res.url;
        el.profileAvatarImg.src = res.url;
        el.profileAvatarImg.classList.remove('hidden');
        el.profileAvatarPlaceholder.classList.add('hidden');
      }
    };
    reader.readAsDataURL(file);
  });

  // Quick Login for testing
  async function quickLogin(phone) {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: data.debugOtp || '123456' })
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        state.currentUser = verifyData.user;
        localStorage.setItem('rchat_user', JSON.stringify(verifyData.user));
        initUserSession();
      }
    } catch (e) {
      console.error('Quick login error:', e);
    }
  }

  el.btnQuickUserA.addEventListener('click', () => quickLogin('9876543210'));
  el.btnQuickUserB.addEventListener('click', () => quickLogin('9123456789'));
  el.btnOpenNewWindow.addEventListener('click', () => {
    window.open(window.location.origin + '?user=B', '_blank', 'width=450,height=800');
  });

  function updateTestBanner() {
    if (state.currentUser) {
      el.currentUserBadge.textContent = `${state.currentUser.name || 'User'} (${state.currentUser.phone})`;
      el.currentUserBadge.style.color = '#00C49F';
    } else {
      el.currentUserBadge.textContent = 'Not logged in';
      el.currentUserBadge.style.color = '#E9EDEF';
    }
  }

  // =========================================================================
  // MAIN DASHBOARD & REAL-TIME SSE ENGINE
  // =========================================================================

  function initUserSession() {
    updateTestBanner();
    showScreen(el.screenMain);
    connectRealtimeEvents();
    loadContactsAndChats();

    // Update settings modal info
    el.settingsNameDisplay.textContent = state.currentUser.name;
    el.settingsAboutDisplay.textContent = state.currentUser.about;
    el.settingsAvatarImg.src = state.currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';
  }

  // Connect Server-Sent Events (SSE) for Real-Time Instant Messages
  function connectRealtimeEvents() {
    if (!state.currentUser) return;
    if (state.eventSource) state.eventSource.close();

    const sseUrl = `/api/events?phone=${encodeURIComponent(state.currentUser.phone)}`;
    state.eventSource = new EventSource(sseUrl);

    state.eventSource.addEventListener('connected', (e) => {
      console.log('⚡ [Rchat SSE] Connected successfully for', state.currentUser.phone);
    });

    // 1. New Message Received
    state.eventSource.addEventListener('new_message', (e) => {
      const msg = JSON.parse(e.data);
      console.log('📩 [Rchat SSE] New message received:', msg);

      // Play chime
      playSound('receive');

      // If chat is open with sender, append message live & mark read
      if (state.activeChat && state.activeChat.phone === msg.from) {
        appendMessageBubble(msg, false);
        scrollChatToBottom();
        markMessagesAsRead(msg.from);
      }

      // Refresh chat list preview
      loadContactsAndChats();
    });

    // 2. Delivery Update (Single tick -> Double grey ticks)
    state.eventSource.addEventListener('delivery_update', (e) => {
      const data = JSON.parse(e.data);
      const bubble = document.querySelector(`[data-msg-id="${data.messageId}"]`);
      if (bubble) {
        const tickSpan = bubble.querySelector('.bubble-tick');
        if (tickSpan) tickSpan.outerHTML = TICKS.delivered;
      }
    });

    // 3. Read Receipt (Double ticks turn Blue)
    state.eventSource.addEventListener('read_receipt', (e) => {
      const data = JSON.parse(e.data);
      if (state.activeChat && state.activeChat.phone === data.readerPhone) {
        document.querySelectorAll('.message-bubble.sent .bubble-tick').forEach(tick => {
          tick.outerHTML = TICKS.read;
        });
      }
      loadContactsAndChats();
    });

    // 4. Typing Indicator
    state.eventSource.addEventListener('typing_indicator', (e) => {
      const data = JSON.parse(e.data);
      if (state.activeChat && state.activeChat.phone === data.from) {
        if (data.isTyping) {
          el.chatTargetStatus.textContent = 'typing...';
          el.chatTargetStatus.style.color = '#00C49F';
        } else {
          el.chatTargetStatus.textContent = 'online';
          el.chatTargetStatus.style.color = 'rgba(255, 255, 255, 0.8)';
        }
      }
    });

    // 5. Incoming Call
    state.eventSource.addEventListener('incoming_call', (e) => {
      const call = JSON.parse(e.data);
      el.callName.textContent = call.callerName || call.from;
      el.callStatus.textContent = `Incoming ${call.type === 'video' ? 'Video' : 'Voice'} Call • Ringing...`;
      el.callAvatar.src = call.callerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';
      el.modalCallScreen.classList.remove('hidden');
    });

    state.eventSource.onerror = () => {
      console.warn('⚠️ [Rchat SSE] Connection error. Reconnecting...');
    };
  }

  // Load Contacts and Recent Chats
  async function loadContactsAndChats() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      state.contacts = data.users.filter(u => u.phone !== state.currentUser.phone);

      // Fetch latest messages for each contact to build chat list
      renderChatsList();
      renderModalContacts();
    } catch (err) {
      console.error('Error loading contacts:', err);
    }
  }

  async function renderChatsList(searchQuery = '') {
    el.chatsList.innerHTML = '';
    let totalUnread = 0;
    const filterTerm = searchQuery.toLowerCase().trim();

    for (const contact of state.contacts) {
      if (filterTerm) {
        const nameMatch = (contact.name || '').toLowerCase().includes(filterTerm);
        const phoneMatch = (contact.phone || '').includes(filterTerm);
        if (!nameMatch && !phoneMatch) continue;
      }
      try {
        const res = await fetch(`/api/messages?from=${state.currentUser.phone}&with=${contact.phone}`);
        const data = await res.json();
        const msgs = data.messages || [];

        if (msgs.length > 0 || filterTerm) {
          const lastMsg = msgs[msgs.length - 1] || { text: 'Tap to start conversation', timestamp: new Date().toISOString() };
          const unreadCount = msgs.filter(m => m.from === contact.phone && m.status !== 'read').length;
          totalUnread += unreadCount;

          const row = document.createElement('div');
          row.className = 'chat-row';
          row.onclick = () => openChatWith(contact);

          let previewText = lastMsg.text;
          if (lastMsg.type === 'image') previewText = '📷 Photo';
          if (lastMsg.type === 'audio') previewText = '🎵 Audio file';
          if (lastMsg.type === 'file') previewText = '📄 ' + (lastMsg.fileName || 'Document');

          let tickHtml = '';
          if (lastMsg.from === state.currentUser.phone) {
            tickHtml = TICKS[lastMsg.status] || TICKS.sent;
          }

          row.innerHTML = `
            <div class="chat-row-avatar-wrap">
              <img src="${contact.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}" class="chat-row-avatar" alt="${contact.name}">
              ${contact.isOnline ? '<span class="status-badge-dot"></span>' : ''}
            </div>
            <div class="chat-row-body">
              <div class="chat-row-top">
                <span class="chat-contact-name">${contact.name || contact.phone}</span>
                <span class="chat-timestamp">${formatTime(lastMsg.timestamp)}</span>
              </div>
              <div class="chat-row-bottom">
                <div class="chat-preview-wrap">
                  ${tickHtml}
                  <span class="chat-preview-text">${previewText}</span>
                </div>
                ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
              </div>
            </div>
          `;
          el.chatsList.appendChild(row);
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (totalUnread > 0) {
      el.badgeTotalUnread.textContent = totalUnread;
      el.badgeTotalUnread.classList.remove('hidden');
    } else {
      el.badgeTotalUnread.classList.add('hidden');
    }

    if (el.chatsList.children.length === 0) {
      el.chatsEmptyState.classList.remove('hidden');
    } else {
      el.chatsEmptyState.classList.add('hidden');
    }
  }

  // Hook search bar events
  const btnSearchChats = document.getElementById('btn-search-chats');
  const chatsSearchBar = document.getElementById('chats-search-bar');
  const inputSearchChats = document.getElementById('input-search-chats');
  const btnCloseSearch = document.getElementById('btn-close-search');

  if (btnSearchChats && chatsSearchBar) {
    btnSearchChats.addEventListener('click', () => {
      chatsSearchBar.classList.toggle('hidden');
      if (!chatsSearchBar.classList.contains('hidden')) {
        inputSearchChats.focus();
      } else {
        renderChatsList('');
      }
    });
  }

  if (inputSearchChats) {
    inputSearchChats.addEventListener('input', (e) => {
      renderChatsList(e.target.value);
    });
  }

  if (btnCloseSearch) {
    btnCloseSearch.addEventListener('click', () => {
      inputSearchChats.value = '';
      chatsSearchBar.classList.add('hidden');
      renderChatsList('');
    });
  }

  function renderModalContacts() {
    el.modalContactsList.innerHTML = '';
    state.contacts.forEach(contact => {
      const row = document.createElement('div');
      row.className = 'contact-picker-row';
      row.onclick = () => {
        el.modalNewChat.classList.add('hidden');
        openChatWith(contact);
      };
      row.innerHTML = `
        <img src="${contact.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}" class="contact-picker-avatar" alt="${contact.name}">
        <div class="contact-picker-info">
          <h4>${contact.name || contact.phone}</h4>
          <p>${contact.about || 'Available'}</p>
        </div>
      `;
      el.modalContactsList.appendChild(row);
    });
  }

  // =========================================================================
  // 1-ON-1 CHAT ROOM
  // =========================================================================

  async function openChatWith(contact) {
    state.activeChat = contact;
    el.chatTargetName.textContent = contact.name || contact.phone;
    el.chatTargetStatus.textContent = contact.isOnline ? 'online' : 'offline';
    el.chatTargetAvatar.src = contact.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';

    showScreen(el.screenChat);
    el.messagesStream.innerHTML = '';

    // Load message history
    try {
      const res = await fetch(`/api/messages?from=${state.currentUser.phone}&with=${contact.phone}`);
      const data = await res.json();
      state.messages = data.messages || [];

      state.messages.forEach(msg => {
        const isSent = msg.from === state.currentUser.phone;
        appendMessageBubble(msg, isSent);
      });
      scrollChatToBottom();

      // Mark unread messages as read
      markMessagesAsRead(contact.phone);
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  }

  async function markMessagesAsRead(senderPhone) {
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerPhone: state.currentUser.phone,
          senderPhone: senderPhone
        })
      });
      loadContactsAndChats();
    } catch (err) {
      console.error(err);
    }
  }

  function appendMessageBubble(msg, isSent) {
    const row = document.createElement('div');
    row.className = `message-bubble-row ${isSent ? 'sent' : 'received'}`;
    row.dataset.msgId = msg.id;

    let mediaContent = '';

    // Photo message
    if (msg.type === 'image' && msg.mediaUrl) {
      mediaContent = `
        <div class="bubble-image-wrap" onclick="window.viewMedia('${msg.mediaUrl}', 'Photo')">
          <img src="${msg.mediaUrl}" alt="Photo">
        </div>
      `;
    }

    // Audio / Music message
    if (msg.type === 'audio' && msg.mediaUrl) {
      mediaContent = `
        <div class="bubble-audio-player">
          <button class="btn-audio-play" onclick="window.toggleAudio(this, '${msg.mediaUrl}')">▶</button>
          <div class="audio-track-info">
            <div class="waveform-bar-mock"><div class="waveform-progress"></div></div>
            <div class="audio-time-label">${msg.fileName || 'Audio Message'}</div>
          </div>
        </div>
      `;
    }

    // Document / File message
    if (msg.type === 'file' && msg.mediaUrl) {
      mediaContent = `
        <div class="bubble-doc-wrap">
          <div class="doc-icon">📄</div>
          <div class="doc-details">
            <div class="doc-name">${msg.fileName || 'Document'}</div>
            <div class="doc-meta">${msg.fileSize || 'File'} • <a href="${msg.mediaUrl}" download="${msg.fileName || 'file'}" style="color:var(--primary); font-weight:600;">Download</a></div>
          </div>
        </div>
      `;
    }

    let tickHtml = '';
    if (isSent) {
      tickHtml = TICKS[msg.status] || TICKS.sent;
    }

    row.innerHTML = `
      <div class="message-bubble ${isSent ? 'sent' : 'received'}">
        ${mediaContent}
        ${msg.text ? `<div class="message-content">${escapeHtml(msg.text)}</div>` : ''}
        <div class="bubble-meta">
          <span class="bubble-time">${formatTime(msg.timestamp)}</span>
          ${tickHtml}
        </div>
      </div>
    `;

    el.messagesStream.appendChild(row);
  }

  function scrollChatToBottom() {
    el.chatMessagesContainer.scrollTop = el.chatMessagesContainer.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Back to Main Screen
  el.btnChatBack.addEventListener('click', () => {
    state.activeChat = null;
    showScreen(el.screenMain);
    loadContactsAndChats();
  });

  // Dynamic Send Button & Typing Trigger
  let typingTimeout;
  el.inputMessageText.addEventListener('input', () => {
    const hasText = el.inputMessageText.value.trim().length > 0;
    if (hasText) {
      el.iconMic.classList.add('hidden');
      el.iconSend.classList.remove('hidden');
    } else {
      el.iconMic.classList.remove('hidden');
      el.iconSend.classList.add('hidden');
    }

    // Send typing notification
    if (state.activeChat) {
      clearTimeout(typingTimeout);
      fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: state.currentUser.phone, to: state.activeChat.phone, isTyping: true })
      });
      typingTimeout = setTimeout(() => {
        fetch('/api/typing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: state.currentUser.phone, to: state.activeChat.phone, isTyping: false })
        });
      }, 2000);
    }
  });

  // Send Text Message
  async function sendMessage() {
    const text = el.inputMessageText.value.trim();
    if (!text || !state.activeChat) return;

    el.inputMessageText.value = '';
    el.iconMic.classList.remove('hidden');
    el.iconSend.classList.add('hidden');

    const payload = {
      from: state.currentUser.phone,
      to: state.activeChat.phone,
      type: 'text',
      text: text
    };

    playSound('send');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        appendMessageBubble(data.message, true);
        scrollChatToBottom();
      }
    } catch (err) {
      alert('Failed to send message: ' + err.message);
    }
  }

  // Real Voice Note Recording using MediaRecorder API
  let isRecordingVoice = false;
  let voiceMediaRecorder = null;
  let voiceAudioChunks = [];
  let recordStartTime = 0;

  async function handleVoiceRecording() {
    if (!state.activeChat) return;

    if (!isRecordingVoice) {
      // Start recording
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Media devices not supported');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        voiceAudioChunks = [];
        voiceMediaRecorder = new MediaRecorder(stream);

        voiceMediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) voiceAudioChunks.push(e.data);
        };

        voiceMediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const durationSec = Math.max(1, Math.round((Date.now() - recordStartTime) / 1000));
          const audioBlob = new Blob(voiceAudioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = async () => {
            const base64Audio = reader.result;
            const fileName = `Voice note (${durationSec}s).webm`;
            const uploadRes = await uploadFile(base64Audio, fileName, 'audio/webm');
            if (uploadRes && uploadRes.url) {
              sendMediaMessage('audio', uploadRes.url, fileName, uploadRes.size);
            }
          };
          reader.readAsDataURL(audioBlob);
        };

        voiceMediaRecorder.start();
        recordStartTime = Date.now();
        isRecordingVoice = true;

        el.btnChatSend.style.backgroundColor = '#E53935';
        el.btnChatSend.style.transform = 'scale(1.15)';
        el.inputMessageText.placeholder = '🎙️ Recording voice... (Tap mic to send)';
      } catch (err) {
        console.warn('Microphone error or permission denied:', err);
        // Fallback to quick simulated voice note
        simulateVoiceNote();
      }
    } else {
      // Stop recording and send
      if (voiceMediaRecorder && voiceMediaRecorder.state !== 'inactive') {
        voiceMediaRecorder.stop();
      }
      isRecordingVoice = false;
      el.btnChatSend.style.backgroundColor = 'var(--primary)';
      el.btnChatSend.style.transform = 'scale(1)';
      el.inputMessageText.placeholder = 'Message';
    }
  }

  el.btnChatSend.addEventListener('click', () => {
    if (!el.iconSend.classList.contains('hidden')) {
      sendMessage();
    } else {
      handleVoiceRecording();
    }
  });

  // Fallback Voice Note
  async function simulateVoiceNote() {
    if (!state.activeChat) return;
    const payload = {
      from: state.currentUser.phone,
      to: state.activeChat.phone,
      type: 'audio',
      text: '',
      mediaUrl: 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAAAAAP///////////////////wAA',
      fileName: 'Voice note (0:04)',
      duration: '0:04'
    };

    playSound('send');
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      appendMessageBubble(data.message, true);
      scrollChatToBottom();
    }
  }
    const data = await res.json();
    if (data.success) {
      appendMessageBubble(data.message, true);
      scrollChatToBottom();
    }
  }

  // =========================================================================
  // ATTACHMENTS & MEDIA SHARING (PHOTOS, AUDIO, DOCUMENTS)
  // =========================================================================

  el.btnAttachmentToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    el.attachmentTray.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!el.attachmentTray.contains(e.target) && e.target !== el.btnAttachmentToggle) {
      el.attachmentTray.classList.add('hidden');
    }
    if (!el.mainDropdownMenu.contains(e.target) && e.target !== el.btnMainMenu) {
      el.mainDropdownMenu.classList.add('hidden');
    }
  });

  // Trigger pickers
  el.btnAttachGallery.addEventListener('click', () => {
    el.attachmentTray.classList.add('hidden');
    el.fileGalleryPicker.click();
  });

  document.getElementById('btn-attach-camera').addEventListener('click', () => {
    el.attachmentTray.classList.add('hidden');
    el.fileGalleryPicker.click();
  });

  document.getElementById('btn-quick-camera').addEventListener('click', () => {
    el.fileGalleryPicker.click();
  });

  el.btnAttachDoc.addEventListener('click', () => {
    el.attachmentTray.classList.add('hidden');
    el.fileDocPicker.click();
  });

  el.btnAttachAudio.addEventListener('click', () => {
    el.attachmentTray.classList.add('hidden');
    el.fileAudioPicker.click();
  });

  // Handle Photo Picker
  el.fileGalleryPicker.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !state.activeChat) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const uploadRes = await uploadFile(evt.target.result, file.name, file.type);
      if (uploadRes && uploadRes.url) {
        sendMediaMessage('image', uploadRes.url, file.name, uploadRes.size);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  // Handle Document Picker
  el.fileDocPicker.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !state.activeChat) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const uploadRes = await uploadFile(evt.target.result, file.name, file.type);
      if (uploadRes && uploadRes.url) {
        sendMediaMessage('file', uploadRes.url, file.name, uploadRes.size);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  // Handle Audio / Music Picker
  el.fileAudioPicker.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !state.activeChat) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const uploadRes = await uploadFile(evt.target.result, file.name, file.type);
      if (uploadRes && uploadRes.url) {
        sendMediaMessage('audio', uploadRes.url, file.name, uploadRes.size);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  async function uploadFile(base64Data, fileName, fileType) {
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, fileName, fileType })
      });
      return await res.json();
    } catch (err) {
      alert('Upload failed: ' + err.message);
      return null;
    }
  }

  async function sendMediaMessage(type, mediaUrl, fileName, fileSize) {
    const payload = {
      from: state.currentUser.phone,
      to: state.activeChat.phone,
      type: type,
      text: '',
      mediaUrl: mediaUrl,
      fileName: fileName,
      fileSize: fileSize
    };

    playSound('send');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        appendMessageBubble(data.message, true);
        scrollChatToBottom();
      }
    } catch (err) {
      alert('Failed to send media: ' + err.message);
    }
  }

  // Global Audio Playback toggle
  window.toggleAudio = function (btn, url) {
    if (!window.currentAudio) {
      window.currentAudio = new Audio(url);
      window.currentAudioBtn = btn;
      window.currentAudio.play();
      btn.textContent = '⏸';
      window.currentAudio.onended = () => {
        btn.textContent = '▶';
        window.currentAudio = null;
      };
    } else {
      window.currentAudio.pause();
      window.currentAudioBtn.textContent = '▶';
      window.currentAudio = null;
    }
  };

  // Global Media Lightbox
  window.viewMedia = function (url, title) {
    el.lightboxImg.src = url;
    document.getElementById('lightbox-title').textContent = title || 'Media';
    document.getElementById('lightbox-download').href = url;
    el.modalLightbox.classList.remove('hidden');
  };

  el.btnCloseLightbox.addEventListener('click', () => {
    el.modalLightbox.classList.add('hidden');
  });

  // =========================================================================
  // CALLS & WEBRTC SIGNALING
  // =========================================================================

  function initiateCall(type) {
    if (!state.activeChat) return;
    el.callName.textContent = state.activeChat.name || state.activeChat.phone;
    el.callStatus.textContent = `Rchat ${type === 'video' ? 'Video' : 'Voice'} Call • Calling...`;
    el.callAvatar.src = state.activeChat.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80';
    el.modalCallScreen.classList.remove('hidden');

    fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: state.currentUser.phone,
        to: state.activeChat.phone,
        callerName: state.currentUser.name,
        callerAvatar: state.currentUser.avatar,
        type: type,
        direction: 'outgoing'
      })
    });
  }

  el.btnChatVoiceCall.addEventListener('click', () => initiateCall('voice'));
  el.btnChatVideoCall.addEventListener('click', () => initiateCall('video'));
  el.btnEndCall.addEventListener('click', () => {
    el.modalCallScreen.classList.add('hidden');
  });

  // =========================================================================
  // TABS & NAVIGATION
  // =========================================================================

  el.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      el.tabs.forEach(t => t.classList.remove('active'));
      el.tabPages.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.dataset.tab;
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Filter Pills (All / Unread / Business / Groups)
  document.querySelectorAll('.filter-pills-bar .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pills-bar .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  // Menu Dropdown
  el.btnMainMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    el.mainDropdownMenu.classList.toggle('hidden');
  });

  document.getElementById('menu-new-chat').addEventListener('click', () => {
    el.mainDropdownMenu.classList.add('hidden');
    el.modalNewChat.classList.remove('hidden');
  });

  document.getElementById('menu-business-hub').addEventListener('click', () => {
    el.mainDropdownMenu.classList.add('hidden');
    document.querySelector('.tab-community').click();
  });

  document.getElementById('menu-settings').addEventListener('click', () => {
    el.mainDropdownMenu.classList.add('hidden');
    el.modalSettings.classList.remove('hidden');
  });

  document.getElementById('menu-switch-user').addEventListener('click', () => {
    el.mainDropdownMenu.classList.add('hidden');
    localStorage.removeItem('rchat_user');
    location.reload();
  });

  document.getElementById('menu-logout').addEventListener('click', () => {
    localStorage.removeItem('rchat_user');
    location.reload();
  });

  // FAB New Chat
  el.fabNewChat.addEventListener('click', () => {
    el.modalNewChat.classList.remove('hidden');
  });

  el.btnCloseNewChat.addEventListener('click', () => {
    el.modalNewChat.classList.add('hidden');
  });

  // Start Direct Chat with any Phone Number
  el.btnStartDirectChat.addEventListener('click', async () => {
    const targetPhone = el.inputDirectPhone.value.trim().replace(/\D/g, '');
    if (targetPhone.length < 5) {
      alert('Please enter a valid 10-digit number');
      return;
    }
    if (targetPhone === state.currentUser.phone) {
      alert('Cannot chat with your own phone number');
      return;
    }

    el.modalNewChat.classList.add('hidden');
    const existing = state.contacts.find(c => c.phone === targetPhone);
    const contactObj = existing || {
      phone: targetPhone,
      name: `User (+91 ${targetPhone})`,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      about: 'Using Rchat by Sumis',
      isOnline: false
    };
    openChatWith(contactObj);
  });

  // Settings Modal Controls
  el.btnCloseSettings.addEventListener('click', () => {
    el.modalSettings.classList.add('hidden');
  });

  // Theme Picker Dots
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      const themeClass = dot.dataset.theme;
      document.body.className = themeClass;
      localStorage.setItem('rchat_theme', themeClass);
    });
  });

  // Restore saved theme
  const savedTheme = localStorage.getItem('rchat_theme');
  if (savedTheme) {
    document.body.className = savedTheme;
    const activeDot = document.querySelector(`.theme-dot[data-theme="${savedTheme}"]`);
    if (activeDot) {
      document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
      activeDot.classList.add('active');
    }
  }

  // Sound toggle
  document.getElementById('chk-sound').addEventListener('change', (e) => {
    state.soundEnabled = e.target.checked;
  });

  // Auto-init if user already in localStorage (and no URL override)
  if (!checkUrlParams()) {
    const saved = localStorage.getItem('rchat_user');
    if (saved) {
      try {
        state.currentUser = JSON.parse(saved);
        initUserSession();
      } catch (e) {
        showScreen(el.screenWelcome);
      }
    } else {
      showScreen(el.screenWelcome);
    }
  }

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

})();
