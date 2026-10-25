import React, { useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Film,
  Search,
  Trash2,
  RefreshCw,
  Check,
  X,
  Calendar,
  Tag,
  MessageSquare,
  Heart,
  Eye,
  ListPlus,
  Clock,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../i18n/LanguageContext';
import { tmdb, type TMDBSearchResult } from '../services/tmdb';
import {
  MAX_IMPORT_FILE_BYTES,
  parseImportFileContent,
  parseLetterboxdZipArchive,
  matchImportRowsWithTmdb,
  generateSampleLetterboxdCsv,
  type ImportDestination,
  type MatchedImportItem,
  type ImportFormatKind,
  type ZipExtraBundles,
} from '../utils/letterboxdImport';

export interface InlineListImportItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  notes: string;
  director?: string;
}

interface LetterboxdImportViewProps {
  /** Destination pré-selecionada ('profile' | 'list' | 'watchlist') */
  initialDestination?: ImportDestination;
  /** Quando usado dentro de CreateListPage, trava no modo lista e devolve os itens ao confirmar */
  inlineListMode?: {
    hasExistingItems: boolean;
    onApplyListItems: (
      items: InlineListImportItem[],
      options: {
        replaceExisting: boolean;
        markAsWatched: boolean;
        detectedTitle?: string;
        detectedDescription?: string;
        detectedTags?: string[];
      },
    ) => void;
    onClose?: () => void;
  };
  /** Oculta a documentação extensa quando embutido em modal compacto */
  compact?: boolean;
}

const FORMAT_LABELS: Record<ImportFormatKind, string> = {
  letterboxd_zip: 'Letterboxd Export ZIP',
  letterboxd_csv: 'Letterboxd CSV',
  letterboxd_list_csv: 'Letterboxd List CSV',
  imdb_csv: 'IMDb Export CSV',
  icheckmovies_csv: 'ICheckMovies Export',
  delicious_xml: 'Delicious Library XML',
};

const THIRD_PARTY_TOOLS = [
  { name: 'AlloCiné → Letterboxd', author: 'Adam Tbatou' },
  { name: 'AlloCiné → Letterboxd (Go)', author: 'Ancelotow' },
  { name: 'Cinemaniac → Letterboxd', author: 'Alessandro Baldazzi' },
  { name: 'Cineplayers → Letterboxd', author: 'Caio Freitas' },
  { name: 'Criticker → Letterboxd', author: 'mnzeric' },
  { name: 'ČSFD exporter', author: 'Jakub Valenta' },
  { name: 'ČSFD migrator', author: 'Lukas Bartak' },
  { name: 'Douban → Letterboxd (Chrome extension)', author: 'Zheng' },
  { name: 'Filmow → Letterboxd', author: 'Lucas Meireles' },
  { name: 'Filmweb → Letterboxd', author: 'Jakub Serwatka' },
  { name: 'FlickRack → Letterboxd', author: 'Robin Schäfer' },
  { name: 'IMDb matcher (matches film titles to IMDb IDs)', author: 'Daniel Crouch' },
  { name: 'JustWatch → Letterboxd', author: 'Rohit Vighne' },
  { name: 'Kinopoisk → Letterboxd', author: 'Egor Tolstoy' },
  { name: 'Moviepilot data exporter', author: 'Max Kruse' },
  { name: 'MUBI → Letterboxd (Go)', author: 'Igor Rudenko' },
  { name: 'MUBI → Letterboxd (Python)', author: 'Igor Rudenko' },
  { name: 'MUBI → Letterboxd (Python)', author: 'AL Kleijngeld' },
  { name: 'Must → Letterboxd', author: 'iterlace' },
  { name: 'Must data exporter', author: 'Alessandro Rizzi' },
  { name: 'Plex → Letterboxd', author: 'Max Timkovich' },
  { name: 'RateYourMusic → Letterboxd', author: 'Joe Traversy' },
  { name: 'SensCritique → Letterboxd', author: 'rx342' },
  { name: 'RatS (Rating Synchronization for IMDb, Netflix, etc.)', author: 'StegSchreck' },
  { name: 'Ratings exporter for Rotten Tomatoes', author: 'Moglum' },
  { name: 'Simkl exporter', author: 'Nil Silva' },
  { name: 'Trakt → Letterboxd', author: 'Anoop Sankar' },
  { name: 'XML to CSV converter (Listal, etc.)', author: 'Data.Page' },
  { name: 'CSV generator for Filmow', author: 'Larissa Gusmão' },
  { name: 'CSV generator for Filmow (Portuguese)', author: 'Myanari' },
  { name: 'CSV generator for FilmAffinity', author: 'Pablo Baeyens' },
  { name: 'CSV generator for Vudu', author: 'Tieg Zaharia' },
  { name: 'CSV converter for Lovefilm', author: 'Ian Wootten' },
  { name: 'CSV converter for MovieLens', author: 'Jonah Lawrence' },
  { name: 'CSV converter for Netflix and Prime Video (Python)', author: 'Ufuk Karaca' },
  { name: 'CSV tidier for Letterboxd imports', author: 'Mighty Merge' },
];

export const LetterboxdImportView: React.FC<LetterboxdImportViewProps> = ({
  initialDestination = 'profile',
  inlineListMode,
  compact = false,
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isPt = language === 'pt-BR';
  const {
    logs,
    lists,
    importToProfile,
    importToWatchlist,
    importToList,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [destination, setDestination] = useState<ImportDestination>(
    inlineListMode ? 'list' : initialDestination,
  );
  const [targetListId, setTargetListId] = useState<string>('new');
  const [newListTitle, setNewListTitle] = useState<string>('');
  const [newListDescription, setNewListDescription] = useState<string>('');
  const [newListTags, setNewListTags] = useState<string[]>([]);
  const [replaceExistingList, setReplaceExistingList] = useState<boolean>(false);
  const [markListFilmsWatched, setMarkListFilmsWatched] = useState<boolean>(false);

  // Etapas: 'idle' -> 'matching' -> 'preview' -> 'done'
  const [stage, setStage] = useState<'idle' | 'matching' | 'preview' | 'done'>('idle');
  const [fileName, setFileName] = useState<string>('');
  const [detectedFormat, setDetectedFormat] = useState<ImportFormatKind>('letterboxd_csv');
  const [progress, setProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });
  const [matchedItems, setMatchedItems] = useState<MatchedImportItem[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'matched' | 'best_guess' | 'attention'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [doneSummary, setDoneSummary] = useState<{
    destination: ImportDestination;
    headline: string;
    details: string[];
    targetLink?: { to: string; label: string };
  } | null>(null);

  const [zipExtras, setZipExtras] = useState<ZipExtraBundles | null>(null);
  const [alsoImportZipWatchlist, setAlsoImportZipWatchlist] = useState<boolean>(true);
  const [alsoImportZipLists, setAlsoImportZipLists] = useState<boolean>(true);
  const [selectedZipListIndex, setSelectedZipListIndex] = useState<number>(0);

  // Controle de busca manual para corrigir um filme na tela de resumo ("Fix match")
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [manualSearchQuery, setManualSearchQuery] = useState<string>('');
  const [manualSearchResults, setManualSearchResults] = useState<TMDBSearchResult[]>([]);
  const [isManualSearching, setIsManualSearching] = useState<boolean>(false);

  // Acordeões de documentação
  const [showFormatSpec, setShowFormatSpec] = useState<boolean>(!compact);
  const [showNotesSpec, setShowNotesSpec] = useState<boolean>(!compact);
  const [showToolsSpec, setShowToolsSpec] = useState<boolean>(false);

  // Conjunto de chaves `${movieId}:${watchedDate}` já existentes no Diário do usuário
  const existingDiaryKeys = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      if (l.movieId && l.watchedDate) {
        set.add(`${l.movieId}:${l.watchedDate}`);
      }
    }
    return set;
  }, [logs]);

  const handleDownloadSampleCsv = () => {
    const sample = generateSampleLetterboxdCsv();
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'letterboxd-import-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectZipListIndex = async (idx: number) => {
    if (!zipExtras || !zipExtras.lists[idx]) return;
    setSelectedZipListIndex(idx);
    const chosen = zipExtras.lists[idx];
    setNewListTitle(chosen.title);
    setNewListDescription(chosen.description || '');
    setNewListTags(chosen.tags || []);
    setStage('matching');
    const matched = await matchImportRowsWithTmdb(
      chosen.rows.map((r, i) => ({ ...r, rowNumber: i + 1, sourceFile: chosen.fileName })),
      existingDiaryKeys,
      (completed, total) => setProgress({ completed, total }),
    );
    setMatchedItems(matched);
    setPreviewFilter('all');
    setStage('preview');
  };

  const handleSelectFile = async (file: File) => {
    setErrorMsg(null);
    setDoneSummary(null);
    setZipExtras(null);
    setSelectedZipListIndex(0);

    // Regra oficial do Letterboxd: limite de 1MB por arquivo
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setErrorMsg(
        isPt
          ? 'Existe um limite de tamanho de arquivo de 1 MB. Divida arquivos grandes em partes menores (a primeira linha com os títulos das colunas deve estar em cada arquivo).'
          : 'There is a file size limit of 1MB, so you’ll need to divide large files into multiple smaller files (the header row containing column names must be in every file).',
      );
      return;
    }

    try {
      const isZip =
        file.name.toLowerCase().endsWith('.zip') ||
        file.type === 'application/zip' ||
        file.type === 'application/x-zip-compressed';

      const parsed = isZip
        ? await parseLetterboxdZipArchive(await file.arrayBuffer(), destination)
        : parseImportFileContent(await file.text(), file.name, destination);

      if (!parsed.ok) {
        if (parsed.errorKey === 'imp_err_delicious_list_only') {
          setErrorMsg(
            isPt
              ? 'Arquivos do Delicious Library (XML) só são suportados ao importar para uma lista.'
              : 'Delicious Library files (XML) are only supported when importing to a list.',
          );
        } else {
          setErrorMsg(parsed.errorMessage || (isPt ? 'Falha ao ler arquivo.' : 'Failed to parse file.'));
        }
        return;
      }

      setFileName(file.name);
      setDetectedFormat(parsed.format || 'letterboxd_csv');
      if (parsed.zipExtras) {
        setZipExtras(parsed.zipExtras);
        setAlsoImportZipWatchlist(parsed.zipExtras.watchlistRows.length > 0);
        setAlsoImportZipLists(parsed.zipExtras.lists.length > 0);
      }

      if (parsed.detectedListMeta) {
        if (parsed.detectedListMeta.title) {
          setNewListTitle(parsed.detectedListMeta.title);
        }
        if (parsed.detectedListMeta.description) {
          setNewListDescription(parsed.detectedListMeta.description);
        }
        if (parsed.detectedListMeta.tags && parsed.detectedListMeta.tags.length > 0) {
          setNewListTags(parsed.detectedListMeta.tags);
        }
      } else if (!newListTitle) {
        const cleanBase = file.name.replace(/\.(csv|xml|zip)$/i, '').replace(/[-_]+/g, ' ').trim();
        setNewListTitle(cleanBase || 'Imported List');
      }

      setStage('matching');
      const matched = await matchImportRowsWithTmdb(
        parsed.rows,
        existingDiaryKeys,
        (completed, total) => setProgress({ completed, total }),
      );
      setMatchedItems(matched);
      setPreviewFilter('all');
      setStage('preview');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isPt
            ? 'Erro ao processar arquivo de importação.'
            : 'Error processing import file.',
      );
      setStage('idle');
    }
  };

  const toggleItemSelection = (id: string) => {
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.matchedMovie) return item;
        return { ...item, selected: !item.selected };
      }),
    );
  };

  const removeItemFromImport = (id: string) => {
    setMatchedItems((prev) => prev.filter((item) => item.id !== id));
    if (editingRowId === id) {
      setEditingRowId(null);
    }
  };

  const openFixMatchPanel = (item: MatchedImportItem) => {
    if (editingRowId === item.id) {
      setEditingRowId(null);
      return;
    }
    setEditingRowId(item.id);
    setManualSearchQuery(
      [item.raw.title, item.raw.year].filter(Boolean).join(' '),
    );
    setManualSearchResults(item.alternatives || []);
  };

  const runManualSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = manualSearchQuery.trim();
    if (!q) return;
    setIsManualSearching(true);
    try {
      const results = await tmdb.searchEnriched(q, 'movie', 1);
      setManualSearchResults(results.slice(0, 8));
    } catch {
      setManualSearchResults([]);
    } finally {
      setIsManualSearching(false);
    }
  };

  const selectReplacementMovie = (rowId: string, movie: TMDBSearchResult) => {
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) return item;
        const wDate = item.raw.watchedDate;
        const updatesExisting = wDate ? existingDiaryKeys.has(`${movie.id}:${wDate}`) : false;
        return {
          ...item,
          matchedMovie: movie,
          confidence: 'exact_id',
          selected: true,
          updatesExistingDiary: updatesExisting,
        };
      }),
    );
    setEditingRowId(null);
  };

  // Estatísticas do resumo pré-confirmação
  const stats = useMemo(() => {
    const total = matchedItems.length;
    const selectedItems = matchedItems.filter((i) => i.selected && i.matchedMovie);
    const exactCount = matchedItems.filter((i) => i.confidence === 'exact_id').length;
    const bestGuessCount = matchedItems.filter((i) => i.confidence === 'best_guess').length;
    const attentionCount = matchedItems.filter(
      (i) => i.confidence === 'unmatched' || i.confidence === 'tv_warning',
    ).length;
    const diaryEntriesCount = selectedItems.filter((i) => Boolean(i.raw.watchedDate)).length;
    const diaryUpdatesCount = selectedItems.filter((i) => Boolean(i.updatesExistingDiary)).length;
    const ratingsCount = selectedItems.filter((i) => i.raw.rating > 0).length;
    const reviewsCount = selectedItems.filter((i) => Boolean(i.raw.review.trim())).length;
    const combinedDuplicatesCount = matchedItems.reduce(
      (acc, i) => acc + (i.combinedCount > 1 ? i.combinedCount - 1 : 0),
      0,
    );

    return {
      total,
      selectedCount: selectedItems.length,
      exactCount,
      bestGuessCount,
      attentionCount,
      diaryEntriesCount,
      diaryUpdatesCount,
      ratingsCount,
      reviewsCount,
      combinedDuplicatesCount,
    };
  }, [matchedItems]);

  const filteredPreviewItems = useMemo(() => {
    if (previewFilter === 'matched') {
      return matchedItems.filter((i) => i.matchedMovie !== null);
    }
    if (previewFilter === 'best_guess') {
      return matchedItems.filter((i) => i.confidence === 'best_guess');
    }
    if (previewFilter === 'attention') {
      return matchedItems.filter(
        (i) => i.confidence === 'unmatched' || i.confidence === 'tv_warning',
      );
    }
    return matchedItems;
  }, [matchedItems, previewFilter]);

  const handleConfirmImport = async () => {
    const validSelected = matchedItems.filter(
      (i): i is MatchedImportItem & { matchedMovie: TMDBSearchResult } =>
        i.selected && i.matchedMovie !== null,
    );
    if (validSelected.length === 0 || isSaving) return;

    setIsSaving(true);
    setErrorMsg(null);

    try {
      // Modo inline dentro do CreateListPage
      if (inlineListMode) {
        const listItems: InlineListImportItem[] = validSelected.map((i) => ({
          id: i.matchedMovie.id,
          title: i.matchedMovie.title,
          poster_path: i.matchedMovie.poster_path,
          release_date: i.matchedMovie.release_date || '',
          // Na importação para lista, a coluna Review popula o campo Notes
          notes: i.raw.review || '',
          director: i.matchedMovie.directors?.[0] || i.raw.directors?.[0],
        }));

        if (markListFilmsWatched) {
          await importToProfile(
            listItems.map((m) => ({
              movieId: m.id,
              movieTitle: m.title,
              moviePoster: m.poster_path,
              movieYear: m.release_date.slice(0, 4),
              watchedDate: '',
              rating: 0,
              isRewatch: false,
              liked: false,
              reviewText: '',
              tags: [],
            })),
          );
        }

        inlineListMode.onApplyListItems(listItems, {
          replaceExisting: replaceExistingList,
          markAsWatched: markListFilmsWatched,
          detectedTitle: newListTitle || undefined,
          detectedDescription: newListDescription || undefined,
          detectedTags: newListTags.length > 0 ? newListTags : undefined,
        });
        setStage('idle');
        setMatchedItems([]);
        return;
      }

      if (destination === 'profile') {
        const summary = await importToProfile(
          validSelected.map((i) => ({
            movieId: i.matchedMovie.id,
            movieTitle: i.matchedMovie.title,
            moviePoster: i.matchedMovie.poster_path,
            movieYear:
              i.matchedMovie.release_date?.slice(0, 4) || i.raw.year || '',
            watchedDate: i.raw.watchedDate,
            rating: i.raw.rating,
            isRewatch: i.raw.rewatch,
            liked: i.raw.liked,
            reviewText: i.raw.review,
            tags: i.raw.tags,
          })),
        );

        const details: string[] = [];
        details.push(
          isPt
            ? `${summary.watchedCount} filmes marcados como assistidos no seu Perfil.`
            : `${summary.watchedCount} films marked as watched on your Profile.`,
        );
        if (summary.diaryCreatedCount > 0) {
          details.push(
            isPt
              ? `${summary.diaryCreatedCount} novas entradas adicionadas ao seu Diário.`
              : `${summary.diaryCreatedCount} new Diary Entries created.`,
          );
        }
        if (summary.diaryUpdatedCount > 0) {
          details.push(
            isPt
              ? `${summary.diaryUpdatedCount} entradas existentes no Diário atualizadas (mesma WatchedDate).`
              : `${summary.diaryUpdatedCount} existing Diary Entries updated (matching WatchedDate).`,
          );
        }
        if (summary.ratingsCount > 0) {
          details.push(
            isPt
              ? `${summary.ratingsCount} avaliações salvas (escala 0.5–5.0 ★).`
              : `${summary.ratingsCount} ratings saved (0.5–5.0 ★ scale).`,
          );
        }
        if (summary.reviewsCount > 0) {
          details.push(
            isPt
              ? `${summary.reviewsCount} críticas/reviews importadas.`
              : `${summary.reviewsCount} reviews imported.`,
          );
        }

        // Se veio de um arquivo .zip do Letterboxd e o usuário marcou para importar também a Watchlist
        if (zipExtras && alsoImportZipWatchlist && zipExtras.watchlistRows.length > 0) {
          const matchedWl = await matchImportRowsWithTmdb(
            zipExtras.watchlistRows,
            existingDiaryKeys,
          );
          const validWl = matchedWl.filter(
            (x): x is MatchedImportItem & { matchedMovie: TMDBSearchResult } =>
              Boolean(x.matchedMovie),
          );
          if (validWl.length > 0) {
            const wlRes = await importToWatchlist(
              validWl.map((x) => ({
                id: x.matchedMovie.id,
                title: x.matchedMovie.title,
                poster_path: x.matchedMovie.poster_path,
                release_date: x.matchedMovie.release_date || '',
              })),
            );
            details.push(
              isPt
                ? `${wlRes.addedCount} filmes importados para sua Watchlist (de watchlist.csv no ZIP).`
                : `${wlRes.addedCount} films imported to your Watchlist (from watchlist.csv in ZIP).`,
            );
          }
        }

        // Se veio de um arquivo .zip do Letterboxd e o usuário marcou para importar também as Listas
        if (zipExtras && alsoImportZipLists && zipExtras.lists.length > 0) {
          let importedListsCount = 0;
          for (const lbList of zipExtras.lists) {
            const matchedList = await matchImportRowsWithTmdb(
              lbList.rows,
              existingDiaryKeys,
            );
            const validListItems = matchedList.filter(
              (x): x is MatchedImportItem & { matchedMovie: TMDBSearchResult } =>
                Boolean(x.matchedMovie),
            );
            if (validListItems.length > 0) {
              await importToList({
                targetListId: 'new',
                newListTitle: lbList.title,
                newListDescription: lbList.description,
                newListTags: lbList.tags,
                replaceExisting: false,
                markAsWatched: false,
                items: validListItems.map((x) => ({
                  id: x.matchedMovie.id,
                  title: x.matchedMovie.title,
                  poster_path: x.matchedMovie.poster_path,
                  release_date: x.matchedMovie.release_date || '',
                  notes: x.raw.review || undefined,
                  director: x.matchedMovie.directors?.[0] || x.raw.directors?.[0],
                })),
              });
              importedListsCount++;
            }
          }
          if (importedListsCount > 0) {
            details.push(
              isPt
                ? `${importedListsCount} lista(s) importada(s) da pasta lists/ do ZIP.`
                : `${importedListsCount} list(s) imported from the lists/ folder in ZIP.`,
            );
          }
        }

        setDoneSummary({
          destination: 'profile',
          headline: isPt ? 'Importação concluída com sucesso!' : 'Import completed successfully!',
          details,
          targetLink: {
            to: '/profile?tab=films',
            label: isPt ? 'Ver Todos os Filmes Assistidos' : 'View All Watched Films',
          },
        });
        setStage('done');
      } else if (destination === 'watchlist') {
        const res = await importToWatchlist(
          validSelected.map((i) => ({
            id: i.matchedMovie.id,
            title: i.matchedMovie.title,
            poster_path: i.matchedMovie.poster_path,
            release_date: i.matchedMovie.release_date || '',
          })),
        );

        const details: string[] = [
          isPt
            ? `${res.addedCount} filmes adicionados à sua Watchlist.`
            : `${res.addedCount} films added to your Watchlist.`,
        ];
        if (res.skippedCount > 0) {
          details.push(
            isPt
              ? `${res.skippedCount} filmes já estavam na sua Watchlist e foram mantidos.`
              : `${res.skippedCount} films were already in your Watchlist.`,
          );
        }

        setDoneSummary({
          destination: 'watchlist',
          headline: isPt ? 'Watchlist importada com sucesso!' : 'Watchlist imported successfully!',
          details,
          targetLink: {
            to: '/watchlist',
            label: isPt ? 'Abrir minha Watchlist' : 'Open my Watchlist',
          },
        });
        setStage('done');
      } else if (destination === 'list') {
        const res = await importToList({
          targetListId,
          newListTitle: newListTitle.trim() || 'Imported List',
          newListDescription,
          newListTags,
          replaceExisting: replaceExistingList,
          markAsWatched: markListFilmsWatched,
          items: validSelected.map((i) => ({
            id: i.matchedMovie.id,
            title: i.matchedMovie.title,
            poster_path: i.matchedMovie.poster_path,
            release_date: i.matchedMovie.release_date || '',
            notes: i.raw.review || undefined,
            director: i.matchedMovie.directors?.[0] || i.raw.directors?.[0],
          })),
        });

        const details: string[] = [
          isPt
            ? `${res.addedCount} filmes importados para a lista (total: ${res.totalCount} filmes).`
            : `${res.addedCount} films imported to the list (${res.totalCount} total films).`,
        ];
        if (markListFilmsWatched) {
          details.push(
            isPt
              ? 'Todos os filmes importados também foram marcados como assistidos no seu perfil.'
              : 'All imported films were also marked as watched on your profile.',
          );
        }

        setDoneSummary({
          destination: 'list',
          headline: isPt ? 'Lista importada com sucesso!' : 'List imported successfully!',
          details,
          targetLink: {
            to: `/list/${res.listId}`,
            label: isPt ? 'Ver Lista Importada' : 'View Imported List',
          },
        });
        setStage('done');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isPt
            ? 'Falha ao salvar dados importados.'
            : 'Failed to save imported data.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho estilo Letterboxd "Importing your data" */}
      {!inlineListMode && (
        <div className="bg-lb-surface border border-lb-elevated rounded-lg p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-lb-elevated pb-4 mb-5">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
                {isPt ? 'Importar seus dados (Padrão Letterboxd)' : 'Importing your data'}
              </h2>
              <p className="text-xs text-lb-text mt-1 leading-relaxed max-w-3xl">
                {isPt
                  ? 'Você pode importar dados de três maneiras: diretamente para sua conta (como filmes assistidos e/ou entradas do diário, com avaliações, críticas e tags opcionais), para uma lista nova ou existente, ou para sua Watchlist.'
                  : 'Members can import data in one of three ways: directly to their account (as watched films and/or diary entries, with optional ratings, reviews and tags), to a new or existing list, or to their watchlist.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#2c3440] hover:bg-[#384250] border border-white/10 text-xs font-bold text-[#ccddee] hover:text-white transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-lb-green" />
              <span>{isPt ? 'Baixar CSV de Exemplo' : 'Download Sample CSV'}</span>
            </button>
          </div>

          {/* 3 Modos de Destino */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setDestination('profile');
                setErrorMsg(null);
              }}
              className={`text-left p-4 rounded-md border transition-all cursor-pointer ${
                destination === 'profile'
                  ? 'bg-[#1f2933] border-lb-green shadow-[0_0_0_1px_rgba(0,224,84,0.35)]'
                  : 'bg-lb-bg border-lb-elevated hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-white">
                  <Eye className="w-4 h-4 text-lb-green" />
                  {isPt ? '1. Conta / Diário' : '1. Account & Diary'}
                </span>
                {destination === 'profile' && (
                  <span className="w-4 h-4 rounded-full bg-lb-green text-lb-bg flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-lb-muted leading-relaxed">
                {isPt
                  ? 'Importa filmes assistidos e/ou entradas do Diário com notas (Rating / Rating10), críticas, rewatch e tags.'
                  : 'Import watched films and/or diary entries with optional ratings, reviews, rewatch flag and tags.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setDestination('list');
                setErrorMsg(null);
              }}
              className={`text-left p-4 rounded-md border transition-all cursor-pointer ${
                destination === 'list'
                  ? 'bg-[#1f2933] border-lb-green shadow-[0_0_0_1px_rgba(0,224,84,0.35)]'
                  : 'bg-lb-bg border-lb-elevated hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-white">
                  <ListPlus className="w-4 h-4 text-lb-blue" />
                  {isPt ? '2. Lista (Nova ou Existente)' : '2. New or Existing List'}
                </span>
                {destination === 'list' && (
                  <span className="w-4 h-4 rounded-full bg-lb-green text-lb-bg flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-lb-muted leading-relaxed">
                {isPt
                  ? 'Adiciona ao final da lista ou substitui os itens existentes. Suporta coluna Review como notas e XML do Delicious Library.'
                  : 'Append to or replace a list. Supports Review column for item Notes and Delicious Library XML files.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setDestination('watchlist');
                setErrorMsg(null);
              }}
              className={`text-left p-4 rounded-md border transition-all cursor-pointer ${
                destination === 'watchlist'
                  ? 'bg-[#1f2933] border-lb-green shadow-[0_0_0_1px_rgba(0,224,84,0.35)]'
                  : 'bg-lb-bg border-lb-elevated hover:border-white/25'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-white">
                  <Clock className="w-4 h-4 text-orange-400" />
                  {isPt ? '3. Watchlist (Quero Ver)' : '3. Watchlist'}
                </span>
                {destination === 'watchlist' && (
                  <span className="w-4 h-4 rounded-full bg-lb-green text-lb-bg flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-lb-muted leading-relaxed">
                {isPt
                  ? 'Importa filmes de arquivos CSV do Letterboxd, IMDb ou ICheckMovies diretamente para sua Watchlist.'
                  : 'Import films from Letterboxd, IMDb or ICheckMovies CSV files directly to your Watchlist.'}
              </p>
            </button>
          </div>

          {/* Configurações extras quando o destino é uma Lista */}
          {destination === 'list' && (
            <div className="mt-4 pt-4 border-t border-lb-elevated grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-lb-muted mb-1.5">
                  {isPt ? 'Escolher Lista de Destino' : 'Target List'}
                </label>
                <select
                  value={targetListId}
                  onChange={(e) => setTargetListId(e.target.value)}
                  className="w-full bg-lb-bg border border-lb-elevated rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-lb-green"
                >
                  <option value="new">
                    {isPt ? '+ Criar uma nova lista' : '+ Create a new list'}
                  </option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title} ({l.movies.length} {isPt ? 'filmes' : 'films'})
                    </option>
                  ))}
                </select>
              </div>

              {targetListId === 'new' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-lb-muted mb-1.5">
                    {isPt ? 'Nome da Nova Lista' : 'New List Name'}
                  </label>
                  <input
                    type="text"
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    placeholder={isPt ? 'Ex.: Favoritos dos Anos 80' : 'e.g. 1980s Favorites'}
                    className="w-full bg-lb-bg border border-lb-elevated rounded px-3 py-2 text-xs text-white placeholder-lb-muted focus:outline-none focus:border-lb-green"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mensagem de erro */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">{errorMsg}</div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ETAPA 1: Upload de Arquivo (Idle) */}
      {stage === 'idle' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleSelectFile(f);
          }}
          className="bg-lb-surface border-2 border-dashed border-lb-elevated hover:border-lb-green/60 rounded-lg p-6 md:p-8 text-center transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={
              destination === 'list'
                ? '.zip,.csv,.xml,application/zip,application/x-zip-compressed,text/csv,text/xml,application/xml'
                : '.zip,.csv,application/zip,application/x-zip-compressed,text/csv'
            }
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleSelectFile(file);
              e.target.value = '';
            }}
          />

          <div className="w-12 h-12 rounded-full bg-lb-green/10 border border-lb-green/30 text-lb-green flex items-center justify-center mx-auto mb-3">
            <Upload className="w-5 h-5" />
          </div>

          <h3 className="text-sm md:text-base font-bold text-white mb-1">
            {isPt
              ? 'Selecione ou arraste seu arquivo .ZIP do Letterboxd ou arquivo .CSV'
              : 'Select or drag & drop your Letterboxd .ZIP export or .CSV file'}
          </h3>
          <p className="text-xs text-lb-muted max-w-xl mx-auto mb-4">
            {isPt ? (
              <>
                Formatos suportados: <strong>Arquivo .ZIP completo do Letterboxd</strong> (combina automaticamente{' '}
                <code>watched.csv</code>, <code>ratings.csv</code>, <code>diary.csv</code>, <code>reviews.csv</code>,{' '}
                <code>likes/films.csv</code>, <code>watchlist.csv</code> e <code>lists/</code>),{' '}
                <strong>Letterboxd CSV</strong> (UTF-8), <strong>IMDb export (CSV)</strong>,{' '}
                <strong>ICheckMovies</strong>
                {destination === 'list' && (
                  <>
                    {' '}
                    e <strong>Delicious Library v2/v3 (XML)</strong>
                  </>
                )}
                . Tamanho máximo: <strong>1 MB</strong>.
              </>
            ) : (
              <>
                Supported formats: <strong>Letterboxd Account Export (.ZIP)</strong> (automatically merges{' '}
                <code>watched.csv</code>, <code>ratings.csv</code>, <code>diary.csv</code>, <code>reviews.csv</code>,{' '}
                <code>likes/films.csv</code>, <code>watchlist.csv</code> &amp; <code>lists/</code>),{' '}
                <strong>Letterboxd import format (CSV)</strong>, <strong>IMDb export files (CSV)</strong>,{' '}
                <strong>ICheckMovies export files</strong>
                {destination === 'list' && (
                  <>
                    {' '}
                    and <strong>Delicious Library v2 or 3 export files (XML)</strong>
                  </>
                )}
                . Max file size: <strong>1MB</strong>.
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-log-green text-lb-bg font-black text-xs px-6 py-2.5 rounded uppercase tracking-widest cursor-pointer inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4 stroke-[2.5]" />
              <span>{isPt ? 'Selecionar Arquivo' : 'Select File'}</span>
            </button>

            {inlineListMode?.onClose && (
              <button
                type="button"
                onClick={inlineListMode.onClose}
                className="px-4 py-2.5 rounded bg-[#2c3440] hover:bg-[#384250] text-xs font-bold text-white cursor-pointer"
              >
                {isPt ? 'Cancelar' : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ETAPA 2: Matching no TMDB em Progresso */}
      {stage === 'matching' && (
        <div className="bg-lb-surface border border-lb-elevated rounded-lg p-8 text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-lb-green animate-spin mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">
              {isPt
                ? 'Identificando filmes no catálogo TMDB...'
                : 'Matching films against TMDB catalog...'}
            </h3>
            <p className="text-xs text-lb-muted mt-1">
              {fileName} — {progress.completed} / {progress.total}{' '}
              {isPt ? 'linhas processadas' : 'rows processed'}
            </p>
          </div>
          <div className="max-w-md mx-auto h-2 bg-lb-bg rounded-full overflow-hidden border border-lb-elevated">
            <div
              className="h-full bg-lb-green transition-all duration-200"
              style={{
                width: `${
                  progress.total > 0
                    ? Math.round((progress.completed / progress.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ETAPA 3: Resumo & Confirmação Pré-Importação ("Import Summary") */}
      {stage === 'preview' && (
        <div className="bg-lb-surface border border-lb-elevated rounded-lg overflow-hidden shadow-xl">
          {/* Topo do Resumo */}
          <div className="p-4 md:p-5 bg-[#181e24] border-b border-lb-elevated space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-lb-green/15 text-lb-green border border-lb-green/30">
                    {FORMAT_LABELS[detectedFormat]}
                  </span>
                  <span className="text-xs font-mono text-lb-muted">{fileName}</span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-white mt-1">
                  {isPt
                    ? 'Resumo da Importação — Revise antes de concluir'
                    : 'Import Summary — Review prior to completing the import'}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStage('idle');
                    setMatchedItems([]);
                  }}
                  className="px-3.5 py-2 rounded bg-[#2c3440] hover:bg-[#384250] text-xs font-bold text-[#ccddee] hover:text-white transition-colors cursor-pointer"
                >
                  {isPt ? 'Trocar Arquivo' : 'Change File'}
                </button>
                <button
                  type="button"
                  disabled={stats.selectedCount === 0 || isSaving}
                  onClick={() => void handleConfirmImport()}
                  className="btn-log-green text-lb-bg font-black text-xs px-5 py-2 rounded uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    {isSaving
                      ? isPt
                        ? 'Importando...'
                        : 'Importing...'
                      : isPt
                        ? `Confirmar e Importar (${stats.selectedCount})`
                        : `Complete Import (${stats.selectedCount})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Aviso oficial do Letterboxd: There is no undo after the confirmation step. Be careful! */}
            <div className="flex items-start gap-2 rounded bg-orange-500/10 border border-orange-500/30 px-3 py-2 text-xs text-orange-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-orange-400 mt-0.5" />
              <div>
                <strong className="font-bold">
                  {isPt
                    ? 'Não é possível desfazer após a confirmação. Tenha cuidado!'
                    : 'There is no undo after the confirmation step. Be careful!'}
                </strong>{' '}
                {isPt
                  ? 'Verifique abaixo se todos os títulos foram correspondidos corretamente, corrija eventuais títulos trocados ou remova entradas indesejadas (como séries de TV).'
                  : 'Review the summary below so you can fix any mismatched titles and/or remove any inappropriate entries (such as TV entries that have matched to similarly named films).'}
              </div>
            </div>

            {/* Se for um arquivo .ZIP do Letterboxd, exibe resumo dos arquivos internos detectados */}
            {detectedFormat === 'letterboxd_zip' && zipExtras && (
              <div className="rounded-md bg-[#14181c] border border-lb-green/40 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-lb-green flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {isPt
                      ? 'Pacote ZIP do Letterboxd extraído e mesclado automaticamente:'
                      : 'Letterboxd ZIP package automatically extracted and merged:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-[11px] font-mono text-lb-text">
                    {zipExtras.fileCounts.watched > 0 && (
                      <span className="px-2 py-0.5 rounded bg-lb-surface border border-lb-elevated">
                        watched.csv ({zipExtras.fileCounts.watched})
                      </span>
                    )}
                    {zipExtras.fileCounts.diary > 0 && (
                      <span className="px-2 py-0.5 rounded bg-lb-surface border border-lb-elevated">
                        diary.csv ({zipExtras.fileCounts.diary})
                      </span>
                    )}
                    {zipExtras.fileCounts.ratings > 0 && (
                      <span className="px-2 py-0.5 rounded bg-lb-surface border border-lb-elevated">
                        ratings.csv ({zipExtras.fileCounts.ratings})
                      </span>
                    )}
                    {zipExtras.fileCounts.reviews > 0 && (
                      <span className="px-2 py-0.5 rounded bg-lb-surface border border-lb-elevated">
                        reviews.csv ({zipExtras.fileCounts.reviews})
                      </span>
                    )}
                    {zipExtras.fileCounts.likes > 0 && (
                      <span className="px-2 py-0.5 rounded bg-lb-surface border border-lb-elevated">
                        likes/films.csv ({zipExtras.fileCounts.likes})
                      </span>
                    )}
                  </div>
                </div>

                {/* No modo Perfil, oferece importar também Watchlist e Listas presentes no ZIP de uma só vez */}
                {destination === 'profile' &&
                  (zipExtras.watchlistRows.length > 0 || zipExtras.lists.length > 0) && (
                    <div className="pt-2 border-t border-white/10 flex flex-wrap gap-4">
                      {zipExtras.watchlistRows.length > 0 && (
                        <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={alsoImportZipWatchlist}
                            onChange={(e) => setAlsoImportZipWatchlist(e.target.checked)}
                            className="rounded border-lb-elevated bg-lb-bg text-lb-green focus:ring-0"
                          />
                          <span>
                            {isPt
                              ? `Importar também Watchlist do ZIP (${zipExtras.watchlistRows.length} filmes em watchlist.csv)`
                              : `Also import Watchlist from ZIP (${zipExtras.watchlistRows.length} films in watchlist.csv)`}
                          </span>
                        </label>
                      )}
                      {zipExtras.lists.length > 0 && (
                        <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={alsoImportZipLists}
                            onChange={(e) => setAlsoImportZipLists(e.target.checked)}
                            className="rounded border-lb-elevated bg-lb-bg text-lb-green focus:ring-0"
                          />
                          <span>
                            {isPt
                              ? `Importar também ${zipExtras.lists.length} lista(s) da pasta lists/ do ZIP`
                              : `Also import ${zipExtras.lists.length} list(s) from lists/ folder in ZIP`}
                          </span>
                        </label>
                      )}
                    </div>
                  )}

                {/* No modo Lista, se houver múltiplas listas na pasta lists/ do ZIP, permite escolher qual carregar */}
                {(destination === 'list' || inlineListMode) && zipExtras.lists.length > 1 && (
                  <div className="pt-2 border-t border-white/10 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-lb-muted">
                      {isPt ? 'Lista dentro do ZIP:' : 'List inside ZIP:'}
                    </span>
                    <select
                      value={selectedZipListIndex}
                      onChange={(e) => void handleSelectZipListIndex(Number(e.target.value))}
                      className="bg-lb-surface border border-lb-elevated rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-lb-green"
                    >
                      {zipExtras.lists.map((l, idx) => (
                        <option key={l.fileName} value={idx}>
                          {l.title} ({l.rows.length} {isPt ? 'filmes' : 'films'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-center">
              <div className="bg-lb-bg border border-lb-elevated rounded p-2.5">
                <div className="text-base font-extrabold text-white tabular-nums">
                  {stats.selectedCount} / {stats.total}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-lb-muted">
                  {isPt ? 'Selecionados' : 'Selected'}
                </div>
              </div>
              <div className="bg-lb-bg border border-lb-elevated rounded p-2.5">
                <div className="text-base font-extrabold text-lb-green tabular-nums">
                  {stats.exactCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-lb-muted">
                  {isPt ? 'Match Exato (ID)' : 'Exact Match'}
                </div>
              </div>
              <div className="bg-lb-bg border border-lb-elevated rounded p-2.5">
                <div className="text-base font-extrabold text-lb-blue tabular-nums">
                  {stats.bestGuessCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-lb-muted">
                  {isPt ? 'Melhor Palpite' : 'Best-Guess'}
                </div>
              </div>
              <div className="bg-lb-bg border border-lb-elevated rounded p-2.5">
                <div className="text-base font-extrabold text-white tabular-nums">
                  {stats.diaryEntriesCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-lb-muted">
                  {isPt ? 'Entradas Diário' : 'Diary Entries'}
                </div>
              </div>
              <div className="bg-lb-bg border border-lb-elevated rounded p-2.5">
                <div className="text-base font-extrabold text-white tabular-nums">
                  {stats.ratingsCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-lb-muted">
                  {isPt ? 'Com Avaliação' : 'With Rating'}
                </div>
              </div>
              <div className="bg-lb-bg border border-lb-elevated rounded p-2.5">
                <div className="text-base font-extrabold text-white tabular-nums">
                  {stats.reviewsCount}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-lb-muted">
                  {destination === 'list'
                    ? isPt
                      ? 'Com Notas'
                      : 'With Notes'
                    : isPt
                      ? 'Com Crítica'
                      : 'With Review'}
                </div>
              </div>
            </div>

            {(stats.diaryUpdatesCount > 0 || stats.combinedDuplicatesCount > 0) && (
              <div className="flex flex-wrap gap-3 text-[11px] text-lb-text">
                {stats.diaryUpdatesCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-lb-blue/10 border border-lb-blue/30 text-lb-blue px-2.5 py-1 rounded">
                    <Info className="w-3.5 h-3.5" />
                    {isPt
                      ? `${stats.diaryUpdatesCount} entrada(s) atualizarão registros já existentes no seu Diário (mesma WatchedDate).`
                      : `${stats.diaryUpdatesCount} entry(s) will update existing Diary Entries with matching WatchedDate.`}
                  </span>
                )}
                {stats.combinedDuplicatesCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-lb-green/10 border border-lb-green/30 text-lb-green px-2.5 py-1 rounded">
                    <Sparkles className="w-3.5 h-3.5" />
                    {isPt
                      ? `${stats.combinedDuplicatesCount} linha(s) duplicada(s) com mesmo filme e WatchedDate foram combinadas.`
                      : `${stats.combinedDuplicatesCount} duplicate line(s) with the same film and WatchedDate were combined.`}
                  </span>
                )}
              </div>
            )}

            {/* Opções de Importação para Lista (Substituir vs Anexar + Marcar como Assistido) */}
            {(destination === 'list' || inlineListMode) && (
              <div className="pt-2 border-t border-lb-elevated flex flex-col sm:flex-row sm:items-center gap-4">
                {(targetListId !== 'new' || inlineListMode?.hasExistingItems) && (
                  <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={replaceExistingList}
                      onChange={(e) => setReplaceExistingList(e.target.checked)}
                      className="rounded border-lb-elevated bg-lb-bg text-lb-green focus:ring-0"
                    />
                    <span>
                      {isPt
                        ? 'Substituir completamente os itens existentes da lista (padrão: anexar novos ao final)'
                        : 'Completely replace existing list items (default: append new items at the end)'}
                    </span>
                  </label>
                )}

                <label className="inline-flex items-center gap-2 text-xs text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={markListFilmsWatched}
                    onChange={(e) => setMarkListFilmsWatched(e.target.checked)}
                    className="rounded border-lb-elevated bg-lb-bg text-lb-green focus:ring-0"
                  />
                  <span>
                    {isPt
                      ? 'Marcar também todos os filmes importados como assistidos no meu Perfil'
                      : 'Also mark all imported films as watched on my Profile'}
                  </span>
                </label>
              </div>
            )}

            {/* Abas de filtro da tabela de resumo */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {[
                { key: 'all' as const, label: isPt ? `Todos (${stats.total})` : `All (${stats.total})` },
                {
                  key: 'matched' as const,
                  label: isPt
                    ? `Correspondidos (${stats.exactCount + stats.bestGuessCount})`
                    : `Matched (${stats.exactCount + stats.bestGuessCount})`,
                },
                {
                  key: 'best_guess' as const,
                  label: isPt
                    ? `Melhor Palpite (${stats.bestGuessCount})`
                    : `Best-Guess (${stats.bestGuessCount})`,
                },
                {
                  key: 'attention' as const,
                  label: isPt
                    ? `Atenção / Sem Match (${stats.attentionCount})`
                    : `Unmatched / TV (${stats.attentionCount})`,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPreviewFilter(tab.key)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                    previewFilter === tab.key
                      ? 'bg-lb-green text-lb-bg'
                      : 'bg-lb-bg text-lb-muted hover:text-white border border-lb-elevated'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Itens do Resumo */}
          <div className="divide-y divide-lb-elevated max-h-[520px] overflow-y-auto">
            {filteredPreviewItems.map((item) => {
              const m = item.matchedMovie;
              const isEditingThis = editingRowId === item.id;
              const releaseYear = m?.release_date?.slice(0, 4) || '';
              const directorStr = m?.directors?.length ? m.directors.slice(0, 2).join(', ') : '';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 md:px-5 transition-colors ${
                    !item.selected ? 'opacity-60 bg-lb-bg/40' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Checkbox */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={item.selected && Boolean(m)}
                        disabled={!m}
                        onChange={() => toggleItemSelection(item.id)}
                        className="w-4 h-4 rounded border-lb-elevated bg-lb-bg text-lb-green focus:ring-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Poster */}
                    <div className="w-11 aspect-[2/3] rounded overflow-hidden bg-lb-bg border border-white/10 shrink-0 flex items-center justify-center">
                      {m?.poster_path ? (
                        <img
                          loading="lazy"
                          decoding="async"
                          src={tmdb.getImageUrl(m.poster_path, 'w92')}
                          alt={m.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="w-4 h-4 text-lb-muted" />
                      )}
                    </div>

                    {/* Informações do Filme Correspondido + Dados do CSV */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {m ? (
                          <>
                            <span className="text-sm font-bold text-white">
                              {m.title}
                            </span>
                            {releaseYear && (
                              <span className="text-xs font-mono text-lb-muted">
                                ({releaseYear})
                              </span>
                            )}
                            {directorStr && (
                              <span className="text-xs text-lb-text">
                                • {directorStr}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm font-bold text-red-400">
                            {isPt ? 'Filme não encontrado automaticamente' : 'No automatic match found'}
                          </span>
                        )}

                        {/* Badge de tipo de correspondência */}
                        {item.confidence === 'exact_id' && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-lb-green/15 text-lb-green border border-lb-green/30">
                            {isPt ? 'Match Exato' : 'Exact Match'}
                          </span>
                        )}
                        {item.confidence === 'best_guess' && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-lb-blue/15 text-lb-blue border border-lb-blue/30">
                            {isPt ? 'Melhor Palpite' : 'Best-Guess'}
                          </span>
                        )}
                        {item.confidence === 'tv_warning' && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40">
                            {isPt ? 'TV / Verificar' : 'TV / Verify'}
                          </span>
                        )}
                        {item.confidence === 'unmatched' && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                            {isPt ? 'Sem Match' : 'Unmatched'}
                          </span>
                        )}
                        {item.updatesExistingDiary && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {isPt ? 'Atualiza Diário' : 'Updates Diary Entry'}
                          </span>
                        )}
                        {item.combinedCount > 1 && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/10 text-white">
                            {item.combinedCount}x {isPt ? 'combinadas' : 'combined'}
                          </span>
                        )}
                      </div>

                      {/* Linha original do CSV */}
                      <div className="text-[11px] text-lb-muted mt-0.5 truncate">
                        {isPt ? 'Linha CSV' : 'CSV Row'} #{item.raw.rowNumber}:{' '}
                        <span className="text-lb-text">
                          {item.raw.title || item.raw.letterboxdUri || `TMDB:${item.raw.tmdbId}` || item.raw.imdbId}
                        </span>
                        {item.raw.year && ` (${item.raw.year})`}
                        {item.raw.directors.length > 0 && ` — Dir: ${item.raw.directors.join(', ')}`}
                        {item.raw.tmdbId && ` [tmdbID: ${item.raw.tmdbId}]`}
                        {item.raw.imdbId && ` [imdbID: ${item.raw.imdbId}]`}
                      </div>

                      {/* Metadados que serão importados para esta linha */}
                      <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs">
                        {item.raw.rating > 0 && (
                          <span className="text-lb-green font-bold tracking-tight">
                            {'★'.repeat(Math.floor(item.raw.rating))}
                            {item.raw.rating % 1 !== 0 ? '½' : ''}
                          </span>
                        )}
                        {item.raw.watchedDate && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-lb-text bg-lb-bg px-2 py-0.5 rounded border border-lb-elevated font-mono">
                            <Calendar className="w-3 h-3 text-lb-green" />
                            {item.raw.watchedDate}
                          </span>
                        )}
                        {item.raw.rewatch && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-lb-blue bg-lb-blue/10 px-2 py-0.5 rounded">
                            🔄 Rewatch
                          </span>
                        )}
                        {item.raw.liked && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-orange-400">
                            <Heart className="w-3 h-3 fill-orange-400" />
                          </span>
                        )}
                        {item.raw.tags.map((tg) => (
                          <span
                            key={tg}
                            className="inline-flex items-center gap-1 text-[10px] bg-lb-bg text-lb-muted px-1.5 py-0.5 rounded border border-white/5"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tg}
                          </span>
                        ))}
                      </div>

                      {item.raw.review && (
                        <div className="mt-1.5 text-xs text-lb-text bg-lb-bg/70 border border-lb-elevated rounded px-2.5 py-1.5 line-clamp-2">
                          <MessageSquare className="w-3 h-3 text-lb-blue inline mr-1.5 -mt-0.5" />
                          {item.raw.review}
                        </div>
                      )}
                    </div>

                    {/* Ações da linha: Corrigir Match ("Fix match") + Remover */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openFixMatchPanel(item)}
                        title={isPt ? 'Corrigir ou trocar filme' : 'Fix mismatched title'}
                        className={`px-2.5 py-1.5 rounded text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                          isEditingThis
                            ? 'bg-lb-green text-lb-bg'
                            : 'bg-[#2c3440] hover:bg-[#384250] text-[#ccddee] hover:text-white'
                        }`}
                      >
                        <Search className="w-3 h-3" />
                        <span className="hidden sm:inline">
                          {isPt ? 'Trocar' : 'Fix match'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeItemFromImport(item.id)}
                        title={isPt ? 'Remover entrada' : 'Remove entry'}
                        className="p-1.5 rounded bg-[#2c3440] hover:bg-red-500/20 text-lb-muted hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Painel Inline para trocar o filme ("Fix mismatched title") */}
                  {isEditingThis && (
                    <div className="mt-3 ml-7 p-3 rounded bg-lb-bg border border-lb-elevated space-y-2.5">
                      <form onSubmit={runManualSearch} className="flex gap-2">
                        <input
                          type="text"
                          value={manualSearchQuery}
                          onChange={(e) => setManualSearchQuery(e.target.value)}
                          placeholder={isPt ? 'Buscar título correto no TMDB...' : 'Search correct film title on TMDB...'}
                          className="flex-1 bg-lb-surface border border-lb-elevated rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-lb-green"
                        />
                        <button
                          type="submit"
                          disabled={isManualSearching}
                          className="px-3.5 py-1.5 rounded bg-lb-green text-lb-bg font-bold text-xs cursor-pointer"
                        >
                          {isManualSearching
                            ? isPt
                              ? 'Buscando...'
                              : 'Searching...'
                            : isPt
                              ? 'Buscar'
                              : 'Search'}
                        </button>
                      </form>

                      {manualSearchResults.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                          {manualSearchResults.map((cand) => (
                            <button
                              type="button"
                              key={cand.id}
                              onClick={() => selectReplacementMovie(item.id, cand)}
                              className="flex items-center gap-2.5 p-2 rounded bg-lb-surface hover:bg-[#2c3440] border border-white/5 text-left transition-colors cursor-pointer"
                            >
                              <div className="w-8 aspect-[2/3] rounded overflow-hidden bg-lb-bg shrink-0">
                                {cand.poster_path && (
                                  <img
                                    src={tmdb.getImageUrl(cand.poster_path, 'w92')}
                                    alt={cand.title}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white truncate">
                                  {cand.title}{' '}
                                  <span className="font-normal text-lb-muted">
                                    ({cand.release_date?.slice(0, 4) || '—'})
                                  </span>
                                </div>
                                {cand.directors?.length > 0 && (
                                  <div className="text-[10px] text-lb-muted truncate">
                                    {cand.directors.slice(0, 2).join(', ')}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-lb-muted">
                          {isPt
                            ? 'Digite o nome do filme acima e clique em Buscar para escolher o título correto.'
                            : 'Type the film title above and click Search to pick the right match.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ETAPA 4: Importação Concluída */}
      {stage === 'done' && doneSummary && (
        <div className="bg-lb-surface border border-lb-green/40 rounded-lg p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-lb-green/15 text-lb-green flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">{doneSummary.headline}</h3>
          <ul className="text-xs text-lb-text space-y-1.5 max-w-md mx-auto">
            {doneSummary.details.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <div className="flex items-center justify-center gap-3 pt-2">
            {doneSummary.targetLink && (
              <Link
                to={doneSummary.targetLink.to}
                className="btn-log-green text-lb-bg font-black text-xs px-5 py-2.5 rounded uppercase tracking-wider"
              >
                {doneSummary.targetLink.label}
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setStage('idle');
                setMatchedItems([]);
                setDoneSummary(null);
              }}
              className="px-4 py-2.5 rounded bg-[#2c3440] hover:bg-[#384250] text-xs font-bold text-white cursor-pointer"
            >
              {isPt ? 'Importar Outro Arquivo' : 'Import Another File'}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          GUIA COMPLETO DE FORMATO DE IMPORTAÇÃO DO LETTERBOXD (Tabelas + Notas + Tools)
          ===================================================================== */}
      {!inlineListMode && (
        <div className="space-y-4 pt-2">
          {/* 1. Tabela de Colunas do Formato Letterboxd CSV */}
          <div className="bg-lb-surface border border-lb-elevated rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFormatSpec((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-lb-green" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isPt
                      ? 'Formato de Importação Letterboxd (Colunas Suportadas)'
                      : 'Letterboxd Import Format —“It’s C-S-Veasy!”'}
                  </h3>
                  <p className="text-[11px] text-lb-muted">
                    {isPt
                      ? 'Arquivo CSV (UTF-8) com pelo menos uma das 4 primeiras colunas abaixo na primeira linha, em qualquer ordem.'
                      : 'CSV file (UTF-8 encoding) supporting the following column titles in any order. Include at least one of the first four columns.'}
                  </p>
                </div>
              </div>
              {showFormatSpec ? (
                <ChevronUp className="w-4 h-4 text-lb-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-lb-muted" />
              )}
            </button>

            {showFormatSpec && (
              <div className="px-5 pb-5 pt-2 border-t border-lb-elevated space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-lb-elevated text-[10px] uppercase tracking-wider text-lb-muted">
                        <th className="py-2 pr-4 w-40">{isPt ? 'Coluna' : 'Column Title'}</th>
                        <th className="py-2">{isPt ? 'Descrição & Formato' : 'Description & Format'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lb-elevated/60 text-lb-text">
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">LetterboxdURI</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">String (optional)</span> —{' '}
                          {isPt
                            ? 'Identifica um filme ou entrada do diário por sua URI do Letterboxd, ex.: '
                            : 'Matches a film or diary entry by its Letterboxd URI, example: '}
                          <code className="text-lb-blue">https://boxd.it/29qU</code>.{' '}
                          <span className="text-lb-muted">
                            ({isPt ? 'Também aceita o título de coluna ' : 'Can alternatively be titled '}
                            <code className="text-white">url</code>)
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">tmdbID</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">Number (optional)</span> —{' '}
                          {isPt
                            ? 'Identifica o filme pelo ID numérico do TMDB, ex.: '
                            : 'Matches a film by its numeric TMDB ID, example: '}
                          <code className="text-lb-blue">860</code>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">imdbID</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">String (optional)</span> —{' '}
                          {isPt
                            ? 'Identifica o filme pelo ID alfanumérico do IMDb, ex.: '
                            : 'Matches a film by its alphanumeric IMDb ID, example: '}
                          <code className="text-lb-blue">tt0086567</code>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">Title</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">String (optional)</span> —{' '}
                          {isPt
                            ? 'Identifica um filme pelo título quando nenhum ID ou URI é informado.'
                            : 'Matches a film by title when no ID or URI is provided.'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">Year</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">YYYY (optional)</span> —{' '}
                          {isPt
                            ? 'Usado para melhorar a correspondência por título quando nenhum ID ou URI é informado.'
                            : 'Used to improve title matching when no ID or URI is provided.'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">Directors</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">String (optional)</span> —{' '}
                          {isPt
                            ? 'Melhora a busca por título; use vírgulas para múltiplos diretores entre aspas, ex.: '
                            : 'Used to improve title matching; use commas to delimit multiple director names in quotes, eg: '}
                          <code className="text-lb-blue">&quot;Joel Coen, Ethan Coen&quot;</code>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">Rating</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">Number (optional, 0.5–5 in 0.5 increments)</span> —{' '}
                          {isPt ? 'Avaliação do filme de 0.5 a 5.' : 'A rating for the film out of five.'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">Rating10</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">Number (optional, integers 1–10)</span> —{' '}
                          {isPt
                            ? 'Avaliação de 1 a 10 (convertida automaticamente para a escala 0.5–5).'
                            : 'A rating for the film out of ten (automatically converted to 0.5–5 scale).'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">WatchedDate</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">YYYY-MM-DD (optional)</span> —{' '}
                          {isPt
                            ? 'Cria uma Entrada no Diário para o filme nesta data de calendário†.'
                            : 'Creates a Diary Entry for the film on this calendar date†.'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">Rewatch</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">Boolean (optional)</span> —{' '}
                          {isPt
                            ? 'Se true, marca a flag de rewatch na Entrada do Diário quando WatchedDate é informado.'
                            : 'If true, sets the rewatch flag on the Diary Entry when WatchedDate is provided.'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">Tags</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">String (optional)</span> —{' '}
                          {isPt
                            ? 'Adicionadas à Entrada do Diário quando WatchedDate é informado; separe múltiplas tags por vírgula entre aspas.'
                            : 'Added to Diary Entry when WatchedDate is provided; use commas to delimit multiple tags in quotes.'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 font-mono font-bold text-white">Review</td>
                        <td className="py-2.5">
                          <span className="text-lb-muted">Text/HTML (optional)</span> —{' '}
                          {isPt
                            ? 'Sua crítica do filme, adicionada ao Diário quando WatchedDate é informado, ou como crítica sem data. Também preenche o campo Notes ao importar para uma lista.'
                            : 'Your review of the film, added to Diary Entry when WatchedDate is provided, otherwise added as a review with no specified date. Also populates the Notes field when importing to a list.'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Exemplo de CSV válido */}
                <div className="bg-lb-bg border border-lb-elevated rounded p-3.5 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-lb-muted">
                    {isPt ? 'Exemplo de arquivo CSV válido:' : 'For example, a valid file might look like this:'}
                  </div>
                  <pre className="text-xs font-mono text-lb-green overflow-x-auto leading-relaxed">
{`Title,Year,Rating
Top Gun,1986,5
Gremlins,1984,4.5
"Paris, Texas",1984,4`}
                  </pre>
                  <p className="text-[11px] text-lb-muted leading-relaxed">
                    {isPt
                      ? 'Seu CSV deve usar vírgula (,) para delimitar colunas — não inclua espaço logo após a vírgula. Textos com vírgulas (como títulos, diretores, tags ou críticas) devem ficar entre aspas ("..."). Escape aspas internas com barra invertida (\\"). † Aceitamos datas de calendário (YYYY-MM-DD), truncando timestamps automaticamente.'
                      : 'Your CSV file must use the comma character (,) to delimit columns—do not include a space character immediately after the comma. Strings containing commas must be placed inside quotes. Escape quotes within quoted text by prefixing them with a backslash (\\) character. † Calendar dates only (YYYY-MM-DD); timestamps are truncated automatically.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 2. Notas sobre Importação & Importação para Lista */}
          <div className="bg-lb-surface border border-lb-elevated rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowNotesSpec((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Info className="w-4 h-4 text-lb-blue" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isPt
                      ? 'Notas sobre a Importação & Regras de Listas'
                      : 'Notes on importing & Importing to a list'}
                  </h3>
                  <p className="text-[11px] text-lb-muted">
                    {isPt
                      ? 'Regras de correspondência exata vs. palpite, atualização de Diário, precedência de notas e listas.'
                      : 'Exact vs. best-guess matching, updating existing diary entries, rating precedence, and list rules.'}
                  </p>
                </div>
              </div>
              {showNotesSpec ? (
                <ChevronUp className="w-4 h-4 text-lb-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-lb-muted" />
              )}
            </button>

            {showNotesSpec && (
              <div className="px-5 pb-5 pt-2 border-t border-lb-elevated space-y-4 text-xs text-lb-text leading-relaxed">
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    {isPt
                      ? 'Não é possível desfazer após a etapa de confirmação. Tenha cuidado!'
                      : 'There is no undo after the confirmation step. Be careful!'}
                  </li>
                  <li>
                    {isPt
                      ? 'Informar LetterboxdURI, tmdbID ou imdbID realiza uma correspondência exata (Exact Match), enquanto informar Title (e opcionalmente Year e Directors) realiza o melhor palpite (Best-Guess Match).'
                      : 'Providing a LetterboxdURI, tmdbID or imdbID for each line performs an exact match for the film, while providing title (and optional year and director/s) results in a best-guess match.'}
                  </li>
                  <li>
                    {isPt
                      ? 'O importador exibe um resumo do arquivo antes de concluir a importação, permitindo corrigir títulos trocados ou remover entradas inadequadas (como séries de TV).'
                      : 'The importer shows a summary of the import file prior to completing the import, so you can fix any mismatched titles and/or remove any inappropriate entries.'}
                  </li>
                  <li>
                    {isPt
                      ? 'Todos os filmes importados para o seu Perfil são automaticamente marcados como assistidos (este passo é opcional ao importar para uma lista).'
                      : 'All films imported to your Profile will be automatically marked as watched (this step is optional when importing to a list).'}
                  </li>
                  <li>
                    {isPt
                      ? 'O importador atualiza Entradas do Diário existentes se um filme for importado com uma WatchedDate que corresponda a uma entrada já existente para o mesmo filme no seu Diário, permitindo adicionar tags ou crítica.'
                      : 'The importer updates existing Diary Entries if a film is imported with a WatchedDate that matches an existing entry for the same film already in your Diary, to allow the addition of tags or a review to existing entries.'}
                  </li>
                  <li>
                    {isPt
                      ? 'Múltiplas linhas contendo o mesmo filme com a mesma WatchedDate são combinadas em uma única entrada quando os dados são salvos.'
                      : 'Multiple lines containing the same film with the same WatchedDate will be combined into a single entry when the imported data is saved.'}
                  </li>
                  <li>
                    {isPt
                      ? 'Se ambas as colunas Rating e Rating10 tiverem dados em uma linha, a coluna que aparecer em segundo lugar no arquivo terá precedência.'
                      : 'If both Rating columns contain data on any given line of the file, whichever column appears second in the file will take precedence.'}
                  </li>
                  <li>
                    {isPt
                      ? 'Existe um limite de tamanho de arquivo de 1 MB; divida arquivos grandes em partes menores mantendo a linha de cabeçalho em cada arquivo.'
                      : 'There is a file size limit of 1MB, so you’ll need to divide large files into multiple smaller files (the header row containing column names must be in every file).'}
                  </li>
                </ul>

                <div className="pt-2 border-t border-lb-elevated">
                  <h4 className="font-bold text-white mb-1.5">
                    {isPt ? 'Importando para uma lista' : 'Importing to a list'}
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>
                      {isPt
                        ? 'Ao importar para uma lista, os filmes do arquivo que ainda não estão presentes na lista são anexados ao final, na ordem em que aparecem no arquivo. Filmes já presentes permanecem em suas posições atuais.'
                        : 'When importing to a list, films in the import file that are not already present in the list will be appended at the end, in the order they appear in the import file. Any films already present in the list will remain in their current positions.'}
                    </li>
                    <li>
                      {isPt
                        ? 'Se desejar revisar/atualizar uma lista com base em uma importação, selecione a opção de substituir completamente os itens existentes na tela de confirmação.'
                        : 'If you wish to revise/update a list based on an import, select the option to completely replace the existing list items, which appears on the confirmation screen prior to completing the import.'}
                    </li>
                  </ul>
                </div>

                {!inlineListMode && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/list/new')}
                      className="text-xs font-bold text-lb-blue hover:underline cursor-pointer"
                    >
                      {isPt ? '→ Ir para Criar/Editar Lista' : '→ Proceed to List Editor'}
                    </button>
                    <span className="text-lb-muted">•</span>
                    <button
                      type="button"
                      onClick={() => navigate('/watchlist')}
                      className="text-xs font-bold text-lb-blue hover:underline cursor-pointer"
                    >
                      {isPt ? '→ Ir para sua Watchlist' : '→ Proceed to your Watchlist'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Ferramentas Adicionais (Third-Party Exporters & Converters) */}
          <div className="bg-lb-surface border border-lb-elevated rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowToolsSpec((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Wrench className="w-4 h-4 text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isPt
                      ? 'Ferramentas Adicionais de Migração (IMDb, Filmow, MUBI, Trakt, Plex...)'
                      : 'Additional tools & third-party converters'}
                  </h3>
                  <p className="text-[11px] text-lb-muted">
                    {isPt
                      ? 'Scripts e conversores criados pela comunidade para gerar arquivos compatíveis com o importador.'
                      : 'Helper scripts and web apps created by third parties to convert exports from other services.'}
                  </p>
                </div>
              </div>
              {showToolsSpec ? (
                <ChevronUp className="w-4 h-4 text-lb-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-lb-muted" />
              )}
            </button>

            {showToolsSpec && (
              <div className="px-5 pb-5 pt-2 border-t border-lb-elevated">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {THIRD_PARTY_TOOLS.map((tool, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-lb-bg border border-lb-elevated/70 flex flex-col justify-between"
                    >
                      <span className="font-semibold text-white">{tool.name}</span>
                      <span className="text-[10px] text-lb-muted">by {tool.author}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
