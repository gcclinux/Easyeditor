import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const saveAsPDF = async (elementId: string) => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      alert(`Element with id "${elementId}" not found`);
      return;
    }

    // Show loading state if possible
    document.body.style.cursor = 'wait';

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.getElementById(elementId);
        if (clonedElement) {
          clonedElement.style.height = 'auto';
          clonedElement.style.maxHeight = 'none';
          clonedElement.style.overflow = 'visible';
          clonedElement.style.width = '100%';
          clonedElement.style.maxWidth = 'none';
          clonedElement.style.margin = '0';
          clonedElement.style.flex = 'none';

          const body = clonedDoc.body;
          if (body) {
            body.style.height = 'auto';
            body.style.overflow = 'visible';
          }
        }
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const imgWidth = 210; // A4 width
    const pageHeight = 297; // A4 height
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');

        const filePath = await save({
          defaultPath: 'easyeditor.pdf',
          filters: [{
            name: 'PDF Document',
            extensions: ['pdf']
          }]
        });

        if (filePath) {
          const pdfOutput = pdf.output('arraybuffer');
          const binaryData = new Uint8Array(pdfOutput);
          await writeFile(filePath, binaryData);
          console.log('PDF saved successfully to:', filePath);
        }
      } catch (tauriError) {
        console.error('Tauri save failed:', tauriError);
        alert('Failed to save via Tauri: ' + tauriError);
      }
    } else {
      pdf.save('easyeditor.pdf');
    }

    document.body.style.cursor = 'default';

  } catch (err) {
    console.error('Error generating PDF:', err);
    alert('Failed to generate PDF');
    document.body.style.cursor = 'default';
  }
};