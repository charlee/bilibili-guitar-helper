// ==UserScript==
// @name         Bilibili & YouTube Guitar Helper
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Loop specified segment, change playback speed, and count down before play on Bilibili and YouTube.
// @author       Charlee Li
// @match        *://*.bilibili.com/video/*
// @match        *://*.bilibili.com/bangumi/play/*
// @match        *://*.youtube.com/watch*
// @updateURL    https://github.com/charlee/bilibili-guitar-helper/raw/refs/heads/master/src/index.user.js
// @downloadURL  https://github.com/charlee/bilibili-guitar-helper/raw/refs/heads/master/src/index.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Configuration and State
    const state = {
        video: null,
        loopActive: false,
        startTime: null,
        endTime: null,
        playbackSpeed: 1.0,
        countdownSeconds: 3,
        countdownEnabled: false,
        isCountingDown: false,
        soundEnabled: true,
        isInternalPlay: false,
        isMinimized: localStorage.getItem('gh-minimized') === 'true',
        right: localStorage.getItem('gh-right'),
        top: localStorage.getItem('gh-top')
    };

    /**
     * Core Features Implementation
     */
    const Features = {
        toggleMinimize: function () {
            state.isMinimized = !state.isMinimized;
            localStorage.setItem('gh-minimized', state.isMinimized);
            const container = document.getElementById('guitar-helper-ui');
            const content = document.getElementById('gh-ui-content');
            const toggleBtn = document.getElementById('gh-minimize-btn');
            const titleText = document.getElementById('gh-title-text');
            const header = document.getElementById('gh-header');
            
            if (state.isMinimized) {
                content.style.display = 'none';
                if (titleText) titleText.style.display = 'none';
                if (header) {
                    header.style.marginBottom = '0';
                    header.style.borderBottom = 'none';
                    header.style.paddingBottom = '0';
                }
                toggleBtn.innerText = '+';
                container.style.width = 'auto';
                container.style.opacity = '0.1';
                container.style.backdropFilter = 'none';
            } else {
                content.style.display = 'flex';
                if (titleText) titleText.style.display = 'inline';
                if (header) {
                    header.style.marginBottom = '5px';
                    header.style.borderBottom = '1px solid rgba(255,255,255,0.3)';
                    header.style.paddingBottom = '5px';
                }
                toggleBtn.innerText = '−';
                container.style.width = '240px';
                container.style.opacity = '1';
                container.style.backdropFilter = 'blur(4px)';
            }
        },

        playTick: function (isFinal = false) {
            if (!state.soundEnabled) return;
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(isFinal ? 880 : 440, audioCtx.currentTime); // A5 or A4

                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.1);
            } catch (e) {
                console.error('Failed to play countdown sound:', e);
            }
        },

        formatTime: function (seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return h > 0 ?
                `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` :
                `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        },

        // 1. Loop specified segment
        handleLoop: function () {
            if (state.loopActive && state.video) {
                if (state.video.currentTime >= state.endTime) {
                    state.video.currentTime = state.startTime;
                    // Trigger countdown on loop if enabled
                    if (state.countdownEnabled) {
                        Features.startCountdown(true);
                    }
                }
            }
        },

        // 2. Change playback speed
        setPlaybackSpeed: function (speed) {
            if (state.video) {
                const newSpeed = Math.min(1.0, Math.max(0.5, parseFloat(speed.toFixed(1))));
                state.video.playbackRate = newSpeed;
                state.playbackSpeed = newSpeed;
                const display = document.getElementById('gh-speed-display');
                if (display) display.innerText = newSpeed.toFixed(1) + 'x';
            }
        },

        // 3. Count down before play
        startCountdown: function (fromLoop = false) {
            if (state.isCountingDown || !state.video) return;

            state.isCountingDown = true;
            state.video.pause();

            // Seek to start point only if looping is active and we're starting a new play session
            if (!fromLoop && state.loopActive) {
                state.video.currentTime = state.startTime || 0;
            }

            // Create countdown overlay
            const overlay = document.createElement('div');
            overlay.id = 'gh-countdown-overlay';
            Object.assign(overlay.style, {
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '200px',
                height: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(10px)',
                borderRadius: '40px',
                fontSize: '140px',
                fontWeight: 'bold',
                color: 'white',
                zIndex: '1000000',
                pointerEvents: 'none',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                border: '1px solid rgba(255, 255, 255, 0.2)'
            });

            const playerArea = document.querySelector('.bpx-player-video-area') ||
                document.querySelector('.bpx-player-container') ||
                document.querySelector('#bilibili-player') ||
                document.querySelector('#movie_player') ||
                document.querySelector('.html5-video-player');
            if (playerArea) playerArea.appendChild(overlay);

            let remaining = state.countdownSeconds;
            overlay.innerText = remaining;
            Features.playTick();

            const interval = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(interval);
                    state.isCountingDown = false;
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    Features.playTick(true);
                    
                    state.isInternalPlay = true;
                    state.video.play();
                } else {
                    overlay.innerText = remaining;
                    Features.playTick();
                }
            }, 1000);
        }
    };

    /**
     * UI Implementation
     */
    function injectUI() {
        if (document.getElementById('guitar-helper-ui')) return;

        const container = document.createElement('div');
        container.id = 'guitar-helper-ui';
        
        // Initial positioning (using right-anchor for better minimize behavior)
        const initialPos = state.right && state.top ? 
            { right: state.right, top: state.top, left: 'auto' } : 
            { top: '20px', right: '20px' };

        Object.assign(container.style, {
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            padding: '10px',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: state.isMinimized ? 'none' : 'blur(4px)',
            color: 'white',
            fontSize: '12px',
            borderRadius: '8px',
            zIndex: '999999',
            pointerEvents: 'auto',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            width: state.isMinimized ? 'auto' : '240px',
            opacity: state.isMinimized ? '0.1' : '1',
            transition: 'opacity 0.3s ease, backdropFilter 0.3s ease, width 0.3s ease',
            userSelect: 'none'
        });
        
        // Apply individual position properties
        for (const [key, value] of Object.entries(initialPos)) {
            container.style[key] = value;
        }

        // --- Header Section ---
        const header = document.createElement('div');
        header.id = 'gh-header';
        Object.assign(header.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: state.isMinimized ? '0' : '5px',
            borderBottom: state.isMinimized ? 'none' : '1px solid rgba(255,255,255,0.3)',
            paddingBottom: state.isMinimized ? '0' : '5px',
            gap: '10px',
            cursor: 'move'
        });

        const titleSpan = document.createElement('span');
        titleSpan.style.fontWeight = 'bold';
        titleSpan.style.whiteSpace = 'nowrap';
        titleSpan.style.pointerEvents = 'none';
        titleSpan.textContent = '🎸 ';

        const titleText = document.createElement('span');
        titleText.id = 'gh-title-text';
        titleText.style.display = state.isMinimized ? 'none' : 'inline';
        titleText.textContent = 'Guitar Helper';
        titleSpan.appendChild(titleText);

        const minimizeBtn = document.createElement('button');
        minimizeBtn.id = 'gh-minimize-btn';
        minimizeBtn.textContent = state.isMinimized ? '+' : '−';
        Object.assign(minimizeBtn.style, {
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: '1',
            padding: '0 5px',
            pointerEvents: 'auto'
        });

        header.appendChild(titleSpan);
        header.appendChild(minimizeBtn);
        container.appendChild(header);

        // --- Content Section ---
        const content = document.createElement('div');
        content.id = 'gh-ui-content';
        Object.assign(content.style, {
            display: state.isMinimized ? 'none' : 'flex',
            flexDirection: 'column',
            gap: '10px'
        });

        // Loop Row
        const loopRow = document.createElement('div');
        Object.assign(loopRow.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' });
        
        const loopLabel = document.createElement('span');
        const loopU = document.createElement('u');
        loopU.textContent = 'L';
        loopLabel.appendChild(loopU);
        loopLabel.appendChild(document.createTextNode('oop:'));
        
        const loopControls = document.createElement('div');
        Object.assign(loopControls.style, { display: 'flex', alignItems: 'center', gap: '4px' });

        const createBtn = (id, text, title, bg = '#444') => {
            const b = document.createElement('button');
            b.id = id;
            b.textContent = text;
            b.title = title;
            Object.assign(b.style, { padding: '2px 6px', cursor: 'pointer', background: bg, border: 'none', borderRadius: '4px', color: 'white' });
            return b;
        };

        const createDisplay = (id) => {
            const s = document.createElement('span');
            s.id = id;
            s.textContent = '--:--';
            Object.assign(s.style, { minWidth: '35px', textAlign: 'center', opacity: '0.8', fontFamily: 'monospace' });
            return s;
        };

        const btnStart = createBtn('gh-loop-start', '[', 'Set Loop Start');
        const displayStart = createDisplay('gh-start-display');
        const btnEnd = createBtn('gh-loop-end', ']', 'Set Loop End');
        const displayEnd = createDisplay('gh-end-display');
        const btnToggle = createBtn('gh-loop-btn', 'Off', 'Toggle Loop', '#00a1d6');
        btnToggle.style.padding = '2px 8px';

        loopControls.appendChild(btnStart);
        loopControls.appendChild(displayStart);
        loopControls.appendChild(btnEnd);
        loopControls.appendChild(displayEnd);
        loopControls.appendChild(btnToggle);
        loopRow.appendChild(loopLabel);
        loopRow.appendChild(loopControls);
        content.appendChild(loopRow);

        // Speed Row
        const speedRow = document.createElement('div');
        Object.assign(speedRow.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' });
        const speedLabel = document.createElement('span');
        speedLabel.textContent = 'Speed:';
        speedRow.appendChild(speedLabel);
        
        const speedControls = document.createElement('div');
        Object.assign(speedControls.style, { display: 'flex', alignItems: 'center', gap: '4px' });
        
        const btnSpeedDown = createBtn('gh-speed-down', '-', 'Speed Down');
        btnSpeedDown.style.padding = '2px 8px';
        const displaySpeed = createDisplay('gh-speed-display');
        displaySpeed.textContent = '1.0x';
        const btnSpeedUp = createBtn('gh-speed-up', '+', 'Speed Up');
        btnSpeedUp.style.padding = '2px 8px';

        speedControls.appendChild(btnSpeedDown);
        speedControls.appendChild(displaySpeed);
        speedControls.appendChild(btnSpeedUp);
        speedRow.appendChild(speedControls);
        content.appendChild(speedRow);

        // Countdown Row
        const countdownRow = document.createElement('div');
        Object.assign(countdownRow.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' });
        const cdLabel = document.createElement('span');
        const cdU = document.createElement('u');
        cdU.textContent = 'C';
        cdLabel.appendChild(cdU);
        cdLabel.appendChild(document.createTextNode('ountdown:'));
        
        const cdControls = document.createElement('div');
        Object.assign(cdControls.style, { display: 'flex', alignItems: 'center', gap: '4px' });

        const btnSound = createBtn('gh-sound-toggle', '🔊', 'Toggle Sound', '#50c878');
        btnSound.style.width = '28px';
        const btnCdToggle = createBtn('gh-countdown-btn', 'Off', 'Toggle Countdown', '#00a1d6');
        btnCdToggle.style.padding = '2px 8px';

        cdControls.appendChild(btnSound);
        cdControls.appendChild(btnCdToggle);
        countdownRow.appendChild(cdLabel);
        countdownRow.appendChild(cdControls);
        content.appendChild(countdownRow);

        container.appendChild(content);

        // Append to the video area to ensure visibility in fullscreen
        const playerArea = document.querySelector('.bpx-player-video-area') ||
            document.querySelector('.bpx-player-container') ||
            document.querySelector('#bilibili-player') ||
            document.querySelector('#movie_player') ||
            document.querySelector('.html5-video-player');

        if (playerArea) {
            playerArea.appendChild(container);
        }

        // --- Basic Event Listeners ---
        let isDragging = false;
        let startX, startY, initialRight, initialTop;

        header.onmousedown = (e) => {
            if (e.target.id === 'gh-minimize-btn' || state.isMinimized) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = container.getBoundingClientRect();
            const parentRect = container.parentElement.getBoundingClientRect();
            initialRight = parentRect.right - rect.right;
            initialTop = rect.top - parentRect.top;
            
            container.style.transition = 'none'; // Disable transition while dragging
            
            document.onmousemove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                container.style.right = `${initialRight - dx}px`;
                container.style.top = `${initialTop + dy}px`;
                container.style.left = 'auto'; 
            };
            
            document.onmouseup = () => {
                isDragging = false;
                document.onmousemove = null;
                document.onmouseup = null;
                container.style.transition = 'opacity 0.3s ease, backdrop-filter 0.3s ease, width 0.3s ease';
                
                // Save final position
                localStorage.setItem('gh-right', container.style.right);
                localStorage.setItem('gh-top', container.style.top);
            };
        };

        container.onmouseenter = () => {
            if (state.isMinimized) {
                container.style.opacity = '1';
                container.style.backdropFilter = 'blur(4px)';
            }
        };

        container.onmouseleave = () => {
            if (state.isMinimized) {
                container.style.opacity = '0.1';
                container.style.backdropFilter = 'none';
            }
        };

        document.getElementById('gh-minimize-btn').onclick = () => {
            Features.toggleMinimize();
        };

        document.getElementById('gh-loop-start').onclick = () => {
            if (state.video) {
                state.startTime = state.video.currentTime;
                const btn = document.getElementById('gh-loop-start');
                const display = document.getElementById('gh-start-display');
                btn.style.background = '#50c878'; // Emerald green
                display.innerText = Features.formatTime(state.startTime);
            }
        };

        document.getElementById('gh-loop-end').onclick = () => {
            if (state.video) {
                state.endTime = state.video.currentTime;
                const btn = document.getElementById('gh-loop-end');
                const display = document.getElementById('gh-end-display');
                btn.style.background = '#50c878'; // Emerald green
                display.innerText = Features.formatTime(state.endTime);
            }
        };

        document.getElementById('gh-loop-btn').onclick = () => {
            if (state.startTime === null || state.endTime === null) {
                console.log('Bilibili Guitar Helper: Set loop start [ and end ] points first.');
                return;
            }
            if (state.endTime <= state.startTime) {
                console.log('Bilibili Guitar Helper: Loop end must be greater than start.');
                return;
            }

            state.loopActive = !state.loopActive;
            const btn = document.getElementById('gh-loop-btn');
            btn.innerText = state.loopActive ? 'On' : 'Off';
            btn.style.background = state.loopActive ? '#fb7299' : '#00a1d6';
        };

        document.getElementById('gh-countdown-btn').onclick = () => {
            state.countdownEnabled = !state.countdownEnabled;
            const btn = document.getElementById('gh-countdown-btn');
            btn.innerText = state.countdownEnabled ? 'On' : 'Off';
            btn.style.background = state.countdownEnabled ? '#fb7299' : '#00a1d6';
        };

        document.getElementById('gh-sound-toggle').onclick = () => {
            state.soundEnabled = !state.soundEnabled;
            const btn = document.getElementById('gh-sound-toggle');
            btn.innerText = state.soundEnabled ? '🔊' : '🔇';
            btn.style.background = state.soundEnabled ? '#50c878' : '#444';
        };

        document.getElementById('gh-speed-down').onclick = () => {
            Features.setPlaybackSpeed(state.playbackSpeed - 0.1);
        };

        document.getElementById('gh-speed-up').onclick = () => {
            Features.setPlaybackSpeed(state.playbackSpeed + 0.1);
        };
    }

    /**
     * Initialization Logic
     */
    function init() {
        state.video = document.querySelector('video');

        if (state.video) {
            console.log('Bilibili Guitar Helper: Video element found.');
            injectUI();

            // Monitor video time for looping
            state.video.addEventListener('timeupdate', Features.handleLoop);

            // Trigger countdown on manual play if enabled
            state.video.addEventListener('play', () => {
                if (state.countdownEnabled && !state.isCountingDown) {
                    if (state.isInternalPlay) {
                        state.isInternalPlay = false;
                        return;
                    }
                    Features.startCountdown();
                }
            });

            // Add Keyboard Shortcuts (using capture phase to override Bilibili defaults)
            window.addEventListener('keydown', (e) => {
                // Ignore if user is typing in an input field
                if (['INPUT', 'TEXTAREA', 'IFRAME'].includes(document.activeElement.tagName) || 
                    document.activeElement.isContentEditable) return;

                const handledKeys = ['[', ']', 'l', 'L', 'c', 'C', '-', '=', '+'];
                if (handledKeys.includes(e.key)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }

                switch (e.key) {
                    case '[':
                        document.getElementById('gh-loop-start').click();
                        break;
                    case ']':
                        document.getElementById('gh-loop-end').click();
                        break;
                    case 'l':
                    case 'L':
                        document.getElementById('gh-loop-btn').click();
                        break;
                    case 'c':
                    case 'C':
                        document.getElementById('gh-countdown-btn').click();
                        break;
                    case '-':
                        document.getElementById('gh-speed-down').click();
                        break;
                    case '=':
                    case '+':
                        document.getElementById('gh-speed-up').click();
                        break;
                }
            }, true); // 'true' enables the capture phase
        } else {
            // Retry if video isn't ready yet (common in SPAs)
            setTimeout(init, 1000);
        }
    }

    // Start checking for player
    init();

})();
