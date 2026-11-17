import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FolderGit2,
  GitBranch,
  KeyRound,
  Loader2,
  PlugZap,
  Sparkles,
  X,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { hapticAudio } from '../lib/hapticAudioEngine';
import {
  buildCompleteFrontendRepositoryFiles,
  BuildFrontendRepositoryInput,
  downloadRepositoryZipBundle,
  exportRepositoryToGitHub,
} from '../lib/githubRepoExporter';
import { copyTextToClipboard } from '../lib/screenImagePromptGenerator';
import { slugifyExportName } from '../lib/screenMapExport';
import { safeLocalGet, safeLocalSet } from '../lib/studioAccountAuth';
import { GitHubRepoExportResult } from '../types/studio';

const GH_SESSION_TOKEN_KEY = 'aether_github_export_pat_v1';

export const GitHubRepoExportModal: React.FC<{
  compiledMasterPrompt: string;
}> = ({ compiledMasterPrompt }) => {
  const {
    gitHubExportModalOpen,
    setGitHubExportModalOpen,
    palette,
    depth,
    engraving,
    synth,
    haptic,
    patterns,
    activeScreenMap,
    generatedElements,
    attachedPromptGraphics,
    activeBuildMatrix,
    externalPlugins,
    gitHubRepoProfile,
    updateGitHubRepoProfile,
    regenerateGitHubRepoProfileWithAi,
    setPluginsModalOpen,
  } = useStudio();

  const [repoName, setRepoName] = useState<string>(() =>
    slugifyExportName(activeScreenMap.name || 'aether-tactile-studio')
  );
  const [topicsDraft, setTopicsDraft] = useState<string>(() =>
    gitHubRepoProfile.topics.join(', ')
  );
  const [branch, setBranch] = useState<string>('main');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [commitMessage, setCommitMessage] = useState<string>(
    'feat: export designed frontend model, tactile elements & app plugins'
  );
  const [githubToken, setGithubToken] = useState<string>(
    () => safeLocalGet(GH_SESSION_TOKEN_KEY) || ''
  );
  const [oauthUserLogin, setOauthUserLogin] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('README.md');

  const [pushing, setPushing] = useState<boolean>(false);
  const [regeneratingAiDesc, setRegeneratingAiDesc] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<GitHubRepoExportResult | null>(
    null
  );
  const [zipFeedback, setZipFeedback] = useState<string | null>(null);

  const isDark = palette === 'emerald-clinic';

  useEffect(() => {
    setRepoName(slugifyExportName(activeScreenMap.name || 'aether-tactile-studio'));
  }, [activeScreenMap.name]);

  useEffect(() => {
    setTopicsDraft(gitHubRepoProfile.topics.join(', '));
  }, [gitHubRepoProfile.topics]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost')
      ) {
        return;
      }
      if (event.data?.type === 'GITHUB_OAUTH_SUCCESS' && event.data?.accessToken) {
        const token = String(event.data.accessToken);
        setGithubToken(token);
        safeLocalSet(GH_SESSION_TOKEN_KEY, token);
        setOauthUserLogin(String(event.data.login || 'Połączono z GitHub'));
        setOauthNotice(null);
        setErrorMsg(null);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const bundleInput: BuildFrontendRepositoryInput = useMemo(
    () => ({
      repoName,
      repoDescription: gitHubRepoProfile.shortAboutDescription,
      repoProfile: gitHubRepoProfile,
      externalPlugins,
      screenMap: activeScreenMap,
      generatedElements,
      attachedGraphics: attachedPromptGraphics,
      masterPromptText: compiledMasterPrompt,
      palette,
      depth,
      engraving,
      synth,
      haptic,
      activeBuildMatrix,
    }),
    [
      repoName,
      gitHubRepoProfile,
      externalPlugins,
      activeScreenMap,
      generatedElements,
      attachedPromptGraphics,
      compiledMasterPrompt,
      palette,
      depth,
      engraving,
      synth,
      haptic,
      activeBuildMatrix,
    ]
  );

  const previewFiles = useMemo(() => {
    if (!gitHubExportModalOpen) return [];
    return buildCompleteFrontendRepositoryFiles(bundleInput);
  }, [gitHubExportModalOpen, bundleInput]);

  const readmeFileEntry = useMemo(
    () => previewFiles.find((f) => f.path === 'README.md'),
    [previewFiles]
  );

  const activePreviewFile = useMemo(
    () =>
      previewFiles.find((f) => f.path === selectedFilePath) || previewFiles[0],
    [previewFiles, selectedFilePath]
  );

  if (!gitHubExportModalOpen) return null;

  const triggerCopyField = async (key: string, value: string) => {
    const ok = await copyTextToClipboard(value);
    if (ok) {
      setCopiedField(key);
      hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 3 });
      window.setTimeout(() => setCopiedField(null), 1800);
    }
  };

  const handleTopicsBlur = () => {
    const parsedTopics = topicsDraft
      .split(/[,;\s]+/)
      .map((t) =>
        t
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '')
      )
      .filter(Boolean)
      .slice(0, 15);
    if (parsedTopics.length > 0) {
      updateGitHubRepoProfile({ topics: parsedTopics });
    }
  };

  const handleRegenerateProfileAi = async () => {
    setRegeneratingAiDesc(true);
    setErrorMsg(null);
    try {
      await regenerateGitHubRepoProfileWithAi();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Nie udało się wygenerować opisu repozytorium.'
      );
    } finally {
      setRegeneratingAiDesc(false);
    }
  };

  const handleConnectGitHubOAuth = async () => {
    setErrorMsg(null);
    setOauthNotice(null);
    try {
      const originParam = encodeURIComponent(window.location.origin);
      const resp = await fetch(`/api/github/oauth/url?origin=${originParam}`);
      const data = await resp.json();
      if (!data?.configured || !data?.url) {
        setOauthNotice(
          data?.message ||
            'OAuth GitHub nie ma jeszcze skonfigurowanego GITHUB_CLIENT_ID — wklej poniżej Personal Access Token GitHub lub pobierz paczkę Git (.zip).'
        );
        return;
      }
      const popup = window.open(
        data.url,
        'github_oauth_popup',
        'width=620,height=720'
      );
      if (!popup) {
        setErrorMsg(
          'Przeglądarka zablokowała okno podręczne OAuth. Zezwól na popupy lub użyj tokenu GitHub poniżej.'
        );
      }
    } catch {
      setOauthNotice(
        'W trybie Offline użyj przycisku pobrania gotowego repozytorium Git (.zip) lub połącz się z siecią, aby wypchnąć commit przez GitHub API.'
      );
    }
  };

  const handlePushToGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setExportResult(null);

    if (!githubToken.trim()) {
      setErrorMsg(
        'Połącz konto GitHub lub wklej token GitHub (Personal Access Token z uprawnieniem repo / Contents: Read & Write).'
      );
      return;
    }

    setPushing(true);
    try {
      safeLocalSet(GH_SESSION_TOKEN_KEY, githubToken.trim());
      const res = await exportRepositoryToGitHub({
        githubToken: githubToken.trim(),
        repoName,
        repoDescription: gitHubRepoProfile.shortAboutDescription,
        isPrivate,
        branch,
        commitMessage,
        bundleInput,
      });
      setExportResult(res);
      hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 7 });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Nie udało się wyeksportować repozytorium na GitHub.'
      );
    } finally {
      setPushing(false);
    }
  };

  const handleDownloadZip = () => {
    const info = downloadRepositoryZipBundle(bundleInput);
    setZipFeedback(
      `Pobrano archiwum ${info.fileName} (${info.filesCount} plików, ${(
        info.sizeBytes / 1024
      ).toFixed(1)} KB)`
    );
    hapticAudio.triggerPress(synth, haptic, patterns, { pitchSemitones: 5 });
    window.setTimeout(() => setZipFeedback(null), 5000);
  };

  const activePluginsCount = externalPlugins.filter((p) => p.enabled).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Eksport repozytorium na GitHub"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md"
    >
      <div
        className={`w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border p-6 sm:p-8 shadow-2xl space-y-6 ${
          isDark
            ? 'bg-[#081C17] border-emerald-400/25 text-emerald-50'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-emerald-300/80 flex flex-wrap items-center gap-1.5">
              <span>Opis i Eksport Repozytorium GitHub</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {previewFiles.length} plików · {generatedElements.length} modułów .tsx · {activePluginsCount} aktywnych wtyczek
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mt-1">
              Pakiet Opisu Aplikacji i Eksport Repozytorium na GitHub
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setGitHubExportModalOpen(false)}
            aria-label="Zamknij okno eksportu GitHub"
            className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-emerald-900/70 text-slate-600 dark:text-emerald-100 inline-flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Ready-to-Copy GitHub Repository Creation Description Package */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-emerald-400/25 bg-slate-50/90 dark:bg-emerald-950/60 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              Gotowy pakiet opisu do utworzenia repozytorium na GitHub (pola About, Topics i README.md)
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={regeneratingAiDesc}
                onClick={handleRegenerateProfileAi}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 dark:bg-emerald-400 text-white dark:text-emerald-950 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {regeneratingAiDesc ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Dopasuj opis AI</span>
              </button>

              {readmeFileEntry && (
                <button
                  type="button"
                  onClick={() => triggerCopyField('readme', readmeFileEntry.content)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-emerald-900/80 border border-slate-200 dark:border-emerald-400/25 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {copiedField === 'readme' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiedField === 'readme'
                      ? 'Skopiowano README.md'
                      : 'Kopiuj pełne README.md'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setGitHubExportModalOpen(false);
                  setPluginsModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-emerald-900/80 border border-slate-200 dark:border-emerald-400/25 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <PlugZap className="w-3.5 h-3.5" />
                <span>Wtyczki aplikacji ({activePluginsCount})</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-emerald-200/85">
              <span>
                Krótki opis GitHub („About” — {gitHubRepoProfile.shortAboutDescription.length}/350 zn.)
              </span>
              <button
                type="button"
                onClick={() =>
                  triggerCopyField('about', gitHubRepoProfile.shortAboutDescription)
                }
                className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-emerald-300 cursor-pointer"
              >
                {copiedField === 'about' ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedField === 'about' ? 'Skopiowano' : 'Kopiuj opis About'}</span>
              </button>
            </div>
            <textarea
              rows={2}
              maxLength={350}
              value={gitHubRepoProfile.shortAboutDescription}
              onChange={(e) =>
                updateGitHubRepoProfile({ shortAboutDescription: e.target.value })
              }
              className="w-full p-2.5 rounded-xl text-xs bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-emerald-200/85">
              <span>Tematy / Tagi repozytorium GitHub (Topics)</span>
              <button
                type="button"
                onClick={() =>
                  triggerCopyField('topics', gitHubRepoProfile.topics.join(', '))
                }
                className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-emerald-300 cursor-pointer"
              >
                {copiedField === 'topics' ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedField === 'topics' ? 'Skopiowano tagi' : 'Kopiuj tagi'}</span>
              </button>
            </div>
            <input
              type="text"
              value={topicsDraft}
              onChange={(e) => setTopicsDraft(e.target.value)}
              onBlur={handleTopicsBlur}
              className="w-full h-9 px-3 rounded-xl text-xs font-mono bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: GitHub Push Form + Instant ZIP Download */}
          <form
            onSubmit={handlePushToGitHub}
            className="lg:col-span-6 space-y-4"
          >
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-emerald-400/20 bg-slate-50/80 dark:bg-emerald-950/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  1. Autoryzacja Konta GitHub
                </span>
                <button
                  type="button"
                  onClick={handleConnectGitHubOAuth}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <FolderGit2 className="w-3.5 h-3.5" />
                  <span>
                    {oauthUserLogin
                      ? `Połączono: ${oauthUserLogin}`
                      : 'Połącz przez GitHub OAuth'}
                  </span>
                </button>
              </div>

              {oauthNotice && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  {oauthNotice}
                </p>
              )}

              <label className="block space-y-1">
                <span className="text-[11px] text-slate-600 dark:text-emerald-200/80 flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  <span>
                    Token dostępowy GitHub (Personal Access Token z uprawnieniem repo)
                  </span>
                </span>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_... lub github_pat_..."
                  className="w-full h-10 px-3 rounded-xl text-xs font-mono bg-white dark:bg-emerald-950 border border-slate-200 dark:border-emerald-400/25 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 block">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-emerald-100">
                    Nazwa repozytorium
                  </span>
                  <button
                    type="button"
                    onClick={() => triggerCopyField('slug', repoName)}
                    className="text-[11px] text-indigo-600 dark:text-emerald-300 cursor-pointer"
                  >
                    {copiedField === 'slug' ? 'Skopiowano' : 'Kopiuj'}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl text-xs font-mono bg-slate-50 dark:bg-emerald-950/75 border border-slate-200 dark:border-emerald-400/25"
                />
              </div>

              <label className="space-y-1 block">
                <span className="text-xs font-medium text-slate-700 dark:text-emerald-100">
                  Gałąź docelowa
                </span>
                <input
                  type="text"
                  required
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl text-xs font-mono bg-slate-50 dark:bg-emerald-950/75 border border-slate-200 dark:border-emerald-400/25"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded accent-indigo-600 dark:accent-emerald-400"
                />
                <span>Utwórz jako repozytorium prywatne</span>
              </label>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-medium text-slate-700 dark:text-emerald-100">
                Wiadomość commita Git
              </span>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-xs font-mono bg-slate-50 dark:bg-emerald-950/75 border border-slate-200 dark:border-emerald-400/25"
              />
            </label>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-400/30 text-xs text-rose-700 dark:text-rose-200">
                {errorMsg}
              </div>
            )}

            {exportResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/45 border border-emerald-200 dark:border-emerald-400/35 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>
                    Wypchnięto {exportResult.filesCount} plików do {exportResult.repoFullName} ({exportResult.branch})
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-emerald-800 dark:text-emerald-200/80">
                    Commit: {exportResult.commitSha.slice(0, 8)}
                  </span>
                  <a
                    href={exportResult.repoHtmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold underline text-emerald-900 dark:text-emerald-200"
                  >
                    <span>Otwórz na GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {zipFeedback && (
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-emerald-900/40 border border-indigo-200 dark:border-emerald-400/30 text-xs text-indigo-900 dark:text-emerald-100">
                {zipFeedback}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={pushing}
                className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-emerald-400 text-white dark:text-emerald-950 hover:opacity-95 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {pushing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Wysyłanie drzewa Git na GitHub...</span>
                  </>
                ) : (
                  <>
                    <GitBranch className="w-4 h-4" />
                    <span>Wypchnij Repozytorium na GitHub</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadZip}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-emerald-900/75 border border-slate-200 dark:border-emerald-400/25 text-slate-800 dark:text-emerald-50 hover:opacity-95 inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Pobierz Paczkę Git (.zip)</span>
              </button>
            </div>
          </form>

          {/* Right Column: Live Repository File Tree & Code Inspector */}
          <div className="lg:col-span-6 space-y-3">
            <div className="text-xs font-semibold text-slate-700 dark:text-emerald-100 flex items-center justify-between">
              <span>Podgląd wygenerowanych plików repozytorium (w tym README.md i plugins/)</span>
              <span className="font-mono tabular-nums text-slate-500 dark:text-emerald-300/80">
                {previewFiles.length} plików
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-2xl bg-slate-100/80 dark:bg-emerald-950/70 border border-slate-200/80 dark:border-emerald-400/20">
              {previewFiles.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedFilePath(file.path)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    activePreviewFile?.path === file.path
                      ? isDark
                        ? 'bg-emerald-400 text-emerald-950 font-semibold'
                        : 'bg-slate-900 text-white font-semibold'
                      : 'bg-white/80 dark:bg-emerald-900/55 text-slate-700 dark:text-emerald-100'
                  }`}
                >
                  <FileCode2 className="w-3 h-3 shrink-0" />
                  <span>{file.path}</span>
                </button>
              ))}
            </div>

            {activePreviewFile && (
              <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-100">
                <div className="px-3.5 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>{activePreviewFile.path}</span>
                  <span>
                    {activePreviewFile.encoding === 'base64'
                      ? 'Zasób binarny Base64'
                      : `${activePreviewFile.content.split('\n').length} linii`}
                  </span>
                </div>
                <pre className="p-3.5 text-[11px] font-mono overflow-x-auto max-h-[300px] leading-relaxed">
                  <code>
                    {activePreviewFile.encoding === 'base64'
                      ? `[Załączona grafika referencyjna zakodowana w Base64 — ${activePreviewFile.content.length} znaków]`
                      : activePreviewFile.content}
                  </code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
