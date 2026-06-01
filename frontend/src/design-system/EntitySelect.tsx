/**
 * EntitySelect — async select for Customer / Item / Account (and any entity).
 *
 * Features:
 *   - Debounced async search (300ms)
 *   - Loading state with spinner
 *   - RTL-aware
 *   - Accessible: aria-label, aria-busy, role="combobox"
 *   - Supports "Create new" option via onCreateNew callback
 *   - Works with any entity type via generic loader function
 *
 * Requirements: 15.9
 */
import React, { useCallback, useRef, useState } from 'react';
import { Select, Spin, Typography } from 'antd';
import type { SelectProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EntityOption {
  /** Unique identifier */
  value: string | number;
  /** Display label */
  label: string;
  /** Optional secondary text (e.g. code, email) */
  description?: string;
  /** Raw entity data for consumers that need it */
  data?: unknown;
}

export interface EntitySelectProps
  extends Omit<SelectProps, 'options' | 'filterOption' | 'onSearch' | 'loading'> {
  /**
   * Async function that receives the search query and returns matching options.
   * Called with debounce of 300ms.
   */
  loadOptions: (query: string) => Promise<EntityOption[]>;

  /**
   * Placeholder text — defaults to "Search…"
   */
  placeholder?: string;

  /**
   * Accessible label for the select (used as aria-label).
   */
  ariaLabel?: string;

  /**
   * If provided, a "Create new <entity>" option is appended to the results.
   * Clicking it calls this callback with the current search query.
   */
  onCreateNew?: (query: string) => void;

  /**
   * Label for the "Create new" option — defaults to "Create new"
   */
  createNewLabel?: string;

  /**
   * Debounce delay in ms — defaults to 300
   */
  debounceMs?: number;

  /**
   * Minimum characters before triggering search — defaults to 1
   */
  minChars?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CREATE_NEW_VALUE = '__create_new__';

export const EntitySelect: React.FC<EntitySelectProps> = ({
  loadOptions,
  placeholder,
  ariaLabel,
  onCreateNew,
  createNewLabel,
  debounceMs = 300,
  minChars = 1,
  onChange,
  value,
  style,
  ...rest
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = ['ku', 'ar'].includes(i18n.language);

  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (searchValue: string) => {
      setQuery(searchValue);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!searchValue || searchValue.length < minChars) {
        setOptions([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      debounceRef.current = setTimeout(async () => {
        try {
          const results = await loadOptions(searchValue);
          setOptions(results);
        } catch {
          setOptions([]);
        } finally {
          setLoading(false);
        }
      }, debounceMs);
    },
    [loadOptions, debounceMs, minChars]
  );

  const handleChange: SelectProps['onChange'] = useCallback(
    (val, option) => {
      if (val === CREATE_NEW_VALUE) {
        onCreateNew?.(query);
        return;
      }
      onChange?.(val, option);
    },
    [onChange, onCreateNew, query]
  );

  // Build antd options list
  const antdOptions: SelectProps['options'] = [
    ...options.map((opt) => ({
      value: opt.value,
      label: opt.description ? (
        <span>
          <Text strong>{opt.label}</Text>
          {' '}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {opt.description}
          </Text>
        </span>
      ) : (
        opt.label
      ),
    })),
    ...(onCreateNew
      ? [
          {
            value: CREATE_NEW_VALUE,
            label: (
              <span style={{ color: 'var(--ant-color-primary)' }}>
                <PlusOutlined style={{ marginInlineEnd: 4 }} />
                {createNewLabel ?? t('entity_select.create_new', 'Create new')}
                {query ? ` "${query}"` : ''}
              </span>
            ),
          },
        ]
      : []),
  ];

  const notFoundContent = loading ? (
    <Spin size="small" />
  ) : query.length >= minChars ? (
    onCreateNew ? (
      <div style={{ padding: '8px 0' }}>
        <div style={{ textAlign: 'center', color: 'rgba(0,0,0,0.45)', marginBottom: 8, fontSize: 13 }}>
          {t('entity_select.no_results', 'No results found')}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 12px',
            cursor: 'pointer',
            color: 'var(--ant-color-primary, #7B61FF)',
            fontWeight: 500,
            fontSize: 13,
            borderRadius: 6,
            transition: 'background 150ms',
          }}
          onClick={() => onCreateNew(query)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(123,97,255,0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        >
          <PlusOutlined />
          {createNewLabel ?? t('entity_select.create_new', 'Create new')}
          {query ? ` "${query}"` : ''}
        </div>
      </div>
    ) : (
      <Text type="secondary">
        {t('entity_select.no_results', 'No results found')}
      </Text>
    )
  ) : (
    onCreateNew ? (
      <div style={{ padding: '4px 0' }}>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 8, fontSize: 13 }}>
          {t('entity_select.type_to_search', 'Type to search…')}
        </Text>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 12px',
            cursor: 'pointer',
            color: 'var(--ant-color-primary, #7B61FF)',
            fontWeight: 500,
            fontSize: 13,
            borderRadius: 6,
            transition: 'background 150ms',
          }}
          onClick={() => onCreateNew(query)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(123,97,255,0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
        >
          <PlusOutlined />
          {createNewLabel ?? t('entity_select.create_new', 'Create new')}
        </div>
      </div>
    ) : (
      <Text type="secondary">
        {t('entity_select.type_to_search', 'Type to search…')}
      </Text>
    )
  );

  return (
    <Select
      {...rest}
      value={value}
      showSearch
      filterOption={false}
      onSearch={handleSearch}
      onChange={handleChange}
      loading={loading}
      options={antdOptions}
      placeholder={placeholder ?? t('entity_select.placeholder', 'Search…')}
      notFoundContent={notFoundContent}
      aria-label={ariaLabel}
      aria-busy={loading}
      style={{ width: '100%', ...style }}
      direction={isRTL ? 'rtl' : 'ltr'}
    />
  );
};

export default EntitySelect;
