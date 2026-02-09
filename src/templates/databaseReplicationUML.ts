interface TextAreaRef {
    current: HTMLTextAreaElement | null;
}

// Insert Database Replication Architecture Syntax
export const insertUMLDatabaseReplicationDiagram = (
    textareaRef: TextAreaRef,
    editorContent: string,
    setEditorContent: (content: string) => void,
    cursorPositionRef: { current: number }
) => {
    if (textareaRef.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const checkText = `## Database Replication Setup: Master-Slave

This template illustrates a standard Master-Slave database replication architecture. The Master handles all write operations, while read operations can be distributed across Slave replicas to actionable load balancing and high availability.

## Architecture Diagram

\`\`\`plantuml
#title: Master-Slave Replication
#direction: down
#spacing: 50
#padding: 20

[<component> App Server]

[<database> Master DB|
  Writes (INSERT / UPDATE);
  Primary Data Source
]

[<database> Slave DB 1|
  Read-Only;
  Reporting / Analytics
]

[<database> Slave DB 2|
  Read-Only;
  Backup / Failover
]

[App Server] --> Writes [Master DB]
[App Server] --> Reads [Slave DB 1]
[App Server] --> Reads [Slave DB 2]

[Master DB] -> Async Replication [Slave DB 1]
[Master DB] -> Async Replication [Slave DB 2]

[Slave DB 1] -- Sync Check [Slave DB 2]
\`\`\`

## Configuration Checklist

### 1. Master Configuration
- [ ] Enable binary logging (WAL).
- [ ] Set unique \`server_id\`.
- [ ] Create replication user with \`REPLICATION SLAVE\` privileges.
- [ ] Configure \`bind-address\` to allow connections from slaves.

### 2. Slave Configuration
- [ ] Set unique \`server_id\` (different from Master).
- [ ] Configure \`read_only = 1\` to prevent accidental writes.
- [ ] Point slave to master (Host, User, Log File, Log Position).

### 3. Verification
- [ ] Start slave process.
- [ ] Check slave status (\`Seconds_Behind_Master\` should be 0).
- [ ] Test replication by writing to Master and reading from Slave.
`;
        const newText =
            editorContent.substring(0, start) +
            checkText +
            editorContent.substring(end);
        setEditorContent(newText);
        cursorPositionRef.current = start + checkText.length;
    }
};
