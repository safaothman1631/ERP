// Centralized config for the 21 backend modules added in Waves B/C/D.
// Each module has tabs (one per resource). Each resource has a list of fields
// for the Add modal. The hub component renders a Table from API list response.

export interface ResourceField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'textarea';
  options?: string[];
  required?: boolean;
}

export interface ResourceConfig {
  key: string;            // url segment after module base, e.g. "patients"
  label: string;          // tab label (kurdish)
  fields: ResourceField[];
}

export interface ModuleConfig {
  slug: string;           // route segment, e.g. "healthcare"
  basePath: string;       // api base, e.g. "/api/healthcare"
  title: string;          // header (kurdish)
  group: 'engagement' | 'platform' | 'vertical';
  resources: ResourceConfig[];
}

const f = (name: string, label: string, type: ResourceField['type'] = 'text', extra: Partial<ResourceField> = {}): ResourceField =>
  ({ name, label, type, ...extra });

export const MODULES: ModuleConfig[] = [
  // ── Wave B: engagement ────────────────────────────────────────────
  {
    slug: 'livechat', basePath: '/api/livechat', title: 'گفتوگۆی زیندوو', group: 'engagement',
    resources: [
      { key: 'channels', label: 'کەناڵەکان', fields: [f('name','ناو',undefined,{required:true}), f('type','جۆر','select',{options:['website','whatsapp','messenger','telegram']}), f('welcome_message','پەیامی بەخێرهاتن')] },
      { key: 'conversations', label: 'گفتوگۆکان', fields: [f('channel_id','کەناڵ',undefined,{required:true}), f('visitor_name','ناوی سەردانیکار'), f('visitor_email','ئیمەیل')] },
      { key: 'bots', label: 'بۆتەکان', fields: [f('name','ناو',undefined,{required:true}), f('description','وەسف','textarea')] },
      { key: 'flows', label: 'فلۆکان', fields: [f('bot_id','بۆت',undefined,{required:true}), f('name','ناو',undefined,{required:true})] },
      { key: 'canned', label: 'وەڵامە ئامادەکان', fields: [f('title','سەردێڕ',undefined,{required:true}), f('body','ناوەڕۆک','textarea',{required:true}), f('shortcut','کورتکراوە')] },
    ],
  },
  {
    slug: 'social', basePath: '/api/social', title: 'سۆشیال میدیا', group: 'engagement',
    resources: [
      { key: 'accounts', label: 'هەژمارەکان', fields: [f('platform','پلاتفۆرم','select',{options:['facebook','instagram','x','linkedin','tiktok','youtube','snapchat','pinterest'],required:true}), f('handle','نێو',undefined,{required:true})] },
      { key: 'posts', label: 'پۆستەکان', fields: [f('content','ناوەڕۆک','textarea',{required:true}), f('scheduled_at','کاتی پلاندانان','datetime')] },
      { key: 'engagements', label: 'بەشداربوون', fields: [f('post_id','پۆست',undefined,{required:true}), f('metric','مەترسی',undefined,{required:true}), f('value','ژمارە','number')] },
      { key: 'mentions', label: 'ناولێبردنەکان', fields: [f('account_id','هەژمار',undefined,{required:true}), f('platform','پلاتفۆرم'), f('author','نووسەر'), f('content','ناوەڕۆک','textarea')] },
    ],
  },
  {
    slug: 'comms', basePath: '/api/comms', title: 'SMS و VoIP', group: 'engagement',
    resources: [
      { key: 'sms-templates', label: 'تێمپلەیتی SMS', fields: [f('name','ناو',undefined,{required:true}), f('body','ناوەڕۆک','textarea',{required:true})] },
      { key: 'sms', label: 'SMSـەکان', fields: [f('to','بۆ',undefined,{required:true}), f('body','ناوەڕۆک','textarea',{required:true})] },
      { key: 'sms-campaigns', label: 'کامپەینەکان', fields: [f('name','ناو',undefined,{required:true}), f('template_id','تێمپلەیت',undefined,{required:true})] },
      { key: 'calls', label: 'پەیوەندیەکان', fields: [f('direction','ئاراستە','select',{options:['inbound','outbound']}), f('from_number','لە'), f('to_number','بۆ')] },
      { key: 'queues', label: 'ڕیزەکان', fields: [f('name','ناو',undefined,{required:true}), f('strategy','ستراتیجی','select',{options:['round_robin','least_busy','priority']})] },
    ],
  },
  {
    slug: 'engagement', basePath: '/api/engagement', title: 'بۆنە و راپرسی و ژوانەکان', group: 'engagement',
    resources: [
      { key: 'events', label: 'بۆنەکان', fields: [f('name','ناو',undefined,{required:true}), f('start_at','دەستپێک','datetime',{required:true}), f('end_at','کۆتایی','datetime',{required:true}), f('location','شوێن')] },
      { key: 'registrations', label: 'تۆمارکردن', fields: [f('event_id','بۆنە',undefined,{required:true}), f('attendee_name','ناو',undefined,{required:true}), f('attendee_email','ئیمەیل')] },
      { key: 'sponsors', label: 'پشتیوانان', fields: [f('event_id','بۆنە',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('tier','پلە','select',{options:['platinum','gold','silver','bronze']})] },
      { key: 'sessions', label: 'گفتوگۆکان', fields: [f('event_id','بۆنە',undefined,{required:true}), f('title','سەردێڕ',undefined,{required:true}), f('start_at','دەستپێک','datetime'), f('end_at','کۆتایی','datetime')] },
      { key: 'surveys', label: 'راپرسیەکان', fields: [f('title','سەردێڕ',undefined,{required:true}), f('description','وەسف','textarea')] },
      { key: 'questions', label: 'پرسیارەکان', fields: [f('survey_id','راپرسی',undefined,{required:true}), f('text','پرسیار','textarea',{required:true}), f('type','جۆر','select',{options:['text','number','choice','multi_choice','rating','scale','date']})] },
      { key: 'calendars', label: 'ڕۆژژمێرەکان', fields: [f('name','ناو',undefined,{required:true}), f('timezone','کاتزۆن')] },
      { key: 'slots', label: 'کاتە بەردەستەکان', fields: [f('calendar_id','ڕۆژژمێر',undefined,{required:true}), f('start_at','دەستپێک','datetime'), f('end_at','کۆتایی','datetime')] },
      { key: 'bookings', label: 'ژوانەکان', fields: [f('calendar_id','ڕۆژژمێر',undefined,{required:true}), f('customer_name','کڕیار',undefined,{required:true}), f('customer_email','ئیمەیل')] },
    ],
  },
  {
    slug: 'elearning', basePath: '/api/elearning', title: 'فێرکاری ئۆنلاین', group: 'engagement',
    resources: [
      { key: 'courses', label: 'کۆرسەکان', fields: [f('title','سەردێڕ',undefined,{required:true}), f('description','وەسف','textarea'), f('duration_hours','کاتژمێر','number'), f('pass_score','نمرەی دەرچوون','number')] },
      { key: 'lessons', label: 'وانەکان', fields: [f('course_id','کۆرس',undefined,{required:true}), f('title','سەردێڕ',undefined,{required:true}), f('sequence','ڕیز','number')] },
      { key: 'quizzes', label: 'تاقیکردنەوە', fields: [f('course_id','کۆرس',undefined,{required:true}), f('title','سەردێڕ',undefined,{required:true}), f('pass_score','نمرە','number')] },
      { key: 'enrollments', label: 'تۆمارکردن', fields: [f('course_id','کۆرس',undefined,{required:true}), f('employee_id','کارمەند',undefined,{required:true})] },
      { key: 'certificates', label: 'بڕوانامە', fields: [f('enrollment_id','تۆمار',undefined,{required:true}), f('employee_id','کارمەند',undefined,{required:true}), f('course_id','کۆرس',undefined,{required:true}), f('score','نمرە','number')] },
    ],
  },

  // ── Wave C: platform ──────────────────────────────────────────────
  {
    slug: 'rental', basePath: '/api/rental', title: 'کرێ و ئاژاوە', group: 'platform',
    resources: [
      { key: 'products', label: 'بەرهەمەکان', fields: [f('name','ناو',undefined,{required:true}), f('daily_rate','نرخی ڕۆژانە','number',{required:true}), f('deposit','بەرپێش','number'), f('quantity_total','کۆی بڕ','number')] },
      { key: 'contracts', label: 'گرێبەستەکان', fields: [f('customer_name','کڕیار',undefined,{required:true}), f('product_id','بەرهەم',undefined,{required:true}), f('start_date','دەستپێک','date',{required:true}), f('end_date','کۆتایی','date',{required:true})] },
      { key: 'pickups', label: 'وەرگرتنەکان', fields: [f('contract_id','گرێبەست',undefined,{required:true}), f('notes','تێبینی','textarea')] },
      { key: 'returns', label: 'گەڕاندنەوە', fields: [f('contract_id','گرێبەست',undefined,{required:true}), f('condition','حاڵەت','select',{options:['ok','damaged','missing']})] },
      { key: 'damages', label: 'زیانەکان', fields: [f('contract_id','گرێبەست',undefined,{required:true}), f('description','وەسف','textarea',{required:true}), f('charge_amount','بڕی پارە','number')] },
    ],
  },
  {
    slug: 'ai', basePath: '/api/ai', title: 'تایبەتمەندی AI', group: 'platform',
    resources: [
      { key: 'models', label: 'مۆدێلەکان', fields: [f('name','ناو',undefined,{required:true}), f('type','جۆر','select',{options:['forecast','anomaly','recommendation','classification','ocr','nlp']})] },
      { key: 'forecasts', label: 'پێشبینی', fields: [f('entity','بابەت',undefined,{required:true}), f('horizon_days','چەند ڕۆژ','number')] },
      { key: 'anomalies', label: 'نائاسایی', fields: [f('entity','بابەت',undefined,{required:true}), f('score','نمرە','number',{required:true})] },
      { key: 'recommendations', label: 'پێشنیارەکان', fields: [f('entity','بابەت',undefined,{required:true}), f('rationale','هۆکار','textarea')] },
      { key: 'ocr', label: 'OCR', fields: [f('file_url','URLـی فایل',undefined,{required:true}), f('document_type','جۆر','select',{options:['invoice','receipt','id','contract','other']})] },
    ],
  },
  {
    slug: 'mobile', basePath: '/api/mobile', title: 'مۆبایل API', group: 'platform',
    resources: [
      { key: 'tokens', label: 'تۆکنەکان', fields: [f('device_id','ID ئامێر',undefined,{required:true}), f('platform','پلاتفۆرم','select',{options:['android','ios','web']}), f('token','تۆکن',undefined,{required:true})] },
      { key: 'sessions', label: 'سێشنەکان', fields: [f('device_id','ID ئامێر',undefined,{required:true}), f('platform','پلاتفۆرم'), f('app_version','ڤێرژن')] },
      { key: 'push', label: 'ئاگاداری', fields: [f('title','سەردێڕ',undefined,{required:true}), f('body','ناوەڕۆک','textarea',{required:true})] },
    ],
  },
  {
    slug: 'iot', basePath: '/api/iot', title: 'IoT', group: 'platform',
    resources: [
      { key: 'devices', label: 'ئامێرەکان', fields: [f('name','ناو',undefined,{required:true}), f('type','جۆر','select',{options:['sensor','printer','camera','scanner','gateway']}), f('serial_no','سیریال'), f('location','شوێن')] },
      { key: 'readings', label: 'خوێندنەوە', fields: [f('device_id','ئامێر',undefined,{required:true}), f('metric','مەترسی',undefined,{required:true}), f('value','بڕ','number',{required:true})] },
      { key: 'alerts', label: 'ئاگادارکردنەوە', fields: [f('device_id','ئامێر',undefined,{required:true}), f('severity','ئاست','select',{options:['info','warning','error','critical']}), f('message','پەیام',undefined,{required:true})] },
      { key: 'rules', label: 'ڕێسەکان', fields: [f('metric','مەترسی',undefined,{required:true}), f('operator','ئۆپراتۆر','select',{options:['>','<','>=','<=','==','!=']}), f('threshold','سنوور','number',{required:true})] },
    ],
  },

  // ── Wave D: vertical industries ───────────────────────────────────
  {
    slug: 'healthcare', basePath: '/api/healthcare', title: 'تەندروستی', group: 'vertical',
    resources: [
      { key: 'patients', label: 'نەخۆشەکان', fields: [f('name','ناو',undefined,{required:true}), f('national_id','ID نیشتمانی'), f('dob','ڕۆژی لەدایکبوون','date'), f('gender','ڕەگەز','select',{options:['male','female','unknown']}), f('phone','تەلەفۆن')] },
      { key: 'appointments', label: 'ژوانەکان', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('scheduled_at','کات','datetime',{required:true}), f('reason','هۆکار')] },
      { key: 'prescriptions', label: 'ڕەچەتەکان', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('notes','تێبینی','textarea')] },
      { key: 'records', label: 'تۆمارەکان', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('record_type','جۆر','select',{options:['note','diagnosis','procedure','surgery','imaging']}), f('title','سەردێڕ',undefined,{required:true})] },
      { key: 'insurances', label: 'بیمەکان', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('provider','کۆمپانیا',undefined,{required:true}), f('policy_number','ژمارەی پۆلیسی',undefined,{required:true})] },
      { key: 'lab-results', label: 'ئەنجامی تاقیگە', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('test_name','تاقیکردنەوە',undefined,{required:true}), f('value','بەها',undefined,{required:true})] },
      { key: 'vitals', label: 'سەڕووکارەکان', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('temperature','پلەی گەرما','number'), f('heart_rate','لێدانی دڵ','number')] },
    ],
  },
  {
    slug: 'hospital', basePath: '/api/hospital', title: 'نەخۆشخانە', group: 'vertical',
    resources: [
      { key: 'wards', label: 'بەشەکان', fields: [f('name','ناو',undefined,{required:true}), f('floor','نهۆم'), f('capacity','گونجاندن','number')] },
      { key: 'beds', label: 'جێگاکان', fields: [f('ward_id','بەش',undefined,{required:true}), f('bed_number','ژمارە',undefined,{required:true}), f('type','جۆر','select',{options:['standard','icu','isolation','pediatric','maternity']})] },
      { key: 'doctors', label: 'پزیشکەکان', fields: [f('name','ناو',undefined,{required:true}), f('specialty','پسپۆڕی'), f('license_no','ڕەخسەت')] },
      { key: 'admissions', label: 'وەرگرتن', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('reason','هۆکار')] },
      { key: 'lab-orders', label: 'فەرمانی تاقیگە', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('priority','گرنگی','select',{options:['routine','urgent','stat','normal']})] },
      { key: 'radiology-orders', label: 'فەرمانی تیشک', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('modality','جۆر','select',{options:['xray','ct','mri','ultrasound','pet']})] },
      { key: 'surgeries', label: 'نەشتەرگەری', fields: [f('patient_id','نەخۆش',undefined,{required:true}), f('procedure','نەشتەرگەری',undefined,{required:true}), f('scheduled_at','کات','datetime',{required:true})] },
    ],
  },
  {
    slug: 'pharmacy', basePath: '/api/pharmacy', title: 'دەرمانخانە', group: 'vertical',
    resources: [
      { key: 'drugs', label: 'دەرمانەکان', fields: [f('name','ناو',undefined,{required:true}), f('generic_name','ناوی گشتی'), f('strength','هێز'), f('form','شێوە','select',{options:['tablet','capsule','syrup','injection','cream','drops','inhaler']})] },
      { key: 'batches', label: 'بەستەکان', fields: [f('drug_id','دەرمان',undefined,{required:true}), f('batch_no','ژمارە',undefined,{required:true}), f('expiry_date','بەسەرچوون','date',{required:true}), f('quantity','بڕ','number')] },
      { key: 'dispenses', label: 'دابەشکردن', fields: [f('drug_id','دەرمان',undefined,{required:true}), f('quantity','بڕ','number',{required:true}), f('instructions','ڕێنمایی','textarea')] },
      { key: 'interactions', label: 'کارلێک', fields: [f('drug_a_id','دەرمان A',undefined,{required:true}), f('drug_b_id','دەرمان B',undefined,{required:true}), f('severity','گرنگی','select',{options:['minor','moderate','major','contraindicated']})] },
    ],
  },
  {
    slug: 'hotel', basePath: '/api/hotel', title: 'هۆتێل', group: 'vertical',
    resources: [
      { key: 'room-types', label: 'جۆری ژوور', fields: [f('name','ناو',undefined,{required:true}), f('base_price','نرخ','number'), f('max_occupancy','گونجاندن','number')] },
      { key: 'rooms', label: 'ژوورەکان', fields: [f('room_type_id','جۆر',undefined,{required:true}), f('number','ژمارە',undefined,{required:true}), f('floor','نهۆم'), f('status','حاڵەت','select',{options:['available','occupied','cleaning','maintenance','out_of_order']})] },
      { key: 'guests', label: 'میوانەکان', fields: [f('name','ناو',undefined,{required:true}), f('phone','تەلەفۆن'), f('nationality','نەتەوە')] },
      { key: 'reservations', label: 'حیجزکردن', fields: [f('guest_id','میوان',undefined,{required:true}), f('check_in_date','چونە ژوورەوە','date',{required:true}), f('check_out_date','دەرچوون','date',{required:true}), f('rate','نرخ','number')] },
      { key: 'housekeeping', label: 'خاوێنکردنەوە', fields: [f('room_id','ژوور',undefined,{required:true}), f('task_type','جۆر','select',{options:['cleaning','deep_clean','maintenance','inspection']})] },
      { key: 'folios', label: 'فۆلیۆ', fields: [f('reservation_id','حیجز',undefined,{required:true}), f('description','وەسف',undefined,{required:true}), f('amount','بڕ','number',{required:true})] },
    ],
  },
  {
    slug: 'restaurant', basePath: '/api/restaurant', title: 'چێشتخانە', group: 'vertical',
    resources: [
      { key: 'menus', label: 'مێنیوەکان', fields: [f('name','ناو',undefined,{required:true})] },
      { key: 'menu-items', label: 'بڕگەکان', fields: [f('menu_id','مێنیو',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('price','نرخ','number',{required:true}), f('category','جۆر')] },
      { key: 'tables', label: 'مێزەکان', fields: [f('number','ژمارە',undefined,{required:true}), f('seats','کورسی','number'), f('status','حاڵەت','select',{options:['free','occupied','reserved','cleaning']})] },
      { key: 'orders', label: 'داواکارییەکان', fields: [f('order_type','جۆر','select',{options:['dine_in','takeaway','delivery','self_order']}), f('customer_name','کڕیار')] },
      { key: 'kds', label: 'KDS', fields: [f('order_id','داواکاری',undefined,{required:true}), f('station','ستەیشن','select',{options:['kitchen','bar','grill','salad','dessert']})] },
      { key: 'delivery-orders', label: 'گەیاندن', fields: [f('order_id','داواکاری',undefined,{required:true}), f('address','ناونیشان',undefined,{required:true}), f('phone','تەلەفۆن',undefined,{required:true})] },
    ],
  },
  {
    slug: 'construction', basePath: '/api/construction', title: 'بنیاتنان', group: 'vertical',
    resources: [
      { key: 'projects', label: 'پڕۆژەکان', fields: [f('name','ناو',undefined,{required:true}), f('client','کڕیار'), f('contract_value','بەهای گرێبەست','number')] },
      { key: 'sites', label: 'شوێنەکان', fields: [f('name','ناو',undefined,{required:true}), f('address','ناونیشان')] },
      { key: 'wbs', label: 'WBS', fields: [f('project_id','پڕۆژە',undefined,{required:true}), f('code','کۆد',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('budget','بودجە','number')] },
      { key: 'progress-billings', label: 'فاکتوری پێشکەوتن', fields: [f('project_id','پڕۆژە',undefined,{required:true}), f('period_start','دەستپێک','date'), f('period_end','کۆتایی','date'), f('pct_complete','%','number',{required:true})] },
      { key: 'job-costs', label: 'تێچوو', fields: [f('project_id','پڕۆژە',undefined,{required:true}), f('cost_type','جۆر','select',{options:['labor','material','equipment','subcontract','overhead']}), f('description','وەسف',undefined,{required:true}), f('amount','بڕ','number',{required:true})] },
      { key: 'equipment', label: 'ئامێرەکان', fields: [f('name','ناو',undefined,{required:true}), f('serial_no','سیریال'), f('daily_rate','نرخی ڕۆژانە','number')] },
      { key: 'subcontractors', label: 'سەرپەرشتیار', fields: [f('name','ناو',undefined,{required:true}), f('trade','پیشە'), f('contract_value','بەها','number')] },
    ],
  },
  {
    slug: 'real-estate', basePath: '/api/real-estate', title: 'موڵک', group: 'vertical',
    resources: [
      { key: 'properties', label: 'موڵکەکان', fields: [f('name','ناو',undefined,{required:true}), f('address','ناونیشان',undefined,{required:true}), f('property_type','جۆر','select',{options:['residential','commercial','industrial','land','mixed']})] },
      { key: 'units', label: 'یەکەکان', fields: [f('property_id','موڵک',undefined,{required:true}), f('unit_number','ژمارە',undefined,{required:true}), f('bedrooms','ژوور','number'), f('rent_amount','کرێ','number')] },
      { key: 'tenants', label: 'کرێچی', fields: [f('name','ناو',undefined,{required:true}), f('phone','تەلەفۆن'), f('national_id','ID نیشتمانی')] },
      { key: 'leases', label: 'گرێبەستی کرێ', fields: [f('unit_id','یەکە',undefined,{required:true}), f('tenant_id','کرێچی',undefined,{required:true}), f('start_date','دەستپێک','date',{required:true}), f('end_date','کۆتایی','date',{required:true}), f('monthly_rent','کرێی مانگانە','number',{required:true})] },
      { key: 'rent-invoices', label: 'فاکتوری کرێ', fields: [f('lease_id','گرێبەست',undefined,{required:true}), f('amount','بڕ','number',{required:true}), f('due_date','بەرواری','date')] },
      { key: 'maint-requests', label: 'داواکاری چاکسازی', fields: [f('description','وەسف','textarea',{required:true}), f('priority','گرنگی','select',{options:['low','normal','high','urgent']})] },
    ],
  },
  {
    slug: 'education', basePath: '/api/education', title: 'پەروەردە', group: 'vertical',
    resources: [
      { key: 'students', label: 'قوتابیەکان', fields: [f('name','ناو',undefined,{required:true}), f('student_id','ID قوتابی'), f('parent_phone','تەلەفۆنی دایک/باوک'), f('grade_level','پۆل')] },
      { key: 'teachers', label: 'مامۆستاکان', fields: [f('name','ناو',undefined,{required:true}), f('employee_id','ID کارمەند'), f('phone','تەلەفۆن')] },
      { key: 'courses', label: 'کۆرسەکان', fields: [f('name','ناو',undefined,{required:true}), f('code','کۆد',undefined,{required:true}), f('credits','کریدت','number')] },
      { key: 'classes', label: 'پۆلەکان', fields: [f('course_id','کۆرس',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('room','ژوور')] },
      { key: 'enrollments', label: 'تۆمار', fields: [f('student_id','قوتابی',undefined,{required:true}), f('class_id','پۆل',undefined,{required:true})] },
      { key: 'attendance', label: 'ئامادەبوون', fields: [f('student_id','قوتابی',undefined,{required:true}), f('class_id','پۆل',undefined,{required:true}), f('date','بەروار','date',{required:true}), f('status','حاڵەت','select',{options:['present','absent','late','excused']})] },
      { key: 'grades', label: 'نمرەکان', fields: [f('student_id','قوتابی',undefined,{required:true}), f('class_id','پۆل',undefined,{required:true}), f('assessment','هەڵسەنگاندن',undefined,{required:true}), f('score','نمرە','number',{required:true})] },
      { key: 'fees', label: 'کرێکان', fields: [f('student_id','قوتابی',undefined,{required:true}), f('fee_type','جۆر',undefined,{required:true}), f('amount','بڕ','number',{required:true})] },
      { key: 'fee-payments', label: 'پارەدان', fields: [f('fee_id','کرێ',undefined,{required:true}), f('amount','بڕ','number',{required:true}), f('method','شێواز','select',{options:['cash','card','transfer','cheque']})] },
    ],
  },
  {
    slug: 'logistics', basePath: '/api/logistics', title: 'لۆجستی', group: 'vertical',
    resources: [
      { key: 'shipments', label: 'گەیاندنەکان', fields: [f('tracking_number','ژمارەی شوێنپێ'), f('origin','سەرچاوە',undefined,{required:true}), f('destination','گەیشتن',undefined,{required:true}), f('weight_kg','کیلۆ','number'), f('receiver','وەرگر')] },
      { key: 'routes', label: 'ڕێگاکان', fields: [f('name','ناو',undefined,{required:true}), f('planned_date','بەروار','date')] },
      { key: 'drivers', label: 'شۆفێرەکان', fields: [f('name','ناو',undefined,{required:true}), f('license_no','ڕەخسەت'), f('phone','تەلەفۆن')] },
      { key: 'vehicles', label: 'ئۆتۆمبیلەکان', fields: [f('plate_number','ژمارەی پلێت',undefined,{required:true}), f('type','جۆر','select',{options:['motorcycle','van','truck','trailer','car']}), f('capacity_kg','کیلۆ','number')] },
      { key: 'gps', label: 'GPS', fields: [f('vehicle_id','ئۆتۆمبیل',undefined,{required:true}), f('latitude','عەرز','number',{required:true}), f('longitude','درێژ','number',{required:true})] },
      { key: 'freight-rates', label: 'نرخی بار', fields: [f('origin_zone','زۆن سەرچاوە',undefined,{required:true}), f('destination_zone','زۆن گەیشتن',undefined,{required:true}), f('price','نرخ','number',{required:true})] },
    ],
  },
  {
    slug: 'agriculture', basePath: '/api/agriculture', title: 'کشتوکاڵ', group: 'vertical',
    resources: [
      { key: 'fields', label: 'کێڵگەکان', fields: [f('name','ناو',undefined,{required:true}), f('area_dunum','دۆنم','number'), f('soil_type','جۆری خاک')] },
      { key: 'crops', label: 'بەرهەمە کشتوکاڵیەکان', fields: [f('name','ناو',undefined,{required:true}), f('variety','جۆر'), f('growth_days','ڕۆژی گەشە','number')] },
      { key: 'plantings', label: 'چاندن', fields: [f('field_id','کێڵگە',undefined,{required:true}), f('crop_id','بەرهەم',undefined,{required:true}), f('planted_at','بەرواری چاندن','date',{required:true})] },
      { key: 'harvests', label: 'دروێنە', fields: [f('planting_id','چاندن',undefined,{required:true}), f('harvested_at','بەرواری دروێنە','date',{required:true}), f('quantity','بڕ','number',{required:true})] },
      { key: 'livestock', label: 'ئاژەڵ', fields: [f('species','جۆر',undefined,{required:true}), f('breed','نەژاد'), f('tag_number','ژمارەی نیشانە'), f('sex','ڕەگەز','select',{options:['male','female','unknown']})] },
      { key: 'irrigation', label: 'ئاودان', fields: [f('field_id','کێڵگە',undefined,{required:true}), f('method','شێواز','select',{options:['drip','sprinkler','flood','manual']}), f('water_liters','لیتر','number')] },
      { key: 'fertilization', label: 'پەینکردن', fields: [f('field_id','کێڵگە',undefined,{required:true}), f('fertilizer','پەین',undefined,{required:true}), f('quantity_kg','کیلۆ','number')] },
    ],
  },
  {
    slug: 'ngo', basePath: '/api/ngo', title: 'ڕێکخراو ناحکومی', group: 'vertical',
    resources: [
      { key: 'donors', label: 'بەخشەرەکان', fields: [f('name','ناو',undefined,{required:true}), f('email','ئیمەیل'), f('phone','تەلەفۆن'), f('type','جۆر','select',{options:['individual','corporate','government','foundation']})] },
      { key: 'donations', label: 'بەخشینەکان', fields: [f('donor_id','بەخشەر',undefined,{required:true}), f('amount','بڕ','number',{required:true}), f('currency','جۆری دراو')] },
      { key: 'campaigns', label: 'کامپەینەکان', fields: [f('name','ناو',undefined,{required:true}), f('target_amount','ئامانج','number')] },
      { key: 'grants', label: 'گرانتەکان', fields: [f('funder','دارایی پێبەخش',undefined,{required:true}), f('title','سەردێڕ',undefined,{required:true}), f('amount','بڕ','number',{required:true})] },
      { key: 'funds', label: 'سندوقەکان', fields: [f('name','ناو',undefined,{required:true}), f('purpose','مەبەست','textarea')] },
      { key: 'beneficiaries', label: 'سوودمەندەکان', fields: [f('name','ناو',undefined,{required:true}), f('category','جۆر'), f('location','شوێن')] },
      { key: 'volunteers', label: 'خۆبەخشەکان', fields: [f('name','ناو',undefined,{required:true}), f('availability','بەردەستی')] },
    ],
  },
  {
    slug: 'government', basePath: '/api/government', title: 'حکومی', group: 'vertical',
    resources: [
      { key: 'citizens', label: 'هاوڵاتیان', fields: [f('name','ناو',undefined,{required:true}), f('national_id','ID نیشتمانی',undefined,{required:true}), f('phone','تەلەفۆن'), f('address','ناونیشان')] },
      { key: 'services', label: 'خزمەتگوزاریەکان', fields: [f('name','ناو',undefined,{required:true}), f('department','بەش'), f('fee','کرێ','number')] },
      { key: 'service-requests', label: 'داواکاریەکان', fields: [f('citizen_id','هاوڵاتی',undefined,{required:true}), f('service_id','خزمەت',undefined,{required:true})] },
      { key: 'permits', label: 'مۆڵەتەکان', fields: [f('citizen_id','هاوڵاتی',undefined,{required:true}), f('permit_type','جۆر','select',{options:['building','business','driving','trade','import','export','other']}), f('fee','کرێ','number')] },
      { key: 'tax-assessments', label: 'سەنجەی باج', fields: [f('citizen_id','هاوڵاتی',undefined,{required:true}), f('tax_year','ساڵ','number',{required:true}), f('tax_type','جۆر',undefined,{required:true}), f('assessed_amount','بڕ','number',{required:true})] },
      { key: 'tenders', label: 'مەزایدەکان', fields: [f('title','سەردێڕ',undefined,{required:true}), f('estimated_value','بەهای پێشبینی','number'), f('closing_date','بەرواری داخستن','date',{required:true})] },
      { key: 'tender-bids', label: 'پێشنیارەکان', fields: [f('tender_id','مەزایدە',undefined,{required:true}), f('bidder_name','پێشنیاردەر',undefined,{required:true}), f('amount','بڕ','number',{required:true})] },
    ],
  },
  // ── Wave A: business apps ─────────────────────────────────────────
  {
    slug: 'helpdesk', basePath: '/api/helpdesk', title: 'یارمەتیدان (Helpdesk)', group: 'engagement',
    resources: [
      { key: 'teams', label: 'تیمەکان', fields: [f('name','ناو',undefined,{required:true}), f('description','وەسف','textarea')] },
      { key: 'categories', label: 'پۆلەکان', fields: [f('name','ناو',undefined,{required:true}), f('color','ڕەنگ')] },
      { key: 'tags', label: 'تاگەکان', fields: [f('name','ناو',undefined,{required:true}), f('color','ڕەنگ')] },
      { key: 'sla-policies', label: 'سیاسەتی SLA', fields: [f('name','ناو',undefined,{required:true}), f('priority','ئاراستە','select',{options:['low','medium','high','urgent']}), f('response_minutes','وەڵامدانەوە (خولەک)','number'), f('resolution_minutes','چارەسەر (خولەک)','number')] },
      { key: 'tickets', label: 'بلیتەکان', fields: [f('subject','بابەت',undefined,{required:true}), f('description','وەسف','textarea'), f('contact_email','ئیمەیلی پەیوەندیدار')] },
      { key: 'canned', label: 'وەڵامە ئامادەکان', fields: [f('title','سەردێڕ',undefined,{required:true}), f('body','ناوەڕۆک','textarea',{required:true}), f('shortcut','کورتکراوە')] },
    ],
  },
  {
    slug: 'field-service', basePath: '/api/field-service', title: 'خزمەتگوزاری مەیدانی', group: 'engagement',
    resources: [
      { key: 'workers', label: 'کرێکاران', fields: [f('name','ناو',undefined,{required:true}), f('email','ئیمەیل'), f('phone','تەلەفۆن'), f('skills','شارەزایی')] },
      { key: 'service-types', label: 'جۆری خزمەت', fields: [f('name','ناو',undefined,{required:true}), f('description','وەسف','textarea'), f('base_price','نرخی بنەڕەت','number')] },
      { key: 'orders', label: 'داواکاریەکان', fields: [f('customer_name','کڕیار',undefined,{required:true}), f('service_type_id','جۆری خزمەت'), f('scheduled_at','کاتی پلاندانان','datetime')] },
      { key: 'dispatches', label: 'ناردنەکان', fields: [f('order_id','داواکاری',undefined,{required:true}), f('worker_id','کرێکار',undefined,{required:true})] },
      { key: 'routes', label: 'ڕێگاکان', fields: [f('name','ناو',undefined,{required:true}), f('date','بەروار','date')] },
      { key: 'parts', label: 'پارچەکان', fields: [f('order_id','داواکاری',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('quantity','بڕ','number')] },
      { key: 'signatures', label: 'واژۆکان', fields: [f('order_id','داواکاری',undefined,{required:true}), f('signer_name','واژۆکەر',undefined,{required:true})] },
    ],
  },
  {
    slug: 'subscriptions', basePath: '/api/subscriptions', title: 'بەشدارییەکان', group: 'engagement',
    resources: [
      { key: 'plans', label: 'پلانەکان', fields: [f('name','ناو',undefined,{required:true}), f('price','نرخ','number',{required:true}), f('billing_period','ماوە','select',{options:['monthly','quarterly','yearly']}), f('trial_days','ڕۆژی تاقیکردنەوە','number')] },
      { key: 'addons', label: 'زیادکراوەکان', fields: [f('name','ناو',undefined,{required:true}), f('price','نرخ','number',{required:true})] },
      { key: 'coupons', label: 'کۆپۆنەکان', fields: [f('code','کۆد',undefined,{required:true}), f('discount_percent','ڕێژەی داشکاندن (%)','number')] },
      { key: 'invoices', label: 'فاکتورەکان', fields: [f('subscription_id','بەشداری',undefined,{required:true}), f('amount','بڕ','number')] },
    ],
  },
  {
    slug: 'documents', basePath: '/api/documents', title: 'دۆکیومێنتەکان', group: 'engagement',
    resources: [
      { key: 'folders', label: 'بوخچەکان', fields: [f('name','ناو',undefined,{required:true}), f('parent_id','بوخچەی باوک')] },
      { key: 'files', label: 'فایلەکان', fields: [f('folder_id','بوخچە'), f('filename','ناوی فایل',undefined,{required:true}), f('size','قەبارە','number')] },
      { key: 'shares', label: 'هاوبەشکردنەکان', fields: [f('file_id','فایل',undefined,{required:true}), f('shared_with','هاوبەش لەگەڵ'), f('permission','دەسەڵات','select',{options:['read','write']})] },
      { key: 'sign-requests', label: 'داواکاری واژۆ', fields: [f('file_id','فایل',undefined,{required:true}), f('signer_email','ئیمەیلی واژۆکەر',undefined,{required:true}), f('title','سەردێڕ',undefined,{required:true})] },
      { key: 'workflows', label: 'فلۆکان', fields: [f('name','ناو',undefined,{required:true}), f('description','وەسف','textarea')] },
    ],
  },
  {
    slug: 'knowledge', basePath: '/api/knowledge', title: 'زانیاری (Wiki)', group: 'engagement',
    resources: [
      { key: 'categories', label: 'پۆلەکان', fields: [f('name','ناو',undefined,{required:true}), f('description','وەسف')] },
      { key: 'articles', label: 'وتارەکان', fields: [f('title','سەردێڕ',undefined,{required:true}), f('category_id','پۆل'), f('content','ناوەڕۆک','textarea',{required:true})] },
      { key: 'comments', label: 'کۆمێنتەکان', fields: [f('article_id','وتار',undefined,{required:true}), f('body','ناوەڕۆک','textarea',{required:true}), f('author_name','نووسەر')] },
    ],
  },
  {
    slug: 'quality', basePath: '/api/quality', title: 'کوالێتی', group: 'vertical',
    resources: [
      { key: 'teams', label: 'تیمەکان', fields: [f('name','ناو',undefined,{required:true}), f('description','وەسف')] },
      { key: 'points', label: 'خاڵە چاودێریەکان', fields: [f('name','ناو',undefined,{required:true}), f('product_id','بەرهەم'), f('checklist','لیستی چاودێری','textarea')] },
      { key: 'reasons', label: 'هۆکارەکان', fields: [f('name','ناو',undefined,{required:true}), f('category','پۆل')] },
      { key: 'checks', label: 'چاودێریەکان', fields: [f('point_id','خاڵ',undefined,{required:true}), f('result','ئەنجام','select',{options:['pass','fail']}), f('notes','تێبینی','textarea')] },
      { key: 'alerts', label: 'ئاگاداریەکان', fields: [f('title','سەردێڕ',undefined,{required:true}), f('description','وەسف','textarea'), f('severity','گرنگی','select',{options:['low','medium','high','critical']})] },
      { key: 'non-conformities', label: 'نا-ڕێکوپێکی', fields: [f('title','سەردێڕ',undefined,{required:true}), f('description','وەسف','textarea')] },
      { key: 'capa', label: 'CAPA', fields: [f('title','سەردێڕ',undefined,{required:true}), f('action','کردار','textarea'), f('owner','بەرپرس')] },
    ],
  },
  {
    slug: 'maintenance', basePath: '/api/maintenance', title: 'چاککردنەوە', group: 'vertical',
    resources: [
      { key: 'categories', label: 'پۆلەکان', fields: [f('name','ناو',undefined,{required:true}), f('description','وەسف')] },
      { key: 'equipment', label: 'ئامێرەکان', fields: [f('name','ناو',undefined,{required:true}), f('serial_number','ژمارەی سیریاڵ'), f('category_id','پۆل')] },
      { key: 'requests', label: 'داواکاریەکان', fields: [f('equipment_id','ئامێر',undefined,{required:true}), f('description','وەسف','textarea',{required:true}), f('priority','ئاراستە','select',{options:['low','medium','high']})] },
      { key: 'schedules', label: 'پلانەکان', fields: [f('equipment_id','ئامێر',undefined,{required:true}), f('frequency_days','هەر چەند ڕۆژ','number',{required:true}), f('description','وەسف')] },
      { key: 'logs', label: 'تۆمارەکان', fields: [f('equipment_id','ئامێر',undefined,{required:true}), f('description','وەسف','textarea'), f('performed_by','ئەنجامدەر')] },
    ],
  },
  {
    slug: 'plm', basePath: '/api/plm', title: 'PLM', group: 'vertical',
    resources: [
      { key: 'versions', label: 'وەرسیۆنەکان', fields: [f('product_id','بەرهەم',undefined,{required:true}), f('version','وەرسیۆن',undefined,{required:true}), f('notes','تێبینی','textarea')] },
      { key: 'ecos', label: 'ECOـەکان', fields: [f('product_id','بەرهەم',undefined,{required:true}), f('title','سەردێڕ',undefined,{required:true}), f('reason','هۆکار','textarea'), f('status','دۆخ','select',{options:['draft','approved','closed']})] },
      { key: 'stages', label: 'قۆناغەکان', fields: [f('name','ناو',undefined,{required:true}), f('description','وەسف'), f('order_no','ڕیز','number')] },
      { key: 'boms', label: 'BOMـەکان', fields: [f('product_id','بەرهەم',undefined,{required:true}), f('version','وەرسیۆن'), f('notes','تێبینی','textarea')] },
      { key: 'attachments', label: 'هاوپێچەکان', fields: [f('eco_id','ECO',undefined,{required:true}), f('filename','ناوی فایل',undefined,{required:true}), f('url','بەستەر')] },
    ],
  },
  {
    slug: 'repairs', basePath: '/api/repairs', title: 'چاککردنەوەکان', group: 'vertical',
    resources: [
      { key: 'orders', label: 'داواکاریەکان', fields: [f('product_id','بەرهەم',undefined,{required:true}), f('customer_id','کڕیار'), f('description','وەسف','textarea'), f('status','دۆخ','select',{options:['draft','in_progress','done']})] },
      { key: 'parts', label: 'پارچەکان', fields: [f('order_id','داواکاری',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('quantity','بڕ','number',{required:true})] },
      { key: 'warranties', label: 'گەرەنتیەکان', fields: [f('product_id','بەرهەم',undefined,{required:true}), f('customer_id','کڕیار'), f('expires_at','بەسەرچوون','date')] },
    ],
  },
  {
    slug: 'hr-extended', basePath: '/api/hr-extended', title: 'HR زیادکراو (دامەزراندن + هەڵسەنگاندن)', group: 'engagement',
    resources: [
      { key: 'candidates', label: 'پێشنیارکراوان', fields: [f('name','ناو',undefined,{required:true}), f('email','ئیمەیل'), f('phone','تەلەفۆن'), f('position','پێگە')] },
      { key: 'applications', label: 'داواکاریەکان', fields: [f('candidate_id','پێشنیارکراو',undefined,{required:true}), f('job_position','پێگەی کار',undefined,{required:true}), f('status','دۆخ','select',{options:['applied','screening','interview','offer','hired','rejected']})] },
      { key: 'interviews', label: 'وتووێژەکان', fields: [f('application_id','داواکاری',undefined,{required:true}), f('scheduled_at','کات','datetime',{required:true}), f('interviewer','وتووێژکار')] },
      { key: 'cycles', label: 'سووڕەکان', fields: [f('name','ناو',undefined,{required:true}), f('start_date','دەستپێک','date',{required:true}), f('end_date','کۆتایی','date',{required:true})] },
      { key: 'appraisals', label: 'هەڵسەنگاندنەکان', fields: [f('employee_id','کارمەند',undefined,{required:true}), f('cycle_id','سووڕ',undefined,{required:true}), f('rating','نمرە','number')] },
      { key: 'goals', label: 'ئامانجەکان', fields: [f('employee_id','کارمەند',undefined,{required:true}), f('title','سەردێڕ',undefined,{required:true}), f('target_date','بەرواری ئامانج','date')] },
      { key: 'feedbacks', label: 'فیدباک', fields: [f('employee_id','کارمەند',undefined,{required:true}), f('feedback','فیدباک','textarea',{required:true}), f('reviewer','چاودێر')] },
      { key: 'employee-skills', label: 'شارەزاییەکان', fields: [f('employee_id','کارمەند',undefined,{required:true}), f('skill','شارەزایی',undefined,{required:true}), f('level','ئاست','select',{options:['beginner','intermediate','advanced','expert']})] },
    ],
  },
  {
    slug: 'studio', basePath: '/api/studio', title: 'ستۆدیۆ (No-code)', group: 'platform',
    resources: [
      { key: 'models', label: 'مۆدێلەکان', fields: [f('name','ناو',undefined,{required:true}), f('label','لەیبڵ',undefined,{required:true}), f('description','وەسف','textarea')] },
      { key: 'fields', label: 'فیلدەکان', fields: [f('model_id','مۆدێل',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('label','لەیبڵ',undefined,{required:true}), f('type','جۆر','select',{options:['text','number','date','datetime','select','boolean']})] },
      { key: 'views', label: 'ڕوانگەکان', fields: [f('model_id','مۆدێل',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('type','جۆر','select',{options:['list','form','kanban','calendar']})] },
      { key: 'menus', label: 'مێنوەکان', fields: [f('name','ناو',undefined,{required:true}), f('parent_id','بابی'), f('order','ڕیز','number'), f('icon','وێنۆچکە')] },
      { key: 'workflows', label: 'فلۆکان', fields: [f('model_id','مۆدێل',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('trigger','هۆکاری چالاککردن','select',{options:['on_create','on_update','on_delete','scheduled']})] },
      { key: 'records', label: 'تۆمارەکان', fields: [f('model_id','مۆدێل',undefined,{required:true}), f('data','داتا (JSON)','textarea')] },
      { key: 'reports', label: 'ڕاپۆرتەکان', fields: [f('model_id','مۆدێل',undefined,{required:true}), f('name','ناو',undefined,{required:true}), f('description','وەسف','textarea')] },
    ],
  },
];

export const getModuleBySlug = (slug: string) => MODULES.find(m => m.slug === slug);
