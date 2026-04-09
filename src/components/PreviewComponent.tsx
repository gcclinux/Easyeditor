import React, { useEffect, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import nomnoml from 'nomnoml';

import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface PreviewComponentProps {
  previewRef: React.RefObject<HTMLDivElement | null>;
  editorContent: string;
  isPreviewFull: boolean;
  isHorizontal: boolean;
  initializeMermaid: () => void;
  plainTextPreview?: boolean;
  currentFilePath?: string | null;
  currentDirHandle?: any;
}

const PreviewComponent: React.FC<PreviewComponentProps> = React.memo(({
  previewRef,
  editorContent,
  isPreviewFull,
  isHorizontal,
  initializeMermaid,
  plainTextPreview,
  currentFilePath,
  currentDirHandle
}) => {
  // Custom remark plugin to preserve blank lines between list items
  const preserveListBreaks = () => {
    return (tree: any) => {
      const visit = (node: any, parent: any, index: number) => {
        if (node.type === 'listItem' && node.position && index > 0) {
          const currentLine = node.position.start.line;
          const prevSibling = parent.children[index - 1];

          if (prevSibling && prevSibling.position) {
            const prevLine = prevSibling.position.end.line;
            if (currentLine - prevLine > 1) {
              node.data = node.data || {};
              node.data.hProperties = node.data.hProperties || {};
              node.data.hProperties.className = 'list-break';
            }
          }
        }

        // Also check if this is a list following a nested list
        if (node.type === 'list' && node.position && parent && parent.type === 'root') {
          const currentLine = node.position.start.line;
          const prevSibling = parent.children[index - 1];

          if (prevSibling && prevSibling.position) {
            const prevLine = prevSibling.position.end.line;
            if (currentLine - prevLine > 1 && node.children && node.children[0]) {
              node.children[0].data = node.children[0].data || {};
              node.children[0].data.hProperties = node.children[0].data.hProperties || {};
              node.children[0].data.hProperties.className = 'list-break';
            }
          }
        }

        if (node.children) {
          node.children.forEach((child: any, i: number) => visit(child, node, i));
        }
      };

      visit(tree, null, 0);
    };
  };

  // Effect for view mode changes
  useEffect(() => {
    const reinitializeMermaid = async () => {
      try {
        // Reset mermaid
        mermaid.initialize({ startOnLoad: true });
        // Clear any existing diagrams
        document.querySelectorAll('.mermaid').forEach(node => {
          node.removeAttribute('data-processed');
        });
        // Force re-render
        await mermaid.init();
        initializeMermaid();
      } catch (error) {
        console.error('Mermaid initialization failed:', error);
      }
    };

    const timer = setTimeout(reinitializeMermaid, 100);
    return () => clearTimeout(timer);
  }, [isPreviewFull, isHorizontal, initializeMermaid]);

  // Effect for content changes
  useEffect(() => {
    const timer = setTimeout(() => {
      mermaid.initialize({ startOnLoad: true });
      initializeMermaid();
    }, 100);
    return () => clearTimeout(timer);
  }, [editorContent, initializeMermaid]);

  useEffect(() => {
    if (!previewRef.current) return;

    const observer = new MutationObserver(() => {
      if (previewRef.current) {
        setTimeout(() => {
          previewRef.current!.scrollTop = previewRef.current!.scrollHeight;
        }, 100);
      }
    });

    observer.observe(previewRef.current, {
      childList: true,
      subtree: true,
      attributes: true
    });

    setTimeout(() => {
      if (previewRef.current) {
        previewRef.current.scrollTop = previewRef.current.scrollHeight;
      }
    }, 100);

    return () => observer.disconnect();
  }, [editorContent]);

  return (
    <div
      className={
        isPreviewFull
          ? 'preview-horizontal-full'
          : isHorizontal
            ? 'preview-horizontal'
            : 'preview-parallel'
      }
      ref={previewRef}
      id="preview-content"
    >
      {plainTextPreview ? (
        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', margin: 0, fontFamily: 'monospace', padding: '1em' }}>
          {editorContent}
        </pre>
      ) : (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkEmoji, remarkMath, preserveListBreaks]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        urlTransform={(url: string) => {
          if (url.startsWith('data:image/')) return url;
          if (url.startsWith('blob:')) return url;
          return defaultUrlTransform(url);
        }}
        components={{
          img(props) {
            const AsyncImage = ({ src, alt, style, ...rest }: any) => {
              const [resolvedSrc, setResolvedSrc] = useState(src);
            
              useEffect(() => {
                let objectUrl = '';
            
                const resolveImg = async () => {
                  if (!src || src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('tauri://') || src.startsWith('asset://')) {
                    return;
                  }
            
                  // Check if running in Tauri
                  const isTauri = typeof window !== 'undefined' && ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);
            
                  if (isTauri && currentFilePath) {
                    try {
                      // Use plugin-fs to read file and create object URL, bypassing assetScopes
                      const { readFile } = await import('@tauri-apps/plugin-fs');
                      // currentFilePath is usually absolute. e.g. /home/user/repo/docs/README.md
                      const dirPath = currentFilePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
                      
                      let cleanSrc = src;
                      let absolutePath = '';
                      
                      if (cleanSrc.startsWith('./')) {
                        absolutePath = `${dirPath}/${cleanSrc.substring(2)}`;
                      } else if (cleanSrc.startsWith('../')) {
                        const parts = dirPath.split('/');
                        const srcParts = cleanSrc.split('/');
                        for(let p of srcParts) {
                            if (p === '..') parts.pop();
                            else if (p !== '.') parts.push(p);
                        }
                        absolutePath = parts.join('/');
                      } else {
                        absolutePath = `${dirPath}/${cleanSrc}`;
                      }
                      
                      const fileData = await readFile(absolutePath);
                      const blob = new Blob([fileData]);
                      objectUrl = URL.createObjectURL(blob);
                      setResolvedSrc(objectUrl);
                    } catch (e) {
                      console.error('Failed to load Tauri fs core for image resolution:', e);
                    }
                    return;
                  }
            
                  // Check Web with File System Access API
                  if (!isTauri && currentDirHandle && currentFilePath) {
                    try {
                      // Attempt to traverse from currentDirHandle directly, assuming src is relative to current file
                      const getFileHandleFromPath = async (dirHandle: any, path: string) => {
                         const parts = path.split('/').filter(p => p && p !== '.');
                         let currentHandle = dirHandle;
                         for (let i = 0; i < parts.length - 1; i++) {
                            if (parts[i] === '..') throw new Error("Parent traversal not fully supported without root handle.");
                            currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
                         }
                         const fileName = parts[parts.length - 1];
                         return await currentHandle.getFileHandle(fileName);
                      };
            
                      // We need the relative path from the dirHandle
                      // If currentFilePath is a relative path starting from dirHandle's root
                      const dirPath = currentFilePath.split(/[/\\]/).slice(0, -1).join('/');
                      let fetchPath = dirPath ? `${dirPath}/${src}` : src;
                      
                      // Normalize fetchPath relative to dirHandle
                      const fetchParts = fetchPath.split('/');
                      const normalizedParts = [];
                      for (const p of fetchParts) {
                         if (p === '..') normalizedParts.pop();
                         else if (p !== '.' && p) normalizedParts.push(p);
                      }
                      fetchPath = normalizedParts.join('/');
            
                      const fileHandle = await getFileHandleFromPath(currentDirHandle, fetchPath);
                      const file = await fileHandle.getFile();
                      objectUrl = URL.createObjectURL(file);
                      setResolvedSrc(objectUrl);
            
                    } catch(e) {
                      console.warn('Failed to resolve web local image:', e);
                    }
                  }
                };
            
                resolveImg();
            
                return () => {
                  if (objectUrl) URL.revokeObjectURL(objectUrl);
                };
              }, [src]);
            
              return <img src={resolvedSrc} alt={alt} style={{ maxWidth: '100%', ...(style as React.CSSProperties) }} {...rest} />;
            };
            
            return <AsyncImage {...props} />;
          },
          li({ children, className }) {
            return <li className={className}>{children}</li>;
          },
          code(_props) {
            const { className, children, ...props } = _props as any;
            const isInlineFlag = (_props as any)?.inline as boolean | undefined;
            const isMermaid = /language-mermaid/.test(className || "");
            const isPlantUML = /language-plantuml/.test(className || "");

            if (isMermaid) {
              return (
                <div className="mermaid">
                  {String(children).replace(/\n$/, "")}
                </div>
              );
            }

            if (isPlantUML) {
              const umlCode = String(children).replace(/\n$/, "");

              // Render nomnoml diagram offline
              try {
                const svg = nomnoml.renderSvg(umlCode);

                return (
                  <div
                    className="plantuml-diagram"
                    style={{ textAlign: 'center', margin: '1em 0' }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                );
              } catch (error) {
                // If rendering fails, show the code with error message
                return (
                  <div className="plantuml-diagram" style={{ textAlign: 'center', margin: '1em 0', color: 'red' }}>
                    <p>Error rendering UML diagram:</p>
                    <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
                      {String(error)}
                    </pre>
                    <details style={{ marginTop: '10px' }}>
                      <summary style={{ cursor: 'pointer' }}>View source code</summary>
                      <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
                        {umlCode}
                      </pre>
                    </details>
                  </div>
                );
              }
            }

            // ReactMarkdown provides `inline` flag to distinguish inline vs fenced code
            const isInline = !!isInlineFlag;

            return (
              <code
                className={`${isInline ? 'inline-code' : 'code-block'} ${className || ''}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children, node }) {
            // Check if paragraph contains box-drawing characters
            const flatten = (nodes: any): string => {
              if (!nodes) return '';
              const arr = Array.isArray(nodes) ? nodes : [nodes];
              return arr
                .map((n) => {
                  if (typeof n === 'string') return n;
                  // @ts-ignore
                  if (n && n.props && n.props.children) return flatten(n.props.children as any);
                  return '';
                })
                .join('');
            };

            const text = flatten(children);
            const hasBoxChars = /[\u2500-\u257F]/.test(text);

            // If it has box-drawing chars, get the original text from the node to preserve whitespace
            if (hasBoxChars && node && node.position) {
              // Extract original text from markdown source
              let originalText = editorContent.substring(
                node.position.start.offset || 0,
                node.position.end.offset || editorContent.length
              );
              // Decode HTML entities to render symbols
              const textarea = document.createElement('textarea');
              textarea.innerHTML = originalText;
              originalText = textarea.value;
              return <pre className="ascii-art">{originalText}</pre>;
            }

            return <p>{children}</p>;
          },
          pre({ children }) {
            return (
              <pre className="code-block-container">
                {children}
              </pre>
            );
          }
        }}
      >
        {editorContent}
      </ReactMarkdown>
      )}
    </div >
  );
});

export default PreviewComponent;