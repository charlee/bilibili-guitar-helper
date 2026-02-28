// ==UserScript==
// @name         Bilibili Guitar Helper
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  Loop specified segment, change playback speed, and count down before play on Bilibili.
// @author       Charlee Li
// @match        *://*.bilibili.com/video/*
// @match        *://*.bilibili.com/bangumi/play/*
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
        isMinimized: localStorage.getItem('gh-minimized') === 'true'
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
            
            if (state.isMinimized) {
                content.style.display = 'none';
                if (titleText) titleText.style.display = 'none';
                toggleBtn.innerText = '+';
                container.style.width = 'auto';
                container.style.opacity = '0.1';
                container.style.backdropFilter = 'none';
            } else {
                content.style.display = 'flex';
                if (titleText) titleText.style.display = 'inline';
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
            overlay.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 200px;
                height: 200px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(10px);
                border-radius: 40px;
                font-size: 140px;
                font-weight: bold;
                color: white;
                z-index: 1000000;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                border: 1px solid rgba(255, 255, 255, 0.2);
            `;

            const playerArea = document.querySelector('.bpx-player-video-area') ||
                document.querySelector('.bpx-player-container') ||
                document.querySelector('#bilibili-player');
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
        container.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: ${state.isMinimized ? 'none' : 'blur(4px)'};
            color: white;
            font-size: 12px;
            border-radius: 8px;
            z-index: 999999;
            pointer-events: auto;
            border: 1px solid rgba(255, 255, 255, 0.2);
            width: ${state.isMinimized ? 'auto' : '240px'};
            opacity: ${state.isMinimized ? '0.1' : '1'};
            transition: opacity 0.3s ease, backdrop-filter 0.3s ease, width 0.3s ease;
            user-select: none;
        `;

        container.innerHTML = `
            <div id="gh-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${state.isMinimized ? '0' : '5px'}; border-bottom: ${state.isMinimized ? 'none' : '1px solid rgba(255,255,255,0.3)'}; padding-bottom: ${state.isMinimized ? '0' : '5px'}; gap: 10px; cursor: move;">
                <span style="font-weight: bold; white-space: nowrap; pointer-events: none;">🎸 <span id="gh-title-text" style="display: ${state.isMinimized ? 'none' : 'inline'};">Guitar Helper</span></span>
                <button id="gh-minimize-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 5px; pointer-events: auto;">${state.isMinimized ? '+' : '−'}</button>
            </div>
            <div id="gh-ui-content" style="display: ${state.isMinimized ? 'none' : 'flex'}; flex-direction: column; gap: 10px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <span><u>L</u>oop:</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button id="gh-loop-start" title="Set Loop Start" style="padding: 2px 6px; cursor: pointer; background: #444; border: none; border-radius: 4px; color: white;">[</button>
                        <span id="gh-start-display" style="min-width: 35px; text-align: center; opacity: 0.8; font-family: monospace;">--:--</span>
                        <button id="gh-loop-end" title="Set Loop End" style="padding: 2px 6px; cursor: pointer; background: #444; border: none; border-radius: 4px; color: white;">]</button>
                        <span id="gh-end-display" style="min-width: 35px; text-align: center; opacity: 0.8; font-family: monospace;">--:--</span>
                        <button id="gh-loop-btn" style="padding: 2px 8px; cursor: pointer; background: #00a1d6; border: none; border-radius: 4px; color: white;">Off</button>
                    </div>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <span>Speed:</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button id="gh-speed-down" title="Speed Down" style="padding: 2px 8px; cursor: pointer; background: #444; border: none; border-radius: 4px; color: white;">-</button>
                        <span id="gh-speed-display" style="min-width: 35px; text-align: center; opacity: 0.8; font-family: monospace;">1.0x</span>
                        <button id="gh-speed-up" title="Speed Up" style="padding: 2px 8px; cursor: pointer; background: #444; border: none; border-radius: 4px; color: white;">+</button>
                    </div>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                    <span><u>C</u>ountdown:</span>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <button id="gh-sound-toggle" title="Toggle Sound" style="padding: 2px 6px; cursor: pointer; background: #50c878; border: none; border-radius: 4px; color: white; width: 28px;">🔊</button>
                        <button id="gh-countdown-btn" style="padding: 2px 8px; cursor: pointer; background: #00a1d6; border: none; border-radius: 4px; color: white;">Off</button>
                    </div>
                </div>
            </div>
        `;

        // Append to the video area to ensure visibility in fullscreen
        const playerArea = document.querySelector('.bpx-player-video-area') ||
            document.querySelector('.bpx-player-container') ||
            document.querySelector('#bilibili-player');

        if (playerArea) {
            playerArea.appendChild(container);
        }

        // Basic Event Listeners
        const header = document.getElementById('gh-header');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.onmousedown = (e) => {
            if (e.target.id === 'gh-minimize-btn' || state.isMinimized) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = container.getBoundingClientRect();
            const parentRect = container.parentElement.getBoundingClientRect();
            initialLeft = rect.left - parentRect.left;
            initialTop = rect.top - parentRect.top;
            
            container.style.transition = 'none'; // Disable transition while dragging
            
            document.onmousemove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                container.style.left = `${initialLeft + dx}px`;
                container.style.top = `${initialTop + dy}px`;
                container.style.right = 'auto'; // Break the initial 'right' anchor
            };
            
            document.onmouseup = () => {
                isDragging = false;
                document.onmousemove = null;
                document.onmouseup = null;
                container.style.transition = 'opacity 0.3s ease, backdrop-filter 0.3s ease, width 0.3s ease';
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
            const header = document.getElementById('gh-minimize-btn').parentElement;
            if (state.isMinimized) {
                header.style.marginBottom = '0';
                header.style.borderBottom = 'none';
                header.style.paddingBottom = '0';
            } else {
                header.style.marginBottom = '5px';
                header.style.borderBottom = '1px solid rgba(255,255,255,0.3)';
                header.style.paddingBottom = '5px';
            }
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
