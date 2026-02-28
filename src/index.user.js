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

            let remaining = state.countdownSeconds;
            console.log(`Starting countdown: ${remaining}...`);

            const interval = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(interval);
                    state.isCountingDown = false;
                    state.video.play();
                    console.log("Play!");
                } else {
                    console.log(`Countdown: ${remaining}...`);
                }
            }, 1000);
        }
    };

    /**
     * UI Implementation
     */
    function injectUI() {
        const controlBar = document.querySelector('.bpx-player-control-entity') || 
                          document.querySelector('.squirtle-controller'); // Different Bilibili player versions

        if (!controlBar || document.getElementById('guitar-helper-ui')) return;

        const container = document.createElement('div');
        container.id = 'guitar-helper-ui';
        container.style.cssText = `
            display: flex;
            align-items: center;
            padding: 5px 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            font-size: 12px;
            border-top: 1px solid #444;
        `;

        container.innerHTML = `
            <div style="margin-right: 15px;">Guitar Helper:</div>
            <button id="gh-loop-btn" style="margin-right: 5px; cursor: pointer;">Loop: Off</button>
            <button id="gh-countdown-btn" style="cursor: pointer;">Countdown Start</button>
        `;

        // Add to the bottom of the player container or nearby
        const playerArea = document.querySelector('.bpx-player-container') || 
                          document.querySelector('#bilibili-player');
        if (playerArea) {
            playerArea.appendChild(container);
        }

        // Basic Event Listeners
        document.getElementById('gh-loop-btn').onclick = () => {
            state.loopActive = !state.loopActive;
            document.getElementById('gh-loop-btn').innerText = `Loop: ${state.loopActive ? 'On' : 'Off'}`;
            if (state.loopActive && state.video) {
                state.startTime = state.video.currentTime;
                state.endTime = state.video.currentTime + 5; // Default 5s loop for now
                console.log(`Loop set from ${state.startTime} to ${state.endTime}`);
            }
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
