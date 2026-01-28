import { FaFileImport } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';

type Props = {
  onAutoTable: () => void;
  onAutoGantt: () => void;
  onAutoTimeline: () => void;
  onImportMD: () => void;
  onClose: () => void;
};

export default function AutoDropdown({
  onAutoTable,
  onAutoGantt,
  onAutoTimeline,
  onImportMD,
  onClose
}: Props) {
  const { t } = useLanguage();

  return (
    <div className="header-dropdown format-dropdown">
      <button className="dropdown-item" onClick={() => { onAutoTable(); onClose(); }}>
        <div className="hdr-title">{t('auto_generate.table')}</div>
        <div className="hdr-desc"><em>{t('auto_generate.table_desc')}</em></div>
        <div className="hdr-sep" />
      </button>
      <button className="dropdown-item" onClick={() => { onAutoGantt(); onClose(); }}>
        <div className="hdr-title">{t('auto_generate.gantt')}</div>
        <div className="hdr-desc"><em>{t('auto_generate.gantt_desc')}</em></div>
        <div className="hdr-sep" />
      </button>
      <button className="dropdown-item" onClick={() => { onAutoTimeline(); onClose(); }}>
        <div className="hdr-title">{t('auto_generate.timeline')}</div>
        <div className="hdr-desc"><em>{t('auto_generate.timeline_desc')}</em></div>
        <div className="hdr-sep" />
      </button>
      <button className="dropdown-item" onClick={() => { onImportMD(); onClose(); }}>
        <div className="hdr-title"><FaFileImport style={{ marginRight: '5px' }} /> {t('templates.import_md') || 'Import MD'}</div>
        <div className="hdr-desc"><em>{t('templates.import_md_desc') || 'Import Markdown from URL'}</em></div>
        <div className="hdr-sep" />
      </button>
    </div>
  );
}
