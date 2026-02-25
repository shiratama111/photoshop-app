/**
 * @module components/dialogs/TemplateDialog
 * Dialog for saving, loading, exporting, and importing document templates.
 *
 * Three modes:
 * - "save": Name input + save button for current document
 * - "load": Template grid with click-to-load, right-click-to-delete,
 *           export-to-file per template, and import-from-file button
 *
 * Pattern follows NewDocumentDialog.tsx.
 *
 * @see Phase 1: Template save/load
 * @see TMPL-001: Template file I/O (.psxp)
 */

import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../store';
import { useTemplateStore } from '../../template-store';
import { t } from '../../i18n';

/** TemplateDialog renders the save/load template dialog overlay. */
export function TemplateDialog(): React.JSX.Element | null {
  const mode = useAppStore((s) => s.showTemplateDialog);
  const closeDialog = useAppStore((s) => s.closeTemplateDialog);
  const templates = useTemplateStore((s) => s.templates);
  const saveAsTemplate = useTemplateStore((s) => s.saveAsTemplate);
  const loadTemplate = useTemplateStore((s) => s.loadTemplate);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const exportTemplateFile = useTemplateStore((s) => s.exportTemplateFile);
  const importTemplateFile = useTemplateStore((s) => s.importTemplateFile);

  const [name, setName] = useState('');

  const handleSave = useCallback((): void => {
    if (!name.trim()) return;
    saveAsTemplate(name.trim());
    setName('');
    closeDialog();
  }, [name, saveAsTemplate, closeDialog]);

  const handleLoad = useCallback(
    (templateId: string): void => {
      loadTemplate(templateId);
      closeDialog();
    },
    [loadTemplate, closeDialog],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, templateId: string): void => {
      e.preventDefault();
      e.stopPropagation();
      deleteTemplate(templateId);
    },
    [deleteTemplate],
  );

  const handleExport = useCallback(
    (e: React.MouseEvent, templateId: string): void => {
      e.preventDefault();
      e.stopPropagation();
      void exportTemplateFile(templateId);
    },
    [exportTemplateFile],
  );

  const handleImport = useCallback((): void => {
    void importTemplateFile().then(() => {
      closeDialog();
    });
  }, [importTemplateFile, closeDialog]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter' && mode === 'save') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog();
      }
    },
    [mode, handleSave, closeDialog],
  );

  if (!mode) return null;

  return (
    <div className="dialog-overlay" onClick={closeDialog}>
      <div
        className="dialog"
        onClick={(e): void => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{ minWidth: 420 }}
      >
        <div className="dialog-header">
          {mode === 'save' ? t('template.saveTitle') : t('template.loadTitle')}
        </div>
        <div className="dialog-body">
          {mode === 'save' && (
            <div className="new-document-field">
              <label className="new-document-label">{t('template.name')}</label>
              <input
                className="new-document-input new-document-input--wide"
                type="text"
                value={name}
                onChange={(e): void => setName(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {mode === 'load' && (
            <>
              <div className="template-grid">
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="template-card"
                    onClick={(): void => handleLoad(tmpl.id)}
                  >
                    {tmpl.thumbnailUrl && (
                      <img
                        src={tmpl.thumbnailUrl}
                        alt={tmpl.name}
                        style={{ width: '100%', borderRadius: 2 }}
                      />
                    )}
                    <div className="template-card__name">{tmpl.name}</div>
                    <div className="template-card__size">
                      {tmpl.width} x {tmpl.height}
                    </div>
                    <div className="template-card__actions">
                      <button
                        className="template-card__export-btn"
                        onClick={(e): void => handleExport(e, tmpl.id)}
                        title={t('template.exportToFile')}
                      >
                        {t('template.exportToFile')}
                      </button>
                      <button
                        className="template-card__delete-btn"
                        onClick={(e): void => handleDelete(e, tmpl.id)}
                      >
                        {t('template.delete')}
                      </button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div className="asset-browser__empty" style={{ gridColumn: '1 / -1' }}>
                    {t('template.empty')}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="dialog-footer">
          {mode === 'load' && (
            <button
              className="dialog-btn"
              onClick={handleImport}
            >
              {t('template.importFromFile')}
            </button>
          )}
          <button className="dialog-btn" onClick={closeDialog}>
            {t('common.cancel')}
          </button>
          {mode === 'save' && (
            <button
              className="dialog-btn dialog-btn--primary"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              {t('template.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
