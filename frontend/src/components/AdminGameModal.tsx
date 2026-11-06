import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Trash2,
  StopCircle,
  FileArchive,
  Layers,
  Settings2,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import type {
  Game,
  DownloadJob,
  DownloadCreateRequest,
  StorageInfo,
  GameType
} from '../types';
import { api } from '../services/api';

interface AdminGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGameAdded: (game: Game) => void;
  onPlayGame?: (game: Game) => void;
}

export const AdminGameModal: React.FC<AdminGameModalProps> = ({
  isOpen,
  onClose,
  onGameAdded,
  onPlayGame,
}) => {
  const [activeTab, setActiveTab] = useState<'url_download' | 'queue' | 'manual'>('url_download');

  // Form state for URL Download & Install
  const [name, setName] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [platform, setPlatform] = useState<'linux' | 'windows' | 'html5'>('linux');
  const [category, setCategory] = useState('Arcade');
  const [archiveType, setArchiveType] = useState('zip');
  const [executablePath, setExecutablePath] = useState('');
  const [launchArgs, setLaunchArgs] = useState('');
  const [checksum, setChecksum] = useState('');
  const [checksumType, setChecksumType] = useState<'sha256' | 'md5'>('sha256');
  const [autoInstall, setAutoInstall] = useState(true);
  const [selectedControls, setSelectedControls] = useState<string[]>([
    'keyboard',
    'touch_dpad',
    'touch_joystick',
    'gamepad'
  ]);

  // Form state for Manual Add
  const [manualName, setManualName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategory, setManualCategory] = useState('Arcade');
  const [manualGameType, setManualGameType] = useState<GameType>('linux');
  const [manualExecPath, setManualExecPath] = useState('');
  const [manualArgs, setManualArgs] = useState('');
  const [manualThumbnail, setManualThumbnail] = useState('');
  const [manualArchiveFile, setManualArchiveFile] = useState<File | null>(null);

  // Storage & Queue State
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [downloads, setDownloads] = useState<DownloadJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // Load storage metrics and downloads list
  const refreshStorageAndQueue = async () => {
    try {
      const [storage, jobs] = await Promise.all([
        api.getStorageInfo().catch(() => null),
        api.getDownloads().catch(() => []),
      ]);
      if (storage) setStorageInfo(storage);
      if (jobs) setDownloads(jobs);
    } catch {
      // background refresh ignore
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    refreshStorageAndQueue();

    // Establish WebSocket connection for live download/install events
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin/downloads`;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'download_progress' || data.type === 'install_progress') {
            setDownloads((prev) => {
              const existingIdx = prev.findIndex(
                (d) => d.id === data.download_id || d.game_id === data.game_id
              );
              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  status: data.status || updated[existingIdx].status,
                  progress: typeof data.progress === 'number' ? data.progress : updated[existingIdx].progress,
                  downloaded_mb: data.downloaded_mb ?? updated[existingIdx].downloaded_mb,
                  total_mb: data.total_mb ?? updated[existingIdx].total_mb,
                  download_speed_mbps: data.speed_mbps ?? updated[existingIdx].download_speed_mbps,
                  eta_seconds: data.eta_seconds ?? updated[existingIdx].eta_seconds,
                  error_message: data.error ?? updated[existingIdx].error_message,
                };
                return updated;
              } else {
                refreshStorageAndQueue();
                return prev;
              }
            });

            // If install finished, reload storage & trigger parent update
            if (data.status === 'installed' || data.status === 'completed') {
              refreshStorageAndQueue();
            }
          }
        } catch {
          // non-json ws message
        }
      };

      ws.onerror = () => {
        // Fallback to polling
      };
    } catch {
      // WebSocket unsupported or connection error
    }

    // Polling fallback every 2.5 seconds
    const interval = setInterval(refreshStorageAndQueue, 2500);

    return () => {
      clearInterval(interval);
      if (ws) {
        ws.close();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle control selection
  const handleToggleControl = (ctrl: string) => {
    setSelectedControls((prev) =>
      prev.includes(ctrl) ? prev.filter((c) => c !== ctrl) : [...prev, ctrl]
    );
  };

  // Submit Automatic URL Download
  const handleDownloadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Game name is required.');
      return;
    }
    if (!downloadUrl.trim()) {
      setErrorMsg('Game download URL is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const argsArray = launchArgs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: DownloadCreateRequest = {
        name: name.trim(),
        download_url: downloadUrl.trim(),
        description: description.trim() || `${name.trim()} - Downloaded on AWS EC2`,
        thumbnail:
          thumbnail.trim() ||
          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
        platform,
        category,
        archive_type: archiveType,
        executable_path: executablePath.trim() || undefined,
        launch_args: argsArray,
        supported_controls: selectedControls,
        checksum: checksum.trim() || undefined,
        checksum_type: checksumType,
        auto_install: autoInstall,
      };

      const job = await api.downloadGame(payload);
      setSuccessMsg(`Download initiated for "${job.game_name}". EC2 is downloading in background.`);
      setActiveTab('queue');
      refreshStorageAndQueue();

      // Reset form
      setName('');
      setDownloadUrl('');
      setDescription('');
      setThumbnail('');
      setExecutablePath('');
      setLaunchArgs('');
      setChecksum('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start download on EC2 server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Manual Game Registration
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!manualName.trim() || !manualExecPath.trim()) {
      setErrorMsg('Game title and executable path are required.');
      return;
    }

    const id = manualName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    setIsSubmitting(true);
    try {
      const argsArray = manualArgs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await api.createGame({
        id,
        name: manualName.trim(),
        description: manualDescription.trim() || 'Lightweight cloud game running on AWS EC2 C7i.',
        thumbnail:
          manualThumbnail.trim() ||
          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
        category: manualCategory,
        game_type: manualGameType,
        executable_path: manualExecPath.trim(),
        launch_args: argsArray,
        size_mb: 50,
        recommended_orientation: 'landscape',
        default_profile: 'wasd',
        supported_controls: ['keyboard', 'touch_dpad', 'touch_joystick', 'gamepad'],
        featured: false,
      });

      if (manualArchiveFile) {
        await api.uploadGameArchive(id, manualArchiveFile);
      }

      onGameAdded(created);
      setSuccessMsg(`Game "${created.name}" registered successfully!`);
      setManualName('');
      setManualExecPath('');
      setManualDescription('');
      setManualArgs('');
      setManualThumbnail('');
      setManualArchiveFile(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register game.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Download Job
  const handleCancelDownload = async (downloadId: string) => {
    try {
      await api.cancelDownload(downloadId);
      refreshStorageAndQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel download');
    }
  };

  // Delete Download Job
  const handleDeleteDownload = async (downloadId: string) => {
    if (!confirm('Are you sure you want to delete this download job and cached files?')) return;
    try {
      await api.deleteDownload(downloadId);
      refreshStorageAndQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to delete download');
    }
  };

  // Manually Install Downloaded Archive
  const handleInstallNow = async (downloadId: string) => {
    try {
      await api.installGame(downloadId);
      refreshStorageAndQueue();
      setSuccessMsg('Installation started on EC2!');
    } catch (err: any) {
      alert(err.message || 'Installation trigger failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-gaming-900 border border-slate-700/80 p-6 shadow-2xl text-white my-8 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Admin Game Downloader & Installer
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  AWS EC2 C7i
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Download, verify, extract, and configure games directly on your cloud server
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Storage Status Banner */}
        {storageInfo && (
          <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <HardDrive className={`w-4 h-4 ${storageInfo.is_low_space ? 'text-rose-400' : 'text-cyan-400'}`} />
              <div>
                <span className="font-semibold text-slate-200">EC2 Game Storage: </span>
                <span className="text-slate-400 font-mono">
                  {storageInfo.free_gb} GB free of {storageInfo.total_gb} GB ({storageInfo.percent_used}% used)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-500 ${
                    storageInfo.percent_used > 85
                      ? 'bg-rose-500'
                      : storageInfo.percent_used > 70
                      ? 'bg-amber-500'
                      : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(storageInfo.percent_used, 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Buffer: ≥{storageInfo.buffer_gb} GB
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('url_download')}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'url_download'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Auto Downloader & Installer</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors relative ${
              activeTab === 'queue'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Download Queue & Tasks</span>
            {downloads.filter((d) => d.status === 'downloading').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping absolute -top-0.5 -right-0.5" />
            )}
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-cyan-300">
              {downloads.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === 'manual'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Manual System Game</span>
          </button>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {/* TAB 1: Auto Downloader & Installer Form */}
          {activeTab === 'url_download' && (
            <form onSubmit={handleDownloadSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-cyan-200 text-xs flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Direct EC2 Streaming Download:</span> The AWS server downloads the archive directly without passing data through your local computer. SSRF filtering actively blocks private subnets and AWS metadata endpoints.
                </div>
              </div>

              {/* Game Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Game Name <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. OpenTTD, SuperTux, 2048"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Game Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm focus:outline-none transition-colors"
                  >
                    <option value="Arcade">Arcade</option>
                    <option value="Action">Action</option>
                    <option value="Platformer">Platformer</option>
                    <option value="Retro">Retro</option>
                    <option value="Puzzle">Puzzle</option>
                    <option value="Racing">Racing</option>
                    <option value="Strategy">Strategy</option>
                    <option value="RPG">RPG</option>
                  </select>
                </div>
              </div>

              {/* Download URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Game Download URL <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    required
                    value={downloadUrl}
                    onChange={(e) => setDownloadUrl(e.target.value)}
                    placeholder="https://example.com/downloads/game.zip"
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm focus:outline-none transition-colors font-mono"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-500">
                    <Download className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports direct HTTP/HTTPS links (ZIP, TAR.GZ, TAR.XZ, 7Z, direct ELF binaries, Wine .exe).
                </p>
              </div>

              {/* Platform & Archive Format */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Game Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm focus:outline-none transition-colors"
                  >
                    <option value="linux">Linux (Native ELF / Shell Script)</option>
                    <option value="windows">Windows (Wine Compatibility Layer)</option>
                    <option value="html5">HTML5 (Browser Game / index.html)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Archive Format / Package Type
                  </label>
                  <select
                    value={archiveType}
                    onChange={(e) => setArchiveType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm focus:outline-none transition-colors font-mono"
                  >
                    <option value="zip">ZIP Archive (.zip)</option>
                    <option value="rar">RAR Archive (.rar)</option>
                    <option value="tar.gz">TAR GZip (.tar.gz, .tgz)</option>
                    <option value="tar.xz">TAR XZ (.tar.xz)</option>
                    <option value="tar">TAR (.tar)</option>
                    <option value="7z">7-Zip Archive (.7z)</option>
                    <option value="direct_executable">Direct Executable (no archive)</option>
                    <option value="installer">Installer Package</option>
                  </select>
                </div>
              </div>

              {/* Description & Thumbnail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Game Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short summary of the game..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Thumbnail Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                    placeholder="https://.../thumbnail.jpg"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Advanced Configuration: Executable Override & Launch Args */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Executable & Execution Settings (Optional)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Executable Relative Path (Auto-detected if left blank)
                    </label>
                    <input
                      type="text"
                      value={executablePath}
                      onChange={(e) => setExecutablePath(e.target.value)}
                      placeholder="e.g. bin/game or game.x86_64"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-400 text-xs font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Launch Arguments (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={launchArgs}
                      onChange={(e) => setLaunchArgs(e.target.value)}
                      placeholder="e.g. -fullscreen, -windowed"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-400 text-xs font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Checksum Verification */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      File Checksum Hash (Optional integrity verification)
                    </label>
                    <input
                      type="text"
                      value={checksum}
                      onChange={(e) => setChecksum(e.target.value)}
                      placeholder="SHA-256 or MD5 hash..."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-400 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Hash Algorithm</label>
                    <select
                      value={checksumType}
                      onChange={(e) => setChecksumType(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-400 text-xs focus:outline-none font-mono"
                    >
                      <option value="sha256">SHA-256</option>
                      <option value="md5">MD5</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Supported Controls */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Supported Controls
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { id: 'keyboard', label: 'Keyboard & Mouse' },
                    { id: 'touch_dpad', label: 'Touch D-Pad' },
                    { id: 'touch_joystick', label: 'Virtual Joystick' },
                    { id: 'gamepad', label: 'Gamepad Compatible' },
                  ].map((ctrl) => {
                    const active = selectedControls.includes(ctrl.id);
                    return (
                      <button
                        type="button"
                        key={ctrl.id}
                        onClick={() => handleToggleControl(ctrl.id)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          active
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                            : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {ctrl.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto Install Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="auto_install_check"
                  checked={autoInstall}
                  onChange={(e) => setAutoInstall(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="auto_install_check" className="text-xs text-slate-300 cursor-pointer select-none">
                  Automatically extract archive, scan executables, and add game to library once download completes
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>INITIALIZING DOWNLOAD ON EC2...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>DOWNLOAD & INSTALL GAME</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Download Queue & Progress Monitor */}
          {activeTab === 'queue' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Active & Completed Tasks ({downloads.length})
                </span>
                <button
                  onClick={refreshStorageAndQueue}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh Queue</span>
                </button>
              </div>

              {downloads.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-sm">
                  <FileArchive className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-60" />
                  <p>No downloads in queue. Submit a game URL to start downloading directly to EC2.</p>
                </div>
              ) : (
                downloads.map((job) => {
                  const isDownloading = job.status === 'downloading';
                  const isPending = job.status === 'pending';
                  const isCompleted = job.status === 'completed';
                  const isFailed = job.status === 'failed';
                  const isCancelled = job.status === 'cancelled';

                  return (
                    <div
                      key={job.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col gap-3"
                    >
                      {/* Job Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white">{job.game_name}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-900 text-slate-300 border border-slate-700">
                              {job.platform}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono truncate max-w-md mt-0.5">
                            {job.source_url}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isDownloading && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                              Downloading ({job.progress}%)
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Queued
                            </span>
                          )}
                          {isCompleted && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Ready / Installed
                            </span>
                          )}
                          {isFailed && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              Failed
                            </span>
                          )}
                          {isCancelled && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              Cancelled
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar (Visible during download) */}
                      {(isDownloading || isPending) && (
                        <div className="space-y-1.5">
                          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                            <div
                              className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300"
                              style={{ width: `${Math.max(job.progress, 3)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span>
                              {job.downloaded_mb} MB {job.total_mb ? `/ ${job.total_mb} MB` : ''}
                            </span>
                            <span>Speed: {job.download_speed_mbps} MB/s</span>
                            <span>
                              {job.eta_seconds !== null && job.eta_seconds !== undefined
                                ? `ETA: ${job.eta_seconds}s`
                                : 'Calculating...'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Error Banner if failed */}
                      {job.error_message && (
                        <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-900 text-rose-300 text-[11px]">
                          <strong>Error: </strong> {job.error_message}
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-slate-500 font-mono">
                          ID: {job.id} • {new Date(job.created_at).toLocaleTimeString()}
                        </span>

                        <div className="flex items-center gap-2">
                          {isDownloading && (
                            <button
                              onClick={() => handleCancelDownload(job.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 flex items-center gap-1 transition-colors"
                            >
                              <StopCircle className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          )}

                          {isCompleted && (
                            <>
                              {onPlayGame && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const game = await api.getGame(job.game_id);
                                      onPlayGame(game);
                                      onClose();
                                    } catch {
                                      // fallback
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                                  <span>Play</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleInstallNow(job.id)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Re-Install</span>
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleDeleteDownload(job.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete record & cached files"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: Manual System Game Registration */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs">
                Register a pre-installed Linux system binary (e.g. <code>/usr/games/supertux2</code>) or upload an archive manually from your computer.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Game Title <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Frozen Bubble"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Executable Path or Command <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualExecPath}
                    onChange={(e) => setManualExecPath(e.target.value)}
                    placeholder="/usr/games/frozen-bubble"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Genre / Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm focus:outline-none"
                  >
                    <option value="Arcade">Arcade</option>
                    <option value="Action">Action</option>
                    <option value="Platformer">Platformer</option>
                    <option value="Retro">Retro</option>
                    <option value="Puzzle">Puzzle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Execution Engine</label>
                  <select
                    value={manualGameType}
                    onChange={(e) => setManualGameType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm focus:outline-none"
                  >
                    <option value="linux">Linux Native</option>
                    <option value="windows">Wine (Windows)</option>
                    <option value="browser">HTML5 Browser</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Optional Local Archive Upload (.zip, .tar.gz)
                </label>
                <input
                  type="file"
                  accept=".zip,.tar.gz,.tgz,.tar.xz,.7z"
                  onChange={(e) => setManualArchiveFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-cyan-400 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>SAVE & REGISTER GAME</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
