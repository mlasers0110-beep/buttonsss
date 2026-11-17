import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  GitCompare,
  History,
  Pin,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  computeSnapshotDiffEntries,
  SNAPSHOT_LABEL_MAX_LENGTH,
  SNAPSHOT_NOTE_MAX_LENGTH,
  SNAPSHOT_VERSION_TAG_MAX_LENGTH,
  SNAPSHOT_VERSION_TAG_PATTERN,
} from '../lib/studioSnapshots';
import { MATERIAL_PROFILES, PaletteMode, StudioSnapshotRecord } from '../types/studio';

const PALETTE_DISPLAY: Record<PaletteMode, string> = {
  'pearl-flebologia': 'Perłowa Flebologia',
  'finance-ice': 'FinanceAI Błękit',
  'emerald-clinic': 'Szmaragdowa Klinika',
};

export const VersionHistoryPanel: React.FC = () => {
  const {
    user,
    studioAccount,
    isAuthenticatedAny,
    openAuthModal,
    authLoading,
    signInWithGoogle,
    palette,
    depth,
    haptic,
    synth,
    activeScreenMap,
    snapshots,
    snapshotsLoading,
    snapshotsError,
    activeRestoredSnapshotId,
    currentSnapshotStatePreview,
    createStudioSnapshot,
    restoreStudioSnapshot,
    togglePinStudioSnapshot,
    renameStudioSnapshot,
    deleteStudioSnapshot,
  } = useStudio();

  const [labelInput, setLabelInput] = useState('');
  const [versionInput, setVersionInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [pinOnCreate, setPinOnCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localValidationMsg, setLocalValidationMsg] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<'all' | 'pinned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedSnapshotId, setInspectedSnapshotId] = useState<string | null>(null);

  // Inline metadata editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');

  const isDark = palette === 'emerald-clinic';

  const suggestedNextVersion = useMemo(
    () => `v1.${snapshots.length}`,
    [snapshots.length]
  );

  const cardSurfaceStyle: React.CSSProperties = {
    borderRadius: `${depth.borderRadius}px`,
    backdropFilter: `blur(${depth.glassBlur}px)`,
    backgroundColor: isDark
      ? `rgba(11, 34, 29, ${depth.glassOpacity})`
      : `rgba(255, 255, 255, ${depth.glassOpacity})`,
    boxShadow: isDark
      ? `0 ${depth.elevation}px ${depth.blur}px rgba(0,0,0,0.46)`
      : `0 ${depth.elevation}px ${depth.blur}px rgba(88, 76, 148, 0.13)`,
  };

  const filteredSnapshots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return snapshots.filter((snap) => {
      if (filterMode === 'pinned' && !snap.isPinned) return false;
      if (!q) return true;
      return (
        snap.label.toLowerCase().includes(q) ||
        snap.versionTag.toLowerCase().includes(q) ||
        snap.note.toLowerCase().includes(q) ||
        snap.summary.material.toLowerCase().includes(q)
      );
    });
  }, [snapshots, filterMode, searchQuery]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalValidationMsg(null);
    setStatusFeedback(null);

    const resolvedVersion = (versionInput.trim() || suggestedNextVersion).slice(
      0,
      SNAPSHOT_VERSION_TAG_MAX_LENGTH
    );
    if (!SNAPSHOT_VERSION_TAG_PATTERN.test(resolvedVersion)) {
      setLocalValidationMsg(
        'Oznaczenie wersji musi mieć postać semantyczną, np. v1.0, v1.2 lub v2.0.1.'
      );
      return;
    }

    const defaultLabel = `${PALETTE_DISPLAY[palette]} · ${MATERIAL_PROFILES[haptic.material].label}`;
    const resolvedLabel = (labelInput.trim() || defaultLabel).slice(
      0,
      SNAPSHOT_LABEL_MAX_LENGTH
    );

    setSaving(true);
    try {
      await createStudioSnapshot({
        label: resolvedLabel,
        note: noteInput.trim().slice(0, SNAPSHOT_NOTE_MAX_LENGTH),
        versionTag: resolvedVersion,
        isPinned: pinOnCreate,
      });
      setLabelInput('');
      setVersionInput('');
      setNoteInput('');
      setPinOnCreate(false);
      setStatusFeedback(
        user
          ? `Zapisano migawkę ${resolvedVersion} w bazie Firestore.`
          : `Zapisano migawkę ${resolvedVersion} w skarbcu Konta Studio AI (${studioAccount?.studioId || 'Offline'}).`
      );
      window.setTimeout(() => setStatusFeedback(null), 2600);
    } catch {
      // Error surfaced via snapshotsError
    } finally {
      setSaving(false);
    }
  };

  const handleQuickCreateFirstSnapshot = async () => {
    setSaving(true);
    setLocalValidationMsg(null);
    try {
      await createStudioSnapshot({
        label: ` Konfiguracja bazowa · ${MATERIAL_PROFILES[haptic.material].label}`.trim(),
        note: `Paleta ${PALETTE_DISPLAY[palette]}, ton kliku ${synth.baseFrequency} Hz, mapa ${activeScreenMap.nodes.length} ekranów.`,
        versionTag: 'v1.0',
        isPinned: true,
      });
      setStatusFeedback(
        user
          ? 'Utworzono pierwszą migawkę v1.0 w Firestore.'
          : 'Utworzono pierwszą migawkę v1.0 w skarbcu Konta Studio AI.'
      );
      window.setTimeout(() => setStatusFeedback(null), 2600);
    } catch {
      // Error surfaced via snapshotsError
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = (snap: StudioSnapshotRecord) => {
    restoreStudioSnapshot(snap);
    setStatusFeedback(
      `Przywrócono pełną konfigurację studia z migawki ${snap.versionTag} („${snap.label}”).`
    );
    window.setTimeout(() => setStatusFeedback(null), 3000);
  };

  const beginInlineEdit = (snap: StudioSnapshotRecord) => {
    setEditingId(snap.id);
    setEditLabel(snap.label);
    setEditNote(snap.note);
  };

  const commitInlineEdit = async (snapshotId: string) => {
    if (!editLabel.trim()) return;
    await renameStudioSnapshot(
      snapshotId,
      editLabel.trim().slice(0, SNAPSHOT_LABEL_MAX_LENGTH),
      editNote.trim().slice(0, SNAPSHOT_NOTE_MAX_LENGTH)
    );
    setEditingId(null);
  };

  return (
    <section
      style={cardSurfaceStyle}
      className="p-6 sm:p-8 border border-white/80 dark:border-emerald-400/20 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
            <span>
              {user ? 'Firebase Firestore' : 'Skarbiec Konta Studio AI & Firestore'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Pełne Migawki Stanu Konfiguracji Studia</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {snapshots.length} zapisanych wersji
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-emerald-50 mt-1 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600 dark:text-emerald-300 shrink-0" />
            <span>Historia wersji</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-emerald-100/75 mt-1">
            Zapisuj i przywracaj kompletne migawki (snapshots) wszystkich parametrów Aether
            Tactile Studio na Koncie Studio AI (również w pobranym pliku Offline .html) lub w
            chmurze Firestore: palety i głębi szkła, haptyki materiałów, syntezatora (&lt;160 Hz),
            kalibracji pokrętła CNC 270° oraz aktywnej mapy ekranów.
          </p>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-emerald-200/85 bg-white/60 dark:bg-emerald-950/60 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-emerald-400/20">
          Bieżący stan: {PALETTE_DISPLAY[palette]} · {MATERIAL_PROFILES[haptic.material].label} ·{' '}
          {synth.baseFrequency} Hz · {activeScreenMap.nodes.length} ekr.
        </div>
      </div>

      {/* Signed-Out Prompt State */}
      {!authLoading && !isAuthenticatedAny && (
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-400/25 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
              Autoryzuj Konto Studio AI lub Google, aby zapisywać Historię wersji
            </div>
            <p className="text-xs text-slate-600 dark:text-emerald-200/75">
              Wbudowane Konto Studio AI pozwala zapisywać i przywracać migawki wersji zarówno
              online, jak i całkowicie offline w pobranym pliku HTML. Połączenie z Google zapisuje
              migawki bezpośrednio w kolekcji Firestore.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openAuthModal('auth')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            >
              Konto Studio AI (Offline / Chmura)
            </button>
            <button
              type="button"
              onClick={() => {
                signInWithGoogle().catch(() => openAuthModal('auth'));
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-white/85 dark:bg-emerald-900/70 border border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100 text-xs font-medium hover:bg-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Zaloguj z Google
            </button>
          </div>
        </div>
      )}

      {/* Authenticated Snapshot Creation Form & Timeline */}
      {isAuthenticatedAny && (
        <>
          <form
            onSubmit={handleCreateSnapshot}
            className="p-5 rounded-2xl bg-white/70 dark:bg-emerald-950/60 border border-slate-200/80 dark:border-emerald-400/20 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <label className="md:col-span-5 space-y-1">
                <span className="font-medium text-slate-700 dark:text-emerald-200 flex items-center justify-between">
                  <span>Nazwa migawki</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {labelInput.length}/{SNAPSHOT_LABEL_MAX_LENGTH}
                  </span>
                </span>
                <input
                  type="text"
                  maxLength={SNAPSHOT_LABEL_MAX_LENGTH}
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder={`${PALETTE_DISPLAY[palette]} · ${MATERIAL_PROFILES[haptic.material].label}`}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="md:col-span-2 space-y-1">
                <span className="font-medium text-slate-700 dark:text-emerald-200 block">
                  Oznaczenie wersji
                </span>
                <input
                  type="text"
                  maxLength={SNAPSHOT_VERSION_TAG_MAX_LENGTH}
                  value={versionInput}
                  onChange={(e) => setVersionInput(e.target.value)}
                  placeholder={suggestedNextVersion}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl font-mono tabular-nums bg-white dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="md:col-span-5 space-y-1">
                <span className="font-medium text-slate-700 dark:text-emerald-200 flex items-center justify-between">
                  <span>Notatka zmian (opcjonalnie)</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {noteInput.length}/{SNAPSHOT_NOTE_MAX_LENGTH}
                  </span>
                </span>
                <input
                  type="text"
                  maxLength={SNAPSHOT_NOTE_MAX_LENGTH}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Opisz kalibrację dźwięku, materiał szkła lub układ ekranów..."
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-white dark:bg-emerald-950/85 border border-slate-200 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-emerald-100 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pinOnCreate}
                  onChange={(e) => setPinOnCreate(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Przypnij migawkę na górze osi historii</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer hover:opacity-95 disabled:opacity-60 transition-opacity whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {saving
                    ? 'Zapisywanie migawki...'
                    : user
                      ? 'Zapisz migawkę w Firestore'
                      : 'Zapisz migawkę na Koncie Studio AI'}
                </span>
              </button>
            </div>
          </form>

          {/* Validation / Status / Error Alerts */}
          {(localValidationMsg || snapshotsError || statusFeedback) && (
            <div
              className={`px-4 py-3 rounded-xl border text-xs ${
                localValidationMsg || snapshotsError
                  ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-400/30 text-rose-700 dark:text-rose-200'
                  : 'bg-white/85 dark:bg-emerald-900/65 border-slate-200/80 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-100'
              }`}
            >
              {localValidationMsg || snapshotsError || statusFeedback}
            </div>
          )}

          {/* Filter & Search Toolbar */}
          {snapshots.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-emerald-950/80">
                {(
                  [
                    ['all', `Wszystkie (${snapshots.length})`],
                    [
                      'pinned',
                      `Przypięte (${snapshots.filter((s) => s.isPinned).length})`,
                    ],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilterMode(mode)}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      filterMode === mode
                        ? isDark
                          ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 dark:text-emerald-200/75 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtruj migawki po nazwie lub wersji..."
                  className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white/80 dark:bg-emerald-950/80 border border-slate-200/80 dark:border-emerald-400/25 text-slate-900 dark:text-emerald-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Loading Skeleton */}
          {snapshotsLoading && (
            <div className="space-y-3">
              {[0, 1].map((idx) => (
                <div
                  key={idx}
                  className="h-20 rounded-2xl bg-white/55 dark:bg-emerald-950/45 border border-slate-200/70 dark:border-emerald-400/15 animate-pulse"
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!snapshotsLoading && snapshots.length === 0 && (
            <div className="p-6 rounded-2xl bg-white/60 dark:bg-emerald-950/45 border border-slate-200/80 dark:border-emerald-400/20 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <div className="text-sm font-semibold text-slate-900 dark:text-emerald-50">
                  Brak zapisanych migawek w Historii wersji
                </div>
                <p className="text-xs text-slate-600 dark:text-emerald-200/75">
                  Zapisz pierwszą migawkę bieżącego stanu studia (materiał, dźwięk kliku,
                  kalibracja CNC oraz mapa ekranów), aby móc w każdej chwili wrócić do tego
                  punktu odniesienia.
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleQuickCreateFirstSnapshot}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold cursor-pointer hover:opacity-95 whitespace-nowrap shrink-0"
              >
                Utwórz pierwszą migawkę v1.0
              </button>
            </div>
          )}

          {/* Populated Timeline List */}
          {!snapshotsLoading && filteredSnapshots.length > 0 && (
            <div className="divide-y divide-slate-200/70 dark:divide-emerald-400/15 rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 bg-white/65 dark:bg-emerald-950/50 overflow-hidden">
              {filteredSnapshots.map((snap) => {
                const diffs = computeSnapshotDiffEntries(
                  snap.state,
                  currentSnapshotStatePreview
                );
                const changedCount = diffs.filter((d) => d.changed).length;
                const isInspected = inspectedSnapshotId === snap.id;
                const isEditing = editingId === snap.id;
                const isActiveRestored =
                  activeRestoredSnapshotId === snap.id && changedCount === 0;

                return (
                  <div key={snap.id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
                        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-indigo-700 dark:text-emerald-300">
                            {snap.versionTag}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{snap.createdAtFormatted}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {MATERIAL_PROFILES[snap.summary.material]?.label ||
                              snap.summary.material}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{snap.summary.baseFreqHz} Hz</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {snap.summary.screenCount} ekr. / {snap.summary.edgeCount} poł.
                          </span>
                          {snap.isPinned && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-sans font-medium text-amber-700 dark:text-amber-300">
                                Przypięta
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-sans">
                            {changedCount === 0
                              ? 'Zgodna z bieżącym stanem'
                              : `Różnice: ${changedCount} z ${diffs.length} modułów`}
                          </span>
                        </div>

                        {isEditing ? (
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                            <input
                              type="text"
                              maxLength={SNAPSHOT_LABEL_MAX_LENGTH}
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="sm:col-span-5 min-h-[38px] px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-emerald-950 border border-slate-300 dark:border-emerald-400/30 text-slate-900 dark:text-emerald-50"
                            />
                            <input
                              type="text"
                              maxLength={SNAPSHOT_NOTE_MAX_LENGTH}
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              placeholder="Notatka zmian..."
                              className="sm:col-span-5 min-h-[38px] px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-emerald-950 border border-slate-300 dark:border-emerald-400/30 text-slate-900 dark:text-emerald-50"
                            />
                            <div className="sm:col-span-2 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => commitInlineEdit(snap.id)}
                                className="min-h-[38px] px-3 rounded-lg bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 text-xs font-semibold cursor-pointer whitespace-nowrap"
                              >
                                Zapisz
                              </button>
                              <button
                                type="button"
                                aria-label="Anuluj edycję"
                                onClick={() => setEditingId(null)}
                                className="min-h-[38px] px-2.5 rounded-lg bg-slate-200/70 dark:bg-emerald-900/60 text-slate-700 dark:text-emerald-100 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-emerald-50 truncate">
                              {snap.label}
                            </h3>
                            {snap.note && (
                              <p className="text-xs text-slate-600 dark:text-emerald-200/75 leading-relaxed">
                                {snap.note}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {/* Single-line Action Controls */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestore(snap)}
                          className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                            isActiveRestored
                              ? isDark
                                ? 'bg-emerald-400 text-emerald-950'
                                : 'bg-indigo-600 text-white'
                              : 'bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95'
                          }`}
                        >
                          {isActiveRestored ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isActiveRestored ? 'Aktywna wersja' : 'Przywróć migawkę'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setInspectedSnapshotId((prev) =>
                              prev === snap.id ? null : snap.id
                            )
                          }
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/85 dark:bg-emerald-900/65 border border-slate-200/80 dark:border-emerald-400/25 text-xs font-medium text-slate-700 dark:text-emerald-100 inline-flex items-center gap-1.5 cursor-pointer hover:bg-white whitespace-nowrap shrink-0"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                          <span>{isInspected ? 'Ukryj porównanie' : 'Porównaj'}</span>
                        </button>

                        <button
                          type="button"
                          aria-label={snap.isPinned ? 'Odepnij migawkę' : 'Przypnij migawkę'}
                          title={snap.isPinned ? 'Odepnij migawkę' : 'Przypnij migawkę'}
                          onClick={() => togglePinStudioSnapshot(snap)}
                          className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                            snap.isPinned
                              ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-400/40 text-amber-800 dark:text-amber-200'
                              : 'bg-white/80 dark:bg-emerald-900/50 border-slate-200/80 dark:border-emerald-400/20 text-slate-600 dark:text-emerald-200'
                          }`}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          aria-label="Edytuj nazwę i opis migawki"
                          title="Edytuj nazwę i opis"
                          onClick={() => beginInlineEdit(snap)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-emerald-900/50 border border-slate-200/80 dark:border-emerald-400/20 text-slate-600 dark:text-emerald-200 hover:text-slate-900 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          aria-label={`Usuń migawkę ${snap.label}`}
                          title="Usuń migawkę z Firestore"
                          onClick={() => deleteStudioSnapshot(snap.id)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-emerald-900/50 border border-slate-200/80 dark:border-emerald-400/20 text-slate-500 hover:text-rose-600 dark:text-emerald-200/75 dark:hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Diff Table Comparing Snapshot vs Live Studio State */}
                    {isInspected && (
                      <div className="pt-2 overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200/80 dark:border-emerald-400/20 text-slate-500 dark:text-emerald-300/80">
                              <th className="py-2 pr-4 font-medium">Obszar konfiguracji</th>
                              <th className="py-2 px-4 font-medium">Zapisano w migawce</th>
                              <th className="py-2 pl-4 font-medium">Bieżący stan studia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/50 dark:divide-emerald-400/10 font-mono tabular-nums">
                            {diffs.map((row) => (
                              <tr key={row.parameter}>
                                <td className="py-2 pr-4 font-sans font-medium text-slate-800 dark:text-emerald-100 whitespace-nowrap">
                                  {row.parameter}
                                </td>
                                <td className="py-2 px-4 text-slate-700 dark:text-emerald-200">
                                  {row.inSnapshot}
                                </td>
                                <td
                                  className={`py-2 pl-4 ${
                                    row.changed
                                      ? 'text-indigo-700 dark:text-amber-300 font-semibold'
                                      : 'text-slate-500 dark:text-emerald-300/70'
                                  }`}
                                >
                                  {row.inCurrentStudio}
                                  {row.changed ? ' (zmieniono)' : ' (identyczny)'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};
