export function buildKanbanDiagramTemplate(): string {
    return `
\`\`\`mermaid
kanban
  Todo
    [Create new feature]
    [Update documentation]
    [Fix login bug]
  In Progress
    [Refactor database]
    [Design homepage]
  Ready to Test
    [User profile page]
    [API authentication]
  Ready to Deploy
    [Landing page]
    [Email notifications]
  Done
    [Project setup]
    [Initial commit]
  Blocked
    [Third-party integration]
    [Waiting for design assets]
\`\`\`
`;
}
