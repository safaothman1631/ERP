import { useMemo, useState } from 'react';

import {

  Button, Checkbox, Empty, Input, theme as antdTheme, App as AntApp,

} from 'antd';

import {

  CheckCircleFilled, RocketOutlined, AppstoreOutlined, FlagOutlined,

  SearchOutlined, CheckOutlined,

} from '@ant-design/icons';

import { useTranslation } from 'react-i18next';

import { INDUSTRIES, MODULES, ALWAYS_ON, type ModuleKey, type ModuleDef } from './industries';

import { useOnboardingStore, isModuleInLicensePool } from './store';

import PendingApprovalScreen from './PendingApprovalScreen';

import OnboardingWizardShell from './OnboardingWizardShell';

import OnboardingUserControls from './OnboardingUserControls';

import styles from './OnboardingWizard.module.css';



interface OnboardingWizardProps {

  open: boolean;

  firstTime?: boolean;

  onClose: () => void;

  onComplete?: () => void;

}



const CATEGORY_ORDER: Array<ModuleDef['category']> = [

  'finance', 'ops', 'people', 'system', 'engagement', 'platform', 'vertical',

];



const CATEGORY_KEY: Record<ModuleDef['category'], { key: string; fallback: string }> = {

  core: { key: 'cat_other', fallback: 'Core' },

  finance: { key: 'cat_finance', fallback: 'Finance' },

  ops: { key: 'cat_operations', fallback: 'Operations' },

  people: { key: 'cat_people', fallback: 'People' },

  system: { key: 'cat_system', fallback: 'سیستەم و یەکگرتنەکان' },

  engagement: { key: 'cat_engagement', fallback: 'بەشدارکردن و خزمەت' },

  platform: { key: 'cat_platform', fallback: 'پلاتفۆرم و AI' },

  vertical: { key: 'cat_vertical', fallback: 'پیشەسازییە تایبەتەکان' },

};



const norm = (s: string) =>

  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();



export default function OnboardingWizard({ open, firstTime = false, onClose, onComplete }: OnboardingWizardProps) {

  const { t } = useTranslation();

  const { token } = antdTheme.useToken();

  const { message } = AntApp.useApp();



  const complete = useOnboardingStore(s => s.complete);

  const submitModuleRequest = useOnboardingStore(s => s.submitModuleRequest);

  const requireModuleApproval = useOnboardingStore(s => s.requireModuleApproval);

  const pendingRequest = useOnboardingStore(s => s.pendingRequest);

  const license = useOnboardingStore(s => s.license);

  const saving = useOnboardingStore(s => s.saving);

  const savedIndustry = useOnboardingStore(s => s.industryId);

  const savedMods = useOnboardingStore(s => s.enabledModules);



  const [step, setStep] = useState(0);

  const [industryId, setIndustryId] = useState<string | null>(savedIndustry);

  const [selected, setSelected] = useState<Set<ModuleKey>>(new Set(savedMods || []));

  const [search, setSearch] = useState('');



  const stepLabels = [

    t('onb_step_industry'),

    t('onb_step_modules'),

    t('onb_step_review'),

  ];



  const pickIndustry = (id: string) => {

    setIndustryId(id);

    const ind = INDUSTRIES.find(i => i.id === id);

    if (ind) setSelected(new Set<ModuleKey>([...ind.modules, ...ALWAYS_ON]));

  };



  const toggle = (k: ModuleKey) => {

    if (ALWAYS_ON.includes(k)) return;

    setSelected(prev => {

      const next = new Set(prev);

      if (next.has(k)) next.delete(k); else next.add(k);

      return next;

    });

  };



  const selectAllVisible = () => {

    setSelected(prev => {

      const next = new Set(prev);

      filteredModules.forEach(m => next.add(m.key));

      return next;

    });

  };



  const clearAllOptional = () => {

    setSelected(new Set<ModuleKey>(ALWAYS_ON));

  };



  const filteredModules = useMemo(() => {

    const pool = license.allowedModules;

    const base = MODULES.filter(m => isModuleInLicensePool(m.key, pool));

    if (!search.trim()) return base;

    const q = norm(search.trim());

    return base.filter(m =>

      norm(m.title).includes(q) ||

      norm(m.description).includes(q) ||

      norm(m.key).includes(q) ||

      norm(t(m.labelKey, m.title)).includes(q)

    );

  }, [search, t, license.allowedModules]);



  const grouped = useMemo(() => {

    const map = new Map<ModuleDef['category'], ModuleDef[]>();

    for (const m of filteredModules) {

      const arr = map.get(m.category) || [];

      arr.push(m);

      map.set(m.category, arr);

    }

    return map;

  }, [filteredModules]);



  const finish = async () => {

    try {

      if (requireModuleApproval) {

        await submitModuleRequest(industryId, Array.from(selected));

        message.success(t('modreq_sent', 'Module request submitted'));

      } else {

        await complete(industryId || 'custom', Array.from(selected));

        message.success(t('onb_success'));

        onComplete?.();

      }

    } catch {

      message.error(requireModuleApproval ? t('modreq_error', 'Could not submit request') : t('onb_error'));

    }

  };



  const canNext = step === 0 ? !!industryId : true;

  const closable = !firstTime;



  const footer = (

    <>

      {!firstTime ? (

        <Button className={styles.btnGhost} onClick={onClose} disabled={saving}>

          {t('onb_skip')}

        </Button>

      ) : (

        <span />

      )}

      <div className={styles.footerActions}>

        {step > 0 && (

          <Button className={styles.btnGhost} onClick={() => setStep(s => Math.max(0, s - 1))} disabled={saving}>

            {t('onb_back')}

          </Button>

        )}

        {step < 2 ? (

          <Button

            type="primary"

            className={styles.btnPrimary}

            disabled={!canNext}

            onClick={() => setStep(s => s + 1)}

          >

            {t('onb_next')}

          </Button>

        ) : (

          <Button

            type="primary"

            className={styles.btnPrimary}

            icon={<RocketOutlined />}

            loading={saving}

            onClick={finish}

          >

            {saving ? t('onb_saving') : (requireModuleApproval ? t('modreq_submit', 'Submit request') : t('onb_finish'))}

          </Button>

        )}

      </div>

    </>

  );



  const stepContent = () => {

    if (step === 0) {

      return (

        <>

          <div className={styles.sectionHead}>

            <h3 className={styles.sectionTitle}>

              <FlagOutlined style={{ color: token.colorPrimary }} />

              {t('onb_step_industry')}

            </h3>

            <p className={styles.sectionHint}>{t('onb_pick_industry_hint')}</p>

          </div>

          <div className={styles.industryGrid}>

            {INDUSTRIES.map(ind => {

              const active = industryId === ind.id;

              return (

                <div

                  key={ind.id}

                  className={[styles.industryCard, active ? styles.industryCardActive : ''].filter(Boolean).join(' ')}

                  onClick={() => pickIndustry(ind.id)}

                  role="button"

                  tabIndex={0}

                  aria-pressed={active}

                  onKeyDown={(e) => {

                    if (e.key === 'Enter' || e.key === ' ') {

                      e.preventDefault();

                      pickIndustry(ind.id);

                    }

                  }}

                >

                  {active && <CheckCircleFilled className={styles.checkMark} />}

                  <div className={styles.industryCardTop}>

                    <div className={styles.industryIcon} aria-hidden>{ind.icon}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>

                      <div className={styles.industryName}>{ind.title}</div>

                      <div className={styles.industryDesc}>{ind.description}</div>

                    </div>

                  </div>

                  {ind.modules.length > 0 && (

                    <span className={styles.industryBadge}>

                      {ind.modules.length} {t('onb_modules_label')}

                    </span>

                  )}

                </div>

              );

            })}

          </div>

        </>

      );

    }



    if (step === 1) {

      const totalSel = selected.size;

      return (

        <>

          <div className={styles.sectionHead}>

            <h3 className={styles.sectionTitle}>

              <AppstoreOutlined style={{ color: token.colorPrimary }} />

              {t('onb_step_modules')}

            </h3>

            <p className={styles.sectionHint}>{t('onb_customize_hint')}</p>

          </div>



          <div className={styles.moduleToolbar}>

            <span className={styles.selectedPill}>

              {t('onb_selected_count', { count: totalSel })}

            </span>

            <div className={styles.moduleToolbarActions}>

              <Button size="small" onClick={selectAllVisible}>{t('onb_select_all')}</Button>

              <Button size="small" onClick={clearAllOptional}>{t('onb_clear_all')}</Button>

              <Input

                allowClear

                className={styles.searchInput}

                prefix={<SearchOutlined />}

                placeholder={t('onb_search_placeholder')}

                value={search}

                onChange={e => setSearch(e.target.value)}

                aria-label={t('onb_search_placeholder')}

              />

            </div>

          </div>



          {filteredModules.length === 0 ? (

            <Empty description={t('onb_no_results')} />

          ) : (

            CATEGORY_ORDER.map(cat => {

              const items = grouped.get(cat);

              if (!items || items.length === 0) return null;

              const catLabel = t(CATEGORY_KEY[cat].key, CATEGORY_KEY[cat].fallback);

              return (

                <div key={cat} className={styles.moduleCategory}>

                  <div className={styles.categoryHead}>

                    <span className={styles.categoryTitle}>{catLabel}</span>

                    <span className={styles.categoryCount}>({items.length})</span>

                  </div>

                  <div className={styles.moduleGrid}>

                    {items.map(m => {

                      const checked = selected.has(m.key);

                      const locked = ALWAYS_ON.includes(m.key);

                      const label = t(m.labelKey, m.title);

                      return (

                        <div

                          key={m.key}

                          className={[

                            styles.moduleCard,

                            checked ? styles.moduleCardChecked : '',

                            locked ? styles.moduleCardLocked : '',

                          ].filter(Boolean).join(' ')}

                          onClick={() => !locked && toggle(m.key)}

                          role="button"

                          tabIndex={locked ? -1 : 0}

                          aria-pressed={checked}

                          aria-disabled={locked}

                          onKeyDown={(e) => {

                            if (!locked && (e.key === 'Enter' || e.key === ' ')) {

                              e.preventDefault();

                              toggle(m.key);

                            }

                          }}

                        >

                          <div className={styles.moduleCardRow}>

                            <span className={styles.moduleEmoji} aria-hidden>{m.icon}</span>

                            <div style={{ flex: 1, minWidth: 0 }}>

                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'flex-start' }}>

                                <span className={styles.moduleCardTitle}>{label}</span>

                                <Checkbox

                                  checked={checked}

                                  disabled={locked}

                                  onClick={e => e.stopPropagation()}

                                  onChange={() => toggle(m.key)}

                                  aria-label={label}

                                />

                              </div>

                              <div className={styles.moduleCardDesc}>{m.description}</div>

                              {locked && (

                                <span className={styles.lockedTag}>🔒 {t('onb_required_module')}</span>

                              )}

                            </div>

                          </div>

                        </div>

                      );

                    })}

                  </div>

                </div>

              );

            })

          )}

        </>

      );

    }



    const enabledList = Array.from(selected)

      .map(k => MODULES.find(m => m.key === k))

      .filter((m): m is ModuleDef => !!m);

    const ind = INDUSTRIES.find(i => i.id === industryId);



    return (

      <>

        <div className={styles.sectionHead}>

          <h3 className={styles.sectionTitle}>

            <RocketOutlined style={{ color: token.colorPrimary }} />

            {t('onb_step_review')}

          </h3>

          <p className={styles.sectionHint}>{t('onb_review_hint')} — {t('onb_change_later')}</p>

        </div>



        {ind && (

          <div className={styles.reviewIndustry}>

            <div className={styles.industryIcon} style={{ fontSize: 32 }} aria-hidden>{ind.icon}</div>

            <div>

              <div style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 4 }}>{t('onb_industry_label')}</div>

              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink-900)' }}>{ind.title}</div>

              <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 4 }}>{ind.description}</div>

            </div>

          </div>

        )}



        <div className={styles.reviewModuleBox}>

          <div className={styles.reviewModuleHead}>

            {t('onb_modules_label')} ({enabledList.length})

          </div>

          <div className={styles.reviewTags}>

            {enabledList.map(m => (

              <span

                key={m.key}

                className={[

                  styles.reviewTag,

                  ALWAYS_ON.includes(m.key) ? styles.reviewTagCore : '',

                ].filter(Boolean).join(' ')}

              >

                {m.icon} {t(m.labelKey, m.title)}

              </span>

            ))}

            {enabledList.length === 0 && <Empty description={t('onb_no_results')} />}

          </div>

        </div>

      </>

    );

  };



  if (pendingRequest?.status === 'pending' && requireModuleApproval) {

    return (

      <OnboardingWizardShell

        open={open}

        title={t('modreq_pending_title')}

        subtitle={t('modreq_pending_hint')}

        step={2}

        stepLabels={stepLabels}

        onClose={closable ? onClose : undefined}

        closable={closable}

        toolbar={<OnboardingUserControls />}

        footer={<span />}

      >

        <PendingApprovalScreen request={pendingRequest} />

      </OnboardingWizardShell>

    );

  }



  return (

    <OnboardingWizardShell

      open={open}

      title={t('onb_welcome')}

      subtitle={firstTime ? t('onb_welcome_sub') : undefined}

      step={step}

      stepLabels={stepLabels}

      onClose={closable ? onClose : undefined}

      closable={closable}

      footer={footer}

    >

      {firstTime && (

        <div className={styles.welcomeBanner}>

          <CheckOutlined style={{ marginTop: 2, flexShrink: 0 }} />

          <span>{t('onb_welcome_sub')}</span>

        </div>

      )}

      {stepContent()}

    </OnboardingWizardShell>

  );

}


