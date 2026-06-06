import React, { useEffect, useState } from 'react';
import { Form, message, Tag, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader, FilterBar, DataTable, SectionCard } from '../../design-system';
import api from '../../api';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Prescription {
 id: string;
 patient_id: string;
 patient_name?: string;
 items: Array<{ drug_id: string; drug_name?: string; quantity: number }>;
 issued_at: string;
 status?: string;
}

interface Dispense {
 id: string;
 prescription_id?: string;
 patient_id?: string;
 drug_id: string;
 drug_name?: string;
 quantity: number;
 created_at?: string;
}

interface Drug {
 id: string;
 name: string;
 generic_name?: string;
 strength?: string;
 form: string;
}

interface Patient {
 id: string;
 name: string;
}

const PharmacyDispense: React.FC = () => {
 const { t } = useTranslation();
 const [_form] = Form.useForm();
 const [loading, setLoading] = useState(false);
 const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
 const [dispenses, setDispenses] = useState<Dispense[]>([]);
 const [_drugs, setDrugs] = useState<Drug[]>([]);
 const [_patients, setPatients] = useState<Patient[]>([]);
 const [searchText, setSearchText] = useState('');
 const [modalVisible, setModalVisible] = useState(false);
 const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

 useEffect(() => {
 void fetchData();
 }, []);

 const fetchData = async () => {
 setLoading(true);
 try {
 const [prescriptionsRes, dispensesRes, drugsRes, patientsRes] = await Promise.all([
 api.get('/api/healthcare/prescriptions', { params: { limit: 500 } }),
 api.get('/api/pharmacy/dispenses', { params: { limit: 500 } }),
 api.get('/api/pharmacy/drugs', { params: { limit: 500 } }),
 api.get('/api/healthcare/patients', { params: { limit: 500 } }),
 ]);

 const prescriptionsData = prescriptionsRes.data.items as Prescription[];
 const dispensesData = dispensesRes.data.items as Dispense[];
 const drugsData = drugsRes.data.items as Drug[];
 const patientsData = patientsRes.data.items as Patient[];

 // Enrich prescriptions with patient names
 const patientMap = new Map(patientsData.map((p) => [p.id, p.name]));
 const drugMap = new Map(drugsData.map((d) => [d.id, d.name]));

 const enrichedPrescriptions = prescriptionsData.map((p) => ({
 ...p,
 patient_name: patientMap.get(p.patient_id) || t('pharmacy.unknown_patient'),
 items: p.items.map((item) => ({
 ...item,
 drug_name: drugMap.get(item.drug_id) || t('pharmacy.unknown_drug'),
 })),
 }));

 const enrichedDispenses = dispensesData.map((d) => ({
 ...d,
 drug_name: drugMap.get(d.drug_id) || t('pharmacy.unknown_drug'),
 }));

 setPrescriptions(enrichedPrescriptions);
 setDispenses(enrichedDispenses);
 setDrugs(drugsData);
 setPatients(patientsData);
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleSearch = (rx: Prescription) => {
 setSelectedPrescription(rx);
 setModalVisible(true);
 };

 const handleDispense = async () => {
 if (!selectedPrescription) return;

 try {
 // Dispense each item
 for (const item of selectedPrescription.items) {
 await api.post('/api/pharmacy/dispenses', {
 prescription_id: selectedPrescription.id,
 patient_id: selectedPrescription.patient_id,
 drug_id: item.drug_id,
 quantity: item.quantity,
 });
 }
 void message.success(t('pharmacy.dispensed_success'));
 setModalVisible(false);
 void fetchData();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const filteredPrescriptions = prescriptions.filter(
 (p) =>
 p.patient_name?.toLowerCase().includes(searchText.toLowerCase()) ||
 p.id.toLowerCase().includes(searchText.toLowerCase())
 );

 const prescriptionColumns: ColumnsType<Prescription> = [
 {
 title: t('pharmacy.rx_number'),
 dataIndex: 'id',
 key: 'id',
 render: (id: string) => id.substring(0, 8),
 },
 {
 title: t('pharmacy.patient'),
 dataIndex: 'patient_name',
 key: 'patient_name',
 },
 {
 title: t('pharmacy.items'),
 dataIndex: 'items',
 key: 'items',
 render: (items: Array<{ drug_name?: string; quantity: number }>) =>
 items.map((item, idx) => (
 <Tag key={idx}>
 {item.drug_name} × {item.quantity}
 </Tag>
 )),
 },
 {
 title: t('pharmacy.issued_at'),
 dataIndex: 'issued_at',
 key: 'issued_at',
 render: (date: string) => date?.substring(0, 10),
 },
 {
 title: '',
 key: 'actions',
 width: 120,
 render: (_: unknown, record: Prescription) => (
 <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleSearch(record)}>
 {t('pharmacy.dispense')}
 </Button>
 ),
 },
 ];

 const dispenseColumns: ColumnsType<Dispense> = [
 {
 title: t('pharmacy.drug'),
 dataIndex: 'drug_name',
 key: 'drug_name',
 },
 {
 title: t('pharmacy.quantity'),
 dataIndex: 'quantity',
 key: 'quantity',
 },
 {
 title: t('pharmacy.dispensed_at'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (date?: string) => date?.substring(0, 16).replace('T', ' ') || '—',
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('pharmacy.dispense')}
 subtitle={t('pharmacy.dispense_subtitle')}
 />

 <FilterBar
 searchPlaceholder={t('pharmacy.search_patient_or_rx')}
 searchValue={searchText}
 onSearchChange={setSearchText}
 />

 <SectionCard title={t('pharmacy.search_prescription')} padded={false}>
 <DataTable<Prescription>
 dataSource={filteredPrescriptions}
 columns={prescriptionColumns}
 rowKey="id"
 loading={loading}
 stickyHeader={false}
 style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}
 pagination={{ pageSize: 20 }}
 />
 </SectionCard>

 <SectionCard title={t('pharmacy.recent_dispenses')} padded={false}>
 <DataTable<Dispense>
 dataSource={dispenses.slice(0, 50)}
 columns={dispenseColumns}
 rowKey="id"
 loading={loading}
 stickyHeader={false}
 style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}
 pagination={{ pageSize: 20 }}
 />
 </SectionCard>

 <FormDialog
 title={t('pharmacy.dispense_prescription')}
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => void handleDispense()}
 >
 {selectedPrescription && (
 <div>
 <p>
 <strong>{t('pharmacy.patient')}:</strong> {selectedPrescription.patient_name}
 </p>
 <p>
 <strong>{t('pharmacy.rx_number')}:</strong> {selectedPrescription.id.substring(0, 8)}
 </p>
 <p>
 <strong>{t('pharmacy.items')}:</strong>
 </p>
 <ul>
 {selectedPrescription.items.map((item, idx) => (
 <li key={idx}>
 {item.drug_name} — {t('pharmacy.quantity')}: {item.quantity}
 </li>
 ))}
 </ul>
 <p style={{ color: 'var(--danger-500)', marginTop: 16 }}>
 {t('pharmacy.dispense_warning')}
 </p>
 </div>
 )}
 </FormDialog>
 </div>
 );
};

export default PharmacyDispense;
