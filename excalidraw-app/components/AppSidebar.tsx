import {
  DefaultSidebar,
  Sidebar,
  THEME,
  useExcalidrawActionManager,
  useExcalidrawElements,
  actionEnterPresentation,
} from "@excalidraw/excalidraw";
import { isFrameLikeElement } from "@excalidraw/element";
import {
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { LinkButton } from "@excalidraw/excalidraw/components/LinkButton";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import "./AppSidebar.scss";

const PresentationPanel = () => {
  const actionManager = useExcalidrawActionManager();
  const elements = useExcalidrawElements();
  const appState = useUIAppState();

  // Get frames for display
  const frames = elements.filter(isFrameLikeElement);

  // Sort frames by position (top-to-bottom, left-to-right)
  const sortedFrames = [...frames].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) < 100) {
      return a.x - b.x;
    }
    return yDiff;
  });

  const hasFrames = sortedFrames.length > 0;

  return (
    <div className="presentation-panel">
      <div className="presentation-panel__header">
        <h3>Presentation Mode</h3>
        <p className="presentation-panel__description">
          Use frames as slides for your presentation. Frames will be shown in
          order from top-left to bottom-right.
        </p>
      </div>

      {!hasFrames ? (
        <div className="presentation-panel__empty">
          <div className="presentation-panel__empty-icon">📊</div>
          <p>No frames found</p>
          <p className="presentation-panel__hint">
            Create frames using the Frame tool (F) to add slides to your
            presentation.
          </p>
        </div>
      ) : (
        <>
          <div className="presentation-panel__slides">
            <div className="presentation-panel__slides-header">
              <span>
                {sortedFrames.length} slide
                {sortedFrames.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ul className="presentation-panel__slides-list">
              {sortedFrames.map((frame, index) => (
                <li key={frame.id} className="presentation-panel__slide-item">
                  <span className="presentation-panel__slide-number">
                    {index + 1}
                  </span>
                  <span className="presentation-panel__slide-name">
                    {frame.name || `Frame ${index + 1}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <button
            className="presentation-panel__start-btn"
            onClick={() => actionManager.executeAction(actionEnterPresentation)}
            disabled={appState.presentationMode}
          >
            {appState.presentationMode
              ? "In Presentation"
              : "Start Presentation"}
          </button>

          <div className="presentation-panel__shortcuts">
            <h4>Keyboard Shortcuts</h4>
            <ul>
              <li>
                <kbd>F5</kbd> or <kbd>Ctrl+Shift+P</kbd> — Start
              </li>
              <li>
                <kbd>→</kbd> <kbd>↓</kbd> <kbd>Space</kbd> — Next slide
              </li>
              <li>
                <kbd>←</kbd> <kbd>↑</kbd> — Previous slide
              </li>
              <li>
                <kbd>Esc</kbd> — Exit presentation
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export const AppSidebar = () => {
  const { theme, openSidebar } = useUIAppState();

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab="comments"
          style={{ opacity: openSidebar?.tab === "comments" ? 1 : 0.4 }}
        >
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="presentation"
          style={{ opacity: openSidebar?.tab === "presentation" ? 1 : 0.4 }}
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="comments">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/oss_promo_comments_${
                theme === THEME.DARK ? "dark" : "light"
              }.jpg)`,
              opacity: 0.7,
            }}
          />
          <div className="app-sidebar-promo-text">
            Make comments with Excalidraw+
          </div>
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=comments_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <PresentationPanel />
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
