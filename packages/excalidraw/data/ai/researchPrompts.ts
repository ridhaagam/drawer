export type ResearchDiagramTemplate =
  | "neural_network"
  | "ml_pipeline"
  | "transformer"
  | "experiment"
  | "data_flow"
  | "custom";

export const RESEARCH_DIAGRAM_SYSTEM_PROMPT = `You are an expert research architecture diagram generator. Your task is to create visual representations of research concepts as Excalidraw JSON elements.

OUTPUT FORMAT: You MUST output ONLY a valid JSON array of Excalidraw elements. No markdown, no explanation, no code blocks - just the raw JSON array.

For each element, include these properties:

RECTANGLES (for components/layers):
{
  "type": "rectangle",
  "x": number, "y": number,
  "width": number (typically 150-200),
  "height": number (typically 60-80),
  "backgroundColor": "color",
  "strokeColor": "#1e1e1e",
  "strokeWidth": 2,
  "roughness": 1,
  "roundness": { "type": 3, "value": 8 },
  "boundElements": [{"type": "text", "id": "text_id"}]
}

TEXT (for labels inside shapes):
{
  "type": "text",
  "x": number, "y": number,
  "text": "Label",
  "fontSize": 16,
  "fontFamily": 1,
  "textAlign": "center",
  "verticalAlign": "middle",
  "containerId": "parent_shape_id"
}

ARROWS (for connections):
{
  "type": "arrow",
  "x": number, "y": number,
  "width": number, "height": number,
  "points": [[0, 0], [endX, endY]],
  "strokeColor": "#1e1e1e",
  "strokeWidth": 2,
  "startArrowhead": null,
  "endArrowhead": "arrow"
}

3D CUBES (for tensors/data):
{
  "type": "cube",
  "x": number, "y": number,
  "width": 100, "height": 80,
  "backgroundColor": "color",
  "strokeColor": "#1e1e1e"
}

COLOR CODING (use these consistently):
- Input/Data layers: "#a5d8ff" (light blue)
- Processing/Hidden layers: "#d0bfff" (light purple)
- Output layers: "#b2f2bb" (light green)
- Decision points: "#ffec99" (light yellow)
- Storage/Memory: "#ffc9c9" (light red)
- Attention/Special: "#fcc2d7" (light pink)

LAYOUT RULES:
1. Start at x=100, y=100
2. Use ~200px horizontal spacing between components
3. Use ~150px vertical spacing between layers
4. Align components in a clear flow (left-to-right or top-to-bottom)
5. Center text labels within shapes
6. Connect related components with arrows

IMPORTANT: Generate complete, valid JSON only. Each element needs a unique "id" field (use format "elem_1", "elem_2", etc.).`;

export const NEURAL_NETWORK_PROMPT = `Create a neural network architecture diagram with the following specification:

Requirements:
- Show input layer, hidden layers, and output layer as rectangles
- Use 3D cubes for tensor shapes if dimensions are specified
- Connect layers with arrows showing data flow
- Label each layer with its name and dimensions
- Use color coding: input=blue, hidden=purple, output=green

Specification: `;

export const ML_PIPELINE_PROMPT = `Create a machine learning pipeline diagram with the following specification:

Requirements:
- Show data flow from left to right
- Include stages: Data Input → Preprocessing → Feature Engineering → Model Training → Evaluation → Deployment
- Use rectangles for processing stages
- Use diamonds for decision/validation points
- Connect stages with arrows
- Label each stage clearly

Specification: `;

export const TRANSFORMER_PROMPT = `Create a Transformer architecture diagram with the following specification:

Requirements:
- Show the encoder-decoder structure (if applicable)
- Include Multi-Head Attention blocks
- Show Feed-Forward Network blocks
- Include Add & Norm layers
- Show positional encoding input
- Use arrows for data flow and skip connections
- Color code: attention=pink, FFN=purple, normalization=yellow

Specification: `;

export const EXPERIMENT_PROMPT = `Create a scientific experiment workflow diagram with the following specification:

Requirements:
- Show the scientific method stages
- Include: Hypothesis → Variables → Method → Data Collection → Analysis → Results → Conclusion
- Use diamonds for decision points (accept/reject hypothesis)
- Show feedback loops where applicable
- Use rectangles for process steps, ellipses for start/end
- Label each stage clearly

Specification: `;

export const DATA_FLOW_PROMPT = `Create a data flow/processing diagram with the following specification:

Requirements:
- Show data sources on the left
- Show processing stages in the middle
- Show outputs/sinks on the right
- Use rectangles for processes
- Use 3D cubes for data storage
- Connect with arrows showing data direction
- Label data transformations on arrows where relevant

Specification: `;

export const getPromptForTemplate = (
  template: ResearchDiagramTemplate,
): string => {
  switch (template) {
    case "neural_network":
      return NEURAL_NETWORK_PROMPT;
    case "ml_pipeline":
      return ML_PIPELINE_PROMPT;
    case "transformer":
      return TRANSFORMER_PROMPT;
    case "experiment":
      return EXPERIMENT_PROMPT;
    case "data_flow":
      return DATA_FLOW_PROMPT;
    case "custom":
    default:
      return "Create a research architecture diagram based on the following description:\n\n";
  }
};

export const TEMPLATE_LABELS: Record<ResearchDiagramTemplate, string> = {
  neural_network: "Neural Network Architecture",
  ml_pipeline: "ML Training Pipeline",
  transformer: "Transformer Architecture",
  experiment: "Scientific Experiment",
  data_flow: "Data Flow Diagram",
  custom: "Custom Diagram",
};
