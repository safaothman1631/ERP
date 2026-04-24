import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Tag } from 'antd';
import { BarcodeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  enabled?: boolean;
}

/**
 * Barcode scanner component - listens for HID barcode scanner input
 * Scanners typically emit characters rapidly followed by Enter
 */
export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, enabled = true }) => {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(false);
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    setIsActive(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Enter key - process barcode
      if (e.key === 'Enter' && bufferRef.current.length > 0) {
        e.preventDefault();
        const code = bufferRef.current.trim();
        if (code) {
          onScan(code);
        }
        resetBuffer();
        return;
      }

      // Regular character - add to buffer
      if (e.key.length === 1) {
        e.preventDefault();
        bufferRef.current += e.key;
        setIsActive(true);

        // Clear timeout and set new one
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // Auto-reset after 100ms of inactivity
        timeoutRef.current = setTimeout(resetBuffer, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, onScan, resetBuffer]);

  if (!enabled) return null;

  return (
    <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 1000 }}>
      {isActive && (
        <Tag icon={<BarcodeOutlined />} color="processing">
          {t('pos.barcode_scanner_active')}
        </Tag>
      )}
    </div>
  );
};

/**
 * Hook for using barcode scanner functionality
 */
export const useBarcodeScanner = (onScan: (code: string) => void, enabled = true) => {
  const bufferRef = useRef<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    setIsScanning(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Enter key - process barcode
      if (e.key === 'Enter' && bufferRef.current.length > 0) {
        e.preventDefault();
        const code = bufferRef.current.trim();
        if (code) {
          onScan(code);
        }
        resetBuffer();
        return;
      }

      // Regular character - add to buffer
      if (e.key.length === 1) {
        e.preventDefault();
        bufferRef.current += e.key;
        setIsScanning(true);

        // Clear timeout and set new one
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // Auto-reset after 100ms of inactivity
        timeoutRef.current = setTimeout(resetBuffer, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, onScan, resetBuffer]);

  return { isScanning };
};

export default BarcodeScanner;
