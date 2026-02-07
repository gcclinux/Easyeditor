interface TextAreaRef {
  current: HTMLTextAreaElement | null;
}

// Insert Nomnoml Process of Elimination Diagram Syntax
export const insertUMLProcessOfEliminationDiagram = (
  textareaRef: TextAreaRef,
  editorContent: string,
  setEditorContent: (content: string) => void,
  cursorPositionRef: { current: number }
) => {
  if (textareaRef.current) {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const checkText = `## Process of Elimination: Troubleshooting Guide

This template outlines a systematic approach to identifying and resolving technical issues. By isolating variables and testing hypotheses, you can efficiently narrow down the root cause.

## Workflow Diagram

\`\`\`plantuml
#title: Process of Elimination (Troubleshooting)
#direction: down

[<start> Identify Issue|
  System is slow
]

[Identify Issue] -> [Hypothesis 1|
  Network latency?
]

[Hypothesis 1] -> [<choice> Test 1|
  Ping check
]

[Test 1] Pass -> [Hypothesis 2|
  Database Load?
]

[Test 1] Fail -> [Action 1|
  Check Network
]

[Hypothesis 2] -> [<choice> Test 2|
  Check Slow Queries
]

[Test 2] Fail -> [Action 2|
  Optimize DB
]

[Test 2] Pass -> [Hypothesis 3|
  App Server CPU?
]

[Hypothesis 3] -> [<choice> Test 3|
  Check CPU Usage
]

[Test 3] Fail -> [Action 3|
  Scale detailed Scale Up
]

[Test 3] Pass -> [Conclusion|
  Unknown Issue
  (Escalate)
]

[Action 1] --> [<end> Resolved]
[Action 2] --> [<end> Resolved]
[Action 3] --> [<end> Resolved]
\`\`\`

## Troubleshooting Steps

1. **Identify the Issue:** Clearly define the symptom (e.g., "System is slow").
2. **Formulate Hypotheses:** List potential causes (Network, Database, CPU, etc.).
3. **Test & Validate:**
   - Perform specific tests for each hypothesis.
   - If a test passes (issue not found), move to the next hypothesis.
   - If a test fails (issue found), perform the corresponding action.
4. **Execute Action:** Apply the fix (e.g., Optimize DB, Scale Up).
5. **Verify Resolution:** Ensure the issue is resolved.
`;
    const newText =
      editorContent.substring(0, start) +
      checkText +
      editorContent.substring(end);
    setEditorContent(newText);
    cursorPositionRef.current = start + checkText.length;
  }
};
