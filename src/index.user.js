// ==UserScript==
// @name         Bilibili Guitar Helper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Loop specified segment, change playback speed, and count down before play on Bilibili.
// @author       Your Name
// @match        *://*.bilibili.com/video/*
// @match        *://*.bilibili.com/bangumi/play/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration and State
    const state = {
        video: null,
        loopActive: false,
        startTime: 0,
        endTime: 0,
        playbackSpeed: 1.0,
        countdownSeconds: 3,
        isCountingDown: false,
        soundEnabled: true
    };

    /**
     * Core Features Implementation
     */
    const Features = {
        playTick: function(isFinal = false) {
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

        formatTime: function(seconds) {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return h > 0 ? 
                `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : 
                `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        },

        // 1. Loop specified segment
        handleLoop: function() {
            if (state.loopActive && state.video) {
                if (state.video.currentTime >= state.endTime) {
                    state.video.currentTime = state.startTime;
                }
            }
        },

        // 2. Change playback speed
        setPlaybackSpeed: function(speed) {
            if (state.video) {
                const newSpeed = Math.min(1.0, Math.max(0.5, parseFloat(speed.toFixed(1))));
                state.video.playbackRate = newSpeed;
                state.playbackSpeed = newSpeed;
                const display = document.getElementById('gh-speed-display');
                if (display) display.innerText = newSpeed.toFixed(1) + 'x';
            }
        },

        // 3. Count down before play
        startCountdown: function() {
            if (state.isCountingDown || !state.video) return;

            state.isCountingDown = true;
            state.video.pause();

            // Seek to start point if it exists, otherwise to 0
            state.video.currentTime = state.startTime || 0;

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
            gap: 10px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            color: white;
            font-size: 12px;
            border-radius: 8px;
            z-index: 999999;
            pointer-events: auto;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        container.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 5px;">🎸 Guitar Helper</div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <span>Loop:</span>
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
                <span>Countdown:</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <button id="gh-sound-toggle" title="Toggle Sound" style="padding: 2px 6px; cursor: pointer; background: #50c878; border: none; border-radius: 4px; color: white; width: 28px;">🔊</button>
                    <button id="gh-countdown-btn" style="padding: 2px 8px; cursor: pointer; background: #00a1d6; border: none; border-radius: 4px; color: white;">Start</button>
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
            state.loopActive = !state.loopActive;
            const btn = document.getElementById('gh-loop-btn');
            btn.innerText = state.loopActive ? 'On' : 'Off';
            btn.style.background = state.loopActive ? '#fb7299' : '#00a1d6';
        };

        document.getElementById('gh-countdown-btn').onclick = () => {
            Features.startCountdown();
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

            // Add Keyboard Shortcuts
            window.addEventListener('keydown', (e) => {
                // Ignore if user is typing in an input field
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

                switch(e.key) {
                    case 'i':
                    case 'I':
                        document.getElementById('gh-loop-start').click();
                        break;
                    case 'o':
                    case 'O':
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
            });
        } else {
            // Retry if video isn't ready yet (common in SPAs)
            setTimeout(init, 1000);
        }
    }

    // Start checking for player
    init();

})();
