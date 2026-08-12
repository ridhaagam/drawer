import { exportToCanvas } from "@excalidraw/utils/export";
import React, { useEffect, useRef, useState } from "react";

import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_IMAGE_TYPES,
  isFirefox,
  EXPORT_SCALES,
  EXPORT_UNITS,
  EXPORT_WIDTH_PRESETS,
  cloneJSON,
} from "@excalidraw/common";

import type { ExportUnit } from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  actionExportWithDarkMode,
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportPadding,
  actionChangeExportPhysicalWidth,
  actionChangeExportScale,
  actionChangeProjectName,
} from "../actions/actionExport";
import { probablySupportsClipboardBlob } from "../clipboard";
import { prepareElementsForExport } from "../data";
import { canvasToBlob } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
import { useCopyStatus } from "../hooks/useCopiedIndicator";

import { t } from "../i18n";
import { isSomeElementSelected } from "../scene";

import { copyIcon, downloadIcon, helpIcon } from "./icons";
import { Dialog } from "./Dialog";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";
import { FilledButton } from "./FilledButton";

import "./ImageExportDialog.scss";

import type { ActionManager } from "../actions/manager";

import type { AppClassProperties, BinaryFiles, UIAppState } from "../types";

const supportsContextFilters =
  "filter" in document.createElement("canvas").getContext("2d")!;

export const ErrorCanvasPreview = () => {
  return (
    <div>
      <h3>{t("canvasError.cannotShowPreview")}</h3>
      <p>
        <span>{t("canvasError.canvasTooBig")}</span>
      </p>
      <em>({t("canvasError.canvasTooBigTip")})</em>
    </div>
  );
};

type ImageExportModalProps = {
  appStateSnapshot: Readonly<UIAppState>;
  elementsSnapshot: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  name: string;
};

const ImageExportModal = ({
  appStateSnapshot,
  elementsSnapshot,
  files,
  actionManager,
  onExportImage,
  name,
}: ImageExportModalProps) => {
  const hasSelection = isSomeElementSelected(
    elementsSnapshot,
    appStateSnapshot,
  );

  const [projectName, setProjectName] = useState(name);
  const [exportSelectionOnly, setExportSelectionOnly] = useState(hasSelection);
  const [exportWithBackground, setExportWithBackground] = useState(
    appStateSnapshot.exportBackground,
  );
  const [exportDarkMode, setExportDarkMode] = useState(
    appStateSnapshot.exportWithDarkMode,
  );
  const [embedScene, setEmbedScene] = useState(
    appStateSnapshot.exportEmbedScene,
  );
  const [exportScale, setExportScale] = useState(appStateSnapshot.exportScale);
  const [exportPadding, setExportPadding] = useState(
    appStateSnapshot.exportPadding ?? DEFAULT_EXPORT_PADDING,
  );
  const [physicalWidth, setPhysicalWidth] = useState(
    appStateSnapshot.exportPhysicalWidth,
  );

  const previewRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);

  const { onCopy, copyStatus, resetCopyStatus } = useCopyStatus();

  useEffect(() => {
    // if user changes setting right after export to clipboard, reset the status
    // so they don't have to wait for the timeout to click the button again
    resetCopyStatus();
  }, [
    projectName,
    exportWithBackground,
    exportDarkMode,
    exportScale,
    exportPadding,
    physicalWidth,
    embedScene,
    resetCopyStatus,
  ]);

  const { exportedElements, exportingFrame } = prepareElementsForExport(
    elementsSnapshot,
    appStateSnapshot,
    exportSelectionOnly,
  );

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const maxWidth = previewNode.offsetWidth;
    const maxHeight = previewNode.offsetHeight;
    if (!maxWidth) {
      return;
    }

    exportToCanvas({
      elements: exportedElements,
      appState: {
        ...appStateSnapshot,
        name: projectName,
        exportBackground: exportWithBackground,
        exportWithDarkMode: exportDarkMode,
        exportScale,
        exportEmbedScene: embedScene,
      },
      files,
      exportPadding,
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      exportingFrame,
    })
      .then((canvas) => {
        setRenderError(null);
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        return canvasToBlob(canvas)
          .then(() => {
            previewNode.replaceChildren(canvas);
          })
          .catch((e) => {
            if (e.name === "CANVAS_POSSIBLY_TOO_BIG") {
              throw new Error(t("canvasError.canvasTooBig"));
            }
            throw e;
          });
      })
      .catch((error) => {
        console.error(error);
        setRenderError(error);
      });
  }, [
    appStateSnapshot,
    files,
    exportedElements,
    exportingFrame,
    projectName,
    exportWithBackground,
    exportDarkMode,
    exportScale,
    exportPadding,
    embedScene,
  ]);

  return (
    <div className="ImageExportModal">
      <h3>{t("imageExportDialog.header")}</h3>
      <div className="ImageExportModal__preview">
        <div className="ImageExportModal__preview__canvas" ref={previewRef}>
          {renderError && <ErrorCanvasPreview />}
        </div>
        <div className="ImageExportModal__preview__filename">
          {!nativeFileSystemSupported && (
            <input
              type="text"
              className="TextInput"
              value={projectName}
              style={{ width: "30ch" }}
              onChange={(event) => {
                setProjectName(event.target.value);
                actionManager.executeAction(
                  actionChangeProjectName,
                  "ui",
                  event.target.value,
                );
              }}
            />
          )}
        </div>
      </div>
      <div className="ImageExportModal__settings">
        <h3>{t("imageExportDialog.header")}</h3>
        {hasSelection && (
          <ExportSetting
            label={t("imageExportDialog.label.onlySelected")}
            name="exportOnlySelected"
          >
            <Switch
              name="exportOnlySelected"
              checked={exportSelectionOnly}
              onChange={(checked) => {
                setExportSelectionOnly(checked);
              }}
            />
          </ExportSetting>
        )}
        <ExportSetting
          label={t("imageExportDialog.label.withBackground")}
          name="exportBackgroundSwitch"
        >
          <Switch
            name="exportBackgroundSwitch"
            checked={exportWithBackground}
            onChange={(checked) => {
              setExportWithBackground(checked);
              actionManager.executeAction(
                actionChangeExportBackground,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        {supportsContextFilters && (
          <ExportSetting
            label={t("imageExportDialog.label.darkMode")}
            name="exportDarkModeSwitch"
          >
            <Switch
              name="exportDarkModeSwitch"
              checked={exportDarkMode}
              onChange={(checked) => {
                setExportDarkMode(checked);
                actionManager.executeAction(
                  actionExportWithDarkMode,
                  "ui",
                  checked,
                );
              }}
            />
          </ExportSetting>
        )}
        <ExportSetting
          label={t("imageExportDialog.label.embedScene")}
          tooltip={t("imageExportDialog.tooltip.embedScene")}
          name="exportEmbedSwitch"
        >
          <Switch
            name="exportEmbedSwitch"
            checked={embedScene}
            onChange={(checked) => {
              setEmbedScene(checked);
              actionManager.executeAction(
                actionChangeExportEmbedScene,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        <ExportSetting
          label={t("imageExportDialog.label.scale")}
          name="exportScale"
        >
          <RadioGroup
            name="exportScale"
            value={exportScale}
            onChange={(scale) => {
              setExportScale(scale);
              actionManager.executeAction(actionChangeExportScale, "ui", scale);
            }}
            choices={EXPORT_SCALES.map((scale) => ({
              value: scale,
              label: `${scale}\u00d7`,
            }))}
          />
        </ExportSetting>
        <ExportSetting
          label={t("imageExportDialog.label.padding")}
          name="exportPadding"
        >
          <input
            id="exportPadding"
            className="ImageExportModal__settings__numberInput"
            type="number"
            min={0}
            max={200}
            step={1}
            value={exportPadding}
            onChange={(event) => {
              const value = Math.max(0, Math.min(200, +event.target.value));
              setExportPadding(value);
              actionManager.executeAction(
                actionChangeExportPadding,
                "ui",
                value,
              );
            }}
          />
        </ExportSetting>
        <ExportSetting
          label={t("imageExportDialog.label.physicalWidth")}
          tooltip={t("imageExportDialog.tooltip.physicalWidth")}
          name="exportPhysicalWidth"
        >
          <PhysicalWidthInput
            value={physicalWidth}
            onChange={(value) => {
              setPhysicalWidth(value);
              actionManager.executeAction(
                actionChangeExportPhysicalWidth,
                "ui",
                value,
              );
            }}
          />
        </ExportSetting>

        <div className="ImageExportModal__settings__buttons">
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToPng")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.png, exportedElements, {
                exportingFrame,
              })
            }
            icon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToPng")}
          </FilledButton>
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToSvg")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.svg, exportedElements, {
                exportingFrame,
              })
            }
            icon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToSvg")}
          </FilledButton>
          {(probablySupportsClipboardBlob || isFirefox) && (
            <FilledButton
              className="ImageExportModal__settings__buttons__button"
              label={t("imageExportDialog.title.copyPngToClipboard")}
              status={copyStatus}
              onClick={async () => {
                await onExportImage(
                  EXPORT_IMAGE_TYPES.clipboard,
                  exportedElements,
                  {
                    exportingFrame,
                  },
                );
                onCopy();
              }}
              icon={copyIcon}
            >
              {t("imageExportDialog.button.copyPngToClipboard")}
            </FilledButton>
          )}
        </div>
      </div>
    </div>
  );
};

type ExportSettingProps = {
  label: string;
  children: React.ReactNode;
  tooltip?: string;
  name?: string;
};

const PhysicalWidthInput = ({
  value,
  onChange,
}: {
  value: UIAppState["exportPhysicalWidth"];
  onChange: (value: UIAppState["exportPhysicalWidth"]) => void;
}) => {
  const preset = EXPORT_WIDTH_PRESETS.find(
    (candidate) =>
      value != null &&
      candidate.value === value.value &&
      candidate.unit === value.unit,
  );

  return (
    <div className="ImageExportModal__settings__physicalWidth">
      <select
        className="ImageExportModal__settings__select"
        value={preset ? preset.label : value ? "custom" : "auto"}
        onChange={(event) => {
          if (event.target.value === "auto") {
            onChange(null);
            return;
          }
          const chosen = EXPORT_WIDTH_PRESETS.find(
            (candidate) => candidate.label === event.target.value,
          );
          onChange(
            chosen
              ? { value: chosen.value, unit: chosen.unit }
              : value ?? { value: 100, unit: "mm" },
          );
        }}
      >
        <option value="auto">Auto</option>
        {EXPORT_WIDTH_PRESETS.map((candidate) => (
          <option key={candidate.label} value={candidate.label}>
            {candidate.label}
          </option>
        ))}
        <option value="custom">Custom</option>
      </select>
      {value && (
        <>
          <input
            className="ImageExportModal__settings__numberInput"
            type="number"
            min={0}
            step={0.05}
            value={value.value}
            onChange={(event) =>
              onChange({ value: +event.target.value, unit: value.unit })
            }
          />
          <select
            className="ImageExportModal__settings__select"
            value={value.unit}
            onChange={(event) =>
              onChange({
                value: value.value,
                unit: event.target.value as ExportUnit,
              })
            }
          >
            {EXPORT_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
};

const ExportSetting = ({
  label,
  children,
  tooltip,
  name,
}: ExportSettingProps) => {
  return (
    <div className="ImageExportModal__settings__setting" title={label}>
      <label
        htmlFor={name}
        className="ImageExportModal__settings__setting__label"
      >
        {label}
        {tooltip && (
          <Tooltip label={tooltip} long={true}>
            {helpIcon}
          </Tooltip>
        )}
      </label>
      <div className="ImageExportModal__settings__setting__content">
        {children}
      </div>
    </div>
  );
};

export const ImageExportDialog = ({
  elements,
  appState,
  files,
  actionManager,
  onExportImage,
  onCloseRequest,
  name,
}: {
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  onCloseRequest: () => void;
  name: string;
}) => {
  // we need to take a snapshot so that the exported state can't be modified
  // while the dialog is open
  const [{ appStateSnapshot, elementsSnapshot }] = useState(() => {
    return {
      appStateSnapshot: cloneJSON(appState),
      elementsSnapshot: cloneJSON(elements),
    };
  });

  return (
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
      <ImageExportModal
        elementsSnapshot={elementsSnapshot}
        appStateSnapshot={appStateSnapshot}
        files={files}
        actionManager={actionManager}
        onExportImage={onExportImage}
        name={name}
      />
    </Dialog>
  );
};
