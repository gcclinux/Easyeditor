import html2canvas from 'html2canvas';

// Helper to convert data URL to Uint8Array
const dataURLToUint8Array = (dataURL: string): Uint8Array => {
    const base64String = dataURL.split(',')[1];
    const binaryString = atob(base64String);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

export const saveAsPNG = async (elementId: string, fileName: string = 'easyeditor') => {
    const element = document.getElementById(elementId);

    if (!element) {
        const msg = `Element with id "${elementId}" not found. Please try again.`;
        console.error(msg);
        alert(msg);
        return;
    }

    try {
        const canvas = await html2canvas(element, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff', // Set white background as requested
            scale: 2, // Higher resolution
            logging: true,
            // Ensure we capture the full scroll dimensions
            width: element.scrollWidth,
            height: element.scrollHeight,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            onclone: (clonedDoc) => {
                const clonedElement = clonedDoc.getElementById(elementId);
                if (clonedElement) {
                    // Force the cloned element to expand to full content size
                    clonedElement.style.height = 'auto';
                    clonedElement.style.maxHeight = 'none';
                    clonedElement.style.overflow = 'visible';
                    // Ensure the cloned element fills the canvas width (overriding split-view widths like 49%)
                    clonedElement.style.width = '100%';
                    clonedElement.style.maxWidth = 'none';
                    clonedElement.style.margin = '0';
                    clonedElement.style.flex = 'none';

                    // Force all text to black for readability (background is white)
                    clonedElement.style.color = '#000000';
                    const allElements = clonedElement.querySelectorAll('*');
                    allElements.forEach((el) => {
                        const htmlEl = el as HTMLElement;
                        htmlEl.style.color = '#000000';
                        // Also fix border colors that may be invisible on white
                        htmlEl.style.borderColor = '#cccccc';
                    });

                    // Also ensure body/html in clone can accommodate it
                    const body = clonedDoc.body;
                    if (body) {
                        body.style.height = 'auto';
                        body.style.overflow = 'visible';
                    }
                }
            }
        });

        const dataUrl = canvas.toDataURL('image/png');
        const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

        if (isTauri) {
            try {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeFile } = await import('@tauri-apps/plugin-fs');

                const filePath = await save({
                    defaultPath: `${fileName}.png`,
                    filters: [{
                        name: 'PNG Image',
                        extensions: ['png']
                    }]
                });

                if (filePath) {
                    const binaryData = dataURLToUint8Array(dataUrl);
                    await writeFile(filePath, binaryData);
                    console.log('PNG saved successfully to:', filePath);
                }
            } catch (tauriError) {
                console.error('Tauri save failed:', tauriError);
                alert('Failed to save via Tauri: ' + tauriError);
            }
        } else {
            // Web fallback
            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

    } catch (error) {
        console.error('Error generating PNG:', error);
        alert('Failed to generate PNG. See console for details.');
    }
};
