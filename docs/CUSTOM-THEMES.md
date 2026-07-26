# Creating and Installing Custom Themes

EasyEditor now supports user-installable custom themes! You can create your own themes or install themes shared by others without rebuilding the app.

## Built-in Themes

EasyEditor includes 6 built-in themes:

1. **Default** - Original dark theme with purple/gray
2. **Ocean Blue** - Cool blue theme
3. **Sunset Orange** - Warm orange theme
4. **Jade Green** - Natural green theme
5. **Dark High Contrast** - High contrast black/white/bright with yellow borders
6. **Black & White** - Pure black and white with 3px borders

## How to Install a Custom Theme

1. **Open EasyEditor**
2. Click **File** → **Select Theme**
3. Click **Import Custom Theme** button
4. Fill in the form:
   - **Theme Name**: Give your theme a name (e.g., "Midnight Blue")
   - **Description**: Brief description (e.g., "Dark blue theme")
   - **Theme CSS Code**: Paste the complete theme CSS (see format below)
   - Or click **Choose File** to upload a .css file
5. Click **Import Theme**

Your custom theme is now installed and will appear in the theme selector!

## Creating Your Own Theme

### Step 1: Copy a Base Theme

Start by copying one of the existing themes from `src/themes/` as a template. For example, copy `default.css`.

### Step 2: Modify Colors

Edit the CSS variables in the `:root` section. Focus on these main areas:

```css
:root {
  /* Main background */
  --bg-root: #1a1a1a;
  
  /* Editor panel */
  --bg-editor: #000000;
  --color-text-editor: #ffffff;
  
  /* Buttons */
  --btn-menu-gradient-start: #374151;
  --btn-menu-gradient-end: #1f2937;
  --btn-mermaid-gradient-start: #667eea;
  --btn-mermaid-gradient-end: #764ba2;
  
  /* ... and so on */
}
```

### Step 3: Test Your Theme

Copy the entire CSS content and import it through the app (File → Select Theme → Import Custom Theme).

## Theme Template

Here's a minimal theme template you can use:

```css
:root {
  /* MAIN APPLICATION BACKGROUND */
  --bg-root: #1a1a1a;

  /* FILE BUTTON */
  --btn-help-bg: #d9f7d9;
  --btn-help-text: #063b09;
  --btn-help-border: #063b09;

  /* TOP BUTTON ROW */
  --btn-menu-gradient-start: #374151;
  --btn-menu-gradient-end: #1f2937;
  --btn-menu-hover-gradient-start: #4b5563;
  --btn-menu-hover-gradient-end: #374151;
  --color-text-button: white;
  --btn-menu-border: none;  /* or "2px solid #color" for visible borders */

  /* LOWER BUTTON ROW */
  --btn-mermaid-gradient-start: #667eea;
  --btn-mermaid-gradient-end: #764ba2;
  --btn-mermaid-hover-gradient-start: #764ba2;
  --btn-mermaid-hover-gradient-end: #667eea;

  /* EDITOR PANEL */
  --bg-editor: #000000;
  --color-text-editor: white;
  --border-primary: #ccc;

  /* PREVIEW PANEL */
  --bg-preview: #ffffff;
  --color-text-preview: #ffffff;
  --bg-code-block: #e3e3e3;
  --color-text-code: #000000;
  --bg-table-header: #f2f2f2;
  --border-dark: #000000;

  /* DROPDOWN MENUS */
  --bg-dropdown: #2d2d2d;
  --bg-dropdown-hover: #3d3d3d;
  --color-text-dropdown: white;
  --color-text-light: #cfcfcf;
  --border-secondary: #3d3d3d;
  --separator-gradient-start: rgba(255, 255, 255, 0.02);
  --separator-gradient-end: rgba(255, 255, 255, 0.06);

  /* MODALS */
  --bg-modal: #1e1e1e;
  --bg-modal-overlay: rgba(0, 0, 0, 0.5);
  --color-text-primary: white;
  --color-text-muted: #bdbdbd;
  --color-text-muted-dark: #9a9a9a;
  --bg-card: rgba(255, 255, 255, 0.02);
  --border-card: rgba(255, 255, 255, 0.12);
  --border-card-light: rgba(255, 255, 255, 0.08);
  --btn-primary-modal: #0b84ff;
  --btn-primary-modal-text: #ffffff;  /* button text color */
  --btn-cancel: #555;
  --btn-submit: #007bff;

  /* INPUT FIELDS */
  --bg-input: #2d2d2d;
  --border-input: #555;
  --btn-primary: #0078d4;

  /* CONTEXT MENU */
  --context-menu-bg: white;
  --context-menu-border: #ccc;
  --context-menu-hover: #f5f5f5;
  --context-menu-shadow: rgba(0, 0, 0, 0.2);

  /* SHADOWS & EFFECTS */
  --shadow-sm: rgba(0, 0, 0, 0.1);
  --shadow-md: rgba(0, 0, 0, 0.15);
  --shadow-lg: rgba(0, 0, 0, 0.2);
  --shadow-xl: rgba(0, 0, 0, 0.25);

  /* LINKS & FOCUS */
  --link-color: #646cff;
  --link-hover: #535bf2;
  --link-hover-light: #747bff;
  --focus-ring: -webkit-focus-ring-color;
  --focus-border: #646cff;

  /* LEGACY/MISC */
  --color-primary: #242424;
  --color-primary-light: #2d2d2d;
  --color-primary-dark: #1e1e1e;
  --color-primary-darker: #1a1a1a;
  --color-primary-border: #3d3d3d;
  --color-text-secondary: rgba(255, 255, 255, 0.87);
  --color-text-dark: #000000;
  --btn-standard: purple;
  --btn-standard-hover: #575757;
  --btn-auto: rgb(139, 48, 192);
  --btn-html: rgb(136, 116, 248);
  --btn-format: rgb(30, 68, 38);
  --shadow-mermaid: rgba(6, 182, 212, 0.3);
}
```

## Sharing Your Theme

To share your theme with others:

1. Open your theme in the theme selector
2. Copy the CSS code you used to create it
3. Share the CSS code (via file, gist, pastebin, etc.)
4. Others can import it using File → Select Theme → Import Custom Theme

## Managing Custom Themes

- **View**: File → Select Theme (custom themes appear alongside built-in themes)
- **Delete**: Click the trash icon on any custom theme card
- **Switch**: Click any theme card to activate it

## Advanced: Custom Border Widths

By default, editor and preview panels use 1px borders. To override with thicker borders (like the Black & White theme), add this at the end of your theme CSS:

```css
.textarea-horizontal-full,
.textarea-parallel,
.textarea-horizontal {
  border: 3px solid var(--border-primary) !important;
}

.preview-horizontal-full,
.preview-parallel,
.preview-horizontal {
  border: 3px solid var(--border-dark) !important;
}
```

## Tips

1. **Start Simple**: Begin with a built-in theme and change a few colors
2. **Test Frequently**: Import and test your theme as you make changes
3. **Use Color Tools**: Use color palette generators like coolors.co
4. **Check Contrast**: Ensure text is readable on backgrounds
5. **Save Backups**: Keep a copy of your theme CSS in a text file
6. **Upload Files**: You can upload .css files directly instead of pasting code

## Troubleshooting

**Theme doesn't apply:**
- Ensure your CSS includes `:root {` and `}`
- Check that variable names start with `--`
- Verify all required variables are defined

**Colors look wrong:**
- Check color format (hex, rgb, rgba)
- Ensure no typos in variable names
- Test with a simpler theme first

**Theme disappeared:**
- Custom themes are stored in browser localStorage
- Clearing browser data will remove custom themes
- Keep backups of your theme CSS

## Example: Creating a "Neon Pink" Theme

```css
:root {
  --bg-root: #1a0a1a;
  --bg-editor: #0a0005;
  --color-text-editor: #ff69b4;
  --btn-menu-gradient-start: #ff1493;
  --btn-menu-gradient-end: #c71585;
  --btn-mermaid-gradient-start: #ff69b4;
  --btn-mermaid-gradient-end: #ff1493;
  /* ... copy remaining variables from template ... */
}
```

Import this through the app and you'll have a neon pink theme!

## Community Themes

Share your themes in the EasyEditor discussions:
https://github.com/gcclinux/EasyEditor/discussions

Tag your posts with `#custom-theme` to help others find them!
