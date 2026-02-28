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
        isCountingDown: false
    };

    /**
     * Core Features Implementation
     */
    const Features = {
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
                state.video.playbackRate = speed;
                state.playbackSpeed = speed;
            }
        },

        // 3. Count down before play
        startCountdown: function() {
            if (state.isCountingDown || !state.video) return;

            state.isCountingDown = true;
            state.video.pause();

            // Create countdown overlay
            const overlay = document.createElement('div');
            overlay.id = 'gh-countdown-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 120px;
                font-weight: bold;
                color: white;
                text-shadow: 0 0 20px rgba(0,0,0,0.8);
                z-index: 1000000;
                pointer-events: none;
                font-family: Arial, sans-serif;
            `;
            
            const playerArea = document.querySelector('.bpx-player-video-area') || 
                              document.querySelector('.bpx-player-container') || 
                              document.querySelector('#bilibili-player');
            if (playerArea) playerArea.appendChild(overlay);

            let remaining = state.countdownSeconds;
            overlay.innerText = remaining;

            const interval = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(interval);
                    state.isCountingDown = false;
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    state.video.play();
                } else {
                    overlay.innerText = remaining;
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
                <span>Countdown:</span>
                <button id="gh-countdown-btn" style="padding: 2px 8px; cursor: pointer; background: #00a1d6; border: none; border-radius: 4px; color: white;">Start</button>
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
        } else {
            // Retry if video isn't ready yet (common in SPAs)
            setTimeout(init, 1000);
        }
    }

    // Start checking for player
    init();

})();
