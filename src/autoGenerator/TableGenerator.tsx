import React, { useState } from 'react';
import { FaTable, FaTimes, FaCheck } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './autoGenerator.css';

interface TableGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (tableText: string) => void;
}

export const TableGenerator: React.FC<TableGeneratorProps> = ({ isOpen, onClose, onInsert }) => {
  const { t } = useLanguage();

  // Grid hover tracking
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);

  // Selected dimensions and custom headers
  const [selectedSize, setSelectedSize] = useState<{ rows: number; cols: number } | null>(null);
  const [customHeaders, setCustomHeaders] = useState<string[]>([]);

  // Maximum grid size
  const maxRows = 10;
  const maxCols = 10;

  const createTable = (rows: number, cols: number, headers: string[]) => {
    let table = '|' + headers.join(' | ') + '|\n';

    // Default left alignment
    const alignments = Array(cols).fill(':---');
    table += '|' + alignments.join(' | ') + '|\n';

    // Generate empty cells
    for (let i = 0; i < rows; i++) {
      table += '|' + Array(cols).fill('Cell').join(' | ') + '|\n';
    }

    return table;
  };

  const handleCellClick = (r: number, c: number) => {
    setSelectedSize({ rows: r, cols: c });

    // Preserve existing header names if resizing
    const newHeaders = Array.from({ length: c }).map((_, i) => {
      return i < customHeaders.length ? customHeaders[i] : `Header ${i + 1}`;
    });
    setCustomHeaders(newHeaders);
  };

  const handleInsert = () => {
    if (selectedSize) {
      onInsert(createTable(selectedSize.rows, selectedSize.cols, customHeaders));
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedSize(null);
    setCustomHeaders([]);
    setHoverRow(0);
    setHoverCol(0);
    onClose();
  };

  const handleHeaderChange = (index: number, value: string) => {
    const newHeaders = [...customHeaders];
    while (newHeaders.length <= index) {
      newHeaders.push(`Header ${newHeaders.length + 1}`);
    }
    newHeaders[index] = value;
    setCustomHeaders(newHeaders);
  };

  // Determine what grid cell is active. Either the current mouse hover, OR the locked selectedSize
  const getIsActive = (r: number, c: number) => {
    if (hoverRow > 0 || hoverCol > 0) {
      // User is actively hovering
      return r <= hoverRow && c <= hoverCol;
    }
    if (selectedSize) {
      // Fall back to locked selection
      return r <= selectedSize.rows && c <= selectedSize.cols;
    }
    return false;
  };

  const activeCols = hoverCol > 0 ? hoverCol : (selectedSize ? selectedSize.cols : 0);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content auto-modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          <FaTable /> {t('auto_generate.table')}
        </h2>

        <div className="table-split-container">
          {/* --- LEFT COLUMN: GRID SELECTION --- */}
          <div className="table-left-column">
            <div className="table-grid-container" onMouseLeave={() => { setHoverRow(0); setHoverCol(0); }}>
              {Array.from({ length: maxRows }).map((_, rIndex) => {
                const r = rIndex + 1;
                return Array.from({ length: maxCols }).map((_, cIndex) => {
                  const c = cIndex + 1;
                  const isActive = getIsActive(r, c);

                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`table-grid-cell ${isActive ? 'active' : ''}`}
                      onMouseEnter={() => {
                        setHoverRow(r);
                        setHoverCol(c);
                      }}
                      onClick={() => handleCellClick(r, c)}
                    />
                  );
                });
              })}
            </div>

            <div className="table-grid-dimensions">
              {(hoverRow > 0 || hoverCol > 0)
                ? `${hoverCol} x ${hoverRow}`
                : (selectedSize ? `${selectedSize.cols} x ${selectedSize.rows}` : `${t('auto_generate.table_desc')}`)
              }
            </div>
          </div>

          {/* --- RIGHT COLUMN: HEADER EDITING --- */}
          <div className="table-right-column">
            {activeCols === 0 ? (
              <p style={{ marginTop: '20px', color: 'var(--color-text-secondary)' }}>
                Select table dimensions on the left and then update the column header names as required.
              </p>
            ) : (
              <div className="header-edit-container">
                <div className="header-inputs-list">
                  {Array.from({ length: activeCols }).map((_, index) => {
                    const headerValue = index < customHeaders.length ? customHeaders[index] : `Header ${index + 1}`;
                    return (
                      <div key={index} className="header-input-row">
                        <input
                          type="text"
                          value={headerValue}
                          onChange={(e) => handleHeaderChange(index, e.target.value)}
                          placeholder={`Column ${index + 1}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '20px', justifyContent: 'flex-end', display: 'flex', width: '100%', gap: '10px' }}>
          <button className="modal-button cancel-button" onClick={handleClose}>
            <FaTimes /> {t('actions.cancel')}
          </button>
          <button
            className="modal-button confirm-button"
            onClick={handleInsert}
            disabled={!selectedSize}
            style={{ opacity: !selectedSize ? 0.5 : 1, cursor: !selectedSize ? 'not-allowed' : 'pointer' }}
          >
            <FaCheck /> {t('auto_generate.insert')}
          </button>
        </div>

      </div>
    </div>
  );
};