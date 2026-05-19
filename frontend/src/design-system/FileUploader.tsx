import React from 'react';
import { Upload, type UploadProps } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export interface FileUploaderProps extends UploadProps {
  hint?: string;
}

/**
 * FileUploader — Sprint 10 — drag/drop wrapper around AntD Upload.Dragger.
 */
export const FileUploader: React.FC<FileUploaderProps> = ({ hint, children, ...rest }) => {
  const { t } = useTranslation();
  return (
    <Upload.Dragger {...rest}>
      {children ?? (
        <>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">{t('upload_drag_text', 'Click or drag a file to upload')}</p>
          {hint && <p className="ant-upload-hint">{hint}</p>}
        </>
      )}
    </Upload.Dragger>
  );
};

export default FileUploader;
