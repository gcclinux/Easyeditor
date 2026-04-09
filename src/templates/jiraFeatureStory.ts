export function buildJiraFeatureStoryTemplate(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0];
  return `## JIRA-FEAT: [Feature Name] Implementation
**Priority:** MEDIUM | **Date:** ${dateStr}

### User Story
**As a** [User Persona],
**I want to** [Action/Capability],
**So that** [Value/Benefit].

---

### 1. Description & Context
[Provide a clear description of the feature and the problem it addresses.]

**Business Value:**
[Why are we building this? Competitive advantage, churn reduction, productivity, etc.]

---

### 2. Functional Requirements
- [ ] Feature capability 1
- [ ] Feature capability 2
- [ ] Edge case handling (e.g. offline mode, invalid input)

---

### 3. Acceptance Criteria
- [ ] GIVEN [Initial State], WHEN [Action], THEN [Expected Result].
- [ ] GIVEN [Another State], WHEN [Another Action], THEN [Another Result].
- [ ] Unit tests cover all core logic.
- [ ] Integration testing completed in STAGE environment.

---

### 4. Technical Tasks
- [ ] Frontend implementation (UI Components).
- [ ] Backend logic & API updates.
- [ ] Database schema updates.
- [ ] Documentation update.

---

### 5. Definition of Done (DoD)
- [ ] Code reviewed by peer.
- [ ] CI/CD pipeline passes.
- [ ] Documentation updated in Confluence/Wiki.
- [ ] Feature flagged (if required).

---

### 6. Attachments & Mockups
[Link to Figma/Mockups or insert screenshots]

`;
}
