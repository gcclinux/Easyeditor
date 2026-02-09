interface TextAreaRef {
    current: HTMLTextAreaElement | null;
}

// Insert LLM Training Pipeline Syntax
export const insertUMLLLMTrainingDiagram = (
    textareaRef: TextAreaRef,
    editorContent: string,
    setEditorContent: (content: string) => void,
    cursorPositionRef: { current: number }
) => {
    if (textareaRef.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const checkText = `## LLM Training Pipeline

This template illustrates the end-to-end process of training a Large Language Model (LLM), from data collection to fine-tuning and evaluation.

### Training Architecture

\`\`\`plantuml
#title: LLM Training Pipeline
#direction: down
#spacing: 40
#padding: 20

[<start> Raw Data Sources] -> [Data Collection]
[Data Collection] -> [Cleaner]
[Cleaner] -> [Tokenizer]
[Tokenizer] -> [Embedding Layer]

[Embedding Layer] -> [Transformer Architecture|
  Multi-Head Attention;
  Feed-Forward Networks;
  Layer Normalization
]

[Transformer Architecture] -> [Pre-Training|
  Masked Language Modeling;
  Next Token Prediction;
  (Unsupervised)
]

[Pre-Training] -> [Base Model]

[Base Model] -> [Supervised Fine-Tuning (SFT)|
  Instruction Datasets;
  (Supervised)
]

[SFT] -> [RLHF / DPO|
  Reward Modeling;
  Policy Optimization;
  (Alignment)
]

[RLHF / DPO] -> [<end> Final Chat Model]

[Final Chat Model] -> [Evaluation & Benchmarks]
\`\`\`

### Deep Learning & Training Checklist

#### 1. Data Preparation
- [ ] **Data Scaping:** Collect diverse text corpera (CommonCrawl, GitHub, Wikipedia).
- [ ] **Cleaning:** Remove PII, duplicates, and low-quality text.
- [ ] **Tokenization:** Train a tokenizer (e.g., BPE, WordPiece) on the specific corpus.

#### 2. Model Architecture
- [ ] Define context window size (e.g., 4k, 8k, 32k tokens).
- [ ] Choose parameter count (7B, 13B, 70B+).
- [ ] Configure attention mechanisms (FlashAttention, Grouped-Query Attention).

#### 3. Pre-Training (Expensive Phase)
- [ ] Set up distributed training (FSDP, DeepSpeed).
- [ ] Monitor loss curves for spikes or collapses.
- [ ] Checkpoint frequently to avoid data loss.

#### 4. Fine-Tuning & Alignment
- [ ] **SFT:** Curate high-quality instruction-response pairs.
- [ ] **RLHF:** Train reward model on human preferences.
- [ ] **Quantization:** Compress model (4-bit/8-bit) for inference efficiency.
`;
        const newText =
            editorContent.substring(0, start) +
            checkText +
            editorContent.substring(end);
        setEditorContent(newText);
        cursorPositionRef.current = start + checkText.length;
    }
};
