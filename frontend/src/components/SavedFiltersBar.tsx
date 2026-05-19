import React, { useState, useEffect } from 'react';
import { Select, Button, Form, Input, Popconfirm, Space, message } from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined, StarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { FormDialog } from './responsive/FormDialog';

interface SavedFilter {
 id: string;
 name: string;
 filters: any;
 columns?: string[];
 is_default: boolean;
}

interface SavedFiltersBarProps {
 pageKey: string;
 currentFilters: any;
 currentColumns?: string[];
 onLoad: (filter: SavedFilter) => void;
}

const SavedFiltersBar: React.FC<SavedFiltersBarProps> = ({
 pageKey,
 currentFilters,
 currentColumns,
 onLoad,
}) => {
 const { t } = useTranslation();
 const [filters, setFilters] = useState<SavedFilter[]>([]);
 const [loading, setLoading] = useState(false);
 const [selectedFilterId, setSelectedFilterId] = useState<string | undefined>();
 const [saveModalOpen, setSaveModalOpen] = useState(false);
 const [saveAsNew, setSaveAsNew] = useState(false);
 const [form] = Form.useForm();

 useEffect(() => {
 fetchFilters();
 }, [pageKey]);

 const fetchFilters = async () => {
 try {
 setLoading(true);
 const response = await api.get(`/api/saved-filters?page_key=${pageKey}`);
 const data = response.data;
 setFilters(data);

 // Auto-load default filter
 const defaultFilter = data.find((f: SavedFilter) => f.is_default);
 if (defaultFilter && !selectedFilterId) {
 setSelectedFilterId(defaultFilter.id);
 onLoad(defaultFilter);
 }
 } catch (error) {
 console.error('Failed to fetch saved filters:', error);
 } finally {
 setLoading(false);
 }
 };

 const handleSelectFilter = (filterId: string) => {
 const filter = filters.find(f => f.id === filterId);
 if (filter) {
 setSelectedFilterId(filterId);
 onLoad(filter);
 }
 };

 const handleSaveFilter = async (values: { name: string }) => {
 try {
 setLoading(true);
 const payload = {
 page_key: pageKey,
 name: values.name,
 filters: currentFilters,
 columns: currentColumns || [],
 is_default: false,
 };

 if (saveAsNew || !selectedFilterId) {
 // Create new filter
 await api.post('/api/saved-filters', payload);
 message.success(t('saved_filters.saved'));
 } else {
 // Update existing filter
 await api.put(`/api/saved-filters/${selectedFilterId}`, {
 name: values.name,
 filters: currentFilters,
 columns: currentColumns || [],
 });
 message.success(t('saved_filters.updated'));
 }

 setSaveModalOpen(false);
 form.resetFields();
 fetchFilters();
 } catch (error) {
 message.error(t('saved_filters.error'));
 console.error('Failed to save filter:', error);
 } finally {
 setLoading(false);
 }
 };

 const handleSetDefault = async (filterId: string) => {
 try {
 await api.post(`/api/saved-filters/${filterId}/set-default`);
 message.success(t('saved_filters.set_as_default'));
 fetchFilters();
 } catch (error) {
 message.error(t('saved_filters.error'));
 console.error('Failed to set default:', error);
 }
 };

 const handleDelete = async (filterId: string) => {
 try {
 await api.delete(`/api/saved-filters/${filterId}`);
 message.success(t('saved_filters.deleted'));
 if (selectedFilterId === filterId) {
 setSelectedFilterId(undefined);
 }
 fetchFilters();
 } catch (error) {
 message.error(t('saved_filters.error'));
 console.error('Failed to delete filter:', error);
 }
 };

 const openSaveModal = (asNew: boolean) => {
 setSaveAsNew(asNew);
 const currentFilter = filters.find(f => f.id === selectedFilterId);
 form.setFieldsValue({
 name: asNew ? '' : currentFilter?.name || '',
 });
 setSaveModalOpen(true);
 };

 return (
 <>
 <Space style={{ marginBottom: 16 }}>
 <Select
 placeholder={t('saved_filters.saved_filter')}
 style={{ width: 200 }}
 value={selectedFilterId}
 onChange={handleSelectFilter}
 loading={loading}
 allowClear
 onClear={() => setSelectedFilterId(undefined)}
 >
 {filters.map(filter => (
 <Select.Option key={filter.id} value={filter.id}>
 {filter.is_default && <StarOutlined style={{ marginLeft: 4, color: '#faad14' }} />}
 {filter.name}
 </Select.Option>
 ))}
 </Select>

 <Button
 icon={<PlusOutlined />}
 onClick={() => openSaveModal(true)}
 >
 {t('saved_filters.save_new')}
 </Button>

 {selectedFilterId && (
 <>
 <Button
 icon={<SaveOutlined />}
 onClick={() => openSaveModal(false)}
 >
 {t('saved_filters.save_changes')}
 </Button>

 <Button
 icon={<StarOutlined />}
 onClick={() => handleSetDefault(selectedFilterId)}
 >
 {t('saved_filters.set_default')}
 </Button>

 <Popconfirm
 title={t('saved_filters.confirm_delete')}
 onConfirm={() => handleDelete(selectedFilterId)}
 >
 <Button icon={<DeleteOutlined />} danger>
 {t('saved_filters.delete')}
 </Button>
 </Popconfirm>
 </>
 )}
 </Space>

 <FormDialog
 title={saveAsNew ? t('saved_filters.save_new_filter') : t('saved_filters.save_changes')}
 open={saveModalOpen}
 onClose={() => {
 setSaveModalOpen(false);
 form.resetFields();
 }}
 onOk={() => form.submit()}
 confirmLoading={loading}
 >
 <Form form={form} onFinish={handleSaveFilter} layout="vertical">
 <Form.Item
 name="name"
 label={t('saved_filters.name')}
 rules={[{ required: true, message: t('saved_filters.enter_name') }]}
 >
 <Input placeholder={t('saved_filters.filter_name')} />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default SavedFiltersBar;
