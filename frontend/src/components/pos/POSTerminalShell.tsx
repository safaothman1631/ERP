/**
 * POSTerminalShell — top-level layout for the POS terminal.
 *
 * Provides the three-pane skeleton (top bar, cart on one side, product grid
 * on the other) and lazy-imports the heavy children so the initial route
 * chunk stays small. The shell itself is ~120 LOC and contains no business
 * logic — it just composes the orchestration hook output into UI slots.
 *
 * The original `POSTerminal.tsx` was 799 LOC; this shell is the new home
 * for the route, with the heavy bits broken out into:
 *
 *   - `POSProductGrid`   (virtualized product list)
 *   - `POSCartPanel`     (cart line UI)
 *   - `POSPaymentModal`  (cash / card / split flow)
 *   - `POSDiscountModal` (per-line or whole-cart discount)
 */
import React, { useState, Suspense, lazy } from 'react';
import { Layout, Button, Space, Tag, Badge, Typography, Input } from 'antd';
import { message } from '../../utils/message';
import {
  WifiOutlined,
  SyncOutlined,
  CloseOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TerminalActions, TerminalState } from '../../hooks/usePOSTerminal';

const POSProductGrid = lazy(() => import('./POSProductGrid'));
const POSCartPanel = lazy(() => import('./POSCartPanel'));
const POSPaymentModal = lazy(() => import('./POSPaymentModal'));
const POSDiscountModal = lazy(() => import('./POSDiscountModal'));

const { Content, Sider } = Layout;
const { Title } = Typography;
const { Search } = Input;

export interface POSTerminalShellProps {
  terminal: TerminalState & TerminalActions;
  paymentMethods: Array<{ id: string; name: string; name_ku?: string; type?: string }>;
  onCustomerClick: () => void;
  onQuotation: () => void;
  onShipLater: () => void;
}

export const POSTerminalShell: React.FC<POSTerminalShellProps> = ({
  terminal,
  paymentMethods,
  onCustomerClick,
  onQuotation,
  onShipLater,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState<boolean>(false);
  const [discountOpen, setDiscountOpen] = useState<boolean>(false);

  const cfg = terminal.config as { name?: string; name_ku?: string } | null;
  const sess = terminal.session as { cashier_name?: string } | null;

  return (
    <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div
        style={{
          background: '#fff',
          padding: '12px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            {cfg?.name_ku || cfg?.name || ''}
          </Title>
          {sess?.cashier_name && <Tag color="blue">{sess.cashier_name}</Tag>}
          {terminal.printerLabel && (
            <Tag color={terminal.printerReady ? 'green' : 'orange'}>
              {terminal.printerLabel}
            </Tag>
          )}
        </Space>
        <Space>
          <Badge dot={!terminal.online} status={terminal.online ? 'success' : 'error'}>
            <Button icon={<WifiOutlined />} type={terminal.online ? 'default' : 'dashed'}>
              {terminal.online ? t('online') : t('offline')}
            </Button>
          </Badge>
          {terminal.syncQueue.length > 0 && (
            <Badge count={terminal.syncQueue.length}>
              <Button
                icon={<SyncOutlined spin={terminal.syncing} />}
                onClick={() => void terminal.syncOfflineQueue()}
              >
                {t('pos.sync')}
              </Button>
            </Badge>
          )}
          <Button onClick={() => navigate('/pos')} icon={<CloseOutlined />} danger>
            {t('close')}
          </Button>
        </Space>
      </div>

      <Layout>
        {/* Left: Cart */}
        <Sider
          width="40%"
          theme="light"
          style={{ borderRight: '1px solid #f0f0f0', overflow: 'auto' }}
        >
          <Suspense fallback={null}>
            <POSCartPanel
              cart={terminal.cart}
              customer={terminal.customer}
              totals={terminal.totals}
              currentOrderId={terminal.currentOrderId}
              onCustomerClick={onCustomerClick}
              onUpdateLine={terminal.updateLine}
              onRemoveLine={terminal.removeLine}
              onClearCart={terminal.clearCart}
              onSaveDraft={terminal.saveDraft}
              onOpenPayment={() => setPaymentOpen(true)}
              onOpenDiscount={() => setDiscountOpen(true)}
              onQuotation={onQuotation}
              onShipLater={onShipLater}
            />
          </Suspense>
        </Sider>

        {/* Right: Products */}
        <Content style={{ padding: 16, overflow: 'auto' }}>
          <Search
            placeholder={t('pos.search_products')}
            prefix={<BarcodeOutlined />}
            style={{ marginBottom: 16 }}
            value={terminal.searchQuery}
            onChange={(e) => terminal.setSearchQuery(e.target.value)}
            onSearch={(v) => void terminal.search(v)}
            allowClear
          />
          <Suspense fallback={null}>
            <POSProductGrid items={terminal.filteredItems} onSelect={terminal.addItem} />
          </Suspense>
        </Content>
      </Layout>

      {/* Modals — lazy too. Only rendered when opened. */}
      {paymentOpen && (
        <Suspense fallback={null}>
          <POSPaymentModal
            open={paymentOpen}
            onClose={() => setPaymentOpen(false)}
            total={terminal.totals.total}
            paymentMethods={paymentMethods}
            onConfirm={async (payments) => {
              const result = await terminal.checkout(payments);
              if (result.ok) {
                setPaymentOpen(false);
              } else if (result.error) {
                message.error(result.error);
              }
              return result;
            }}
          />
        </Suspense>
      )}
      {discountOpen && (
        <Suspense fallback={null}>
          <POSDiscountModal
            open={discountOpen}
            onClose={() => setDiscountOpen(false)}
            cart={terminal.cart}
            onApply={(itemId, discountPercent) =>
              terminal.updateLine(itemId, { discount_percent: discountPercent })
            }
          />
        </Suspense>
      )}
    </Layout>
  );
};

export default POSTerminalShell;
