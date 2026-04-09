export function buildGenericUserStoryTemplate() {
  return `## User Story: [Title]

### Summary
**As a** [type of user],
**I want** [to perform some action],
**so that** [I can achieve some goal/value].

---

### Acceptance Criteria
- [ ] **Scenario 1:** [Given-When-Then]
- [ ] **Scenario 2:** [Given-When-Then]
- [ ] [Requirement 3]

---

### Technical Notes
- **Impacted Areas:** [List of components/services affected]
- **Dependencies:** [Any other stories or external blockers]
- **Data Requirements:** [New fields, API changes]

---

### Implementation Tasks
- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Final Quality Check]

---

### Design/UI Ref
[Link to design or description of UI changes]

---

### Progress Tracker
- [x] Discovery & Research
- [ ] Design / Prototype
- [ ] Coding
- [ ] Testing
- [ ] Deployment
`;
}
