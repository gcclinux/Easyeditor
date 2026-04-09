export function buildKatexExampleTemplate() {
  return `## KaTeX Mathematical Notation Example

EasyEditor supports high-quality mathematical typesetting using KaTeX. Below are some examples of what you can do:

### Inline Mathematics
Use single dollar signs for inline math: $E = mc^2$ or $\\sqrt{a^2 + b^2} = c$.

### Block Mathematics
Use double dollar signs for block math:

$$
\\phi = \\frac{1 + \\sqrt{5}}{2}
$$

### Complex Equations

**The Quadratic Formula:**
$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

**Maxwell's Equations:**
$$
\\begin{aligned}
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\epsilon_0} \\\\
\\nabla \\cdot \\mathbf{B} &= 0 \\\\
\\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t} \\\\
\\nabla \\times \\mathbf{B} &= \\mu_0\\left(\\mathbf{J} + \\epsilon_0\\frac{\\partial \\mathbf{E}}{\\partial t}\\right)
\\end{aligned}
$$

**Matrix Example:**
$$
\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}
\\begin{pmatrix}
x \\\\
y
\\end{pmatrix}
=
\\begin{pmatrix}
ax + by \\\\
cx + dy
\\end{pmatrix}
$$

### Statistics & Notation
Summation: $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$

Integrals: $\\int_{a}^{b} x^2 dx = \\left[ \\frac{x^3}{3} \\right]_{a}^{b} = \\frac{b^3 - a^3}{3}$

EasyEditor makes it simple to document technical specifications and scientific notes.
`;
}
