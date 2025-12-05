import { useState, useRef } from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { useApp } from "../App";
import { ArrowRightIcon, DotsIcon } from "../icons";

import {
  generateWithClaude,
  getClaudeApiKey,
  setClaudeApiKey,
  testClaudeConnection,
} from "../../data/ai/claudeProvider";

import {
  RESEARCH_DIAGRAM_SYSTEM_PROMPT,
  getPromptForTemplate,
  TEMPLATE_LABELS,
  type ResearchDiagramTemplate,
} from "../../data/ai/researchPrompts";

import { parseAIResponseToElements } from "../../data/ai/elementGenerator";

import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogPanels } from "./TTDDialogPanels";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";

import type { BinaryFiles } from "../../types";

import "./TTDDialog.scss";

interface ResearchModeProps {
  onClose?: () => void;
}

export const ResearchMode = ({ onClose }: ResearchModeProps) => {
  const app = useApp();

  const [text, setText] = useState("");
  const [template, setTemplate] =
    useState<ResearchDiagramTemplate>("neural_network");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKeyState] = useState(getClaudeApiKey() || "");
  const [apiKeyTestResult, setApiKeyTestResult] = useState<boolean | null>(
    null,
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });

  const prompt = text.trim();

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const handleTemplateChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setTemplate(event.target.value as ResearchDiagramTemplate);
  };

  const handleApiKeySave = async () => {
    setClaudeApiKey(apiKey);
    setApiKeyTestResult(null);

    if (apiKey) {
      const isValid = await testClaudeConnection(apiKey);
      setApiKeyTestResult(isValid);
    }
  };

  const onGenerate = async () => {
    if (!prompt || isGenerating) {
      return;
    }

    const currentApiKey = getClaudeApiKey();
    if (!currentApiKey) {
      setError(new Error("Please configure your Claude API key in settings"));
      setShowSettings(true);
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const fullPrompt = getPromptForTemplate(template) + prompt;

      const response = await generateWithClaude(
        fullPrompt,
        RESEARCH_DIAGRAM_SYSTEM_PROMPT,
        { apiKey: currentApiKey },
      );

      if ("error" in response && response.type === "error") {
        throw new Error(response.error.message);
      }

      const claudeResponse = response;
      const textContent = claudeResponse.content[0]?.text;

      if (!textContent) {
        throw new Error("No response generated");
      }

      const elements = parseAIResponseToElements(textContent);

      if (elements.length === 0) {
        throw new Error("No valid elements generated from the response");
      }

      data.current = {
        elements: elements as NonDeletedExcalidrawElement[],
        files: null,
      };

      // Render preview
      if (canvasRef.current) {
        canvasRef.current.innerHTML = `
          <div style="padding: 20px; text-align: center;">
            <div style="font-size: 14px; color: var(--color-success);">
              ✓ Generated ${elements.length} elements
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: var(--color-text-secondary);">
              Click "Insert" to add to canvas
            </div>
          </div>
        `;
      }
    } catch (err: any) {
      console.error("Research diagram generation failed:", err);
      setError(new Error(err.message || "Generation failed"));
      data.current = { elements: [], files: null };
    } finally {
      setIsGenerating(false);
    }
  };

  const refOnGenerate = useRef(onGenerate);
  refOnGenerate.current = onGenerate;

  const insertToEditor = () => {
    if (data.current.elements.length === 0) {
      return;
    }

    const { elements } = data.current;

    // Calculate center position in viewport
    const { width, height, scrollX, scrollY } = app.state;
    const centerX = -scrollX + width / 2;
    const centerY = -scrollY + height / 2;

    // Find bounding box of generated elements
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    elements.forEach((el) => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    });

    // Offset to center elements
    const offsetX = centerX - (minX + maxX) / 2;
    const offsetY = centerY - (minY + maxY) / 2;

    const offsetElements = elements.map((el) => ({
      ...el,
      x: el.x + offsetX,
      y: el.y + offsetY,
    }));

    app.scene.insertElements(offsetElements);
    app.setOpenDialog(null);
  };

  if (showSettings) {
    return (
      <div className="ttd-dialog-content" style={{ padding: "20px" }}>
        <h3 style={{ margin: "0 0 20px 0" }}>AI Settings</h3>

        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: 500,
            }}
          >
            Claude API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyState(e.target.value)}
            placeholder="sk-ant-api03-..."
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-surface-low)",
              color: "var(--color-text)",
              fontSize: "14px",
            }}
          />
          <div
            style={{
              fontSize: "12px",
              color: "var(--color-text-secondary)",
              marginTop: "4px",
            }}
          >
            Get your API key from{" "}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-primary)" }}
            >
              console.anthropic.com
            </a>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button
            onClick={handleApiKeySave}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--color-primary)",
              color: "white",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Save & Test
          </button>
          <button
            onClick={() => setShowSettings(false)}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              backgroundColor: "transparent",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            Back
          </button>
        </div>

        {apiKeyTestResult !== null && (
          <div
            style={{
              marginTop: "16px",
              padding: "10px",
              borderRadius: "8px",
              backgroundColor: apiKeyTestResult
                ? "var(--color-success-lighter)"
                : "var(--color-danger-lighter)",
              color: apiKeyTestResult
                ? "var(--color-success)"
                : "var(--color-danger)",
            }}
          >
            {apiKeyTestResult
              ? "✓ API key is valid"
              : "✗ API key is invalid or connection failed"}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className="ttd-dialog-desc"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          Generate research architecture diagrams using AI. Select a template
          and describe your architecture.
        </span>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            color: "var(--color-text-secondary)",
          }}
          title="AI Settings"
        >
          {DotsIcon}
        </button>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 500,
            fontSize: "14px",
          }}
        >
          Template
        </label>
        <select
          value={template}
          onChange={handleTemplateChange}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-surface-low)",
            color: "var(--color-text)",
            fontSize: "14px",
          }}
        >
          {Object.entries(TEMPLATE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <TTDDialogPanels>
        <TTDDialogPanel
          label={t("labels.prompt")}
          panelAction={{
            action: onGenerate,
            label: "Generate",
            icon: ArrowRightIcon,
          }}
          onTextSubmitInProgess={isGenerating}
          panelActionDisabled={!prompt}
          renderSubmitShortcut={() => <TTDDialogSubmitShortcut />}
        >
          <TTDDialogInput
            onChange={handleTextChange}
            input={text}
            placeholder={getPlaceholderForTemplate(template)}
            onKeyboardSubmit={() => {
              refOnGenerate.current();
            }}
          />
        </TTDDialogPanel>
        <TTDDialogPanel
          label="Preview"
          panelAction={{
            action: insertToEditor,
            label: "Insert",
            icon: ArrowRightIcon,
          }}
          panelActionDisabled={data.current.elements.length === 0}
        >
          <TTDDialogOutput canvasRef={canvasRef} error={error} loaded={true} />
        </TTDDialogPanel>
      </TTDDialogPanels>
    </>
  );
};

const getPlaceholderForTemplate = (
  template: ResearchDiagramTemplate,
): string => {
  switch (template) {
    case "neural_network":
      return "e.g., A CNN with 3 conv layers (32, 64, 128 filters), max pooling, and 2 dense layers for image classification";
    case "ml_pipeline":
      return "e.g., Data ingestion from S3, preprocessing with pandas, training with PyTorch, evaluation, and deployment to SageMaker";
    case "transformer":
      return "e.g., BERT-style encoder with 12 layers, 768 hidden size, 12 attention heads";
    case "experiment":
      return "e.g., A/B test comparing two recommendation algorithms on click-through rate";
    case "data_flow":
      return "e.g., ETL pipeline: extract from PostgreSQL, transform with Spark, load to BigQuery";
    case "custom":
    default:
      return "Describe your research architecture...";
  }
};

export default ResearchMode;
