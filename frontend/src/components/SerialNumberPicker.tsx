import React, { useEffect, useMemo, useState } from 'react';
import { Select, Spin, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../api';

interface SerialRow {
  id: string;
  serial_number: string;
  status: string;
  item_id: string;
}

interface Props {
  itemId?: string;
  value?: string[];
  onChange?: (next: string[]) => void;
  /** how many serials must be picked (e.g. line-item quantity). 0 = unrestricted */
  max?: number;
  /** which statuses are selectable (default: in_stock) */
  statuses?: string[];
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Reusable picker that loads available serial numbers for an item from
 * `/api/inventory/serials` and lets the user pick N of them.
 * Used by SO / PO / Transfer / POS line item rows.
 */
const SerialNumberPicker: React.FC<Props> = ({
  itemId,
  value,
  onChange,
  max = 0,
  statuses = ['in_stock'],
  disabled,
  placeholder,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SerialRow[]>([]);

  useEffect(() => {
    if (!itemId) { setRows([]); return; }
    setLoading(true);
    Promise.all(statuses.map(s =>
      api.get('/api/inventory/serials', { params: { item_id: itemId, status: s, page_size: 200 } })
    ))
      .then(results => {
        const merged: SerialRow[] = [];
        results.forEach(r => (r.data.items || []).forEach((row: SerialRow) => merged.push(row)));
        setRows(merged);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [itemId, statuses.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => rows.map(r => ({
    label: r.serial_number,
    value: r.serial_number,
  })), [rows]);

  const handleChange = (next: string[]) => {
    if (max > 0 && next.length > max) {
      onChange?.(next.slice(0, max));
    } else {
      onChange?.(next);
    }
  };

  return (
    <div>
      <Select
        mode="multiple"
        allowClear
        showSearch
        disabled={disabled || !itemId}
        loading={loading}
        value={value}
        onChange={handleChange}
        options={options}
        placeholder={placeholder || t('serial_pick_placeholder')}
        notFoundContent={loading ? <Spin size="small" /> : t('no_serials_available')}
        style={{ width: '100%' }}
        maxTagCount="responsive"
      />
      {max > 0 && (
        <Tag
          color={(value?.length || 0) === max ? 'green' : 'default'}
          style={{ marginTop: 4, borderRadius: 12 }}
        >
          {(value?.length || 0)} / {max}
        </Tag>
      )}
    </div>
  );
};

export default SerialNumberPicker;
