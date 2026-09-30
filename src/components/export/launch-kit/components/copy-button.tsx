'use client';

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { useLaunchKit } from '../launch-kit-context';

interface CopyButtonProps {
  text: string;
  copyKey: string;
  label: string;
  className?: string;
  buttonText?: string;
  copiedText?: string;
  iconSize?: number;
  title?: string;
  onClickExtra?: (e: React.MouseEvent) => void;
}

export function CopyButton({
  text,
  copyKey,
  label,
  className = 'btn-ghost p-1.5 text-zinc-400 hover:text-white flex-shrink-0',
  buttonText,
  copiedText = 'Copied!',
  iconSize = 13,
  title,
  onClickExtra,
}: CopyButtonProps) {
  const { copiedKey, handleCopy } = useLaunchKit();
  const isCopied = copiedKey === copyKey;

  const handleClick = (e: React.MouseEvent) => {
    if (onClickExtra) {
      onClickExtra(e);
    }
    handleCopy(text, copyKey, label);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      title={title || `Copy ${label}`}
    >
      {isCopied ? (
        <>
          <Check size={iconSize} className="text-emerald-400" />
          {buttonText && <span className="text-emerald-400 font-medium">{copiedText}</span>}
        </>
      ) : (
        <>
          <Copy size={iconSize} />
          {buttonText && <span>{buttonText}</span>}
        </>
      )}
    </button>
  );
}
