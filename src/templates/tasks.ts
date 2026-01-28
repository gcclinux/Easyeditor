export type TaskTemplate = {
  id: string;
  label: string;
  markdown: string;
  description: string;
};

export const taskTemplates: TaskTemplate[] = [
  {
    id: 'basic',
    label: 'Basic Task List',
    markdown: '- [ ] This item is unchecked\n- [x] This item is checked',
    description: 'Simple checked/unchecked items',
  },
  {
    id: 'project',
    label: 'Project Tasks',
    markdown:
      '## Project Tasks\n\n- [ ] Define requirements\n- [ ] Create wireframes\n- [ ] Develop features\n- [ ] Testing\n- [ ] Deployment',
    description: 'Project management template',
  },
  {
    id: 'daily',
    label: 'Daily Checklist',
    markdown:
      '### Daily Tasks\n\n- [ ] Morning routine\n- [ ] Check emails\n- [ ] Important meetings\n- [ ] Review progress\n- [ ] Plan tomorrow',
    description: 'Daily productivity template',
  },
  {
    id: 'shopping',
    label: 'Shopping List',
    markdown:
      '### Shopping List\n\n- [ ] Groceries\n  - [ ] Milk\n  - [ ] Bread\n  - [ ] Eggs\n- [ ] Household items\n  - [ ] Soap\n  - [ ] Paper towels',
    description: 'Nested shopping list',
  },
  {
    id: 'study',
    label: 'Study Checklist',
    markdown:
      '### Study Plan\n\n- [ ] Read chapter 1\n- [ ] Take notes\n- [ ] Practice exercises\n- [ ] Review concepts\n- [ ] Prepare for quiz',
    description: 'Academic study template',
  },
  {
    id: 'release',
    label: 'Release Checklist',
    markdown:
      '### 🚀 Release v1.0.0\n- [ ] Run test suite\n- [ ] Update version numbers\n- [ ] Update CHANGELOG.md\n- [ ] Build production assets\n- [ ] Deploy to staging\n- [ ] Verify functionality\n- [ ] Deploy to production',
    description: 'Deployment steps',
  },
  {
    id: 'content',
    label: 'Content Publishing',
    markdown:
      '### ✍️ Content Publishing\n- [ ] Topic research & Keywords\n- [ ] Create detailed outline\n- [ ] Write first draft\n- [ ] Add images & Alt text\n- [ ] Proofread & Grammar check\n- [ ] SEO Optimization\n- [ ] Publish & Share',
    description: 'Blog post checklist',
  },
  {
    id: 'review',
    label: 'Code Review',
    markdown:
      '### 🔍 Code Review\n- [ ] Functionality works as expected\n- [ ] Edge cases handled\n- [ ] Tests added and passing\n- [ ] Code style & Formatting\n- [ ] No hardcoded secrets/keys\n- [ ] Documentation updated',
    description: 'Quality assurance checklist',
  },
  {
    id: 'habits',
    label: 'Weekly Habits',
    markdown:
      '### 📅 Weekly Habits\n**Exercise**\n- [ ] Mon - [ ] Tue - [ ] Wed - [ ] Thu - [ ] Fri - [ ] Sat - [ ] Sun\n**Reading (30m)**\n- [ ] Mon - [ ] Tue - [ ] Wed - [ ] Thu - [ ] Fri - [ ] Sat - [ ] Sun',
    description: 'Track recurring habits',
  },
];

export default taskTemplates;
