export function buildJiraDesignStoryTemplate(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  return `## JIRA-DS: [Project Name] - Software Design Phase
**Status:** DRAFT | **Date:** ${dateStr}

### User Story Title: Design [Component/Feature Name] architecture and UI/UX

---

### 1. Goal & Context
**As a** System Architect / Senior Developer,
**I want to** define the technical architecture and user experience for [Feature Name],
**So that** the development team has a clear, scalable, and approved blueprint to implement.

**Background:**
[Briefly explain why this design is needed and what problem it solves.]

---

### 2. Design Requirements

#### 2.1 Technical Architecture
- [ ] Define data models and schema changes.
- [ ] Specify API endpoints (REST/GraphQL).
- [ ] Identify necessary third-party integrations or microservices.
- [ ] Security considerations (Auth, Encryption, Permissions).

#### 2.2 UI/UX Specifications
- [ ] Design wireframes/mockups for all core states (Loading, Empty, Success, Error).
- [ ] Define user interaction flows.
- [ ] ensure Accessibility (WCAG 2.1) compliance.

---

### 3. Non-Functional Requirements
- **Performance:** Target response time < [X]ms.
- **Scalability:** Must support up to [Y] concurrent users.
- **Maintainability:** Code must follow [Standard] patterns.

---

### 4. Acceptance Criteria
- [ ] Technical Design Document (TDD) completed and reviewed.
- [ ] UI Mockups approved by Product Owner.
- [ ] Data migration strategy defined (if applicable).
- [ ] Development effort estimated (Story Points).

---

### 5. Notes & Diagrams
[Insert Mermaid or UML diagrams here to visualize the design]

\`\`\`mermaid
graph TD
    A[User] --> B[Interface]
    B --> C[API Layer]
    C --> D[Database]
\`\`\`
`;
}
