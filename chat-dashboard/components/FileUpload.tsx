'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Image, Video, FileText, Paperclip } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
}

interface FilePreview {
  file: File;
  id: string;
  preview?: string;
  uploading?: boolean;
  error?: string;
}

export default function FileUpload({
  onFileUpload,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  maxFiles = 10,
  acceptedTypes = ['image/*', 'video/*', 'application/pdf', 'text/*', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'],
  disabled = false
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (file: File) => {
    const type = file.type.toLowerCase();
    if (type.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (type.startsWith('video/')) return <Video className="h-5 w-5" />;
    if (type.includes('pdf')) return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size exceeds ${formatFileSize(maxFileSize)}`;
    }
    
    if (acceptedTypes.length > 0) {
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        if (type.includes('*')) {
          const baseType = type.split('/')[0];
          return file.type.startsWith(baseType);
        }
        return file.type === type;
      });
      
      if (!isAccepted) {
        return `File type not supported`;
      }
    }
    
    return null;
  };

  const createFilePreview = useCallback((file: File): FilePreview => {
    const id = Math.random().toString(36).substring(2, 15);
    const preview: FilePreview = { file, id };
    
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, preview: e.target?.result as string } : f
        ));
      };
      reader.readAsDataURL(file);
    }
    
    return preview;
  }, []);

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles = Array.from(fileList);
    const totalFiles = files.length + newFiles.length;
    
    if (totalFiles > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }
    
    const validFiles: FilePreview[] = [];
    const errors: string[] = [];
    
    newFiles.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(createFilePreview(file));
      }
    });
    
    if (errors.length > 0) {
      alert('Some files were rejected:\n' + errors.join('\n'));
    }
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  }, [files.length, maxFiles, createFilePreview]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled) return;
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  }, [disabled, handleFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFiles(selectedFiles);
    }
  }, [handleFiles]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    const filesToUpload = files.map(f => f.file);
    
    try {
      await onFileUpload(filesToUpload);
      setFiles([]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  }, [files, onFileUpload]);

  const openFileDialog = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedTypes.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">
          Max file size: {formatFileSize(maxFileSize)}
        </p>
      </div>

      {/* File Previews */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((filePreview) => (
            <div
              key={filePreview.id}
              className="flex items-center p-3 bg-gray-50 rounded-lg"
            >
              {filePreview.preview ? (
                <img
                  src={filePreview.preview}
                  alt={filePreview.file.name}
                  className="h-12 w-12 object-cover rounded"
                />
              ) : (
                <div className="h-12 w-12 flex items-center justify-center bg-gray-200 rounded">
                  {getFileIcon(filePreview.file)}
                </div>
              )}
              
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {filePreview.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(filePreview.file.size)}
                </p>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(filePreview.id);
                }}
                className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          
          {/* Upload Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleUpload}
              disabled={disabled || isUploading || files.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
            >
              <Paperclip className="h-4 w-4" />
              <span>
                {isUploading ? 'Uploading...' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}