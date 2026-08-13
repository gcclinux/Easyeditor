import { useState, useEffect } from 'react';
import { FaCloudUploadAlt, FaFolderOpen, FaExchangeAlt, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import { cloudManager } from '../cloud/managers/CloudManager';
import { openDirectoryDialog, readDirectory, readFileContent, writeTauriFile } from '../tauriFileHandler';
import { exists as tauriExists } from '@tauri-apps/plugin-fs';
import { cloudToastService } from '../cloud/utils/CloudToastService';
import { trackError } from '../services/analytics';
import * as CryptoJS from 'crypto-js';
import './transferMDModal.css';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface ProviderStatus {
    name: string;
    displayName: string;
    connected: boolean;
    icon: string;
}

export default function TransferMDModal({ isOpen, onClose }: Props) {
    const { t } = useLanguage();
    const [providers, setProviders] = useState<ProviderStatus[]>([]);
    const [source, setSource] = useState<string | 'local'>('');
    const [target, setTarget] = useState<string | 'local'>('');
    const [localPath, setLocalPath] = useState<string>('');
    const [targetLocalPath, setTargetLocalPath] = useState<string>('');
    const [isTransferring, setIsTransferring] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number; message: string }>({ current: 0, total: 0, message: '' });
    const [results, setResults] = useState<{ skipped: number; renamed: number; uploaded: number; errors: number }>({ skipped: 0, renamed: 0, uploaded: 0, errors: 0 });

    useEffect(() => {
        if (isOpen) {
            loadProviders();
        }
    }, [isOpen]);

    const loadProviders = async () => {
        if (!cloudManager) return;
        const available = await cloudManager.getAvailableProviders();
        const localLibs = cloudManager.getLocalLibraries();
        const list: ProviderStatus[] = [];

        for (const p of available) {
            if (p.name === 'locallibrary') {
                if (localLibs.length > 0) {
                    for (const lib of localLibs) {
                        list.push({
                            name: `locallibrary:${lib.id}`,
                            displayName: lib.name,
                            connected: true,
                            icon: p.icon
                        });
                    }
                } else {
                    list.push({
                        name: 'locallibrary',
                        displayName: t('easynotes.local_library') || p.displayName,
                        connected: false,
                        icon: p.icon
                    });
                }
            } else {
                const connected = await cloudManager!.isProviderConnected(p.name);
                list.push({
                    name: p.name,
                    displayName: p.displayName,
                    connected,
                    icon: p.icon
                });
            }
        }
        setProviders(list);
    };

    const handleProviderClick = async (provider: ProviderStatus, isSource: boolean) => {
        if (!provider.connected) {
            if (provider.name === 'locallibrary') {
                const success = await cloudManager!.connectProvider('locallibrary');
                if (success) {
                    await loadProviders();
                    if (isSource) setSource('locallibrary');
                    else setTarget('locallibrary');
                }
            }
            return;
        }

        if (isSource) {
            setSource(provider.name);
        } else {
            if (source !== provider.name) {
                setTarget(provider.name);
            }
        }
    };

    const handleSelectLocalFolder = async () => {
        const path = await openDirectoryDialog();
        if (path) {
            setLocalPath(path);
            setSource('local');
        }
    };

    const handleSelectLocalTargetFolder = async () => {
        const path = await openDirectoryDialog();
        if (path) {
            setTargetLocalPath(path);
            setTarget('local');
        }
    };

    const calculateChecksum = (content: string | Uint8Array): string => {
        if (!content) return 'sha256:empty';

        let input: any = content;
        if (content instanceof Uint8Array) {
            // Convert Uint8Array to WordArray for CryptoJS
            input = CryptoJS.lib.WordArray.create(content as any);
        } else if (typeof content !== 'string') {
            return 'sha256:empty';
        }

        const hash = CryptoJS.SHA256(input);
        return `sha256:${hash.toString(CryptoJS.enc.Hex)}`;
    };

    const handleTransfer = async () => {
        if (!source || !target) {
            alert(t('transfer_md.select_source_target') || 'Please select both source and target');
            return;
        }

        setIsTransferring(true);
        setResults({ skipped: 0, renamed: 0, uploaded: 0, errors: 0 });

        try {
            if (target === 'local') {
                await transferToLocal();
            } else if (source === 'local') {
                await transferFromLocal();
            } else {
                await transferFromCloud();
            }
        } catch (error) {
            console.error('Transfer failed:', error);
            cloudToastService.showError(error as Error);
        } finally {
            setIsTransferring(false);
        }
    };

    const transferToLocal = async () => {
        let filesToTransfer: { name: string, content: string | Uint8Array, size: number }[] = [];

        if (source === 'local') {
            const localFiles = await readDirectory(localPath);
            if (localFiles.length === 0) {
                setProgress(prev => ({ ...prev, message: t('transfer_md.no_files') || 'No files found' }));
                setIsTransferring(false);
                return;
            }
            setProgress({ current: 0, total: localFiles.length, message: t('transfer_md.processing') || 'Processing...' });

            for (let i = 0; i < localFiles.length; i++) {
                const relPath = localFiles[i];
                const fullPath = `${localPath}/${relPath}`;
                const fileName = relPath.split(/[/\\]/).pop() || relPath;
                const content = await readFileContent(fullPath);
                if (content !== null) {
                    filesToTransfer.push({
                        name: fileName,
                        content,
                        size: new TextEncoder().encode(content).length
                    });
                }
            }
        } else {
            const available = await cloudManager!.getAvailableProviders();
            const sourceProviderKey = source.startsWith('locallibrary:') ? 'locallibrary' : source;
            const sourceProvider = available.find(p => p.name === sourceProviderKey);
            const sourceMeta = await cloudManager!.getProviderMetadata(source);
            if (!sourceProvider || !sourceMeta?.applicationFolderId) throw new Error('Source cloud provider not ready');

            const sourceFiles = await sourceProvider.listFiles(sourceMeta.applicationFolderId);
            if (sourceFiles.length === 0) {
                setProgress(prev => ({ ...prev, message: t('transfer_md.no_files') || 'No files found' }));
                setIsTransferring(false);
                return;
            }
            setProgress({ current: 0, total: sourceFiles.length, message: t('transfer_md.processing') || 'Processing...' });

            for (let i = 0; i < sourceFiles.length; i++) {
                const sFile = sourceFiles[i];
                setProgress(prev => ({ ...prev, current: i + 1, message: `Downloading ${sFile.name}...` }));
                const content = await sourceProvider.downloadFile(sFile.id);
                filesToTransfer.push({
                    name: sFile.name,
                    content,
                    size: sFile.size
                });
            }
        }

        for (let i = 0; i < filesToTransfer.length; i++) {
            const file = filesToTransfer[i];
            setProgress(prev => ({ ...prev, current: i + 1, message: `Writing ${file.name}...` }));

            try {
                const sourceChecksum = calculateChecksum(file.content);
                let finalFileName = file.name;
                const targetPath = `${targetLocalPath}/${finalFileName}`.replace(/\/+/g, '/');

                if (await tauriExists(targetPath)) {
                    const existingContent = await readFileContent(targetPath);
                    if (existingContent !== null) {
                        const existingChecksum = calculateChecksum(existingContent);
                        const existingSize = new TextEncoder().encode(existingContent).length;

                        if (existingSize === file.size && existingChecksum === sourceChecksum) {
                            setResults(prev => ({ ...prev, skipped: prev.skipped + 1 }));
                            continue;
                        } else {
                            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + new Date().getTime();
                            const lastDotIndex = file.name.lastIndexOf('.');
                            const nameBase = lastDotIndex > 0 ? file.name.substring(0, lastDotIndex) : file.name;
                            const ext = lastDotIndex > 0 ? file.name.substring(lastDotIndex) : '.md';
                            finalFileName = `${nameBase}_${dateStr}${ext}`;
                            setResults(prev => ({ ...prev, renamed: prev.renamed + 1 }));
                        }
                    }
                } else {
                    setResults(prev => ({ ...prev, uploaded: prev.uploaded + 1 }));
                }

                const finalTargetPath = `${targetLocalPath}/${finalFileName}`.replace(/\/+/g, '/');
                const contentToWrite = typeof file.content === 'string' ? file.content : new TextDecoder().decode(file.content);
                await writeTauriFile(finalTargetPath, contentToWrite);
            } catch (err) {
                console.error(`Failed to write ${file.name}:`, err);
                trackError('cloud', `Transfer failed writing ${file.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
                setResults(prev => ({ ...prev, errors: prev.errors + 1 }));
            }
        }
    };

    const transferFromLocal = async () => {
        const files = await readDirectory(localPath);
        if (files.length === 0) {
            setProgress(prev => ({ ...prev, message: t('transfer_md.no_files') || 'No files found' }));
            setIsTransferring(false);
            return;
        }

        setProgress({ current: 0, total: files.length, message: t('transfer_md.processing') || 'Processing...' });

        const targetMeta = await cloudManager!.getProviderMetadata(target);
        const available = await cloudManager!.getAvailableProviders();
        const targetProviderKey = target.startsWith('locallibrary:') ? 'locallibrary' : target;
        const targetProvider = available.find(p => p.name === targetProviderKey);

        if (!targetProvider || !targetMeta?.applicationFolderId) {
            throw new Error('Target cloud provider not ready or folder missing');
        }

        const targetFiles = await targetProvider.listFiles(targetMeta.applicationFolderId);
        const targetFileMap = new Map(targetFiles.map(f => [f.name, f]));

        for (let i = 0; i < files.length; i++) {
            const relPath = files[i];
            const fullPath = `${localPath}/${relPath}`;
            const fileName = relPath.split('/').pop() || relPath;

            setProgress(prev => ({ ...prev, current: i + 1, message: `Transferring ${fileName}...` }));

            try {
                const content = await readFileContent(fullPath);
                if (content === null) throw new Error('Could not read file');

                const sourceChecksum = calculateChecksum(content);
                const sourceSize = new TextEncoder().encode(content).length;

                const existingFile = targetFileMap.get(fileName);
                let finalFileName = fileName;

                if (existingFile) {
                    const existingContent = await targetProvider.downloadFile(existingFile.id);
                    const existingChecksum = calculateChecksum(existingContent);

                    if (existingFile.size === sourceSize && existingChecksum === sourceChecksum) {
                        setResults(prev => ({ ...prev, skipped: prev.skipped + 1 }));
                        continue;
                    } else {
                        // Conflict: Name matches, but size or content differs
                        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + new Date().getTime();
                        const lastDotIndex = fileName.lastIndexOf('.');
                        const nameBase = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
                        const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '.md';
                        finalFileName = `${nameBase}_${dateStr}${ext}`;
                        setResults(prev => ({ ...prev, renamed: prev.renamed + 1 }));
                    }
                } else {
                    setResults(prev => ({ ...prev, uploaded: prev.uploaded + 1 }));
                }

                await cloudManager!.uploadFile(target, finalFileName, content);
            } catch (err) {
                console.error(`Failed to transfer ${fileName}:`, err);
                trackError('cloud', `Transfer failed for ${fileName}: ${err instanceof Error ? err.message : 'Unknown'}`);
                setResults(prev => ({ ...prev, errors: prev.errors + 1 }));
            }
        }
    };

    const transferFromCloud = async () => {
        const available = await cloudManager!.getAvailableProviders();
        const sourceProviderKey = source.startsWith('locallibrary:') ? 'locallibrary' : source;
        const sourceProvider = available.find(p => p.name === sourceProviderKey);
        const sourceMeta = await cloudManager!.getProviderMetadata(source);

        if (!sourceProvider || !sourceMeta?.applicationFolderId) {
            throw new Error('Source cloud provider not ready or folder missing');
        }

        const sourceFiles = await sourceProvider.listFiles(sourceMeta.applicationFolderId);
        if (sourceFiles.length === 0) {
            setProgress(prev => ({ ...prev, message: t('transfer_md.no_files') || 'No files found' }));
            setIsTransferring(false);
            return;
        }

        setProgress({ current: 0, total: sourceFiles.length, message: t('transfer_md.processing') || 'Processing...' });

        const targetProviderKey = target.startsWith('locallibrary:') ? 'locallibrary' : target;
        const targetProvider = available.find(p => p.name === targetProviderKey);
        const targetMeta = await cloudManager!.getProviderMetadata(target);

        if (!targetProvider || !targetMeta?.applicationFolderId) {
            throw new Error('Target cloud provider not ready or folder missing');
        }

        const targetFiles = await targetProvider.listFiles(targetMeta.applicationFolderId);
        const targetFileMap = new Map(targetFiles.map(f => [f.name, f]));

        for (let i = 0; i < sourceFiles.length; i++) {
            const sFile = sourceFiles[i];
            setProgress(prev => ({ ...prev, current: i + 1, message: `Transferring ${sFile.name}...` }));

            try {
                const content = await sourceProvider.downloadFile(sFile.id);
                const sourceChecksum = calculateChecksum(content);

                const existingFile = targetFileMap.get(sFile.name);
                let finalFileName = sFile.name;

                if (existingFile) {
                    const existingContent = await targetProvider.downloadFile(existingFile.id);
                    const existingChecksum = calculateChecksum(existingContent);

                    if (existingFile.size === sFile.size && existingChecksum === sourceChecksum) {
                        setResults(prev => ({ ...prev, skipped: prev.skipped + 1 }));
                        continue;
                    } else {
                        // Conflict
                        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + new Date().getTime();
                        const lastDotIndex = sFile.name.lastIndexOf('.');
                        const nameBase = lastDotIndex > 0 ? sFile.name.substring(0, lastDotIndex) : sFile.name;
                        const ext = lastDotIndex > 0 ? sFile.name.substring(lastDotIndex) : '.md';
                        finalFileName = `${nameBase}_${dateStr}${ext}`;
                        setResults(prev => ({ ...prev, renamed: prev.renamed + 1 }));
                    }
                } else {
                    setResults(prev => ({ ...prev, uploaded: prev.uploaded + 1 }));
                }

                await cloudManager!.uploadFile(target, finalFileName, content);
            } catch (err) {
                console.error(`Failed to transfer ${sFile.name}:`, err);
                trackError('cloud', `Transfer failed for ${sFile.name}: ${err instanceof Error ? err.message : 'Unknown'}`);
                setResults(prev => ({ ...prev, errors: prev.errors + 1 }));
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content transfer-md-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2><FaExchangeAlt /> {t('transfer_md.title')}</h2>
                </div>

                <div className="modal-body">
                    <p className="modal-subtitle">{t('transfer_md.subtitle')}</p>

                    <div className="transfer-sections">
                        <div className="transfer-section">
                            <h3>{t('transfer_md.source')}</h3>
                            <div className="provider-options">
                                <button
                                    className={`provider-option ${source === 'local' ? 'active' : ''}`}
                                    onClick={handleSelectLocalFolder}
                                >
                                    <FaFolderOpen />
                                    <div className="provider-info">
                                        <span>{t('transfer_md.local_folder')}</span>
                                        {localPath && <small title={localPath}>{localPath.split(/[/\\]/).pop()}</small>}
                                    </div>
                                </button>
                                {providers.map(p => (
                                    <button
                                        key={p.name}
                                        className={`provider-option ${source === p.name ? 'active' : ''} ${!p.connected && p.name !== 'locallibrary' ? 'disabled' : ''}`}
                                        onClick={() => handleProviderClick(p, true)}
                                        disabled={!p.connected && p.name !== 'locallibrary'}
                                    >
                                        <div dangerouslySetInnerHTML={{ __html: p.icon }} className="provider-icon" />
                                        <div className="provider-info">
                                            <span>{p.displayName}</span>
                                            <small>
                                                {p.name === 'locallibrary'
                                                    ? (p.connected
                                                        ? (localStorage.getItem('easynotes_locallibrary_path') || t('transfer_md.connected'))
                                                        : (t('easynotes.configure') || 'Configure'))
                                                    : (p.connected ? t('transfer_md.connected') : t('transfer_md.not_connected'))}
                                            </small>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="transfer-divider">
                            <FaExchangeAlt />
                        </div>

                        <div className="transfer-section">
                            <h3>{t('transfer_md.target')}</h3>
                            <div className="provider-options">
                                <button
                                    className={`provider-option ${target === 'local' ? 'active' : ''} ${source === 'local' ? 'disabled' : ''}`}
                                    onClick={handleSelectLocalTargetFolder}
                                    disabled={source === 'local'}
                                >
                                    <FaFolderOpen />
                                    <div className="provider-info">
                                        <span>{t('transfer_md.local_folder')}</span>
                                        {targetLocalPath && <small title={targetLocalPath}>{targetLocalPath.split(/[/\\]/).pop()}</small>}
                                    </div>
                                </button>
                                {providers.map(p => (
                                    <button
                                        key={p.name}
                                        className={`provider-option ${target === p.name ? 'active' : ''} ${source === p.name || (!p.connected && p.name !== 'locallibrary') ? 'disabled' : ''}`}
                                        onClick={() => source !== p.name && handleProviderClick(p, false)}
                                        disabled={source === p.name || (!p.connected && p.name !== 'locallibrary')}
                                    >
                                        <div dangerouslySetInnerHTML={{ __html: p.icon }} className="provider-icon" />
                                        <div className="provider-info">
                                            <span>{p.displayName}</span>
                                            <small>
                                                {p.name === 'locallibrary'
                                                    ? (p.connected
                                                        ? (localStorage.getItem('easynotes_locallibrary_path') || t('transfer_md.connected'))
                                                        : (t('easynotes.configure') || 'Configure'))
                                                    : (p.connected ? t('transfer_md.connected') : t('transfer_md.not_connected'))}
                                            </small>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {isTransferring && (
                        <div className="transfer-progress-section">
                            <div className="progress-info">
                                <span>{progress.message}</span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                            <div className="progress-bar-container">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {!isTransferring && progress.total > 0 && progress.current === progress.total && (
                        <div className="transfer-results">
                            <div className="result-item success">
                                <FaCheckCircle /> {t('transfer_md.completed')}
                            </div>
                            <div className="result-stats">
                                <span>{t('transfer_md.uploaded')}: {results.uploaded}</span>
                                <span>{t('transfer_md.skipped')}: {results.skipped}</span>
                                <span>{t('transfer_md.renamed')}: {results.renamed}</span>
                                {results.errors > 0 && <span className="error">{t('transfer_md.error')}: {results.errors}</span>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="modal-button cancel-button" onClick={onClose}>
                        {t('actions.close')}
                    </button>
                    <button
                        className="modal-button primary-button"
                        onClick={handleTransfer}
                        disabled={isTransferring || !source || !target}
                    >
                        {isTransferring ? <FaSpinner className="fa-spin" /> : <FaCloudUploadAlt />}
                        &nbsp;{t('transfer_md.start_transfer')}
                    </button>
                </div>
            </div>
        </div>
    );
}
