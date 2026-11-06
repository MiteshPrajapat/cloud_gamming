import React, { useState } from 'react';
import { X, Upload, Plus, ShieldAlert } from 'lucide-react';
import type { Game, GameType, ControlProfile, Orientation } from '../types';
import { api } from '../services/api';

interface AdminGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGameAdded: (game: Game) => void;
}

export const AdminGameModal: React.FC<AdminGameModalProps> = ({ isOpen, onClose, onGameAdded }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Arcade');
  const [gameType, setGameType] = useState<GameType>('linux');
  const [executablePath, setExecutablePath] = useState('');
  const [launchArgs, setLaunchArgs] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [sizeMb, setSizeMb] = useState(25);
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [defaultProfile, setDefaultProfile] = useState<ControlProfile>('wasd');
  const [archiveFile, setArchiveFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!name.trim() || !executablePath.trim()) {
      setErrorMsg('Game title and executable path are required.');
      return;
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    setIsSubmitting(true);
    try {
      const argsArray = launchArgs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await api.createGame({
        id,
        name: name.trim(),
        description: description.trim() || 'Lightweight cloud game running on AWS EC2 C7i.',
        thumbnail:
          thumbnail.trim() ||
          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
        category,
        game_type: gameType,
        executable_path: executablePath.trim(),
        launch_args: argsArray,
        size_mb: sizeMb,
        recommended_orientation: orientation,
        default_profile: defaultProfile,
        supported_controls: ['keyboard', 'touch_dpad', 'touch_joystick', 'gamepad'],
        featured: false,
      });

      // If user uploaded an archive, upload it
      if (archiveFile) {
        await api.uploadGameArchive(id, archiveFile);
      }

      onGameAdded(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register new game.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-gaming-900 border border-slate-700 p-6 shadow-2xl text-white my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold">Add Game to Cloud Library</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Game Title *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Super Hexagon"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Genre / Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="Action">Action</option>
                <option value="Arcade">Arcade</option>
                <option value="Platformer">Platformer</option>
                <option value="Retro">Retro</option>
                <option value="Racing">Racing</option>
                <option value="Puzzle">Puzzle</option>
                <option value="RPG">RPG</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-300 mb-1 font-medium">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief game gameplay overview..."
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Runtime Engine & Executable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Runtime Engine</label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value as GameType)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="linux">Linux Native Binary</option>
                <option value="windows">Windows Executable (Wine)</option>
                <option value="retro">Retro Emulator</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Executable Path / Command *</label>
              <input
                type="text"
                required
                value={executablePath}
                onChange={(e) => setExecutablePath(e.target.value)}
                placeholder="e.g. /usr/games/supertux2"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Launch Args & Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Launch Arguments (comma-separated)</label>
              <input
                type="text"
                value={launchArgs}
                onChange={(e) => setLaunchArgs(e.target.value)}
                placeholder="-f, --fullscreen"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Approx Size (MB)</label>
              <input
                type="number"
                value={sizeMb}
                onChange={(e) => setSizeMb(parseFloat(e.target.value) || 10)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Orientation & Mobile Profile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Recommended Orientation</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="landscape">Landscape (Recommended for PC games)</option>
                <option value="portrait">Portrait</option>
                <option value="any">Any / Responsive</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Default Mobile Control Profile</label>
              <select
                value={defaultProfile}
                onChange={(e) => setDefaultProfile(e.target.value as ControlProfile)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:border-cyan-400 focus:outline-none uppercase"
              >
                <option value="wasd">WASD + Space / Shift</option>
                <option value="arrows">Arrow Keys + Z / X / Enter</option>
                <option value="action">Action Layout</option>
              </select>
            </div>
          </div>

          {/* Thumbnail URL */}
          <div>
            <label className="block text-slate-300 mb-1 font-medium">Thumbnail Poster URL</label>
            <input
              type="text"
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="https://images.unsplash.com/... or /thumbnails/game.jpg"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Optional Archive Upload */}
          <div className="p-3 rounded-xl bg-slate-950 border border-dashed border-slate-700">
            <label className="block text-slate-300 mb-1 font-medium flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-cyan-400" />
              Upload Game Archive (Optional, .zip or .tar.gz)
            </label>
            <input
              type="file"
              accept=".zip,.tar.gz,.tar.bz2"
              onChange={(e) => setArchiveFile(e.target.files?.[0] || null)}
              className="w-full text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
            >
              {isSubmitting ? 'Registering...' : 'Add Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
