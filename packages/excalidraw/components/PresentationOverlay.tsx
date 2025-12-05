import React from "react";

import { useUIAppState } from "../context/ui-appState";

import {
  actionExitPresentation,
  actionNextPresentationFrame,
  actionPrevPresentationFrame,
} from "../actions/actionPresentation";

import { useExcalidrawActionManager } from "./App";

import "./PresentationOverlay.scss";

export const PresentationOverlay: React.FC = () => {
  const appState = useUIAppState();
  const actionManager = useExcalidrawActionManager();

  // Early return if context not yet initialized or not in presentation mode
  if (!appState || !actionManager || !appState.presentationMode) {
    return null;
  }

  const currentSlide = appState.presentationFrameIndex + 1;
  const totalSlides = appState.presentationFrameIds.length;

  const handlePrev = () => {
    actionManager.executeAction(actionPrevPresentationFrame);
  };

  const handleNext = () => {
    actionManager.executeAction(actionNextPresentationFrame);
  };

  const handleExit = () => {
    actionManager.executeAction(actionExitPresentation);
  };

  return (
    <div className="presentation-overlay">
      <div className="presentation-overlay__controls">
        <button
          className="presentation-overlay__btn presentation-overlay__btn--prev"
          onClick={handlePrev}
          disabled={currentSlide === 1}
          title="Previous slide (←)"
        >
          ‹
        </button>

        <div className="presentation-overlay__counter">
          <span className="presentation-overlay__current">{currentSlide}</span>
          <span className="presentation-overlay__separator">/</span>
          <span className="presentation-overlay__total">{totalSlides}</span>
        </div>

        <button
          className="presentation-overlay__btn presentation-overlay__btn--next"
          onClick={handleNext}
          disabled={currentSlide === totalSlides}
          title="Next slide (→)"
        >
          ›
        </button>

        <button
          className="presentation-overlay__btn presentation-overlay__btn--exit"
          onClick={handleExit}
          title="Exit presentation (Esc)"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default PresentationOverlay;
