/**
 * POSTerminal route — slim shell wrapper.
 *
 * The 799-LOC monolith that used to live here has been decomposed into:
 *
 *   - `usePOSTerminal()`           — orchestration hook (state + actions)
 *   - `POSTerminalShell`           — layout
 *   - `POSProductGrid`             — virtualized catalog
 *   - `POSCartPanel`               — cart UI
 *   - `POSPaymentModal`            — payment flow
 *   - `POSDiscountModal`           — discount entry
 *
 * This file keeps the route behaviour identical: same URL params, same
 * sub-dialogs (customer selector, quotation, ship-later), same offline
 * fallbacks. It just delegates the heavy lifting.
 *
 * Target: < 150 LOC.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { message } from '../../utils/message';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';
import { useLoadingState } from '../../hooks/useLoadingState';
import { useBarcodeScanner as useHIDBarcodeScanner } from '../../components/pos/BarcodeScanner';
import POSCustomerSelector from '../../components/pos/POSCustomerSelector';
import POSQuotationDialog from '../../components/pos/POSQuotationDialog';
import POSShipLaterDialog from '../../components/pos/POSShipLaterDialog';
import POSTerminalShell from '../../components/pos/POSTerminalShell';
import { usePOSTerminal } from '../../hooks/usePOSTerminal';

const POSTerminal: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const terminal = usePOSTerminal({ sessionId });
  const { showSkeleton } = useLoadingState(terminal.loading);

  // Payment-method catalog (route-specific bookkeeping, not part of the hook
  // contract because most non-terminal POS surfaces don't need it).
  const [paymentMethods, setPaymentMethods] = useState<
    Array<{ id: string; name: string; name_ku?: string; type?: string }>
  >([]);
  useEffect(() => {
    void api
      .get('/api/pos/payment-methods', { params: { is_active: true, page_size: 100 } })
      .then((res) => setPaymentMethods(res.data.items || []))
      .catch(() => undefined);
  }, []);

  // Sub-dialog visibility (driven by the cart panel's action buttons).
  const [customerOpen, setCustomerOpen] = useState<boolean>(false);
  const [quotationOpen, setQuotationOpen] = useState<boolean>(false);
  const [shipLaterOpen, setShipLaterOpen] = useState<boolean>(false);

  // Wire HID barcode scanner to the orchestration hook's scanText.
  useHIDBarcodeScanner((code) => {
    void terminal.scanText(code).then(() => {
      message.success(t('pos.item_added'));
    });
  }, true);

  useEffect(() => {
    if (!sessionId) {
      navigate('/pos');
    }
  }, [sessionId, navigate]);

  if (!sessionId) {
    return null;
  }

  if (showSkeleton) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  return (
    <>
      <POSTerminalShell
        terminal={terminal}
        paymentMethods={paymentMethods}
        onCustomerClick={() => setCustomerOpen(true)}
        onQuotation={() => setQuotationOpen(true)}
        onShipLater={() => setShipLaterOpen(true)}
      />

      <POSCustomerSelector
        visible={customerOpen}
        onClose={() => setCustomerOpen(false)}
        onSelect={(c) => {
          terminal.setCustomer(c);
          message.success(t('pos.customer_selected'));
        }}
      />

      <POSQuotationDialog
        visible={quotationOpen}
        orderId={terminal.currentOrderId}
        onClose={() => setQuotationOpen(false)}
        onSuccess={() => {
          terminal.clearCart();
          void terminal.reload();
        }}
      />

      <POSShipLaterDialog
        visible={shipLaterOpen}
        orderId={terminal.currentOrderId}
        customerAddress={
          (terminal.customer as { addresses?: unknown[] } | null)?.addresses?.[0]
        }
        onClose={() => setShipLaterOpen(false)}
        onSuccess={(_soId, soNumber) => {
          message.success(`${t('pos.sales_order_created')}: ${soNumber}`);
          terminal.clearCart();
          void terminal.reload();
        }}
      />
    </>
  );
};

export default POSTerminal;
