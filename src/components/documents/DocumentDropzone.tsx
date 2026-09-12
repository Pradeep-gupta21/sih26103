"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

/**
 * The drag-and-drop file picker shared by the project document repository modal and the
 * document analyzer. Selection only: what happens to the files (queue them, extract them)
 * is the caller's business.
 */

export const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".jpg", ".jpeg", ".png"];
export const MAX_DOCUMENT_SIZE_MB = 20;
export const MAX_DOCUMENT_SIZE_BYTES = MAX_DOCUMENT_SIZE_MB * 1024 * 1024;

export function fileExtension(file: File): string {
  return `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
}

/** Mirrors the backend's extension and size limits; returns the reason a file is rejected, or null. */
export function validateDocumentFile(file: File, accept: string[] = DOCUMENT_EXTENSIONS, maxBytes = MAX_DOCUMENT_SIZE_BYTES): string | null {
  const ext = fileExtension(file);
  if (!accept.includes(ext)) {
    return `Unsupported type (${ext}). Allowed: ${accept.map((item) => item.slice(1).toUpperCase()).join(", ")}.`;
  }
  if (file.size > maxBytes) {
    return `Exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  }
  return null;
}

type DocumentDropzoneProps = {
  onFiles: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  disabled?: boolean;
  maxSizeMb?: number;
  prompt?: string;
};

export default function DocumentDropzone({
  onFiles,
  accept = DOCUMENT_EXTENSIONS,
  multiple = true,
  disabled = false,
  maxSizeMb = MAX_DOCUMENT_SIZE_MB,
  prompt = "Drag & drop documents here",
}: DocumentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emit = (list: FileList | null) => {
    if (disabled || !list || list.length === 0) return;
    onFiles(multiple ? Array.from(list) : [list[0]]);
  };

  return (
    <div
      className={`doc-dropzone${isDragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); emit(e.dataTransfer.files); }}
      onClick={() => { if (!disabled) fileInputRef.current?.click(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!disabled) fileInputRef.current?.click();
        }
      }}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-disabled={disabled}
      aria-label={`${prompt} or click to browse files`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => { emit(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }}
        accept={accept.join(",")}
        multiple={multiple}
        style={{ display: "none" }}
        aria-hidden="true"
      />
      <div className="doc-dropzone-prompt">
        <UploadCloud size={30} className="dropzone-icon" />
        <p><strong>{prompt}</strong></p>
        <p className="doc-subprompt">or <span className="browse-link">browse files</span></p>
        <div className="doc-format-badges">
          {accept.map((ext) => <span key={ext}>{ext.slice(1).toUpperCase()}</span>)}
        </div>
        <small className="doc-size-notice">Maximum file size: <strong>{maxSizeMb} MB</strong> per file</small>
      </div>
    </div>
  );
}
