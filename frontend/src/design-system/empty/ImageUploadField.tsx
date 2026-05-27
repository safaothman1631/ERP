/**
 * ImageUploadField — EP-3 (Task T-E.3.4)
 *
 * Spec: .kiro/specs/empty-state-quick-create/design.md §3.2
 *
 * Sibling of `FileUploadField` specialized for images: accepts only image
 * MIME types, renders a thumbnail preview after upload, and applies the
 * same Firebase-or-base64 strategy.
 *
 * Storage path: `quickcreate/{entity}/{tempId}/{filename}` (same as files).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Upload, message } from 'antd';
import { PlusOutlined, LoadingOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';

export interface ImageUploadFieldValue {
  url: string;
  name: string;
  size: number;
  type: string;
  storage: 'firebase' | 'base64-pending';
}

export interface ImageUploadFieldProps {
  value?: ImageUploadFieldValue | null;
  onChange?: (next: ImageUploadFieldValue | null) => void;
  entity: string;
  tempId?: string;
  /** Max dimension hint in pixels. Default 2048. */
  maxDimension?: number;
  /** Max size in MB. Default 5. */
  maxSizeMB?: number;
  disabled?: boolean;
}

async function getFirebaseStorage(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: (s: any, p: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadBytes: (r: any, data: ArrayBuffer | Blob) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDownloadURL: (r: any) => Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: any;
} | null> {
  try {
    const fb = (await import(/* @vite-ignore */ '../../firebase')) as Record<string, unknown>;
    const storage = (fb.storage ?? fb.getStorage?.()) as unknown;
    if (!storage) return null;
    const sdk = await import(/* @vite-ignore */ 'firebase/storage');
    return {
      ref: sdk.ref as never,
      uploadBytes: sdk.uploadBytes as never,
      getDownloadURL: sdk.getDownloadURL as never,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storage: storage as any,
    };
  } catch {
    return null;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

export function ImageUploadField({
  value,
  onChange,
  entity,
  tempId,
  maxSizeMB = 5,
  disabled,
}: ImageUploadFieldProps) {
  const { t } = useTranslation('common');
  const [uploading, setUploading] = useState(false);
  const effectiveTempId = useMemo(() => tempId ?? String(Date.now()), [tempId]);

  const handleBeforeUpload = useCallback<NonNullable<UploadProps['beforeUpload']>>(
    async (file) => {
      if (!IMAGE_TYPES.includes(file.type)) {
        message.error(t('upload.not_image', 'Please choose an image file'));
        return Upload.LIST_IGNORE;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        message.error(t('upload.too_large', `Image exceeds ${maxSizeMB}MB`));
        return Upload.LIST_IGNORE;
      }
      setUploading(true);
      try {
        const fb = await getFirebaseStorage();
        if (fb) {
          const path = `quickcreate/${entity}/${effectiveTempId}/${file.name}`;
          const r = fb.ref(fb.storage, path);
          await fb.uploadBytes(r, file as unknown as Blob);
          const url = await fb.getDownloadURL(r);
          onChange?.({
            url,
            name: file.name,
            size: file.size,
            type: file.type,
            storage: 'firebase',
          });
        } else {
          const dataUrl = await fileToBase64(file as unknown as File);
          onChange?.({
            url: dataUrl,
            name: file.name,
            size: file.size,
            type: file.type,
            storage: 'base64-pending',
          });
        }
      } catch (err) {
        message.error(t('upload.failed', 'Upload failed'));
        // eslint-disable-next-line no-console
        console.error('[ImageUploadField] upload error', err);
      } finally {
        setUploading(false);
      }
      return Upload.LIST_IGNORE;
    },
    [entity, effectiveTempId, maxSizeMB, onChange, t],
  );

  return (
    <div className="qc-image-upload" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <Upload
        accept={IMAGE_TYPES.join(',')}
        beforeUpload={handleBeforeUpload}
        listType="picture-card"
        showUploadList={false}
        disabled={disabled || uploading}
      >
        {value ? (
          <img
            src={value.url}
            alt={value.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <div>
            {uploading ? <LoadingOutlined /> : <PlusOutlined />}
            <div style={{ marginTop: 8 }}>{t('upload.image', 'Upload image')}</div>
          </div>
        )}
      </Upload>
      {value && !disabled && (
        <button
          type="button"
          className="qc-image-upload__remove"
          onClick={() => onChange?.(null)}
          aria-label={t('upload.remove', 'Remove image')}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color, #d9d9d9)',
            borderRadius: 4,
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          <DeleteOutlined /> {t('upload.remove', 'Remove')}
        </button>
      )}
    </div>
  );
}

export default ImageUploadField;
