/**
 * FileUploadField — EP-3 (Task T-E.3.4)
 *
 * Spec: .kiro/specs/empty-state-quick-create/design.md §3.2
 *
 * A file-upload field for use inside `<QuickCreateDrawer>` / `DynamicForm`.
 *
 * Storage strategy (chosen at runtime):
 *  1. If Firebase Storage is initialized (we probe `import('../../firebase')`
 *     dynamically — if the module isn't present the import fails and we
 *     fall through), upload to:
 *        `quickcreate/{entity}/{tempId}/{filename}`
 *     and return the `download URL` as the field value.
 *  2. Otherwise, store the file as a base64 data-URL in form state and
 *     mark the gap: the future `/api/uploads` endpoint should accept this
 *     payload during apiCreate (see open question in `_deltas/EP-3-summary.md`).
 *
 * Wraps Antd's `<Upload>` so consumers get drag-drop + remove + progress
 * with zero extra configuration.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Upload, Button, message } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';

export interface FileUploadFieldValue {
  /** Resolved URL (Firebase) or `data:` URL (base64 fallback). */
  url: string;
  /** Original filename. */
  name: string;
  /** Size in bytes. */
  size: number;
  /** MIME type. */
  type: string;
  /** Storage backend used. */
  storage: 'firebase' | 'base64-pending';
}

export interface FileUploadFieldProps {
  /** Bound by Antd `Form.Item` — current value. */
  value?: FileUploadFieldValue | null;
  /** Bound by Antd `Form.Item` — change callback. */
  onChange?: (next: FileUploadFieldValue | null) => void;
  /** Entity slug — used to namespace the Firebase Storage path. */
  entity: string;
  /** Optional temp id; defaults to `Date.now()`. */
  tempId?: string;
  /** Optional accept hint (`.pdf,.docx,...`). */
  accept?: string;
  /** Max size in MB. Default 10. */
  maxSizeMB?: number;
  /** Disable interaction. */
  disabled?: boolean;
}

/**
 * Probes for an initialized Firebase Storage instance.
 * Returns `null` if unavailable so the caller can fall back to base64.
 *
 * The shape of the firebase module is unknown today — the codebase has
 * no `frontend/src/firebase/` folder yet, only call-sites inside auth
 * pages. We attempt a soft import and fail silently if missing.
 */
async function getFirebaseStorage(): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: (storage: any, path: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadBytes: (r: any, data: ArrayBuffer | Blob) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDownloadURL: (r: any) => Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: any;
} | null> {
  try {
    // Soft dynamic imports — wrap in try/catch so a missing module doesn't
    // crash the bundle at load time.
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

export function FileUploadField({
  value,
  onChange,
  entity,
  tempId,
  accept,
  maxSizeMB = 10,
  disabled,
}: FileUploadFieldProps) {
  const { t } = useTranslation('common');
  const [uploading, setUploading] = useState(false);
  const effectiveTempId = useMemo(() => tempId ?? String(Date.now()), [tempId]);

  const handleBeforeUpload = useCallback<NonNullable<UploadProps['beforeUpload']>>(
    async (file) => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        message.error(t('upload.too_large', `File exceeds ${maxSizeMB}MB`));
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
        console.error('[FileUploadField] upload error', err);
      } finally {
        setUploading(false);
      }
      // Prevent Antd from issuing its own request.
      return Upload.LIST_IGNORE;
    },
    [entity, effectiveTempId, maxSizeMB, onChange, t],
  );

  const fileList: UploadFile[] = value
    ? [
        {
          uid: 'qc-file',
          name: value.name,
          status: 'done',
          url: value.url,
          size: value.size,
          type: value.type,
        },
      ]
    : [];

  return (
    <Upload
      accept={accept}
      beforeUpload={handleBeforeUpload}
      fileList={fileList}
      disabled={disabled || uploading}
      onRemove={() => {
        onChange?.(null);
        return true;
      }}
      maxCount={1}
    >
      {!value && (
        <Button icon={<UploadOutlined />} loading={uploading} disabled={disabled}>
          {t('upload.select_file', 'Select file')}
        </Button>
      )}
      {value && (
        <Button danger icon={<DeleteOutlined />} size="small" disabled={disabled}>
          {t('upload.remove', 'Remove')}
        </Button>
      )}
    </Upload>
  );
}

export default FileUploadField;
