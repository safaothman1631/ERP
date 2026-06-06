import React, { useState } from 'react';
import { Button, Dropdown, message } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, FileTextOutlined, PrinterOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export type ExportFormat = 'pdf' | 'xlsx' | 'csv' | 'copy';

export interface ExportMenuProps {
  /** Handler for export formats (pdf, xlsx, csv, copy) */
  onExport: (format: ExportFormat) => void | Promise<void>;
  /** Optional separate handler for print */
  onPrint?: () => void;
  /** Disable all export options */
  disabled?: boolean;
  /** Button size */
  size?: 'small' | 'middle' | 'large';
  /** Restrict which formats are shown (defaults to all). Backwards-compat with pre-Wave-8 callers. */
  formats?: ExportFormat[];
}

/**
 * ExportMenu — Wave 8.C — Reusable dropdown button "Export ▾" with options:
 * PDF, Excel (.xlsx), CSV, Print, Copy to Clipboard.
 * React.memo applied per Requirements 18.4.
 */
const ExportMenuInner: React.FC<ExportMenuProps> = ({
  onExport,
  onPrint,
  disabled = false,
  size = 'middle',
  formats,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const allowed: ExportFormat[] = formats && formats.length ? formats : ['pdf', 'xlsx', 'csv', 'copy'];

  const ICONS: Record<ExportFormat | 'print', React.ReactNode> = {
    csv: <FileTextOutlined />,
    xlsx: <FileExcelOutlined />,
    pdf: <FilePdfOutlined />,
    copy: <CopyOutlined />,
    print: <PrinterOutlined />,
  };

  const LABELS: Record<ExportFormat | 'print', string> = {
    csv: t('export.csv', 'CSV'),
    xlsx: t('export.xlsx', 'Excel'),
    pdf: t('export.pdf', 'PDF'),
    copy: t('export.copy', 'Copy to Clipboard'),
    print: t('export.print', 'Print'),
  };

  const handleExport = async (format: ExportFormat) => {
    setLoading(true);
    try {
      await onExport(format);
      if (format === 'copy') {
        message.success(t('export.copied', 'Copied to clipboard'));
      }
    } catch (_error) {
      message.error(t('export.error', 'Export failed'));
    } finally {
      setLoading(false);
    }
  };

  const items = [
    {
      key: 'pdf',
      icon: ICONS.pdf,
      label: LABELS.pdf,
      onClick: () => void handleExport('pdf'),
    },
    {
      key: 'xlsx',
      icon: ICONS.xlsx,
      label: LABELS.xlsx,
      onClick: () => void handleExport('xlsx'),
    },
    {
      key: 'csv',
      icon: ICONS.csv,
      label: LABELS.csv,
      onClick: () => void handleExport('csv'),
    },
    {
      key: 'copy',
      icon: ICONS.copy,
      label: LABELS.copy,
      onClick: () => void handleExport('copy'),
    },
    ...(onPrint
      ? [
          {
            key: 'print',
            icon: ICONS.print,
            label: LABELS.print,
            onClick: onPrint,
          },
        ]
      : []),
  ].filter((it) => it.key === 'print' || allowed.includes(it.key as ExportFormat));

  return (
    <Dropdown menu={{ items }} trigger={['click']} disabled={disabled || loading}>
      <Button
        icon={<DownloadOutlined />}
        loading={loading}
        size={size}
        disabled={disabled}
        aria-label={t('export.button', 'Export')}
      >
        {t('export.button', 'Export')}
      </Button>
    </Dropdown>
  );
};

export const ExportMenu = React.memo(ExportMenuInner);

export default ExportMenu;
