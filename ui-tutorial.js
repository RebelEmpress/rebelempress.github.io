// Extracted from main.js — ui-tutorial UI module
import { setCookie } from './utils.js';
import { GS } from './state.js';
import * as DOM from './dom.js';

export function updateTutorialUI() {
    const step = GS.activeTutorialSet[GS.currentTutorialStep];
    if (!step) return;

    // Move the tutorial panel to the right for step 4 (index 3) of the Conquest tutorial
    // to prevent it from overlapping the Side B recruitment list.
    if (GS.activeTutorialKey === 'mw_tutorial_finished' && GS.currentTutorialStep === 3) {
        DOM.tutorialOverlay.style.justifyContent = 'flex-end';
        DOM.tutorialOverlay.style.paddingLeft = '0';
        DOM.tutorialOverlay.style.paddingRight = '5%';
    } else {
        DOM.tutorialOverlay.style.justifyContent = 'flex-start';
        DOM.tutorialOverlay.style.paddingLeft = '5%';
        DOM.tutorialOverlay.style.paddingRight = '0';
    }

    DOM.tutorialStepContainer.innerHTML = `
        <div class="tutorial-step">
            <div class="tutorial-header">
                <span class="tutorial-icon">${step.icon}</span>
                <h2 class="tutorial-title">${step.title}</h2>
            </div>
            <div class="tutorial-body">${step.content}</div>
        </div>
    `;

    DOM.tutorialPrevBtn.style.visibility = GS.currentTutorialStep === 0 ? 'hidden' : 'visible';
    DOM.tutorialNextBtn.innerText = GS.currentTutorialStep === GS.activeTutorialSet.length - 1 ? 'Finish' : 'Next';
    
    const needsAction = step.actionRequired !== "CLICK_NEXT" && 
                        step.actionRequired !== "CLICK_FINISH" && 
                        step.actionRequired !== "LOAD_MAP";
    DOM.tutorialNextBtn.disabled = needsAction;
    DOM.tutorialNextBtn.style.opacity = needsAction ? "0.5" : "1";

    DOM.tutorialDotsContainer.innerHTML = GS.activeTutorialSet.map((_, i) => 
        `<div class="dot ${i === GS.currentTutorialStep ? 'active' : ''}"></div>`
    ).join('');
    
    if (step.actionRequired === "LOAD_MAP") {
        DOM.tutorialNextBtn.onclick = () => {
            // Automatically trigger Modern Day scenario loading to skip the selection modal
            DOM.choiceModernDay.click();
            advanceTutorial();
        };
    } else {
        DOM.tutorialNextBtn.onclick = () => {
            if (GS.currentTutorialStep < GS.activeTutorialSet.length - 1) {
                GS.currentTutorialStep++;
                updateTutorialUI();
            } else {
                endTutorial();
            }
        };
    }
}

export function advanceTutorial() {
    if (GS.currentTutorialStep < GS.activeTutorialSet.length - 1) {
        GS.currentTutorialStep++;
        updateTutorialUI();
    }
}

export function endTutorial() {
    DOM.tutorialOverlay.style.display = 'none';
    GS.tutorialActive = false;
    setCookie(GS.activeTutorialKey, 'true');
}

export function startTutorial(set, key) {
    GS.activeTutorialSet = set;
    GS.activeTutorialKey = key;
    GS.currentTutorialStep = 0;
    GS.tutorialActive = true;
    updateTutorialUI();
    DOM.tutorialOverlay.style.display = 'flex';
}
