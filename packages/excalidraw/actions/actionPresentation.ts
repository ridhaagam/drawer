import { getNonDeletedElements } from "@excalidraw/element";
import { isFrameLikeElement } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";
import { KEYS } from "@excalidraw/common";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

import { register } from "./register";

/**
 * Get frames ordered for presentation (left-to-right, top-to-bottom)
 */
const getOrderedFramesForPresentation = (
  elements: readonly ReturnType<typeof getNonDeletedElements>[number][],
): ExcalidrawFrameLikeElement[] => {
  const frames = elements.filter(
    isFrameLikeElement,
  ) as ExcalidrawFrameLikeElement[];

  // Sort by position: first by y (top to bottom), then by x (left to right)
  // This creates a natural reading order
  return frames.sort((a, b) => {
    const yDiff = a.y - b.y;
    // If frames are roughly on the same row (within 100px), sort by x
    if (Math.abs(yDiff) < 100) {
      return a.x - b.x;
    }
    return yDiff;
  });
};

export const actionEnterPresentation = register({
  name: "enterPresentation",
  label: "labels.enterPresentation",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (elements, appState, _, app) => {
    const nonDeletedElements = getNonDeletedElements(elements);
    const frames = getOrderedFramesForPresentation(nonDeletedElements);

    if (frames.length === 0) {
      return {
        elements,
        appState: {
          ...appState,
          toast: {
            message:
              "No frames found. Create frames to use as presentation slides.",
            duration: 3000,
            closable: true,
          },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const frameIds = frames.map((f) => f.id);
    const firstFrame = frames[0];

    // Scroll to first frame
    app.scrollToContent(firstFrame, {
      fitToViewport: true,
      viewportZoomFactor: 0.9,
      animate: true,
      duration: 300,
    });

    return {
      elements,
      appState: {
        ...appState,
        presentationMode: true,
        presentationFrameIndex: 0,
        presentationFrameIds: frameIds,
        viewModeEnabled: true,
        zenModeEnabled: true,
        // Hide UI elements during presentation
        openSidebar: null,
        openDialog: null,
        openMenu: null,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (elements) => {
    const nonDeletedElements = getNonDeletedElements(elements);
    return nonDeletedElements.some(isFrameLikeElement);
  },
  keyTest: (event) =>
    event.key === "F5" ||
    (event.key.toLowerCase() === "p" &&
      event.shiftKey &&
      event[KEYS.CTRL_OR_CMD]),
});

export const actionExitPresentation = register({
  name: "exitPresentation",
  label: "labels.exitPresentation",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (elements, appState) => {
    return {
      elements,
      appState: {
        ...appState,
        presentationMode: false,
        presentationFrameIndex: 0,
        presentationFrameIds: [],
        viewModeEnabled: false,
        zenModeEnabled: false,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (_, appState) => appState.presentationMode,
  keyTest: (event, appState) =>
    appState.presentationMode && event.key === KEYS.ESCAPE,
});

export const actionNextPresentationFrame = register({
  name: "nextPresentationFrame",
  label: "labels.nextFrame",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (elements, appState, _, app) => {
    if (
      !appState.presentationMode ||
      appState.presentationFrameIds.length === 0
    ) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const nextIndex = Math.min(
      appState.presentationFrameIndex + 1,
      appState.presentationFrameIds.length - 1,
    );

    if (nextIndex === appState.presentationFrameIndex) {
      // Already at last frame
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const nextFrameId = appState.presentationFrameIds[nextIndex];
    const frame = elements.find((el) => el.id === nextFrameId);

    if (frame) {
      app.scrollToContent(frame, {
        fitToViewport: true,
        viewportZoomFactor: 0.9,
        animate: true,
        duration: 300,
      });
    }

    return {
      elements,
      appState: {
        ...appState,
        presentationFrameIndex: nextIndex,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (_, appState) => appState.presentationMode,
  keyTest: (event, appState) =>
    appState.presentationMode &&
    (event.key === KEYS.ARROW_RIGHT ||
      event.key === KEYS.ARROW_DOWN ||
      event.key === KEYS.SPACE ||
      event.key === KEYS.PAGE_DOWN),
});

export const actionPrevPresentationFrame = register({
  name: "prevPresentationFrame",
  label: "labels.prevFrame",
  viewMode: true,
  trackEvent: { category: "canvas" },
  perform: (elements, appState, _, app) => {
    if (
      !appState.presentationMode ||
      appState.presentationFrameIds.length === 0
    ) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const prevIndex = Math.max(appState.presentationFrameIndex - 1, 0);

    if (prevIndex === appState.presentationFrameIndex) {
      // Already at first frame
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const prevFrameId = appState.presentationFrameIds[prevIndex];
    const frame = elements.find((el) => el.id === prevFrameId);

    if (frame) {
      app.scrollToContent(frame, {
        fitToViewport: true,
        viewportZoomFactor: 0.9,
        animate: true,
        duration: 300,
      });
    }

    return {
      elements,
      appState: {
        ...appState,
        presentationFrameIndex: prevIndex,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  predicate: (_, appState) => appState.presentationMode,
  keyTest: (event, appState) =>
    appState.presentationMode &&
    (event.key === KEYS.ARROW_LEFT ||
      event.key === KEYS.ARROW_UP ||
      event.key === KEYS.PAGE_UP),
});
