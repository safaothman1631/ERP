/**
 * BackupHistoryTable.test.tsx
 *
 * Frontend tests for the BackupHistoryTable sub-component of SystemHealthPage.
 *
 * Tests:
 *   - Table rows render from GET /api/system/backup/list response
 *   - Failed backup rows have red background styling
 *   - Download button calls GET /api/system/backup/{id}/download
 *   - "Run Backup Now" button calls POST /api/system/backup/run
 *
 * Requirements: 8.1, 8.2, 8.3, 8.5
 *
 * Runner: Vitest + React Testing Library (jsdom)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ---------------------------------------------------------------------------
// Polyfills required by Ant Design in jsdom
// ---------------------------------------------------------------------------

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Mock heavy / side-effectful modules
// ---------------------------------------------------------------------------

vi.mock('../../../firebase', () => ({
  default: {},
  auth: { currentUser: null, onAuthStateChanged: vi.fn(() => () => {}) },
  db: {},
  googleProvider: {},
  analytics: null,
}));

vi.mock('../../../utils/message', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
  setMessageInstance: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock the api module — route-aware mock so list always returns an array
// ---------------------------------------------------------------------------

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../../../api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks are set up
// ---------------------------------------------------------------------------
import { BackupHistoryTable, type BackupRecord } from '../SystemHealthPage';

// ---------------------------------------------------------------------------
// i18n test instance — minimal translations
// ---------------------------------------------------------------------------
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'backup.history_title': 'Backup History',
        'backup.run_now': 'Run Backup Now',
        'backup.col_datetime': 'Date / Time',
        'backup.col_status': 'Status',
        'backup.col_integrity': 'Integrity',
        'backup.col_total_docs': 'Total Docs',
        'backup.col_file_size': 'File Size',
        'backup.col_storage_path': 'Storage Path',
        'backup.col_download': 'Download',
        'backup.download': 'Download',
        'backup.status_success': 'Success',
        'backup.status_failed': 'Failed',
        'backup.integrity_verified': 'Verified',
        'backup.integrity_failed': 'Failed',
        'backup.integrity_pending': 'Pending',
        'backup.no_records': 'No backup records found',
        'backup.run_failed': 'Failed to start backup. Please try again.',
        'backup.download_failed': 'Failed to generate download link. Please try again.',
        'backup.checksum': 'SHA-256',
        'backup.integrity_verified_tip': 'Document count and checksum verified',
        'backup.integrity_failed_tip': 'Integrity verification failed',
      },
    },
  },
  interpolation: { escapeValue: false },
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const successRecord: BackupRecord = {
  id: 'backup-001',
  org_id: 'org-1',
  filename: 'backup_20240115_020000.json.gz',
  storage_path: 'backups/org-1/2024-01-15/backup_20240115_020000.json.gz',
  created_at: '2024-01-15T02:00:00Z',
  status: 'success',
  integrity_status: 'verified',
  total_documents: 1500,
  collections_backed_up: ['users', 'invoices'],
  file_size_bytes: 204800,
  checksum_sha256: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
  error_message: null,
};

const failedRecord: BackupRecord = {
  id: 'backup-002',
  org_id: 'org-1',
  filename: 'backup_20240114_020000.json.gz',
  storage_path: 'backups/org-1/2024-01-14/backup_20240114_020000.json.gz',
  created_at: '2024-01-14T02:00:00Z',
  status: 'failed',
  integrity_status: 'failed',
  total_documents: 0,
  collections_backed_up: [],
  file_size_bytes: 0,
  checksum_sha256: '',
  error_message: 'Cloud Storage upload timed out after 120 seconds',
};

const pendingRecord: BackupRecord = {
  id: 'backup-003',
  org_id: 'org-1',
  filename: 'backup_20240113_020000.json.gz',
  storage_path: 'backups/org-1/2024-01-13/backup_20240113_020000.json.gz',
  created_at: '2024-01-13T02:00:00Z',
  status: 'success',
  integrity_status: 'pending',
  total_documents: 800,
  collections_backed_up: ['users'],
  file_size_bytes: 102400,
  checksum_sha256: 'def456abc123def456abc123def456abc123def456abc123def456abc123def4',
  error_message: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });
}

function renderBackupHistoryTable() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={testI18n}>
        <BackupHistoryTable />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

/**
 * Route-aware mock: routes GET calls based on URL.
 * - /api/system/backup/list → returns the provided list
 * - /api/system/backup/{id}/download → returns the provided download response
 */
function setupRoutedMock(
  listData: BackupRecord[],
  downloadData?: { url: string; expires_in_minutes: number },
) {
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/api/system/backup/list') {
      return Promise.resolve({ data: listData });
    }
    if (url.includes('/download') && downloadData) {
      return Promise.resolve({ data: downloadData });
    }
    return Promise.resolve({ data: [] });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BackupHistoryTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    // Default: empty list
    setupRoutedMock([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Requirement 8.1 — Table rows render from GET /api/system/backup/list
  // -------------------------------------------------------------------------

  describe('table rows render (Requirement 8.1)', () => {
    it('renders a row for each backup record returned by the API', async () => {
      setupRoutedMock([successRecord, failedRecord, pendingRecord]);

      const { container } = renderBackupHistoryTable();

      // Wait for the table to populate — check for data rows
      await waitFor(() => {
        const rows = container.querySelectorAll('.ant-table-tbody tr');
        expect(rows.length).toBe(3);
      });
    });

    it('renders the "Backup History" card title', () => {
      setupRoutedMock([]);
      renderBackupHistoryTable();
      // The title is rendered immediately (not behind a loading state)
      expect(screen.getByText('Backup History')).toBeInTheDocument();
    });

    it('renders "No backup records found" when the list is empty', async () => {
      setupRoutedMock([]);
      renderBackupHistoryTable();

      await waitFor(() => {
        expect(screen.getByText('No backup records found')).toBeInTheDocument();
      });
    });

    it('calls GET /api/system/backup/list on mount', async () => {
      setupRoutedMock([successRecord]);
      renderBackupHistoryTable();

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/system/backup/list');
      });
    });

    it('renders success status badge for a successful backup', async () => {
      setupRoutedMock([successRecord]);
      renderBackupHistoryTable();

      await waitFor(() => {
        expect(screen.getByText('Success')).toBeInTheDocument();
      });
    });

    it('renders failed status badge for a failed backup', async () => {
      setupRoutedMock([failedRecord]);
      renderBackupHistoryTable();

      await waitFor(() => {
        const failedElements = screen.getAllByText('Failed');
        expect(failedElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('renders integrity status badges', async () => {
      setupRoutedMock([successRecord, failedRecord, pendingRecord]);
      renderBackupHistoryTable();

      await waitFor(() => {
        expect(screen.getByText('Verified')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('renders total documents count', async () => {
      setupRoutedMock([successRecord]);
      renderBackupHistoryTable();

      await waitFor(() => {
        // 1500 formatted with toLocaleString — match flexibly
        expect(screen.getByText(/1[,.]?500/)).toBeInTheDocument();
      });
    });

    it('renders file size in human-readable format', async () => {
      setupRoutedMock([successRecord]);
      renderBackupHistoryTable();

      await waitFor(() => {
        // 204800 bytes = 200.0 KB
        expect(screen.getByText('200.0 KB')).toBeInTheDocument();
      });
    });

    it('renders the storage path text content in the table cell', async () => {
      setupRoutedMock([successRecord]);
      renderBackupHistoryTable();

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // At least one data row should contain the storage path text
        const rowWithPath = rows.find((row) =>
          row.textContent?.includes('backups/org-1/2024-01-15'),
        );
        expect(rowWithPath).toBeDefined();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 8.5 — Failed rows have red background
  // -------------------------------------------------------------------------

  describe('failed row red background (Requirement 8.5)', () => {
    it('applies red background style to failed backup rows', async () => {
      setupRoutedMock([successRecord, failedRecord]);

      const { container } = renderBackupHistoryTable();

      await waitFor(() => {
        const rows = container.querySelectorAll('.ant-table-tbody tr');
        expect(rows.length).toBe(2);
      });

      // Find the row that contains the failed record's filename
      const tableRows = container.querySelectorAll('.ant-table-tbody tr');
      // The table is sorted by date descending, so successRecord (2024-01-15) comes first
      // failedRecord (2024-01-14) comes second
      const failedRow = Array.from(tableRows).find((row) =>
        row.classList.contains('backup-row-failed') ||
        (row.getAttribute('style') ?? '').includes('#fff2f0'),
      );

      expect(failedRow).toBeDefined();
    });

    it('does NOT apply red background to successful backup rows', async () => {
      setupRoutedMock([successRecord]);

      const { container } = renderBackupHistoryTable();

      await waitFor(() => {
        const rows = container.querySelectorAll('.ant-table-tbody tr');
        expect(rows.length).toBe(1);
      });

      const tableRows = container.querySelectorAll('.ant-table-tbody tr');
      const successRow = tableRows[0];

      expect(successRow).toBeDefined();
      expect(successRow.classList.contains('backup-row-failed')).toBe(false);
      const style = successRow.getAttribute('style') ?? '';
      expect(style).not.toContain('#fff2f0');
    });

    it('always renders every row regardless of status (Requirement 8.5)', async () => {
      setupRoutedMock([successRecord, failedRecord, pendingRecord]);

      const { container } = renderBackupHistoryTable();

      await waitFor(() => {
        const rows = container.querySelectorAll('.ant-table-tbody tr');
        expect(rows.length).toBe(3);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 8.3 — Download button calls GET /api/system/backup/{id}/download
  // -------------------------------------------------------------------------

  describe('download button (Requirement 8.3)', () => {
    it('calls GET /api/system/backup/{id}/download when download button is clicked', async () => {
      setupRoutedMock([successRecord], {
        url: 'https://storage.example.com/signed-url',
        expires_in_minutes: 60,
      });

      const { container } = renderBackupHistoryTable();

      // Wait for the table to finish loading (spinner gone, data rows present)
      await waitFor(() => {
        const spinner = container.querySelector('.ant-spin-spinning');
        expect(spinner).toBeNull();
      });

      // Find the download button by querying the table cell buttons
      const downloadButtons = container.querySelectorAll('.ant-table-tbody button');
      expect(downloadButtons.length).toBeGreaterThan(0);
      fireEvent.click(downloadButtons[0]);

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith(
          `/api/system/backup/${successRecord.id}/download`,
        );
      });
    });

    it('opens the signed URL in a new tab after successful download fetch', async () => {
      const signedUrl = 'https://storage.example.com/signed-url?token=abc';
      setupRoutedMock([successRecord], {
        url: signedUrl,
        expires_in_minutes: 60,
      });

      const { container } = renderBackupHistoryTable();

      await waitFor(() => {
        const spinner = container.querySelector('.ant-spin-spinning');
        expect(spinner).toBeNull();
      });

      const downloadButtons = container.querySelectorAll('.ant-table-tbody button');
      expect(downloadButtons.length).toBeGreaterThan(0);
      fireEvent.click(downloadButtons[0]);

      await waitFor(() => {
        expect(window.open).toHaveBeenCalledWith(
          signedUrl,
          '_blank',
          'noopener,noreferrer',
        );
      });
    });

    it('download button is disabled for failed backup records', async () => {
      setupRoutedMock([failedRecord]);

      const { container } = renderBackupHistoryTable();

      await waitFor(() => {
        const spinner = container.querySelector('.ant-spin-spinning');
        expect(spinner).toBeNull();
      });

      const downloadButtons = container.querySelectorAll('.ant-table-tbody button');
      expect(downloadButtons.length).toBeGreaterThan(0);
      expect(downloadButtons[0]).toBeDisabled();
    });

    it('download button is enabled for successful backup records', async () => {
      setupRoutedMock([successRecord]);

      const { container } = renderBackupHistoryTable();

      await waitFor(() => {
        const spinner = container.querySelector('.ant-spin-spinning');
        expect(spinner).toBeNull();
      });

      const downloadButtons = container.querySelectorAll('.ant-table-tbody button');
      expect(downloadButtons.length).toBeGreaterThan(0);
      expect(downloadButtons[0]).not.toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // Requirement 8.2 — "Run Backup Now" calls POST /api/system/backup/run
  // -------------------------------------------------------------------------

  describe('"Run Backup Now" button (Requirement 8.2)', () => {
    it('calls POST /api/system/backup/run when "Run Backup Now" is clicked', async () => {
      setupRoutedMock([successRecord]);
      mockApiPost.mockResolvedValueOnce({ data: { status: 'queued' } });

      renderBackupHistoryTable();

      // The button is in the card header, rendered immediately
      expect(screen.getByText('Run Backup Now')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Run Backup Now'));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/api/system/backup/run');
      });
    });

    it('refreshes the backup list after "Run Backup Now" completes', async () => {
      setupRoutedMock([successRecord]);
      mockApiPost.mockResolvedValueOnce({ data: { status: 'queued' } });

      renderBackupHistoryTable();

      // Wait for initial load
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledWith('/api/system/backup/list');
      });

      const callsBefore = mockApiGet.mock.calls.filter(
        (c) => c[0] === '/api/system/backup/list',
      ).length;

      fireEvent.click(screen.getByText('Run Backup Now'));

      await waitFor(() => {
        const callsAfter = mockApiGet.mock.calls.filter(
          (c) => c[0] === '/api/system/backup/list',
        ).length;
        expect(callsAfter).toBeGreaterThan(callsBefore);
      });
    });

    it('renders the "Run Backup Now" button above the table', () => {
      setupRoutedMock([]);

      const { container } = renderBackupHistoryTable();

      const runButton = screen.getByText('Run Backup Now').closest('button');
      const table = container.querySelector('.ant-table');

      expect(runButton).toBeDefined();
      expect(table).toBeDefined();

      if (runButton && table) {
        // DOCUMENT_POSITION_FOLLOWING = 4 means table comes after button
        const position = runButton.compareDocumentPosition(table);
        expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Additional edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('renders "Run Backup Now" button even when list is empty', () => {
      setupRoutedMock([]);
      renderBackupHistoryTable();
      // Button is in the card header, rendered immediately
      expect(screen.getByText('Run Backup Now')).toBeInTheDocument();
    });

    it('renders the correct number of columns in the table header', async () => {
      setupRoutedMock([]);
      const { container } = renderBackupHistoryTable();

      await waitFor(() => {
        const headerCells = container.querySelectorAll('.ant-table-thead th');
        // 7 columns: Date/Time, Status, Integrity, Total Docs, File Size, Storage Path, Download
        expect(headerCells.length).toBe(7);
      });
    });
  });
});
